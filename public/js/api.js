async function request(method, url, body) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data.error) msg = data.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export const getCatalog = () => request('GET', '/api/musicas')

export const getMusica = (id) => request('GET', `/api/musicas/${encodeURIComponent(id)}`)

export const putMusica = (id, conteudo, estilos, tomBase) =>
  request('PUT', `/api/musicas/${encodeURIComponent(id)}`, { conteudo, estilos, tomBase })

export const deleteMusica = (id) =>
  request('DELETE', `/api/musicas/${encodeURIComponent(id)}`)

export const saveCatalog = (catalog) => request('POST', '/api/catalog', catalog)

export const scan = () => request('POST', '/api/scan')