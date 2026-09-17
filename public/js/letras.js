export function letraDe(s) {
  const c = (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .charAt(0)
    .toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}

export function casaLetra(m, letra) {
  return !letra || letraDe(m.titulo) === letra
}

const ALFABETO = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

export function createBarraLetras({ onchange = () => {} } = {}) {
  const el = document.createElement('div')
  el.className = 'barra-letras'

  const botoes = new Map()
  const btnTodas = document.createElement('button')
  btnTodas.type = 'button'
  btnTodas.className = 'letra-btn letra-todas'
  btnTodas.textContent = 'Todas'
  btnTodas.title = 'Mostrar todas as músicas'
  btnTodas.addEventListener('click', () => selecionar(''))
  el.append(btnTodas)

  let btnOutros = null

  function criarBotao(rotulo) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'letra-btn'
    b.textContent = rotulo
    b.title = `Músicas com ${rotulo === '#' ? 'outros inícios' : `a letra ${rotulo}`}`
    b.addEventListener('click', () => selecionar(rotulo))
    botoes.set(rotulo, b)
    el.append(b)
  }

  for (const l of ALFABETO) criarBotao(l)

  let valor = ''

  function ativa() {
    btnTodas.classList.toggle('ativa', valor === '')
    for (const [l, b] of botoes) b.classList.toggle('ativa', valor === l)
  }

  function selecionar(v) {
    valor = valor === v ? '' : v
    ativa()
    onchange(valor)
  }

  function atualizarDisponiveis(catalog) {
    const presentes = new Set(catalog.map((m) => letraDe(m.titulo)))
    const temOutros = presentes.has('#')
    if (temOutros && !btnOutros) {
      criarBotao('#')
      btnOutros = botoes.get('#')
      btnOutros.classList.add('letra-outros')
    } else if (!temOutros && btnOutros) {
      btnOutros.remove()
      botoes.delete('#')
      btnOutros = null
    }
    for (const [l, b] of botoes) {
      const vazia = !presentes.has(l)
      b.classList.toggle('vazia', vazia)
      b.disabled = vazia
    }
    if (valor && !presentes.has(valor)) valor = ''
    ativa()
    return valor
  }

  return {
    elemento: el,
    getValor: () => valor,
    setValor: (v) => {
      valor = v || ''
      ativa()
    },
    atualizarDisponiveis,
  }
}
