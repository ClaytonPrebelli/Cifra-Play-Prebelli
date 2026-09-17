import { getCatalog } from './api.js'
import { initList } from './list.js'
import { initShow } from './show.js'
import { initImport } from './importar.js'

export const AppState = {
  mode: 'list',
  catalog: [],
  ordens: {},
  filters: { busca: '', estilos: [], letra: '' },
  atual: null,
  show: { tomOffset: 0 },
}

export function ordemParaEstilo(state, est) {
  if (!est) return state.catalog.map((m) => m.id)
  const comEstilo = state.catalog.filter((m) => (m.estilos || []).includes(est))
  const ids = new Set(comEstilo.map((m) => m.id))
  const conhecidos = (state.ordens[est] || []).filter((id) => ids.has(id))
  const faltantes = comEstilo.filter((m) => !conhecidos.includes(m.id)).map((m) => m.id)
  return [...conhecidos, ...faltantes]
}

function setMode(mode) {
  AppState.mode = mode
  document.getElementById('lista').hidden = mode !== 'list'
  document.getElementById('show').hidden = mode !== 'show'
}

async function boot() {
  try {
    const data = await getCatalog()
    AppState.catalog = data.musicas || []
    AppState.ordens = data.ordens || {}
  } catch (err) {
    AppState.catalog = []
    console.error(err)
  }
  setMode('list')
  const lista = initList(AppState)
  initShow(AppState)
  initImport(AppState, () => lista.refresh())
}

boot()