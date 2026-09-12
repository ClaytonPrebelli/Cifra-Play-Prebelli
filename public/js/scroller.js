function margemVertical(el) {
  const m = getComputedStyle(el)
  return (parseFloat(m.marginTop) || 0) + (parseFloat(m.marginBottom) || 0)
}

export function createScroller(tela, cifra) {
  const st = {
    colunas: 3,
    velocidade: 3,
    rolando: true,
    paginas: [],
    ativa: 0,
    onPagina: null,
  }
  let rafId = 0
  let timer = null

  function altura() {
    return Math.max(220, tela.clientHeight - 8)
  }

  function deslocamento(indice) {
    const p = st.paginas[Math.max(0, Math.min(indice, st.paginas.length - 1))]
    return p ? cifra.offsetTop + p.offsetTop : 0
  }

  function agrupar(rows) {
    const cap = st.colunas * altura() * 0.98
    const grupos = []
    let atual = []
    let soma = 0
    for (const r of rows) {
      const h = r.offsetHeight + margemVertical(r)
      if (atual.length && soma + h > cap) {
        grupos.push(atual)
        atual = []
        soma = 0
      }
      atual.push(r)
      soma += h
    }
    if (atual.length) grupos.push(atual)
    if (grupos.length === 0) grupos.push([])
    return grupos.map((g) => {
      const p = document.createElement('div')
      p.className = 'pagina'
      p.dataset.colunas = String(st.colunas)
      p.append(...g)
      return p
    })
  }

  function rebuild(rows) {
    cifra.textContent = ''
    if (rows.length === 0) {
      st.paginas = []
      st.ativa = 0
      return
    }
    st.paginas = agrupar(rows)
    for (const p of st.paginas) cifra.append(p)
    st.ativa = Math.max(0, Math.min(st.ativa, st.paginas.length - 1))
    tela.scrollTop = deslocamento(st.ativa)
    if (st.onPagina) st.onPagina(st.ativa)
  }

  function animarPara(indice, dur) {
    const alvo = deslocamento(indice)
    return new Promise((resolver) => {
      if (dur <= 0) {
        tela.scrollTop = alvo
        return resolver()
      }
      const desde = tela.scrollTop
      const delta = alvo - desde
      if (Math.abs(delta) < 1) return resolver()
      let inicio = null
      const passo = (ts) => {
        if (inicio === null) inicio = ts
        const p = Math.min(1, (ts - inicio) / dur)
        const e = 1 - Math.pow(1 - p, 3)
        tela.scrollTop = desde + delta * e
        if (p < 1) rafId = requestAnimationFrame(passo)
        else resolver()
      }
      rafId = requestAnimationFrame(passo)
    })
  }

  function irPara(indice, dur = 1) {
    st.ativa = Math.max(0, Math.min(indice, st.paginas.length - 1))
    if (st.onPagina) st.onPagina(st.ativa)
    return animarPara(st.ativa, dur)
  }

  function cronometro() {
    clearTimeout(timer)
    if (!st.rolando || st.paginas.length <= 1) return
    if (st.ativa >= st.paginas.length - 1) {
      if (st.onPagina) st.onPagina(st.ativa)
      return
    }
    timer = setTimeout(() => {
      if (!st.rolando) return
      const dur = Math.min(600, st.velocidade * 1000 * 0.35)
      irPara(st.ativa + 1, dur)
      cronometro()
    }, st.velocidade * 1000)
  }

  function pausar() {
    st.rolando = false
    clearTimeout(timer)
  }

  function retomar() {
    st.rolando = true
    cronometro()
  }

  function alternar() {
    if (st.rolando) pausar()
    else retomar()
  }

  return {
    rebuild,
    irPara,
    pausar,
    retomar,
    alternar,
    set velocidade(v) { st.velocidade = Math.max(1, Math.min(30, v)) },
    set colunas(c) { st.colunas = Math.max(1, Math.min(3, c)) },
    set onPagina(fn) { st.onPagina = fn },
    get estado() { return st },
  }
}