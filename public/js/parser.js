export const CHORD_PATTERN = /^[A-G](#|b)?(?:(?:maj7?|min7?|M7?|m|dim|aug|\+|°)(?:2|4|5|6|7|9|11|13)?|sus(?:2|4)?|add[2-9]?|7M(?:6|9|11|13)?|2|4|5|6|7|9|11|13)?(?:\([^)]*\))?(?:\/[A-G](#|b)?)?$/

export function parseChord(token) {
  if (!CHORD_PATTERN.test(token)) return null
  const slash = token.lastIndexOf('/')
  let baixo = null
  let base = token
  if (slash !== -1) {
    baixo = token.slice(slash + 1)
    base = token.slice(0, slash)
  }
  let anotacao = null
  const paren = base.lastIndexOf('(')
  if (paren !== -1) {
    anotacao = base.slice(paren)
    base = base.slice(0, paren)
  }
  const tonica = /^[A-G][#b]?/.exec(base)[0]
  const sufixo = base.slice(tonica.length)
  return { texto: token, tonica, sufixo, baixo, anotacao }
}

export function palavrasDeLinha(texto) {
  const palavras = []
  const re = /\S+/g
  let m
  while ((m = re.exec(texto)) !== null) {
    palavras.push({ texto: m[0], inicio: m.index })
  }
  return palavras
}

function agruparPalavra(col, palavras) {
  if (palavras.length === 0) return null
  let i = palavras.length - 1
  while (i >= 0 && palavras[i].inicio > col) i--
  return i < 0 ? 0 : i
}

function palavraSeguinte(col, palavras) {
  if (palavras.length === 0) return null
  let i = 0
  while (i < palavras.length && palavras[i].inicio <= col) i++
  return i >= palavras.length ? palavras.length - 1 : i
}

const RE_INLINE = /\[[^\[\]]+\]|\([^\(\)]+\)/g

function extrairInline(texto) {
  const inline = []
  let limpo = ''
  let removido = 0
  let ultimoFim = 0
  RE_INLINE.lastIndex = 0
  let m
  while ((m = RE_INLINE.exec(texto)) !== null) {
    limpo += texto.slice(ultimoFim, m.index)
    ultimoFim = m.index + m[0].length
    const inner = m[0].slice(1, -1).trim()
    if (!CHORD_PATTERN.test(inner)) {
      limpo += m[0]
      continue
    }
    inline.push({ acorde: parseChord(inner), col: m.index - removido })
    removido += m[0].length
  }
  limpo += texto.slice(ultimoFim)
  return { limpo, inline }
}

function isChordLine(texto) {
  const tokens = texto.trim().split(/\s+/)
  return tokens.length > 0 && tokens.every((t) => CHORD_PATTERN.test(t))
}

function acordesDeLinha(texto) {
  const acordes = []
  const re = /\S+/g
  let m
  while ((m = re.exec(texto)) !== null) {
    acordes.push({ ...parseChord(m[0]), col: m.index })
  }
  return acordes
}

export function parseCifra(texto) {
  const limpoLinhas = texto.replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n').split('\n')
  const modelo = { tom: null, estilos: [], conteudo: [] }
  let pendente = []

  const flush = () => {
    if (pendente.length) {
      modelo.conteudo.push({
        tipo: 'compasso',
        acordes: pendente,
        letra: null,
        palavras: [],
        vinculos: [],
        inline: [],
        indent: pendente[0] ? pendente[0].col : 0,
      })
      pendente = []
    }
  }

  for (const bruta of limpoLinhas) {
    const linha = bruta.replace(/\s+$/, '')
    if (linha.trim() === '') {
      flush()
      if (modelo.conteudo.length > 0 &&
          modelo.conteudo[modelo.conteudo.length - 1].tipo !== 'espaco') {
        modelo.conteudo.push({ tipo: 'espaco' })
      }
      continue
    }

    const tom = /^tom:\s*(.+)$/i.exec(linha)
    if (tom) {
      const nota = tom[1].trim()
      const normalizada = nota[0].toUpperCase() + nota.slice(1)
      if (CHORD_PATTERN.test(normalizada)) modelo.tom = normalizada
      continue
    }

    const est = /^estilo:\s*(.+)$/i.exec(linha)
    if (est) {
      modelo.estilos.push(...est[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean))
      continue
    }

    if (/^[A-ZÀ-Ù][^\s:]{0,19}:\s*\S{1,50}$/.test(linha)) continue

    const comChaves = linha[0] === '[' && linha[linha.length - 1] === ']'
    if (comChaves) {
      const inner = linha.slice(1, -1)
      if (isChordLine(inner)) {
        flush()
        pendente = acordesDeLinha(inner)
        continue
      }
      flush()
      modelo.conteudo.push({ tipo: 'secao', nome: inner.trim() })
      continue
    }

    if (isChordLine(linha)) {
      flush()
      pendente = acordesDeLinha(linha)
      continue
    }

    const { limpo, inline } = extrairInline(linha)
    const palavras = palavrasDeLinha(limpo)
    const acordes = pendente
    pendente = []
    const vinculos = acordes.map((a, i) => ({ acorde: i, palavra: agruparPalavra(a.col, palavras) }))
    const inlines = inline.map((e) => ({ ...e, palavra: palavraSeguinte(e.col, palavras) }))
    modelo.conteudo.push({
      tipo: 'compasso',
      acordes,
      letra: limpo,
      palavras,
      vinculos,
      inline: inlines,
      indent: palavras[0] ? palavras[0].inicio : 0,
    })
  }

  flush()
  while (modelo.conteudo.length && modelo.conteudo[modelo.conteudo.length - 1].tipo === 'espaco') {
    modelo.conteudo.pop()
  }
  return modelo
}