import { getCatalog, getMusica, putMusica, deleteMusica, saveCatalog } from './api.js'
import { createMultiselect } from './multiselect.js'
import { openShow } from './show.js'
import { ordemParaEstilo } from './app.js'
import { createBarraLetras, casaLetra } from './letras.js'
import { transporTexto } from './transpositor.js'
import { capitalize, nomeExibicao } from './texto.js'

const TEMA_STORAGE_KEY = 'cifra-prebelli:tema'

const ESTILOS_PADRAO = [
  'Internacional',
  'Românticas',
  'MPB',
  'Rock',
  'Sertanejo Universitário',
  'Sertanejo Romântico',
  'Moda',
  'Xote/Forró',
  'Pagode/Samba',
]

function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function tomEfetivo(m) {
  const off = m.prefs?.tomOffset ?? 0
  if (m.tomBase && off) return transporTexto(m.tomBase, off) ?? m.tomBase
  return m.tomBase ?? ''
}

function fmtDuracao(seg) {
  if (!Number.isInteger(seg) || seg < 0) return ''
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
}

function parseDuracao(txt) {
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec((txt || '').trim())
  if (!m) return undefined
  return Number(m[1]) * 60 + Number(m[2])
}

function fmtTotal(seg) {
  if (!(seg > 0)) return ''
  const h = Math.floor(seg / 3600)
  const min = Math.floor((seg % 3600) / 60)
  if (h) return `${h} h ${String(min).padStart(2, '0')}`
  return `${min} min`
}

function resumoDe(items) {
  const n = items.length
  const base = `${n} ${n === 1 ? 'música' : 'músicas'}`
  let total = 0
  let sem = 0
  for (const m of items) {
    if (Number.isInteger(m.duracao) && m.duracao >= 0) total += m.duracao
    else sem += 1
  }
  if (!total) return n ? `${base} · tempos não lançados` : base
  return `${base} · ${fmtTotal(total)}${sem ? ` · ${sem} sem tempo` : ''}`
}

function fileNameFrom(artista, titulo) {
  const a = (artista || '').trim()
  const t = (titulo || '').trim() || 'Sem título'
  const base = a ? `${a} - ${t}` : t
  return base.replace(/[\\/:*?"<>|]/g, '-') + '.txt'
}

function fillFromFile(file) {
  const base = file.name.replace(/\.txt$/i, '')
  const sep = base.indexOf(' - ')
  document.getElementById('ed-artista').value = sep === -1 ? '' : base.slice(0, sep).trim()
  document.getElementById('ed-titulo').value = (sep === -1 ? base : base.slice(sep + 3)).trim()
  return decodeFile(file)
}

function decodeFile(file) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder('windows-1252').decode(bytes)
    }
  })
}

function applyTema(tema) {
  document.body.dataset.tema = tema
  document.getElementById('btn-tema').textContent = tema === 'claro' ? 'Escuro' : 'Claro'
}

export function initList(state) {
  const listEl = document.getElementById('lista-musicas')
  const vaziaEl = document.getElementById('lista-vazia')
  const buscaEl = document.getElementById('busca')
  const abasEl = document.getElementById('abas-estilos')
  const btnAdicionar = document.getElementById('btn-adicionar')
  const btnTema = document.getElementById('btn-tema')
  const editorEl = document.getElementById('editor')
  const textoEl = document.getElementById('ed-texto')
  const artistEl = document.getElementById('ed-artista')
  const tituloEl = document.getElementById('ed-titulo')
  const tomEl = document.getElementById('ed-tom')
  const duracaoEl = document.getElementById('ed-duracao')
  const resumoEl = document.getElementById('lista-resumo')
  const capoEl = document.getElementById('ed-capo')
  const statusEl = document.getElementById('editor-status')
  const btnSalvar = document.getElementById('btn-salvar')
  const btnCancelar = document.getElementById('btn-cancelar')
  const btnArquivo = document.getElementById('btn-arquivo')
  const arquivoEl = document.getElementById('ed-arquivo')
  const edEstilosWrapEl = document.getElementById('ed-estilos-wrap')

  let editId = null

  function filtroEstiloAtivo() {
    return state.filters.estilos.length === 1 ? state.filters.estilos[0] : null
  }

  function moverItem(idArrastado, idAlvo, depois) {
    const est = filtroEstiloAtivo()
    if (est) {
      const lista = ordemParaEstilo(state, est)
      return moverNaLista(lista, idArrastado, idAlvo, depois, (l) => {
        state.ordens[est] = l
      })
    }
    return moverNaLista(state.catalog, idArrastado, idAlvo, depois, (l) => {
      state.catalog = l
    })
  }

  function moverParaFim(idArrastado) {
    const est = filtroEstiloAtivo()
    if (est) {
      const lista = ordemParaEstilo(state, est)
      const de = lista.indexOf(idArrastado)
      if (de === -1) return false
      const [item] = lista.splice(de, 1)
      lista.push(item)
      state.ordens[est] = lista
      return true
    }
    const de = state.catalog.findIndex((m) => m.id === idArrastado)
    if (de === -1) return false
    const [item] = state.catalog.splice(de, 1)
    state.catalog.push(item)
    return true
  }

  function moverNaLista(lista, idArrastado, idAlvo, depois, aplicar) {
    const ids = lista.map((m) => (typeof m === 'string' ? m : m.id))
    const de = ids.indexOf(idArrastado)
    const alvo = ids.indexOf(idAlvo)
    if (de === -1 || alvo === -1 || de === alvo) return false
    const [item] = lista.splice(de, 1)
    const para = ids.indexOf(idAlvo) + (depois ? 1 : 0)
    lista.splice(para, 0, item)
    aplicar(lista)
    return true
  }

  async function persistirOrdem() {
    try {
      await saveCatalog({ versoes: 1, musicas: state.catalog, ordens: state.ordens })
    } catch (err) {
      console.error('erro ao salvar ordem', err)
    }
  }

  function limparIndicadores() {
    listEl.querySelectorAll('.dragging, .drop-before, .drop-after')
      .forEach((el) => el.classList.remove('dragging', 'drop-before', 'drop-after'))
  }

  function fecharMenus() {
    listEl.querySelectorAll('.acoes-menu:not([hidden])').forEach((menu) => {
      menu.hidden = true
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false')
    })
  }

  async function removerMusica(m) {
    if (!confirm(`Remover "${m.titulo}"?`)) return
    await deleteMusica(m.id)
    const data = await getCatalog()
    state.catalog = data.musicas
    state.ordens = data.ordens || {}
    refresh()
  }

  function configurarDnd() {
    let dragId = null
    listEl.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.musica-item')
      if (!li) return
      dragId = li.dataset.id
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', dragId)
      requestAnimationFrame(() => li.classList.add('dragging'))
    })
    listEl.addEventListener('dragover', (e) => {
      if (!dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      limparIndicadores()
      const li = e.target.closest('.musica-item')
      if (!li || li.dataset.id === dragId) return
      const r = li.getBoundingClientRect()
      const depois = e.clientY - r.top > r.height / 2
      li.classList.add(depois ? 'drop-after' : 'drop-before')
    })
    listEl.addEventListener('dragleave', (e) => {
      if (!e.relatedTarget || !listEl.contains(e.relatedTarget)) limparIndicadores()
    })
    listEl.addEventListener('drop', (e) => {
      e.preventDefault()
      if (!dragId) return
      const li = e.target.closest('.musica-item')
      let mexeu = false
      if (li) {
        if (li.dataset.id !== dragId) {
          const depois = li.classList.contains('drop-after')
          mexeu = moverItem(dragId, li.dataset.id, depois)
        }
      } else {
        mexeu = moverParaFim(dragId)
      }
      if (mexeu) {
        persistirOrdem()
        refresh()
      }
      dragId = null
      limparIndicadores()
    })
    listEl.addEventListener('dragend', () => {
      dragId = null
      limparIndicadores()
    })
  }

  function estilosDaLista() {
    const set = new Set()
    for (const m of state.catalog) {
      for (const s of m.estilos || []) set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  function estilosSugeridos() {
    const set = new Set(ESTILOS_PADRAO)
    for (const m of state.catalog) {
      for (const s of m.estilos || []) set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  function renderAbas() {
    const estilos = estilosDaLista()
    const atual = filtroEstiloAtivo()
    if (atual && !estilos.includes(atual)) state.filters.estilos = []
    const ativo = filtroEstiloAtivo()
    abasEl.textContent = ''
    const todas = document.createElement('button')
    todas.type = 'button'
    todas.className = 'aba'
    todas.setAttribute('role', 'tab')
    todas.textContent = `Todas (${state.catalog.length})`
    todas.setAttribute('aria-selected', String(!ativo))
    if (!ativo) todas.classList.add('ativa')
    todas.addEventListener('click', () => {
      state.filters.estilos = []
      renderAbas()
      render()
    })
    abasEl.append(todas)
    const contagem = new Map()
    for (const m of state.catalog) {
      for (const s of m.estilos || []) contagem.set(s, (contagem.get(s) ?? 0) + 1)
    }
    for (const est of estilos) {
      const aba = document.createElement('button')
      aba.type = 'button'
      aba.className = 'aba'
      aba.setAttribute('role', 'tab')
      aba.textContent = `${est} (${contagem.get(est) ?? 0})`
      aba.setAttribute('aria-selected', String(ativo === est))
      if (ativo === est) aba.classList.add('ativa')
      aba.addEventListener('click', () => {
        state.filters.estilos = [est]
        renderAbas()
        render()
      })
      abasEl.append(aba)
    }
  }

  const filtroLetras = createBarraLetras({
    onchange: (letra) => {
      state.filters.letra = letra
      render()
    },
  })
  document.getElementById('filtro-letra').append(filtroLetras.elemento)

  const btnLetras = document.getElementById('btn-letras')
  const letrasWrapEl = document.getElementById('filtro-letra-wrap')
  btnLetras.addEventListener('click', () => {
    letrasWrapEl.hidden = !letrasWrapEl.hidden
    btnLetras.setAttribute('aria-expanded', String(!letrasWrapEl.hidden))
    btnLetras.classList.toggle('ativo', !letrasWrapEl.hidden)
    if (!letrasWrapEl.hidden) {
      filtroLetras.elemento
        .querySelector('.letra-btn.ativa')
        ?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  })

  const editorEstilos = createMultiselect({
    textoVazio: 'Selecionar estilos…',
    inline: true,
    placeholderAdd: 'Novo estilo…',
    opcoesIniciais: estilosSugeridos(),
  })
  edEstilosWrapEl.append(editorEstilos.elemento)

  function render() {
    const q = norm(state.filters.busca)
    const estilosSelecionados = state.filters.estilos
    const est = filtroEstiloAtivo()
    let items = state.catalog.filter((m) => {
      if (q && !norm(`${m.artista} ${m.titulo}`).includes(q)) return false
      if (!casaLetra(m, state.filters.letra)) return false
      if (
        estilosSelecionados.length &&
        !(m.estilos || []).some((s) => estilosSelecionados.includes(s))
      )
        return false
      return true
    })
    if (est) {
      const ordem = ordemParaEstilo(state, est)
      const pos = new Map(ordem.map((id, i) => [id, i]))
      items = [...items].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity))
    }
    listEl.textContent = ''
    vaziaEl.textContent = ''
    resumoEl.textContent = resumoDe(items)
    if (items.length === 0) {
      vaziaEl.textContent =
        state.catalog.length === 0
          ? 'Catálogo vazio — clique em Adicionar, arraste arquivos ou coloque .txt em musicas/.'
          : 'Nenhuma música encontrada.'
    }
    for (const m of items) {
      const li = document.createElement('li')
      li.className = 'musica-item'
      li.dataset.id = m.id
      li.draggable = true

      const info = document.createElement('div')
      info.className = 'musica-info'

      const nome = document.createElement('span')
      nome.className = 'musica-nome'
      nome.textContent = capitalize(m.titulo)
      nome.title = nomeExibicao(m.artista, m.titulo)

      const meta = document.createElement('span')
      meta.className = 'musica-meta'
      const tom = tomEfetivo(m)
      meta.textContent = ''
      const partes = []
      if (tom) partes.push([`Tom ${tom}`, 'meta-tom'])
      const dur = fmtDuracao(m.duracao)
      if (dur) partes.push([dur, 'meta-tempo'])
      const est = (m.estilos || []).join(' · ')
      if (est) partes.push([est, 'meta-est'])
      partes.forEach(([txt, cls], i) => {
        if (i) meta.append(' · ')
        const s = document.createElement('span')
        s.className = cls
        s.textContent = txt
        meta.append(s)
      })

      info.append(nome, meta)

      const acoesWrap = document.createElement('div')
      acoesWrap.className = 'acoes-wrap'
      const btnAcoes = document.createElement('button')
      btnAcoes.type = 'button'
      btnAcoes.className = 'btn acoes-btn'
      btnAcoes.textContent = '⋮'
      btnAcoes.title = 'Ações'
      btnAcoes.setAttribute('aria-haspopup', 'menu')
      btnAcoes.setAttribute('aria-expanded', 'false')
      const menu = document.createElement('div')
      menu.className = 'acoes-menu'
      menu.setAttribute('role', 'menu')
      menu.hidden = true
      const itemEditar = document.createElement('button')
      itemEditar.type = 'button'
      itemEditar.textContent = 'Editar'
      itemEditar.addEventListener('click', (e) => {
        e.stopPropagation()
        fecharMenus()
        openEditor(m)
      })
      const itemRemover = document.createElement('button')
      itemRemover.type = 'button'
      itemRemover.className = 'danger'
      itemRemover.textContent = 'Remover'
      itemRemover.addEventListener('click', (e) => {
        e.stopPropagation()
        fecharMenus()
        removerMusica(m)
      })
      menu.append(itemEditar, itemRemover)
      btnAcoes.addEventListener('click', (e) => {
        e.stopPropagation()
        const abrir = menu.hidden
        fecharMenus()
        menu.hidden = !abrir
        btnAcoes.setAttribute('aria-expanded', String(abrir))
      })
      acoesWrap.append(btnAcoes, menu)

      li.addEventListener('click', () => openShow(m))
      li.append(info, acoesWrap)
      listEl.append(li)
    }
  }

  function openEditor(m) {
    editId = m ? m.id : null
    document.getElementById('editor-titulo').textContent = m ? `Editar — ${capitalize(m.titulo)}` : 'Adicionar música'
    artistEl.value = m?.artista ?? ''
    tituloEl.value = m?.titulo ?? ''
    tomEl.value = m?.tomBase ?? ''
    duracaoEl.value = m?.duracao != null ? fmtDuracao(m.duracao) : ''
    capoEl.value = String(m?.capotraste ?? 0)
    editorEstilos.setValor(m?.estilos || [])
    textoEl.value = ''
    statusEl.textContent = ''
    editorEl.hidden = false
    textoEl.focus()
    if (m) {
      getMusica(m.id)
        .then((data) => {
          textoEl.value = data.conteudo
        })
        .catch((err) => {
          statusEl.textContent = err.message
        })
    }
  }

  function closeEditor() {
    editorEl.hidden = true
    editId = null
  }

  async function salvar() {
    const artista = artistEl.value.trim()
    const titulo = tituloEl.value.trim()
    const conteudo = textoEl.value
    const estilos = editorEstilos.getValor()
    if (!conteudo.trim()) {
      statusEl.textContent = 'Cole ou escreva a cifra antes de salvar.'
      return
    }
    const novoId = fileNameFrom(artista, titulo)
    const capo = Number(capoEl.value) || null
    const durTxt = duracaoEl.value.trim()
    let duracao = null
    if (durTxt) {
      duracao = parseDuracao(durTxt)
      if (duracao === undefined) {
        statusEl.textContent = 'Duração inválida — use min:seg (ex.: 3:45).'
        return
      }
    }
    try {
      await putMusica(novoId, conteudo, estilos, tomEl.value.trim() || null, capo, duracao, editId)
      const data = await getCatalog()
      state.catalog = data.musicas
      state.ordens = data.ordens || {}
      closeEditor()
      refresh()
    } catch (err) {
      statusEl.textContent = `Erro ao salvar: ${err.message}`
    }
  }

  function refresh() {
    renderAbas()
    editorEstilos.setOpcoes(estilosSugeridos())
    filtroLetras.setValor(state.filters.letra)
    state.filters.letra = filtroLetras.atualizarDisponiveis(state.catalog)
    render()
  }

  listEl.addEventListener('dragover', (e) => e.preventDefault())

  listEl.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('.musica-item')
    if (li) li.draggable = !e.target.closest('.acoes-wrap')
  })

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.acoes-wrap')) fecharMenus()
  })

  configurarDnd()

  buscaEl.addEventListener('input', () => {
    state.filters.busca = buscaEl.value
    render()
  })

  btnAdicionar.addEventListener('click', () => openEditor(null))
  btnCancelar.addEventListener('click', closeEditor)
  btnSalvar.addEventListener('click', salvar)

  btnArquivo.addEventListener('click', () => arquivoEl.click())
  arquivoEl.addEventListener('change', async () => {
    const f = arquivoEl.files[0]
    if (!f) return
    textoEl.value = await fillFromFile(f)
    statusEl.textContent = `Carregado: ${f.name}`
    arquivoEl.value = ''
  })

  editorEl.addEventListener('dragover', (e) => {
    e.preventDefault()
    editorEl.classList.add('is-drag')
  })
  editorEl.addEventListener('dragleave', () => editorEl.classList.remove('is-drag'))
  editorEl.addEventListener('drop', async (e) => {
    e.preventDefault()
    editorEl.classList.remove('is-drag')
    const f = e.dataTransfer.files[0]
    if (!f) return
    textoEl.value = await fillFromFile(f)
    statusEl.textContent = `Carregado: ${f.name}`
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editorEl.hidden) closeEditor()
    if (e.key === 'Escape') fecharMenus()
  })

  const temaSalvo = localStorage.getItem(TEMA_STORAGE_KEY) || 'claro'
  applyTema(temaSalvo)
  btnTema.addEventListener('click', () => {
    const novo = document.body.dataset.tema === 'claro' ? 'escuro' : 'claro'
    applyTema(novo)
    localStorage.setItem(TEMA_STORAGE_KEY, novo)
  })

  refresh()
  window.addEventListener('cifra:lista-mudou', refresh)
  return { refresh }
}