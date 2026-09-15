const LANG = 'pt-BR'
const LIMIAR = 0.4
const LACUNA_MAX = 6

export function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function palavras(s) {
  return normalizar(s).split(/[^a-z0-9]+/).filter(Boolean)
}

function linhasDoModelo(modelo) {
  return modelo.conteudo
    .map((item, i) => ({ idx: i, texto: item.letra || '' }))
    .filter((l) => l.texto.trim())
}

export function casarFalaLinha(fala, linhas, limiar = LIMIAR) {
  const fw = palavras(fala)
  if (!fw.length) return null
  let melhor = null
  let melhorScore = 0
  for (const linha of linhas) {
    const lw = palavras(linha.texto)
    if (!lw.length) continue
    const casadas = fw.filter((w) => lw.includes(w)).length
    const score = casadas / fw.length
    if (score > melhorScore) {
      melhorScore = score
      melhor = linha
    }
  }
  return melhorScore >= limiar ? melhor : null
}

export function casarProximaLinha(fala, linhas, ref) {
  const fw = palavras(fala)
  if (!fw.length) return null
  let melhor = null
  let melhorScore = 0
  for (const l of linhas) {
    if (l.idx <= ref) continue
    const lw = palavras(l.texto)
    if (!lw.length) continue
    const exigidas = lw.length <= 3 ? lw.length : Math.max(2, Math.round(lw.length * 0.45))
    const cabeca = fw.slice(0, Math.max(8, lw.length + 4))
    if (cabeca.length < exigidas) continue
    const casadas = lw.filter((w) => cabeca.includes(w)).length
    if (casadas < exigidas) continue
    const score = casadas / lw.length
    if (score > melhorScore) {
      melhorScore = score
      melhor = l
    }
  }
  return melhor ? { linha: melhor, score: melhorScore } : null
}

export function reconstruirFaladas(faladas, finaisLen, consumido, uttLen, novas) {
  const inicio = faladas.length - uttLen
  let c = consumido
  if (uttLen > 0 && c > inicio) {
    const corte = Math.min(c - inicio, novas.length)
    let ok = 0
    for (let i = 0; i < corte; i++) {
      if (faladas[inicio + i] === novas[i]) ok = i + 1
      else break
    }
    c = inicio + ok
  }
  return { faladas: [...faladas.slice(0, finaisLen), ...novas], consumido: c }
}

export function proximoPasso(faladas, linhas, estado) {
  let consumido = Math.min(estado.consumido, faladas.length)
  consumido = reclamarCauda(faladas, linhas, estado.ultimoIdx, consumido)
  let ultimoIdx = estado.ultimoIdx
  const alvo = faladas.slice(consumido).join(' ')
  if (alvo) {
    const m = casarProximaLinha(alvo, linhas, ultimoIdx)
    if (m && m.linha.idx > ultimoIdx) {
      ultimoIdx = m.linha.idx
      consumido = consumirLinha(faladas, linhas, ultimoIdx, consumido)
    }
  }
  estado.consumido = consumido
  estado.ultimoIdx = ultimoIdx
  return estado
}

export function reclamarCauda(faladas, linhas, idx, consumido) {
  if (idx < 0) return consumido
  const atual = linhas.find((l) => l.idx === idx)
  if (!atual) return consumido
  const lw = palavras(atual.texto)
  if (!lw.length) return consumido
  let qi = consumido - 1
  let ultimoLw = -1
  for (let i = 0; i < lw.length; i++) {
    const at = faladas.indexOf(lw[i], qi + 1)
    if (at < 0) continue
    if (at - qi > LACUNA_MAX) continue
    qi = at
    ultimoLw = i
  }
  if (ultimoLw !== lw.length - 1) return consumido
  return Math.min(faladas.length, qi + 1)
}

export function consumirLinha(faladas, linhas, idx, consumido) {
  if (idx < 0) return consumido
  const atual = linhas.find((l) => l.idx === idx)
  if (!atual) return consumido
  const lw = palavras(atual.texto)
  if (!lw.length) return consumido
  let qi = consumido - 1
  let achou = 0
  for (const w of lw) {
    const at = faladas.indexOf(w, qi + 1)
    if (at < 0) continue
    if (at - qi > LACUNA_MAX) continue
    qi = at
    achou++
  }
  return achou ? Math.min(faladas.length, qi + 1) : consumido
}

function mapaLinhaPagina(rows, paginas) {
  const mapa = new Map()
  paginas.forEach((pagina, p) => {
    for (const col of pagina.querySelectorAll('.col')) {
      for (const row of col.children) {
        const idx = row.dataset?.idx
        if (idx == null || mapa.has(idx)) continue
        mapa.set(Number(idx), p)
      }
    }
  })
  return mapa
}

export function createVoice(
  modelo,
  rows,
  paginas,
  onPagina = () => {},
  onNivel = () => {},
  onStatus = () => {},
) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const api = { ativo: false, iniciar, parar, disponivel: Boolean(SR) }
  if (!SR) return api

  const mapa = mapaLinhaPagina(rows, paginas)
  const linhas = linhasDoModelo(modelo)
  const linhaEl = new Map()
  for (const row of rows) {
    const idx = row.dataset?.idx
    if (idx != null) linhaEl.set(Number(idx), row)
  }
  const rec = new SR()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = LANG

  let faladas = []
  let finaisLen = 0
  let uttLen = 0
  let consumido = 0
  let ultimoIdx = -1
  let falhou = false
  let mediaFalhou = false
  let audioCtx = null
  let stream = null
  let analisador = null
  let raf = null
  let timerPulso = null

  function destacarLinha(idx) {
    for (const [i, el] of linhaEl) el.classList.toggle('voz-atual', i === idx)
  }

  function enviar(idx, confirmado) {
    if (idx == null) return
    const p = mapa.get(idx)
    if (p == null) return
    onPagina(p, confirmado)
  }

  function aceitarChunk(confirmado) {
    const st = proximoPasso(faladas, linhas, { consumido, ultimoIdx })
    consumido = st.consumido
    if (st.ultimoIdx === ultimoIdx) return
    ultimoIdx = st.ultimoIdx
    destacarLinha(ultimoIdx)
    enviar(ultimoIdx, confirmado)
  }

  function nivelAtual() {
    const buf = new Float32Array(analisador.fftSize)
    analisador.getFloatTimeDomainData(buf)
    let soma = 0
    for (let i = 0; i < buf.length; i++) soma += buf[i] * buf[i]
    const rms = Math.sqrt(soma / buf.length)
    return Math.min(1, rms * 3.5)
  }

  function medir() {
    if (!api.ativo || !analisador) return
    onNivel(nivelAtual())
    raf = requestAnimationFrame(medir)
  }

  function abrirMic() {
    if (mediaFalhou) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC || !navigator.mediaDevices?.getUserMedia) {
        mediaFalhou = true
        return
      }
      audioCtx = new AC()
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          stream = s
          const src = audioCtx.createMediaStreamSource(s)
          analisador = audioCtx.createAnalyser()
          analisador.fftSize = 1024
          analisador.smoothingTimeConstant = 0.55
          src.connect(analisador)
          medir()
        })
        .catch(() => {
          fecharMic()
          mediaFalhou = true
          onNivel(0)
        })
    } catch {
      mediaFalhou = true
    }
  }

  function fecharMic() {
    if (raf) {
      cancelAnimationFrame(raf)
      raf = null
    }
    analisador = null
    if (stream) {
      for (const t of stream.getTracks()) t.stop()
      stream = null
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {})
      audioCtx = null
    }
  }

  function pulsar() {
    if (!mediaFalhou) return
    onNivel(0.9)
    clearTimeout(timerPulso)
    timerPulso = setTimeout(() => onNivel(0), 450)
  }

  rec.onresult = (ev) => {
    const r = ev.results[ev.results.length - 1]
    const falado = r[0].transcript || ''
    const confirmado = r.isFinal
    pulsar()
    const novas = palavras(falado)
    const rec = reconstruirFaladas(faladas, finaisLen, consumido, uttLen, novas)
    faladas = rec.faladas
    consumido = rec.consumido
    uttLen = novas.length
    if (confirmado) finaisLen = faladas.length
    aceitarChunk(confirmado)
  }

  rec.onerror = () => {
    falhou = true
    api.ativo = false
    fecharMic()
    onNivel(0)
    onStatus(false)
  }

  rec.onend = () => {
    if (!falhou && api.ativo) rec.start()
  }

  function iniciar() {
    if (!api.disponivel || api.ativo || falhou) return
    api.ativo = true
    faladas = []
    finaisLen = 0
    uttLen = 0
    consumido = 0
    ultimoIdx = -1
    for (const el of linhaEl.values()) el.classList.remove('voz-atual')
    onStatus(true)
    abrirMic()
    try {
      rec.start()
    } catch {
      api.ativo = false
      onStatus(false)
    }
  }

  function parar() {
    if (!api.ativo) return
    api.ativo = false
    fecharMic()
    clearTimeout(timerPulso)
    onNivel(0)
    onStatus(false)
    try {
      rec.stop()
    } catch {}
  }

  return api
}