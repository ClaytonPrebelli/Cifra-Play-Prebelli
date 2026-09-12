import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCifra, parseChord } from '../public/js/parser.js'

const TXT = `Tom: Bb

Estilo: Rock, Românticas
Alvo: G

[Intro]
Bb  F  Cm7

[Verso]
Bb                    F
Quando o dia amanhecer
Cm7
E a chuva passar

[Refrão]
F             G
Eu vou cantar (Dm) pra você

[Final]
C
`

test('golden: cifra completa vira modelo esperado', () => {
  const m = parseCifra(TXT)
  assert.equal(m.tom, 'Bb')
  assert.deepEqual(m.estilos, ['Rock', 'Românticas'])

  assert.deepEqual(m.conteudo.map((i) => (i.tipo === 'secao' ? i.nome : null)), [
    'Intro', null, 'Verso', null, null, 'Refrão', null, 'Final', null,
  ])

  const [intro, v1, v2, refrao, final] = m.conteudo.filter((i) => i.tipo === 'compasso')

  assert.deepEqual(intro.acordes.map((a) => `${a.tonica}${a.sufixo}`), ['Bb', 'F', 'Cm7'])
  assert.equal(intro.letra, null)
  assert.equal(intro.vinculos.length, 0)

  assert.equal(v1.letra, 'Quando o dia amanhecer')
  assert.deepEqual(v1.palavras.map((p) => p.texto), ['Quando', 'o', 'dia', 'amanhecer'])
  assert.deepEqual(v1.vinculos, [
    { acorde: 0, palavra: 0 },
    { acorde: 1, palavra: 3 },
  ])

  assert.equal(v2.letra, 'E a chuva passar')
  assert.deepEqual(v2.vinculos, [{ acorde: 0, palavra: 0 }])

  assert.equal(refrao.letra, 'Eu vou cantar  pra você')
  assert.deepEqual(refrao.palavras.map((p) => p.texto), ['Eu', 'vou', 'cantar', 'pra', 'você'])
  assert.deepEqual(refrao.vinculos, [
    { acorde: 0, palavra: 0 },
    { acorde: 1, palavra: 2 },
  ])
  assert.equal(refrao.inline.length, 1)
  assert.equal(refrao.inline[0].acorde.tonica, 'D')
  assert.equal(refrao.inline[0].acorde.sufixo, 'm')
  assert.equal(refrao.inline[0].palavra, 3)

  assert.deepEqual(final.acordes.map((a) => a.col), [0])
  assert.equal(final.letra, null)
})

test('seção vs acorde entre colchetes', () => {
  const m = parseCifra('[Refrão]\n\n[C]\n\n[C G]\n\nX\n')
  assert.equal(m.conteudo[0].tipo, 'secao')
  assert.equal(m.conteudo[0].nome, 'Refrão')
  assert.equal(m.conteudo[1].tipo, 'compasso')
  assert.equal(m.conteudo[1].acordes[0].tonica, 'C')
  assert.equal(m.conteudo[2].acordes.length, 2)
  assert.equal(m.conteudo[2].acordes[1].tonica, 'G')
})

test('fronteira: letra com C maiúsculo não é linha de acordes', () => {
  const m = parseCifra('C com você\n\nAm F C G\n')
  assert.deepEqual(m.conteudo[0].acordes, [])
  assert.equal(m.conteudo[0].letra, 'C com você')
  assert.equal(m.conteudo[1].letra, null)
  assert.equal(m.conteudo[1].acordes.length, 4)
})

test('fronteira: "Amor é fogo" é letra e nota isolada é acorde', () => {
  const m = parseCifra('Amor é fogo que arde\n\nDm\n')
  assert.equal(m.conteudo[0].letra, 'Amor é fogo que arde')
  assert.equal(m.conteudo[1].acordes[0].tonica, 'D')
})

test('âncora: acorde antes da primeira palavra ancora em w1', () => {
  const m = parseCifra('F              G\nMeu\n')
  const [c] = m.conteudo.filter((i) => i.tipo === 'compasso')
  assert.deepEqual(c.vinculos, [
    { acorde: 0, palavra: 0 },
    { acorde: 1, palavra: 0 },
  ])
})

test('parseChord extrai tonica, sufixo, anotação e baixo', () => {
  assert.deepEqual(parseChord('Dm7/G'), {
    texto: 'Dm7/G', tonica: 'D', sufixo: 'm7', baixo: 'G', anotacao: null,
  })
  assert.deepEqual(parseChord('C#m7(b5)'), {
    texto: 'C#m7(b5)', tonica: 'C#', sufixo: 'm7', baixo: null, anotacao: '(b5)',
  })
  assert.deepEqual(parseChord('C(add9)'), {
    texto: 'C(add9)', tonica: 'C', sufixo: '', baixo: null, anotacao: '(add9)',
  })
  assert.equal(parseChord('A°').sufixo, '°')
  assert.equal(parseChord('Amaj7').sufixo, 'maj7')
  assert.equal(parseChord('Bb').tonica, 'Bb')
  assert.equal(parseChord('com'), null)
  assert.equal(parseChord('C/'), null)
  assert.equal(parseChord('H7'), null)
})

test('tom case-insensitive normaliza para maiúsculo', () => {
  assert.equal(parseCifra('tom: c\n\nC\n').tom, 'C')
  assert.equal(parseCifra('Tom: F#\n\nC\n').tom, 'F#')
  assert.equal(parseCifra('C\n').tom, null)
})

test('linhas-chave Alvo/Compasso são descartadas do conteúdo', () => {
  const m = parseCifra('Alvo: G\nCompasso: 4/4\n\n[Refrão]\nC\n')
  assert.equal(m.conteudo.length, 2)
  assert.equal(m.conteudo[0].tipo, 'secao')
  assert.equal(m.conteudo[1].tipo, 'compasso')
})

test('estilos separados por vírgula ou ponto-e-vírgula', () => {
  assert.deepEqual(parseCifra('Estilo: Rock; Sertanejo Universitário\n\nC\n').estilos, [
    'Rock', 'Sertanejo Universitário',
  ])
})

test('CRLF e BOM são normalizados', () => {
  const m = parseCifra('\uFEFFTom: C\r\n\r\n[Intro]\r\nAm  F\r\n')
  assert.equal(m.tom, 'C')
  assert.equal(m.conteudo[0].nome, 'Intro')
  assert.equal(m.conteudo[1].acordes.length, 2)
})

test('acorde final comentário inline com texto não-acorde permanece', () => {
  const m = parseCifra('Era (um caso) sério\n')
  const [c] = m.conteudo.filter((i) => i.tipo === 'compasso')
  assert.equal(c.letra, 'Era (um caso) sério')
  assert.equal(c.inline.length, 0)
})