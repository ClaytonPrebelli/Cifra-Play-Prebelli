import test from 'node:test'
import assert from 'node:assert/strict'
import {
  transporNota, transporAcorde, transporTexto, transporCompasso,
  semiDaNota, textoDoAcorde,
} from '../public/js/transpositor.js'

test('mapa cromático: meio-tons positivos e negativos', () => {
  assert.equal(transporNota('C', 2), 'D')
  assert.equal(transporNota('D', -2), 'C')
  assert.equal(transporNota('B', 1), 'C')
  assert.equal(transporNota('C', -1), 'B')
  assert.equal(transporNota('G#', 1), 'A')
  assert.equal(transporNota('F#', -3), 'D#')
  assert.equal(transporNota('C#', 1), 'D')
  assert.equal(transporNota('A', 12), 'A')
})

test('enharmonia: dá preferência a sustenidos', () => {
  assert.equal(transporNota('Bb', 2), 'C')
  assert.equal(transporNota('E', 4), 'G#')
  assert.equal(transporNota('Db', 3), 'E')
  assert.equal(transporNota('Ab', -2), 'F#')
})

test('semiDaNota normaliza bemóis e sustenidos equivalentes', () => {
  assert.equal(semiDaNota('Bb'), 10)
  assert.equal(semiDaNota('A#'), 10)
  assert.equal(semiDaNota('Db'), 1)
  assert.equal(semiDaNota('C#'), 1)
  assert.equal(semiDaNota('H'), null)
  assert.equal(semiDaNota(''), null)
})

test('transporAcorde preserva sufixo e transpõe tônica e baixo', () => {
  const acorde = { tonica: 'D', sufixo: 'm7', baixo: 'G', anotacao: null }
  const t = transporAcorde(acorde, 1)
  assert.deepEqual(t, { tonica: 'D#', sufixo: 'm7', baixo: 'G#', anotacao: null })

  const semBaixo = transporAcorde({ tonica: 'C', sufixo: '', baixo: null }, 2)
  assert.equal(semBaixo.tonica, 'D')
  assert.equal(semBaixo.baixo, null)
})

test('transporTexto remonta o acorde de ponta a ponta', () => {
  assert.equal(transporTexto('Dm7/G', 1), 'D#m7/G#')
  assert.equal(transporTexto('A°', 1), 'A#°')
  assert.equal(transporTexto('C(add9)', 1), 'C#(add9)')
  assert.equal(transporTexto('Bb', 2), 'C')
  assert.equal(transporTexto('xyz', 4), null)
})

test('textoDoAcorde remonta tonica + sufixo + anotação + baixo', () => {
  assert.equal(textoDoAcorde({ tonica: 'C#', sufixo: 'm7', anotacao: '(b5)', baixo: 'G' }), 'C#m7(b5)/G')
  assert.equal(textoDoAcorde({ tonica: 'F', sufixo: '', anotacao: null, baixo: null }), 'F')
  assert.equal(textoDoAcorde(null), '')
})

test('transporCompasso transpõe acordes e inline preservando âncoras', () => {
  const compasso = {
    acordes: [{ tonica: 'D', sufixo: 'm7', baixo: 'G', anotacao: null, col: 0 }],
    letra: 'Só pra você',
    vinculos: [{ acorde: 0, palavra: 2 }],
    inline: [{ acorde: { tonica: 'C', sufixo: '', baixo: null, anotacao: null }, col: 4, palavra: 0 }],
  }
  const t = transporCompasso(compasso, 1)
  assert.equal(t.acordes[0].tonica, 'D#')
  assert.equal(t.acordes[0].baixo, 'G#')
  assert.deepEqual(t.vinculos, compasso.vinculos)
  assert.equal(t.inline[0].acorde.tonica, 'C#')
  assert.equal(t.letra, compasso.letra)
  assert.equal(transporCompasso(compasso, 0), compasso)
})

test('entradas inválidas retornam null', () => {
  assert.equal(transporNota(42, 1), null)
  assert.equal(transporNota('C', 1.5), null)
  assert.equal(transporAcorde(null, 1), null)
  assert.equal(transporAcorde({ sufixo: 'm' }, 1), null)
  assert.equal(transporTexto('', 1), null)
})