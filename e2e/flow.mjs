// 기능 점검: 찾기 놀이 끝까지, 기본형 안내, 뜻 짐작, 주머니, 선생님 목록. node e2e/flow.mjs
import {chromium} from '../../math/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
const URL = process.argv[2] || 'http://127.0.0.1:4180/';
const b = await chromium.launch({channel: 'chrome'});
const p = await b.newPage({viewport: {width: 1280, height: 860}});
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(URL); await p.waitForSelector('.book');
// 기본형 도우미
await p.fill('#q', '먹었어요'); await p.waitForSelector('.hint-card');
await p.click('.hint-words button:has-text("먹다")'); await p.waitForSelector('.headword');
assert.match(await p.textContent('.headword'), /먹다/);
// 뜻 짐작하기
await p.click('[data-guess]'); await p.fill('.guess textarea', '밥을 입에 넣는 것'); await p.click('[data-reveal]');
assert.match(await p.textContent('.my-guess'), /밥을 입에/);
// 주머니
await p.click('[data-pouch]'); await p.waitForSelector('[data-pouch][aria-pressed=true]');
// 초성
await p.fill('#q', 'ㄷㅈㅎㄷ'); await p.waitForSelector('.result-list'); assert.ok((await p.textContent('.result-list')).includes('다정하다'));
// 찾기 놀이 5문제
await p.goto(URL + '#hunt'); await p.waitForSelector('.steps');
for (let round = 0; round < 5; round++) {
  for (let guard = 0; guard < 80; guard++) {
    const info = await p.evaluate(() => { const t = document.querySelector('.target')?.textContent; return {t, ask: !!document.querySelector('[data-ans]'), pick: !!document.querySelector('[data-pick]'), found: !!document.querySelector('.found')}; });
    if (info.found) break;
    if (info.ask) {
      const ans = await p.evaluate(() => {
        const d = window.__dict; const steps = [...document.querySelectorAll('.steps li:not(.arrow)')]; const now = steps.findIndex(li => li.classList.contains('now'));
        const label = steps[now].textContent;
        const target = document.querySelector('.target').textContent.trim();
        if (label.includes('기본형')) { return [...document.querySelectorAll('[data-ans]')].map(b => b.dataset.ans).find(a => d.has(a) && a !== target); }
        const s = target.charCodeAt(0) - 0xac00; const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        if (label.includes('첫 자음')) return CHO[Math.floor(s / 588)];
        if (label.includes('모음')) return JUNG[Math.floor((s % 588) / 28)];
        return JONG[s % 28] || '없음';
      });
      await p.click(`[data-ans="${ans}"]`); await p.waitForTimeout(600); continue;
    }
    if (info.pick) {
      const k = await p.evaluate(() => { const t = document.querySelector('.target').textContent.trim(); const b = [...document.querySelectorAll('[data-pick]')].find(b => b.querySelector('b').firstChild.textContent === t); return b ? b.dataset.pick : null; });
      if (k) { await p.click(`[data-pick="${k}"]`); await p.waitForSelector('.found'); break; }
      await p.click('[aria-label="다음 쪽"]'); await p.waitForTimeout(250); continue;
    }
  }
  assert.ok(await p.$('.found'), 'round ' + round + ' found');
  const next = await p.$('[data-next]'); if (next) { await next.click(); await p.waitForSelector('.steps'); }
}
assert.ok(await p.$('[data-again]'));
const stamps = await p.evaluate(() => JSON.parse(localStorage.getItem('berry-dictionary-v1')).stamps); assert.equal(stamps, 5);
// 선생님 목록
await p.goto(URL + '#teacher'); await p.fill('#list-words', '다정하다\n먹었어요\n없는말쀍'); await p.click('#make-list');
const url = await p.inputValue('.share-url'); assert.match(url, /#list=/);
await p.goto(url); await p.waitForSelector('.steps'); assert.match(await p.textContent('.ribbon'), /이번 주 낱말 1\/2/);

// 놀이터: 낱말 바구니
const POS = {'명사': 'name', '동사': 'move', '형용사': 'look'};
await p.goto(URL + '#play'); await p.waitForSelector('.game-card');
await p.click('a[href="#play/sort"]'); await p.waitForSelector('[data-card]');
for (let g = 0; g < 6; g++) {
  const k = await p.getAttribute('[data-card]', 'data-card');
  const pos = await p.evaluate(k => window.__dict.rows[+k].p, k);
  await p.click(`[data-card="${k}"]`); await p.click(`[data-basket="${POS[pos]}"]`); await p.waitForTimeout(80);
}
await p.waitForSelector('.game-done');
// 사전 차례 줄 세우기 3단계
await p.goto(URL + '#play/order');
for (let level = 0; level < 3; level++) {
  await p.waitForSelector('[data-card]');
  const ks = (await p.$$eval('[data-card]', bs => bs.map(b => +b.dataset.card))).sort((a, b) => a - b);
  for (const k of ks) await p.click(`[data-card="${k}"]`);
  if (level < 2) await p.click('[data-level]');
}
await p.waitForSelector('.game-done');
// 짝 찾기
const pairs = await (await fetch(URL.replace(/#.*$/, '') + 'data/pairs.json')).json();
for (const kind of ['a', 's']) {
  await p.goto(URL + '#play/pair-' + kind); await p.waitForSelector('[data-l]');
  const lefts = await p.$$eval('[data-l]', bs => bs.map(b => b.dataset.l));
  const rights = await p.$$eval('[data-r]', bs => bs.map(b => b.dataset.r));
  for (const l of lefts) { const r = rights.find(r => pairs.some(x => x[0] === l && x[1] === r && x[2] === kind)); await p.click(`[data-l="${l}"]`); await p.click(`[data-r="${r}"]`); }
  await p.waitForSelector('.game-done');
}
// 높임말 5문제
await p.goto(URL + '#play/honor');
for (let q = 0; q < 5; q++) {
  await p.waitForSelector('[data-ans]');
  for (const o of await p.$$eval('[data-ans]', bs => bs.map(b => b.dataset.ans))) { if (await p.$('.choice.right')) break; await p.click(`[data-ans="${o}"]`); await p.waitForTimeout(60); }
  await p.click('[data-next]');
}
await p.waitForSelector('.game-done');
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('berry-dictionary-v1')));
assert.equal(st.games, 5); assert.equal(st.stamps, 10);
// 글 속 낱말 찾기 → 기본형 → 뜻 고르기 → 낱말 공책
await p.goto(URL + '#read'); await p.waitForSelector('.tok');
await p.click('.tok:has-text("모으느라")'); await p.waitForSelector('.read-panel .hint-card');
assert.match(await p.textContent('.read-panel .hint-card'), /모으다/);
await p.click('[data-sense="0"]'); await p.click('[data-note]');
await p.click('.tok:has-text("다람쥐가")'); await p.waitForSelector('.read-panel .hint-card'); assert.match(await p.textContent('.read-panel .hint-card'), /다람쥐/);
// 내 문장 짓기
await p.goto(URL + '#w/' + (await p.evaluate(() => window.__dict.same('사과')[0].k))); await p.waitForSelector('.my-sentence');
await p.fill('.my-sentence textarea', '나는 빨간 사과를 좋아해요.'); await p.click('[data-mine]');
await p.goto(URL + '#pouch'); await p.waitForSelector('.pouch-list');
const notes = await p.textContent('.pouch-list'); assert.match(notes, /나는 빨간 사과를/); assert.match(notes, /찾은 문장/);
// 큰 사전 버튼(키가 없으면 '준비 중', 연결 전이면 '닿지 못했어요')
await p.goto(URL); await p.fill('#q', '뀨뀨뀨없는말'); await p.waitForSelector('[data-big]', {state: 'attached'});
await p.waitForTimeout(1500); console.log('big dict button visible:', await p.isVisible('[data-big]'));
// 선생님 글 보내기 주소 + QR
await p.goto(URL + '#teacher'); await p.fill('#text-body', '토끼가 깡충깡충 뛰어갔어요. 거북이는 천천히 걸었어요.'); await p.click('#make-text');
await p.waitForSelector('.share-text .qr svg'); const turl = await p.inputValue('.share-text .share-url'); assert.match(turl, /#read=/);
await p.goto(turl); await p.waitForSelector('.tok'); assert.match(await p.textContent('.passage'), /거북이는/);
console.log('flow ok', errors.length ? errors : 'no page errors');
await b.close();
