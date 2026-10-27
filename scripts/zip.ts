/**
 * Packages each built browser target into release/fedlens-<target>-v<version>.zip,
 * ready to attach to a GitHub Release or upload to a store.
 *
 * Usage: npm run build && npm run zip
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync, type Zippable } from 'fflate';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const TARGETS = ['chrome', 'firefox'] as const;

function collect(dir: string, root: string, out: Zippable): Zippable {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, root, out);
    // Zip entries always use forward slashes, even when built on Windows.
    else out[relative(root, path).split('\\').join('/')] = readFileSync(path);
  }
  return out;
}

mkdirSync('release', { recursive: true });
for (const target of TARGETS) {
  const dir = join('dist', target);
  if (!existsSync(join(dir, 'manifest.json'))) {
    console.error(`Missing ${dir}/manifest.json — run "npm run build" first.`);
    process.exit(1);
  }
  const file = join('release', `fedlens-${target}-v${version}.zip`);
  writeFileSync(file, zipSync(collect(dir, dir, {}), { level: 9 }));
  console.log(`${file} (${(statSync(file).size / 1e6).toFixed(1)} MB)`);
}
