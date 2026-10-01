// Copy the Stockfish WASM build into public/engine so Vite serves it as-is.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkg = require('stockfish/package.json');
const src = join(dirname(require.resolve('stockfish/package.json')), 'bin');
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'engine');
const base = `stockfish-${pkg.buildVersion}-lite-single`;

mkdirSync(dest, { recursive: true });
for (const file of [`${base}.js`, `${base}.wasm`]) copyFileSync(join(src, file), join(dest, file));
copyFileSync(join(src, '..', 'Copying.txt'), join(dest, 'COPYING.txt'));
console.log(`Copied ${base} to public/engine`);
