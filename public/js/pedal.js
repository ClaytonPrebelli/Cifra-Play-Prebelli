export const PEDAL_PADRAO = {
  descer: ['PageDown', 'ArrowDown', 'ArrowRight', ' ', 'Enter', 'MediaTrackNext'],
  subir: ['PageUp', 'ArrowUp', 'ArrowLeft', 'MediaTrackPrevious'],
}

export function tokenDeEvento(ev = {}) {
  const { key = '', code = '' } = ev
  if (code === 'Space' || key === ' ') return ' '
  if (code === 'NumpadEnter' || key === 'Enter') return 'Enter'
  if (code && /^(Arrow|Page)/.test(code)) return code
  return key
}

export function acaoParaTecla(token, mapa = PEDAL_PADRAO) {
  if (!token) return null
  if ((mapa.descer || []).includes(token)) return 'descer'
  if ((mapa.subir || []).includes(token)) return 'subir'
  return null
}

const ROTULOS = {
  ' ': 'Espaço',
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageDown: 'PageDown',
  PageUp: 'PageUp',
  Enter: 'Enter',
  MediaTrackNext: '⏭',
  MediaTrackPrevious: '⏮',
}

export function rotuloToken(token) {
  return ROTULOS[token] || token
}

export function validarMapa(mapa) {
  const limpa = (xs, padrao) => {
    const lista = Array.isArray(xs) ? xs.filter((x) => typeof x === 'string' && x) : []
    return lista.length ? [...new Set(lista)] : [...padrao]
  }
  const m = mapa && typeof mapa === 'object' ? mapa : {}
  return { descer: limpa(m.descer, PEDAL_PADRAO.descer), subir: limpa(m.subir, PEDAL_PADRAO.subir) }
}
