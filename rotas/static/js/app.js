let partidasMap = new Map();
let stops = [];
let waypoints = null;
let control = null;
let currentPendingPoint = null;
let pendingPreviewMarker = null;
let autoIncrement = 1;
let editingStopId = null;

// ─── Multi-rota: slots ────────────────────────────────────────────────────────
// Paleta de cores para cada slot (badge + indicador no card de pedido)
const SLOT_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c'];
const MAX_ROUTE_SLOTS = 4;

let routeSlots = [
    { nome: 'Rota 1', stops: [], rotaReabertaId: null, rotaReabertaNome: null, data: null }
];
let activeSlotIndex = 0;
let fixedRouteNameOptions = [];
let fixedRouteNamesLoaded = false;
let fixedRouteNamesPromise = null;

function normalizeFixedRouteName(nome) {
    return String(nome || '').replace(/\s+/g, ' ').trim();
}

function sortFixedRouteNames(items) {
    return [...(items || [])].sort((a, b) => {
        const nomeA = String(a && a.nome ? a.nome : '');
        const nomeB = String(b && b.nome ? b.nome : '');
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
    });
}

function setFixedRouteNames(items) {
    fixedRouteNameOptions = sortFixedRouteNames(items);
    fixedRouteNamesLoaded = true;
}

async function fetchFixedRouteNames(forceReload) {
    const api = window.routeFixedNamesApi || {};
    if (!api.list) return [];
    if (!forceReload && fixedRouteNamesLoaded) return fixedRouteNameOptions;
    if (!forceReload && fixedRouteNamesPromise) return fixedRouteNamesPromise;

    fixedRouteNamesPromise = fetch(api.list, {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then(async (resp) => {
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.success === false) {
                throw new Error(data.message || 'Não foi possível carregar os nomes fixos.');
            }
            setFixedRouteNames(Array.isArray(data.nomes) ? data.nomes : []);
            return fixedRouteNameOptions;
        })
        .finally(() => {
            fixedRouteNamesPromise = null;
        });

    return fixedRouteNamesPromise;
}

function getFixedRouteCsrfToken() {
    const directToken = String(window.FERMAP_CSRF_TOKEN || '').trim();
    if (/^[A-Za-z0-9]{32,64}$/.test(directToken)) return directToken;

    const cookieToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='));
    const parsedCookieToken = cookieToken ? decodeURIComponent(cookieToken.split('=')[1]).trim() : '';
    if (/^[A-Za-z0-9]{32,64}$/.test(parsedCookieToken)) return parsedCookieToken;

    return '';
}

async function postFixedRouteName(url, payload) {
    const csrfToken = getFixedRouteCsrfToken();
    const resp = await fetch(url, {
        method: 'POST',
        mode: 'same-origin',
        credentials: 'same-origin',
        referrerPolicy: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(payload || {})
    });
    const rawText = await resp.text();
    let data = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
        data = {};
    }
    if (!resp.ok || data.success === false) {
        throw new Error(data.message || rawText || 'Não foi possível concluir a operação.');
    }
    return data;
}

function isFixedRouteNameInOpenSlots(nome, excludedSlotIndex) {
    const normalized = normalizeFixedRouteName(nome).toLowerCase();
    if (!normalized) return false;
    return routeSlots.some((slot, idx) => {
        if (typeof excludedSlotIndex === 'number' && idx === excludedSlotIndex) return false;
        return normalizeFixedRouteName(slot && slot.nome).toLowerCase() === normalized;
    });
}

function getFixedRouteDeleteUrl(id) {
    const api = window.routeFixedNamesApi || {};
    if (!api.deleteBase) return '';
    return `${api.deleteBase}${id}/deletar/`;
}

/**
 * Persiste o estado atual (stops, rotaReabertaId, rotaReabertaNome) no slot ativo.
 */
function syncActiveSlotState() {
    const slot = routeSlots[activeSlotIndex];
    if (!slot) return;
    slot.stops = stops.filter(s => !s._fixedType).map(s => ({ ...s }));
    slot.rotaReabertaId = rotaReabertaId;
    slot.rotaReabertaNome = rotaReabertaNome;
}

/**
 * Troca o slot ativo, salvando o estado atual e carregando o novo.
 */
function switchToSlot(newIndex) {
    if (newIndex < 0 || newIndex >= routeSlots.length) return;
    if (newIndex === activeSlotIndex) {
        renderRouteSlotTabs();
        return;
    }

    syncActiveSlotState();
    activeSlotIndex = newIndex;

    const slot = routeSlots[activeSlotIndex];
    stops = [];
    rotaReabertaId = slot.rotaReabertaId;
    rotaReabertaNome = slot.rotaReabertaNome;

    // Restaurar stops do slot
    if (slot.stops && slot.stops.length) {
        const maxId = slot.stops.reduce((m, s) => Math.max(m, typeof s.id === 'number' ? s.id : 0), 0);
        autoIncrement = Math.max(autoIncrement, maxId + 1);
        stops = slot.stops.map(s => ({ ...s }));
    }

    ensureFixedPoints();
    saveAllSlotsToStorage();
    renderStops();
    recalculateRoute();
    renderRouteSlotTabs();

    // Notificar painel de pedidos para atualizar badges
    window.dispatchEvent(new CustomEvent('route-slots-changed'));
}

/**
 * Adiciona um novo slot (maximo 4). Troca automaticamente para o novo.
 */
function addRouteSlot(nome, data) {
    if (routeSlots.length >= MAX_ROUTE_SLOTS) return;
    const num = routeSlots.length + 1;
    routeSlots.push({ nome: nome || `Rota ${num}`, stops: [], rotaReabertaId: null, rotaReabertaNome: null, data: data || null });
    switchToSlot(routeSlots.length - 1);
}

function openCreateRouteSlotPopup(anchorEl) {
    if (!anchorEl || routeSlots.length >= MAX_ROUTE_SLOTS) return;
    openRouteTabEditPopup(null, anchorEl, { isCreate: true });
}

/**
 * Remove um slot. Se tiver paradas, pede confirmacao.
 * Se o slot removido for o ativo, vai para o slot 0.
 */
function removeRouteSlot(index) {
    if (routeSlots.length <= 1) return; // nunca remover o unico slot
    if (index < 0 || index >= routeSlots.length) return;

    const slot = routeSlots[index];
    const temParadas = slot.stops && slot.stops.length > 0;
    const isActive = index === activeSlotIndex;

    if (isActive) syncActiveSlotState();

    if (temParadas || (isActive && stops.filter(s => !s._fixedType).length)) {
        const total = isActive ? stops.filter(s => !s._fixedType).length : slot.stops.length;
        if (!confirm(`"${slot.nome}" tem ${total} parada(s). Remover mesmo assim?`)) return;
    }

    // Devolver pedidos do slot ao painel
    const stopsToRemove = isActive ? stops.filter(s => !s._fixedType) : (slot.stops || []);
    stopsToRemove.forEach(s => {
        if (s.sourcePedidoId) {
            window.dispatchEvent(new CustomEvent('pedido-removed-from-route', {
                detail: { pedidoId: s.sourcePedidoId }
            }));
        }
    });

    routeSlots.splice(index, 1);

    // Renomear slots automaticos para manter sequencia
    routeSlots.forEach((sl, i) => {
        if (/^Rota \d+$/.test(sl.nome)) sl.nome = `Rota ${i + 1}`;
    });

    let newActive = activeSlotIndex;
    if (isActive) {
        newActive = 0;
        stops = [];
        rotaReabertaId = null;
        rotaReabertaNome = null;
        activeSlotIndex = -1; // forca reload completo
    } else if (index < activeSlotIndex) {
        newActive = activeSlotIndex - 1;
        activeSlotIndex = newActive; // ajusta sem reload
    }

    switchToSlot(newActive > 0 ? newActive : 0);
}

/**
 * Renderiza a barra de abas de rotas e injeta no #routeTabsBar.
 */
function renderRouteSlotTabs() {
    const bar = document.getElementById('routeTabsBar');
    if (!bar) return;

    const realActiveStops = stops.filter(s => !s._fixedType).length;

    // Ordenar abas por data: mais próxima (hoje) → mais distante; sem data = hoje
    const todayStr = (() => {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    })();
    const sortedIndices = routeSlots.map((_, i) => i).sort((a, b) => {
        const da = routeSlots[a].data || todayStr;
        const db = routeSlots[b].data || todayStr;
        return da.localeCompare(db);
    });

    let html = '';
    sortedIndices.forEach(i => {
        const slot = routeSlots[i];
        const isActive = i === activeSlotIndex;
        const count = isActive ? realActiveStops : (slot.stops ? slot.stops.length : 0);
        const cor = SLOT_COLORS[i] || SLOT_COLORS[0];
        const activeStyle = isActive
            ? `background:${cor}; color:#fff; border-color:${cor};`
            : `background:#f8fafc; color:#475569; border-color:#e2e8f0;`;

        const dateLabel = formatSlotDate(slot.data);
        const tooltipDate = formatSlotDateFull(slot.data);
        const tooltip = slot.nome + (tooltipDate ? ' · ' + tooltipDate : '') + ' — Duplo-clique para editar';

        html += `
            <button class="route-tab${isActive ? ' active' : ''}" data-slot-idx="${i}" style="${activeStyle}" title="${tooltip.replace(/"/g, '&quot;')}">
                <span class="route-tab-dot" style="background:${isActive ? 'rgba(255,255,255,.5)' : cor};"></span>
                <span class="route-tab-content">
                    <span class="route-tab-name">${slot.nome}</span>
                    ${dateLabel ? `<span class="route-tab-date">${dateLabel}</span>` : ''}
                </span>
                ${count > 0 ? `<span class="route-tab-badge" style="background:${isActive ? 'rgba(255,255,255,.25)' : cor + '22'}; color:${isActive ? '#fff' : cor};">${count}</span>` : ''}
                ${routeSlots.length > 1 ? `<button class="route-tab-close" data-slot-remove="${i}" title="Remover rota">×</button>` : ''}
            </button>`;
    });

    if (routeSlots.length < MAX_ROUTE_SLOTS) {
        html += `<button class="route-tab-add" title="Adicionar nova rota" type="button">+</button>`;
    }

    bar.innerHTML = html;

    // Eventos: clicar na aba / remover
    bar.querySelectorAll('.route-tab').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (e.target.closest('.route-tab-close')) return;
            if (e.detail >= 2) return; // duplo-clique: deixar o dblclick tratar
            const idx = Number(this.getAttribute('data-slot-idx'));
            if (!isNaN(idx)) switchToSlot(idx);
        });
    });
    bar.querySelectorAll('.route-tab-close').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const idx = Number(this.getAttribute('data-slot-remove'));
            if (!isNaN(idx)) removeRouteSlot(idx);
        });
    });
    const addBtn = bar.querySelector('.route-tab-add');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openCreateRouteSlotPopup(addBtn);
        });
    }

    // Duplo-clique no conteúdo da aba: abre popup de nome + data
    bar.querySelectorAll('.route-tab-content').forEach(contentEl => {
        contentEl.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            const tabBtn = contentEl.closest('.route-tab');
            const idx = Number(tabBtn.getAttribute('data-slot-idx'));
            if (!isNaN(idx)) openRouteTabEditPopup(idx, tabBtn);
        });
    });
}

/** Retorna "Hoje" se a data for hoje ou nula, ou "DD/MM" se for outra data. */
function formatSlotDate(data) {
    const d = new Date();
    const hojeStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    if (!data || data === hojeStr) return 'Hoje';
    const parts = data.split('-');
    if (parts.length !== 3) return '';
    return parts[2] + '/' + parts[1];
}

/** Retorna data completa: "Hoje" ou "DD/MM/AAAA" para tooltip. */
function formatSlotDateFull(data) {
    const d = new Date();
    const hojeStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    if (!data || data === hojeStr) return 'Hoje';
    const parts = data.split('-');
    if (parts.length !== 3) return '';
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

/** Abre modal para gerenciar nomes salvos de rotas. */
function openManageFixedNamesModal() {
    const modal = document.createElement('div');
    modal.id = 'manageFixedNamesModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        width: 90%; max-width: 400px; padding: 24px; max-height: 80vh; overflow-y: auto;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Gerenciar Nomes de Rotas';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px; font-weight: 600;';
    content.appendChild(title);

    // Input para novo nome
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
    
    const newNameInput = document.createElement('input');
    newNameInput.type = 'text';
    newNameInput.placeholder = 'Novo nome...';
    newNameInput.style.cssText = `
        flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
        font-size: 14px;
    `;
    
    const btnAdd = document.createElement('button');
    btnAdd.textContent = '+';
    btnAdd.style.cssText = `
        padding: 8px 12px; background: #007bff; color: white; border: none;
        border-radius: 4px; cursor: pointer; font-weight: 600;
    `;
    
    inputContainer.appendChild(newNameInput);
    inputContainer.appendChild(btnAdd);
    content.appendChild(inputContainer);

    // Lista de nomes salvos
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'border-top: 1px solid #eee; padding-top: 12px;';
    
    const renderList = () => {
        listContainer.innerHTML = '';
        if (!fixedRouteNameOptions || fixedRouteNameOptions.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'Nenhum nome salvo ainda.';
            empty.style.cssText = 'color: #666; font-size: 13px; margin: 0;';
            listContainer.appendChild(empty);
            return;
        }
        
        fixedRouteNameOptions.forEach((item) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px; background: #f9f9f9; border-radius: 4px; margin-bottom: 6px;
            `;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.nome;
            nameSpan.style.cssText = 'font-size: 13px; flex: 1;';
            
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.style.cssText = `
                background: #dc3545; color: white; border: none; border-radius: 3px;
                padding: 4px 8px; cursor: pointer; font-size: 12px;
            `;
            delBtn.addEventListener('click', async () => {
                if (!confirm(`Excluir "${item.nome}"?`)) return;
                try {
                    const response = await fetch(getFixedRouteDeleteUrl(item.id), {
                        method: 'POST',
                        headers: { 'X-CSRFToken': getFixedRouteCsrfToken() }
                    });
                    if (response.ok) {
                        const index = fixedRouteNameOptions.findIndex(i => i.id === item.id);
                        if (index > -1) {
                            fixedRouteNameOptions.splice(index, 1);
                        }
                        renderList();
                        if (typeof showToast === 'function') showToast('Nome deletado com sucesso.');
                    } else {
                        alert('Erro ao deletar.');
                    }
                } catch (e) {
                    alert('Erro ao deletar: ' + e.message);
                }
            });
            
            row.appendChild(nameSpan);
            row.appendChild(delBtn);
            listContainer.appendChild(row);
        });
    };

    // Botão para salvar novo nome
    btnAdd.addEventListener('click', async () => {
        const nome = newNameInput.value.trim();
        if (!nome) {
            alert('Digite um nome para salvar.');
            newNameInput.focus();
            return;
        }
        try {
            btnAdd.disabled = true;
            btnAdd.textContent = '...';
            const data = await postFixedRouteName((window.routeFixedNamesApi || {}).save, { nome });
            if (data.item) {
                fixedRouteNameOptions.push(data.item);
                fixedRouteNameOptions = sortFixedRouteNames(fixedRouteNameOptions);
                renderList();
                newNameInput.value = '';
                if (typeof showToast === 'function') showToast(data.message || 'Nome salvo com sucesso.');
            }
        } catch (e) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            btnAdd.disabled = false;
            btnAdd.textContent = '+';
        }
    });

    newNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnAdd.click();
    });

    content.appendChild(listContainer);
    renderList();

    // Botão fechar
    const btnClose = document.createElement('button');
    btnClose.textContent = 'Fechar';
    btnClose.style.cssText = `
        width: 100%; padding: 10px; background: #6c757d; color: white; border: none;
        border-radius: 4px; cursor: pointer; margin-top: 12px; font-weight: 600;
    `;
    btnClose.addEventListener('click', () => modal.remove());
    content.appendChild(btnClose);

    modal.appendChild(content);

    // Fechar ao clicar fora
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
    newNameInput.focus();
}

/** Abre popup flutuante para editar nome e data do slot. */
function openRouteTabEditPopup(slotIdx, anchorEl, options) {
    const opts = options || {};
    const isCreate = !!opts.isCreate;
    const slot = isCreate ? { nome: '', data: null } : routeSlots[slotIdx];
    if (!slot || !anchorEl) return;

    // Remove popup já existente
    const existing = document.getElementById('routeTabEditPopup');
    if (existing) existing.remove();

    const todayStr = () => {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    };

    const popup = document.createElement('div');
    popup.id = 'routeTabEditPopup';
    popup.className = 'route-tab-edit-popup';
    popup.innerHTML = `
        <div class="rte-row">
            <label>Nomes salvos</label>
            <div class="rte-fixed-row">
                <select id="rteFixedNameSelect">
                    <option value="">Carregando...</option>
                </select>
                <button class="rte-btn rte-btn-mini" id="rteManageNamesBtn" type="button" title="Gerenciar nomes">+</button>
            </div>
        </div>
        <div class="rte-row">
            <label>Data de agendamento</label>
            <input type="date" id="rteDateInput" value="${slot.data || ''}" />
        </div>
        <div class="rte-actions">
            <button class="rte-btn" id="rteHojeBtn" type="button">Hoje</button>
            <button class="rte-btn rte-btn-confirm" id="rteConfirmBtn" type="button">${isCreate ? 'Criar rota' : 'Confirmar'}</button>
        </div>
        <div class="rte-error" id="rteErrorMsg" style="display:none;"></div>`;
    document.body.appendChild(popup);

    // Posicionar abaixo da aba, ajustando para não sair da tela
    const rect = anchorEl.getBoundingClientRect();
    const popW = 320;
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (left < 8) left = 8;
    popup.style.left = left + 'px';
    popup.style.top = (rect.bottom + 6) + 'px';

    const dateInput = document.getElementById('rteDateInput');
    const errorMsg = document.getElementById('rteErrorMsg');
    const fixedNameSelect = document.getElementById('rteFixedNameSelect');
    const manageNamesBtn = document.getElementById('rteManageNamesBtn');
    dateInput.focus();

    const renderFixedNameOptions = (selectedName) => {
        const normalizedSelected = normalizeFixedRouteName(selectedName);
        const optionsHtml = ['<option value="">Selecione um nome salvo</option>'];
        fixedRouteNameOptions.forEach((item) => {
            const isSelected = normalizedSelected && normalizeFixedRouteName(item.nome).toLowerCase() === normalizedSelected.toLowerCase();
            const safeOptionName = String(item.nome || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            optionsHtml.push(`<option value="${item.id}"${isSelected ? ' selected' : ''}>${safeOptionName}</option>`);
        });
        fixedNameSelect.innerHTML = optionsHtml.join('');
    };

    const setFixedLoadingState = (loading) => {
        fixedNameSelect.disabled = loading;
        manageNamesBtn.disabled = loading;
    };

    const loadFixedNamesForPopup = async (forceReload, selectedName) => {
        fixedNameSelect.innerHTML = '<option value="">Carregando...</option>';
        setFixedLoadingState(true);
        try {
            await fetchFixedRouteNames(!!forceReload);
            renderFixedNameOptions(selectedName || slot.nome || '');
        } catch (error) {
            fixedNameSelect.innerHTML = '<option value="">Falha ao carregar</option>';
            errorMsg.textContent = error.message || 'Não foi possível carregar os nomes salvos.';
            errorMsg.style.display = 'block';
        } finally {
            setFixedLoadingState(false);
        }
    };

    const clearValidation = () => {
        dateInput.classList.remove('rte-invalid');
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
    };

    const showValidation = (message, fields) => {
        const invalidFields = Array.isArray(fields) ? fields : [];
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        dateInput.classList.toggle('rte-invalid', invalidFields.includes('data'));
    };

    dateInput.addEventListener('input', clearValidation);
    fixedNameSelect.addEventListener('change', () => {
        clearValidation();
    });

    manageNamesBtn.addEventListener('click', () => {
        openManageFixedNamesModal();
    });

    document.getElementById('rteHojeBtn').addEventListener('click', () => {
        dateInput.value = todayStr();
        clearValidation();
        nomeInput.focus();
    });

    let closed = false;
    const commit = () => {
        if (closed) return;
        closed = true;
        const selectedId = fixedNameSelect.value;
        const selectedItem = fixedRouteNameOptions.find((item) => String(item.id) === selectedId);
        const nome = selectedItem ? selectedItem.nome : '';
        const data = dateInput.value || null;
        
        if (isCreate) {
            if (!nome || !data) {
                closed = false;
                showValidation('Selecione um nome e defina uma data para criar a rota.', ['nome', 'data'].filter((field) => {
                    if (field === 'nome') return !nome;
                    if (field === 'data') return !data;
                    return false;
                }));
                dateInput.focus();
                return;
            }
            addRouteSlot(nome, data);
            if (popup.parentNode) popup.remove();
            return;
        }

        if (nome) {
            slot.nome = nome;
            if (slotIdx === activeSlotIndex) rotaReabertaNome = slot.nome;
        }
        slot.data = data;
        saveAllSlotsToStorage();
        if (popup.parentNode) popup.remove();
        renderRouteSlotTabs();
    };

    const closeOnly = () => {
        if (closed) return;
        closed = true;
        if (popup.parentNode) popup.remove();
    };

    document.getElementById('rteConfirmBtn').addEventListener('click', commit);

    // Fechar ao clicar fora
    const onOutside = (e) => {
        if (!popup.contains(e.target)) {
            document.removeEventListener('mousedown', onOutside);
            if (isCreate) closeOnly();
            else commit();
        }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside), 50);

    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.removeEventListener('mousedown', onOutside);
            commit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            document.removeEventListener('mousedown', onOutside);
            closeOnly();
        }
    });

    loadFixedNamesForPopup(false, slot.nome || '');
}

/** Retorna um Set com todos os sourcePedidoId em uso em TODOS os slots (incluindo o ativo). */
function getAllUsedPedidoIds() {
    const ids = new Set();
    stops.filter(s => !s._fixedType && s.sourcePedidoId).forEach(s => ids.add(String(s.sourcePedidoId)));
    routeSlots.forEach((slot, i) => {
        if (i === activeSlotIndex) return; // ja coberto acima
        (slot.stops || []).forEach(s => {
            if (s.sourcePedidoId) ids.add(String(s.sourcePedidoId));
        });
    });
    return ids;
}

/** Retorna o índice do slot que contém o pedido (ou -1). */
function getSlotIndexForPedido(pedidoId) {
    const pid = String(pedidoId);
    if (stops.some(s => !s._fixedType && String(s.sourcePedidoId) === pid)) return activeSlotIndex;
    for (let i = 0; i < routeSlots.length; i++) {
        if (i === activeSlotIndex) continue;
        if ((routeSlots[i].stops || []).some(s => String(s.sourcePedidoId) === pid)) return i;
    }
    return -1;
}

// Alternativas de segmento
let _segAltLayers  = [];
let _segAltPanel   = null;
let _segAltStopIdx = null;

// Comparativo de rotas — array de {layer, label, color, visible, distKm, timeMin, orderedInner}
let _compRoutesData     = [];
let _compLegendEl       = null;
// marcadores de preview (numeração da rota alternativa no mapa)
let _compPreviewMarkers = [];
let _compPreviewIdx     = null;
// aliases retrocompatíveis
let _secRouteLayer  = null;
let _secRouteLegend = null;

// IDs reservados para pontos fixos
const FIXED_PARTIDA_ID = -1;
const FIXED_FINAL_ID   = -2;

// Função de distância ativa — substituída por distâncias reais OSRM durante a otimização
let _gDistFn = null;
function _dist(a, b) {
    if (_gDistFn) return _gDistFn(a, b);
    return distance(a.coords, b.coords);
}

function _criarParadaFixa(tipo) {
    const cfg = tipo === 'partida' ? window.pontoFixoPartida : window.pontoFixoFinal;
    if (!cfg || !cfg.configured) return null;
    const icone = tipo === 'partida' ? '📍' : '🏁';
    const nomePadrao = tipo === 'partida' ? 'Ponto de Partida' : 'Ponto Final';
    return {
        id:         tipo === 'partida' ? FIXED_PARTIDA_ID : FIXED_FINAL_ID,
        name:       `${icone} ${cfg.name || nomePadrao}`,
        address:    cfg.name || nomePadrao,
        lat:        cfg.lat,
        lng:        cfg.lng,
        coords:     [cfg.lat, cfg.lng],
        obs:        '',
        _fixedType: tipo,
    };
}

/**
 * Garante que os pontos fixos configurados estejam sempre na posição
 * correta dentro do array stops[] (ponto zero e último ponto).
 * Só insere pontos fixos se houver ao menos uma parada real.
 */
function ensureFixedPoints() {
    // Remover pontos fixos existentes
    stops = stops.filter(s => !s._fixedType);

    // Só adiciona se houver paradas reais
    if (!stops.length) return;

    const partida = _criarParadaFixa('partida');
    const final_  = _criarParadaFixa('final');

    if (partida) stops.unshift(partida);
    if (final_)  stops.push(final_);
}

// Persistência local dos cards de rota
const ROTA_CACHE_KEY = 'logistica_painel_rotas_cache';
const MULTI_ROTA_CACHE_KEY = 'logistica_painel_rotas_multislot';
const rotaCacheSupport = (() => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const testKey = '__rota_cache_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn('Persistência local indisponível:', error);
        return false;
    }
})();

function saveStopsToStorage() {
    if (!rotaCacheSupport) return;
    // Delegar para saveAllSlotsToStorage
    saveAllSlotsToStorage();
}

function saveAllSlotsToStorage() {
    if (!rotaCacheSupport) return;
    try {
        syncActiveSlotState();
        const payload = {
            updated_at: new Date().toISOString(),
            activeSlotIndex,
            slots: routeSlots.map(slot => ({
                nome: slot.nome,
                data: slot.data || null,
                rotaReabertaId: slot.rotaReabertaId,
                rotaReabertaNome: slot.rotaReabertaNome,
                stops: (slot.stops || []).map(s => ({
                    ...s,
                    coords: Array.isArray(s.coords) ? s.coords : [s.lat, s.lng]
                }))
            }))
        };
        window.localStorage.setItem(MULTI_ROTA_CACHE_KEY, JSON.stringify(payload));
        // Manter compatibilidade: limpar chave antiga
        window.localStorage.removeItem(ROTA_CACHE_KEY);
    } catch (error) {
        console.warn('Erro ao salvar rotas localmente:', error);
    }
}

function loadStopsFromStorage() {
    // Legado: retorna apenas os stops do slot 0 para compatibilidade
    if (!rotaCacheSupport) return null;
    try {
        const raw = window.localStorage.getItem(MULTI_ROTA_CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.slots) && parsed.slots.length) {
                // Restaurar todos os slots
                routeSlots = parsed.slots.map(sl => ({
                    nome: sl.nome || 'Rota',
                    data: sl.data || null,
                    rotaReabertaId: sl.rotaReabertaId || null,
                    rotaReabertaNome: sl.rotaReabertaNome || null,
                    stops: Array.isArray(sl.stops) ? sl.stops.filter(s => !s._fixedType).map(s => {
                        const lat = Number(s.lat);
                        const lng = Number(s.lng);
                        return Number.isNaN(lat) || Number.isNaN(lng) ? null : {
                            ...s, lat, lng, coords: Array.isArray(s.coords) ? s.coords.map(Number) : [lat, lng]
                        };
                    }).filter(Boolean) : []
                }));
                activeSlotIndex = Math.min(parsed.activeSlotIndex || 0, routeSlots.length - 1);
                return routeSlots[activeSlotIndex].stops;
            }
        }
        // Fallback: chave legada
        const rawLegacy = window.localStorage.getItem(ROTA_CACHE_KEY);
        if (!rawLegacy) return null;
        const parsed = JSON.parse(rawLegacy);
        if (!parsed || !Array.isArray(parsed.stops)) return null;
        return parsed.stops;
    } catch (error) {
        console.warn('Erro ao carregar rota local:', error);
        return null;
    }
}

function clearStopsStorage() {
    if (!rotaCacheSupport) return;
    try {
        window.localStorage.removeItem(ROTA_CACHE_KEY);
        window.localStorage.removeItem(MULTI_ROTA_CACHE_KEY);
    } catch (error) {
        console.warn('Erro ao limpar cache da rota:', error);
    }
}

function restoreStopsFromStorage() {
    const cachedStops = loadStopsFromStorage();
    if (!cachedStops || !cachedStops.length) return false;

    stops = cachedStops
        .filter(s => !s._fixedType) // ignorar entradas fixas antigas
        .map(stop => {
            const lat = Number(stop.lat);
            const lng = Number(stop.lng);
            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                return null;
            }
            return {
                ...stop,
                lat,
                lng,
                coords: Array.isArray(stop.coords)
                    ? stop.coords.map(coord => Number(coord))
                    : [lat, lng]
            };
        })
        .filter(Boolean);

    if (!stops.length) {
        clearStopsStorage();
        return false;
    }

    // Usar o maior ID real dos stops restaurados para evitar colisões
    const maxId = stops.reduce((max, s) => Math.max(max, typeof s.id === 'number' ? s.id : 0), 0);
    autoIncrement = Math.max(autoIncrement, maxId + 1);
    ensureFixedPoints();
    renderStops();
    recalculateRoute();
    return true;
}

// Configurações dos cards de rota (definidas no template)
let rotasCardConfig = window.rotasCardConfig || {
    mostrar_numero: true
};

// Campos configurados para exibição nos cards de rota (definidos no template)
let rotasCamposExibicao = window.rotasCamposExibicao || [];

// Configurações visuais dos cards de rota
let rotasVisualConfig = window.rotasVisualConfigData || {};

// Regras de cor para os cards de rota
let rotasRegrasCor = window.rotasRegrasCor || [];

// Variável global para armazenar dados da rota a carregar
let rotaParaCarregar = null;

// ID da rota reaberta (para sobrescrever ao salvar)
let rotaReabertaId = null;
let rotaReabertaNome = null;

// Carregar dados da rota se presente na URL
(function loadRotaFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const rotaData = urlParams.get('rota_data');
    
    if (rotaData) {
        try {
            rotaParaCarregar = JSON.parse(decodeURIComponent(rotaData));
            
            // Limpar URL imediatamente para evitar recarregamento
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
            console.error('Erro ao parsear dados da rota:', e);
            alert('Erro ao carregar dados da rota. Por favor, tente novamente.');
        }
    }
})();

const map = L.map('map').setView([-0.034987, -51.074846], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Google Autocomplete
const addressInput = document.getElementById('addressSearch');
const mapsStatusNotice = document.getElementById('mapsStatusNotice');
const routeMapsConfig = window.routeMapsConfig || {};
const routeMapsCountry = String(routeMapsConfig.country ? routeMapsConfig.country : 'br').trim().toLowerCase() || 'br';
const addressInputDefaultPlaceholder = addressInput ? (addressInput.getAttribute('placeholder') || 'Digite o endereço do cliente...') : 'Digite o endereço do cliente...';
let geocoder = null;
let autocomplete = null;

function isGoogleMapsApiAvailable() {
    return Boolean(
        window.google &&
        window.google.maps &&
        typeof window.google.maps.Geocoder === 'function' &&
        window.google.maps.places &&
        typeof window.google.maps.places.Autocomplete === 'function'
    );
}

function getGoogleMapsUnavailableMessage() {
    if (!routeMapsConfig.scriptRequested) {
        return 'Busca por endereço do Google indisponível. Configure a chave em Configurações da Conta para ativar autocomplete e geocodificação.';
    }
    return 'Busca por endereço do Google indisponível. Verifique a chave da conta, as APIs Maps JavaScript, Places e Geocoding e as restrições da chave no Google Cloud.';
}

function updateGoogleMapsAvailabilityUi() {
    const available = isGoogleMapsApiAvailable();
    const unavailableMessage = getGoogleMapsUnavailableMessage();

    if (addressInput) {
        addressInput.dataset.mapsAvailable = available ? 'true' : 'false';
        addressInput.placeholder = available
            ? addressInputDefaultPlaceholder
            : 'Google Maps indisponível. Informe coordenadas manualmente.';
        addressInput.title = available ? '' : unavailableMessage;
        addressInput.autocomplete = available ? 'street-address' : 'off';
    }

    if (mapsStatusNotice) {
        mapsStatusNotice.textContent = available ? '' : unavailableMessage;
        mapsStatusNotice.style.display = available ? 'none' : 'block';
    }

    return available;
}

function showAddressSearchToast(message, type) {
    if (typeof showToast === 'function') {
        showToast(message, type || 'info');
    }
}

function getAddressSearchInputValue() {
    return normalizeAddressToken(addressInput ? addressInput.value : '');
}

function getReadableGeocodeError(status) {
    switch (String(status || '').toUpperCase()) {
        case 'ZERO_RESULTS':
            return 'Endereço não encontrado. Tente um endereço mais específico.';
        case 'OVER_QUERY_LIMIT':
            return 'Limite de consultas do Google Maps atingido. Tente novamente em instantes.';
        case 'REQUEST_DENIED':
            return 'A consulta ao Google Maps foi negada. Verifique a chave e as APIs habilitadas.';
        case 'INVALID_REQUEST':
            return 'Endereço inválido para pesquisa. Revise o texto informado.';
        case 'UNKNOWN_ERROR':
            return 'O Google Maps falhou temporariamente. Tente novamente.';
        default:
            return 'Endereço não encontrado. Tente um endereço mais específico.';
    }
}

function applyAddressSearchResult(result, options) {
    if (!result || !isValidRouteCoordinate(result.lat, result.lng)) {
        showAddressSearchToast('A pesquisa retornou um local sem coordenadas válidas.', 'warning');
        return false;
    }

    setPendingPointPreview(result.lat, result.lng, result.address || getAddressSearchInputValue(), {
        flyTo: true,
        updateAddressInput: true,
        ...(options || {})
    });
    return true;
}

function searchAddressFromInput(options) {
    const query = getAddressSearchInputValue();
    if (!query) {
        showAddressSearchToast('Informe um endereço para buscar.', 'info');
        return Promise.resolve(false);
    }

    return geocodeSearchAddress(query)
        .then((result) => applyAddressSearchResult(result, options))
        .catch((error) => {
            showAddressSearchToast(error && error.message ? error.message : 'Não foi possível localizar este endereço.', 'warning');
            return false;
        });
}

function handleAutocompletePlaceChanged() {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place) {
        showAddressSearchToast('Não foi possível ler a sugestão selecionada.', 'warning');
        return;
    }

    if (!place.geometry || !place.geometry.location) {
        const typedAddress = getAddressSearchInputValue();
        if (!typedAddress) {
            showAddressSearchToast('Selecione um endereço mais específico.', 'warning');
            return;
        }

        searchAddressFromInput();
        return;
    }

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || getAddressSearchInputValue();

    applyAddressSearchResult({ lat, lng, address });
}

function ensureGoogleMapsServices() {
    if (!updateGoogleMapsAvailabilityUi()) return false;

    if (!geocoder) {
        geocoder = new window.google.maps.Geocoder();
    }

    if (!autocomplete && addressInput) {
        autocomplete = new window.google.maps.places.Autocomplete(addressInput, {
            componentRestrictions: { country: routeMapsCountry },
            types: ['geocode']
        });
        autocomplete.addListener('place_changed', handleAutocompletePlaceChanged);
    }

    return true;
}

updateGoogleMapsAvailabilityUi();
ensureGoogleMapsServices();

function isValidRouteCoordinate(lat, lng) {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return false;
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return false;
    if (Math.abs(parsedLat) < 1e-9 && Math.abs(parsedLng) < 1e-9) return false;
    return true;
}

function clearPendingPreviewMarker() {
    if (!pendingPreviewMarker) return;
    try {
        map.removeLayer(pendingPreviewMarker);
    } catch (error) {
        // Ignora falha de remoção do marcador temporário.
    }
    pendingPreviewMarker = null;
}

function setPendingPointPreview(lat, lng, address, options) {
    const opts = options || {};
    const coordsInput = document.getElementById('coordsInput');
    const confirmBox = document.getElementById('confirmAdd');
    const resolvedAddress = String(address || '').trim();

    currentPendingPoint = { lat, lng };
    if (coordsInput) coordsInput.value = `${lat}, ${lng}`;
    if (opts.updateAddressInput !== false && addressInput) {
        addressInput.value = resolvedAddress;
    }

    clearPendingPreviewMarker();
    if (opts.flyTo !== false) {
        map.flyTo([lat, lng], opts.zoom || 16);
    }

    pendingPreviewMarker = L.marker([lat, lng], {
        title: editingStopId !== null ? 'Localização ajustada (pendente)' : 'Novo Ponto (Pendente)',
        icon: L.icon({
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI5IiBmaWxsPSIjZ3JleTEwMCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    }).addTo(map).bindPopup(resolvedAddress || `${lat}, ${lng}`).openPopup();

    if (confirmBox) confirmBox.style.display = 'block';
}

function buildStopFieldLookup(stop) {
    const lookup = new Map();
    const pedidoData = stop && stop.pedidoData && typeof stop.pedidoData === 'object' ? stop.pedidoData : {};
    const dadosJson = pedidoData && pedidoData.dados_json && typeof pedidoData.dados_json === 'object' ? pedidoData.dados_json : {};

    [dadosJson, pedidoData, stop || {}].forEach((source) => {
        Object.entries(source).forEach(([key, value]) => {
            const normalizedKey = String(key || '').trim().toLowerCase();
            if (!normalizedKey || lookup.has(normalizedKey)) return;
            lookup.set(normalizedKey, value);
        });
    });

    return lookup;
}

function normalizeAddressToken(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildStopSearchAddress(stop) {
    if (!stop) return '';
    const lookup = buildStopFieldLookup(stop);
    const selectedFields = Array.isArray(window.routeAddressSearchConfig?.fields)
        ? window.routeAddressSearchConfig.fields.map((field) => normalizeAddressToken(field)).filter(Boolean)
        : [];
    const addressParts = [];
    const seen = new Set();

    const addValue = (value) => {
        const normalizedValue = normalizeAddressToken(value);
        const compareValue = normalizedValue.toLowerCase();
        if (!normalizedValue || normalizedValue === '0' || normalizedValue === '0,0' || seen.has(compareValue)) return;
        seen.add(compareValue);
        addressParts.push(normalizedValue);
    };

    selectedFields.forEach((field) => addValue(lookup.get(field.toLowerCase())));

    if (!addressParts.length) {
        [
            stop.address,
            lookup.get('endereco'),
            lookup.get('endereco entrega'),
            lookup.get('endereco cliente'),
            lookup.get('numero endereco cliente'),
            lookup.get('bairro'),
            lookup.get('bairro cliente'),
            lookup.get('cidade'),
            lookup.get('cidade cliente'),
            lookup.get('estado'),
            lookup.get('estado cliente'),
            lookup.get('cep'),
            lookup.get('cep cliente')
        ].forEach(addValue);
    }

    return addressParts.join(', ');
}

function geocodeSearchAddress(address) {
    const query = normalizeAddressToken(address);
    if (!query) return Promise.reject(new Error('Informe um endereço para buscar.'));
    if (!ensureGoogleMapsServices()) {
        return Promise.reject(new Error(getGoogleMapsUnavailableMessage()));
    }

    return new Promise((resolve, reject) => {
        geocoder.geocode({
            address: query,
            componentRestrictions: { country: routeMapsCountry.toUpperCase() }
        }, (results, status) => {
            if (status !== 'OK' || !Array.isArray(results) || !results.length) {
                reject(new Error(getReadableGeocodeError(status)));
                return;
            }
            const location = results[0].geometry && results[0].geometry.location;
            if (!location) {
                reject(new Error('O Google retornou um local sem geometria válida. Selecione um endereço mais específico.'));
                return;
            }
            resolve({
                lat: location.lat(),
                lng: location.lng(),
                address: results[0].formatted_address || query,
            });
        });
    });
}

function confirmAddPoint() {
    if (editingStopId !== null) {
        const stop = stops.find(s => s.id === editingStopId);
        if (!stop || !currentPendingPoint) return;

        stop.lat = currentPendingPoint.lat;
        stop.lng = currentPendingPoint.lng;
        stop.coords = [currentPendingPoint.lat, currentPendingPoint.lng];
        stop.address = addressInput.value || stop.address;
        stop.name = document.getElementById('manualName').value || stop.name;
        stop.obs = document.getElementById('manualObs').value || stop.obs;

        saveStopsToStorage();
        clearPendingPreviewMarker();
        endEditLocationMode(false);
        renderStops();
        recalculateRoute();
        return;
    }

    const name = document.getElementById('manualName').value || `Cliente #${autoIncrement++}`;
    const obs = document.getElementById('manualObs').value || '';
    
    if (!currentPendingPoint) return;
    
    addStop({
        lat: currentPendingPoint.lat,
        lng: currentPendingPoint.lng,
        name: name,
        phone: '',
        email: '',
        address: addressInput.value,
        obs: obs
    });

    clearPendingPreviewMarker();
    addressInput.value = '';
    document.getElementById('confirmAdd').style.display = 'none';
    currentPendingPoint = null;
}

function beginEditLocationMode(stopId) {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return;

    const hasValidCoords = isValidRouteCoordinate(stop.lat, stop.lng);
    const searchAddress = buildStopSearchAddress(stop) || stop.address || '';

    editingStopId = stopId;
    currentPendingPoint = hasValidCoords ? { lat: Number(stop.lat), lng: Number(stop.lng) } : null;

    const confirmBox = document.getElementById('confirmAdd');
    const title = document.getElementById('editLocationTitle');
    const confirmBtn = document.getElementById('confirmAddBtn');
    const coordsInput = document.getElementById('coordsInput');

    addressInput.value = searchAddress;
    coordsInput.value = hasValidCoords ? `${stop.lat}, ${stop.lng}` : '';
    document.getElementById('manualName').value = stop.name || '';
    document.getElementById('manualObs').value = stop.obs || '';

    if (title) title.textContent = `Editar localização • ${stop.name}`;
    if (confirmBtn) confirmBtn.textContent = 'Salvar Localização';
    confirmBox.style.display = 'block';

    renderStops();
    const stopList = document.getElementById('stopList');
    if (stopList) {
        stopList.scrollTo({ top: 0, behavior: 'smooth' });
    }

    clearPendingPreviewMarker();
    if (hasValidCoords) {
        map.flyTo([Number(stop.lat), Number(stop.lng)], 16);
        return;
    }

    if (!searchAddress) {
        if (typeof showToast === 'function') {
            showToast('Informe um endereço para localizar esta parada.', 'info');
        }
        return;
    }

    geocodeSearchAddress(searchAddress)
        .then((result) => {
            if (editingStopId !== stopId) return;
            setPendingPointPreview(result.lat, result.lng, result.address || searchAddress, {
                flyTo: true,
                updateAddressInput: true,
            });
        })
        .catch((error) => {
            if (editingStopId !== stopId) return;
            if (typeof showToast === 'function') {
                showToast(error && error.message ? error.message : 'Não foi possível localizar automaticamente este endereço. Ajuste a busca manualmente.', 'info');
            }
        });
}

function endEditLocationMode(clearInputs = true) {
    editingStopId = null;
    currentPendingPoint = null;
    clearPendingPreviewMarker();

    const title = document.getElementById('editLocationTitle');
    const confirmBtn = document.getElementById('confirmAddBtn');
    const confirmBox = document.getElementById('confirmAdd');

    if (title) title.textContent = 'Adicionar novo ponto';
    if (confirmBtn) confirmBtn.textContent = 'Confirmar Adição';

    if (clearInputs) {
        addressInput.value = '';
        document.getElementById('coordsInput').value = '';
        document.getElementById('manualName').value = '';
        document.getElementById('manualObs').value = '';
        confirmBox.style.display = 'none';
    }

    renderStops();
}

if (addressInput) {
    addressInput.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        searchAddressFromInput();
    });
}

function addStop(stop) {
    const newStop = {
        id: ++autoIncrement,
        ...stop,
        coords: [stop.lat, stop.lng]
    };
    // Inserir antes do ponto final fixo (se existir)
    const fixedFinalIdx = stops.findIndex(s => s._fixedType === 'final');
    if (fixedFinalIdx !== -1) {
        stops.splice(fixedFinalIdx, 0, newStop);
    } else {
        stops.push(newStop);
    }
    ensureFixedPoints();
    saveStopsToStorage();
    renderStops();
    recalculateRoute();
    renderRouteSlotTabs();
}

function removeStop(id) {
    const removedStop = stops.find(s => s.id === id);
    // Bloquear remoção de pontos fixos
    if (removedStop && removedStop._fixedType) return;

    stops = stops.filter(s => s.id !== id);
    ensureFixedPoints();
    saveStopsToStorage();

    if (removedStop && removedStop.sourcePedidoId) {
        window.dispatchEvent(new CustomEvent('pedido-removed-from-route', {
            detail: { pedidoId: removedStop.sourcePedidoId }
        }));
    }

    renderStops();
    recalculateRoute();
    renderRouteSlotTabs();
}

function _getStopFieldValue(stop, campo) {
    // Primeiro tenta nos dados do pedido original
    const pedidoData = stop.pedidoData || {};
    if (Object.prototype.hasOwnProperty.call(pedidoData, campo)) {
        return pedidoData[campo];
    }
    const dados = pedidoData.dados_json || {};
    if (Object.prototype.hasOwnProperty.call(dados, campo)) {
        return dados[campo];
    }
    // Fallback para propriedades diretas do stop
    if (Object.prototype.hasOwnProperty.call(stop, campo)) {
        return stop[campo];
    }
    return undefined;
}

function _escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Converte string de data dd/mm/aaaa, yyyy-mm-dd ou ISO 8601 em Date (meia-noite local).
 * Retorna null se nao conseguir.
 */
function _parseDateStrJS(str) {
    if (!str) return null;
    const s = String(str).trim();
    const dmY = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (dmY) {
        let ano = parseInt(dmY[3], 10);
        if (ano < 100) ano += 2000;
        const d = new Date(ano, parseInt(dmY[2], 10) - 1, parseInt(dmY[1], 10));
        return isNaN(d.getTime()) ? null : d;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/**
 * Converte string de data/hora em Date (hora local). Cai para _parseDateStrJS se sem hora.
 */
function _parseDateTimeStrJS(str) {
    if (!str) return null;
    const s = String(str).trim();
    const dmYh = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})[T ]?(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (dmYh) {
        let ano = parseInt(dmYh[3], 10);
        if (ano < 100) ano += 2000;
        const d = new Date(ano, parseInt(dmYh[2], 10) - 1, parseInt(dmYh[1], 10),
            parseInt(dmYh[4], 10), parseInt(dmYh[5], 10), parseInt(dmYh[6] || '0', 10));
        return isNaN(d.getTime()) ? null : d;
    }
    const isoH = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (isoH) {
        const d = new Date(parseInt(isoH[1], 10), parseInt(isoH[2], 10) - 1, parseInt(isoH[3], 10),
            parseInt(isoH[4], 10), parseInt(isoH[5], 10), parseInt(isoH[6] || '0', 10));
        return isNaN(d.getTime()) ? null : d;
    }
    return _parseDateStrJS(str);
}

/** Diferenca em dias inteiros entre hoje e a data do campo (positivo = passado). */
function _diffDaysFromToday(str) {
    const d = _parseDateStrJS(str);
    if (d === null) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.floor((hoje - d) / 86400000);
}

/** Diferenca em horas (decimal) entre agora e o datetime do campo (positivo = passado). */
function _diffHoursFromNow(str) {
    const d = _parseDateTimeStrJS(str);
    if (d === null) return null;
    return (Date.now() - d.getTime()) / 3600000;
}

function _regraCorCombina(regra, stop) {
    if (!regra || !regra.campo || !stop.pedidoData) return false;
    
    const pedido = stop.pedidoData;
    const dados = pedido.dados_json || {};
    let valorCampo = pedido[regra.campo] !== undefined ? pedido[regra.campo] : dados[regra.campo];
    
    if (valorCampo === null || valorCampo === undefined) return false;
    
    const valorStr = String(valorCampo).toLowerCase().trim();
    const valorRegra = String(regra.valor || '').toLowerCase().trim();
    
    switch (regra.operador) {
        case 'igual':
            return valorStr === valorRegra;
        case 'diferente':
            return valorStr !== valorRegra;
        case 'contem':
            return valorStr.includes(valorRegra);
        case 'nao_contem':
            return !valorStr.includes(valorRegra);
        case 'comeca_com':
            return valorStr.startsWith(valorRegra);
        case 'termina_com':
            return valorStr.endsWith(valorRegra);
        case 'maior':
            return parseFloat(valorStr) > parseFloat(valorRegra);
        case 'menor':
            return parseFloat(valorStr) < parseFloat(valorRegra);
        case 'vazio':
            return valorStr === '';
        case 'nao_vazio':
            return valorStr !== '';
        case 'dias_maior': {
            const dd = _diffDaysFromToday(String(valorCampo));
            const ref = parseFloat(valorRegra);
            return dd !== null && !isNaN(ref) && dd > ref;
        }
        case 'dias_menor': {
            const dd = _diffDaysFromToday(String(valorCampo));
            const ref = parseFloat(valorRegra);
            return dd !== null && !isNaN(ref) && dd < ref;
        }
        case 'dias_igual': {
            const dd = _diffDaysFromToday(String(valorCampo));
            const ref = Math.round(parseFloat(valorRegra));
            return dd !== null && !isNaN(ref) && dd === ref;
        }
        case 'hoje': {
            const dd = _diffDaysFromToday(String(valorCampo));
            return dd !== null && dd === 0;
        }
        case 'horas_maior': {
            const dh = _diffHoursFromNow(String(valorCampo));
            const ref = parseFloat(valorRegra);
            return dh !== null && !isNaN(ref) && dh > ref;
        }
        case 'horas_menor': {
            const dh = _diffHoursFromNow(String(valorCampo));
            const ref = parseFloat(valorRegra);
            return dh !== null && !isNaN(ref) && dh < ref;
        }
        case 'dias_entre': {
            const dd = _diffDaysFromToday(String(valorCampo));
            const min = Math.round(parseFloat(valorRegra));
            const max = Math.round(parseFloat(String(regra.valor2 || '')));
            return dd !== null && !isNaN(min) && !isNaN(max) && dd >= min && dd <= max;
        }
        default:
            return false;
    }
}

function _getRegraCorAplicada(stop) {
    if (!rotasRegrasCor || !Array.isArray(rotasRegrasCor)) return null;
    
    const ativasOrdenadas = rotasRegrasCor
        .filter(rule => rule.ativo && rule.campo)
        .sort((a, b) => (a.prioridade || 9999) - (b.prioridade || 9999));
    
    return ativasOrdenadas.find(rule => _regraCorCombina(rule, stop)) || null;
}

function _renderStopFields(stop) {
    if (!rotasCamposExibicao || !rotasCamposExibicao.length) {
        // Fallback: exibir nome, endereço, obs como antes
        return `
            <b>${_escapeHtml(stop.name)}</b>
            <small class="stop-address">${_escapeHtml(stop.address)}</small>
            <div class="stop-obs-section">
                <small class="stop-obs-label">
                    <strong>Obs:</strong> <span id="obs-${stop.id}">${_escapeHtml(stop.obs || 'Sem observações')}</span>
                </small>
            </div>
        `;
    }
    
    return rotasCamposExibicao.map(cfg => {
        const campo = typeof cfg === 'string' ? cfg : (cfg.campo || '');
        const rotulo = (cfg.rotulo || campo || '').trim();
        const icone = (cfg.icone || '').trim();
        const cor = (cfg.cor || '').trim();
        const tamanho = (cfg.tamanho || '').trim();
        const posicao = (cfg.posicao || 'esquerda').trim();
        const largura = (cfg.largura || '').trim();
        const altura = (cfg.altura || '').trim();
        
        const valor = _getStopFieldValue(stop, campo);
        const texto = (valor === null || valor === undefined || String(valor).trim() === '') ? '—' : String(valor);
        
        const styleColor = cor ? `color:${cor};` : '';
        const styleSize = tamanho ? `font-size:${tamanho}px;` : '';
        const styleAlign = posicao === 'direita'
            ? 'text-align:right; justify-content:flex-end;'
            : posicao === 'centro'
                ? 'text-align:center; justify-content:center;'
                : 'text-align:left; justify-content:flex-start;';
        const styleWidth = largura ? `width:${largura}px; max-width:100%;` : '';
        const styleHeight = altura ? `min-height:${altura}px;` : '';
        const iconeStr = icone ? `${icone} ` : '';
        
        return `<div class="campo" style="display:flex; gap:6px; align-items:flex-start; ${styleColor}${styleSize}${styleAlign}${styleWidth}${styleHeight}"><strong>${iconeStr}${_escapeHtml(rotulo)}:</strong> <span>${_escapeHtml(texto)}</span></div>`;
    }).join('');
}

function renderStops() {
    const list = document.getElementById('stopList');
    const orderedStops = editingStopId !== null
        ? [...stops.filter(s => s.id === editingStopId), ...stops.filter(s => s.id !== editingStopId)]
        : stops;

    list.innerHTML = orderedStops.map((s) => {
        const isFixed = !!s._fixedType;
        const regraCor = isFixed ? null : _getRegraCorAplicada(s);

        // Ponto de partida fixo = 0; ponto final fixo = não exibe número;
        // paradas normais contam a partir de 1, descontando o ponto de partida fixo
        const hasFixedStart = stops[0]?._fixedType === 'partida';
        let displayIndex;
        if (s._fixedType === 'partida') {
            displayIndex = 0;
        } else if (s._fixedType === 'final') {
            displayIndex = null; // não exibe número
        } else {
            const rawIndex = stops.findIndex(item => item.id === s.id);
            displayIndex = hasFixedStart ? rawIndex : rawIndex + 1;
        }
        let cardStyle = '';
        if (isFixed) {
            cardStyle = s._fixedType === 'partida'
                ? 'background:#e8f5e9;border-color:#66bb6a;'
                : 'background:#e3f2fd;border-color:#42a5f5;';
        } else {
            cardStyle = [
                regraCor && regraCor.cor_fundo ? `background:${regraCor.cor_fundo};` : '',
                regraCor && regraCor.cor_borda ? `border-color:${regraCor.cor_borda};` : '',
                regraCor && regraCor.cor_texto ? `color:${regraCor.cor_texto};` : '',
                regraCor && regraCor.espessura_borda !== undefined && regraCor.espessura_borda !== '' ? `border-width:${regraCor.espessura_borda}px; border-style:solid;` : '',
            ].join('');
        }
        
        const draggable = isFixed ? '' : 'draggable="true"';
        const fixedBadge = isFixed
            ? `<span style="font-size:11px;color:#555;background:rgba(0,0,0,.08);padding:2px 6px;border-radius:10px;">🔒 Fixo</span>`
            : (editingStopId === s.id ? '<span class="stop-edit-badge">📍 Editando localização</span>' : '');

        const actionButtons = isFixed
            ? ''
            : `<button class="stop-action-btn info-btn" onclick="openRaioXFromStop(${s.id})" title="Raio X do Cliente" style="font-style:italic;font-family:Georgia,serif;font-weight:700;">i</button>
               <button class="stop-action-btn edit-btn" onclick="editStop(${s.id})" title="Editar parada">✏️</button>
               <button class="stop-action-btn location-btn" onclick="beginEditLocationMode(${s.id})" title="Editar localização">📍</button>
               <button class="stop-action-btn delete-btn" onclick="removeStop(${s.id})" title="Remover">✕</button>`;
        
        return `
        <div class="stop-item" data-id="${s.id}" ${draggable} style="${cardStyle}">
            <div class="stop-main">
                ${rotasCardConfig.mostrar_numero && displayIndex !== null ? `<div class="stop-number" style="${regraCor && regraCor.cor_texto ? `color:${regraCor.cor_texto};` : ''}">${displayIndex}</div>` : ''}
                <div class="stop-info">
                    ${isFixed ? `<b>${s.name}</b><small class="stop-address">${s.address}</small>` : _renderStopFields(s)}
                    ${fixedBadge}
                </div>
                <div class="stop-actions">${actionButtons}</div>
            </div>
        </div>
    `;
    }).join('');

    document.querySelectorAll('.stop-item').forEach(el => {
        if (Number(el.dataset.id) === editingStopId) {
            el.classList.add('editing-location');
        }
    });
    
    // Só adiciona drag para paradas não-fixas
    document.querySelectorAll('.stop-item[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragover', handleDragOver);
        el.addEventListener('drop', handleDrop);
        el.addEventListener('dragend', handleDragEnd);
    });
    // dragover/drop em fixos para bloquear (handleDrop já trata)
    document.querySelectorAll('.stop-item:not([draggable])').forEach(el => {
        el.addEventListener('dragover', handleDragOver);
        el.addEventListener('drop', handleDrop);
    });
    
    if (stops.length > 0) {
        document.getElementById('summary-card').style.display = 'flex';
    }
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const draggedStopId = parseInt(draggedElement.dataset.id);
    const targetStopId = parseInt(this.dataset.id);
    
    const draggedIdx = stops.findIndex(s => s.id === draggedStopId);
    const targetIdx = stops.findIndex(s => s.id === targetStopId);
    
    if (draggedIdx !== -1 && targetIdx !== -1 && draggedIdx !== targetIdx) {
        // Bloquear troca envolvendo pontos fixos
        if (stops[draggedIdx]._fixedType || stops[targetIdx]._fixedType) return;
        [stops[draggedIdx], stops[targetIdx]] = [stops[targetIdx], stops[draggedIdx]];
        saveStopsToStorage();
        renderStops();
        recalculateRoute();
    }
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    draggedElement = null;
}

function editObs(id) {
    const stop = stops.find(s => s.id === id);
    const newObs = prompt('Editar observação:', stop.obs);
    if (newObs !== null) {
        stop.obs = newObs;
        saveStopsToStorage();
        document.getElementById(`obs-${id}`).textContent = newObs;
    }
}

function editStop(id) {
    const stop = stops.find(s => s.id === id);
    if (!stop) return;

    const newObs = prompt('Editar observação:', stop.obs || '');
    if (newObs !== null) {
        stop.obs = newObs;
        saveStopsToStorage();
        renderStops();
    }
}

// ==========================================
// ALTERNATIVAS DE SEGMENTO
// ==========================================

function _clearSegAlt() {
    _segAltLayers.forEach(l => map.removeLayer(l));
    _segAltLayers  = [];
    _segAltStopIdx = null;
    if (_segAltPanel) { _segAltPanel.remove(); _segAltPanel = null; }
}

async function _showSegmentAlternatives(stopIdx) {
    if (stopIdx <= 0 || stopIdx >= stops.length) return;

    const prev = stops[stopIdx - 1];
    const curr = stops[stopIdx];

    _clearSegAlt();
    _segAltStopIdx = stopIdx;

    if (typeof showToast === 'function') showToast('🔀 Calculando rotas alternativas...', 'info');

    // Offset de desvio proporcional à distância do segmento
    const midLat  = (prev.lat + curr.lat) / 2;
    const midLng  = (prev.lng + curr.lng) / 2;
    const distDeg = Math.sqrt(Math.pow(curr.lat - prev.lat, 2) + Math.pow(curr.lng - prev.lng, 2));
    const offLat  = Math.max(0.003, distDeg * 0.40);
    const offLng  = offLat / Math.max(0.1, Math.cos(midLat * Math.PI / 180));

    // Helper: busca rota OSRM com waypoint via opcional
    async function fetchOsrmSeg(viaLat, viaLng) {
        const wps = viaLat != null
            ? `${prev.lng},${prev.lat};${viaLng},${viaLat};${curr.lng},${curr.lat}`
            : `${prev.lng},${prev.lat};${curr.lng},${curr.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${wps}?geometries=geojson&overview=full`;
        try {
            const ctrl  = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 12000);
            const resp  = await fetch(url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.code !== 'Ok' || !data.routes?.[0]) return null;
            return data.routes[0];
        } catch { return null; }
    }

    // 5 variantes: direta + 4 desvios cardeais
    const defs = [
        { label: 'Mais Rápida',  desc: 'Rota direta',        color: '#e53935', via: null },
        { label: 'Via Norte ↑',  desc: 'Desvio pelo norte',  color: '#f97316', via: [midLat + offLat, midLng        ] },
        { label: 'Via Sul ↓',    desc: 'Desvio pelo sul',    color: '#22c55e', via: [midLat - offLat, midLng        ] },
        { label: 'Via Leste →',  desc: 'Desvio pelo leste',  color: '#a855f7', via: [midLat,          midLng + offLng] },
        { label: 'Via Oeste ←',  desc: 'Desvio pelo oeste',  color: '#ef4444', via: [midLat,          midLng - offLng] },
    ];

    const fetched = await Promise.allSettled(
        defs.map(d => d.via ? fetchOsrmSeg(d.via[0], d.via[1]) : fetchOsrmSeg(null, null))
    );

    // Deduplica rotas geometricamente iguais
    const seen = new Set();
    const variants = [];
    defs.forEach((def, i) => {
        const route = fetched[i].status === 'fulfilled' ? fetched[i].value : null;
        if (!route) return;
        const key = route.geometry.coordinates
            .slice(0, 5).map(c => c.map(v => v.toFixed(3)).join(',')).join('|');
        if (seen.has(key)) return;
        seen.add(key);
        variants.push({ ...def, route });
    });

    if (!variants.length) {
        if (typeof showToast === 'function') showToast('Nenhuma alternativa encontrada.', 'warning');
        return;
    }

    // Desenhar polylines
    variants.forEach((v, i) => {
        const latlngs = v.route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const poly = L.polyline(latlngs, {
            color    : v.color,
            weight   : i === 0 ? 7 : 5,
            opacity  : i === 0 ? 0.95 : 0.65,
            dashArray: i === 0 ? null : '10,6'
        }).addTo(map);
        poly.on('mouseover', () => poly.setStyle({ opacity: 1, weight: 8 }));
        poly.on('mouseout',  () => poly.setStyle({ opacity: i===0?0.95:0.65, weight: i===0?7:5 }));
        poly.on('click',     () => _applySegmentVariant(i, variants));
        _segAltLayers.push(poly);
    });

    map.fitBounds(_segAltLayers[0].getBounds(), { padding: [60, 60] });

    _segAltPanel = document.createElement('div');
    _segAltPanel.id = 'seg-alt-panel';
    _segAltPanel._variants = variants;

    const prevName = prev.name || `Ponto ${stopIdx - 1}`;
    const currName = curr.name || `Ponto ${stopIdx}`;

    let html = `
        <div class="seg-alt-title">
            <span class="seg-alt-from">${prevName}</span>
            <span class="seg-alt-arrow">→</span>
            <span class="seg-alt-to">${currName}</span>
        </div>
        <p class="seg-alt-subtitle">Escolha o melhor percurso para este trecho</p>
        <div class="seg-alt-list">
            <button class="seg-alt-item seg-alt-item--default"
                    onclick="_keepDefaultRoute()"
                    onmouseover="_highlightSegAlt(-2)" onmouseout="_highlightSegAlt(-1)">
                <span class="seg-alt-dot" style="background:#4285F4"></span>
                <span class="seg-alt-label" style="color:#4285F4">Padrão</span>
                <span class="seg-alt-desc">Rota atual (manter)</span>
                <span class="seg-alt-info">—</span>
            </button>`;

    variants.forEach((v, i) => {
        const dist = (v.route.distance / 1000).toFixed(1);
        const time = Math.round(v.route.duration / 60);
        html += `
            <button class="seg-alt-item${i===0?' seg-alt-item--best':''}" style="border-left-color:${v.color}"
                    onclick="_applySegmentVariant(${i}, _segAltPanel._variants)"
                    onmouseover="_highlightSegAlt(${i})" onmouseout="_highlightSegAlt(-1)">
                <span class="seg-alt-dot" style="background:${v.color}"></span>
                <span class="seg-alt-label" style="color:${v.color}">${v.label}</span>
                <span class="seg-alt-desc">${v.desc}</span>
                <span class="seg-alt-info">${dist} km · ${time} min</span>
            </button>`;
    });

    html += `</div><button class="seg-alt-cancel" onclick="_cancelSegAlt()">&#x2715; Cancelar (manter padrão)</button>`;
    _segAltPanel.innerHTML = html;
    document.body.appendChild(_segAltPanel);
}

window._highlightSegAlt = function(idx) {
    _segAltLayers.forEach((poly, i) => {
        if (idx === -1) {
            poly.setStyle({ opacity: i===0?0.95:0.65, weight: i===0?7:5 });
        } else if (idx === -2) {
            poly.setStyle({ opacity: 0.15, weight: 4 });
        } else {
            poly.setStyle({ opacity: i===idx ? 1 : 0.15, weight: i===idx ? 8 : 4 });
        }
    });
};

window._applySegmentVariant = function(idx, variants) {
    const v = variants && variants[idx];
    if (!v || _segAltStopIdx === null) return;
    if (!v.via) {
        _clearSegAlt();
        recalculateRoute();
        if (typeof showToast === 'function') showToast(`✅ ${v.label} aplicada`, 'success');
        return;
    }
    const via = {
        id     : ++autoIncrement,
        name   : `📍 Via (${v.label})`,
        address: `${v.via[0].toFixed(5)}, ${v.via[1].toFixed(5)}`,
        lat    : v.via[0], lng: v.via[1],
        coords : [v.via[0], v.via[1]],
        obs: '', _isVia: true
    };
    stops.splice(_segAltStopIdx, 0, via);
    saveStopsToStorage();
    renderStops();
    _clearSegAlt();
    recalculateRoute();
    if (typeof showToast === 'function') showToast(`✅ ${v.label} aplicada`, 'success');
};

// Retrocompatibilidade com chamadas antigas
window._applySegmentRoute = function(idx, routes) {
    if (!routes || _segAltStopIdx === null) return;
    const route = routes[idx];
    if (!route) return;
    const coords = route.geometry.coordinates;
    const mid    = coords[Math.floor(coords.length / 2)];
    const via = {
        id: ++autoIncrement, name: `📍 Via (percurso ${idx + 1})`,
        address: `${mid[1].toFixed(5)}, ${mid[0].toFixed(5)}`,
        lat: mid[1], lng: mid[0], coords: [mid[1], mid[0]], obs: '', _isVia: true
    };
    stops.splice(_segAltStopIdx, 0, via);
    saveStopsToStorage(); renderStops(); _clearSegAlt(); recalculateRoute();
    if (typeof showToast === 'function') showToast(`✅ Percurso ${idx + 1} aplicado`, 'success');
};

window._keepDefaultRoute = function() {
    _clearSegAlt();
    if (typeof showToast === 'function') showToast('✅ Rota padrão mantida', 'success');
};

window._cancelSegAlt = function() {
    _clearSegAlt();
};

window._showSegmentAlternatives = _showSegmentAlternatives;

// ==========================================
// RECALCULATE ROUTE
// ==========================================

function recalculateRoute() {
    _clearSegAlt();

    map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Marker)) {
            map.removeLayer(layer);
        }
        if (layer instanceof L.Marker && !(layer._icon && layer._icon.className.includes('leaflet-marker'))) {
            map.removeLayer(layer);
        }
    });

    if (control) { map.removeControl(control); control = null; }

    if (stops.length === 1 && stops[0].coords) {
        const stop = stops[0];
        const hasFixedStart = stop._fixedType === 'partida';
        const markerNum = hasFixedStart ? '0' : '1';
        const iconHtml = `<div class="num-icon">${markerNum}</div>`;
        const icon = L.divIcon({ html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 32], className: 'custom-number-icon' });
        L.marker(L.latLng(stop.coords[0], stop.coords[1]), { icon, title: stop.name })
            .bindPopup(`<b>${stop.name}</b>`)
            .addTo(map);
        map.setView(L.latLng(stop.coords[0], stop.coords[1]), 14);
        return;
    }

    if (stops.length < 2) return;

    const waypoints = stops.map(s => L.latLng(s.coords[0], s.coords[1]));

    control = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        lineOptions: {
            styles: [{color: '#4285F4', opacity: 0.85, weight: 6}]
        },
        createMarker: (i, wp) => {
            const stop = stops[i];
            if (!stop) return null;
            const hasFixedStart = stops[0]?._fixedType === 'partida';
            let markerNum;
            if      (stop._fixedType === 'partida') markerNum = '0';
            else if (stop._fixedType === 'final')   markerNum = '🏁';
            else if (stop._isVia)                   markerNum = '⇅';
            else    markerNum = hasFixedStart ? i : i + 1;

            // Pode abrir alternativas: qualquer ponto com predecessor,
            // exceto pontos de partida e pontos via. Inclui ponto final fixo.
            const canAlt = !stop._isVia && i > 0 && stop._fixedType !== 'partida';

            const iconHtml = canAlt
                ? `<div class="num-icon num-icon--altable" title="Clique para ver rotas alternativas até aqui">${markerNum}</div>`
                : `<div class="num-icon${stop._isVia?' num-icon--via':''}">${markerNum}</div>`;

            const icon = L.divIcon({
                html: iconHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                className: 'custom-number-icon'
            });

            const popupContent = (stop._fixedType === 'partida')
                ? `<b>${stop.name}</b>`
                : `<b>${stop.name}</b><br><small style="color:#64748b">${stop.address}</small>`
                  + (canAlt
                    ? `<br><button class="popup-alt-btn" onclick="_showSegmentAlternatives(${i}); this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button').click()">🔀 Ver rotas alternativas até aqui</button>`
                    : '');

            return L.marker(wp.latLng, { icon, title: stop.name })
                .bindPopup(popupContent, { maxWidth: 240 });
        }
    }).addTo(map);

    control.on('routesfound', function(e) {
        const route = e.routes[0];
        const dist = (route.summary.totalDistance / 1000).toFixed(2);
        const time = Math.round(route.summary.totalTime / 60);
        document.getElementById('total-dist').textContent = dist + ' km';
        document.getElementById('total-time').textContent = time + ' min';
        if (typeof saveRouteToAPI === 'function') saveRouteToAPI(dist, time);
    });
}

async function optimizeRouteWithReturn() {
    if (stops.length < 3) {
        alert('Adicione pelo menos 3 paradas para otimizar');
        return;
    }

    const loadingEl = document.getElementById('loading');
    loadingEl.style.display = 'block';

    const motor = window.FERMAP_MOTOR || 'local';
    _clearAllComparisons(); // limpa comparativo anterior

    // Separar pontos fixos e trabalhar só com as paradas internas
    const innerStops = stops.filter(s => !s._fixedType);
    if (innerStops.length >= 2) {

        // Buscar matriz de durações reais via OSRM
        if (typeof showToast === 'function') showToast('🗺️ Calculando rotas reais...', 'info');
        const matrix = await _fetchOsrmMatrix(innerStops);

        // Snapshot imutável para usar no motor secundário depois
        const innerSnap = innerStops.map(s => ({...s}));

        if (matrix) {
            // Mapear id do stop → índice na matrix
            const idxMap = new Map(innerStops.map((s, i) => [s.id, i]));
            _gDistFn = (a, b) => {
                const ia = idxMap.get(a.id), ib = idxMap.get(b.id);
                if (ia != null && ib != null && matrix[ia] && matrix[ia][ib] != null)
                    return matrix[ia][ib];
                return distance(a.coords, b.coords);
            };
        } else {
            _gDistFn = null;
            if (typeof showToast === 'function') showToast('⚠️ OSRM indisponível, usando distância direta', 'warning');
        }

        stops = innerStops; // temporariamente sem fixos

        if (motor === 'vroom') {
            // MOTOR PRIMÁRIO = Vroom
            if (typeof showToast === 'function') showToast('⚡ Otimizando com Vroom...', 'info');
            const vroomResult = await _callVroomScoped(innerSnap);
            if (vroomResult && vroomResult.length > 0) {
                stops.length = 0;
                vroomResult.forEach(s => stops.push(s));
            } else {
                if (typeof showToast === 'function') showToast('⚠️ Vroom indisponível, usando Local B&B', 'warning');
                _runLocalBnBInPlace(stops);
            }
        } else {
            // MOTOR PRIMÁRIO = Local B&B (lógica original)
            const bairroEnabled = localStorage.getItem('fermap_otimiz_bairro_enabled') === '1';
            let bairroCampos = [];
            try { bairroCampos = JSON.parse(localStorage.getItem('fermap_otimiz_bairro_campo') || '[]'); } catch(e) {}
            if (!Array.isArray(bairroCampos)) bairroCampos = bairroCampos ? [String(bairroCampos)] : [];

            if (bairroEnabled && bairroCampos.length) {
                _optimizeComBairro(bairroCampos);
            } else {
                _runLocalBnBInPlace(stops);
            }
        }

        _gDistFn = null; // sempre resetar após uso

        // Lançar motor secundário de forma não-bloqueante (linha laranja)
        const _snap = innerSnap, _mat = matrix, _mot = motor;
        setTimeout(() => _launchAllComparisons(_snap, _mat, _mot), 300);
    }

    ensureFixedPoints();
    loadingEl.style.display = 'none';
    saveStopsToStorage();
    renderStops();
    recalculateRoute();
    if (typeof showToast === 'function') {
        showToast('✨ Rota otimizada!', 'success');
    } else {
        alert('✨ Rota otimizada!');
    }
}

/**
 * Busca matriz de durações reais (segundos) entre todos os stops via OSRM /table.
 * OSRM exige coordenadas no formato: lng,lat (longitude primeiro!)
 * Retorna matrix[i][j] = segundos de i → j, ou null se falhar/timeout.
 */
async function _fetchOsrmMatrix(stopsArr) {
    if (!stopsArr || stopsArr.length < 2 || stopsArr.length > 100) return null;
    try {
        const coords = stopsArr.map(s => `${s.lng},${s.lat}`).join(';');
        const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.code !== 'Ok' || !Array.isArray(data.durations)) return null;
        return data.durations;
    } catch (e) {
        console.warn('OSRM /table falhou:', e.message);
        return null;
    }
}

// ==========================================
// ROTA SECUNDÁRIA — motor alternativo
// ==========================================

/**
 * B&B / heurística local aplicada in-place no array `arr`.
 * Extrai a lógica original para ser reutilizável no motor primário e secundário.
 */
function _runLocalBnBInPlace(arr) {
    if (arr.length <= 12) {
        const optimal = _exactOptimal(arr);
        arr.length = 0;
        optimal.forEach(s => arr.push(s));
    } else {
        const ordered = _nearestNeighbor([arr[0], ...arr.slice(1)]);
        arr.length = 0;
        ordered.forEach(s => arr.push(s));
        _optimize2opt(arr);
        _orOpt(arr);
        _optimize2opt(arr);
    }
}

/**
 * Otimiza uma CÓPIA de innerClone usando Local B&B e retorna o resultado.
 * Usa a matrix de distâncias passada sem modificar o estado global _gDistFn permanentemente.
 */
function _applyLocalOptimScoped(innerClone, matrix) {
    if (!innerClone || innerClone.length < 2) return [...(innerClone || [])];
    const prevDistFn = _gDistFn;
    if (matrix) {
        const idxMap = new Map(innerClone.map((s, i) => [s.id, i]));
        _gDistFn = (a, b) => {
            const ia = idxMap.get(a.id), ib = idxMap.get(b.id);
            if (ia != null && ib != null && matrix[ia] && matrix[ia][ib] != null)
                return matrix[ia][ib];
            return distance(a.coords, b.coords);
        };
    }
    const arr = [...innerClone];
    let result;
    if (arr.length <= 12) {
        result = _exactOptimal(arr);
    } else {
        const ordered = _nearestNeighbor([arr[0], ...arr.slice(1)]);
        _optimize2opt(ordered);
        _orOpt(ordered);
        _optimize2opt(ordered);
        result = ordered;
    }
    _gDistFn = prevDistFn;
    return result;
}

/**
 * Chama o solver Vroom (solver.vroom-project.org) e retorna innerClone reordenado ou null.
 */
async function _callVroomScoped(innerClone) {
    if (!innerClone || innerClone.length < 2) return null;
    const jobs = innerClone.map((s, i) => ({ id: i, location: [s.lng, s.lat] }));
    const vehicle = { id: 1 };
    const partidaF = stops.find(s => s._fixedType === 'partida');
    const finalF   = stops.find(s => s._fixedType === 'final');
    if (partidaF) vehicle.start = [partidaF.lng, partidaF.lat];
    if (finalF)   vehicle.end   = [finalF.lng,   finalF.lat];
    const payload = { jobs, vehicles: [vehicle] };
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch('https://solver.vroom-project.org/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!resp.ok) { console.warn('Vroom HTTP', resp.status); return null; }
        const data = await resp.json();
        if (!data.routes || !data.routes[0]) return null;
        const steps = data.routes[0].steps.filter(s => s.type === 'job');
        return steps.map(s => innerClone[s.id]);
    } catch (e) {
        console.warn('Vroom falhou:', e.message);
        return null;
    }
}

/** Busca geometria OSRM completa para uma sequência de stops ordenada. */
async function _fetchOsrmRoute(orderedStops) {
    if (!orderedStops || orderedStops.length < 2) return null;
    try {
        const coords = orderedStops.map(s => `${s.lng},${s.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return null;
        return data.routes[0].geometry.coordinates;
    } catch (e) {
        console.warn('OSRM route (secundária) falhou:', e.message);
        return null;
    }
}

// ==========================================
// ALGORITMOS ADICIONAIS DE OTIMIZAÇÃO TSP
// ==========================================

/**
 * Clarke-Wright Savings (inspirado em Dijkstra):
 * Calcula a "economia" de combinar dois stops numa rota vs ir via depósito.
 * Ordena pares por saving decrescente e monta a rota.
 */
function _dijkstraSavings(arr, matrixOrNull) {
    if (!arr || arr.length <= 2) return arr ? [...arr] : [];
    const n   = arr.length;
    const dep = arr[0]; // depósito virtual = primeiro stop
    // Custo entre dois stops (usa matrix se disponível)
    const prevFn = _gDistFn;
    if (matrixOrNull) {
        const idxMap = new Map(arr.map((s, i) => [s.id, i]));
        _gDistFn = (a, b) => {
            const ia = idxMap.get(a.id), ib = idxMap.get(b.id);
            if (ia != null && ib != null && matrixOrNull[ia] && matrixOrNull[ia][ib] != null)
                return matrixOrNull[ia][ib];
            return distance(a.coords, b.coords);
        };
    }
    const d = (a, b) => _dist(a, b);
    // Calcula savings S(i,j) = d(dep,i) + d(dep,j) - d(i,j)
    const savings = [];
    for (let i = 1; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            savings.push({ i, j, s: d(dep, arr[i]) + d(dep, arr[j]) - d(arr[i], arr[j]) });
        }
    }
    savings.sort((a, b) => b.s - a.s);
    // Constrói rota unindo arestas de maior saving (sem criar ciclos prematuros)
    const inRoute = new Array(n).fill(false);
    const next    = new Array(n).fill(-1);
    const prev    = new Array(n).fill(-1);
    const degree  = new Array(n).fill(0);
    let edgeCount  = 0;
    for (const { i, j } of savings) {
        if (edgeCount >= n - 2) break;
        if (degree[i] >= 2 || degree[j] >= 2) continue;
        // Verificar se cria ciclo prematuro
        if (edgeCount < n - 2) {
            // simple path check
            let cur = i, steps = 0;
            while (next[cur] !== -1 && steps < n) { cur = next[cur]; steps++; }
            if (cur === j) continue; // seria um ciclo
        }
        next[i] = j; prev[j] = i; degree[i]++; degree[j]++;
        edgeCount++;
    }
    // Reconstruir rota a partir das arestas
    const visited = new Set();
    const result  = [arr[0]];
    visited.add(0);
    // Nós com grau 0 ou 1 que não aparecem na cadeia → inserir por proximidade
    const chain = [];
    for (let k = 1; k < n; k++) {
        if (prev[k] === -1) { // início de uma cadeia
            let cur = k;
            while (cur !== -1 && !visited.has(cur)) {
                chain.push(cur); visited.add(cur); cur = next[cur];
            }
        }
    }
    // Qualquer stop não visitado (grau 0)
    for (let k = 1; k < n; k++) {
        if (!visited.has(k)) chain.push(k);
    }
    chain.forEach(k => result.push(arr[k]));
    _gDistFn = prevFn;
    return result;
}

/**
 * A* com heurística MST (Prim):
 * Em cada passo, escolhe o próximo stop que minimiza dist_atual + lb_MST(restantes).
 * Fornece ordens melhores que NN puro quando o grafo tem estruturas de cluster.
 */
function _aStarMST(arr, matrixOrNull) {
    if (!arr || arr.length <= 2) return arr ? [...arr] : [];
    const prevFn = _gDistFn;
    if (matrixOrNull) {
        const idxMap = new Map(arr.map((s, i) => [s.id, i]));
        _gDistFn = (a, b) => {
            const ia = idxMap.get(a.id), ib = idxMap.get(b.id);
            if (ia != null && ib != null && matrixOrNull[ia] && matrixOrNull[ia][ib] != null)
                return matrixOrNull[ia][ib];
            return distance(a.coords, b.coords);
        };
    }
    // Custo MST de Prim sobre um subconjunto de índices
    function mstCost(subset) {
        if (subset.length <= 1) return 0;
        const inMST = new Set([subset[0]]);
        let cost = 0;
        while (inMST.size < subset.length) {
            let best = Infinity;
            for (const u of inMST) {
                for (const v of subset) {
                    if (!inMST.has(v)) {
                        const d = _dist(arr[u], arr[v]);
                        if (d < best) best = d;
                    }
                }
            }
            // Encontrar qual nó deu esse custo e adicioná-lo (simplificado)
            let addV = -1;
            for (const u of inMST) {
                for (const v of subset) {
                    if (!inMST.has(v) && _dist(arr[u], arr[v]) === best) { addV = v; break; }
                }
                if (addV !== -1) break;
            }
            if (addV === -1) break;
            inMST.add(addV); cost += best;
        }
        return cost;
    }
    const n       = arr.length;
    const result  = [arr[0]];
    const visited = new Set([0]);
    let curIdx    = 0;
    while (visited.size < n) {
        const remaining = [];
        for (let k = 0; k < n; k++) if (!visited.has(k)) remaining.push(k);
        let bestScore = Infinity;
        let bestK     = remaining[0];
        for (const k of remaining) {
            const gCost = _dist(arr[curIdx], arr[k]);
            // h = MST dos que sobrariam após visitar k
            const afterK = remaining.filter(x => x !== k);
            const hCost  = afterK.length > 0 ? mstCost(afterK) : 0;
            const score  = gCost + hCost;
            if (score < bestScore) { bestScore = score; bestK = k; }
        }
        result.push(arr[bestK]);
        visited.add(bestK);
        curIdx = bestK;
    }
    _gDistFn = prevFn;
    return result;
}

/**
 * Yen's K-Paths (adaptado para TSP):
 * Gera k variantes sistemáticas da melhor solução base aplicando
 * Or-3-opt direcionado com perturbações de arestas selecionadas.
 * Retorna a variante de menor custo total.
 */
function _yenVariant(arr, matrixOrNull) {
    if (!arr || arr.length <= 3) return arr ? [...arr] : [];
    const prevFn = _gDistFn;
    if (matrixOrNull) {
        const idxMap = new Map(arr.map((s, i) => [s.id, i]));
        _gDistFn = (a, b) => {
            const ia = idxMap.get(a.id), ib = idxMap.get(b.id);
            if (ia != null && ib != null && matrixOrNull[ia] && matrixOrNull[ia][ib] != null)
                return matrixOrNull[ia][ib];
            return distance(a.coords, b.coords);
        };
    }
    const routeCost = (r) => {
        let c = 0;
        for (let i = 0; i < r.length - 1; i++) c += _dist(r[i], r[i+1]);
        return c;
    };
    // Base = NN
    const base = _nearestNeighbor([...arr]);
    const K    = 6; // número de variantes
    const candidates = [base];
    // Gerar variantes por inversão de sub-segmentos (Or-3 sistemático)
    for (let k = 1; k <= K; k++) {
        const v = [...base];
        // Seleciona 3 arestas em posições diferentes baseado em k
        const step  = Math.max(1, Math.floor(v.length / (k + 1)));
        const i = (k * step) % (v.length - 3) || 1;
        const j = Math.min(i + step, v.length - 1);
        // Inverte o segmento entre i e j
        const seg = v.slice(i, j + 1).reverse();
        v.splice(i, seg.length, ...seg);
        // Aplica 2-opt rápido na variante
        let improved = true;
        for (let iter = 0; iter < 5 && improved; iter++) {
            improved = false;
            for (let a = 1; a < v.length - 2; a++) {
                for (let b = a + 1; b < v.length - 1; b++) {
                    const before = _dist(v[a-1], v[a]) + _dist(v[b], v[b+1] || v[b]);
                    const after  = _dist(v[a-1], v[b]) + _dist(v[a], v[b+1] || v[a]);
                    if (after < before - 1e-9) {
                        v.splice(a, b - a + 1, ...v.slice(a, b + 1).reverse());
                        improved = true;
                    }
                }
            }
        }
        candidates.push(v);
    }
    // Retorna a de menor custo
    let best = candidates[0], bestC = routeCost(candidates[0]);
    for (const c of candidates) {
        const cc = routeCost(c);
        if (cc < bestC) { bestC = cc; best = c; }
    }
    _gDistFn = prevFn;
    return best;
}

// ==========================================
// SISTEMA DE COMPARATIVO MULTI-ROTA
// ==========================================

/** Busca geometria + distância/tempo OSRM para uma sequência ordenada de stops. */
async function _fetchOsrmRouteWithMeta(orderedStops) {
    if (!orderedStops || orderedStops.length < 2) return null;
    try {
        const coords = orderedStops.map(s => `${s.lng},${s.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return null;
        const r = data.routes[0];
        return {
            coords : r.geometry.coordinates,
            distKm : +(r.distance / 1000).toFixed(1),
            timeMin: Math.round(r.duration / 60)
        };
    } catch (e) {
        console.warn('OSRM route+meta falhou:', e.message);
        return null;
    }
}

/** Remove todas as polylines de comparativo e o painel. */
function _clearAllComparisons() {
    _clearCompPreview();
    _compRoutesData.forEach(r => { if (r.layer) map.removeLayer(r.layer); });
    _compRoutesData = [];
    if (_compLegendEl) { _compLegendEl.remove(); _compLegendEl = null; }
    // aliases retrocompatíveis
    _secRouteLayer  = null;
    _secRouteLegend = null;
}
// manter nome antigo como alias
function _clearSecondaryRoute() { _clearAllComparisons(); }
window._clearSecondaryRoute    = _clearSecondaryRoute;
window._clearAllComparisons    = _clearAllComparisons;

/** Remove os marcadores de preview de numeração do mapa. */
function _clearCompPreview() {
    _compPreviewMarkers.forEach(m => map.removeLayer(m));
    _compPreviewMarkers = [];
    _compPreviewIdx     = null;
}
window._clearCompPreview = _clearCompPreview;

/**
 * Coloca marcadores numerados coloridos no mapa mostrando a sequência
 * de visita da rota alternativa `idx`.
 */
function _showCompPreview(idx) {
    _clearCompPreview();
    const r = _compRoutesData[idx];
    if (!r || !r.orderedInner || !r.orderedInner.length) return;

    const partidaF = stops.find(s => s._fixedType === 'partida');
    const finalF   = stops.find(s => s._fixedType === 'final');
    const full = [];
    if (partidaF) full.push(partidaF);
    r.orderedInner.forEach(s => full.push(s));
    if (finalF)   full.push(finalF);

    full.forEach((stop, i) => {
        let label;
        if      (stop._fixedType === 'partida') label = '0';
        else if (stop._fixedType === 'final')   label = '🏁';
        else    label = String(partidaF ? i : i + 1);

        const icon = L.divIcon({
            html: `<div class="num-icon num-icon--preview" style="background:${r.color};border-color:${r.color}">${label}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            className: 'custom-number-icon'
        });
        const mk = L.marker([stop.coords[0], stop.coords[1]], { icon, zIndexOffset: 900, interactive: false });
        mk.addTo(map);
        _compPreviewMarkers.push(mk);
    });
    _compPreviewIdx = idx;
}
window._showCompPreview = _showCompPreview;

/** Alterna visibilidade + preview de numeração da rota de comparativo. */
window._toggleCompRoute = function(idx) {
    const r = _compRoutesData[idx];
    if (!r || !r.layer) return;

    // Se outra rota está em preview, limpa e remove destaque do botão dela
    if (_compPreviewIdx !== null && _compPreviewIdx !== idx) {
        _clearCompPreview();
        const otherBtn = document.querySelector(`[data-comp-idx="${_compPreviewIdx}"]`);
        if (otherBtn) otherBtn.classList.remove('comp-toggle--active');
    }

    r.visible = !r.visible;
    r.layer.setStyle({ opacity: r.visible ? 0.82 : 0 });
    const btn = document.querySelector(`[data-comp-idx="${idx}"]`);
    if (btn) btn.classList.toggle('comp-toggle--hidden', !r.visible);

    if (r.visible) {
        _showCompPreview(idx);
        if (btn) btn.classList.add('comp-toggle--active');
    } else {
        _clearCompPreview();
        if (btn) btn.classList.remove('comp-toggle--active');
    }
};

/** Aplica uma rota alternativa do comparativo como rota principal. */
window._selectCompRoute = function(compIdx) {
    const r = _compRoutesData[compIdx];
    if (!r || !r.orderedInner || !r.orderedInner.length) return;
    // Mapear id → stop atual para evitar dados stale do snapshot
    const innerById = new Map(stops.filter(s => !s._fixedType).map(s => [s.id, s]));
    const reordered = r.orderedInner.map(s => innerById.get(s.id) || s);
    // Substituir stops internos pela nova ordem (sem fixos — ensureFixedPoints re-adiciona)
    stops.length = 0;
    reordered.forEach(s => stops.push(s));
    ensureFixedPoints();
    saveStopsToStorage();
    renderStops();
    recalculateRoute();
    _clearAllComparisons();
    if (typeof showToast === 'function')
        showToast(`✅ Rota "${r.label}" aplicada!`, 'success');
};

/** Constrói ou reconstrói o painel de legenda com todas as rotas. */
function _buildCompLegend(entriesMeta) {
    if (_compLegendEl) { _compLegendEl.remove(); _compLegendEl = null; }
    const el = document.createElement('div');
    el.id = 'comp-legend';
    let rows = '';
    entriesMeta.forEach((e, idx) => {
        const dotStyle = e.isPrimary
            ? `background:${e.color};width:14px;height:14px;border-radius:50%;flex-shrink:0;display:inline-block`
            : `background:none;border:2px dashed ${e.color};width:12px;height:12px;border-radius:50%;flex-shrink:0;display:inline-block`;
        const badge = e.isPrimary ? '<span class="comp-primary-badge">selecionado</span>' : '';
        let metaText;
        if (e.failed) {
            metaText = '<span style="color:#ef4444">indisponível</span>';
        } else if (e.distKm != null) {
            metaText = e.distKm + ' km · ' + e.timeMin + ' min';
        } else {
            metaText = 'calculando...';
        }
        let actionBtns = '';
        if (!e.isPrimary) {
            if (e.failed) {
                // sem botões
            } else if (e.compIdx != null) {
                actionBtns = `<button class="comp-toggle" data-comp-idx="${e.compIdx}" onclick="_toggleCompRoute(${e.compIdx})" title="Mostrar/Ocultar">👁</button>`
                           + `<button class="comp-select" onclick="_selectCompRoute(${e.compIdx})" title="Usar esta rota">✓ Usar</button>`;
            } else {
                actionBtns = `<button class="comp-toggle" disabled style="opacity:0.35" title="Calculando...">👁</button>`;
            }
        }
        rows += `
        <div class="comp-row" data-comp-row="${idx}">
            <span style="${dotStyle}"></span>
            <div class="comp-row-info">
                <span class="comp-row-label">${e.label}${badge}</span>
                <span class="comp-row-meta">${metaText}</span>
            </div>
            ${actionBtns}
        </div>`;
    });
    el.innerHTML = `
        <div class="comp-legend-header">
            <span class="comp-legend-title">⚖️ Comparativo de Rotas</span>
            <button class="comp-legend-close" onclick="_clearAllComparisons()" title="Fechar">✕</button>
        </div>
        <div class="comp-legend-body">${rows}</div>
    `;
    document.body.appendChild(el);
    _compLegendEl   = el;
    _secRouteLegend = el; // alias
}

/** Busca matriz de distâncias (metros) entre stops via OSRM /table. */
async function _fetchOsrmMatrixDist(stopsArr) {
    if (!stopsArr || stopsArr.length < 2 || stopsArr.length > 100) return null;
    try {
        const coords = stopsArr.map(s => `${s.lng},${s.lat}`).join(';');
        const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.code !== 'Ok' || !Array.isArray(data.distances)) return null;
        return data.distances;
    } catch (e) {
        console.warn('OSRM /table (dist) falhou:', e.message);
        return null;
    }
}

/**
 * Combina matrizes de duração e distância numa matriz normalizada 50/50.
 * Gera uma rota "equilibrada" que não prioriza só tempo nem só quilômetros.
 */
function _buildWeightedMatrix(durMatrix, distMatrix) {
    if (!durMatrix || !distMatrix || distMatrix.length !== durMatrix.length) return durMatrix || null;
    const n = durMatrix.length;
    let maxDur = 1, maxDist = 1;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {
                maxDur  = Math.max(maxDur,  durMatrix[i][j]  || 0);
                maxDist = Math.max(maxDist, distMatrix[i][j] || 0);
            }
        }
    }
    return durMatrix.map((row, i) =>
        row.map((val, j) => {
            if (i === j) return 0;
            const nd = (durMatrix[i][j]  || 0) / maxDur;
            const nk = (distMatrix[i][j] || 0) / maxDist;
            return (nd + nk) / 2;
        })
    );
}

/**
 * Ordenação por região geográfica: divide os stops pela longitude mediana
 * em dois grupos (oeste/leste) e visita cada grupo em sequência.
 * Produz rotas visualmente diferentes das otimizações TSP clássicas.
 */
/**
 * Varredura angular (Sweep): ordena os stops pelo ângulo polar em relação
 * ao centróide. clockwise=true → horário; false → anti-horário.
 * Garante sequncia geometricamente diferente de qualquer TSP clássico.
 */
function _circularSort(arr, clockwise) {
    if (!arr || arr.length <= 2) return arr ? [...arr] : [];
    const depot = arr[0];
    const rest  = arr.slice(1);
    if (!rest.length) return [depot];
    const cx = arr.reduce((s, p) => s + p.lng, 0) / arr.length;
    const cy = arr.reduce((s, p) => s + p.lat, 0) / arr.length;
    const withAngle = rest.map(s => ({
        stop : s,
        angle: Math.atan2(s.lat - cy, s.lng - cx)
    }));
    withAngle.sort((a, b) => clockwise ? b.angle - a.angle : a.angle - b.angle);
    return [depot, ...withAngle.map(x => x.stop)];
}

/**
 * NN começando pelo ponto mais distante do depot.
 * Explora as extremidades da área antes do centro.
 */
function _nnFromFarthest(arr, matrixOrNull) {
    if (!arr || arr.length <= 2) return arr ? [...arr] : [];
    const prevFn = _gDistFn;
    if (matrixOrNull) {
        const idxMap = new Map(arr.map((s, i) => [s.id, i]));
        _gDistFn = (a, b) => {
            const ia = idxMap.get(a.id), ib = idxMap.get(b.id);
            if (ia != null && ib != null && matrixOrNull[ia] && matrixOrNull[ia][ib] != null)
                return matrixOrNull[ia][ib];
            return distance(a.coords, b.coords);
        };
    }
    const depot = arr[0];
    let farthestIdx = 1, maxD = -Infinity;
    for (let i = 1; i < arr.length; i++) {
        const d = _dist(depot, arr[i]);
        if (d > maxD) { maxD = d; farthestIdx = i; }
    }
    // Reordena colocando o mais distante como ponto de partida do NN
    const reordered = [arr[farthestIdx], ...arr.filter((_, i) => i !== 0 && i !== farthestIdx), depot];
    const nn = _nearestNeighbor(reordered);
    _optimize2opt(nn);
    // Reposiciona depot no início
    const depotPos = nn.findIndex(s => s.id === depot.id);
    const result = depotPos > 0 ? [...nn.slice(depotPos), ...nn.slice(0, depotPos)] : nn;
    _gDistFn = prevFn;
    return result;
}

/**
 * Calcula 4 rotas com objetivos distintos: menor distância (km), menor tempo,
 * por região geográfica e rota equilibrada (km + tempo combinados).
 */
async function _launchAllComparisons(innerSnap, matrix, primaryMotor) {
    if (!innerSnap || innerSnap.length < 2) return;

    const partidaF = stops.find(s => s._fixedType === 'partida');
    const finalF   = stops.find(s => s._fixedType === 'final');

    const COMP_PALETTE = ['#f97316', '#22c55e', '#a855f7', '#ef4444'];
    const primLabel    = primaryMotor === 'vroom' ? 'Vroom' : 'Local B&B';

    if (typeof showToast === 'function')
        showToast('📊 Calculando 4 rotas alternativas...', 'info');

    // Buscar matriz de distâncias (metros) — objetivo diferente da primária (tempo)
    const distMatrix     = await _fetchOsrmMatrixDist(innerSnap);
    const weightedMatrix = _buildWeightedMatrix(matrix, distMatrix);

    // 4 motores com abordagens geometricamente distintas
    const motors = [
        {
            // Otimiza km puros (difere quando estrada curta = lenta)
            label: 'Menor Distância (km)',
            color: COMP_PALETTE[0],
            run  : () => Promise.resolve(_applyLocalOptimScoped([...innerSnap], distMatrix))
        },
        {
            // Visita em espiral horária a partir do centróide
            label: 'Varredura ↻ horário',
            color: COMP_PALETTE[1],
            run  : () => Promise.resolve(_circularSort([...innerSnap], true))
        },
        {
            // Visita em espiral anti-horária — oposto geométrico
            label: 'Varredura ↺ anti-horário',
            color: COMP_PALETTE[2],
            run  : () => Promise.resolve(_circularSort([...innerSnap], false))
        },
        {
            // Começa pelas extremidades, não pelo depot
            label: 'Extremidade Primeiro',
            color: COMP_PALETTE[3],
            run  : () => Promise.resolve(_nnFromFarthest([...innerSnap], matrix))
        }
    ];

    // Busca a meta da rota primária (azul) também para exibir no painel
    const primFull = [];
    if (partidaF) primFull.push(partidaF);
    stops.filter(s => !s._fixedType).forEach(s => primFull.push(s));
    if (finalF) primFull.push(finalF);
    if (!primFull.length) stops.forEach(s => primFull.push(s));

    // Montar entradas para a legenda (primária sem layer, as outras com layer)
    const entriesMeta = [{ label: primLabel + ' (selecionado)', color: '#4285F4', isPrimary: true, distKm: null, timeMin: null }];
    motors.forEach(m => entriesMeta.push({ label: m.label, color: m.color, isPrimary: false, distKm: null, timeMin: null }));

    // Mostrar painel imediatamente com "calculando..."
    _buildCompLegend(entriesMeta);

    // Buscar meta da rota primária em paralelo
    _fetchOsrmRouteWithMeta(primFull.length >= 2 ? primFull : innerSnap).then(meta => {
        if (meta) {
            entriesMeta[0].distKm  = meta.distKm;
            entriesMeta[0].timeMin = meta.timeMin;
            _buildCompLegend(entriesMeta); // rebuild com dados
        }
    });

    // Calcular e desenhar cada motor alternativo
    const results = await Promise.allSettled(motors.map(m => m.run()));

    for (let i = 0; i < motors.length; i++) {
        const m        = motors[i];
        const res      = results[i];
        const entryIdx = i + 1; // índice em entriesMeta (0 é primária)
        if (res.status !== 'fulfilled' || !res.value || !res.value.length) {
            console.warn(`Motor ${m.label} falhou ou sem resultado`);
            entriesMeta[entryIdx].failed = true;
            _buildCompLegend(entriesMeta);
            continue;
        }
        const ordered = res.value;
        const full    = [];
        if (partidaF) full.push(partidaF);
        ordered.forEach(s => full.push(s));
        if (finalF)   full.push(finalF);
        if (!full.length) ordered.forEach(s => full.push(s));

        const meta = await _fetchOsrmRouteWithMeta(full.length >= 2 ? full : ordered);
        if (!meta) {
            entriesMeta[entryIdx].failed = true;
            _buildCompLegend(entriesMeta);
            continue;
        }

        const latlngs = meta.coords.map(([lng, lat]) => [lat, lng]);
        const layer   = L.polyline(latlngs, {
            color    : m.color,
            weight   : 5,
            opacity  : 0.82,
            dashArray: '12,8'
        }).addTo(map);
        const compIdx = _compRoutesData.length;
        _compRoutesData.push({ layer, label: m.label, color: m.color, visible: true, distKm: meta.distKm, timeMin: meta.timeMin, orderedInner: ordered });

        // alias retrocompatível para o primeiro motor alternativo
        if (compIdx === 0) { _secRouteLayer = layer; }

        // Atualizar legenda com índice correto e dados reais
        entriesMeta[entryIdx].compIdx = compIdx;
        entriesMeta[entryIdx].distKm  = meta.distKm;
        entriesMeta[entryIdx].timeMin = meta.timeMin;
        _buildCompLegend(entriesMeta);
    }

    if (_compRoutesData.length > 0 && typeof showToast === 'function')
        showToast(`✅ ${_compRoutesData.length} rotas alternativas calculadas`, 'success');
    else if (_compRoutesData.length === 0 && typeof showToast === 'function')
        showToast('⚠️ Motores alternativos indisponíveis', 'warning');
}

// Manter função antiga como vazia para compatibilidade (não break outros calls)
async function _launchSecondaryRoute(snap, matrix, motor) {
    return _launchAllComparisons(snap, matrix, motor);
}

/** @deprecated use _fetchOsrmRouteWithMeta */
async function _fetchOsrmRoute(orderedStops) {
    const r = await _fetchOsrmRouteWithMeta(orderedStops);
    return r ? r.coords : null;
}
/** @deprecated use _drawSecondaryRoute via _launchAllComparisons */
async function _drawSecondaryRoute() { /* substituída por _launchAllComparisons */ }

// ==========================================

/**
 * Nearest Neighbor: constrói uma rota gulosa partindo do primeiro stop
 * e sempre visitando o ponto mais próximo ainda não visitado.
 * Preserva arr[0] como ponto de partida. Retorna novo array ordenado.
 */
function _nearestNeighbor(arr) {
    if (arr.length <= 2) return arr.slice();
    const result    = [arr[0]];
    const remaining = arr.slice(1);
    while (remaining.length) {
        const last = result[result.length - 1];
        let bestIdx  = 0;
        let bestDist = Infinity;
        remaining.forEach((s, i) => {
            const d = _dist(last, s);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        });
        result.push(remaining.splice(bestIdx, 1)[0]);
    }
    return result;
}

/**
 * Exact Optimal (Branch & Bound):
 * Fixa arr[0] como ponto de partida e experimenta todas as permutações
 * dos demais, podando ramos que já ultrapassaram o melhor custo encontrado.
 * Garante a solução ótima. Adequado para até ~12 paradas.
 */
function _exactOptimal(arr) {
    if (arr.length <= 2) return arr.slice();
    const fixed = arr[0];
    const rest  = arr.slice(1);
    let bestCost = Infinity;
    let bestPerm = rest.slice();

    // Usar NN como cota superior inicial para melhorar a poda
    const nnResult = _nearestNeighbor(arr);
    bestCost = 0;
    for (let i = 0; i < nnResult.length - 1; i++) {
        bestCost += _dist(nnResult[i], nnResult[i + 1]);
    }
    bestPerm = nnResult.slice(1);

    function permute(perm, start, currentCost, lastStop) {
        if (start === perm.length) {
            if (currentCost < bestCost) {
                bestCost = currentCost;
                bestPerm = perm.slice();
            }
            return;
        }
        for (let i = start; i < perm.length; i++) {
            const d       = _dist(lastStop, perm[i]);
            const newCost = currentCost + d;
            if (newCost >= bestCost) continue; // poda: já é pior que o melhor
            [perm[start], perm[i]] = [perm[i], perm[start]];
            permute(perm, start + 1, newCost, perm[start]);
            [perm[start], perm[i]] = [perm[i], perm[start]];
        }
    }

    permute(rest, 0, 0, fixed);
    return [fixed, ...bestPerm];
}

/**
 * Or-opt com janelas 1, 2 e 3:
 * Testa mover 1, 2 ou 3 stops consecutivos para a melhor posição da rota.
 * Janela 1: detecta pontos individuais mal posicionados.
 * Janela 2: detecta pares consecutivos que deveriam estar em outro trecho.
 * Janela 3: detecta trios que formam um desvio desnecessário.
 * Preserva arr[0] fixo (ponto de partida).
 */
function _orOpt(arr) {
    const n = arr.length;
    if (n < 4) return arr;

    // Executa uma passagem completa de Or-opt para uma janela de tamanho `w`
    // Retorna true se encontrou melhoria
    function _orOptWindow(w) {
        for (let i = 1; i + w - 1 < arr.length; i++) {
            const segEnd = i + w - 1; // último índice do segmento

            // Custo de remover segmento arr[i..segEnd]
            const dBeforeSeg  = _dist(arr[i - 1], arr[i]);
            const hasAfter    = segEnd + 1 < arr.length;
            const dAfterSeg   = hasAfter ? _dist(arr[segEnd], arr[segEnd + 1]) : 0;
            const dSkipSeg    = hasAfter ? _dist(arr[i - 1], arr[segEnd + 1]) : 0;
            // Custo interno do segmento (para não recalcular)
            let internalCost = 0;
            for (let k = i; k < segEnd; k++) {
                internalCost += _dist(arr[k], arr[k + 1]);
            }
            const gainRemove  = dBeforeSeg + dAfterSeg - dSkipSeg;

            // Testar inserir segmento entre arr[j] e arr[j+1]
            for (let j = 0; j < arr.length - 1; j++) {
                // Pular posições que se sobreponham ao segmento atual
                if (j >= i - 1 && j <= segEnd) continue;

                const costInsert = _dist(arr[j], arr[i])
                                 + _dist(arr[segEnd], arr[j + 1])
                                 - _dist(arr[j], arr[j + 1]);

                if (gainRemove - costInsert > 1e-10) {
                    const seg = arr.splice(i, w);
                    const insertAt = j < i ? j + 1 : j + 1 - w;
                    arr.splice(insertAt, 0, ...seg);
                    return true; // melhoria encontrada
                }
            }
        }
        return false;
    }

    let improved = true;
    let maxIter  = arr.length * arr.length * 6;
    while (improved && maxIter-- > 0) {
        improved = false;
        // Janelas em ordem crescente: 1 (mais comum) → 2 → 3
        if (_orOptWindow(1)) { improved = true; continue; }
        if (_orOptWindow(2)) { improved = true; continue; }
        if (_orOptWindow(3)) { improved = true; continue; }
    }
    return arr;
}

/* Algoritmo 2-opt sobre qualquer array de stops (modifica no lugar, retorna arr) */
function _optimize2opt(arr) {
    const n = arr.length;
    let improved = true;
    let maxIter = n * n * 8; // limite de segurança contra loop infinito
    while (improved && maxIter-- > 0) {
        improved = false;
        for (let i = 0; i < n - 2; i++) {
            for (let j = i + 2; j < n; j++) {
                if (j === n - 1 && i === 0) continue; // preservar extremos se rota fechada
                const d1 = _dist(arr[i],     arr[i + 1]);
                const d2 = _dist(arr[j],     arr[(j + 1) % n]);
                const d3 = _dist(arr[i],     arr[j]);
                const d4 = _dist(arr[i + 1], arr[(j + 1) % n]);
                if (d1 + d2 > d3 + d4 + 1e-10) {
                    arr.splice(i + 1, j - i, ...arr.slice(i + 1, j + 1).reverse());
                    improved = true;
                }
            }
        }
    }
    return arr;
}

/*
 * Otimização com agrupamento por bairro/região:
 *   1. Preserva o 1º stop como ponto de partida
 *   2. Agrupa os demais pelo valor do campo configurado
 *   3. Aplica NN → 2-opt → Or-opt dentro de cada grupo
 *   4. Ordena os grupos por vizinho mais próximo (greedy) a partir da partida
 *   5. Reconstrói stops[]
 */
function _optimizeComBairro(campos) {
    if (!Array.isArray(campos)) campos = campos ? [String(campos)] : [];
    if (!campos.length || stops.length < 2) return;

    const hasFixedStart = stops[0]?._fixedType === 'partida';
    const innerStops    = stops.filter(s => !s._fixedType);
    if (!innerStops.length) return;

    const partida   = hasFixedStart ? stops[0] : innerStops[0];
    const restantes = hasFixedStart ? innerStops : innerStops.slice(1);

    // Agrupar pela combinação de valores dos campos selecionados
    const grupos = new Map();
    restantes.forEach(s => {
        const pd  = s.pedidoData || {};
        const dj  = (typeof pd.dados_json === 'object' && pd.dados_json) ? pd.dados_json : {};
        const partes = campos.map(campo => {
            const v = pd[campo] !== undefined ? pd[campo] : dj[campo];
            return (v === null || v === undefined) ? '' : String(v).trim();
        });
        const val = partes.filter(Boolean).join(' | ') || '(sem agrupamento)';
        if (!grupos.has(val)) grupos.set(val, []);
        grupos.get(val).push(s);
    });

    // NN → 2-opt → Or-opt dentro de cada grupo
    grupos.forEach((arr, key) => {
        if (arr.length < 2) return;
        const ordered = _nearestNeighbor(arr);
        arr.length = 0;
        ordered.forEach(s => arr.push(s));
        if (arr.length > 2) {
            _optimize2opt(arr);
            _orOpt(arr);
        }
    });

    // Ordenar grupos por vizinho mais próximo (greedy a partir da partida)
    const gruposRestantes = [...grupos.values()];
    const gruposOrdenados = [];
    let pontoAtual = partida;

    while (gruposRestantes.length) {
        let melhorIdx  = 0;
        let melhorDist = Infinity;
        gruposRestantes.forEach((grupo, idx) => {
            const d = _dist(pontoAtual, grupo[0]);
            if (d < melhorDist) { melhorDist = d; melhorIdx = idx; }
        });
        const grupo = gruposRestantes.splice(melhorIdx, 1)[0];
        gruposOrdenados.push(grupo);
        pontoAtual = grupo[grupo.length - 1];
    }

    // Reconstruir array global
    stops.length = 0;
    stops.push(partida);
    gruposOrdenados.forEach(g => g.forEach(s => stops.push(s)));
    if (window.pontoFixoFinal?.configured) {
        const pf = _criarParadaFixa('final');
        if (pf) stops.push(pf);
    }
}

function reverseMiddleRoute() {
    if (stops.length < 3) return;
    // Preservar pontos fixos nas extremidades
    const hasFixedStart = stops[0]?._fixedType === 'partida';
    const hasFixedEnd   = stops[stops.length - 1]?._fixedType === 'final';
    const innerStart = hasFixedStart ? 1 : 0;
    const innerEnd   = hasFixedEnd   ? stops.length - 1 : stops.length;
    const middle = stops.slice(innerStart, innerEnd).reverse();
    stops = [
        ...(hasFixedStart ? [stops[0]] : []),
        ...middle,
        ...(hasFixedEnd ? [stops[stops.length - 1]] : [])
    ];
    saveStopsToStorage();
    renderStops();
    recalculateRoute();
}

function distance(p1, p2) {
    const R = 6371e3;
    const φ1 = (p1[0] * Math.PI) / 180;
    const φ2 = (p2[0] * Math.PI) / 180;
    const Δφ = ((p2[0] - p1[0]) * Math.PI) / 180;
    const Δλ = ((p2[1] - p1[1]) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Função para limpar mapa após salvar (sem devolver pedidos ao painel)
function clearMapAfterSave() {
    // Coletar IDs dos pedidos salvos para remover do painel
    const pedidosSalvos = stops
        .filter(s => s.sourcePedidoId)
        .map(s => String(s.sourcePedidoId));
    
    stops = [];
    rotaReabertaId = null;
    rotaReabertaNome = null;
    clearStopsStorage();
    if (typeof window.desativarVisualizacaoPedidos === 'function') {
        window.desativarVisualizacaoPedidos(false);
    }
    
    // Disparar evento para remover pedidos salvos do painel (não devolver)
    if (pedidosSalvos.length > 0) {
        window.dispatchEvent(new CustomEvent('pedidos-saved-to-route', {
            detail: { pedidoIds: pedidosSalvos }
        }));
    }
    
    addressInput.value = '';
    renderStops();
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline || (layer instanceof L.Marker && !(layer instanceof L.TileLayer))) {
            map.removeLayer(layer);
        }
    });
    if (control) map.removeControl(control);
    document.getElementById('summary-card').style.display = 'none';
}

function resetMap() {
    const pedidosParaRetornar = stops
        .filter(s => s.sourcePedidoId)
        .map(s => s.sourcePedidoId);

    stops = [];
    clearStopsStorage();
    if (typeof window.desativarVisualizacaoPedidos === 'function') {
        window.desativarVisualizacaoPedidos(false);
    }

    pedidosParaRetornar.forEach((pedidoId) => {
        window.dispatchEvent(new CustomEvent('pedido-removed-from-route', {
            detail: { pedidoId }
        }));
    });

    addressInput.value = '';
    renderStops();
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline || (layer instanceof L.Marker && !(layer instanceof L.TileLayer))) {
            map.removeLayer(layer);
        }
    });
    if (control) map.removeControl(control);
    document.getElementById('summary-card').style.display = 'none';
}

function exportRouteToPDF() {
    if (stops.length === 0) {
        alert('Adicione paradas para exportar!');
        return;
    }
    const stopsText = stops.map((s, i) => `${i + 1}. ${s.name} - ${s.address}`).join('\n');
    const content = `ROTA - ${new Date().toLocaleDateString()}\n\nParadas:\n${stopsText}\n\nDistância: ${document.getElementById('total-dist').textContent}\nTempo: ${document.getElementById('total-time').textContent}`;
    console.log(content);
    alert('PDF exportado! (Implemente integração com servidor)');
}

function sendToWhatsApp() {
    if (stops.length === 0) {
        alert('Adicione paradas para compartilhar!');
        return;
    }
    const message = `Olá! 📍 Tenho uma rota com ${stops.length} paradas:\n\n${stops.map((s, i) => `${i + 1}. ${s.name}\n${s.address}`).join('\n\n')}\n\nDistância: ${document.getElementById('total-dist').textContent}\nTempo: ${document.getElementById('total-time').textContent}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`);
}

document.getElementById('coordsInput').addEventListener('keypress', function(e) {
    if (e.key !== 'Enter') return;
    const coords = this.value.split(',').map(x => parseFloat(x.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        currentPendingPoint = {lat: coords[0], lng: coords[1]};
        map.flyTo([coords[0], coords[1]], 16);
        document.getElementById('confirmAdd').style.display = 'block';
    }
});

document.getElementById('csvFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const csv = event.target.result;
        const lines = csv.trim().split('\n').slice(1);
        
        lines.forEach(line => {
            const [name, lat, lng, address, obs] = line.split(';').map(x => x.trim());
            if (lat && lng) {
                addStop({
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    name: name || `Cliente #${autoIncrement++}`,
                    phone: '',
                    email: '',
                    address: address || 'Sem endereço',
                    obs: obs || ''
                });
            }
        });
        alert(`${lines.length} paradas importadas!`);
        e.target.value = '';
    };
    reader.readAsText(file);
});

// Função para salvar rota na API (caso necessário)
window.saveRouteToAPI = async function(distance, time) {
    // Esta função será integrada com a API Django se necessário
    console.log('Distância:', distance, 'Tempo:', time);
};

// Raio X do Cliente — abre modal a partir de um stop da rota
window.openRaioXFromStop = function(stopId) {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return;
    const pd = stop.pedidoData || {};
    const pedidoId = stop.sourcePedidoId || pd.id || '';
    const numeroPedido = pd.numero_pedido || '';
    const clienteNome = pd.cliente_nome || stop.name || '';
    if (typeof window.openRaioX === 'function') {
        window.openRaioX(pedidoId, numeroPedido, clienteNome, pd);
    }
};

window.addPedidoToRoute = function(pedido) {
    if (!pedido || !pedido.id) return false;

    // Verificar duplicata em TODOS os slots
    const jaExiste = getAllUsedPedidoIds().has(String(pedido.id));
    if (jaExiste) {
        // Checar se esta no proprio slot ativo (nao adicionar de novo)
        const slotIdx = getSlotIndexForPedido(pedido.id);
        if (slotIdx === activeSlotIndex) return false;
        // Esta em outro slot: perguntar se quer mover
        const slot = routeSlots[slotIdx];
        if (!confirm(`"${pedido.cliente_nome || 'Pedido #' + pedido.id}" ja esta em "${slot.nome}". Mover para "${routeSlots[activeSlotIndex].nome}"?`)) return false;
        // Remover do slot de origem
        if (slotIdx === activeSlotIndex) {
            stops = stops.filter(s => String(s.sourcePedidoId) !== String(pedido.id));
        } else {
            routeSlots[slotIdx].stops = (routeSlots[slotIdx].stops || []).filter(s => String(s.sourcePedidoId) !== String(pedido.id));
        }
        window.dispatchEvent(new CustomEvent('pedido-removed-from-route', { detail: { pedidoId: pedido.id } }));
    }

    const lat = Number(pedido.latitude);
    const lng = Number(pedido.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return false;
    }

    addStop({
        lat,
        lng,
        name: pedido.cliente_nome || `Pedido #${pedido.numero_pedido || pedido.id}`,
        phone: pedido.telefone || '',
        email: pedido.email || '',
        address: pedido.endereco || 'Sem endereço',
        obs: pedido.descricao || `Pedido ${pedido.numero_pedido || ''}`,
        sourcePedidoId: pedido.id,
        pedidoData: pedido,
    });

    return true;
};

// Caso não exista rota para carregar via URL, restabelecer a última rota em andamento
if (!rotaParaCarregar) {
    const restored = restoreStopsFromStorage();
    if (!restored) {
        // Restaurar slots de outros indices que possam ter paradas
        routeSlots.forEach((slot, i) => {
            if (i !== activeSlotIndex && slot.stops && slot.stops.length) {
                renderRouteSlotTabs();
            }
        });
    }
}

// Função para carregar rota do objeto global
function carregarRotaDaURL() {
    if (rotaParaCarregar && rotaParaCarregar.paradas && rotaParaCarregar.paradas.length > 0) {
        // Adicionar paradas da rota (excluindo pontos fixos já cadastrados)
        rotaParaCarregar.paradas.forEach((parada, index) => {
            if (parada.lat && parada.lng) {
                const stopObj = {
                    lat: parada.lat,
                    lng: parada.lng,
                    name: parada.cliente || `Cliente #${index + 1}`,
                    phone: parada.telefone || '',
                    email: parada.email || '',
                    address: parada.endereco || '',
                    obs: parada.observacoes || '',
                    tempo: parada.tempo_estimado || 0,
                    tipo: parada.tipo || 'cliente'
                };
                
                // Incluir dados do pedido Firebird se existirem
                if (parada.pedidoData) {
                    stopObj.pedidoData = parada.pedidoData;
                }
                
                if (parada.sourcePedidoId) {
                    stopObj.sourcePedidoId = parada.sourcePedidoId;
                }
                
                addStop(stopObj);
            }
        });

        ensureFixedPoints();
        
        // Centralizar mapa na primeira parada real
        const primeiraParadaReal = (rotaParaCarregar.paradas || []).find(p => p.lat && p.lng);
        if (primeiraParadaReal) {
            map.setView([primeiraParadaReal.lat, primeiraParadaReal.lng], 13);
        }
        
        // Calcular rota
        setTimeout(() => {
            recalculateRoute();
            alert(`Rota "${rotaParaCarregar.nome}" carregada com sucesso! ${rotaParaCarregar.paradas.length} paradas adicionadas.`);
        }, 800);
        
        // Guardar ID e nome da rota reaberta
        rotaReabertaId = rotaParaCarregar.id || null;
        rotaReabertaNome = rotaParaCarregar.nome || null;

        // Atualizar nome do slot ativo se a rota tem nome
        if (rotaReabertaNome) {
            routeSlots[activeSlotIndex].nome = rotaReabertaNome;
        }

        // Limpar variável
        rotaParaCarregar = null;

        saveAllSlotsToStorage();
        renderRouteSlotTabs();
    }
}

// Executar carregamento após um pequeno delay para garantir que tudo está inicializado
setTimeout(() => {
    carregarRotaDaURL();
}, 1000);

// ─── Ordenar por Campo ────────────────────────────────────────────────────────

let _ordenarGruposOrdem = [];   // array de valores na ordem definida pelo usuário
let _ordenarDraggedGrupo = null;

function _getStopAllFields(stop) {
    const result = {};
    const pd = stop.pedidoData || {};
    Object.keys(pd).forEach(k => { if (typeof pd[k] !== 'object') result[k] = true; });
    const dj = pd.dados_json || {};
    Object.keys(dj).forEach(k => { if (typeof dj[k] !== 'object') result[k] = true; });
    return Object.keys(result);
}

function _getValorCampoParaOrdem(stop, campo) {
    const pd = stop.pedidoData || {};
    if (Object.prototype.hasOwnProperty.call(pd, campo) && pd[campo] !== null && pd[campo] !== undefined) {
        return String(pd[campo]);
    }
    const dj = pd.dados_json || {};
    if (Object.prototype.hasOwnProperty.call(dj, campo) && dj[campo] !== null && dj[campo] !== undefined) {
        return String(dj[campo]);
    }
    return '(sem valor)';
}

function abrirOrdenarPorCampo() {
    if (!stops.length) {
        alert('Adicione paradas à rota primeiro.');
        return;
    }

    // Coletar campos disponíveis (union de todos os stops)
    const camposSet = new Set();
    stops.forEach(s => _getStopAllFields(s).forEach(c => camposSet.add(c)));

    const select = document.getElementById('ordenarCampoSelect');
    select.innerHTML = '<option value="">— selecione —</option>';
    [...camposSet].sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });

    // Pré-selecionar campo anterior se ainda existir
    if (_ordenarGruposOrdem.length && camposSet.has(select.dataset.lastCampo)) {
        select.value = select.dataset.lastCampo;
        _renderOrdenarGrupos(select.dataset.lastCampo);
    } else {
        document.getElementById('ordenarGruposList').innerHTML = '';
        document.getElementById('ordenarGroupCount').textContent = '';
    }

    document.getElementById('ordenarCampoModal').style.display = '';
}

function _renderOrdenarGrupos(campo) {
    if (!campo) {
        document.getElementById('ordenarGruposList').innerHTML = '';
        document.getElementById('ordenarGroupCount').textContent = '';
        return;
    }

    // Coletar valores únicos na ordem atual dos stops
    const valoresNaRota = [];
    const seen = new Set();
    stops.forEach(s => {
        const v = _getValorCampoParaOrdem(s, campo);
        if (!seen.has(v)) { seen.add(v); valoresNaRota.push(v); }
    });

    // Mesclar ordem anterior (se ainda válida) preservando novos valores
    const anteriorValidos = _ordenarGruposOrdem.filter(v => seen.has(v));
    const novos = valoresNaRota.filter(v => !anteriorValidos.includes(v));
    _ordenarGruposOrdem = [...anteriorValidos, ...novos];

    _renderOrdenarGruposList();

    const countEl = document.getElementById('ordenarGroupCount');
    const total = stops.length;
    countEl.textContent = `${_ordenarGruposOrdem.length} grupo(s) • ${total} parada(s)`;
}

function _renderOrdenarGruposList() {
    const campo = document.getElementById('ordenarCampoSelect').value;
    const list = document.getElementById('ordenarGruposList');
    if (!_ordenarGruposOrdem.length) { list.innerHTML = '<div style="padding:12px; color:#94a3b8; text-align:center; font-size:12px;">Nenhum valor encontrado</div>'; return; }

    list.innerHTML = _ordenarGruposOrdem.map((valor, idx) => {
        const count = stops.filter(s => _getValorCampoParaOrdem(s, campo) === valor).length;
        const valEsc = valor.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<div class="ordem-grupo-item" draggable="true" data-valor="${encodeURIComponent(valor)}"
            style="display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid #e2e8f0; cursor:grab; background:#fff; user-select:none;">
            <span style="color:#94a3b8; font-size:16px;">⠿</span>
            <span style="flex:1; font-size:13px;">${valEsc}</span>
            <span style="font-size:11px; color:#64748b; background:#f1f5f9; border-radius:8px; padding:1px 7px;">${count} parada${count!==1?'s':''}</span>
            <div style="display:flex; flex-direction:column; gap:1px;">
                <button onclick="_moverGrupo(${idx},-1)" style="background:none;border:none;cursor:pointer;padding:0;font-size:11px;color:#64748b;" title="Subir">▲</button>
                <button onclick="_moverGrupo(${idx},1)" style="background:none;border:none;cursor:pointer;padding:0;font-size:11px;color:#64748b;" title="Descer">▼</button>
            </div>
        </div>`;
    }).join('');

    // Drag-and-drop entre grupos
    list.querySelectorAll('.ordem-grupo-item').forEach(el => {
        el.addEventListener('dragstart', function (e) {
            _ordenarDraggedGrupo = this;
            this.style.opacity = '0.5';
        });
        el.addEventListener('dragover', function (e) { e.preventDefault(); });
        el.addEventListener('drop', function (e) {
            e.preventDefault();
            if (!_ordenarDraggedGrupo || _ordenarDraggedGrupo === this) return;
            const fromVal = decodeURIComponent(_ordenarDraggedGrupo.dataset.valor);
            const toVal   = decodeURIComponent(this.dataset.valor);
            const fi = _ordenarGruposOrdem.indexOf(fromVal);
            const ti = _ordenarGruposOrdem.indexOf(toVal);
            if (fi !== -1 && ti !== -1) {
                _ordenarGruposOrdem.splice(fi, 1);
                _ordenarGruposOrdem.splice(ti, 0, fromVal);
                _renderOrdenarGruposList();
            }
        });
        el.addEventListener('dragend', function () { this.style.opacity = '1'; _ordenarDraggedGrupo = null; });
    });
}

function _moverGrupo(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= _ordenarGruposOrdem.length) return;
    const tmp = _ordenarGruposOrdem[idx];
    _ordenarGruposOrdem[idx] = _ordenarGruposOrdem[newIdx];
    _ordenarGruposOrdem[newIdx] = tmp;
    _renderOrdenarGruposList();
}

function aplicarOrdemPorCampo() {
    const campo = document.getElementById('ordenarCampoSelect').value;
    if (!campo) { alert('Selecione um campo primeiro.'); return; }
    if (!_ordenarGruposOrdem.length) return;

    const ordem = new Map(_ordenarGruposOrdem.map((v, i) => [v, i]));
    stops.sort((a, b) => {
        const va = _getValorCampoParaOrdem(a, campo);
        const vb = _getValorCampoParaOrdem(b, campo);
        const ia = ordem.has(va) ? ordem.get(va) : 9999;
        const ib = ordem.has(vb) ? ordem.get(vb) : 9999;
        return ia - ib;
    });

    saveStopsToStorage();
    renderStops();
    recalculateRoute();

    document.getElementById('ordenarCampoModal').style.display = 'none';

    if (typeof showToast === 'function') {
        showToast(`Paradas reordenadas por "${campo}".`, 'success');
    }
}

// Inicializar event listeners do modal de ordenação (script carregado no final do body, DOM já está pronto)
(function initOrdenarModal() {
    const modal = document.getElementById('ordenarCampoModal');
    if (!modal) return;

    document.getElementById('btnFecharOrdenarCampo').addEventListener('click', () => { modal.style.display = 'none'; });
    document.getElementById('btnCancelarOrdenar').addEventListener('click', () => { modal.style.display = 'none'; });
    document.getElementById('btnAplicarOrdem').addEventListener('click', aplicarOrdemPorCampo);
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('ordenarCampoSelect').addEventListener('change', function () {
        this.dataset.lastCampo = this.value;
        _renderOrdenarGrupos(this.value);
    });
})();

// ─── Config de otimização por bairro (persistida em localStorage) ─────────────
(function initOtimizBairroConfig() {
    const CHAVE_ENABLED = 'fermap_otimiz_bairro_enabled';

    function salvar() {
        const chk = document.getElementById('rotasConfigOtimizBairro');
        if (!chk) return;
        localStorage.setItem(CHAVE_ENABLED, chk.checked ? '1' : '0');
    }

    // Toggle visibilidade da lista ao marcar/desmarcar checkbox principal
    document.addEventListener('change', function (e) {
        if (e.target.id === 'rotasConfigOtimizBairro') {
            const wrap = document.getElementById('campoOtimizBairroWrap');
            if (wrap) wrap.style.display = e.target.checked ? 'block' : 'none';
            salvar();
        }
    });

    // Salvar também ao clicar em "Salvar Configurações Visuais"
    document.addEventListener('click', function (e) {
        if (e.target.id === 'btnSalvarRotasVisual') salvar();
    });
})();


