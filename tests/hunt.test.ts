import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Dictionary} from '../src/dict';
import {split, join, bare, BASIC_CHO, CHO} from '../src/hangul';
import {pickHuntTargets} from '../src/hunt';

test('hunt pages open close to the target (second-letter narrowing)', async () => {
  const d = await new Dictionary(async p => JSON.parse(readFileSync('public/' + p, 'utf8'))).load();
  const pool = d.rows.filter(r => (r.lv === 1 || r.lv === 2) && ['명사', '동사', '형용사'].includes(r.p) && !/[-\s^]/.test(r.w) && r.w.length >= 2 && r.w.length <= 4 && (BASIC_CHO as readonly string[]).includes(CHO[split(r.w[0])?.cho ?? 99] ?? ''));
  assert.ok(pool.length > 3000);
  const pages = pool.map(r => { const w = bare(r.w), s2 = split(w[1])!; const first = d.firstIndexOf(w[0] + join({cho: s2.cho, jung: 0, jong: 0})); return Math.floor(r.k / 8) - Math.floor(first / 8); });
  assert.ok(pages.every(n => n >= 0), 'target never before the opened page');
  pages.sort((a, b) => a - b);
  const median = pages[pages.length >> 1], p90 = pages[Math.floor(pages.length * 0.9)];
  console.log('pages to turn: median', median, 'p90', p90, 'max', pages.at(-1));
  assert.ok(median <= 5 && p90 <= 15);
  const t = pickHuntTargets(pool, 5, Math.random);
  assert.equal(new Set(t.map(x => x.row.w)).size, 5);
});
