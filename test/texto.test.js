import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { capitalize, nomeExibicao } from '../public/js/texto.js'

describe('capitalize', () => {
  it('caixa alta vira capitalizada', () => {
    assert.equal(capitalize('GOO GOO DOLLS'), 'Goo Goo Dolls')
    assert.equal(capitalize('IRIS'), 'Iris')
  })
  it('mantém apóstrofo sem subir a letra seguinte', () => {
    assert.equal(capitalize("DON'T STOP BELIEVIN"), "Don't Stop Believin")
  })
  it('acentos e separadores', () => {
    assert.equal(capitalize('legião urbana - pais e filhos'), 'Legião Urbana - Pais E Filhos')
    assert.equal(capitalize('pós-punk (ao vivo)'), 'Pós-Punk (Ao Vivo)')
  })
  it('nulo ou vazio', () => {
    assert.equal(capitalize(''), '')
    assert.equal(capitalize(null), '')
  })
})

describe('nomeExibicao', () => {
  it('artista — título capitalizados', () => {
    assert.equal(nomeExibicao('GOO GOO DOLLS', 'IRIS'), 'Goo Goo Dolls — Iris')
  })
  it('sem artista mostra só o título', () => {
    assert.equal(nomeExibicao('', 'IRIS'), 'Iris')
  })
})
