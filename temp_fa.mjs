import fs from 'fs';
const f = 'musicas/ROUPA NOVA - A FORÇA DO AMOR.txt';
const c = fs.readFileSync(f,'utf8');
const lines = c.split(/\r?\n/);
const lens = lines.filter(l=>l.trim()).map(l=>l.length);
lens.sort((a,b)=>a-b);
console.log('max=' + lens[lens.length-1] + ' p80=' + lens[Math.floor(lens.length*0.8)] + ' p90=' + lens[Math.floor(lens.length*0.9)]);
