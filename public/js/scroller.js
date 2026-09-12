export function createScroller(tela, cifra) {
  const st = { colunas: 3, velocidade: 3, rolando: true, total: 1, ativa: 0, onPagina: null }
  let rafId = 0
  let timer = null

  function altura() {
    return Math.max(220, tela.clientHeight - 16)
  }

  function layout() {
    const h = altura()
    cifra.style.height = `${h}px`
    cifra.style.maxHeight = `${h}px`
    cifra.style.columnCount = String(st.colunas)
    cifra.style.columnFill = 'auto'
    cifra.style.overflow = 'hidden'
    st.total = Math.max(1, Math.ceil(cifra.scrollHeight / h))
    if (st.ativa > st.total - 1) st.ativa = st.total - 1
    tela.scrollTop = deslocamento()
    if (st.onPagina) st.onPagina(st.ativa)
  }

  function deslocamento() {
    return cifra.offsetTop + st.ativa * altura()
  }

  function rebuild(rows) {
    cifra.textContent = ''
    if (rows.length) cifra.append(...rows)
    layout()
  }

  function animarPara(dur) {
    const alvo = deslocamento()
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

  function irPara(indice, dur = 1) {
    st.ativa = Math.max(0, Math.min(indice, st.total - 1))
    if (st.onPagina) st.onPagina(st.ativa)
    return animarPara(dur)
  }

  function cronometro() {
    clearTimeout(timer)
    if (!st.rolando || st.total <= 1) return
    if (st.ativa >= st.total - 1) {
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
    layout,
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