// Regenerates lobby/src/chess-engine.js from src/engine.js (the single source of truth).
// Run from anywhere: node lobby/sync-engine.mjs
// The Worker build only reliably sees files inside lobby/, so the engine is copied here
// and turned into an ES module.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, '..', 'src', 'engine.js');
const outPath = join(here, 'src', 'chess-engine.js');

let src = readFileSync(srcPath, 'utf8');
const guard = "if (typeof module !== 'undefined') module.exports = ChessEngineFactory;";
if (!src.includes(guard)) throw new Error('engine.js export guard not found; update sync-engine.mjs');
src = src.replace(guard, 'export default ChessEngineFactory;');

const header = '// GENERATED FILE - DO NOT EDIT.\n' +
  '// Copy of src/engine.js converted to an ES module for the lobby Worker.\n' +
  '// Regenerate with: node lobby/sync-engine.mjs\n';
writeFileSync(outPath, header + src);
console.log('wrote ' + outPath);
