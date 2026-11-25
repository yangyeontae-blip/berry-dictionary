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
  for (let guard = 0; guard < 40; guard++) {
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
      await p.click('[data-turn]:not([disabled]) >> nth=-1'); await p.waitForTimeout(250); continue;
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
console.log('flow ok', errors.length ? errors : 'no page errors');
await b.close();
