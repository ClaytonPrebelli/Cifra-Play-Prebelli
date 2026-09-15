---
name: formato-cifra
description: Use when implementing, fixing, or extending parsing of .txt cifra files (chord/lyric detection, section markers, positional chord anchoring, transpose). Also use when creating or validating sample cifra files, parser tests, or golden test fixtures in this project.
---

# Skill: formato-cifra

Regras para o parser/transpositor de arquivos de cifra do projeto.
Spec de referência: `docs/formato-cifra.md`. Comece lendo esse doc antes de
mudar o parser.

## Papel no projeto

- `public/js/parser.js` — módulo **puro** (sem DOM): `.txt` → `CifraModel`.
- `public/js/transpositor.js` — módulo **puro**: transposição em semitons.
- `test/parser.test.js` / `test/transpositor.test.js` — testes **golden**.

## Arquivo

`musicas/<Artista> - <Música>.txt`, separador = primeiro ` - `. Sem ` - `, o
nome todo é o título, artista vazio.

## Classificação de linhas (na ordem)

1. `Tom: <Nota>` (case-insensitive) → meta: tom de referência, base do offset 0.
2. Linha inteira entre `[`...`]` (ex.: `[Refrão]`) → **seção** (vermelho), nunca
   é acorde/letra.
3. **Todos** os tokens separados por espaços são acordes válidos → **linha de
   acordes** (sempre acima de uma letra).
4. Caso contrário → **linha de letra** (pode ter acordes inline `[C]`/`(C)`,
   extraídos e ancorados à palavra seguinte, removidos do texto).
5. Metadados tipo `Alvo: G`, `Compasso: 4/4` → descartados do conteúdo.

Desambiguação: `[Refrão]` é seção (não é acorde); `[C]` em linha própria é
acorde.

## Regex de acorde (use e não reinvente)

```
^[A-G](#|b)?(?:(?:maj7?|min7?|M7?|m|dim|aug|\+|°)(?:2|4|6|7|9|11|13)?|sus(?:2|4)?|add[2-9]?|7M(?:6|9|11|13)?|2|4|6|7|9|11|13)?(?:\([^)]*\))?(?:/[A-G](#|b)?)?$
```

`bb` não é aceito — normalizar. Extrair `tonica`, `sufixo`, `baixo` (após `/`).
Transposição muda `tonica` e `baixo`; `sufixo` permanece.
`2`/`4` sozinhos são sufixo válido (ex.: `D2`, `A2`, `B2` — o "2" do Cifra
Club, add2); linhas de acordes com `D2` NÃO viram letra (regressão:
`golden: D2/A2/B2 são linha de acordes`).

Casos de fronteira: `Am F C G` é acordes; `Amor é fogo` é letra;
`C com você` é letra; letra maiúscula isolada válida (`C`, `D`) é acorde.

## Âncora posicional

Linha de acordes + linha de letra abaixo: acorde na coluna `col` ancora-se à
palavra `wi` tal que `inicio(wi) ≤ col < inicio(wi+1)`; se `col` antes da
primeira palavra, ancora em `w1`. Reflow em 3 colunas NUNCA separa acorde da
palavra ancorada.

## Transposição

Mapa cromático de 12 semitons (`C C# D D# E F F# G G# A A# B`). Nota +offset
→ nota; normalizar `b` para `#` na comparação; exibição default com `#`
(enharmonia: `Bb` +2 → `C`, `E` +4 → `G#`). Baixo invertido transpõe junto.

## Testes (obrigatórios ao mexer no parser/transpositor)

- Golden: exemplo real → modelo esperado (seções, acordes ancorados, tom).
- Mapas de transposição com sufixo e baixo preservados.
- Fronteiras: acorde de 1 letra vs. preposição; `[Refrão]` vs `[C]`; acorde
  antes da 1ª palavra (ancora em `w1`).
- Rodar `npm test`; nada de comentários em código.

## Consumo pelo assistente de voz (`voice.js`)

- As "linhas de letra" do modelo (items de `conteudo[]` com `letra` não vazio)
  são a lista que o pareamento de voz usa; a linha renderizada tem classe
  `.frase` e `data-idx = posição no modelo`. Linhas só-acorde ficam de fora.
- `normalizar()` (sem acento, minúsculo) + `palavras()` do `voice.js` é o mesmo
  tratamento aplicado a letra e à fala — usar essa normalização ao comparar
  texto de letra com transcrição, jamais as strings cruas.