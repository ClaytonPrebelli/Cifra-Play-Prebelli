function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function palavrasVoz(fala) {
  return normalizar(fala).split(/[^a-z0-9]+/).filter(Boolean)
}

const ROLA = new Set(['rola', 'rolar', 'rolam', 'rolando', 'rola', 'rolaql'])
const BAIXO = new Set(['baixo', 'abaixo', 'desce', 'descer', 'descendo', 'desca', 'desça', 'pacoca', 'paçoca'])
const ALTO = new Set(['alto', 'acima', 'cima', 'sobe', 'subir', 'subindo', 'suba', 'jilo', 'jiló'])
const ATIVA = new Set(['ativa', 'ativar'])
const AGORA = new Set(['agora', 'já', 'ja'])
const FILA = new Set(['fila', 'proxima', 'proximo'])
const MUDA = new Set(['muda', 'mudar', 'toca', 'tocar', 'toque', 'poe', 'põe', 'bota'])
const SIM = new Set(['sim', 'isso', 'afirmativo'])
const SOLO = new Set(['pacoca', 'paçoca', 'jilo', 'jiló'])
const BUSCA = new Set(['busca', 'buscar'])

const CANCELA = new Set(['nao', 'não', 'cancelar', 'cancela', 'cancel', 'sair', 'sai', 'para', 'esquecer', 'esquece', 'volta', 'desativa', 'desativar'])

const FILLER = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'em', 'no', 'na', 'pra', 'para', 'página', 'pagina',
  'aí', 'ai', 'é', 'que', 'por', 'uma', 'um', 'as', 'os', 'aqui', 'lá', 'ta', 'tá',
])

const TIGA = new Set(['ativa', 'ativar', 'agora', 'já', 'ja', 'fila', 'proxima', 'proximo', 'muda', 'mudar', 'busca', 'buscar'])

function escanear(toks, gatilho, alvo, max = 6) {
  for (let i = 0; i < toks.length; i++) {
    if (!gatilho.has(toks[i])) continue
    let fim = -1
    for (let j = i + 1; j <= i + max && j < toks.length; j++) {
      const w = toks[j]
      if (alvo.has(w)) {
        fim = j
        break
      }
      if (!FILLER.has(w)) break
    }
    if (fim !== -1) return { i, fim }
  }
  return null
}

function rolaDe(toks) {
  const r = escanear(toks, ROLA, new Set([...BAIXO, ...ALTO]))
  if (!r) return null
  return BAIXO.has(toks[r.fim]) ? 'baixo' : 'alto'
}

function mudaProximaDe(toks) {
  const r = escanear(toks, MUDA, new Set(['proxima', 'proximo']))
  return Boolean(r)
}

function ativaDe(toks) {
  const r = escanear(toks, ATIVA, new Set([...AGORA, ...FILA, ...BUSCA]))
  if (!r) return null
  if (AGORA.has(toks[r.fim])) return { acao: 'agora', fim: r.fim }
  if (FILA.has(toks[r.fim])) return { acao: 'fila', fim: r.fim }
  return { acao: null, fim: r.fim }
}

export function trechoDe(toks) {
  let ini = 0
  while (ini < toks.length && (FILLER.has(toks[ini]) || TIGA.has(toks[ini]) || SIM.has(toks[ini]) || CANCELA.has(toks[ini]))) ini++
  const resto = toks.slice(ini)
  if (!resto.length) return null
  const limpos = resto.filter((t) => !FILLER.has(t))
  return limpos.length ? limpos.join(' ') : null
}

export function comandoDe(fala, estado = { modo: 'normal', acao: null }) {
  const toks = palavrasVoz(fala)
  if (!toks.length) return { comando: null, estado }

  if (estado.modo === 'pick') {
    if (toks.some((t) => SIM.has(t))) {
      return { comando: { tipo: 'sim' }, estado: { modo: 'normal', acao: null, fragmento: null } }
    }
    if (toks.some((t) => CANCELA.has(t))) {
      return { comando: { tipo: 'cancelar' }, estado: { modo: 'normal', acao: null, fragmento: null } }
    }
    const restante = toks.filter((t) => !FILLER.has(t))
    if (restante.length && restante.every((t) => ATIVA.has(t) || BUSCA.has(t))) {
      return { comando: { tipo: 'ativa' }, estado }
    }
    if (rolaDe(toks)) {
      return { comando: { tipo: 'rolar', direcao: rolaDe(toks) }, estado }
    }
    if (mudaProximaDe(toks)) {
      return { comando: { tipo: 'muda-proxima' }, estado }
    }
    const executarAgora = toks.some((t) => AGORA.has(t))
    const executarFila = toks.some((t) => FILA.has(t))
    if (executarAgora || executarFila) {
      if (estado.fragmento) {
        return {
          comando: { tipo: executarAgora ? 'agora' : 'fila', texto: estado.fragmento },
          estado: { modo: 'normal', acao: null, fragmento: null },
        }
      }
      return { comando: null, estado }
    }
    const trecho = trechoDe(toks)
    if (trecho) {
      if (estado.fragmento) {
        if (trecho.startsWith(estado.fragmento) && trecho.length > estado.fragmento.length) {
          return { comando: { tipo: 'fragmento', texto: trecho }, estado: { ...estado, fragmento: trecho } }
        }
        return { comando: null, estado }
      }
      return { comando: { tipo: 'fragmento', texto: trecho }, estado: { ...estado, fragmento: trecho } }
    }
    return { comando: null, estado }
  }

  const rolar = rolaDe(toks)
  if (rolar) return { comando: { tipo: 'rolar', direcao: rolar }, estado }
  if (toks.length === 1 && SOLO.has(toks[0])) {
    return { comando: { tipo: 'rolar', direcao: BAIXO.has(toks[0]) ? 'baixo' : 'alto' }, estado }
  }

  if (mudaProximaDe(toks)) return { comando: { tipo: 'muda-proxima' }, estado }
  if (toks.some((t) => ROLA.has(t))) return { comando: null, estado }

  const ativa = ativaDe(toks)
  if (ativa) {
    const resto = toks.slice(ativa.fim + 1)
    const trecho = trechoDe(resto)
    return {
      comando: { tipo: 'ativa', acao: ativa.acao },
      estado: { modo: 'pick', acao: ativa.acao },
      fragmentoInicial: trecho,
    }
  }

  return { comando: null, estado }
}

export function createComandosVoz({ onComando = () => {}, onStatus = () => {}, onNivel = () => {} } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const api = { ativo: false, disponivel: Boolean(SR), iniciar, parar }
  if (!SR) return api

  const rec = new SR()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = 'pt-BR'

  let estado = { modo: 'normal', acao: null }
  let falhou = false
  let ultimaChave = ''
  let ultimoFogo = 0

  let streamMic = null
  let analisador = null
  let raf = null

  function abrirMic() {
    if (!navigator.mediaDevices?.getUserMedia || analisador) return
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        streamMic = s
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        const src = ctx.createMediaStreamSource(s)
        analisador = ctx.createAnalyser()
        analisador.fftSize = 512
        analisador.smoothingTimeConstant = 0.5
        src.connect(analisador)
        medir()
      })
      .catch(() => {})
  }

  function medir() {
    if (!analisador) return
    const buf = new Float32Array(analisador.fftSize)
    analisador.getFloatTimeDomainData(buf)
    let soma = 0
    for (const v of buf) soma += v * v
    const rms = Math.sqrt(soma / buf.length)
    onNivel(Math.min(1, rms * 10))
    raf = requestAnimationFrame(medir)
  }

  function fecharMic() {
    if (raf) cancelAnimationFrame(raf)
    raf = null
    analisador = null
    if (streamMic) {
      for (const t of streamMic.getTracks()) t.stop()
      streamMic = null
    }
  }

  function iniciar() {
    if (!api.disponivel || api.ativo || falhou) return
    estado = { modo: 'normal', acao: null, fragmento: null }
    api.ativo = true
    onStatus(true)
    abrirMic()
    recumbir()
  }

  function recumbir() {
    try {
      rec.start()
    } catch {
      api.ativo = false
      onStatus(false)
      fecharMic()
      onNivel(0)
    }
  }

  function recomecar() {
    if (!falhou && api.ativo) {
      try {
        rec.start()
      } catch {
        api.ativo = false
        onStatus(false)
      }
    }
  }

  rec.onresult = (ev) => {
    if (!api.ativo) return
    const r = ev.results[ev.results.length - 1]
    const fala = r[0].transcript || ''
    const { comando, estado: novoEstado, fragmentoInicial } = comandoDe(fala, estado)
    estado = novoEstado

    const eventos = []
    if (comando) {
      const chave = JSON.stringify(comando)
      const agora = Date.now()
      const repetido = chave === ultimaChave && agora - ultimoFogo < 1400
      if (!repetido) {
        eventos.push(comando)
        ultimaChave = chave
        ultimoFogo = agora
      }
    }
    if (comando?.tipo === 'ativa' && fragmentoInicial) {
      eventos.push({ tipo: 'fragmento', texto: fragmentoInicial })
    }

    for (const e of eventos) onComando(e)
  }

  rec.onerror = () => {
    falhou = true
    api.ativo = false
    onStatus(false)
    fecharMic()
    onNivel(0)
  }

  rec.onend = recomecar

  function parar() {
    if (!api.ativo) return
    api.ativo = false
    onStatus(false)
    fecharMic()
    onNivel(0)
    try {
      rec.stop()
    } catch {}
  }

  return api
}
