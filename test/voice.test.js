import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizar, palavras, casarFalaLinha, casarProximaLinha, consumirLinha,
  reconstruirFaladas, reclamarCauda, proximoPasso,
} from '../public/js/voice.js'

const LINHAS = [
  { idx: 0, texto: 'Quando a vida te bater forte' },
  { idx: 1, texto: 'E os sonhos se partirem ao meio' },
  { idx: 2, texto: 'Lembra que existe amor de verdade' },
]

test('normalizar remove acentos e baixa caixa', () => {
  assert.equal(normalizar('ÀÇÃO É lindo'), 'acao e lindo')
})

test('palavras remove pontuação e palavras vazias', () => {
  assert.deepEqual(palavras('Olá, como (você) está?'), ['ola', 'como', 'voce', 'esta'])
  assert.deepEqual(palavras(''), [])
})

test('casamento claro aponta para a linha certa', () => {
  const m = casarFalaLinha('lembra que existe amor de verdade', LINHAS)
  assert.ok(m)
  assert.equal(m.idx, 2)
})

test('fala com ruído ainda casa na linha dominante', () => {
  const m = casarFalaLinha('quando a vida te bater bem forte agora', LINHAS)
  assert.ok(m)
  assert.equal(m.idx, 0)
})

test('fala sem relação retorna null (abaixo do limiar)', () => {
  assert.equal(casarFalaLinha('vamos comprar pão na padaria', LINHAS), null)
})

test('fala vazia retorna null', () => {
  assert.equal(casarFalaLinha('', LINHAS), null)
})

test('maioria das palavras cantadas em linha longa casa', () => {
  const m = casarFalaLinha('e os sonhos se partirem ao meio novamente', LINHAS, 0.5)
  assert.ok(m)
  assert.equal(m.idx, 1)
})

const MUSICA_V2 = [
  { idx: 0, texto: 'Tem amores da vida' },
  { idx: 2, texto: 'Que não são pra vida' },
  { idx: 30, texto: 'A maior saudade' },
  { idx: 32, texto: 'De todos os tempos' },
  { idx: 34, texto: 'A maior saudade' },
  { idx: 60, texto: 'Tem amores da vida' },
  { idx: 62, texto: 'Que não são pra vida' },
]

test('a primeira ocorrência após a âncora é a escolhida (linhas idênticas)', () => {
  assert.equal(casarProximaLinha('a maior saudade', MUSICA_V2, 28).linha.idx, 30)
  assert.equal(casarProximaLinha('de todos os tempos', MUSICA_V2, 30).linha.idx, 32)
  assert.equal(casarProximaLinha('a maior saudade', MUSICA_V2, 32).linha.idx, 34)
})

test('âncora baixa procura a próxima ocorrência', () => {
  const m = casarProximaLinha('tem amores da vida', MUSICA_V2, 0)
  assert.equal(m.linha.idx, 60)
})

test('nunca volta para trás', () => {
  assert.equal(casarProximaLinha('tem amores da vida', MUSICA_V2, 62), null)
})

const SONHO = [
  { idx: 20, texto: 'Arrepia' },
  { idx: 22, texto: 'Dá gelo na barriga' },
  { idx: 24, texto: 'Me tira um sorriso bobo' },
  { idx: 34, texto: 'Arrepia' },
  { idx: 36, texto: 'Dá gelo na barriga' },
  { idx: 38, texto: 'Me tira um sorriso bobo' },
]

test('refrão repetido segue a primeira ocorrência na ordem', () => {
  const m = casarProximaLinha('arrepia dá gelo na barriga', SONHO, -1)
  assert.equal(m.linha.idx, 20)
})

test('refrão repetido avança para a segunda parte após passar a primeira', () => {
  const m = casarProximaLinha('arrepia', SONHO, 24)
  assert.equal(m.linha.idx, 34)
})

test('mais da metade da linha ainda casa adiante', () => {
  assert.equal(casarProximaLinha('da gelo', SONHO, 20).linha.idx, 22)
  assert.equal(casarProximaLinha('me tira um', SONHO, 22).linha.idx, 24)
})

test('menos da metade da linha não casa (não pula na frente)', () => {
  assert.equal(casarProximaLinha('da', SONHO, 20), null)
  assert.equal(casarProximaLinha('me ti', SONHO, 22), null)
  assert.equal(casarProximaLinha('sorriso', SONHO, 24), null)
})

test('fala sem relação com a próxima linha retorna null', () => {
  assert.equal(casarProximaLinha('vamos comprar pão na padaria', SONHO, -1), null)
})

test('consumirLinha avança até a borda da frase cantada', () => {
  const fw = palavras('arrepia da gelo na barriga me tira um')
  assert.equal(consumirLinha(fw, SONHO, 20, 0), 1)
  assert.equal(consumirLinha(fw, SONHO, 22, 1), 5)
})

test('consumirLinha não engole trecho distante por 1 palavra comum da âncora', () => {
  const fw = palavras('arrepia me tira um sorriso bobo dá gelo na barriga é que a gente é o sonho de todo casal')
  const linhas = [
    { idx: 0, texto: 'Eu já percebi que era você' },
    { idx: 1, texto: 'Arrepia' },
  ]
  assert.equal(consumirLinha(fw, linhas, 0, 5), 5)
})

test('reclamarCauda absorve só a cauda final da âncora, não o prefixo da linha seguinte', () => {
  const linhas = [
    { idx: 0, texto: 'Sorte a minha' },
    { idx: 1, texto: 'Sorte a nossa' },
  ]
  const fw = palavras('sorte a minha sorte a nossa')
  assert.equal(reclamarCauda(fw, linhas, 0, 3), 3)
  assert.equal(reclamarCauda(palavras('me tira um sorriso bobo'), [{ idx: 0, texto: 'Me tira um sorriso bobo' }], 0, 3), 5)
})

test('reclamarCauda exige alcançar a última palavra da âncora (cauda parcial não consume)', () => {
  const linhas = [
    { idx: 0, texto: 'Dá gelo na barriga' },
    { idx: 1, texto: 'Me tira um sorriso bobo' },
  ]
  assert.equal(reclamarCauda(palavras('da gelo na me tira um'), linhas, 0, 2), 2)
  assert.equal(reclamarCauda(palavras('da gelo na barriga me tira um'), linhas, 0, 2), 4)
})

test('reconstruirFaladas mantém consumido quando a utterance só cresce', () => {
  const r = reconstruirFaladas(palavras('arrepia da gelo na'), 0, 2, 4, palavras('arrepia da gelo na barriga'))
  assert.equal(r.consumido, 2)
  assert.equal(r.faladas.length, 5)
})

test('reconstruirFaladas re-ancora consumido quando interim é substituído (não pula cabeça nova)', () => {
  const r = reconstruirFaladas(palavras('me faz amar feito louco e a parte principal'), 0, 5, 9, palavras('é que a gente é o sonho de todo casal'))
  assert.equal(r.consumido, 0)
  assert.deepEqual(r.faladas, palavras('é que a gente é o sonho de todo casal'))
})

test('reconstruirFaladas preserva consumido do trecho congelado após final', () => {
  const ant = palavras('arrepia da gelo na barriga me tira um')
  const r = reconstruirFaladas(ant, 8, 8, 0, palavras('me tira um sorriso bobo'))
  assert.equal(r.consumido, 8)
  assert.deepEqual(r.faladas, [...ant, ...palavras('me tira um sorriso bobo')])
})

test('refrão em sequência não pula para as cópias seguintes (ordem pura)', () => {
  let faladas = []
  let finaisLen = 0
  const est = { consumido: 0, ultimoIdx: -1 }
  const seq = []
  const passos = [
    ['arrepia', false],
    ['arrepia da gelo', false],
    ['arrepia da gelo na', false],
    ['arrepia da gelo na barriga', true],
    ['arrepia da gelo na barriga me tira um', false],
    ['arrepia da gelo na barriga me tira um sorriso bobo', true],
    ['arrepia', false],
    ['arrepia da gelo', true],
  ]
  let ult = -1
  for (const [fala, final] of passos) {
    faladas = [...faladas.slice(0, finaisLen), ...palavras(fala)]
    proximoPasso(faladas, SONHO, est)
    if (est.ultimoIdx !== ult) {
      ult = est.ultimoIdx
      seq.push(ult)
    }
    if (final) finaisLen = faladas.length
  }
  assert.deepEqual(seq, [20, 22, 24, 34, 36])
})

const REFRAO_COMPLETO = [
  { idx: 0, texto: 'E a parte principal' },
  { idx: 1, texto: 'É que a gente é o sonho de todo casal' },
  { idx: 2, texto: 'E a parte principal' },
  { idx: 3, texto: 'É que a gente é o sonho de todo casal' },
]

test('melhor cobertura vence: linha curta não furta o match por 2 palavras soltas', () => {
  const m = casarProximaLinha(
    'é que a gente é o sonho de todo casal e a parte principal',
    REFRAO_COMPLETO,
    -1,
  )
  assert.ok(m)
  assert.equal(m.linha.idx, 1)
})

test('pular uma frase e continuar: reconhece adiante na ordem sem travar', () => {
  const est = { consumido: 0, ultimoIdx: -1 }
  const seq = []
  const passos = [
    'arrepia',
    'arrepia me tira um',
    'arrepia me tira um sorriso bobo',
    'arrepia me tira um sorriso bobo arrepia',
  ]
  let ult = -1
  for (const fala of passos) {
    proximoPasso(palavras(fala), SONHO, est)
    if (est.ultimoIdx !== ult) {
      ult = est.ultimoIdx
      seq.push(ult)
    }
  }
  assert.deepEqual(seq, [20, 24, 34])
  assert.equal(est.consumido, 7)
})

test('cauda da âncora chegando não segura a linha seguinte (anti-lento)', () => {
  const est = { consumido: 0, ultimoIdx: -1 }
  proximoPasso(palavras('arrepia'), SONHO, est)
  est.consumido = 3
  proximoPasso(palavras('arrepia da gelo na me tira um'), SONHO, est)
  assert.equal(est.ultimoIdx, 24)
  assert.equal(est.consumido, 7)
  proximoPasso(palavras('arrepia da gelo na me tira um sorriso bobo'), SONHO, est)
  assert.equal(est.ultimoIdx, 24)
  assert.equal(est.consumido, 9)
})

const REFRAO_MUSICA = [
  { idx: 0, texto: 'E a parte principal' },
  { idx: 1, texto: 'É que a gente é o sonho de todo casal' },
  { idx: 2, texto: 'Arrepia' },
]

test('última linha longa do refrão reconhece mesmo com cauda da âncora chegando (relato)', () => {
  const est = { consumido: 4, ultimoIdx: 0 }
  proximoPasso(
    palavras('e a parte principal é que a gente é o sonho de todo casal'),
    REFRAO_MUSICA,
    est,
  )
  assert.equal(est.ultimoIdx, 1)
})

test('linha longa reconhece com ~45% das palavras, sem exigir ordem (não lento)', () => {
  const m = casarProximaLinha('a gente é o sonho', REFRAO_MUSICA, -1)
  assert.ok(m)
  assert.equal(m.linha.idx, 1)
  assert.ok(m.score >= 5 / 10)
})