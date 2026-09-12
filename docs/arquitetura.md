# Arquitetura — Portal de Cifras (Cifra Prebelli)

Aplicativo web local para shows: exibe letras com cifras em 2 colunas (tela
dividida em 3, 1/3 direito em branco para o video de playback) com rolagem
automática estilo teleponto, busca fácil, ordem de setlist editável e
transposição de tom por música.

## 1. Decisões aprovadas (conversa 2026-09-12)

| Decisão | Escolha | Motivo |
|---|---|---|
| Servidor | **Node.js puro, zero dependências** (`server.js` com `http` + `fs`) | Node v22 já instalado; sem `npm install`, sem build |
| Front | **Vanilla JS (ESM) + HTML/CSS**, sem framework | Rolagem suave é DOM + `requestAnimationFrame` nativo; tela única não justifica framework |
| Conteúdo da música | **1 `.txt` por música**, formato Cifra Club | Edição humana direta, importação sem conversão, diff limpo, parse instantâneo |
| Catálogo | **`data/catalog.json`** | Ordem da lista + preferências por música (tom, velocidade, colunas) |
| Identidade da música | **Nome do arquivo** `Artista - Música.txt` | Título/artista derivados do nome |
| Reconhecimento de voz | **Fase 2**, módulo separado | Web Speech API (Chrome/Edge); assistente, nunca dependência |

## 1.1 Princípios de UX (firmes)

- **A cifra tem prioridade absoluta.** Toda navegação/controle vive num
  **header fino** no topo; proibido sidebar, menus laterais ou barras que
  roubem área vertical/horizontal da cifra.
- O header é o mesmo nos dois modos (lista e show) e mostra apenas o
  essencial: navegação, título da música e controles ativos (busca/tom/
  velocidade). Controle em estado ocioso ficam colapsados.
- **Importar música pela própria tela**: seletor de arquivo (`.txt`), drag &
  drop de arquivos e área de colar texto — sem precisar abrir/editar a pasta
  no disco. O app grava via `PUT /api/musicas/:id`.
- A pasta `musicas/` continua sendo a fonte da verdade; a UI é só um atalho
  que escrive por cima.

## 2. Estrutura de pastas

```
Cifra Prebelli/
├── server.js                  # servidor HTTP zero-deps (rotas estáticas + API)
├── package.json               # type: module + scripts (start/dev/test)
├── data/
│   └── catalog.json           # catálogo: lista ordenada + preferências
├── musicas/                   # 1 .txt por música (fonte da verdade do conteúdo)
│   └── Artista - Música.txt
├── public/
│   ├── index.html             # página única (2 modos: lista e show)
│   ├── css/styles.css
│   └── js/
│       ├── app.js             # bootstrap + estado global (AppState)
│       ├── api.js             # cliente da API REST
│       ├── parser.js          # .txt → CifraModel (acordes, seções, tom)
│       ├── transpositor.js    # semitons
│       ├── render.js          # CifraModel → DOM em 3 colunas, âncora acorde→palavra
│       ├── scroller.js        # teleponto (raf, velocidade, páginas)
│       ├── show.js            # tela de apresentação (estado + atalhos)
│       ├── list.js            # lista de músicas + busca + reorder (drag & drop)
│       └── voice.js           # [FASE 2] assistente de voz (Web Speech API)
├── test/
│   └── …                      # testes node:test (parser, transpositor)
├── docs/
│   ├── arquitetura.md         # este arquivo
│   ├── formato-cifra.md       # spec do .txt e regras do parser
│   └── plano-fases.md         # etapas de desenvolvimento
└── README.md
```

## 3. Stack e execução

- **Runtime:** Node.js ≥ 18 (testado com v22). Zero dependências de terceiros.
- **ESM** (`"type": "module"`).
- **Scripts** (`package.json`):
  - `npm start` → `node server.js`
  - `npm run dev` → `node --watch server.js` (recarrega o servidor sozinho)
  - `npm test` → `node --test test/` (framework embutido `node:test`)
- **Acessar:** `http://localhost:3000` (porta via `PORT`, default 3000).
- O servidor escuta **só em `127.0.0.1`** (não expõe na rede).

## 4. Servidor — API REST

O servidor serve `public/` (estáticos) e as seguintes rotas:

| Rota | Método | Descrição |
|---|---|---|
| `/*` | GET | Arquivos estáticos de `public/` (content-types básicos, fallback para `index.html` em `/`) |
| `/api/musicas` | GET | Catálogo ordenado: `[{id, titulo, artista, tomBase, prefs}]` (sem conteúdo) |
| `/api/musicas/:id` | GET | Texto cru do `.txt` (id = nome do arquivo, URL-encoded) — 404 se não existe |
| `/api/musicas/:id` | PUT | Cria/substitui o `.txt` (importação ou edição pelo app) |
| `/api/musicas/:id` | DELETE | Remove arquivo e catálogo |
| `/api/scan` | POST | Rescaneia `musicas/`: adiciona arquivos novos ao catálogo e remove os sumidos |
| `/api/catalog` | POST | Grava o catálogo inteiro (ordem + preferências) |

`catalog.json`:
```json
{
  "versoes": 1,
  "musicas": [
    {
      "id": "Legião Urbana - Pais e Filhos.txt",
      "titulo": "Pais e Filhos",
      "artista": "Legião Urbana",
      "tomBase": "C",
      "estilos": ["Rock"],
      "prefs": { "tomOffset": 2, "velocidade": 3, "rolagem": true, "colunas": 3 }
    }
  ]
}
```

- A **ordem da lista é a ordem do array** `musicas` (ordenação implícita).
- `prefs` é opcional; valores ausentes herdam os **globais** (defaults no código).
- `estilos` é opcional (array de strings, 1..n por música); alimenta o filtro
  por estilo da lista e o autocomplete do editor (sugestões padrão somadas às
  do catálogo). Na importação, a linha `Estilo:` do `.txt` vira `estilos`.
- `tomBase` é descoberto no parse e **cacheado** no catálogo para exibir na lista sem ler o txt.

**Segurança do servidor:**
- Bind em `127.0.0.1` apenas.
- `id` de arquivo é sanitizado: só `[A-Za-zÀ-ÿ0-9 _\-().,]`, rejeita `..`, `\`, `/` — sem path traversal.
- Rotas de gravação não exigem auth (ambiente localhost, single-user).

## 5. Fluxo de dados

```
GET /api/musicas ─→ catálogo (ordem, título, artista, prefs)
       │
       ▼
usuário abre música → GET /api/musicas/:id → texto cru do .txt
       │
       ▼
parser.js → CifraModel { tom, secoes[], acordes[âncora→palavra], ... }
       │
       ▼
transpositor.js (aplica tomOffset) → modelo já em tom escolhido
       │
       ▼
render.js → DOM: 3 colunas, seções em vermelho, acorde acima da palavra
       │
       ▼
scroller.js → rolagem automática em "páginas" (nunca parte verso)
```

Preferências alteradas na UI (tom, velocidade, colunas) → `POST /api/catalog`
persiste no `catalog.json` de forma imediata (debounced).

## 6. Estado no front (AppState)

Estado simples e centralizado (módulo `app.js`), atualizado por eventos:

```js
{
  mode: 'list' | 'show',
  catalog: [],            // array ordenada do catálogo
  filters: { busca: '' },
  atual: { id, cifraModel, prefs } | null,
  show: {
    paginaAtiva: 0,
    autoRolagem: true,
    velocidadeAtual: 3,   // merge de prefs + override da sessão
    tomOffset: 0
  }
}
```

## 7. Tela de apresentação (modo show) — conceito

- Fundo escuro, fonte grande, máximo aproveitamento da tela (sem sidebar);
  navbar mínima: voltar, título, tom, controles de velocidade/rolagem.
- A cifra é dividida em **páginas** (de 2 colunas, no 2/3 esquerdo da tela; o
  1/3 direito fica em branco para o video) que **nunca partem um verso** — cada
  linha é medida na largura real da coluna e encaixada na página. Navegação por
  página (setas / tecla).
- **Rolagem automática**: o app avança de página automaticamente; a velocidade
  (segundos por página) é ajustável e salva nas preferências da música.
- **Espaço**: pausa/retoma. **→**: próxima música da lista (retoma a rolagem).
- Detalhes de implementação e atalhos: skill `modo-show`.

## 8. Reconhecimento de voz (Fase 2)

- `voice.js`, módulo independente, ativável por botão (microfone).
- Web Speech API (`webkitSpeechRecognition`, `lang=pt-BR`, contínuo).
- Transcreve e faz **fuzzy-match** (similaridade de palavras) da última fala
  contra as linhas de letra; quando casa acima de um limiar, ajusta a página
  ativa / destaca a seção. Arquivado para falhar com graça: o app funciona sem.
- Sem ruído de palco controlado isso é instável — é **assistente**, não pilar.

## 9. Não decidido ainda (aberto para quando formos implementar)

- Tema claro/escuro global e paleta de cores da tela de show.
- Editor de cifra dentro do app (editar o txt pelo navegador) vs. editar
  arquivos direto na pasta.
- Atalhos exatos de teclado e atalho global de "próxima música".
- Ajuste fino do algoritmo de âncora acorde→palavra (ver formato-cifra.md).
- Aprimoramento enharmônico (exibir `Bb` vs `A#`) via preferência global.