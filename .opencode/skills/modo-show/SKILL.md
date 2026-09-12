---
name: modo-show
description: Use when implementing or changing the presentation screen (modo show): 3-column rendering, section highlight, teleprompter auto-scroll, per-song scroll speed/transpose preferences, keyboard shortcuts, and the next-song flow. Also use when writing render.js, scroller.js, or show.js.
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

- `public/js/render.js` — `CifraModel` (já transposto) → DOM. Acorde ancorado à
  palavra **sempre junto** dela; reflow das colunas não quebra o vínculo
  (usa o CifraModel ancorado da skill `formato-cifra`).
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

## Voz (fase 5) — não acoplar agora

`voice.js` é módulo independente; o modo show deve funcionar 100% sem ele.
Quando existir, apenas receberá um evento do tipo "página sugerida por voz".