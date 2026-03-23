function getCsrf() {
  const c = document.cookie.split('; ').find(r => r.startsWith('csrftoken='))
  return c ? decodeURIComponent(c.split('=')[1]) : ''
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrf(),
      ...opts.headers,
    },
  })
  // Tenta parsear como JSON; se falhar (ex: resposta HTML de redirect/erro 500), lança erro legível
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (res.status === 403) throw new Error('Sessão expirada. Recarregue a página e faça login novamente.')
    if (res.status === 500) throw new Error('Erro interno no servidor (500). Verifique os logs do Django.')
    throw new Error(`Resposta inesperada do servidor (HTTP ${res.status}).`)
  }
}

export async function fetchAbas() {
  return apiFetch('/firebird/raio-x/abas/')
}

export async function fetchSqls() {
  return apiFetch('/firebird/raio-x/sqls/')
}

export async function executeAba({ sqlExtraId, pedidoId, numeroPedido, camposJoin }) {
  return apiFetch('/firebird/raio-x/executar/', {
    method: 'POST',
    body: JSON.stringify({
      sql_extra_id: sqlExtraId,
      pedido_id: pedidoId,
      numero_pedido: numeroPedido,
      campos_join: camposJoin,
    }),
  })
}

export async function saveAbas(abas) {
  return apiFetch('/firebird/raio-x/abas/salvar/', {
    method: 'POST',
    body: JSON.stringify({ abas }),
  })
}
