import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Dictionary} from '../src/dict';
import {bare, split} from '../src/hangul';
import {pickSortRound, basketOf, pickOrderRound, isDictOrder, pickPairRound, pickHonorRound, HONOR, type Pair} from '../src/games';

const load = () => new Dictionary(async p => JSON.parse(readFileSync('public/' + p, 'utf8'))).load();

test('sort round: two words per basket, no adult words', async () => {
  const d = await load();
  for (let i = 0; i < 30; i++) {
    const r = pickSortRound(d.rows, 6);
    assert.equal(r.length, 6);
    for (const key of ['name', 'move', 'look']) assert.equal(r.filter(x => basketOf(x) === key).length, 2);
    assert.ok(r.every(x => !x.x));
  }
});

test('order round levels and checker', async () => {
  const d = await load();
  for (const level of [1, 2, 3] as const) for (let i = 0; i < 10; i++) {
    const r = pickOrderRound(d.rows, level, 5);
    assert.equal(r.length, 5, 'level ' + level);
    const firsts = r.map(x => bare(x.w)[0]);
    if (level === 3) assert.equal(new Set(firsts).size, 1);
    if (level === 2) assert.equal(new Set(firsts.map(c => split(c)!.cho)).size, 1);
    const sorted = [...r].sort((a, b) => a.k - b.k);
    assert.ok(isDictOrder(sorted));
    assert.ok(!isDictOrder([...sorted].reverse()));
  }
});

test('pair round has distinct words of one kind', () => {
  const pairs = JSON.parse(readFileSync('public/data/pairs.json', 'utf8')) as Pair[];
  for (let n = 0; n < 40; n++) for (const kind of ['s', 'a'] as const) {
    const r = pickPairRound(pairs, kind, 4);
    assert.equal(r.length, 4);
    assert.ok(r.every(p => p[2] === kind));
    assert.equal(new Set(r.flatMap(p => [p[0], p[1]])).size, 8);
    const words = r.flatMap(p => [p[0], p[1]]), ok = new Set(r.map(p => p[0] + '|' + p[1]));
    for (const x of words) for (const y of words) if (x !== y && pairs.some(p => p[2] === kind && p[0] === x && p[1] === y)) assert.ok(ok.has(x + '|' + y), 'only one right answer: ' + x + y);
  }
});

test('honorific answers are real dictionary words', async () => {
  const d = await load();
  for (const q of HONOR) assert.ok(d.has(q.base), q.base);
  const r = pickHonorRound(5);
  assert.ok(r.every(q => q.options.includes(q.h) && new Set(q.options).size === 3));
});

test('kid examples are filtered', async () => {
  const d = await load();
  const k = d.same('가다')[0].k, e = await d.entry(k);
  const all = e.s.flatMap(s => [...(s.x ?? []), ...(s.t ?? [])]).join(' ');
  assert.ok(!/이혼|술을|아내|여자 친구/.test(all), all.slice(0, 200));
  assert.ok(d.same('술')[0].x === 1 && d.same('가다')[0].x === 0);
});
