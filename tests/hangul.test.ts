import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initials,isInitialQuery,compareWords,firstLetterSteps,baseFormHints,split,join} from '../src/hangul';

test('split/join round trip and initials', () => {
  for (const ch of '가각힣다정') assert.equal(join(split(ch)!), ch);
  assert.equal(initials('다정하다'), 'ㄷㅈㅎㄷ');
  assert.ok(isInitialQuery('ㄷㅈ'));
  assert.ok(!isInitialQuery('다ㅈ'));
});

test('dictionary order follows consonant, vowel, final consonant', () => {
  const words = ['다정하다', '가방', '까치', '나무', '각', '개', '-가', '간'];
  assert.deepEqual([...words].sort(compareWords), ['-가', '각', '간', '개', '까치', '나무', '다정하다', '가방'].sort(compareWords));
  assert.ok(compareWords('가', '각') < 0);
  assert.ok(compareWords('각', '개') < 0);
  assert.ok(compareWords('개', '까치') < 0);
  assert.deepEqual(firstLetterSteps('닭'), {cho: 'ㄷ', jung: 'ㅏ', jong: 'ㄺ', syllable: '닭'});
});

test('base form helper finds the dictionary headword for changed forms', () => {
  const dict = new Set(['먹다', '가다', '보다', '하다', '예쁘다', '모르다', '돕다', '듣다', '짓다', '하얗다', '학교', '친구', '빨갛다', '고맙다', '쓰다', '주다', '걷다', '바쁘다']);
  const has = (w: string) => dict.has(w);
  const cases: [string, string][] = [
    ['먹었어요', '먹다'], ['갔다', '가다'], ['봤어요', '보다'], ['했습니다', '하다'], ['예뻐요', '예쁘다'],
    ['몰라', '모르다'], ['도와', '돕다'], ['들어요', '듣다'], ['지어', '짓다'], ['하얀', '하얗다'],
    ['학교에서', '학교'], ['친구들이', '친구'], ['빨개', '빨갛다'], ['고마워요', '고맙다'], ['써요', '쓰다'],
    ['줬어', '주다'], ['걸어서', '걷다'], ['바빠서', '바쁘다'], ['먹고', '먹다'], ['갑니다', '가다'],
  ];
  for (const [form, want] of cases) assert.ok(baseFormHints(form, has).includes(want), `${form} → ${want}: ${baseFormHints(form, has)}`);
  assert.deepEqual(baseFormHints('먹다', has), []);
});
