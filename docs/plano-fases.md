# Plano de fases — Cifra Prebelli

Cada fase entrega algo funcional e testável. Ordem pensada para reduzir risco:
primeiro a lógica pura (parser/transposição), depois o servidor + catálogo,
depois a tela que é o coração do app, e por último as extensões.

## Fase 0 — Fundação do projeto

**Entrega:** projeto roda e serve uma página em branco.
- [ ] `package.json` (`type: module`, scripts `start`/`dev`/`test`)
- [ ] `server.js` zero-deps: estáticos de `public/` + esqueleto das rotas da API
- [ ] Pastas `data/`, `musicas/`, `public/`, `test/`, `docs/`
- [ ] `docs/` + `README.md` + `AGENTS.md` (este passo já feito na conversa de arquitetura)
- [ ] Exemplo de cifra em `musicas/` (amostra de teste, formato Cifra Club)
- ✅ Feito quando: `npm start` → `http://localhost:3000` serve `index.html`.

## Fase 1 — Parser + Transpositor (lógica pura, sem UI)

**Entrega:** ler um `.txt`, produzir um `CifraModel` correto e transpor.
- [x] `public/js/parser.js` implementando `docs/formato-cifra.md`
- [x] `public/js/transpositor.js` (mapa cromático, tônica/baixo, sufixo preservado)
- [x] `test/parser.test.js` e `test/transpositor.test.js` — testes **golden**
- ✅ Feito quando: `npm test` verde cobre seções, âncora posicional, tom,
  amostras reais de cifra e casos de fronteira.

## Fase 2 — Servidor completo + Catálogo + Lista

**Entrega:** listar, buscar, reordenar e abrir músicas no navegador.
- [ ] Rotas `/api/*` implementadas (musicas, scan, catalog, PUT/DELETE)
- [ ] `GET /api/scan`: adiciona arquivos novos, remove sumidos, título/artista do nome
- [ ] **Header fino** (sem sidebar) com ação "Adicionar música"
- [ ] Importação pela tela: seletor de arquivo `.txt`, **drag & drop** e colar
      texto → grava via `PUT /api/musicas/:id` (sem mexer na pasta no disco)
- [ ] `public/js/list.js`: lista + busca por nome/artista (digitação, diacrítico-insensível)
- [ ] **Estilos por música** (1..n): campo no editor, linha `Estilo:` na
      importação, sugestões padrão no autocomplete
- [ ] **Filtro por estilo** na lista (select no header, combinado com a busca)
- [ ] Reordenação por **drag & drop**, persistida no catálogo
- [ ] Extratação de `tomBase` no scan (cached)
- ✅ Feito quando: drop de um `.txt` na pasta **ou importação pela tela** → a
  música aparece no app; reordeno; a ordem sobrevive a restart.

## Fase 3 — Tela de apresentação (o coração)

**Entrega:** modo show em 2 colunas com rolamento automático.
- [x] `public/js/render.js` — modelo → DOM em 2 colunas, seções em vermelho,
      acorde ancorado acima da palavra (nunca separa acorde da palavra)
- [x] `public/js/scroller.js` — paginação por versos (página nunca parte verso)
      + avanço automático com velocidade configurável
- [x] `public/js/show.js` — estado do show, atalhos, "próxima música" retomando rolagem
- [x] Preferências por música: velocidade, tomOffset, rolagem → `POST /api/catalog`
- ✅ Feito quando: toco uma música de ponta a ponta no "modo show" sem tocar
  no mouse, navegando as músicas do setlist.

## Fase 4 — Polimento

**Entrega:** conforto e produtividade.
- [ ] Temas claro/escuro e paleta da tela de show
- [ ] Editor de cifra no app (editar/salvar o `.txt`) — decidir se entra
- [ ] Importação em lote (colar várias cifras / arrastar arquivos para criar)
- [ ] Atalhos completos e persistência de preferências globais
- ✅ Feito quando: uso o app em um ensaio completo com o setlist real.

## Fase 5 — Assistente de voz (extensão)

**Entrega:** módulo opcional que ajusta a rolagem por reconhecimento de fala.
- [ ] `public/js/voice.js` — Web Speech API (`pt-BR`, contínuo, botão de ativar)
- [ ] Fuzzy-match fala × linha de letra; ajusta página ativa/destaca seção
- [ ] Fallback gracioso: qualquer erro/ausência de permissão apenas desliga o módulo
- ✅ Feito quando: canto um refrão ao microfone e a seção destacada acompanha.