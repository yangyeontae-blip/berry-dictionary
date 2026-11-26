import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Dictionary} from '../src/dict';
import {CHO, JUNG, JONG, compareWords} from '../src/hangul';
import {basketOf} from '../src/games';
import {UNIT5, ORDER_CHART, TEXTBOOK_SORT, WRAP_QUIZ, STORIES, maskDef, clueOf} from '../src/textbook';

const load = () => new Dictionary(async p => JSON.parse(readFileSync('public/' + p, 'utf8'))).load();

test('교과서 붙임 11 사전 차례표 = 앱의 자모 차례', () => {
  assert.deepEqual(ORDER_CHART.cho, [...CHO]);
  assert.deepEqual(ORDER_CHART.jung, [...JUNG]);
  assert.deepEqual(ORDER_CHART.jong, JONG.slice(1));
});

test('5단원 13차시가 빠짐없이 이어진다', () => {
  const covered = UNIT5.flatMap(l => { const [a, b] = l.no.split('~').map(Number); return Array.from({length: (b || a) - a + 1}, (_, i) => a + i); });
  assert.deepEqual(covered, Array.from({length: 13}, (_, i) => i + 1));
  for (const l of UNIT5) assert.ok(l.go.length >= 1, l.title);
});

test('교과서 낱말이 사전에 있고, 낱말 바구니 분류가 사전 품사와 맞다', async () => {
  const d = await load();
  for (const l of UNIT5) for (const w of l.words ?? []) assert.ok(d.has(w) || d.baseForms(w).length, `${l.no}차시 낱말 ‘${w}’`);
  for (const key of ['name', 'move', 'look'] as const) for (const w of TEXTBOOK_SORT[key]) {
    const rows = d.same(w);
    assert.ok(rows.length, `바구니 낱말 ‘${w}’`);
    assert.ok(rows.some(r => basketOf(r) === key), `‘${w}’는 ${key} 바구니`);
  }
});

test('마무리 도전 정답이 사전 차례·발음과 맞다', async () => {
  const d = await load();
  assert.ok(compareWords('하교', '학문') < 0);
  assert.ok(compareWords('겨레', '고요') < 0);
  for (const q of WRAP_QUIZ) { assert.ok(q.a >= 0 && q.a < q.options.length); if (q.word) assert.ok(d.has(q.word), q.word); }
  const pr = async (w: string) => (await d.entry(d.same(w)[0].k)).pr?.replace(/ː/g, '') ?? '';
  assert.equal(await pr('솜이불'), '솜니불');
  assert.equal(await pr('담요'), '담뇨');
});

test('세 가지 단서: 뜻풀이에서 답을 가리고 보기에 정답이 하나', () => {
  assert.equal(maskDef('우산을 펴서 비를 막는 우산.', '우산'), '○○을 펴서 비를 막는 ○○.');
  assert.ok(!maskDef('달리기를 하며 빨리 달리다.', '달리다').includes('달리'));
  const c = clueOf('우산', '이름을 나타내는 말', '비가 올 때 펴서 쓰는 우산.', 'ㅇ', ['우유', '우리', '오리', '우산'], () => 0.3);
  assert.equal(c.options.filter(o => o === '우산').length, 1);
  assert.equal(c.options.length, 4);
  assert.ok(!c.clues[0].includes('우산'));
});

test('읽기 글은 1,200자 이내', () => { for (const s of STORIES) assert.ok(s.x.length <= 1200 && s.x.length > 100); });
