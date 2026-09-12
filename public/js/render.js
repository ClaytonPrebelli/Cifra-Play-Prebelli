import { transporCompasso, textoDoAcorde } from './transpositor.js'

function montarCompasso(c) {
  const row = document.createElement('div')
  row.className = 'compasso'

  if (c.letra == null) {
    const sov = document.createElement('div')
    sov.className = 'compasso-so'
    for (const a of c.acordes) {
      const s = document.createElement('span')
      s.className = 'acorde'
      s.textContent = textoDoAcorde(a)
      sov.append(s)
    }
    row.append(sov)
    return row
  }

  const porPalavra = new Map()
  const adicionar = (palavra, acorde) => {
    if (palavra == null) return
    if (!porPalavra.has(palavra)) porPalavra.set(palavra, [])
    porPalavra.get(palavra).push(acorde)
  }
  for (const v of c.vinculos) adicionar(v.palavra, c.acordes[v.acorde])
  for (const e of c.inline) adicionar(e.palavra, e.acorde)

  const frase = document.createElement('div')
  frase.className = 'frase'
  c.palavras.forEach((p, i) => {
    const wrap = document.createElement('span')
    wrap.className = 'pw'
    const labels = porPalavra.get(i)
    if (labels && labels.length) {
      const cap = document.createElement('span')
      cap.className = 'pw-acordes'
      for (const a of labels) {
        const s = document.createElement('span')
        s.className = 'acorde'
        s.textContent = textoDoAcorde(a)
        cap.append(s)
      }
      wrap.append(cap)
    }
    const tx = document.createElement('span')
    tx.className = 'pw-texto'
    tx.textContent = p.texto
    wrap.append(tx)
    frase.append(wrap, document.createTextNode(' '))
  })
  row.append(frase)
  return row
}

export function renderShow(modelo, { tomOffset = 0, colunas = 3 } = {}) {
  const container = document.createElement('div')
  container.className = 'show-cifra'
  container.dataset.colunas = String(colunas)
  const conteudo = tomOffset === 0
    ? modelo.conteudo
    : modelo.conteudo.map((c) => (c.tipo === 'compasso' ? transporCompasso(c, tomOffset) : c))
  let destacar = false
  for (const item of conteudo) {
    if (item.tipo === 'secao') {
      destacar = !/^(fim|final)$/i.test(item.nome || '')
      continue
    }
    if (item.tipo === 'espaco') {
      const g = document.createElement('div')
      g.className = 'espaco'
      container.append(g)
      continue
    }
    const c = montarCompasso(item)
    if (destacar) c.classList.add('secao-atual')
    container.append(c)
  }
  return container
}

const GAP_COLUNAS = 40

function criarPagina(altura, c1, c2) {
  const p = document.createElement('div')
  p.className = 'pagina'
  p.style.height = `${altura}px`
  p.style.overflow = 'hidden'
  for (const col of [c1, c2]) {
    const d = document.createElement('div')
    d.className = 'col'
    d.append(...col)
    p.append(d)
  }
  return p
}

export function paginarRows(rows, { altura, largura }) {
  if (!altura || !largura) return []
  const colW = Math.max(100, (largura - GAP_COLUNAS) / 2)
  const med = document.createElement('div')
  med.className = 'show-cifra'
  med.style.position = 'fixed'
  med.style.left = '-9999px'
  med.style.top = '0'
  med.style.width = `${colW}px`
  document.body.append(med)

  function alturaLinha(row) {
    med.textContent = ''
    med.append(row)
    const h = row.offsetHeight
    med.removeChild(row)
    return h
  }

  const paginas = []
  let c1 = []
  let c2 = []
  let h1 = 0
  let h2 = 0
  const novaPagina = () => {
    if (c1.length || c2.length) paginas.push(criarPagina(altura, c1, c2))
  }

  for (const row of rows) {
    const hr = alturaLinha(row)
    if (h1 + hr <= altura) {
      c1.push(row)
      h1 += hr
      continue
    }
    if (h2 + hr <= altura) {
      c2.push(row)
      h2 += hr
      continue
    }
    novaPagina()
    c1 = [row]
    h1 = hr
    c2 = []
    h2 = 0
  }
  novaPagina()
  med.remove()
  return paginas
}