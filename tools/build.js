// Packs everything into one self-contained index.html (no build dependencies).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const strip = s => s.replace(/^if \(typeof module.*$/gm, '');
// UI modules, in load order. boot.js must stay last.
const APP_FILES = ['src/icons.js', 'src/app.js', 'src/puzzles2.js', 'src/rewards.js', 'src/insights.js', 'src/lobby-client.js', 'src/lobby-ui.js', 'src/sf.js', 'src/review.js', 'src/analysis.js', 'src/boot.js'];
const puzzles = JSON.parse(rd('data/puzzles.json'));
const calib = JSON.parse(rd('data/calibration.json'));
let html = rd('src/template.html');
const parts = {
  STYLE: rd('src/style.css'), ENGINE: strip(rd('src/engine.js')), BOTS: strip(rd('src/bots.js')), LESSONS: strip(rd('src/lessons.js')) + (!process.env.NO_COURSES && fs.existsSync(path.join(root, 'src/courses.js')) ? '\n// courses run in their own scope so their helper names cannot clash with the app\nconst COURSES = (() => {\n' + strip(rd('src/courses.js')) + '\nreturn COURSES;\n})();' : ''),
  DATA: `const PUZZLE_DATA = ${JSON.stringify(puzzles)};\nconst CALIB = ${JSON.stringify(calib)};`, APP: APP_FILES.filter(f => fs.existsSync(path.join(root, f))).map(rd).join('\n;\n'),
};
for (const k in parts) html = html.replace(`/*${k}*/`, () => parts[k]);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB,', puzzles.length, 'puzzles');
