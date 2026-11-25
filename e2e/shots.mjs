// 화면 사진: node e2e/shots.mjs <출력 폴더> [주소]
import {chromium} from '../../math/node_modules/@playwright/test/index.mjs';
const OUT = process.argv[2], URL = process.argv[3] || 'http://127.0.0.1:4180/';
const b = await chromium.launch({channel: 'chrome'});
for (const [name, vp] of [['pc', {width: 1440, height: 900}], ['phone', {width: 390, height: 844}]]) {
  const p = await b.newPage({viewport: vp, deviceScaleFactor: 1});
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const shot = (n, full = name === 'phone') => p.screenshot({path: `${OUT}/${name}-${n}.png`, fullPage: full});
  await p.goto(URL); await p.waitForSelector('.book'); await p.waitForTimeout(800); await shot('home', false);
  await p.fill('#q', '먹었어요'); await p.waitForTimeout(500); await shot('search', false);
  await p.goto(URL + '#w/' + await p.evaluate(() => window.__dict.same('다정하다')[0].k)); await p.waitForSelector('.word-card'); await p.waitForTimeout(500); await shot('word');
  await p.goto(URL + '#hunt'); await p.waitForSelector('.steps'); await p.waitForTimeout(500); await shot('hunt', false);
  await p.goto(URL + '#read'); await p.waitForSelector('.tok'); await p.click('.tok:has-text("모으느라")'); await p.waitForSelector('.read-panel .hint-card'); await p.waitForTimeout(400); await shot('read');
  await p.goto(URL + '#play'); await p.waitForSelector('.game-card'); await p.waitForTimeout(400); await shot('play');
  await p.goto(URL + '#play/sort'); await p.waitForSelector('[data-card]'); await p.click('[data-card]'); await p.waitForTimeout(300); await shot('sort');
  await p.goto(URL + '#play/order'); await p.waitForSelector('[data-card]'); const ks = (await p.$$eval('[data-card]', bs => bs.map(b => +b.dataset.card))).sort((a, b) => a - b); await p.click(`[data-card="${ks[0]}"]`); await p.click(`[data-card="${ks[1]}"]`); await p.waitForTimeout(300); await shot('order');
  await p.goto(URL + '#play/pair-a'); await p.waitForSelector('[data-l]'); await p.waitForTimeout(300); await shot('pair');
  await p.goto(URL + '#play/honor'); await p.waitForSelector('[data-ans]'); await p.waitForTimeout(300); await shot('honor');
  await p.evaluate(() => { const d = window.__dict, pick = w => d.same(w)[0]; localStorage.setItem('berry-dictionary-v1', JSON.stringify({pouch: [
    {w: '모으다', n: 0, k: pick('모으다').k, at: Date.now(), ctx: '덤불 아래에는 작은 다람쥐가 도토리를 모으느라 바빴어요.', sense: '한데 합치다.'},
    {w: '사과', n: 1, k: pick('사과').k, at: Date.now() - 86400000, my: '나는 빨간 사과를 좋아해요.'},
    {w: '다정하다', n: 0, k: pick('다정하다').k, at: Date.now() - 2 * 86400000}], stamps: 12, found: [], sound: true, guesses: 3, games: 4, notes: 1, best: 83000})); });
  await p.goto(URL + '#pouch'); await p.reload(); await p.waitForSelector('.book'); await p.waitForTimeout(400); await shot('pouch');
  await p.goto(URL + '#teacher'); await p.click('#sample-text'); await p.click('#make-text'); await p.waitForSelector('.qr svg'); await p.evaluate(() => document.querySelector('.page-left').scrollTo(0, 0)); await p.waitForTimeout(400); await shot('teacher');
  console.log(name, errors.length ? errors : 'no errors');
  await p.close();
}
await b.close();
