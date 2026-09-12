import { createServer } from 'node:http'
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT || 3000)
const HOST = '127.0.0.1'
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(ROOT, 'public')
const MUSICAS_DIR = join(ROOT, 'musicas')
const CATALOG_PATH = join(ROOT, 'data', 'catalog.json')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function sendFile(res, data, type) {
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

function sanitizeId(id) {
  if (typeof id !== 'string' || id.length > 255) return null
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return null
  if (!/^[A-Za-zÀ-ÿ0-9 _\-().,]+$/.test(id)) return null
  return id
}

async function loadCatalog() {
  try {
    const raw = await readFile(CATALOG_PATH, 'utf8')
    const data = JSON.parse(raw)
    return { versoes: 1, musicas: Array.isArray(data.musicas) ? data.musicas : [] }
  } catch {
    return { versoes: 1, musicas: [] }
  }
}

async function persistCatalog(catalog) {
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8')
}

function deriveMeta(id) {
  const name = id.replace(/\.txt$/i, '')
  const sep = name.indexOf(' - ')
  const artista = sep === -1 ? '' : name.slice(0, sep).trim()
  const titulo = (sep === -1 ? name : name.slice(sep + 3)).trim()
  return { artista, titulo }
}

function tomBaseFromContent(text) {
  const m = /^[ \t]*Tom:\s*([A-G](?:#|b)?)[ \t]*$/im.exec(text || '')
  return m ? m[1] : null
}

function normalizeEstilos(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const s of list) {
    const t = String(s).trim()
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }
  return out
}

function estilosFromContent(text) {
  const m = /^[ \t]*Estilo:\s*(.+?)[ \t]*$/im.exec(text || '')
  if (!m) return []
  return normalizeEstilos(m[1].split(/[,;]/))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 20 * 1024 * 1024) {
        reject(new Error('corpo grande demais'))
        req.destroy()
      } else {
        chunks.push(c)
      }
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function parseBody(req) {
  try {
    return JSON.parse(await readBody(req))
  } catch {
    return null
  }
}

async function serveStatic(pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  const file = join(PUBLIC_DIR, normalize(rel))
  if (!file.startsWith(PUBLIC_DIR)) return null
  try {
    const data = await readFile(file)
    return { data, type: MIME[extname(file)] || 'application/octet-stream' }
  } catch {
    return null
  }
}

function parseMusicId(pathname) {
  const m = pathname.match(/^\/api\/musicas\/(.+)$/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

async function handlePutMusica(req, res, id) {
  const body = await parseBody(req)
  if (!body || typeof body.conteudo !== 'string') {
    return sendJson(res, 400, { error: 'conteudo inválido' })
  }
  const before = await loadCatalog()
  const existing = before.musicas.find((m) => m.id === id)
  const meta = deriveMeta(id)
  const entry = {
    id,
    artista: existing?.artista ?? meta.artista,
    titulo: existing?.titulo ?? meta.titulo,
    tomBase: tomBaseFromContent(body.conteudo) ?? existing?.tomBase ?? null,
    estilos: Array.isArray(body.estilos)
      ? normalizeEstilos(body.estilos)
      : existing?.estilos ?? estilosFromContent(body.conteudo),
    prefs: existing?.prefs,
  }
  await writeFile(join(MUSICAS_DIR, id), body.conteudo, 'utf8')
  const catalog = await loadCatalog()
  const idx = catalog.musicas.findIndex((m) => m.id === id)
  if (idx === -1) catalog.musicas.push(entry)
  else catalog.musicas[idx] = { ...catalog.musicas[idx], ...entry }
  await persistCatalog(catalog)
  return sendJson(res, 200, { ok: true, musica: entry })
}

async function handleDeleteMusica(res, id) {
  try {
    await unlink(join(MUSICAS_DIR, id))
  } catch {
    return sendJson(res, 404, { error: 'música não encontrada' })
  }
  const catalog = await loadCatalog()
  catalog.musicas = catalog.musicas.filter((m) => m.id !== id)
  await persistCatalog(catalog)
  return sendJson(res, 200, { ok: true })
}

async function handleCatalog(req, res) {
  const body = await parseBody(req)
  if (!body || !Array.isArray(body.musicas)) {
    return sendJson(res, 400, { error: 'catálogo inválido' })
  }
  const catalog = { versoes: 1, musicas: body.musicas }
  await persistCatalog(catalog)
  return sendJson(res, 200, { ok: true, musicas: catalog.musicas })
}

async function handleScan(res) {
  const catalog = await loadCatalog()
  let files = []
  try {
    files = (await readdir(MUSICAS_DIR)).filter((f) => /\.txt$/i.test(f))
  } catch {
    files = []
  }
  const present = new Set(files.filter((f) => sanitizeId(f)))
  const newEntries = []
  for (const f of present) {
    if (catalog.musicas.some((m) => m.id === f)) continue
    const meta = deriveMeta(f)
    let tomBase = null
    let estilos = []
    try {
      const conteudo = await readFile(join(MUSICAS_DIR, f), 'utf8')
      tomBase = tomBaseFromContent(conteudo)
      estilos = estilosFromContent(conteudo)
    } catch {}
    newEntries.push({ id: f, artista: meta.artista, titulo: meta.titulo, tomBase, estilos })
  }
  catalog.musicas = [...catalog.musicas.filter((m) => present.has(m.id)), ...newEntries]
  await persistCatalog(catalog)
  return sendJson(res, 200, { ok: true, musicas: catalog.musicas })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`)
  const pathname = url.pathname
  const method = req.method

  try {
    if (pathname === '/api/musicas' && method === 'GET') {
      const catalog = await loadCatalog()
      return sendJson(res, 200, catalog.musicas)
    }

    if (pathname === '/api/scan' && method === 'POST') {
      return handleScan(res)
    }

    if (pathname === '/api/catalog' && method === 'POST') {
      return handleCatalog(req, res)
    }

    const id = parseMusicId(pathname)
    if (id !== null) {
      const safe = sanitizeId(id)
      if (!safe) return sendJson(res, 400, { error: 'id inválido' })
      if (method === 'GET') {
        try {
          const data = await readFile(join(MUSICAS_DIR, safe), 'utf8')
          return sendJson(res, 200, { id: safe, conteudo: data })
        } catch {
          return sendJson(res, 404, { error: 'música não encontrada' })
        }
      }
      if (method === 'PUT') return handlePutMusica(req, res, safe)
      if (method === 'DELETE') return handleDeleteMusica(res, safe)
      return sendJson(res, 405, { error: 'método não suportado' })
    }

    const stat = await serveStatic(pathname)
    if (stat) return sendFile(res, stat.data, stat.type)
    return sendJson(res, 404, { error: 'não encontrado' })
  } catch (err) {
    return sendJson(res, 500, { error: 'erro interno', detalhe: String(err) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Cifra Prebelli em http://${HOST}:${PORT}`)
})