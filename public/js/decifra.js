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

const RE_TIPO = /^(\d+)(\s?)(.*)$/

export function tituloDeDec(conteudo) {
  const linhas = (conteudo || '').split(/\r?\n/)
  for (const linha of linhas) {
    const h = /^0\s+(.*)$/.exec(linha)
    if (h) return h[1].trim()
  }
  const tm = /^Decifr2\s+[0-9.]+(?:\s+(.*))?\s*$/.exec(linhas[0] || '')
  return tm && tm[1] ? tm[1].trim() : ''
}

function codigosDaRuler(resto) {
  return (resto || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((tok, ti) => (ti === 0 ? tok.replace(/^3+/, '') : tok))
    .join('')
}

export function codigosDeDec(conteudo) {
  const set = new Set()
  for (const linha of (conteudo || '').split(/\r?\n/)) {
    const m = /^3\s+(.*)$/.exec(linha)
    if (!m) continue
    for (const c of codigosDaRuler(m[1])) set.add(c)
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

function decifraAcorde(tok) {
  const barra = tok.indexOf('/')
  const corpo = barra === -1 ? tok : tok.slice(0, barra)
  const leitura = (t) => {
    let i = 1
    let n = t[0] || ''
    if (t[1] === 's') {
      n += '#'
      i = 2
    }
    if (t[i] === 'f') i++
    return n + t.slice(i)
  }
  const nome = leitura(corpo)
  return barra === -1 ? nome : `${nome}/${leitura(tok.slice(barra + 1))}`
}

function acordesDeDec(conteudo) {
  const out = []
  for (const linha of (conteudo || '').split(/\r?\n/)) {
    const m = /^([A-G][^\s]*)\s+\d+(?:\s|$)/.exec(linha)
    if (m) out.push(decifraAcorde(m[1]))
  }
  return out
}

function mapaDeDec(conteudo, codigos) {
  const acordes = acordesDeDec(conteudo)
  const usados = [...codigosDeDec(conteudo)].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
  const derivado = {}
  for (let i = 0; i < acordes.length && i < usados.length; i++) {
    derivado[usados[i]] = acordes[i]
  }
  const mapa = {}
  for (const c of usados) {
    if (codigos && codigos[c] && codigos[c] !== DEC_CODES_PADRAO[c]) {
      mapa[c] = codigos[c]
    } else if (derivado[c]) {
      mapa[c] = derivado[c]
    } else if (codigos && codigos[c]) {
      mapa[c] = codigos[c]
    } else {
      mapa[c] = ''
    }
  }
  return mapa
}

function extraiRuler(resto, mapa) {
  const acordes = []
  const codigos = []
  const toks = (resto || '').split(/\s+/).filter(Boolean)
  const run = ((toks[0] || '').match(/^3+/) || [''])[0].length
  let idx = 0
  toks.forEach((tok, ti) => {
    const i = resto.indexOf(tok, idx)
    const corpo = ti === 0 ? tok.replace(/^3+/, '') : tok
    let col = i + (ti === 0 ? tok.length - corpo.length : 0) - run + 1
    for (const c of corpo) {
      codigos.push(c)
      if (mapa[c]) acordes.push({ acorde: mapa[c], col })
      col++
    }
    idx = i + tok.length
  })
  return { acordes, codigos }
}

function montaLinhaAcordes(acordes) {
  let buf = ''
  let fim = -1
  for (const { acorde, col } of acordes) {
    let c = Math.max(0, col)
    if (fim >= 0 && c <= fim + 1) c = fim + 2
    while (buf.length < c) buf += ' '
    buf += acorde
    fim = buf.length - 1
  }
  return buf
}

function aplicaRefrao(itens) {
  const final = []
  let emRefrao = false
  let vazios = 0
  for (const e of itens) {
    if (e.refrao === true) {
      if (vazios >= 5) emRefrao = false
      if (!emRefrao) {
        const prev = [...final].reverse().find((l) => l.trim() !== '')
        if (!(prev && /^\[[^\]]*refr/i.test(prev))) final.push('[Refrão]')
        emRefrao = true
      }
      final.push(e.linha)
      vazios = 0
      continue
    }
    if (e.linha === '') vazios++
    else if (e.refrao === false) emRefrao = false
    else vazios = 0
    final.push(e.linha)
  }
  return final
}

export function deDecParaLinhas(conteudo, codigos) {
  const linhas = (conteudo || '').split(/\r?\n/)
  const mapa = mapaDeDec(conteudo, codigos)
  const itens = []
  let emCorpo = false
  let pendentes = []
  let cicloIntro = null

  for (const linha of linhas) {
    if (!emCorpo) {
      if (!/^0\s+/.test(linha) && !/^3\s+/.test(linha)) continue
      emCorpo = true
    }
    const m = RE_TIPO.exec(linha)
    if (!m) continue
    const tipo = Number(m[1])
    const resto = m[3].replace(/\s+$/, '')
    if (tipo === 3) {
      const ruler = extraiRuler(resto, mapa)
      if (cicloIntro === null && ruler.codigos.length >= 2 && new Set(ruler.codigos).size === ruler.codigos.length) {
        cicloIntro = ruler.codigos
      }
      pendentes.push(ruler)
      continue
    }
    if (tipo === 2 || tipo === 8) {
      const refrao = tipo === 8
      const texto = resto
      if (!texto.trim()) {
        for (const p of pendentes) {
          let acordes = p.acordes
          if (cicloIntro && p.codigos.length === 1 && p.codigos[0] === cicloIntro[1]) {
            const base = mapa[cicloIntro[0]]
            if (base) acordes = [{ acorde: base, col: 0 }, ...p.acordes]
          }
          if (acordes.length) itens.push({ linha: montaLinhaAcordes(acordes), refrao: false })
        }
        pendentes = []
        itens.push({ linha: '', refrao: 'flow' })
        continue
      }
      for (const p of pendentes) {
        let acordes = p.acordes
        if (cicloIntro && p.codigos.length === 1 && p.codigos[0] === cicloIntro[1]) {
          const base = mapa[cicloIntro[0]]
          if (base) acordes = [{ acorde: base, col: 0 }, ...p.acordes]
        }
        if (acordes.length) itens.push({ linha: montaLinhaAcordes(acordes), refrao })
      }
      pendentes = []
      itens.push({ linha: texto, refrao })
    }
  }

  return aplicaRefrao(itens)
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