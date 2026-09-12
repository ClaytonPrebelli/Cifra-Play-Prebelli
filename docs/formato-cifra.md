# Formato da cifra (.txt) — spec do parser

Fonte da verdade do **conteúdo** de cada música. É o formato Cifra Club
(acordes em linhas separadas, alinhados por posição acima da letra).

> 1 arquivo por música em `musicas/`, sem banco. Metadados (título, artista,
> ordem, preferências) ficam no `catalog.json`, **não** no txt.

## 1. Nome do arquivo

```
musicas/<Artista> - <Música>.txt
```

- O separador é o **primeiro** ` - ` (hífen cercado por espaços).
- Se não houver ` - `, o nome inteiro é o título e o artista fica vazio.
- O `id` no catálogo é o nome do arquivo completo (incluindo `.txt`).

## 2. Estrutura do arquivo

```
[linha Tom (opcional)]
[vazio]
[[Seção]]
[linha de acordes]
[linha de letra]
...
[vazio]
...
```

Exemplo de referência:

```
Tom: C

[Intro]
Am  F  C  G

[Verso 1]
Am              F
Quando a noite chegar
G               C
E o sol se puser

[Refrão]
F            G
Eu vou cantar
C            Am
Pra te lembrar
```

## 3. Linha Tom (opcional)

- Primeira linha útil do arquivo, padrão `Tom: <Nota>` (aceita `Tom:` com
  espaços variáveis, case-insensitive). Aceita acidente: `Tom: F#`, `Tom: Bb`.
- Define o tom de referência: base do offset 0 de transposição e o valor
  exibido como "Tom:" na tela.
- Outras linhas-chave antes do conteúdo (ex.: `Alvo:`, `Compasso:`) são
  **ignoradas** no modo de exibição na v1 (não viram acorde nem letra).

## 4. Seções (destaque vermelho)

- Uma linha **inteira** que começa com `[` e termina com `]` — ex. `[Refrão]`,
  `[Verso 1]`, `[Ponte]`, `[Intro]`, `[Solo]`, `[Final]`.
- NUNCA é acorde nem letra; renderiza em **vermelho**, caixa alta, centralizado.
- Desambiguação com acorde inline: `[Refrão]` é seção porque `Refrão` não é um
  acorde válido. `[C]` em linha própria seria um acorde (ver §6).

## 5. Classificação de linhas

Cada linha útil (não vazia) é classificada por este algoritmo:

1. É linha Tom → **meta** (apenas informação).
2. É linha de seção ([...] em linha própria) → **seção**.
3. **Todos** os tokens da linha, separados por espaços, são acordes válidos
   (ver §6) → **linha de acordes** (acima de uma letra).
4. Senão → **linha de letra** (pode conter acordes inline, ver §7).

### Regras de fronteira letra × acorde

- "Am F C G" (4 tokens, todos acordes) → linha de acordes.
- "Amor é fogo que arde" → linha de letra ("Amor", "fogo", "que" não são acordes).
- "C com você" → linha de letra ("com"/"você" não são acordes). **Cuidado:** uma
  única letra maiúscula isolada (ex.: `C`) conta como acorde se bater o padrão.

## 6. Padrão de acorde (regex)

```
^[A-G](#|b)?                     # tônica + acidente
 (?:
    (?:maj7?|min7?|M7?|m|dim|aug|\+|°)   # sufixo base
    (?:6|7|9|11|13)?                     # extensões numéricas
  | sus(?:2|4)? 
  | add[2-9]?
  | 6|7|9|11|13                          # extensões diretas
 )?
 (\([^)]*\))?                     # anotações: (b5), (add9), (9+)
 (/[A-G](#|b)?)?                  # baixo invertido: C/E, D/F#
$
```

Tokenize depois compactando espaços múltiplos em um. Notas válidas:
`C D E F G A B` e variantes `C# Db` etc. (`bb` não é aceito; normalizar).

### Extração do acorde

Dado um token, extrair: `tonica` (ex.: `C#`), `sufixo` (ex.: `m7b5`), e
`baixo` (nota após `/`). A transposição muda **tonica e baixo**; sufixo fica.

## 7. Acordes inline (extensão de compatibilidade)

Dentro de uma **linha de letra**, `[C]` ou `(C)` com acorde válido dentro:
- O acorde é extraído e **removido do fluxo de texto** (não aparece no canto).
- É ancorado à próxima palavra que o segue.
- Ambiguidade resolvida na §4/§5: linha própria = seção se o conteúdo não for
  acorde; dentro de linha com texto = acorde inline.

## 8. Âncora posicional acorde → palavra

Lado linha de acordes + linha de letra imediatamente abaixo dela:

- Lista palavras da linha de letra com suas colunas de início (índice levando
  em conta que acordes usam espaço duplo; a coluna vem do texto bruto).
- Cada acorde da linha de acordes está na coluna `col`. Encontra a palavra
  `wi` tal que `inicio(wi) ≤ col < inicio(w(i+1))`.
- Se `col < inicio(w1)` (acorde antes da primeira palavra), ancora em `w1`.
- Se não há linha de letra abaixo (acordes no fim), ancoram-se à própria linha
  (render como linha apenas de acordes, posicionamento livre).

**Na renderização em 3 colunas**: a palavra é transportada com seu acorde (o
acorde renderiza logo acima da palavra, sempre junto dela) — a reflow das
colunas NÃO quebra esse vínculo.

> Ajuste fino da regra (folga de coluna, prefixos de sílaba) é área aberta;
> testes de golden (amostras de cifra → modelo esperado) fixam o comportamento.

## 9. Linhas em branco

- Separam blocos. Múltiplas seguidas colapsam para 1 na renderização.
- Preservam a separação de estrofes.

## 10. Outras linhas-chave (convenção de tolerância)

Padrões de metadata comumente presentes em arquivos de cifra (ex. `Alvo: G`,
`Compasso: 4/4`) são detectados e **descartados** do conteúdo exibível
(ignorados), sem quebrar o parser. Detecção: começo-de-linha com palavra
seguida de `:` e pouca extensão.

Exceção: `Estilo: <nome>` (separadores `,` ou `;`) é **reconhecida** — vira o
campo `estilos` do catálogo na importação/scan (a linha continua descartada do
conteúdo exibível). `Estilo: Rock, Sertanejo Universitário` → `["Rock",
"Sertanejo Universitário"]`.

## 11. Testes obrigatórios (golden)

Qualquer mudança no parser ou no transpositor deve manter verdes os testes em
`test/`:
- `parser.test.js` — amostras-golden: arquivo de exemplo → modelo esperado
  (seções, acordes ancorados, tom).
- `transpositor.test.js` — mapas de transposição: `C` +2 → `D`; sufixo e baixo
  (`Dm7/G`) preservados; enharmonia (`Bb` +2 → `C`; `E` +4 → `G#`).
- Casos de fronteira: linha com acorde de 1 letra vs. preposição; `[Refrão]`
  (seção) vs. `[C]` (acorde); acorde antes da 1ª palavra.