// Packs everything into one self-contained index.html (no build dependencies).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const strip = s => s.replace(/^if \(typeof module.*$/gm, '');
const puzzles = JSON.parse(rd('data/puzzles.json'));
const calib = JSON.parse(rd('data/calibration.json'));
let html = rd('src/template.html');
const parts = {
  STYLE: rd('src/style.css'), ENGINE: strip(rd('src/engine.js')), BOTS: strip(rd('src/bots.js')), LESSONS: strip(rd('src/lessons.js')),
  DATA: `const PUZZLE_DATA = ${JSON.stringify(puzzles)};\nconst CALIB = ${JSON.stringify(calib)};`, APP: rd('src/app.js'),
};
for (const k in parts) html = html.replace(`/*${k}*/`, () => parts[k]);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB,', puzzles.length, 'puzzles');
