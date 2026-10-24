import fs from 'fs';
import path from 'path';

const dir = 'musicas';
const files = fs.readdirSync(dir);
const f = files.find(x => x.toLowerCase().includes('pirata'));
console.log(f);
if (f) {
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  console.log(c.slice(0, 120));
}
