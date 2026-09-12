export function createMultiselect({
  textoVazio,
  opcoesIniciais = [],
  selecionadosIniciais = [],
  onchange = () => {},
  placeholderAdd = 'Adicionar estilo…',
  inline = false,
  mostrarTodos = false,
  rotuloTodos = 'Todos',
}) {
  let opcoes = [...opcoesIniciais]
  let selecionados = [...selecionadosIniciais]

  const el = document.createElement('div')
  el.className = 'multiselect'
  if (inline) el.classList.add('multiselect-inline')

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'btn multiselect-trigger'
  btn.title = textoVazio

  const panel = document.createElement('div')
  panel.className = 'multiselect-panel'
  panel.hidden = true

  const toolbar = document.createElement('div')
  toolbar.className = 'multiselect-toolbar'

  const addInput = document.createElement('input')
  addInput.type = 'text'
  addInput.className = 'multiselect-add'
  addInput.placeholder = placeholderAdd

  const btnLimpar = document.createElement('button')
  btnLimpar.type = 'button'
  btnLimpar.className = 'multiselect-limpar'
  btnLimpar.textContent = 'Limpar'

  const lista = document.createElement('div')
  lista.className = 'multiselect-lista'

  toolbar.append(addInput, btnLimpar)
  panel.append(toolbar, lista)
  el.append(btn, panel)

  let todosRow = null
  if (mostrarTodos) {
    todosRow = document.createElement('label')
    todosRow.className = 'multiselect-item'
    const todosCb = document.createElement('input')
    todosCb.type = 'checkbox'
    todosCb.addEventListener('change', () => {
      if (todosCb.checked) {
        selecionados = []
        renderTrigger()
        emit()
        renderLista()
      }
    })
    todosRow.append(todosCb, document.createTextNode(` ${rotuloTodos}`))
    panel.insertBefore(todosRow, lista)
  }

  function renderTrigger() {
    const n = selecionados.length
    btn.textContent = n > 0 && n <= 2 ? selecionados.join(' · ') : n > 2 ? `${n} selecionados` : textoVazio
    btnLimpar.hidden = n === 0
  }

  function renderLista() {
    lista.textContent = ''
    if (opcoes.length === 0) {
      const p = document.createElement('p')
      p.className = 'multiselect-vazio'
      p.textContent = 'Nenhuma opção — digite acima e dê Enter para criar.'
      lista.append(p)
    }
    for (const s of opcoes) {
      const label = document.createElement('label')
      label.className = 'multiselect-item'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = selecionados.includes(s)
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!selecionados.includes(s)) selecionados = [...selecionados, s]
        } else {
          selecionados = selecionados.filter((x) => x !== s)
        }
        renderTrigger()
        emit()
      })
      label.append(cb, document.createTextNode(` ${s}`))
      lista.append(label)
    }
  }

  function emit() {
    btnLimpar.hidden = selecionados.length === 0
    onchange([...selecionados])
  }

  function abrir() {
    renderLista()
    panel.hidden = false
    addInput.focus()
  }

  function fechar() {
    panel.hidden = true
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (panel.hidden) abrir()
    else fechar()
  })

  addInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = addInput.value.trim()
    if (!v) return
    if (!opcoes.includes(v)) opcoes = [...opcoes, v]
    if (!selecionados.includes(v)) selecionados = [...selecionados, v]
    addInput.value = ''
    renderTrigger()
    emit()
    renderLista()
  })

  btnLimpar.addEventListener('click', () => {
    selecionados = []
    renderTrigger()
    emit()
    renderLista()
  })

  document.addEventListener('click', (e) => {
    if (!inline && !el.contains(e.target)) fechar()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fechar()
  })

  renderTrigger()
  renderLista()

  return {
    elemento: el,
    setValor: (arr) => {
      selecionados = [...arr]
      renderTrigger()
      renderLista()
    },
    getValor: () => [...selecionados],
    setOpcoes: (arr) => {
      const set = new Set([...selecionados, ...arr])
      opcoes = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      renderLista()
    },
  }
}