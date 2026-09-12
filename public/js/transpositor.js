import { parseChord } from './parser.js'

export const CROMATICO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SEMIS = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

export function semiDaNota(nota) {
  if (typeof nota !== 'string') return null
  const n = nota.trim()
  return Object.prototype.hasOwnProperty.call(SEMIS, n) ? SEMIS[n] : null
}

export function transporNota(nota, offset) {
  if (!Number.isInteger(offset)) return null
  const s = semiDaNota(nota)
  if (s === null) return null
  return CROMATICO[((s + offset) % 12 + 12) % 12]
}

export function transporAcorde(acorde, offset) {
  if (!acorde || typeof acorde.tonica !== 'string') return null
  const tonica = transporNota(acorde.tonica, offset)
  if (tonica === null) return null
  const baixo = acorde.baixo == null ? null : transporNota(acorde.baixo, offset)
  if (acorde.baixo != null && baixo === null) return null
  return { ...acorde, tonica, baixo }
}

export function transporTexto(token, offset) {
  const acorde = parseChord(token)
  if (!acorde) return null
  const transposto = transporAcorde(acorde, offset)
  if (!transposto) return null
  return transposto.tonica + (transposto.sufixo || '') + (transposto.anotacao || '') +
    (transposto.baixo ? `/${transposto.baixo}` : '')
}