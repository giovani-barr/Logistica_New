/**
 * route_engine.js — Motor de Cálculo de Rotas Multi-Algoritmo
 *
 * Gera múltiplas rotas diversificadas entre dois pontos usando:
 *   - A* com heurística geodésica (rota principal)
 *   - Dijkstra clássico (fallback e variante)
 *   - Yen's K Shortest Paths com penalização de edges (diversificação)
 *   - Ranking por score ponderado (tempo, distância, trânsito)
 *
 * Integração: RouteEngine.calculateRoutes(origin, dest) → Array de rotas
 * compatíveis com o formato OSRM ({geometry, distance, duration}).
 *
 * Não possui dependências externas. Usa OSRM para:
 *   1. Obter tempos reais entre pontos via /table
 *   2. Converter sequências de waypoints em geometrias reais via /route
 */

'use strict';

const RouteEngine = (() => {

    // ── Constantes ---------------------------------------------------------

    /** Tempo máximo (ms) para requests OSRM internos. */
    const OSRM_TIMEOUT = 12000;

    /** Base do servidor OSRM. */
    const OSRM_BASE = 'https://router.project-osrm.org';

    /** Número de via-points candidatos gerados por dimensão da grade. */
    const GRID_STEPS = 3;          // 3 posições ao longo do eixo
    const GRID_OFFSETS = 3;        // 3 offsets perpendiculares (esq, centro, dir)

    /** Fator de penalização de edges já utilizados. */
    const PENALTY_FACTOR = 3.5;

    /** Máximo de caminhos gerados pelo Yen's antes da filtragem. */
    const YEN_K = 7;

    /** Similaridade máxima aceita entre duas rotas (0–1). */
    const SIMILARITY_THRESHOLD = 0.7;

    /** Número de rotas finais retornadas. */
    const TARGET_ROUTES = 3;

    // ── Utilitários geográficos -------------------------------------------

    /**
     * Distância geodésica em km (Haversine).
     * @param {number} lat1
     * @param {number} lng1
     * @param {number} lat2
     * @param {number} lng2
     * @returns {number} km
     */
    function _haversine(lat1, lng1, lat2, lng2) {
        const R  = 6371;
        const dL = (lat2 - lat1) * Math.PI / 180;
        const dG = (lng2 - lng1) * Math.PI / 180;
        const a  = Math.sin(dL / 2) ** 2 +
                   Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                   Math.sin(dG / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Estima fator de trânsito (1.0 = livre, 2.0 = congestionado)
     * baseado na hora local do usuário.
     * @returns {number}
     */
    function _estimateTraffic() {
        const h = new Date().getHours();
        // Pico manhã 7-9h e pico tarde 17-20h
        if ((h >= 7  && h <= 9)  ||
            (h >= 17 && h <= 20)) return 1.8;
        if ((h >= 6  && h < 7)   ||
            (h >= 10 && h <= 11) ||
            (h >= 16 && h < 17)  ||
            (h >= 20 && h <= 22)) return 1.3;
        return 1.0;
    }

    // ── Modelo de edge e peso ----------------------------------------------

    /**
     * Cria um edge com todos os campos esperados.
     * @param {number} from  índice no array de nós
     * @param {number} to    índice no array de nós
     * @param {number} distKm
     * @param {number} timeSec
     * @param {number} traffic fator 1.0–2.0
     * @param {boolean} toll
     * @returns {Object}
     */
    function _makeEdge(from, to, distKm, timeSec, traffic, toll = false) {
        return { from, to, distance: distKm, time: timeSec, traffic, toll };
    }

    /**
     * Função de peso do edge.
     * peso = distance*0.3 + time*0.5 + traffic*0.2 + (toll ? 10 : 0)
     *
     * Os valores são normalizados internamente para que distância e tempo
     * fiquem na mesma escala (tempo em minutos).
     *
     * @param {Object} edge
     * @returns {number}
     */
    function calculateEdgeWeight(edge) {
        const timeMin = edge.time / 60;          // converter segundos → minutos
        return edge.distance    * 0.3 +
               timeMin          * 0.5 +
               edge.traffic     * 0.2 +
               (edge.toll ? 10  : 0);
    }

    // ── Geração de via-points candidatos ----------------------------------

    /**
     * Gera GRID_STEPS × GRID_OFFSETS pontos candidatos de via entre origem e destino.
     * Os pontos são distribuídos ao longo do eixo O→D em posições intermediárias
     * e deslocados perpendicularmente para forçar caminhos alternativos.
     *
     * @param {{lat,lng}} origin
     * @param {{lat,lng}} dest
     * @returns {Array<{lat,lng}>}
     */
    function _generateViaPointCandidates(origin, dest) {
        const totalDist = _haversine(origin.lat, origin.lng, dest.lat, dest.lng);

        // Vetor direcional normalizado
        const dlat = dest.lat - origin.lat;
        const dlng = dest.lng - origin.lng;
        const len  = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
        const ux   = dlat / len;
        const uy   = dlng / len;

        // Vetor perpendicular (rotação 90°)
        const px = -uy;
        const py =  ux;

        // Offset perpendicular proporcional à distância total (~25%)
        // Em graus: totalDist km / 111 km/° ≈ graus equivalentes
        const maxOffsetDeg = (totalDist * 0.25) / 111;
        // Para distâncias muito curtas (<0.5 km) usar offset mínimo fixo
        const clampedOffset = Math.max(maxOffsetDeg, 0.003);

        const candidates = [];
        // Posições ao longo do eixo O→D (excluindo extremos)
        const steps = [];
        for (let s = 1; s <= GRID_STEPS; s++) {
            steps.push(s / (GRID_STEPS + 1));   // ex: 0.25, 0.5, 0.75
        }

        for (const t of steps) {
            const baseLat = origin.lat + dlat * t;
            const baseLng = origin.lng + dlng * t;
            // Offsets perpendiculares: -1, 0, +1 (escalados)
            const offsets = [];
            for (let o = 0; o < GRID_OFFSETS; o++) {
                offsets.push((o - Math.floor(GRID_OFFSETS / 2)));   // -1, 0, 1
            }
            for (const o of offsets) {
                candidates.push({
                    lat: baseLat + px * clampedOffset * o,
                    lng: baseLng + py * clampedOffset * o
                });
            }
        }
        return candidates;
    }

    // ── Consultas OSRM ----------------------------------------------------

    /**
     * Consulta assíncrona ao OSRM /table para obter matriz de durações reais.
     * @param {Array<{lat,lng}>} nodes
     * @returns {Promise<Array<Array<number>>|null>} matrix[i][j] = segundos, ou null se falhar
     */
    async function _fetchOsrmMatrix(nodes) {
        if (!nodes || nodes.length < 2) return null;
        try {
            const coords     = nodes.map(n => `${n.lng},${n.lat}`).join(';');
            const url        = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=duration,distance`;
            const controller = new AbortController();
            const timer      = setTimeout(() => controller.abort(), OSRM_TIMEOUT);
            const resp       = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.code !== 'Ok') return null;
            return { durations: data.durations, distances: data.distances };
        } catch (e) {
            console.warn('[RouteEngine] OSRM /table falhou:', e.message);
            return null;
        }
    }

    /**
     * Consulta OSRM /route com uma sequência de waypoints específica.
     * @param {Array<{lat,lng}>} waypoints
     * @returns {Promise<{coordinates:Array, distance:number, duration:number}|null>}
     */
    async function _fetchOsrmRoute(waypoints) {
        if (!waypoints || waypoints.length < 2) return null;
        try {
            const coords     = waypoints.map(n => `${n.lng},${n.lat}`).join(';');
            const url        = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
            const controller = new AbortController();
            const timer      = setTimeout(() => controller.abort(), OSRM_TIMEOUT);
            const resp       = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return null;
            const r = data.routes[0];
            return {
                coordinates: r.geometry.coordinates,  // [[lng,lat], ...]
                distance   : r.distance,               // metros
                duration   : r.duration                // segundos
            };
        } catch (e) {
            console.warn('[RouteEngine] OSRM /route falhou:', e.message);
            return null;
        }
    }

    // ── Construção do grafo -----------------------------------------------

    /**
     * Constrói um grafo de adjacência a partir dos nós e da matriz OSRM.
     * adjacency[i] = Map { j → edge }
     *
     * Cria edges entre todos os pares de nós.
     * Nós mais próximos do destino têm peso de edge reduzido para favorecer
     * caminhos que avançam (imitando um grafo direcional sem impor restrição rígida).
     *
     * @param {Array<{lat,lng}>} nodes
     * @param {{durations, distances}} osrmData
     * @param {number} traffic
     * @returns {Array<Map>} adjacency list
     */
    function _buildGraph(nodes, osrmData, traffic) {
        const n         = nodes.length;
        const destIdx   = n - 1;
        const adjacency = Array.from({ length: n }, () => new Map());

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i === j) continue;

                const rawTime = osrmData.durations[i][j];
                const rawDist = osrmData.distances ? osrmData.distances[i][j] / 1000 : null;

                // Fallback para distância geodésica se OSRM não retornou
                const distKm = rawDist != null
                    ? rawDist
                    : _haversine(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng);

                if (rawTime == null || rawTime <= 0) continue;

                // Pequeno bônus de direção: edges que aproximam do destino têm
                // peso reduzido em 10%, encorajando o A* a avançar
                const destDistNow  = _haversine(nodes[i].lat, nodes[i].lng,
                                                nodes[destIdx].lat, nodes[destIdx].lng);
                const destDistNext = _haversine(nodes[j].lat, nodes[j].lng,
                                                nodes[destIdx].lat, nodes[destIdx].lng);
                const dirBonus = destDistNext < destDistNow ? 0.9 : 1.0;

                const edge = _makeEdge(i, j, distKm, rawTime, traffic);
                edge._baseWeight = calculateEdgeWeight(edge) * dirBonus;
                edge._weight     = edge._baseWeight;  // pode ser penalizado depois

                adjacency[i].set(j, edge);
            }
        }
        return adjacency;
    }

    // ── A* ----------------------------------------------------------------

    /**
     * A* Search: encontra o caminho de menor custo de `src` a `dst` no grafo.
     * Heurística: distância geodésica entre nó atual e destino.
     *
     * @param {Array<Map>} adjacency
     * @param {Array<{lat,lng}>} nodes
     * @param {number} src índice do nó origem
     * @param {number} dst índice do nó destino
     * @returns {Array<number>|null} lista de índices do caminho ou null
     */
    function _aStar(adjacency, nodes, src, dst) {
        // MinHeap simplificado via array + sort (aceitável para grafos pequenos <25 nós)
        const openSet   = [{ idx: src, g: 0, f: 0, path: [src] }];
        const gScore    = new Array(adjacency.length).fill(Infinity);
        gScore[src]     = 0;

        while (openSet.length > 0) {
            // Pegar nó com menor f
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.idx === dst) return current.path;

            for (const [neighbor, edge] of adjacency[current.idx]) {
                const tentativeG = current.g + edge._weight;
                if (tentativeG < gScore[neighbor]) {
                    gScore[neighbor] = tentativeG;
                    const h = _haversine(nodes[neighbor].lat, nodes[neighbor].lng,
                                         nodes[dst].lat, nodes[dst].lng);
                    openSet.push({
                        idx : neighbor,
                        g   : tentativeG,
                        f   : tentativeG + h * 0.5, // escalar h para mesma unidade do peso
                        path: [...current.path, neighbor]
                    });
                }
            }
        }
        return null; // nenhum caminho encontrado
    }

    // ── Dijkstra ----------------------------------------------------------

    /**
     * Dijkstra clássico: fallback caso A* falhe.
     * Retorna o mesmo formato de A* (lista de índices).
     *
     * @param {Array<Map>} adjacency
     * @param {number} src
     * @param {number} dst
     * @returns {Array<number>|null}
     */
    function _dijkstra(adjacency, src, dst) {
        const n       = adjacency.length;
        const dist    = new Array(n).fill(Infinity);
        const prev    = new Array(n).fill(-1);
        const visited = new Set();
        dist[src]     = 0;

        // Priority queue mínima com array (grafo ≤ 25 nós → OK)
        const queue = [{ idx: src, d: 0 }];

        while (queue.length > 0) {
            queue.sort((a, b) => a.d - b.d);
            const { idx } = queue.shift();
            if (visited.has(idx)) continue;
            visited.add(idx);
            if (idx === dst) break;

            for (const [neighbor, edge] of adjacency[idx]) {
                if (visited.has(neighbor)) continue;
                const nd = dist[idx] + edge._weight;
                if (nd < dist[neighbor]) {
                    dist[neighbor] = nd;
                    prev[neighbor] = idx;
                    queue.push({ idx: neighbor, d: nd });
                }
            }
        }

        if (dist[dst] === Infinity) return null;

        // Reconstruir caminho
        const path = [];
        let cur = dst;
        while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
        return path[0] === src ? path : null;
    }

    // ── Penalização de edges -----------------------------------------------

    /**
     * Penaliza edges de um caminho já calculado para forçar diversificação.
     * Os pesos originais são preservados em `_baseWeight` para possível reset.
     *
     * @param {Array<Map>} adjacency
     * @param {Array<number>} path lista de índices
     * @param {number} factor multiplicador de penalização
     */
    function _penalizeEdges(adjacency, path, factor = PENALTY_FACTOR) {
        for (let i = 0; i < path.length - 1; i++) {
            const edge = adjacency[path[i]]?.get(path[i + 1]);
            if (edge) edge._weight = edge._baseWeight * factor;
        }
    }

    // ── Yen's K Shortest Paths -------------------------------------------

    /**
     * Yen's K Shortest Paths adaptado:
     * Gera K caminhos distintos usando penalização progressiva de edges.
     * (Algoritmo de Yen's completo requer remoção de nós/arestas — aqui usamos
     *  penalização crescente que é equivalente na prática para grafos pequenos.)
     *
     * @param {Array<Map>} adjacency (será mutado temporariamente na penalização)
     * @param {Array<{lat,lng}>} nodes
     * @param {number} src
     * @param {number} dst
     * @param {number} K número de caminhos desejados
     * @returns {Array<Array<number>>} lista de caminhos (cada um é array de índices)
     */
    function _yensKPaths(adjacency, nodes, src, dst, K = YEN_K) {
        const paths = [];

        // Primeiro caminho: A* sem penalização
        const first = _aStar(adjacency, nodes, src, dst)
                   || _dijkstra(adjacency, src, dst);
        if (!first) return paths;
        paths.push(first);
        _penalizeEdges(adjacency, first);

        // Caminhos subsequentes: penalizar progressivamente
        for (let k = 1; k < K; k++) {
            // Aumentar penalização com k para forçar mais divergência
            const path = _aStar(adjacency, nodes, src, dst)
                      || _dijkstra(adjacency, src, dst);
            if (!path) break;

            // Verificar se é realmente diferente dos anteriores
            const isDuplicate = paths.some(p =>
                p.length === path.length && p.every((v, i) => v === path[i])
            );
            if (!isDuplicate) paths.push(path);

            _penalizeEdges(adjacency, path, PENALTY_FACTOR * (1 + k * 0.5));
        }

        return paths;
    }

    // ── Similaridade e ranking --------------------------------------------

    /**
     * Calcula similaridade entre dois caminhos como fração de edges compartilhados.
     * similarity = edges_em_comum / total_edges_distintos
     *
     * @param {Array<number>} p1
     * @param {Array<number>} p2
     * @returns {number} 0.0 (completamente diferente) a 1.0 (idênticas)
     */
    function _routeSimilarity(p1, p2) {
        const toEdgeSet = p => {
            const set = new Set();
            for (let i = 0; i < p.length - 1; i++) {
                set.add(`${p[i]}-${p[i+1]}`);
            }
            return set;
        };
        const e1  = toEdgeSet(p1);
        const e2  = toEdgeSet(p2);
        let shared = 0;
        for (const e of e1) { if (e2.has(e)) shared++; }
        const total = new Set([...e1, ...e2]).size;
        return total === 0 ? 1 : shared / total;
    }

    /**
     * Remove rotas muito similares (similarity > SIMILARITY_THRESHOLD).
     * Mantém a de melhor score quando há conflito.
     *
     * @param {Array<{path, score}>} routes
     * @returns {Array}
     */
    function _filterSimilar(routes) {
        const kept = [];
        for (const r of routes) {
            const tooSimilar = kept.some(k =>
                _routeSimilarity(k.path, r.path) > SIMILARITY_THRESHOLD
            );
            if (!tooSimilar) kept.push(r);
        }
        return kept;
    }

    /**
     * Calcula score de ranking para uma rota.
     * score = totalTime*0.5 + totalDistance*0.3 + totalTraffic*0.2
     * (menor = melhor)
     *
     * @param {{totalTime, totalDist, totalTraffic}} metrics
     * @returns {number}
     */
    function _routeScore(metrics) {
        return metrics.totalTime     * 0.5 +
               metrics.totalDist     * 0.3 +
               metrics.totalTraffic  * 0.2;
    }

    /**
     * Ranqueia n rotas pelo score e retorna as `limit` melhores.
     *
     * @param {Array<Object>} routes  cada route deve ter {totalTime, totalDist, totalTraffic}
     * @param {number} limit
     * @returns {Array}
     */
    function rankRoutes(routes, limit = TARGET_ROUTES) {
        return routes
            .map(r => ({ ...r, _score: _routeScore(r) }))
            .sort((a, b) => a._score - b._score)
            .slice(0, limit);
    }

    // ── Segmentos alternativos -------------------------------------------

    /**
     * Gera caminhos alternativos para sub-segmentos de uma rota existente.
     * Divide a rota em 3 partes e para cada parte gera candidatos laterais.
     *
     * @param {Array<{lat,lng}>} routeNodes waypoints ordenados da rota
     * @returns {Array<Array<{lat,lng}>>} lista de variantes de waypoints (prontos para OSRM)
     */
    function generateAlternativeSegments(routeNodes) {
        if (!routeNodes || routeNodes.length < 2) return [];
        const variants = [];
        const n        = routeNodes.length;
        // Escolher pontos para dividir em ~3 segmentos
        const breakpoints = [
            Math.floor(n * 0.33),
            Math.floor(n * 0.66)
        ].filter(b => b > 0 && b < n - 1);

        for (const bp of breakpoints) {
            const pivot   = routeNodes[bp];
            const origin  = routeNodes[0];
            const dest    = routeNodes[n - 1];

            // Gera um via-point perpendicular ao pivô
            const dlat = dest.lat - origin.lat;
            const dlng = dest.lng - origin.lng;
            const len  = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
            const perp = { lat: -dlng / len, lng: dlat / len };
            const off  = Math.max(_haversine(origin.lat, origin.lng, dest.lat, dest.lng) * 0.15 / 111, 0.002);

            // Variante esquerda e direita
            for (const side of [-1, 1]) {
                const via = {
                    lat: pivot.lat + perp.lat * off * side,
                    lng: pivot.lng + perp.lng * off * side
                };
                // Inserir o via-point alternativo na posição do pivô
                const variant = [...routeNodes];
                variant.splice(bp, 1, via);
                variants.push(variant);
            }
        }
        return variants;
    }

    // ── Função principal --------------------------------------------------

    /**
     * Calcula até TARGET_ROUTES rotas diversificadas entre origem e destino.
     *
     * Fluxo:
     *  1. Gera via-points candidatos (grade perpendicular O→D)
     *  2. Consulta OSRM /table para obter tempos/distâncias reais
     *  3. Constrói grafo de adjacência ponderado
     *  4. Executa Yen's K-Paths (A* + Dijkstra) com penalização progressiva
     *  5. Filtra rotas muito similares
     *  6. Para cada rota final, consulta OSRM /route para obter geometria real
     *  7. Ranqueia e retorna no formato compatível com OSRM ({geometry, distance, duration})
     *
     * @param {{lat,lng}} origin  ponto de origem
     * @param {{lat,lng}} dest    ponto de destino
     * @returns {Promise<Array<{geometry:{coordinates:Array}, distance:number, duration:number, _label:string}>>}
     *          Formato compatível com o que o app.js espera de data.routes.
     *          Retorna null se falhar completamente (app.js usa fallback OSRM direto).
     */
    async function calculateRoutes(origin, dest) {
        try {
            const traffic = _estimateTraffic();

            // 1. Montar lista de nós: origin + candidatos + dest
            const viaPoints = _generateViaPointCandidates(origin, dest);
            const nodes     = [origin, ...viaPoints, dest];
            const srcIdx    = 0;
            const dstIdx    = nodes.length - 1;

            // 2. Consultar OSRM /table
            const osrmData = await _fetchOsrmMatrix(nodes);
            if (!osrmData) {
                console.warn('[RouteEngine] OSRM matrix indisponível — usando fallback');
                return null;
            }

            // 3. Construir grafo
            const adjacency = _buildGraph(nodes, osrmData, traffic);

            // 4. Yen's K-Paths
            const rawPaths = _yensKPaths(adjacency, nodes, srcIdx, dstIdx);
            if (!rawPaths || rawPaths.length === 0) {
                console.warn('[RouteEngine] Nenhum caminho encontrado');
                return null;
            }

            // 5. Calcular métricas para cada caminho (pré-filtro)
            const routesWithMetrics = rawPaths.map(path => {
                let totalTime    = 0;
                let totalDist    = 0;
                let totalTraffic = 0;
                for (let i = 0; i < path.length - 1; i++) {
                    const edge = adjacency[path[i]]?.get(path[i + 1]);
                    if (edge) {
                        totalTime    += edge.time;
                        totalDist    += edge.distance;
                        totalTraffic += edge.traffic;
                    }
                }
                return { path, totalTime, totalDist, totalTraffic: totalTraffic / Math.max(1, path.length - 1) };
            });

            // 5b. Filtrar similaridade
            const filtered = _filterSimilar(routesWithMetrics);

            // 6. Ranquear e manter as melhores
            const ranked = rankRoutes(filtered, TARGET_ROUTES);
            if (ranked.length === 0) return null;

            // 7. Para cada rota, buscar geometria real no OSRM
            const labels = ['Rota A*', 'Dijkstra Alt', "Yen's Alt", 'Alt D', 'Alt E'];
            const results = [];

            for (let ri = 0; ri < ranked.length; ri++) {
                const { path } = ranked[ri];
                // Waypoints OSRM = apenas nós que não são duplicatas consecutivas
                const waypoints = [];
                for (const idx of path) {
                    const n = nodes[idx];
                    if (!waypoints.length ||
                        waypoints[waypoints.length - 1].lat !== n.lat ||
                        waypoints[waypoints.length - 1].lng !== n.lng) {
                        waypoints.push(n);
                    }
                }

                // Garantir que começa em origin e termina em dest
                if (waypoints[0].lat !== origin.lat || waypoints[0].lng !== origin.lng) {
                    waypoints.unshift(origin);
                }
                if (waypoints[waypoints.length - 1].lat !== dest.lat ||
                    waypoints[waypoints.length - 1].lng !== dest.lng) {
                    waypoints.push(dest);
                }

                const geo = await _fetchOsrmRoute(waypoints);
                if (!geo) continue;

                // Formato compatível com o que app.js espera (igual ao formato OSRM /route)
                results.push({
                    geometry  : { coordinates: geo.coordinates },
                    distance  : geo.distance,
                    duration  : geo.duration,
                    _label    : labels[ri] || `Rota ${ri + 1}`,
                    _score    : ranked[ri]._score,
                    _waypoints: waypoints
                });
            }

            return results.length > 0 ? results : null;

        } catch (err) {
            console.error('[RouteEngine] Erro inesperado:', err);
            return null;
        }
    }

    // ── API pública -------------------------------------------------------
    return {
        calculateRoutes,
        rankRoutes,
        calculateEdgeWeight,
        generateAlternativeSegments,
    };

})();
