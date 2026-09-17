import { transporCompasso, textoDoAcorde } from './transpositor.js'

const GAP_COLUNAS = 40

function montarLinhaAcordes(acordes) {
  const el = document.createElement('div')
  el.className = 'linha-acordes'
  let fim = -1
  for (const a of acordes) {
    if (!a) continue
    const txt = textoDoAcorde(a)
    let col = Number.isFinite(a.col) ? Math.max(0, a.col) : 0
    if (fim >= 0 && col <= fim + 1) col = fim + 2
    const gap = col - (fim + 1)
    if (gap > 0) el.append(document.createTextNode(' '.repeat(gap)))
    const s = document.createElement('span')
    s.className = 'acorde'
    s.textContent = txt
    el.append(s)
    fim = col + txt.length - 1
  }
  return el
}

function montarLinhaLetra(compasso) {
  const el = document.createElement('div')
  el.className = 'linha-letra'
  const texto = compasso.letra || ''
  const inline = [...(compasso.inline || [])].sort((a, b) => a.col - b.col)
  let pos = 0
  for (const e of inline) {
    const col = Number.isFinite(e.col) ? Math.max(0, e.col) : pos
    if (col > pos) {
      el.append(document.createTextNode(texto.slice(pos, col)))
      pos = col
    }
    const s = document.createElement('span')
    s.className = 'acorde'
    s.textContent = textoDoAcorde(e.acorde)
    el.append(s)
  }
  if (pos < texto.length) el.append(document.createTextNode(texto.slice(pos)))
  return el
}

function montarCompasso(c, idx) {
  const row = document.createElement('div')
  row.className = 'compasso'
  row.dataset.idx = String(idx)
  if (c.acordes && c.acordes.length) row.append(montarLinhaAcordes(c.acordes))
  if (c.letra != null) row.append(montarLinhaLetra(c))
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
  conteudo.forEach((item, i) => {
    if (item.tipo === 'secao') {
      destacar = !/^(fim|final)$/i.test(item.nome || '')
      return
    }
    if (item.tipo === 'espaco') {
      const g = document.createElement('div')
      g.className = 'espaco'
      g.dataset.idx = String(i)
      container.append(g)
      return
    }
    const c = montarCompasso(item, i)
    if (destacar) c.classList.add('secao-atual')
    container.append(c)
  })
  return container
}

export function ajustarFonte(cifraEl, rows, largura) {
  const colW = Math.max(100, (largura - GAP_COLUNAS) / 2)
  let max = 1
  for (const row of rows) {
    for (const linha of row.querySelectorAll('.linha-acordes, .linha-letra')) {
      const n = linha.textContent.length
      if (n > max) max = n
    }
  }
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:100px'
  probe.textContent = '0'.repeat(64)
  cifraEl.append(probe)
  const ratio = probe.getBoundingClientRect().width / 64 / 100 || 0.6
  probe.remove()
  const base = Math.min(30, Math.max(17, window.innerHeight * 0.029))
  const fs = Math.max(8, Math.min(base, colW / (max * ratio)))
  const valor = `${fs}px`
  cifraEl.style.setProperty('--show-fs', valor)
  return valor
}

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

export function paginarRows(rows, { altura, largura, fontSize }) {
  if (!altura || !largura) return []
  const colW = Math.max(100, (largura - GAP_COLUNAS) / 2)
  const med = document.createElement('div')
  med.className = 'show-cifra'
  if (fontSize) med.style.setProperty('--show-fs', fontSize)
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
