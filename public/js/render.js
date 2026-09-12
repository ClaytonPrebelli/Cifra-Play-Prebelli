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
    : modelo.conteudo.map((c) => (c.tipo === 'secao' ? c : transporCompasso(c, tomOffset)))
  for (const item of conteudo) {
    if (item.tipo === 'secao') {
      const h = document.createElement('h2')
      h.className = 'secao'
      h.textContent = item.nome
      container.append(h)
    } else {
      container.append(montarCompasso(item))
    }
  }
  return container
}