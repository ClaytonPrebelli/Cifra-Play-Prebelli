import { getCatalog, getMusica, putMusica, deleteMusica, saveCatalog } from './api.js'
import { createMultiselect } from './multiselect.js'
import { openShow } from './show.js'

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
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
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
  const filtroWrapEl = document.getElementById('filtro-estilos')
  const btnAdicionar = document.getElementById('btn-adicionar')
  const btnTema = document.getElementById('btn-tema')
  const editorEl = document.getElementById('editor')
  const textoEl = document.getElementById('ed-texto')
  const artistEl = document.getElementById('ed-artista')
  const tituloEl = document.getElementById('ed-titulo')
  const tomEl = document.getElementById('ed-tom')
  const statusEl = document.getElementById('editor-status')
  const btnSalvar = document.getElementById('btn-salvar')
  const btnCancelar = document.getElementById('btn-cancelar')
  const btnArquivo = document.getElementById('btn-arquivo')
  const arquivoEl = document.getElementById('ed-arquivo')
  const edEstilosWrapEl = document.getElementById('ed-estilos-wrap')

  let editId = null
  let dragId = null

  function moverItem(idArrastado, idAlvo, depois) {
    const de = state.catalog.findIndex((m) => m.id === idArrastado)
    const alvo = state.catalog.findIndex((m) => m.id === idAlvo)
    if (de === -1 || alvo === -1 || de === alvo) return false
    const [item] = state.catalog.splice(de, 1)
    let para = state.catalog.findIndex((m) => m.id === idAlvo)
    if (depois) para += 1
    state.catalog.splice(para, 0, item)
    return true
  }

  async function persistirOrdem() {
    try {
      await saveCatalog({ versoes: 1, musicas: state.catalog })
    } catch (err) {
      console.error('erro ao salvar ordem', err)
    }
  }

  function limparDnd() {
    dragId = null
    listEl.querySelectorAll('.dragging, .drop-before, .drop-after')
      .forEach((el) => el.classList.remove('dragging', 'drop-before', 'drop-after'))
  }

  function configurarDnd(li) {
    li.draggable = true
    li.addEventListener('dragstart', (e) => {
      dragId = li.dataset.id
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', dragId)
      requestAnimationFrame(() => li.classList.add('dragging'))
    })
    li.addEventListener('dragover', (e) => {
      if (!dragId || dragId === li.dataset.id) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const r = li.getBoundingClientRect()
      const depois = e.clientY - r.top > r.height / 2
      li.classList.toggle('drop-after', !!depois)
      li.classList.toggle('drop-before', !depois)
    })
    li.addEventListener('dragleave', () => {
      li.classList.remove('drop-before', 'drop-after')
    })
    li.addEventListener('drop', (e) => {
      e.preventDefault()
      if (!dragId || dragId === li.dataset.id) return
      const depois = li.classList.contains('drop-after')
      if (moverItem(dragId, li.dataset.id, depois)) {
        persistirOrdem()
        refresh()
      }
      dragId = null
    })
    li.addEventListener('dragend', limparDnd)
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

  const filtroEstilos = createMultiselect({
    textoVazio: 'Estilos',
    mostrarTodos: true,
    opcoesIniciais: estilosDaLista(),
    selecionadosIniciais: state.filters.estilos,
    onchange: (arr) => {
      state.filters.estilos = arr
      render()
    },
  })
  filtroWrapEl.append(filtroEstilos.elemento)

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
    const items = state.catalog.filter((m) => {
      if (q && !norm(`${m.artista} ${m.titulo}`).includes(q)) return false
      if (
        estilosSelecionados.length &&
        !(m.estilos || []).some((s) => estilosSelecionados.includes(s))
      )
        return false
      return true
    })
    listEl.textContent = ''
    vaziaEl.textContent = ''
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
      configurarDnd(li)

      const info = document.createElement('div')
      info.className = 'musica-info'

      const nome = document.createElement('span')
      nome.className = 'musica-nome'
      nome.textContent = m.titulo
      nome.title = m.artista ? `${m.artista} — ${m.titulo}` : m.titulo

      const meta = document.createElement('span')
      meta.className = 'musica-meta'
      meta.textContent = [m.artista, m.tomBase ? `Tom ${m.tomBase}` : '', (m.estilos || []).join(' · ')]
        .filter(Boolean)
        .join(' · ')

      info.append(nome, meta)

      const acoes = document.createElement('div')
      acoes.className = 'musica-acoes'
      const btnEditar = document.createElement('button')
      btnEditar.className = 'btn'
      btnEditar.textContent = 'Editar'
      btnEditar.addEventListener('click', (e) => {
        e.stopPropagation()
        openEditor(m)
      })
      const btnRemover = document.createElement('button')
      btnRemover.className = 'btn danger'
      btnRemover.textContent = 'Remover'
      btnRemover.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm(`Remover "${m.titulo}"?`)) return
        await deleteMusica(m.id)
        state.catalog = await getCatalog()
        refresh()
      })
      acoes.append(btnEditar, btnRemover)

      li.addEventListener('click', () => openShow(m))
      li.append(info, acoes)
      listEl.append(li)
    }
  }

  function openEditor(m) {
    editId = m ? m.id : null
    document.getElementById('editor-titulo').textContent = m ? `Editar — ${m.titulo}` : 'Adicionar música'
    artistEl.value = m?.artista ?? ''
    tituloEl.value = m?.titulo ?? ''
    tomEl.value = m?.tomBase ?? ''
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
    try {
      await putMusica(novoId, conteudo, estilos, tomEl.value.trim() || null)
      if (editId && novoId !== editId) {
        await deleteMusica(editId)
      }
      state.catalog = await getCatalog()
      closeEditor()
      refresh()
    } catch (err) {
      statusEl.textContent = `Erro ao salvar: ${err.message}`
    }
  }

  function refresh() {
    filtroEstilos.setOpcoes(estilosDaLista())
    editorEstilos.setOpcoes(estilosSugeridos())
    render()
  }

  listEl.addEventListener('dragover', (e) => e.preventDefault())
  listEl.addEventListener('dragleave', limparDnd)
  listEl.addEventListener('drop', (e) => e.preventDefault())

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

  editorEl.addEventListener('click', (e) => {
    if (e.target === editorEl) closeEditor()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editorEl.hidden) closeEditor()
  })

  const temaSalvo = localStorage.getItem(TEMA_STORAGE_KEY) || 'claro'
  applyTema(temaSalvo)
  btnTema.addEventListener('click', () => {
    const novo = document.body.dataset.tema === 'claro' ? 'escuro' : 'claro'
    applyTema(novo)
    localStorage.setItem(TEMA_STORAGE_KEY, novo)
  })

  refresh()
}