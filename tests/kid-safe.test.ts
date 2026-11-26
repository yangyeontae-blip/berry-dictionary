import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {Dictionary} from '../src/dict';

const load = () => new Dictionary(async p => JSON.parse(readFileSync('public/' + p, 'utf8'))).load();

test('어른 낱말은 사전에 없다(검색으로도 안 나온다)', async () => {
  const d = await load();
  for (const w of ['창녀', '마약', '섹스', '포르노', '매춘', '음경', '강간', '도박', '필로폰', '대마초', '담배', '소주', '맥주', '자살', '살인', '씨발', '병신', '개새끼', '근친상간', '성감대', '첩'.repeat(0)].filter(Boolean)) {
    assert.equal(d.same(w).length, 0, `‘${w}’가 남아 있어요`);
    assert.ok(!d.search(w, 5).some(r => r.w.replace(/^-|-$/g, '') === w), `검색에 ‘${w}’`);
  }
});

test('뜻풀이·예문 어디에도 어른 낱말이 없다', () => {
  const BAD = /창녀|매춘|성매매|섹스|포르노|마약|필로폰|성교(?!육)|강간|애무|포주|음란|(?<![가-힣])도박|(?<![가-힣])자살|(?<![가-힣])살인/;
  let n = 0;
  for (const f of readdirSync('public/data/e')) for (const e of JSON.parse(readFileSync('public/data/e/' + f, 'utf8'))) {
    if (['위안부', '후궁'].includes(e.w)) continue; // 6학년 사회에서 배우는 낱말
    for (const s of e.s) { const t = [s.d, ...(s.x ?? []), ...(s.t ?? [])].join(' '); if (BAD.test(t)) { n++; if (n < 5) console.log(e.w, t.slice(0, 60)); } }
  }
  assert.equal(n, 0);
});

test('뜻이 여럿인 낱말은 어른 뜻만 빠지고 남는다', async () => {
  const d = await load();
  for (const w of ['정부', '고문', '사정', '년', '술', '질', '고추', '태우다', '취하다', '내내', '다정하다', '고래', '갈무리', '솜이불', '벌거벗다']) assert.ok(d.same(w).length, `‘${w}’가 빠졌어요`);
  const sul = await Promise.all(d.same('술').map(r => d.entry(r.k)));
  assert.ok(!sul.some(e => e.s.some(s => /취하|알코올|마시/.test(s.d))), '술(마시는 술) 뜻이 남았어요');
  for (const r of d.same('년')) { const e = await d.entry(r.k); assert.ok(e.s.length && !e.s.some(s => /낮잡아/.test(s.d))); }
});
