import {defineConfig, type Plugin} from 'vite';
import {readdirSync, statSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, sep} from 'node:path';

// 빌드 뒤 dist/sw.js 에 판 번호와 미리 넣어 둘 파일 목록(사전 조각 data/e 는 빼고)을 채운다.
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'berry-sw', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.endsWith(join('data', 'e'))) walk(p); } else files.push(relative(outDir, p).split(sep).join('/')); } };
      walk(outDir);
      const shell = ['./', ...files.filter(f => f !== 'sw.js' && !f.endsWith('.txt') && !f.endsWith('.md') && f !== '.nojekyll' && !f.startsWith('fonts/LICENSE'))];
      const sw = join(outDir, 'sw.js');
      writeFileSync(sw, readFileSync(sw, 'utf8').replace("'__VERSION__'", "'" + Date.now().toString(36) + "'").replace('= __SHELL__;', '= ' + JSON.stringify(shell) + ';'));
    },
  };
}
export default defineConfig({base: './', build: {target: 'es2020', assetsInlineLimit: 0}, plugins: [serviceWorker()]});
