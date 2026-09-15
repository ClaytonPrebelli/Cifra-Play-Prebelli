import { readFileSync } from 'node:fs'
import { deDecParaLinhas, tituloDeDec, DEC_CODES_PADRAO } from '../public/js/decifra.js'

const caminho = process.argv[2]
const fonte = new TextDecoder('windows-1252').decode(readFileSync(caminho))
const titulo = tituloDeDec(fonte)
const linhas = deDecParaLinhas(fonte, DEC_CODES_PADRAO)
process.stdout.write(`TITULO=${titulo}\n\n`)
process.stdout.write(linhas.join('\n') + '\n')