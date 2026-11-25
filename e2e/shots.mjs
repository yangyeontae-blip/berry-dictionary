// 화면 사진: node e2e/shots.mjs <출력 폴더>
import {chromium} from '../../math/node_modules/@playwright/test/index.mjs';
const OUT = process.argv[2], URL = process.argv[3] || 'http://127.0.0.1:4180/';
const b = await chromium.launch({channel: 'chrome'});
for (const [name, vp] of [['pc', {width: 1440, height: 900}], ['phone', {width: 390, height: 844}]]) {
  const p = await b.newPage({viewport: vp, deviceScaleFactor: 1});
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await p.goto(URL); await p.waitForSelector('.book'); await p.waitForTimeout(800);
  await p.screenshot({path: `${OUT}/${name}-home.png`});
  await p.fill('#q', '먹었어요'); await p.waitForTimeout(500); await p.screenshot({path: `${OUT}/${name}-search.png`});
  await p.goto(URL + '#w/' + await p.evaluate(() => window.__dict.same('다정하다')[0].k)); await p.waitForSelector('.word-card'); await p.waitForTimeout(500);
  await p.screenshot({path: `${OUT}/${name}-word.png`, fullPage: name === 'phone'});
  await p.goto(URL + '#hunt'); await p.waitForSelector('.steps'); await p.waitForTimeout(500); await p.screenshot({path: `${OUT}/${name}-hunt.png`});
  await p.goto(URL + '#pouch'); await p.waitForTimeout(400); await p.screenshot({path: `${OUT}/${name}-pouch.png`});
  console.log(name, errors.length ? errors : 'no errors');
  await p.close();
}
await b.close();
