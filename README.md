# Cifra Prebelli

Portal de cifras para shows. Exibe letras com acordes em **3 colunas** com
rolagem automática estilo teleponto, busca por digitação, setlist com ordem
editável e troca de tom por música. Roda **local** (Chrome/Edge), zero backend
e zero dependências — as cifras são arquivos `.txt` na pasta do projeto.

## Como rodar

Requisito: Node.js ≥ 18 (testado com v22).

```bash
npm start       # abre em http://localhost:3000
npm run dev     # mode watch (recarrega o servidor sozinho)
npm test        # testes do parser/transpositor (node:test)
```

## Como adicionar músicas

Coloque um arquivo na pasta `musicas/` com o padrão
`Artista - Música.txt`, no formato Cifra Club:

```
Tom: C

[Refrão]
F            G
Eu vou cantar
C            Am
Pra te lembrar
```

Depois clique em escanear no app (ou reinicie) — a música aparece no catálogo.
Detalhes do formato: [`docs/formato-cifra.md`](docs/formato-cifra.md).

## Estrutura

```
musicas/        # 1 .txt por música (conteúdo)
data/           # catalog.json (ordem, metadados, preferências)
public/         # HTML/CSS/JS vanilla (modo lista + modo show)
docs/           # arquitetura, formato da cifra, plano de fases
test/           # testes node:test
server.js       # servidor HTTP zero-deps
```

## Funcionalidades

- **Modo lista**: busca por nome/artista (só digitar), ordem por **drag & drop**.
- **Modo show**: 3 colunas, fundo escuro, fonte grande, seções `[Refrão]` em
  vermelho, acordes ancorados às palavras.
- **Rolagem automática**: avança por "páginas" que nunca partem um verso;
  velocidade ajustável e salva por música.
- **Transposição**: troca de tom global ou por música, persistida.
- **"Próxima música"**: ao chegar ao fim, avance para a próxima do setlist.
- **Voz (fase 2)**: assistente que reconhece o trecho cantado e ajusta a rolagem.

## Documentação

- [`docs/arquitetura.md`](docs/arquitetura.md) — decisões, stack, API, fluxos
- [`docs/formato-cifra.md`](docs/formato-cifra.md) — spec do `.txt` e do parser
- [`docs/plano-fases.md`](docs/plano-fases.md) — etapas de desenvolvimento

## Roadmap

Fase 0: fundação do projeto · Fase 1: parser + transpositor · Fase 2: catálogo
+ lista · Fase 3: modo show · Fase 4: polimento · Fase 5: voz.