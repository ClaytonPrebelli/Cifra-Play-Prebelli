import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deTextoParaLinhas,
  deDecParaLinhas,
  desempacotaParens,
  linhasDeTxt,
  tituloDeDec,
  codigosSemAcorde,
  DEC_CODES_PADRAO,
} from '../public/js/decifra.js'

test('desempacotaParens: grupo de 2+ acordes entre parênteses vira linha de acordes', () => {
  assert.equal(desempacotaParens('(C F F#m)'), 'C F F#m')
  assert.equal(desempacotaParens('   ( G D Em C )   '), 'G D Em C')
  assert.equal(desempacotaParens('(B5 A5)'), 'B5 A5')
})

test('desempacotaParens: parêntese com acorde único ou texto permanece', () => {
  assert.equal(desempacotaParens('( F# )'), '( F# )')
  assert.equal(desempacotaParens('(O melhor)'), '(O melhor)')
  assert.equal(desempacotaParens('Intro (C F G) 2x'), 'Intro (C F G) 2x')
})

test('linhasDeTxt desempacota grupos de acordes', () => {
  const l = linhasDeTxt('(C F F#m)\nThis Romeo is bleeding')
  assert.deepEqual(l, ['C F F#m', 'This Romeo is bleeding'])
})

test('deTextoParaLinhas: <O> vira [Refrão] único e desempacota grupos', () => {
  const l = deTextoParaLinhas('E5  A5\nThis Romeo\n<O>\nAnd I will love\n<O>\nYou\'ll be on my mind\n[Segunda Parte]\nNow your pictures\n(C F F#m)')
  assert.deepEqual(l, [
    'E5  A5',
    'This Romeo',
    '[Refrão]',
    'And I will love',
    'You\'ll be on my mind',
    '[Segunda Parte]',
    'Now your pictures',
    'C F F#m',
  ])
})

test('deDecParaLinhas funciona com o mapa padrão do ALWAYS', () => {
  const tmp = tituloDeDec('0 Always\n3 3 4 5 6 4\n')
  assert.equal(tmp, 'Always')
  const sem = codigosSemAcorde('3 3 4 5 6 7 8 9 : ; < = > ? @', DEC_CODES_PADRAO)
  assert.deepEqual([...sem], [])
  const linhas = deDecParaLinhas('0 Always\n3 3 4 5 6 4\n2 This Romeo is bleeding\n', DEC_CODES_PADRAO)
  assert.ok(linhas.some((l) => l.includes('E5')))
})