import { CHORD_PATTERN } from './parser.js'

export const DEC_CODES_PADRAO = {
  '3': 'E5',
  '4': 'A5',
  '5': 'C#5',
  '6': 'B5',
  '7': 'C#m',
  '8': 'E/G#',
  '9': 'A9',
  ':': 'E9',
  ';': 'A',
  '<': 'B',
  '=': 'F#5',
  '>': 'D',
  '?': 'G',
  '@': 'A',
}

const RE_TIPO = /^(\d+)\s+(.*)$/
const RE_GLUED = /^3+([^\s]*)$/

export function tituloDeDec(conteudo) {
  const linhas = (conteudo || '').split(/\r?\n/)
  for (const linha of linhas) {
    const h = /^0\s+(.*)$/.exec(linha)
    if (h) return h[1].trim()
  }
  const tm = /^Decifr2\s+[0-9.]+(?:\s+(.*))?\s*$/.exec(linhas[0] || '')
  return tm && tm[1] ? tm[1].trim() : ''
}

export function codigosDeDec(conteudo) {
  const set = new Set()
  for (const linha of (conteudo || '').split(/\r?\n/)) {
    const m = /^3\s+(.*)$/.exec(linha)
    if (!m) continue
    for (const tok of m[1].split(/\s+/).filter(Boolean)) {
      if (tok.length === 1) {
        set.add(tok)
        continue
      }
      const glued = RE_GLUED.exec(tok)
      if (glued) for (const c of glued[1]) set.add(c)
    }
  }
  return set
}

export function codigosSemAcorde(conteudo, codigos) {
  const sem = []
  for (const c of codigosDeDec(conteudo)) {
    if (!codigos || !codigos[c]) sem.push(c)
  }
  return sem
}

function promoveSecao(texto) {
  if (!texto || !texto.trim()) return texto
  const m = /^(\[[^\]]+\])(?:\s+.*)?$/.exec(texto)
  return m ? m[1] : texto
}

function palavras(texto) {
  const out = []
  const re = /\S+/g
  let m
  while ((m = re.exec(texto))) out.push({ col: m.index, texto: m[0], tam: m[0].length })
  return out
}

function distribuiAcordes(bloco, acordes, saida) {
  const frases = bloco.map((l) => {
    const texto = promoveSecao(l.texto)
    const secao = texto.startsWith('[') && texto.endsWith(']')
    return { texto, secao, refrao: l.refrao, palavras: secao || l.texto === '' ? [] : palavras(texto) }
  })

  if (acordes.length === 0) {
    for (const f of frases) {
      if (f.texto === '') saida.push({ linha: '', refrao: 'flow' })
      else if (f.secao) saida.push({ linha: f.texto, refrao: false })
      else saida.push({ linha: f.texto, refrao: f.refrao })
    }
    return
  }

  const portadores = frases.flatMap((f, li) => f.palavras.map((p) => ({ li, ...p })))
  const total = portadores.reduce((s, p) => s + p.tam, 0)

  const porLinha = new Map()
  acordes.forEach((acorde, i) => {
    if (portadores.length === 0) return
    const alvo = total === 0 ? 0 : ((i + 0.5) / acordes.length) * total
    let acum = 0
    let portador = portadores[portadores.length - 1]
    for (const p of portadores) {
      acum += p.tam
      if (alvo <= acum) {
        portador = p
        break
      }
    }
    if (!porLinha.has(portador.li)) porLinha.set(portador.li, [])
    porLinha.get(portador.li).push({ acorde, col: portador.col })
  })

  frases.forEach((f, li) => {
    if (f.texto === '') {
      saida.push({ linha: '', refrao: 'flow' })
      return
    }
    if (f.secao) {
      saida.push({ linha: f.texto, refrao: false })
      return
    }
    const ach = porLinha.get(li)
    if (ach) {
      let anteriorAte = -1
      let buf = ''
      for (const { acorde, col } of ach) {
        let c = col
        if (c <= anteriorAte + 1) c = anteriorAte + 2
        while (buf.length < c) buf += ' '
        buf += acorde
        anteriorAte = buf.length - 1
      }
      saida.push({ linha: buf, refrao: 'flow' })
    }
    saida.push({ linha: f.texto, refrao: f.refrao })
  })
}

function aplicaRefrao(itens) {
  const final = []
  let emRefrao = false
  for (const e of itens) {
    if (e.refrao === true) {
      if (!emRefrao) {
        const prev = [...final].reverse().find((l) => l.trim() !== '')
        if (!(prev && /^\[[^\]]*refr/i.test(prev))) final.push('[Refrão]')
        emRefrao = true
      }
      final.push(e.linha)
      continue
    }
    if (e.refrao === false && e.linha !== '') emRefrao = false
    final.push(e.linha)
  }
  return final
}

export function deDecParaLinhas(conteudo, codigos) {
  const linhas = (conteudo || '').split(/\r?\n/)
  const saida = []
  let emCorpo = false
  let ativo = []
  let bloco = []
  const mapa = codigos || {}

  const extraiAcordes = (ruler) => {
    const acordes = []
    for (const tok of ruler.split(/\s+/).filter(Boolean)) {
      if (tok.length === 1) {
        if (mapa[tok]) acordes.push(mapa[tok])
        continue
      }
      const glued = RE_GLUED.exec(tok)
      if (glued) {
        for (const c of glued[1]) if (mapa[c]) acordes.push(mapa[c])
      }
    }
    return acordes
  }

  const soltarBloco = () => {
    distribuiAcordes(bloco, ativo, saida)
    bloco = []
  }

  for (const linha of linhas) {
    if (!emCorpo) {
      if (/^0\s+/.test(linha)) emCorpo = true
      continue
    }
    const m = RE_TIPO.exec(linha)
    if (!m) continue
    const tipo = Number(m[1])
    const resto = m[2].replace(/\s+$/, '')
    if (tipo === 3) {
      soltarBloco()
      ativo = extraiAcordes(resto)
      continue
    }
    if (tipo === 2 || tipo === 8) bloco.push({ texto: resto, refrao: tipo === 8 })
  }
  soltarBloco()

  return aplicaRefrao(saida)
}

export function deTextoParaLinhas(conteudo) {
  const linhas = (conteudo || '').replace(/\r\n?/g, '\n').split('\n')
  const saida = []
  let emRefrao = false
  for (const linha of linhas) {
    const semMarcador = linha.replace(/<\/?[Oo]>/g, '').replace(/\s+$/, '')
    if (/^\s*\[[^\]]+\]\s*$/.test(semMarcador)) {
      saida.push(semMarcador)
      emRefrao = false
      continue
    }
    if (/<[Oo]>/.test(linha)) {
      if (!emRefrao) {
        const prev = [...saida].reverse().find((l) => l.trim() !== '')
        if (!(prev && /^\[[^\]]*refr/i.test(prev))) saida.push('[Refrão]')
        emRefrao = true
      }
      if (!semMarcador.trim()) continue
    }
    saida.push(semMarcador)
  }
  return saida.map(desempacotaParens)
}

export function linhasDeTxt(conteudo) {
  return (conteudo || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .map(desempacotaParens)
}

export function desempacotaParens(linha) {
  const inicio = linha.indexOf('(')
  const fim = linha.lastIndexOf(')')
  if (inicio === -1 || fim === -1 || fim < inicio) return linha
  if (linha.slice(0, inicio).trim() || linha.slice(fim + 1).trim()) return linha
  const inner = linha.slice(inicio + 1, fim).trim()
  const tokens = inner.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return linha
  if (!tokens.every((t) => CHORD_PATTERN.test(t))) return linha
  return inner
}