import { getCatalog } from './api.js'
import { initList } from './list.js'

export const AppState = {
  mode: 'list',
  catalog: [],
  filters: { busca: '', estilos: [] },
  atual: null,
  show: { paginaAtiva: 0, autoRolagem: true, velocidade: 3, tomOffset: 0 },
}

function setMode(mode) {
  AppState.mode = mode
  document.getElementById('lista').hidden = mode !== 'list'
  document.getElementById('show').hidden = mode !== 'show'
}

async function boot() {
  try {
    AppState.catalog = await getCatalog()
  } catch (err) {
    AppState.catalog = []
    console.error(err)
  }
  setMode('list')
  initList(AppState)
}

boot()