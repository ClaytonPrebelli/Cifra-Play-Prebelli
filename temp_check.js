const fs = require('fs');
const files = fs.readdirSync('musicas');
const f = files.find(x => x.toLowerCase().includes('pirata'));
console.log(f);
if (f) {
  const c = fs.readFileSync('musicas/' + f, 'utf8');
  console.log(c.slice(0, 80));
}
