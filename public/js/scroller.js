export function createScroller(tela, cifra) {
  const st = { total: 1, ativa: 0, onPagina: null }
  let rafId = 0

  function altura() {
    return Math.max(220, tela.clientHeight - 16)
  }

  function layout() {
    const h = altura()
    if (st.ativa > st.total - 1) st.ativa = st.total - 1
    tela.scrollTop = cifra.offsetTop + st.ativa * h
    if (st.onPagina) st.onPagina(st.ativa)
  }

  function rebuild(paginas) {
    cifra.textContent = ''
    if (paginas.length) cifra.append(...paginas)
    st.total = Math.max(1, paginas.length)
    layout()
  }

  function animarPara(dur) {
    const alvo = cifra.offsetTop + st.ativa * altura()
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
        tela.scrollTop = desde + delta * (1 - Math.pow(1 - p, 3))
        if (p < 1) rafId = requestAnimationFrame(passo)
        else resolver()
      }
      rafId = requestAnimationFrame(passo)
    })
  }

  function irPara(indice, dur = 220) {
    st.ativa = Math.max(0, Math.min(indice, st.total - 1))
    if (st.onPagina) st.onPagina(st.ativa)
    return animarPara(dur)
  }

  return {
    rebuild,
    layout,
    irPara,
    altura,
    set onPagina(fn) { st.onPagina = fn },
    get estado() { return st },
  }
}