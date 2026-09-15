import { createMultiselect } from './multiselect.js'
import { getCatalog, putMusica } from './api.js'
import {
  DEC_CODES_PADRAO,
  codigosDeDec,
  codigosSemAcorde,
  deDecParaLinhas,
  deTextoParaLinhas,
  linhasDeTxt,
  tituloDeDec,
} from './decifra.js'

const STORAGE_DIC = 'cifra-prebelli:dec-codigos'
const INVALIDOS = '\\/:*?"<>|'

function carregaDic() {
  let salvos = {}
  try {
    salvos = JSON.parse(localStorage.getItem(STORAGE_DIC) || '{}')
  } catch { salvos = {} }
  return { ...DEC_CODES_PADRAO, ...salvos }
}

let dic = carregaDic()
let seq = 0

function decUtf8OuCp1252(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

function leArquivo(file) {
  return file.arrayBuffer().then((buffer) => decUtf8OuCp1252(new Uint8Array(buffer)))
}

function fileNameFrom(artista, titulo) {
  const a = (artista || '').trim()
  const t = (titulo || '').trim() || 'Sem título'
  const base = a ? `${a} - ${t}` : t
  const limpo = [...base].map((ch) => (INVALIDOS.includes(ch) ? '-' : ch)).join('')
  return `${limpo}.txt`
}

function splitAutorTitulo(texto) {
  const idx = texto.indexOf(' - ')
  return idx === -1 ? ['', texto.trim()] : [texto.slice(0, idx).trim(), texto.slice(idx + 3).trim()]
}

function converteTexto(texto) {
  const linhas = /<[Oo]>/.test(texto) ? deTextoParaLinhas(texto) : linhasDeTxt(texto)
  return linhas.join('\n')
}

export function initImport(state, onImportado = () => {}) {
  const importarEl = document.getElementById('importar')
  const btnAbrir = document.getElementById('btn-importar')
  const btnSelecionar = document.getElementById('imp-selecionar')
  const arquivosEl = document.getElementById('imp-arquivos')
  const colaEl = document.getElementById('imp-cola')
  const btnCola = document.getElementById('imp-adicionar-cola')
  const codigosEl = document.getElementById('imp-codigos')
  const gradeEl = document.getElementById('imp-codigos-grade')
  const estilosWrapEl = document.getElementById('imp-estilos-wrap')
  const listaEl = document.getElementById('imp-lista')
  const statusEl = document.getElementById('imp-status')
  const btnImportar = document.getElementById('imp-importar')
  const btnFechar = document.getElementById('imp-cancelar')

  let rows = []

  function estilosDaLista() {
    const set = new Set()
    for (const m of state.catalog) for (const s of m.estilos || []) set.add(s)
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  const estilosMs = createMultiselect({
    textoVazio: 'Estilos para importação…',
    placeholderAdd: 'Novo estilo…',
    opcoesIniciais: estilosDaLista(),
  })
  estilosWrapEl.append(estilosMs.elemento)

  function decifica(raw) {
    return deDecParaLinhas(raw, dic).join('\n')
  }

  function avisoDe(raw) {
    const sem = codigosSemAcorde(raw, dic)
    return sem.length ? `códigos sem acorde definido: ${[...sem].join(' ')}` : ''
  }

  function statusTexto(r) {
    const id = fileNameFrom(r.artista, r.titulo)
    const existe = state.catalog.some((m) => m.id === id)
    return [existe ? 'substitui existente' : 'nova', r.aviso].filter(Boolean).join(' · ')
  }

  function atualizaStatus(itemEl, r) {
    const st = itemEl.querySelector('.importar-status')
    if (st) st.textContent = statusTexto(r)
  }

  function criaItem(r) {
    const item = document.createElement('div')
    item.className = 'importar-item'
    item.dataset.uid = String(r.uid)

    const cab = document.createElement('div')
    cab.className = 'importar-item-cab'

    const nome = document.createElement('span')
    nome.className = 'importar-nome'
    nome.textContent = r.nome || 'Texto colado'

    const st = document.createElement('span')
    st.className = 'importar-status'
    st.textContent = statusTexto(r)

    cab.append(nome, st)

    const campos = document.createElement('div')
    campos.className = 'importar-campos'
    const inArt = document.createElement('input')
    inArt.type = 'text'
    inArt.className = 'importar-artista'
    inArt.placeholder = 'Artista'
    inArt.value = r.artista
    const inTit = document.createElement('input')
    inTit.type = 'text'
    inTit.className = 'importar-titulo'
    inTit.placeholder = 'Título'
    inTit.value = r.titulo
    campos.append(inArt, inTit)

    const det = document.createElement('details')
    det.className = 'importar-preview-wrap'
    const sum = document.createElement('summary')
    sum.textContent = 'Prévia (edite se precisar)'
    const ta = document.createElement('textarea')
    ta.className = 'importar-preview'
    ta.spellcheck = false
    ta.value = r.conteudo
    det.append(sum, ta)

    const remover = document.createElement('button')
    remover.type = 'button'
    remover.className = 'btn danger importar-remover'
    remover.textContent = 'Remover'

    item.append(cab, campos, det, remover)

    inArt.addEventListener('input', () => {
      r.artista = inArt.value
      atualizaStatus(item, r)
    })
    inTit.addEventListener('input', () => {
      r.titulo = inTit.value
      atualizaStatus(item, r)
    })
    ta.addEventListener('input', () => {
      r.conteudo = ta.value
    })
    remover.addEventListener('click', () => {
      rows = rows.filter((x) => x !== r)
      montaGrade()
      renderLista()
    })
    return item
  }

  function renderLista() {
    listaEl.textContent = ''
    if (rows.length === 0) {
      const p = document.createElement('p')
      p.className = 'importar-hint'
      p.textContent = 'Nenhum arquivo adicionado ainda.'
      listaEl.append(p)
    } else {
      for (const r of rows) listaEl.append(criaItem(r))
    }
    atualizaBotaoImportar()
  }

  function atualizaPreviews() {
    for (const r of rows) {
      if (r.origem !== 'dec') continue
      r.conteudo = decifica(r.raw)
      r.aviso = avisoDe(r.raw)
      const el = listaEl.querySelector(`.importar-item[data-uid="${r.uid}"]`)
      if (!el) continue
      const ta = el.querySelector('.importar-preview')
      if (ta && ta.value !== r.conteudo) ta.value = r.conteudo
      atualizaStatus(el, r)
    }
  }

  function montaGrade() {
    const presentes = new Set()
    for (const r of rows) {
      if (r.origem !== 'dec') continue
      for (const c of r.codigos) presentes.add(c)
    }
    if (presentes.size === 0) {
      codigosEl.hidden = true
      gradeEl.textContent = ''
      return
    }
    codigosEl.hidden = false
    gradeEl.textContent = ''
    for (const c of [...presentes].sort()) {
      const linha = document.createElement('div')
      linha.className = 'importar-codigo'
      const rot = document.createElement('span')
      rot.textContent = `Código ${c}`
      const inp = document.createElement('input')
      inp.type = 'text'
      inp.className = 'importar-codigo-valor'
      inp.placeholder = 'acorde'
      inp.value = dic[c] || ''
      inp.addEventListener('input', () => {
        dic[c] = inp.value.trim()
        try {
          localStorage.setItem(STORAGE_DIC, JSON.stringify(dic))
        } catch { /* sem storage */ }
        atualizaPreviews()
      })
      linha.append(rot, inp)
      gradeEl.append(linha)
    }
  }

  function atualizaBotaoImportar() {
    const n = rows.length
    btnImportar.disabled = n === 0
    btnImportar.textContent = n ? `Importar ${n}` : 'Importar'
  }

  function abrir() {
    statusEl.textContent = ''
    renderLista()
    importarEl.hidden = false
  }

  function fechar() {
    importarEl.hidden = true
    statusEl.textContent = ''
  }

  async function adicionarArquivos(files) {
    for (const f of files) {
      const texto = await leArquivo(f)
      const ehDec = f.name.toLowerCase().endsWith('.dec') || /^Decifr2/.test(texto)
      if (ehDec) {
        const base = tituloDeDec(texto) || f.name.toLowerCase().replace(/\.dec$/, '')
        const [artista, titulo] = splitAutorTitulo(base)
        rows.push({
          uid: ++seq,
          nome: f.name,
          origem: 'dec',
          raw: texto,
          codigos: [...codigosDeDec(texto)],
          artista,
          titulo,
          conteudo: decifica(texto),
          aviso: avisoDe(texto),
        })
      } else {
        const nomeBase = f.name.replace(/\.[^.]+$/, '')
        const [artista, titulo] = splitAutorTitulo(nomeBase)
        rows.push({
          uid: ++seq,
          nome: f.name,
          origem: 'txt',
          raw: texto,
          codigos: [],
          artista,
          titulo,
          conteudo: converteTexto(texto),
          aviso: '',
        })
      }
    }
    montaGrade()
    renderLista()
  }

  function adicionarCola() {
    const texto = colaEl.value
    if (!texto.trim()) {
      statusEl.textContent = 'Cole um texto antes de adicionar.'
      return
    }
    rows.push({
      uid: ++seq,
      nome: '',
      origem: 'cola',
      raw: texto,
      codigos: [],
      artista: '',
      titulo: '',
      conteudo: converteTexto(texto),
      aviso: '',
    })
    colaEl.value = ''
    montaGrade()
    renderLista()
  }

  async function importar() {
    const fila = rows.filter((r) => r.conteudo && r.conteudo.trim())
    if (fila.length === 0) return
    const estilos = estilosMs.getValor()
    btnImportar.disabled = true
    statusEl.textContent = 'Importando…'
    let ok = 0
    const erros = []
    for (const r of fila) {
      const id = fileNameFrom(r.artista, r.titulo)
      try {
        await putMusica(id, r.conteudo, estilos, null, null)
        ok += 1
      } catch (err) {
        erros.push(`${id}: ${err.message}`)
      }
    }
    const data = await getCatalog()
    state.catalog = data.musicas || []
    state.ordens = data.ordens || {}
    onImportado()
    if (erros.length === 0) {
      fechar()
      return
    }
    statusEl.textContent = `${ok} importada(s); ${erros.length} com erro: ${erros.join('; ')}`
    atualizaBotaoImportar()
  }

  btnAbrir.addEventListener('click', abrir)
  btnSelecionar.addEventListener('click', () => arquivosEl.click())
  arquivosEl.addEventListener('change', () => {
    if (arquivosEl.files.length) adicionarArquivos(arquivosEl.files)
    arquivosEl.value = ''
  })
  btnCola.addEventListener('click', adicionarCola)
  btnFechar.addEventListener('click', fechar)
  btnImportar.addEventListener('click', importar)

  importarEl.addEventListener('dragover', (e) => {
    e.preventDefault()
    importarEl.classList.add('is-drag')
  })
  importarEl.addEventListener('dragleave', () => importarEl.classList.remove('is-drag'))
  importarEl.addEventListener('drop', (e) => {
    e.preventDefault()
    importarEl.classList.remove('is-drag')
    const files = [...(e.dataTransfer.files || [])]
    if (files.length) adicionarArquivos(files)
  })

  importarEl.addEventListener('click', (e) => {
    if (e.target === importarEl) fechar()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !importarEl.hidden) fechar()
  })

  renderLista()
}