import { getMusica, saveCatalog } from './api.js'
import { parseCifra } from './parser.js'
import { transporNota } from './transpositor.js'
import { renderShow, paginarRows } from './render.js'
import { createScroller } from './scroller.js'

const PADRAO = { tomOffset: 0, velocidade: 3, rolagem: true }

let abrirFn = null

export function openShow(item) {
  if (!abrirFn) return Promise.reject(new Error('modo show não inicializado'))
  return abrirFn(item)
}

export function initShow(state) {
  const showEl = document.getElementById('show')
  const telaEl = document.getElementById('show-tela')
  const cifraEl = document.getElementById('show-cifra')
  const tituloEl = document.getElementById('show-titulo')
  const tomEl = document.getElementById('show-tom')
  const velEl = document.getElementById('show-vel')
  const btnTomMenos = document.getElementById('btn-tom-menos')
  const btnTomMais = document.getElementById('btn-tom-mais')
  const btnVelMenos = document.getElementById('btn-vel-menos')
  const btnVelMais = document.getElementById('btn-vel-mais')
  const btnRolagem = document.getElementById('btn-rolagem')
  const btnProxima = document.getElementById('btn-proxima')
  const fimEl = document.getElementById('show-fim')
  const fimTextoEl = document.getElementById('show-fim-texto')
  const btnFimProxima = document.getElementById('btn-fim-proxima')

  const scroller = createScroller(telaEl, cifraEl)
  let timerSalvar = null

  function modo(mode) {
    state.mode = mode
    document.getElementById('lista').hidden = mode !== 'list'
    showEl.hidden = mode !== 'show'
  }

  function prefsAtuais() {
    const m = state.atual?.item
    const prefs = state.atual?.prefs
    return {
      tomOffset: prefs?.tomOffset ?? PADRAO.tomOffset,
      velocidade: prefs?.velocidade ?? PADRAO.velocidade,
      rolagem: prefs?.rolagem ?? PADRAO.rolagem,
      tomBase: m?.tomBase ?? state.atual?.modelo?.tom ?? null,
    }
  }

  function salvarPrefs() {
    if (!state.atual) return
    const idx = state.catalog.findIndex((c) => c.id === state.atual.id)
    if (idx === -1) return
    const p = prefsAtuais()
    state.catalog[idx].prefs = {
      tomOffset: p.tomOffset, velocidade: p.velocidade, rolagem: p.rolagem,
    }
    clearTimeout(timerSalvar)
    timerSalvar = setTimeout(() => {
      saveCatalog({ versoes: 1, musicas: state.catalog }).catch(() => {})
    }, 400)
  }

  function proximaMusica() {
    if (!state.atual) return
    const idx = state.catalog.findIndex((c) => c.id === state.atual.id)
    const prox = state.catalog[idx + 1]
    if (prox) openShow(prox)
  }

  function atualizarControles() {
    const p = state.atual ? prefsAtuais() : PADRAO
    const base = p.tomBase
    const disp = base ? transporNota(base, p.tomOffset) : null
    tomEl.textContent = disp
      ? `${disp}${p.tomOffset ? ` (${p.tomOffset > 0 ? '+' : ''}${p.tomOffset})` : ''}`
      : '–'
    velEl.textContent = `${p.velocidade}s`
    btnRolagem.textContent = scroller.estado.rolando ? 'Pausar' : 'Retomar'
    fimEl.hidden = !state.atual || scroller.estado.total <= 1 ||
      scroller.estado.ativa < scroller.estado.total - 1
    const prox = state.proxima
    btnProxima.hidden = !prox
    btnProxima.textContent = prox ? `Próxima ▸ ${prox.titulo}` : 'Próxima ▸'
    fimTextoEl.textContent = prox
      ? `Fim de "${state.atual?.item?.titulo}" — próxima: ${prox.titulo}.`
      : ''
    btnFimProxima.textContent = prox ? `Próxima música → ${prox.titulo}` : 'Voltar para a lista'
  }

  scroller.onPagina = (i) => {
    if (!state.atual) return
    state.atual.pagina = i
    i >= scroller.estado.total - 1 ? scroller.pausar() : scroller.retomar()
    atualizarControles()
  }

  function montarCifra(salvar) {
    const p = prefsAtuais()
    scroller.velocidade = p.velocidade
    const rows = [...renderShow(state.atual.modelo, { tomOffset: p.tomOffset }).children]
    const paginas = paginarRows(rows, {
      altura: scroller.altura(),
      largura: Math.max(1, cifraEl.clientWidth),
    })
    scroller.rebuild(paginas)
    if (salvar) salvarPrefs()
    atualizarControles()
  }

  async function abrir(item) {
    try {
      const data = await getMusica(item.id)
      state.atual = {
        id: item.id,
        item,
        modelo: parseCifra(data.conteudo),
      }
      const p = prefsAtuais()
      scroller.velocidade = p.velocidade
      const nome = item.artista ? `${item.artista} — ${item.titulo}` : item.titulo
      tituloEl.textContent = p.tomBase ? `${nome} · Tom ${p.tomBase}` : nome
      state.proxima = state.catalog[state.catalog.findIndex((c) => c.id === item.id) + 1] || null
      modo('show')
      montarCifra(true)
      if (p.rolagem) scroller.retomar()
    } catch (err) {
      alert(`Erro ao abrir "${item.titulo}": ${err.message}`)
    }
  }

  function voltarLista() {
    scroller.pausar()
    modo('list')
    state.atual = null
    state.proxima = null
    cifraEl.textContent = ''
    scroller.rebuild([])
  }

  function aoMudarProp() {
    if (!state.atual) return
    montarCifra(true)
  }

  window.addEventListener('resize', () => {
    if (state.mode === 'show' && state.atual) montarCifra(false)
  })

  document.getElementById('show-voltar').addEventListener('click', voltarLista)
  btnTomMenos.addEventListener('click', () => { state.atual.prefs = prefsAtuais(); state.atual.prefs.tomOffset -= 1; aoMudarProp() })
  btnTomMais.addEventListener('click', () => { state.atual.prefs = prefsAtuais(); state.atual.prefs.tomOffset += 1; aoMudarProp() })
  btnVelMenos.addEventListener('click', () => { state.atual.prefs = prefsAtuais(); state.atual.prefs.velocidade -= 1; aoMudarProp() })
  btnVelMais.addEventListener('click', () => { state.atual.prefs = prefsAtuais(); state.atual.prefs.velocidade += 1; aoMudarProp() })
  btnRolagem.addEventListener('click', () => { scroller.alternar(); atualizarControles() })
  btnProxima.addEventListener('click', proximaMusica)
  btnFimProxima.addEventListener('click', () => {
    state.proxima ? proximaMusica() : voltarLista()
  })

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'show') return
    const tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || !document.getElementById('editor').hidden) return
    if (e.key === ' ') {
      e.preventDefault()
      scroller.alternar()
      atualizarControles()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (e.shiftKey) proximaMusica()
      else scroller.irPara(scroller.estado.ativa + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      scroller.irPara(scroller.estado.ativa - 1)
    } else if (e.key === 'Escape') {
      voltarLista()
    }
  })

  abrirFn = abrir
}