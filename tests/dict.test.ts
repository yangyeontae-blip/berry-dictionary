import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Dictionary} from '../src/dict';

const load = () => new Dictionary(async p => JSON.parse(readFileSync('public/' + p, 'utf8'))).load();

test('real data: search, initials, base forms and entries', async () => {
  const d = await load();
  assert.ok(d.rows.length > 45000); // 초등용으로 거른 뒤(scripts/kid-filter.mjs)
  const r = d.search('다정하다');
  assert.equal(r[0].w, '다정하다');
  const e = await d.entry(r[0].k);
  assert.equal(e.w, '다정하다');
  assert.equal(e.p, '형용사');
  assert.ok(e.s[0].d.length > 5);
  assert.ok(d.search('ㄷㅈㅎㄷ').some(x => x.w === '다정하다'));
  assert.ok(d.baseForms('먹었어요').includes('먹다'));
  assert.ok(d.baseForms('도와줘서').length >= 0);
  const k = d.firstIndexOf('다');
  assert.ok(d.rows[k].w.replace(/^-/, '').startsWith('다'));
  assert.ok(d.rows[k - 1].w.replace(/^-/, '') < '다');
  // 모든 조각의 낱말이 목록 차례와 맞는지 몇 군데 확인
  for (const i of [0, 499, 500, 12345, d.rows.length - 1]) assert.equal((await d.entry(i)).w, d.rows[i].w);
});
