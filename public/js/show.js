import { getMusica, saveCatalog } from './api.js'
import { parseCifra } from './parser.js'
import { transporNota } from './transpositor.js'
import { renderShow, paginarRows } from './render.js'
import { createScroller } from './scroller.js'
import { ordemParaEstilo } from './app.js'

const PADRAO = { tomOffset: 0 }

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
  const btnTomMenos = document.getElementById('btn-tom-menos')
  const btnTomMais = document.getElementById('btn-tom-mais')
  const btnProximoBloco = document.getElementById('btn-proximo-bloco')
  const btnProxima = document.getElementById('btn-proxima')

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
      tomBase: m?.tomBase ?? state.atual?.modelo?.tom ?? null,
    }
  }

  function salvarPrefs() {
    if (!state.atual) return
    const idx = state.catalog.findIndex((c) => c.id === state.atual.id)
    if (idx === -1) return
    const p = prefsAtuais()
    state.catalog[idx].prefs = { tomOffset: p.tomOffset }
    clearTimeout(timerSalvar)
    timerSalvar = setTimeout(() => {
      saveCatalog({ versoes: 1, musicas: state.catalog }).catch(() => {})
    }, 400)
  }

  function proximaMusica() {
    if (!state.atual) return
    const prox = state.proxima
    if (prox) openShow(prox)
  }

  function atualizarControles() {
    const p = state.atual ? prefsAtuais() : PADRAO
    const base = p.tomBase
    const disp = base ? transporNota(base, p.tomOffset) : null
    tomEl.textContent = disp
      ? `${disp}${p.tomOffset ? ` (${p.tomOffset > 0 ? '+' : ''}${p.tomOffset})` : ''}`
      : '–'
    const noFim = scroller.estado.total <= 1 || scroller.estado.ativa >= scroller.estado.total - 1
    btnProximoBloco.hidden = !state.atual || noFim
    const prox = state.proxima
    btnProxima.hidden = !prox
    btnProxima.textContent = prox ? `Próxima ▸ ${prox.titulo}` : 'Próxima ▸'
  }

  scroller.onPagina = (i) => {
    if (!state.atual) return
    state.atual.pagina = i
    atualizarControles()
  }

  function montarCifra(salvar, aoTopo = false) {
    const p = prefsAtuais()
    const rows = [...renderShow(state.atual.modelo, { tomOffset: p.tomOffset }).children]
    const paginas = paginarRows(rows, {
      altura: scroller.altura(),
      largura: Math.max(1, cifraEl.clientWidth),
    })
    scroller.rebuild(paginas, aoTopo)
    if (salvar) salvarPrefs()
    atualizarControles()
  }

  async function abrir(item) {
    try {
      const data = await getMusica(item.id)
      const est = state.filters.estilos.length === 1 ? state.filters.estilos[0] : null
      const ordem = ordemParaEstilo(state, est)
      state.atual = {
        id: item.id,
        item,
        modelo: parseCifra(data.conteudo),
        ordem,
        estilo: est,
      }
      const i = ordem.indexOf(item.id)
      const proxId = i >= 0 && i < ordem.length - 1 ? ordem[i + 1] : null
      state.proxima = proxId ? state.catalog.find((m) => m.id === proxId) || null : null
      const p = prefsAtuais()
      const nome = item.artista ? `${item.artista} — ${item.titulo}` : item.titulo
      tituloEl.textContent = nome
      if (p.tomBase) {
        const tom = document.createElement('span')
        tom.textContent = ` · Tom ${p.tomBase}`
        tituloEl.append(tom)
      }
      if (item.capotraste) {
        const capo = document.createElement('span')
        capo.className = 'capo'
        capo.textContent = ` · Capo ${item.capotraste}ª casa`
        tituloEl.append(capo)
      }
      state.proxima = state.catalog[state.catalog.findIndex((c) => c.id === item.id) + 1] || null
      modo('show')
      montarCifra(true, true)
    } catch (err) {
      alert(`Erro ao abrir "${item.titulo}": ${err.message}`)
    }
  }

  function voltarLista() {
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
  btnProximoBloco.addEventListener('click', () => scroller.irPara(scroller.estado.ativa + 1))
  btnProxima.addEventListener('click', proximaMusica)

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'show') return
    const tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || !document.getElementById('editor').hidden) return
    if (e.key === 'ArrowRight') {
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