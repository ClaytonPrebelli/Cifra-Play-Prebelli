import { getMusica, saveCatalog } from './api.js'
import { parseCifra } from './parser.js'
import { transporNota } from './transpositor.js'
import { renderShow, paginarRows } from './render.js'
import { createScroller } from './scroller.js'
import { createComandosVoz } from './comandosVoz.js'
import { ordemParaEstilo } from './app.js'

const PADRAO = { tomOffset: 0 }

let abrirFn = null

function norma(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

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
  const btnTomSalvar = document.getElementById('btn-tom-salvar')
  const btnProximoBloco = document.getElementById('btn-proximo-bloco')
  const btnProxima = document.getElementById('btn-proxima')
  const btnVoz = document.getElementById('btn-voz')
  const buscaEl = document.getElementById('show-busca-input')
  const resultadosEl = document.getElementById('show-busca-resultados')

  const scroller = createScroller(telaEl, cifraEl)

  function candidatosDeVoz(fr) {
    const q = norma(fr)
    if (!q) return []
    return state.catalog.filter((m) => norma(`${m.artista} ${m.titulo}`).includes(q))
  }

    function tratarVoz(e) {
    if (!state.atual) return
    if (e.tipo === 'rolar') {
      scroller.irPara(scroller.estado.ativa + (e.direcao === 'baixo' ? 1 : -1))
      return
    }
    if (e.tipo === 'muda-proxima') {
      proximaMusica()
      return
    }
    if (e.tipo === 'fragmento') {
      buscaEl.value = e.texto
      buscarMusicas()
      return
    }
    if (e.tipo === 'agora' || e.tipo === 'fila') {
      const [m] = candidatosDeVoz(e.texto)
      if (m) {
        if (e.tipo === 'agora') {
          fecharBusca(true)
          abrir(m)
        } else {
          colocarNaFila(m)
        }
      }
      return
    }
    if (e.tipo === 'sim') {
      const [m] = candidatosDeVoz(buscaEl.value)
      if (m) {
        fecharBusca(true)
        abrir(m)
      }
      return
    }
    if (e.tipo === 'cancelar') {
      fecharBusca(true)
      return
    }
    if (e.tipo === 'ativa') {
      if (buscaEl.hidden) buscaEl.hidden = false
      buscaEl.focus()
      buscaEl.select()
      return
    }
  }

  const voz = createComandosVoz({
    onComando: tratarVoz,
    onStatus: (ativo) => btnVoz.classList.toggle('ativo', Boolean(ativo)),
    onNivel: (n) => btnVoz.style.setProperty('--nivel', String(n)),
  })
  let timerSalvar = null
  let selBusca = -1

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
    const tomProx = prox?.tomBase ? ` · Tom ${prox.tomBase}` : ''
    btnProxima.textContent = prox ? `Próxima ▸ ${prox.titulo}${tomProx}` : 'Próxima ▸'
  }

  scroller.onPagina = (i) => {
    if (!state.atual) return
    state.atual.pagina = i
    atualizarControles()
  }

  function montarCifra(salvar, aoTopo = false, forcarVoz = false) {
    const p = prefsAtuais()
    const rows = [...renderShow(state.atual.modelo, { tomOffset: p.tomOffset }).children]
    const paginas = paginarRows(rows, {
      altura: scroller.altura(),
      largura: Math.max(1, cifraEl.clientWidth),
    })
    scroller.rebuild(paginas, aoTopo)
    // voz global (createComandosVoz) religado no initShow — comando tratado em tratarVoz(e)
    if (forcarVoz && voz && voz.disponivel && !voz.ativo) voz.iniciar()
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
      modo('show')
      montarCifra(true, true, true)
    } catch (err) {
      alert(`Erro ao abrir "${item.titulo}": ${err.message}`)
    }
  }

  function voltarLista() {
    modo('list')
    if (voz) voz.parar()
    btnVoz.classList.remove('ativo')
    btnVoz.style.setProperty('--nivel', '0')
    state.atual = null
    state.proxima = null
    fecharBusca(true)
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
  btnTomSalvar.addEventListener('click', () => {
    if (!state.atual) return
    const p = prefsAtuais()
    const disp = p.tomBase ? transporNota(p.tomBase, p.tomOffset) : null
    if (!disp) return
    const idx = state.catalog.findIndex((c) => c.id === state.atual.id)
    if (idx === -1) return
    state.catalog[idx].tomBase = disp
    state.atual.item.tomBase = disp
    state.atual.prefs = { tomOffset: 0 }
    montarCifra(true)
  })
  btnProximoBloco.addEventListener('click', () => scroller.irPara(scroller.estado.ativa + 1))
  btnProxima.addEventListener('click', proximaMusica)
  btnVoz.addEventListener('click', () => {
    if (!voz || !voz.disponivel) return
    if (voz.ativo) voz.parar()
    else voz.iniciar()
    btnVoz.classList.toggle('ativo', voz.ativo)
  })

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'show') return
    const tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || !document.getElementById('editor').hidden) return
    if (e.key === '/') {
      e.preventDefault()
      buscaEl.focus()
      buscaEl.select()
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

  function buscarMusicas() {
    const q = norma(buscaEl.value)
    if (!q) {
      resultadosEl.hidden = true
      return
    }
    const itens = state.catalog
      .filter((m) => norma(`${m.artista} ${m.titulo}`).includes(q))
      .slice(0, 8)
    resultadosEl.textContent = ''
    selBusca = -1
    if (itens.length === 0) {
      const p = document.createElement('p')
      p.className = 'show-busca-vazio'
      p.textContent = 'Nenhuma música encontrada.'
      resultadosEl.append(p)
      resultadosEl.hidden = false
      return
    }
    for (const m of itens) {
      const row = document.createElement('div')
      row.className = 'show-musica-resultado'
      const nome = document.createElement('span')
      nome.className = 'show-musica-nome'
      nome.textContent = m.artista ? `${m.artista} — ${m.titulo}` : m.titulo
      const btnAgora = document.createElement('button')
      btnAgora.type = 'button'
      btnAgora.className = 'btn show-musica-acao'
      btnAgora.title = 'Tocar agora'
      btnAgora.textContent = 'Agora'
      const btnFila = document.createElement('button')
      btnFila.type = 'button'
      btnFila.className = 'btn show-musica-acao'
      btnFila.title = 'Colocar como próxima do setlist'
      btnFila.textContent = 'Fila'
      row.append(nome, btnAgora, btnFila)
      row.addEventListener('click', (e) => {
        if (e.target !== btnFila) {
          fecharBusca(true)
          abrir(m)
        }
      })
      btnAgora.addEventListener('click', (e) => {
        e.stopPropagation()
        fecharBusca(true)
        abrir(m)
      })
      btnFila.addEventListener('click', (e) => {
        e.stopPropagation()
        colocarNaFila(m)
      })
      resultadosEl.append(row)
    }
    resultadosEl.hidden = false
  }

  function fecharBusca(limpar = false) {
    resultadosEl.hidden = true
    selBusca = -1
    if (limpar) buscaEl.value = ''
  }

  buscaEl.addEventListener('input', buscarMusicas)
  buscaEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharBusca(true)
      buscaEl.blur()
      return
    }
    const butoes = [...resultadosEl.querySelectorAll('.show-musica-resultado')]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (butoes.length === 0) return
      selBusca = e.key === 'ArrowDown'
        ? (selBusca + 1) % butoes.length
        : (selBusca - 1 + butoes.length) % butoes.length
      butoes.forEach((b, i) => b.classList.toggle('sel', i === selBusca))
      butoes[selBusca].scrollIntoView({ block: 'nearest' })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const alvo = selBusca >= 0 ? butoes[selBusca] : butoes[0]
      if (alvo) alvo.click()
    }
  })
  buscaEl.addEventListener('focus', () => {
    if (buscaEl.value) buscarMusicas()
  })
  document.addEventListener('click', (e) => {
    if (!document.getElementById('show-busca').contains(e.target)) fecharBusca()
  })

  function recomporProxima(ids) {
    if (!state.atual) return
    const atualId = state.atual.id
    const i = ids.indexOf(atualId)
    const proxId = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null
    state.proxima = proxId ? state.catalog.find((m) => m.id === proxId) || null : null
    state.atual.ordem = [...ids]
    atualizarControles()
  }

  function colocarNaFila(item) {
    if (!state.atual || item.id === state.atual.id) return
    const est = state.atual.estilo
    let ids
    if (est) {
      ids = ordemParaEstilo(state, est)
    } else {
      ids = state.catalog.map((m) => m.id)
    }
    const de = ids.indexOf(item.id)
    if (de === -1) return
    ids.splice(de, 1)
    const ref = ids.indexOf(state.atual.id)
    const alvo = ref === -1 ? 0 : ref + 1
    ids.splice(alvo, 0, item.id)
    if (est) {
      state.ordens[est] = ids
    } else {
      const porId = new Map(state.catalog.map((m) => [m.id, m]))
      state.catalog = ids.map((id) => porId.get(id)).filter(Boolean)
    }
    saveCatalog({ versoes: 1, musicas: state.catalog, ordens: state.ordens }).catch(() => {})
    window.dispatchEvent(new CustomEvent('cifra:lista-mudou'))
    recomporProxima(ids)
  }

  abrirFn = abrir
}