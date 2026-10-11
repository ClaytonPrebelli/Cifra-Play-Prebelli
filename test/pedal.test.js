import test from 'node:test'
import assert from 'node:assert/strict'
import { PEDAL_PADRAO, acaoParaTecla, rotuloToken, tokenDeEvento, validarMapa } from '../public/js/pedal.js'

test('pedal padrão: PageDown/ArrowDown/ArrowRight/Espaço/Enter/MediaTrackNext descem', () => {
  for (const t of ['PageDown', 'ArrowDown', 'ArrowRight', ' ', 'Enter', 'MediaTrackNext']) {
    assert.equal(acaoParaTecla(t, PEDAL_PADRAO), 'descer')
  }
})

test('pedal padrão: PageUp/ArrowUp/ArrowLeft/MediaTrackPrevious sobem', () => {
  for (const t of ['PageUp', 'ArrowUp', 'ArrowLeft', 'MediaTrackPrevious']) {
    assert.equal(acaoParaTecla(t, PEDAL_PADRAO), 'subir')
  }
})

test('tokenDeEvento normaliza Espaço e Enter pelo code', () => {
  assert.equal(tokenDeEvento({ key: ' ', code: 'Space' }), ' ')
  assert.equal(tokenDeEvento({ key: 'Enter', code: 'NumpadEnter' }), 'Enter')
  assert.equal(tokenDeEvento({ key: 'PageDown', code: 'PageDown' }), 'PageDown')
})

test('token desconhecido não dispara ação', () => {
  assert.equal(acaoParaTecla('F5', PEDAL_PADRAO), null)
  assert.equal(acaoParaTecla('', PEDAL_PADRAO), null)
})

test('mapa customizado com tecla do pedal (ex.: "a"/"b")', () => {
  const mapa = { descer: ['b'], subir: ['a'] }
  assert.equal(acaoParaTecla('b', mapa), 'descer')
  assert.equal(acaoParaTecla('a', mapa), 'subir')
  assert.equal(acaoParaTecla('ArrowRight', mapa), null)
})

test('rotuloToken traduz Espaço e setas', () => {
  assert.equal(rotuloToken(' '), 'Espaço')
  assert.equal(rotuloToken('ArrowRight'), '→')
})

test('validarMapa rejeita lixo e volta ao padrão', () => {
  assert.deepEqual(validarMapa(null), PEDAL_PADRAO)
  assert.deepEqual(validarMapa({ descer: 'x', subir: [] }), PEDAL_PADRAO)
  assert.deepEqual(validarMapa({ descer: ['b'], subir: ['a'] }), { descer: ['b'], subir: ['a'] })
})
