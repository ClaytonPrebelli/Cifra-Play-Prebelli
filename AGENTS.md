# AGENTS.md — Cifra Prebelli

Contexto para desenvolvedores (humanos e agentes) trabalharem neste projeto.

## Projeto

Portal local de cifras para shows. Tela única em 2 modos: **lista** (catálogo,
busca, ordem editável) e **show** (3 colunas, rolamento automático estilo
teleponto, transposição por música). Sem backend remoto; o servidor Node lê
escreve arquivos locais.

## Stack (regras firmes — não mudar sem conversa com o usuário)

- **Servidor:** Node.js puro, **zero dependências** (`http` + `fs`). Proibido
  adicionar libs ao runtime.
- **Front:** Vanilla JS **ESM** + HTML/CSS, **sem framework, sem build**.
  Módulos em `public/js/`, um por responsabilidade.
- **Dados:** `musicas/*.txt` (formato Cifra Club) é a fonte da verdade do
  conteúdo; `data/catalog.json` guarda metadados, ordem e preferências.
- **Testes:** `node:test` nativo (`npm test`). Sem dependências.

## Comandos

```bash
npm start       # server em http://localhost:3000
npm run dev     # node --watch server.js
npm test        # node --test test/
```

## Estrutura

```
server.js            # rotas estáticas + API REST (/api/*)
data/catalog.json    # catálogo ordenado + prefs por música
musicas/             # <Artista> - <Música>.txt
public/index.html    # página única
public/css/styles.css
public/js/           # app, api, parser, transpositor, render, scroller,
                     # show, list, voice(fase 2)
test/                # parser.test.js, transpositor.test.js
docs/                # arquitetura, formato-cifra, plano-fases
```

## Convenções

- **Idioma:** código e identificadores em inglês; UI e docs em pt-BR.
- **Arquivos JS**: ESM, `export const`/`export function`, sem classes
  gigantes; estado central em `app.js` (AppState) e módulos puros recebendo
  dados por parâmetro (sem import circular estilo singleton).
- **Parser/transpositor são módulos puros** — não tocam em DOM; testáveis.
- **Formato da cifra**: seguir `docs/formato-cifra.md` à risca; mudanças no
  parser exigem testes golden verdes.
- **UI em pt-BR.** Design: **a cifra tem prioridade absoluta** — navegação num
  header fino, sem sidebar/menus que roubem espaço da cifra (ver
  `docs/arquitetura.md` §1.1).
- **Importação de músicas pela tela** (seletor/drag&drop/colar) além da pasta
  manual; grava via `PUT /api/musicas/:id`.
- **Servidor**: bind `127.0.0.1`; sanitizar `id` de arquivo (sem `..`);
  respostas JSON com `Content-Type: application/json`.
- **Não adicionar comentários em código** a menos que o usuário peça.
- Preferências alteradas na UI persistem via `POST /api/catalog` (imediato ou
  debounced).

## Antes de começar uma fase

Ler `docs/plano-fases.md` para confirmar o escopo da fase e marcar as caixas ao
concluir cada item. Skills relevantes: `formato-cifra` (parser/transposição) e
`modo-show` (tela de apresentação).