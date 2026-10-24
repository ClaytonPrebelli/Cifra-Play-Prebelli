import fs from 'fs';
import path from 'path';
const files = ['ROUPA NOVA - CORAÇÃO PIRATA.txt', 'ROUPA NOVA - A FORÇA DO AMOR.txt', 'ROUPA NOVA - A VIAGEM.txt'];
for (const f of files) {
  const c = fs.readFileSync(path.join('musicas', f), 'utf8');
  const lines = c.split(/\r?\n/);
  const lens = lines.filter(l=>l.trim()).map(l=>l.length).sort((a,b)=>a-b);
  if (lens.length === 0) { console.log(f + ': empty'); continue; }
  const p80 = lens[Math.floor(lens.length*0.8)] || lens[lens.length-1];
  console.log(f + ': lines=' + lens.length + ' max=' + lens[lens.length-1] + ' p80=' + p80);
}
