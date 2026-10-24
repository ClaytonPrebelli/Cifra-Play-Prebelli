import fs from 'fs';
const f = 'musicas/ROUPA NOVA - CORAÇÃO PIRATA.txt';
const c = fs.readFileSync(f,'utf8');
const idx = c.indexOf('Faço');
if(idx>=0) {
  const start = c.lastIndexOf('\n', idx-200);
  const end = c.indexOf('\n\n', idx);
  console.log(c.slice(start, end));
}
