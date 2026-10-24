import { getMusica, saveCatalog } from './api.js'
import { parseCifra } from './parser.js'
import { transporTexto } from './transpositor.js'
import { renderShow, paginarRows, ajustarFonte } from './render.js'
import { createScroller } from './scroller.js'
import { ordemParaEstilo } from './app.js'
import { capitalize, nomeExibicao } from './texto.js'
import { createBarraLetras, casaLetra } from './letras.js'
import { PEDAL_PADRAO, acaoParaTecla, rotuloToken, tokenDeEvento, validarMapa } from './pedal.js'

const STORAGE_PEDAL = 'cifra-prebelli:pedal'

const PADRAO = { tomOffset: 0 }

let abrirFn = null

function norma(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function openShow(item, aoFim = false) {
  if (!abrirFn) return Promise.reject(new Error('modo show não inicializado'))
  return abrirFn(item, aoFim)
}

export function initShow(state) {
  const showEl = document.getElementById('show')
  const telaEl = document.getElementById('show-tela')
  const cifraEl = document.getElementById('show-cifra')
  const tituloEl = document.getElementById('show-titulo')
  const capoEl = document.getElementById('show-capo')
  const tomEl = document.getElementById('show-tom')
  const btnTomMenos = document.getElementById('btn-tom-menos')
  const btnTomMais = document.getElementById('btn-tom-mais')
  const btnTomSalvar = document.getElementById('btn-tom-salvar')
  const btnProximoBloco = document.getElementById('btn-proximo-bloco')
  const btnProxima = document.getElementById('btn-proxima')
  const buscaEl = document.getElementById('show-busca-input')
  const resultadosEl = document.getElementById('show-busca-resultados')

  const scroller = createScroller(telaEl, cifraEl)

  const filtroLetras = createBarraLetras({ onchange: aplicarLetra })
  document.getElementById('show-filtro-letra').append(filtroLetras.elemento)

  const btnLetras = document.getElementById('show-btn-letras')
  const letrasWrapEl = document.getElementById('show-filtro-letra-wrap')

  function alternarLetras(mostrar) {
    const abrir = mostrar ?? letrasWrapEl.hidden
    letrasWrapEl.hidden = !abrir
    btnLetras.setAttribute('aria-expanded', String(abrir))
    btnLetras.classList.toggle('ativo', abrir)
    if (abrir) {
      filtroLetras.elemento
        .querySelector('.letra-btn.ativa')
        ?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  }

  btnLetras.addEventListener('click', () => alternarLetras())

  function ordemFiltrada() {
    const est = state.filters.estilos.length === 1 ? state.filters.estilos[0] : null
    const porId = new Map(state.catalog.map((m) => [m.id, m]))
    return ordemParaEstilo(state, est).filter((id) => casaLetra(porId.get(id), state.filters.letra))
  }

  let timerSalvar = null
  let selBusca = -1

  function carregarMapaPedal() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_PEDAL) || 'null')
      return validarMapa(raw || PEDAL_PADRAO)
    } catch {
      return { ...PEDAL_PADRAO, descer: [...PEDAL_PADRAO.descer], subir: [...PEDAL_PADRAO.subir] }
    }
  }

  let mapaPedal = carregarMapaPedal()
  let aprendendo = null
  const historicoPedal = []
  const pedalEl = document.getElementById('pedal')
  const pedalSubirEl = document.getElementById('pedal-subir')
  const pedalDescerEl = document.getElementById('pedal-descer')
  const pedalLogEl = document.getElementById('pedal-log')
  const pedalStatusEl = document.getElementById('pedal-status')
  const btnPedalDescer = document.getElementById('btn-pedal-descer')
  const btnPedalSubir = document.getElementById('btn-pedal-subir')

  function mostrarMapaPedal() {
    pedalDescerEl.textContent = mapaPedal.descer.map(rotuloToken).join(' · ')
    pedalSubirEl.textContent = mapaPedal.subir.map(rotuloToken).join(' · ')
  }

  function salvarMapaPedal() {
    try {
      localStorage.setItem(STORAGE_PEDAL, JSON.stringify(mapaPedal))
    } catch {}
  }

  function abrirPedal() {
    aprendendo = null
    btnPedalDescer.classList.remove('ativo')
    btnPedalSubir.classList.remove('ativo')
    pedalEl.hidden = false
    mostrarMapaPedal()
    pedalStatusEl.textContent = 'Deixe esta janela aberta e pressione o pedal: o sinal aparece abaixo. Depois clique em Aprender para gravar cada pedal na ação.'
  }

  function fecharPedal() {
    pedalEl.hidden = true
    aprendendo = null
  }

  function registrarPedal(e) {
    const token = tokenDeEvento(e)
    historicoPedal.unshift(`key=${JSON.stringify(e.key)} code=${JSON.stringify(e.code)} keyCode=${e.keyCode ?? e.which} → ${rotuloToken(token)}`)
    pedalLogEl.textContent = historicoPedal.slice(0, 6).join('\n')
    if (!aprendendo) return
    const outra = aprendendo === 'descer' ? 'subir' : 'descer'
    mapaPedal[outra] = mapaPedal[outra].filter((t) => t !== token)
    if (!mapaPedal[aprendendo].includes(token)) mapaPedal[aprendendo].push(token)
    salvarMapaPedal()
    mostrarMapaPedal()
    pedalStatusEl.textContent = `${rotuloToken(token)} gravado em "${aprendendo === 'descer' ? 'Descer página' : 'Subir página'}".`
    aprendendo = null
    btnPedalDescer.classList.remove('ativo')
    btnPedalSubir.classList.remove('ativo')
  }

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
      saveCatalog({ versoes: 1, musicas: state.catalog, ordens: state.ordens }).catch(() => {})
    }, 400)
  }

  function proximaMusica() {
    if (!state.atual) return
    const prox = state.proxima
    if (prox) openShow(prox)
  }

  function avancarPedal() {
    if (!state.atual) return
    const noFim = scroller.estado.total <= 1 || scroller.estado.ativa >= scroller.estado.total - 1
    if (noFim) proximaMusica()
    else scroller.irPara(scroller.estado.ativa + 1)
  }

  function voltarPedal() {
    if (!state.atual) return
    if (scroller.estado.ativa <= 0 && state.anterior) openShow(state.anterior, true)
    else scroller.irPara(scroller.estado.ativa - 1)
  }

  function musicaAnterior() {
    if (!state.atual || !state.anterior) return
    openShow(state.anterior, true)
  }

  const SEGURAR_MS = 500
  const DUPLO_MS = 350
  const segurando = new Map()
  let ultimoToqueDescer = 0
  let ultimoToqueSubir = 0

  function aoSegurar(token, acao) {
    segurando.delete(token)
    if (segurando.size === 0) btnProximoBloco.classList.remove('segurando')
    if (acao === 'subir') musicaAnterior()
    else proximaMusica()
  }

  function armarSegurar(token, acao) {
    clearTimeout(segurando.get(token))
    segurando.set(token, setTimeout(() => aoSegurar(token, acao), SEGURAR_MS))
    if (acao === 'descer') btnProximoBloco.classList.add('segurando')
  }

  function desarmarSegurar(token) {
    clearTimeout(segurando.get(token))
    segurando.delete(token)
    if (segurando.size === 0) btnProximoBloco.classList.remove('segurando')
  }

  function atualizarControles() {
    const p = state.atual ? prefsAtuais() : PADRAO
    const base = p.tomBase
    const disp = base ? transporTexto(base, p.tomOffset) : null
    tomEl.textContent = disp
      ? `${disp}${p.tomOffset ? ` (${p.tomOffset > 0 ? '+' : ''}${p.tomOffset})` : ''}`
      : '–'
    const noFim = scroller.estado.total <= 1 || scroller.estado.ativa >= scroller.estado.total - 1
    btnProximoBloco.hidden = !state.atual || noFim
    const prox = state.proxima
    btnProxima.hidden = !prox
    const offProx = prox?.prefs?.tomOffset ?? 0
    const efProx = prox?.tomBase && offProx ? transporTexto(prox.tomBase, offProx) ?? prox.tomBase : prox?.tomBase
    const tomProx = efProx ? ` · Tom ${efProx}` : ''
    btnProxima.textContent = prox ? `Próxima ▸ ${capitalize(prox.titulo)}${tomProx}` : 'Próxima ▸'
  }

  scroller.onPagina = (i) => {
    if (!state.atual) return
    state.atual.pagina = i
    atualizarControles()
  }

  function atualizarTitulo() {
    const item = state.atual?.item
    if (!item) return
    const titulo = nomeExibicao(item.artista, item.titulo)
    tituloEl.textContent = titulo
    tituloEl.title = titulo
    const p = prefsAtuais()
    const disp = p.tomBase ? transporTexto(p.tomBase, p.tomOffset) : null
    capoEl.textContent = ''
    if (disp) {
      const tom = document.createElement('span')
      tom.className = 'tom-destaque'
      tom.textContent = `Tom ${disp}`
      capoEl.append(tom)
    }
    if (item.capotraste) {
      if (capoEl.hasChildNodes()) capoEl.append(document.createTextNode(' - '))
      const capo = document.createElement('span')
      capo.className = 'capo-destaque'
      capo.textContent = `Capo ${item.capotraste}ª casa`
      capoEl.append(capo)
    }
    capoEl.hidden = !capoEl.hasChildNodes()
  }

  function montarCifra(salvar, aoTopo = false) {
    const p = prefsAtuais()
    const largura = Math.max(1, cifraEl.clientWidth)
    const rows = [...renderShow(state.atual.modelo, { tomOffset: p.tomOffset }).children]
    const fontSize = ajustarFonte(cifraEl, rows, largura)
    const paginas = paginarRows(rows, { altura: scroller.altura(), largura, fontSize })
    scroller.rebuild(paginas, aoTopo)
    if (salvar) salvarPrefs()
    atualizarTitulo()
    atualizarControles()
  }

  async function abrir(item, aoFim = false) {
    try {
      const data = await getMusica(item.id)
      const est = state.filters.estilos.length === 1 ? state.filters.estilos[0] : null
      filtroLetras.setValor(state.filters.letra)
      state.filters.letra = filtroLetras.atualizarDisponiveis(state.catalog)
      const ordem = ordemFiltrada()
      state.atual = {
        id: item.id,
        item,
        prefs: { tomOffset: item.prefs?.tomOffset ?? PADRAO.tomOffset },
        modelo: parseCifra(data.conteudo),
        ordem,
        estilo: est,
      }
      const i = ordem.indexOf(item.id)
      const proxId = i >= 0 && i < ordem.length - 1 ? ordem[i + 1] : null
      state.proxima = proxId ? state.catalog.find((m) => m.id === proxId) || null : null
      const antId = i > 0 ? ordem[i - 1] : null
      state.anterior = antId ? state.catalog.find((m) => m.id === antId) || null : null
      modo('show')
      alternarLetras(false)
      montarCifra(true, true)
      if (aoFim) scroller.irPara(scroller.estado.total - 1, 0)
    } catch (err) {
      alert(`Erro ao abrir "${item.titulo}": ${err.message}`)
    }
  }

  function voltarLista() {
    modo('list')
    alternarLetras(false)
    state.atual = null
    state.proxima = null
    state.anterior = null
    fecharBusca(true)
    cifraEl.textContent = ''
    tituloEl.textContent = 'Modo show'
    tituloEl.title = ''
    capoEl.textContent = ''
    capoEl.hidden = true
    scroller.rebuild([])
  }

  function mudarTom(delta) {
    if (!state.atual) return
    state.atual.prefs = prefsAtuais()
    state.atual.prefs.tomOffset += delta
    montarCifra(true)
    window.dispatchEvent(new CustomEvent('cifra:lista-mudou'))
  }

  window.addEventListener('resize', () => {
    if (state.mode === 'show' && state.atual) montarCifra(false)
  })

  document.getElementById('show-voltar').addEventListener('click', voltarLista)
  btnTomMenos.addEventListener('click', () => mudarTom(-1))
  btnTomMais.addEventListener('click', () => mudarTom(1))
  btnTomSalvar.addEventListener('click', () => {
    if (!state.atual) return
    const p = prefsAtuais()
    const disp = p.tomBase ? transporTexto(p.tomBase, p.tomOffset) : null
    if (!disp) return
    const idx = state.catalog.findIndex((c) => c.id === state.atual.id)
    if (idx === -1) return
    state.catalog[idx].tomBase = disp
    state.atual.item.tomBase = disp
    state.atual.prefs = { tomOffset: 0 }
    montarCifra(true)
    window.dispatchEvent(new CustomEvent('cifra:lista-mudou'))
  })
  let holdBlocoTimer = 0
  let holdBlocoDisparou = false
  let ultimoCliqueBloco = 0
  btnProximoBloco.style.setProperty('--hold-ms', `${SEGURAR_MS}ms`)
  btnProximoBloco.addEventListener('pointerdown', () => {
    holdBlocoDisparou = false
    clearTimeout(holdBlocoTimer)
    btnProximoBloco.classList.add('segurando')
    holdBlocoTimer = setTimeout(() => {
      holdBlocoDisparou = true
      btnProximoBloco.classList.remove('segurando')
      proximaMusica()
    }, SEGURAR_MS)
  })
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btnProximoBloco.addEventListener(ev, () => {
    clearTimeout(holdBlocoTimer)
    btnProximoBloco.classList.remove('segurando')
  })
  btnProximoBloco.addEventListener('contextmenu', (e) => e.preventDefault())
  btnProximoBloco.addEventListener('click', () => {
    clearTimeout(holdBlocoTimer)
    if (holdBlocoDisparou) {
      holdBlocoDisparou = false
      return
    }
    const agora = Date.now()
    if (agora - ultimoCliqueBloco < DUPLO_MS) {
      ultimoCliqueBloco = 0
      proximaMusica()
      return
    }
    ultimoCliqueBloco = agora
    scroller.irPara(scroller.estado.ativa + 1)
  })
  btnProxima.addEventListener('click', proximaMusica)
  document.getElementById('btn-pedal').addEventListener('click', abrirPedal)
  document.getElementById('btn-pedal-fechar').addEventListener('click', fecharPedal)
  btnPedalDescer.addEventListener('click', () => {
    aprendendo = 'descer'
    btnPedalDescer.classList.add('ativo')
    btnPedalSubir.classList.remove('ativo')
    btnPedalDescer.blur()
    pedalStatusEl.textContent = 'Pressione o pedal da DESCIDA agora…'
  })
  btnPedalSubir.addEventListener('click', () => {
    aprendendo = 'subir'
    btnPedalSubir.classList.add('ativo')
    btnPedalDescer.classList.remove('ativo')
    btnPedalSubir.blur()
    pedalStatusEl.textContent = 'Pressione o pedal da SUBIDA agora…'
  })
  document.getElementById('btn-pedal-inverter').addEventListener('click', (e) => {
    const { descer, subir } = mapaPedal
    mapaPedal = { descer: subir, subir: descer }
    salvarMapaPedal()
    mostrarMapaPedal()
    pedalStatusEl.textContent = 'Pedais invertidos.'
    e.currentTarget.blur()
  })
  document.getElementById('btn-pedal-padrao').addEventListener('click', () => {
    mapaPedal = { ...PEDAL_PADRAO, descer: [...PEDAL_PADRAO.descer], subir: [...PEDAL_PADRAO.subir] }
    salvarMapaPedal()
    mostrarMapaPedal()
    pedalStatusEl.textContent = 'Mapa padrão restaurado.'
  })

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'show' || pedalEl.hidden) return
    if (e.key === 'Escape') fecharPedal()
    else if (!e.repeat) registrarPedal(e)
    e.preventDefault()
    e.stopPropagation()
  }, true)

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'show') return
    if (!pedalEl.hidden) return
    const tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea') return
    if (!document.getElementById('editor').hidden || !document.getElementById('importar').hidden) return
    if (e.key === '/') {
      e.preventDefault()
      buscaEl.focus()
      buscaEl.select()
    } else if (e.key === 'Escape') {
      voltarLista()
    } else {
      if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault()
        proximaMusica()
        return
      }
      const token = tokenDeEvento(e)
      const acao = acaoParaTecla(token, mapaPedal)
      if (acao === 'descer') {
        e.preventDefault()
        if (document.activeElement?.blur) document.activeElement.blur()
        if (e.repeat) return
        const agora = Date.now()
        const noFim = scroller.estado.total <= 1 || scroller.estado.ativa >= scroller.estado.total - 1
        avancarPedal()
        if (noFim) ultimoToqueDescer = 0
        else if (agora - ultimoToqueDescer < DUPLO_MS) {
          ultimoToqueDescer = 0
          desarmarSegurar(token)
          proximaMusica()
        } else {
          ultimoToqueDescer = agora
          armarSegurar(token, acao)
        }
      } else if (acao === 'subir') {
        e.preventDefault()
        if (document.activeElement?.blur) document.activeElement.blur()
        if (e.repeat) return
        const agora = Date.now()
        const noTopo = scroller.estado.ativa <= 0
        const mudou = noTopo && state.anterior
        voltarPedal()
        if (mudou) ultimoToqueSubir = 0
        else if (agora - ultimoToqueSubir < DUPLO_MS) {
          ultimoToqueSubir = 0
          desarmarSegurar(token)
          musicaAnterior()
        } else {
          ultimoToqueSubir = agora
          armarSegurar(token, acao)
        }
      }
    }
  })

  document.addEventListener('keyup', (e) => {
    if (state.mode !== 'show') return
    desarmarSegurar(tokenDeEvento(e))
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
    renderResultados(itens)
  }

  function renderResultados(itens) {
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
      nome.textContent = nomeExibicao(m.artista, m.titulo)
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

  function mostrarLetra(letra) {
    renderResultados(state.catalog.filter((m) => casaLetra(m, letra)))
  }

  function aplicarLetra(letra) {
    state.filters.letra = letra
    recomporProxima(ordemFiltrada())
    if (letra) {
      buscaEl.value = ''
      mostrarLetra(letra)
    } else {
      fecharBusca(true)
    }
    window.dispatchEvent(new CustomEvent('cifra:lista-mudou'))
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
    if (
      !document.getElementById('show-busca').contains(e.target) &&
      !filtroLetras.elemento.contains(e.target)
    )
      fecharBusca()
  })

  function recomporProxima(ids) {
    if (!state.atual) return
    const atualId = state.atual.id
    const i = ids.indexOf(atualId)
    const proxId = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null
    state.proxima = proxId ? state.catalog.find((m) => m.id === proxId) || null : null
    const antId = i > 0 ? ids[i - 1] : null
    state.anterior = antId ? state.catalog.find((m) => m.id === antId) || null : null
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
    recomporProxima(ordemFiltrada())
  }

  filtroLetras.setValor(state.filters.letra)
  filtroLetras.atualizarDisponiveis(state.catalog)
  abrirFn = abrir
}