export function capitalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/(^|[^\p{L}\d'’‘])([\p{L}\d])/gu, (m, pre, c) => pre + c.toUpperCase())
}

export function nomeExibicao(artista, titulo) {
  const a = capitalize(artista)
  const t = capitalize(titulo)
  return a ? `${a} — ${t}` : t
}
