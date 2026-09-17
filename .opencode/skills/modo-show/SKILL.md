---
name: modo-show
description: Use when implementing or changing the presentation screen (modo show): 3-column rendering, section highlight, teleprompter auto-scroll, per-song scroll speed/transpose preferences, keyboard shortcuts, the next-song flow, and the voice assistant for real-time lyric following. Also use when writing render.js, scroller.js, show.js, or voice.js.
---

# Skill: modo-show

Tela de apresentação (o coração do app): máxima área para a cifra, rolamento
automático estilo teleponto, transposição por música. Spec de referência:
`docs/arquitetura.md` (§5–§7). Leia antes de implementar.

## Princípios

- **Minimalismo**: navbar mínima (voltar, título, tom, controles de
  velocidade/rolagem). Sem sidebar. Foco total na cifra.
- **Fundo escuro, fonte grande, alto contraste** (palco).
- 3 colunas de letra; seções `[Refrão]` em **vermelho**, caixa alta, central.

## Módulos

- `public/js/render.js` — `CifraModel` (já transposto) → DOM. Impressão
  **literal** das colunas do arquivo: monoespaçada + `white-space: pre`; cada
  compasso vira a linha de acordes e/ou a linha de letra como no `.txt`
  (recuos e espaços internos preservados), acorde na coluna `col` de origem.
  `ajustarFonte` encolhe o corpo para a linha mais longa caber na coluna.
- `public/js/scroller.js` — o app divide a cifra em **páginas** que nunca partem
  um verso (verso inteiro cabe sempre). Avanço automático página a página
  (velocidade = segundos por página). Motor `requestAnimationFrame`.
- `public/js/show.js` — estado do show (página ativa, rolagem, velocidade),
  atalhos, fluxo "próxima música".

## Preferências por música

Sempre resolvidas como `prefs ↑ globais ↑ defaults` (prefs da música vence):
`tomOffset` (semitons), `velocidade` (segundos/página), `rolagem` (bool),
`colunas` (1|2|3). Alteração na UI persiste via `POST /api/catalog`
(imediato ou debounced, nunca bloqueante na tocação).

## Atalhos de referência (fechar na implementação)

- `Espaço` — pausar/retomar rolagem automática.
- `←` / `→` — página anterior / próxima página.
- `Shift+→` (ou confirmação no fim) — próxima música do setlist, retomando a
  rolagem se estava ativa.
- `Esc` — voltar para a lista.

## Fluxo "fim de música"

Ao chegar na última página: opção de avançar para a próxima música da lista
**ordenada** (catálogo). Carrega a cifra, aplica as prefs da música e retoma a
rolagem. NUNCA gera scroll/estado inconsistente ao trocar de música — reset
limpo do scroller.

## Voz (fase 5) — pareamento fala × linha (EM DESENVOLVIMENTO)

> Handoff para outra IA: **captação de voz NÃO mexe mais na rolagem** — o usuário
> desistiu da rolagem automática por captação (pedido explícito: "desative a
> rolagem automática por captação"). Em `show.js`, o callback `onPagina` da voz
> virou no-op (`() => {}`); a voz apenas destaca a linha cantada (classe
> `.voz-atual`) sem mover páginas. O matcher (v11) continua valendo na classe
> `.voz-atual`; a página segue só manual (setas/rolagem automática por tempo).
> NÃO reintroduzir `scroller.irPara` no `onPagina` sem conversa com o usuário.

### Estado v11 (pareamento fala × linha)

> Relato do v10: "tem frases que ele não reconhece (mais curtas) e aí ele não
> continua, não reconhece as próximas". Causas: o `consumido` (posição absoluta em
> `faladas[]`) ficava viciado quando o STT substitui uma utterance (interim/final)
> por outra mais curta/diferente — pulava as primeiras palavras da nova utterance
> (a linha longa "É que a gente é o sonho de todo casal" nunca casava e o âncora
> travava); e `consumirLinha` comia o prefixo da linha seguinte compartilhado com a
> âncora (ex.: âncora "Sorte a minha" engolia "sorte a" de "Sorte a nossa", que
> ficava com 2 palavras < 3 exigidas). **v11 = cauda só com linha âncora completa
> (`reclamarCauda`) + realinhamento de `consumido` em substituição de utterance
> (`reconstruirFaladas`)**; `consumirLinha` voltou a ser usado SÓ após um match
> (BFS), sem `LACUNA_MAX`.
>
> Relato posterior (v11, "Agarrada em mim"): no cumulativo (utterance única do
> refrão), o âncora pulou da 1ª pra 2ª cópia do refrão (idx 19→40) com só 2 palavras
> da linha na janela ("pressa de") — avanço no meio da linha casa uma CÓPIA da
> linha atual ainda sendo cantada e a página voa. FORA DO ESCOPO atual (rolagem
> desativada); se voltar a mexer, o candidato de fix é bloquear avanço enquanto as
> palavras não-consumidas forem todas do âncora.

### Contrato atual

- `public/js/voice.js` → `createVoice(modelo, rows, paginas, onPagina, onNivel, onStatus)`
  retorna `api { iniciar, parar, ativo, disponivel }`.
  `onPagina(pagina, confirmado)` — **no-op em `show.js`** (rolagem por captação
  desativada; só o destaque de linha `.voz-atual` continua).
- `show.js` acopla: botão liga/desliga; highlight da linha cantada via classe
  `.voz-atual` (sublinhado no `.pw-texto`). **Nenhum `scroller.irPara` vindo da voz.**

### Parser de comandos de voz (`comandosVoz.js`)

Módulo **puro** (sem DOM), gera os comandos que `show.js` executa via
`tratarVoz`. Entrada: `comandoDe(fala, estado)` → `{ comando, estado }`.
Toda comparação usa `palavrasVoz` (normalização: lowercase, sem acento, só
`[a-z0-9]`). Conjuntos de gatilho: `ATIVA` (ativa/ativar), `CANCELA`
(cancelar/desativa/sai/esquece/...), `ROLA`+`BAIXO`/`ALTO`, `MUDA`+`proxima`,
`AGORA`/`FILA`, `SIM`, `BUSCA`.

Fluxo `state.modo`:
- `normal` — virar comandos de rolagem, próxima, ficar esperando `fragmento`
  (palavras do candidato são capturadas em `estado.fragmento`) ou, se a fala
  tem `AGORA`/`FILA`, disparar a execução imediata/em fila do candidato.
- `pick` — aguarda confirmação do candidato da busca; aceita `SIM`
  (confirmar), `CANCELA` (cancelar e voltar a `normal`) e re-arm:
  **`ATIVA` → `{ comando: { tipo: 'ativa' }, estado }` (no-op de re-arm)**.
  Este guard é **anterior** ao `trechoDe`/`fragmento`: repetir "ativa busca"
  já em `pick` **rearma** (sem preencher nada) em vez de virar `fragmento
  "busca"`, que era o bug do campo enchido sozinho com a repetição da mesma
  frase (ver relato do usuário: repetia por falta de feedback visual).

`show.js` → `tratarVoz(e)` (handler assíncrono por `e.tipo`):
- `rolar` → `scroller.irPara(ativa ± 1)`;
- `muda-proxima` → `proximaMusica()`;
- `fragmento` → preenche `buscaEl.value` + `buscarMusicas()` (filtra a lista).
  **Só dispara com um candidato real** (nome de música dito em `pick`); a palavra
  solta "busca" **nunca** é comando — `comandoDe` só emite `fragmento` com o
  `texto` vindo de um trecho que NÃO é o gatilho `ATIVA` (re-arm de "ativa
  busca" já em `pick` vira no-op, ver guard em `comandosVoz.js`).
- `agora`/`fila` → abre ou enfileira o candidato (via `candidatosDeVoz`);
- `sim` → abre o candidato destacado;
- `cancelar` → `fecharBusca(true)`;
- **`ativa` → abre/foca/`select()` em `buscaEl`** — o sinal visual de que o
  modo de busca por voz está armado (espelha o atalho de teclado `/`).

### Matcher puro (módulo sem DOM, testável)

`casarProximaLinha(fala, linhas, ref)`:
- retorna `{ linha, score }` (melhor cobertura) ou `null`;
- `score = casadas / lw.length`; empate (mesmo score) fica com a linha de **menor
  idx** → cópias idênticas seguem a primeira ocorrência na ordem;
- `fw = palavras(fala)`; percorre `linhas` **em ordem de índice**;
- descarta `l.idx <= ref` (nunca re-casa a âncora — garante "não volta");
- **sem páginas**: nenhum `paginaDe/horizonte` — ordem é a única fonte pra cópias
  idênticas;
- `cabeca = fw.slice(0, Math.max(8, lw.length + 4))` (janela de palavras);
- conta `casadas` = **palavras da linha presentes em `cabeca`** (contagem simples
  com `includes`, **SEM ordem** — subsequência estrita não reconhecia a linha de 10
  palavras quando o STT deixava cair/deslocar "é que a", "a");
- **exigência** (rápida + segura): `exigidas = lw.length <= 3 ? lw.length : Math.max(2, Math.round(lw.length * 0.45))`
  — linhas curtas (≤3) exigem o texto completo; linhas de 4+ reconhecem com ~45%
  (mínimo 2 palavras) → reage no ritmo do canto, sem casar por palavra solta;
- **melhor cobertura** (não primeira que encaixa): uma linha curta que furta 2
  palavras soltas (ex.: "E a parte principal" por "e a") NÃO ganha da linha que o
  usuário realmente cantou quando ela tem maior fração casada (regressão:
  `melhor cobertura vence`).

`proximoPasso(faladas, linhas, estado)` — **máquina de um chunk** (usado por
`createVoice` e pelos testes; muta `estado { consumido, ultimoIdx }` e o retorna):
1. clamp em `consumido`; `consumido = reclamarCauda(...)` (absorve a cauda da âncora
   ANTES de casar **mas SÓ se a linha âncora for alcançada completa**);
2. `alvo = faladas.slice(consumido).join(' ')`;
3. `m = casarProximaLinha(alvo, linhas, ultimoIdx)`; avança se `m && m.linha.idx > ultimoIdx`
   (**sem trava — a regra de melhor cobertura já segura o avanço por palavra solta**);
4. avança **UM match por chunk** (nunca marcha pela música inteira), depois
   `consumirLinha` de novo até a borda da frase casada (BFS, sem `LACUNA_MAX`).

`reclamarCauda(faladas, linhas, idx, consumido)` (exportada):
- SÓ avança `consumido` se a **linha âncora inteira** é alcançada a partir de
  `consumido`: percorre as palavras da âncora in-order com `indexOf(w, qi+1)` e
  **exige chegar à última palavra** (`ultimoLw === lw.length - 1`); lacuna entre
  palavras ≤ `LACUNA_MAX = 6`;
- se a última palavra da âncora não aparece, **não consome nada** (a cauda do
  usuário ainda está na frase em construção — consumir o prefixo dela deixava a
  linha seguinte com poucas palavras para casar: linhas ≤3 exigem o texto completo);
- evita casar a linha âncora "de novo" com a cópia seguinte: após a âncora,
  complementa até a próxima frase inteira recuperável.

`consumirLinha(faladas, linhas, idx, consumido)` (exportada):
- usada no passo 4 (pós-match) para **borda da frase casada** (BFS: última
  ocorrência alcançável da última palavra da linha, in-order a partir de
  `consumido`, absorvendo palavras atrás do limite com `continue`, não `break`);
- **sem `LACUNA_MAX`** — a restrição de lacuna só cabe na cauda da âncora
  (`reclamarCauda`), que não engole trechos distantes por 1 palavra comum;
  no modo pós-match a borda pode ser alcançada sem limite de distância.

`reconstruirFaladas(faladas, finaisLen, consumido, uttLen, novas)` (exportada):
- estende o estado quando a utterance cresce e **realinha `consumido`** quando o
  STT substitui a utterance (interim/final) por outra mais curta/diferente —
  era a causa do "não reconhece mais nada": `consumido` apontava além do tamanho
  da nova utterance e o matcher nunca via a linha que vinha a seguir;
- `inicio = faladas.length - uttLen` (posição onde começa a utterance atual);
  `c = consumido`; se `c > inicio`, recorta `c` na cabeça da utterance antiga que
  ainda sobrevive na nova pelo **maior prefixo comum** (`faladas[inicio..inicio+corte)`
  × `novas`, `corte = min(c - inicio, novas.length)`); sem prefixo comum, `c = inicio`
  (recomeça do começo da utterance);
- devolve `{ faladas: [...faladas[0..finaisLen), ...novas], consumido: c }`;
  a parte congelada (`finaisLen`) é imutável — `consumido` só é realinhado dentro
  da utterance corrente.

### Máquina de estado em `createVoice`

- `faladas[]` palavras da utterance corrente (**cumulativo**), `finaisLen` (posição
  congelada após um `isFinal`), `consumido` (palavras já atribuídas a linhas),
  `uttLen` (palavras da utterance corrente = `faladas.length - finaisLen`),
  `ultimoIdx` (âncora).
- `aceitarChunk(confirmado)` = `proximoPasso(faladas, linhas, { consumido, ultimoIdx })`,
  copia o estado de volta e, se a âncora andou, destaca + `enviar(ultimoIdx, confirmado)`.
- Web Speech (`continuous`, `interimResults`, `lang='pt-BR'`):
  `ev.results[ev.results.length-1]`; transcript cresce palavra a palavra; `isFinal`
  congela `finaisLen` (palavras imutáveis em `faladas[0..finaisLen)`).
- `rec.onresult` **sempre** passa o resultado pelo `reconstruirFaladas` antes de
  chamar `aceitarChunk`: `{ faladas, consumido } = reconstruirFaladas(faladas,
  finaisLen, consumido, uttLen, novas)` e grava `uttLen = novas.length`.

### Histórico (NÃO repetir — cada uma dessas falhou)

1. Match por melhor score numa janela (v1): saltos falsos por refrões repetidos.
2. Âncora + página + score ≥ 0.5 (v2): âncora re-casava a própria linha → travava,
   e o pré-rolamento no final usava âncora errada → pulava página por termos iguais.
3. `casarProximaLinha` score parcial ≥ 0.5 c/ consumo `+= lw.length` (v3): âncora
   **corria à frente** (casava linha com metade das palavras, consumia além do falado)
   → aparentava pular pra 2ª parte do refrão e pra 2ª página.
4. Linha inteira como subsequência ordenada (v4): corrigiu o "correr à frente"
   nos testes, mas o usuário reportou **lento** (exige a frase 100%; STT de canto
   omite/erra palavra → linha nunca fecha) e **ainda pula pra segunda página**
   (consumo `+= lw.length` continuava e linhas curtas casavam por 1 palavra).
5. **v5**: `horizonte = Infinity`; retorno `{ linha, consumidos }` com consumo pela
   última palavra realmente casada (`qi + 1`); tolerância de 1 palavra faltando **só em
   linhas de 4+**; linhas curtas exigem o texto completo. Corrigiu lentidão e pulos por
   linhas curtas, mas o usuário ainda viu "1ª frase pegou, depois pulou pra 2ª página".
6. **v6**: interims **confinados à página atual** (horizonte 0/1; cruza só quando
   a página está exaurida ou o resultado é `isFinal`); **snap de página só no confirmado**
   em `show.js`; `enviar` só avança `paginaAtual` além da atual com `confirmado`/página
   exaurida. Matcher ganhou teste `horizonte 0 confina à página atual`.
7. **v7**: exigência ~60% (mín 3) p/ linhas de 4+; `proximaIgual` vira fronteira de
   página. Frase-2 → **foi pra última frase**: o loop de consumo marchava por TODAS
   as cópias idênticas restantes e o tail da frase re-casava com a cópia seguinte.
8. **v8**: **ordem pura** — sem página no matcher; **um match por chunk**;
   `consumirLinha` absorve a frase completa mesmo com palavras atrás do limite
   (`continue`, não `break`) → a cauda nunca re-casa com cópia posterior. View só
   segue com `isFinal`.
9. **v9**: melhor cobertura + trava anti-avanço. Relato v8: "em sequência quase
   atendeu. mas quando pulei uma frase já não reconheceu mais nada. parou".
   Causa: "primeira que encaixa" casava linha intermediária por 2 palavras soltas
   e a frase seguinte ficava atrás da âncora. Corrigido: matcher escolhe por
   `score = casadas/lw.length` e `proximoPasso` bloqueava avanço quando a cauda
   da âncora ainda chegava com match < 0.75. 39 testes verdes.
10. **v10**: relato v9 "não reconheceu 'é que a gente é o sonho de todo
     casal' e pulou pra próxima página; um pouco lento". Causa do não-reconhecimento:
     subsequência **em ordem** falhava na linha longa (STT de canto come/desloca
     palavras funcionais); causou do pulo de página: `consumirLinha` engolia trechos
     distantes por 1 palavra comum da âncora. Corrigido: `casadas` = contagem **sem
     ordem** na janela; exigência ~45% (`round`); **trava removida** (cobertura por
     fração segura o avanço); `LACUNA_MAX = 6` no `consumirLinha`. 42 testes verdes.
11. **Atual** (v11): relato v10 "frases mais curtas não são reconhecidas e aí não
     continua". Duas causas (A e B): (A) `consumido` é posição absoluta em
     `faladas[]`; quando o STT substitui uma utterance (interim/final) por outra
     mais curta/diferente, o índice ficava viciado e **pulava as primeiras palavras
     da nova utterance** → a linha seguinte nunca casava e nada andava depois;
     (B) `reclamarCauda`/`consumirLinha` antigo comia o **prefixo da linha seguinte**
     compartilhado com a âncora (ex.: âncora "Sorte a minha" consumia "sorte a" de
     "Sorte a nossa", que ficava com 2 palavras < 3 exigidas). Corrigido:
     `reclamarCauda` (só avança se a âncora for alcançada **completa**, `ultimoLw ===
     lw.length - 1`, lacuna ≤ `LACUNA_MAX`); `consumirLinha` volta a ser usado **só
     após um match** (BFS, sem restrição de lacuna — testes 5→9 e destruidora de seq
     continuam verdes); `reconstruirFaladas` realinha `consumido` em substituição de
     utterance pelo maior prefixo comum entre a cauda da utterance antiga e a nova
     (estado ganhou `uttLen`). 47 testes verdes (12 novos: `reclamarCauda` completa/
     parcial, `reconstruirFaladas` cresce/substitui/congelado, "Sorte a nossa" não é
     engolida por "Sorte a minha").

### Regras de negócio confirmadas pelo usuário

- A âncora **nunca volta** (frases anteriores não podem re-casar). Esse comportamento
  (v2/v3) era o preferido.
- Deve **respeitar a ordem da música mesmo pulando frases** (ex.: pular direto pro refrão).
- **Não** pular de página por causa de frases **iguais** (refrão repetido idêntico).
- **Não pode ser lento**: reconhecer no ritmo do canto, tolerante a STT imperfeito.

Próximo passo real: **validar no navegador com microfone** (cantar o pré-refrão
seguido do refrão — **caso do relato v11**: "Sorte a minha" / "Sorte a nossa" /
"É pra vida" / "É agora" → ambos devem reconhecer, e o STT comer/re-segmentar
uma frase no meio NÃO pode parar as que vêm depois). Outros: cantar o refrão a
partir da 2ª metade — deve pular direto pra primeira "Arrepia"; cantar refrão 1 +
refrão 2 — nunca deve ir pra última frase nem pular a cópia; cantar o refrão 1
pulando uma frase no meio e depois o refrão 2 — deve continuar reconhecendo na
ordem, sem parar. Se atrasar, o alvo é reduzir a exigência para
`Math.max(2, Math.floor(lw.length * 0.4))`; se pular, reabrir o consumo (o
`LACUNA_MAX` do `reclamarCauda` é o primeiro candidato).

### Validar sem navegador

- `npm test` (47 testes; `test/voice.test.js`: fixtures `LINHAS`, `MUSICA_V2`,
  `SONHO`, `REFRAO_COMPLETO`, `REFRAO_MUSICA`; casos: nunca volta, primeira ocorrência
  em ordem, exigência ~45% da linha, `consumirLinha` na borda da frase (BFS e
  destruidora de seq), melhor cobertura vence o furto de 2 palavras, pular frase e
  continuar (seq `[20,24,34]`, consumido 7), anti-lento (cauda da âncora não segura
  a linha seguinte), linha longa do relato reconhece sem ordem, ~45% sem ser lento,
  **`reclamarCauda` exige a âncora completa (cauda parcial não consome)**,
  **`reconstruirFaladas` realinha `consumido` quando a utterance é substituída**).
  Os testes de máquina usam `proximoPasso` (espelha o `aceitarChunk` real).
- Simulação real fora do repo (`%TEMP%\opencode\simular.mjs` + `voice_sim.mjs`,
  imports `file://` por serem `.mjs`): roda `parseCifra` + `proximoPasso`
  contra `musicas/Marcos e Belutti - Sonho de Todo Casal.txt` (refrão duplicado
  idêntico; linhas curtas tipo "É agora"/"Sorte a nossa"). A sim usa o mesmo
  `proximoPasso` **e o `reconstruirFaladas` no `onresult`** (mirror do app).
  Cenários: refrão 1 crescendo; refrão 1+2 crescendo (sem ir pra última frase);
  **pular "Me faz amar feito louco" no refrão 1**; direto pro refrão 2;
  **pulo do fim do verso direto pro refrão** (cai na primeira "Arrepia",
  não na última frase); **RELATO v11 (verse+pré-refrão+refrão com
  re-segmentação de interim — não trava)**. **IMPORTANTE:** interims do roteiro
  são CUMULATIVOS (o transcript de uma utterance cresce), e
  `alvo = faladas.slice(consumido)` após `consumirLinha`; recopiar
  `public/js/voice.js` → `voice_sim.mjs` a cada mudança.
- `node --check public/js/voice.js` e `node --check public/js/show.js`.

### Detalhes de dados

- Página = DOM: `paginarRows(rows, { altura, largura })` (render.js); cada página tem
  colunas `.col`; rows têm `data-idx` (índice no `modelo.conteudo[]`); linha de letra
  renderiza `.frase`; linha só-acorde não tem `.frase`.
- `mapaLinhaPagina` monta `mapa` idx→página (usado SÓ pra avisar a view).
- `linhasDoModelo(modelo)` = items de `modelo.conteudo[]` com `letra` não vazia
  (as linhas de acorde têm `letra` vazio).
- Cifras reais têm refrões **duplicados consecutivos** com texto idêntico → a ordem
  de índice é a única forma de distinguir a cópia.