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

const colapso = (l) => l.replace(/\s+/g, ' ').trim()

test('deDecParaLinhas usa o mapa padrão do ALWAYS', () => {
  const tmp = tituloDeDec('0 Always\n3 3 4 5 6 4\n')
  assert.equal(tmp, 'Always')
  const sem = codigosSemAcorde('3 3 4 5 6 7 8 9 : ; < = > ? @', DEC_CODES_PADRAO)
  assert.deepEqual([...sem], [])
  const linhas = deDecParaLinhas('0 Always\n3 33333333333333333333333333 4 5 6 4\n2 \n2 This Romeo is bleeding\n', DEC_CODES_PADRAO)
  assert.deepEqual(linhas, ['A5 C#5 B5 A5', 'This Romeo is bleeding'])
})

test('deDecParaLinhas casa a metadata com os códigos por índice (NO DIA)', () => {
  const cifra = [
    '0 No Dia Em Que Eu Sai De Casa',
    '3 3333333333333333333333333 3 4 5 4 5',
    '3 3333333333333333333333333   5',
    '2 No dia em que eu sai de casa',
    '2 Minha mae me disse',
    '3 3333333333333333333333333            6',
    '2 Filho, vem ca',
    '3 3333333333333333333333333    4',
    '2 Passou a mao em meus cabelos',
    '2 Olhou em meus olhos',
    '3 3333333333333333333333333           5',
    '2 Comecou falar',
    '3 3333333333333333333333333           6',
    '8 Eu sei que ela nunca compreendeu',
    '3 3333333333333333333333333                            5',
    '8 Os meus motivos de sair de la',
    '3 3333333333333333333333333                              4',
    '8 Mas ela sabe que depois que cresce',
    '2 ',
    '2 ',
    '2 ',
    '2 ',
    '2 ',
    '3 3333333333333333333333333              6                  5',
    '8 O filho vira passarinho e quer voar',
    '2 ',
    '2 ( Em  A  D  A  D )',
    '2 ',
    '2 [Segunda Parte]',
    '2 ',
    '2 A minha mae naquele dia',
    'Efm 12 7523 3000 3300',
    'Af 1 643 3072 2701',
    'Df 1 843 2826 2103',
    'Gf 1 1043 3417 5400',
    'Df7 25 15243 2718 2103',
  ].join('\n')
  const saida = deDecParaLinhas(cifra)
  assert.deepEqual(saida.map(colapso), [
    'Em A D A D',
    'D',
    'No dia em que eu sai de casa',
    'Minha mae me disse',
    'G',
    'Filho, vem ca',
    'A',
    'Passou a mao em meus cabelos',
    'Olhou em meus olhos',
    'D',
    'Comecou falar',
    '[Refrão]',
    'G',
    'Eu sei que ela nunca compreendeu',
    'D',
    'Os meus motivos de sair de la',
    'A',
    'Mas ela sabe que depois que cresce',
    '',
    '',
    '',
    '',
    '',
    '[Refrão]',
    'G D',
    'O filho vira passarinho e quer voar',
    '',
    '( Em A D A D )',
    '',
    '[Segunda Parte]',
    '',
    'A minha mae naquele dia',
  ])
})

test('deDecParaLinhas usa a metadata na ordem das chaves mesmo sem códigos contíguos (ALWAYS)', () => {
  const cifra = [
    '0 Always',
    '3 33333333333333333333333333 4 5 6 4',
    '2 ',
    '2 This Romeo is bleeding',
    '3 33333333333333333333333333         3   6',
    '2 Final chord',
    'Ef5 1 923 990 3300',
    'Af5 1 643 3072 2701',
    'Cs5 1 812 36435 4927',
    'Bf5 1 723 38289 6781',
    'Csm 12 7412 36444 2536',
    'Ef/G# 1 927 1335 5582',
    'Af9 2 1243 3072 6301',
    'Ef9 2 1523 963 3003',
    'Af 1 643 3072 2701',
    'Bf 1 723 38289 6781',
    'Fs5 1 1003 47307 4698',
    'Df5 1 843 2826 2103',
    'Gf5 1 1043 3417 5400',
    'Bf5/A 25 15124 32700 9002',
  ].join('\n')
  const saida = deDecParaLinhas(cifra)
  assert.deepEqual(saida.map(colapso), [
    'A5 C#5 B5 A5',
    'This Romeo is bleeding',
    'E5 B5',
    'Final chord',
  ])
})

test('deDecParaLinhas repete o 1º acorde da intro (ciclo distinto) p/ os versos só com o 2º acorde (Amo)', () => {
  const cifra = [
    '0 Amo Noite e Dia',
    '3 3333333333333333333333333 3 4 5 6',
    '2 ',
    '3 33333333333333333333333333 4',
    '2 Tem um pedaço do meu peito',
    '2 Bem colado ao teu',
    '3 33333333333333333333333337 6',
    '2 Teu jeito tão gostoso de me abraçar',
    '3 3333333333333333333333333 46',
    '2 Não aguento mais',
    'Efm 12 7523 3000 3300',
    'Cf9 2 1363 5226 3001',
    'Gf 1 1043 3417 5400',
    'Df4 16 9855 36435 4981',
    'Gf5 1 1043 3417 5400',
  ].join('\n')
  const saida = deDecParaLinhas(cifra)
  assert.deepEqual(saida.map(colapso), [
    'Em C9 G D4',
    'Em C9',
    'Tem um pedaço do meu peito',
    'Bem colado ao teu',
    'G5 D4',
    'Teu jeito tão gostoso de me abraçar',
    'C9 D4',
    'Não aguento mais',
  ])
})

test('deDecParaLinhas NÃO repete o 1º acorde quando a intro tem acordes repetidos (No Dia)', () => {
  const cifra = [
    '0 No Dia Em Que Eu Sai De Casa',
    '3 3333333333333333333333333 3 4 5 4 5',
    '3 3333333333333333333333333   5',
    '2 No dia em que eu sai de casa',
    '3 3333333333333333333333333    4',
    '2 Passou a mao em meus cabelos',
    'Efm 12 7523 3000 3300',
    'Af 1 643 3072 2701',
    'Df 1 843 2826 2103',
    'Df7 25 15243 2718 2103',
  ].join('\n')
  const saida = deDecParaLinhas(cifra)
  assert.deepEqual(saida.map(colapso), [
    'Em A D A D',
    'D',
    'No dia em que eu sai de casa',
    'A',
    'Passou a mao em meus cabelos',
  ])
})

test('deDecParaLinhas devolve a régua p/ a 1ª letra não vazia e lê acordes colados', () => {
  const cifra = [
    '0 X',
    '3 3333333333333333333333333 4 5 6 4',
    '2 ',
    '2   lyric pra frente',
    '3 33333333333333333333333338',
    '2   To touch your lips',
    '3 3333333333333333333333333 46',
    '2 Nao aguento mais',
  ].join('\n')
  const saida = deDecParaLinhas(cifra, DEC_CODES_PADRAO)
  assert.equal(saida[0], 'A5 C#5 B5 A5')
  assert.equal(colapso(saida[1]), 'lyric pra frente')
  assert.equal(saida[2], 'E/G#')
  assert.equal(colapso(saida[3]), 'To touch your lips')
  assert.equal(saida[4], 'A5 B5')
  assert.equal(saida[5], 'Nao aguento mais')
})