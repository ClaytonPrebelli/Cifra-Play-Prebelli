import test from 'node:test'
import assert from 'node:assert/strict'
import { comandoDe } from '../public/js/comandosVoz.js'

const NORMAL = { modo: 'normal', acao: null }
const PICK = { modo: 'pick', acao: null }

test('"ativa busca" em normal dispara ativa sem fragmento', () => {
  const r = comandoDe('ativa busca', NORMAL)
  assert.equal(r.comando.tipo, 'ativa')
  assert.equal(r.fragmentoInicial, null)
  assert.equal(r.estado.modo, 'pick')
})

test('"busca" sozinho em pick rearma e nunca preenche fragmento', () => {
  const r = comandoDe('busca', PICK)
  assert.equal(r.comando.tipo, 'ativa')
  assert.equal(r.comando.texto, undefined)
  assert.equal(r.estado.fragmento, undefined)
})

test('repetir "ativa busca" em pick rearma (no-op) e não vira fragmento', () => {
  const r = comandoDe('ativa busca', PICK)
  assert.equal(r.comando.tipo, 'ativa')
  assert.equal(r.estado.modo, 'pick')
  assert.equal(r.estado.fragmento, undefined)
})

test('"busca <nome>" em pick começa o fragmento pelo nome (busca é gatilho)', () => {
  const r = comandoDe('busca chicago', PICK)
  assert.equal(r.comando.tipo, 'fragmento')
  assert.equal(r.comando.texto, 'chicago')
})

test('"ativar busca" em pick também rearma sem fragmento', () => {
  const r = comandoDe('ativar busca', PICK)
  assert.equal(r.comando.tipo, 'ativa')
  assert.equal(r.estado.fragmento, undefined)
})

test('"sim" em pick confirma e zera o estado (não vaza pick pra próxima música)', () => {
  const com = comandoDe('chicago', PICK)
  assert.equal(com.comando.tipo, 'fragmento')
  const r = comandoDe('sim', com.estado)
  assert.equal(r.comando.tipo, 'sim')
  assert.deepEqual(r.estado, { modo: 'normal', acao: null, fragmento: null })
})

test('"cancela" em pick zera o estado de volta a normal', () => {
  const r = comandoDe('cancela busca', PICK)
  assert.equal(r.comando.tipo, 'cancelar')
  assert.deepEqual(r.estado, { modo: 'normal', acao: null, fragmento: null })
})

test('"desativa busca" em normal também cancela (não depende do modo pick)', () => {
  const r = comandoDe('desativa busca', NORMAL)
  assert.equal(r.comando.tipo, 'cancelar')
  assert.deepEqual(r.estado, { modo: 'normal', acao: null, fragmento: null })
})

test('"sim" em pick confirma e zera o estado (não vaza pick pra próxima música)', () => {
  const com = comandoDe('chicago', PICK)
  assert.equal(com.comando.tipo, 'fragmento')
  const r = comandoDe('sim', com.estado)
  assert.equal(r.comando.tipo, 'sim')
  assert.deepEqual(r.estado, { modo: 'normal', acao: null, fragmento: null })
})

test('nome com "já" no meio (Ai já era) cresce o fragmento até o nome completo', () => {
  const estado = { modo: 'pick', acao: null, fragmento: 'era' }
  const r = comandoDe('ai ja era', estado)
  assert.equal(r.comando.tipo, 'fragmento')
  assert.equal(r.comando.texto, 'ai ja era')
  assert.equal(r.estado.fragmento, 'ai ja era')
})

test('nome com "já" no meio (Ai já era) vira fragmento verbatim, não comando agora', () => {
  const r = comandoDe('ai ja era', PICK)
  assert.equal(r.comando.tipo, 'fragmento')
  assert.equal(r.comando.texto, 'ai ja era')
})

test('interim "ai ja" (ainda não final) não abre o fragmento', () => {
  const estado = { modo: 'pick', acao: null, fragmento: 'era' }
  const r = comandoDe('ai ja', estado, { final: false })
  assert.equal(r.comando, null)
  assert.equal(r.estado.fragmento, 'era')
})

test('interim "agora" (ainda não final) não abre o fragmento', () => {
  const estado = { modo: 'pick', acao: null, fragmento: 'era' }
  const r = comandoDe('agora', estado, { final: false })
  assert.equal(r.comando, null)
  assert.equal(r.estado.fragmento, 'era')
})

test('"ja era" sem o "ai" também vira fragmento (já não é descartado no meio)', () => {
  const r = comandoDe('ja era', PICK)
  assert.equal(r.comando.tipo, 'fragmento')
  assert.equal(r.comando.texto, 'ja era')
})

test('"agora" solto em pick ainda abre o candidato do fragmento', () => {
  const estado = { modo: 'pick', acao: null, fragmento: 'era' }
  const r = comandoDe('agora', estado)
  assert.equal(r.comando.tipo, 'agora')
  assert.equal(r.comando.texto, 'era')
  assert.deepEqual(r.estado, { modo: 'normal', acao: null, fragmento: null })
})

test('"fila" solto em pick ainda enfileira o candidato do fragmento', () => {
  const estado = { modo: 'pick', acao: null, fragmento: 'era' }
  const r = comandoDe('fila', estado)
  assert.equal(r.comando.tipo, 'fila')
  assert.equal(r.comando.texto, 'era')
})