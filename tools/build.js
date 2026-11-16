// Packs everything into one self-contained index.html (no build dependencies).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const strip = s => s.replace(/^if \(typeof module.*$/gm, '');
// UI modules, in load order. boot.js must stay last.
const APP_FILES = ['src/i18n.js', 'src/icons.js', 'src/art.js', 'src/app.js', 'src/puzzles2.js', 'src/rewards.js', 'src/insights.js', 'src/lobby-client.js', 'src/lobby-ui.js', 'src/sf.js', 'src/review.js', 'src/analysis.js', 'src/wpieces.js', 'src/variants.js', 'src/worldcourses_scoped', 'src/world.js', 'src/home.js', 'src/boot.js'];
// checkmate puzzles first, themed tactics appended after them (keeps saved puzzle ids stable)
const puzzles = JSON.parse(rd('data/puzzles.json')).concat(fs.existsSync(path.join(root, 'data/tactics.json')) ? JSON.parse(rd('data/tactics.json')) : []);
const calib = JSON.parse(rd('data/calibration.json'));
let html = rd('src/template.html');
const parts = {
  STYLE: rd('src/style.css'), ENGINE: strip(rd('src/engine.js')), BOTS: strip(rd('src/bots.js')), LESSONS: strip(rd('src/lessons.js')) + (!process.env.NO_COURSES && fs.existsSync(path.join(root, 'src/courses.js')) ? '\n// courses run in their own scope so their helper names cannot clash with the app\nconst COURSES = (() => {\n' + strip(rd('src/courses.js')) + '\nreturn COURSES;\n})();' : ''),
  DATA: `const PUZZLE_DATA = ${JSON.stringify(puzzles)};\nconst CALIB = ${JSON.stringify(calib)};`, APP: APP_FILES.map(f => f === 'src/worldcourses_scoped' ? (fs.existsSync(path.join(root, 'src/worldcourses.js')) ? '// world game courses, in their own scope\nconst WORLD_COURSES = (() => {\n' + strip(rd('src/worldcourses.js')) + '\nreturn WORLD_COURSES;\n})()' : 'const WORLD_COURSES = {}') : fs.existsSync(path.join(root, f)) ? rd(f) : null).filter(x => x != null).join('\n;\n'),
};
for (const k in parts) html = html.replace(`/*${k}*/`, () => parts[k]);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB,', puzzles.length, 'puzzles');
