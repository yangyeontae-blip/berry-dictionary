// 한글 자모 다루기: 초성 검색, 국어사전 차례, 기본형 도우미.
// 국어사전 차례(첫 자음 → 모음 → 받침)는 유니코드 완성형 차례와 같다.

export const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as const;
export const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'] as const;
export const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as const;
/** 3학년 사전 찾기 놀이에서 쓰는 기본 자음 14개(된소리는 예사소리 다음에 나온다고 따로 알려 준다). */
export const BASIC_CHO = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as const;

const BASE = 0xac00, LAST = 0xd7a3;
export type Syllable = {cho: number; jung: number; jong: number};

export function isSyllable(ch: string) { const c = ch.charCodeAt(0); return c >= BASE && c <= LAST; }
export function split(ch: string): Syllable | null {
  if (!ch || !isSyllable(ch)) return null;
  const n = ch.charCodeAt(0) - BASE;
  return {cho: Math.floor(n / 588), jung: Math.floor((n % 588) / 28), jong: n % 28};
}
export function join(s: Syllable) { return String.fromCharCode(BASE + s.cho * 588 + s.jung * 28 + s.jong); }

/** 낱말 맨 앞의 '-'(붙임표)를 뺀 찾기용 모양. */
export const bare = (w: string) => w.replace(/^-+|-+$/g, '');

/** '다정하다' → 'ㄷㅈㅎㄷ'. 한글이 아닌 글자는 그대로 둔다. */
export function initials(word: string) {
  let out = '';
  for (const ch of word) { const s = split(ch); out += s ? CHO[s.cho] : ch; }
  return out;
}
const CHO_SET = new Set<string>(CHO);
/** 입력이 모두 자음(초성)인지: 'ㄷㅈ' → true */
export const isInitialQuery = (q: string) => q.length > 0 && [...q].every(ch => CHO_SET.has(ch));

/** 국어사전 차례로 견주기(첫 자음 → 모음 → 받침 → 다음 글자, 같은 낱말은 동음이의 번호). */
export function compareWords(a: string, b: string) {
  const x = bare(a), y = bare(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** 첫 글자의 자음·모음·받침 이름 — 찾기 놀이 단계 안내에 쓴다. */
export function firstLetterSteps(word: string) {
  const s = split(bare(word)[0] ?? '');
  if (!s) return null;
  return {cho: CHO[s.cho], jung: JUNG[s.jung], jong: JONG[s.jong], syllable: join(s)};
}

// ── 기본형 도우미 ─────────────────────────────────────────────
// 아이들이 '먹었어요'처럼 모양이 바뀐 말을 그대로 찾으려 할 때(3~4학년 성취기준 해설의 대표 오개념)
// 사전에 실린 기본형 후보를 알려 준다. 완벽한 형태 분석기가 아니라, 사전에 실제로 있는 낱말만 후보로 보여 준다.

const ENDINGS = [
  '었습니다','았습니다','였습니다','겠습니다','습니다','ㅂ니다',
  '었어요','았어요','였어요','어요','아요','여요','에요','예요','이에요','세요','셨어요','으세요',
  '었다','았다','였다','었고','았고','었는데','았는데','는데','은데','ㄴ데',
  '어서','아서','여서','으면','면','으니까','니까','으니','니','으며','며','고','게','지','지만','기','네','자','다가','도록',
  '는','은','ㄴ','을','ㄹ','어','아','여','다','요','서','도','야','라',
];

function stripJong(syl: string, jongName: string) {
  const s = split(syl); if (!s) return null;
  if (JONG[s.jong] !== jongName) return null;
  return join({...s, jong: 0});
}

/** 한 낱말꼴에서 기본형 후보 줄기(‘다’ 앞부분)들을 만든다. */
export function stemCandidates(form: string): string[] {
  const word = form.trim().replace(/[.,!?~…'"]+$/g, '');
  const out = new Set<string>();
  const push = (stem: string) => { if (stem) out.add(stem); };
  const variants = (stem: string) => {
    if (!stem) return;
    push(stem);
    const last = stem.at(-1)!, head = stem.slice(0, -1), s = split(last);
    if (!s) return;
    const J = JUNG[s.jung], K = JONG[s.jong];
    // 받침으로 붙은 어미: 갔/간/갈/갑 → 가
    for (const jn of ['ㅆ','ㄴ','ㄹ','ㅂ','ㅁ']) { const t = stripJong(last, jn); if (t) { push(head + t); if (t === '하' || J === 'ㅐ') {/* 했 → 하 아래에서 처리 */} } }
    const open = join({...s, jong: 0});
    // 모음이 줄어든 꼴: 봐/봤→보, 줘/줬→주, 해/했→하, 져/졌→지, 돼/됐→되
    const back: Record<string, string> = {'ㅘ':'ㅗ','ㅝ':'ㅜ','ㅕ':'ㅣ','ㅙ':'ㅚ'};
    if (back[J]) push(head + join({cho: s.cho, jung: JUNG.indexOf(back[J] as never), jong: 0}));
    if (J === 'ㅐ' && CHO[s.cho] === 'ㅎ') push(head + '하');
    if (J === 'ㅐ') push(head + join({cho: s.cho, jung: JUNG.indexOf('ㅏ' as never), jong: 27})); // 빨개 → 빨갛
    // 으 탈락: 써→쓰, 커→크, 바빠→바쁘, 예뻐→예쁘
    if (J === 'ㅓ' || J === 'ㅏ') push(head + join({cho: s.cho, jung: JUNG.indexOf('ㅡ' as never), jong: 0}));
    // 르 불규칙: 몰라→모르, 불러→부르
    if ((open === '라' || open === '러') && head) {
      const p = split(head.at(-1)!);
      if (p && JONG[p.jong] === 'ㄹ') push(head.slice(0, -1) + join({...p, jong: 0}) + '르');
    }
    // ㅂ 불규칙: 도와→돕, 더워→덥, 고마워→고맙
    if ((open === '와' || open === '워') && head) {
      const p = split(head.at(-1)!);
      if (p && p.jong === 0) push(head.slice(0, -1) + join({...p, jong: JONG.indexOf('ㅂ' as never)}));
    }
    // ㄷ 불규칙: 들어→듣, 걸어→걷
    if (K === 'ㄹ') push(head + join({...s, jong: JONG.indexOf('ㄷ' as never)}));
    // ㅅ 불규칙: 지어→짓, 나아→낫
    if (s.jong === 0) push(head + join({...s, jong: JONG.indexOf('ㅅ' as never)}));
    // ㅎ 불규칙: 하얀→하얗, 그런→그렇
    if (K === 'ㄴ') push(head + join({...s, jong: JONG.indexOf('ㅎ' as never)}));
  };
  // 끝에서 어미를 떼어 본다(자모로 시작하는 어미는 마지막 글자 받침으로 붙어 있다).
  for (const e of ENDINGS) {
    if (/^[ㄱ-ㅎ]/.test(e)) {
      const rest = e.slice(1), jongName = e[0];
      if (rest && !word.endsWith(rest)) continue;
      const body = rest ? word.slice(0, -rest.length) : word;
      const t = body && stripJong(body.at(-1)!, jongName);
      if (t) variants(body.slice(0, -1) + t);
    } else if (word.endsWith(e) && word.length > e.length) {
      variants(word.slice(0, -e.length));
    }
  }
  variants(word);
  return [...out];
}

/**
 * 사전에 실제로 있는 기본형만 골라 준다.
 * has(w): 그 낱말이 사전 표제어인지, kindOf(w): 품사(동사·형용사면 '다'로 끝남).
 */
export function baseFormHints(form: string, has: (w: string) => boolean): string[] {
  const word = form.trim();
  if (!word || has(word)) return [];
  const found: string[] = [];
  for (const stem of stemCandidates(word)) {
    const w = stem + '다';
    if (w !== word && has(w) && !found.includes(w)) found.push(w);
  }
  // 이름을 나타내는 말 + 토씨: 학교에서 → 학교, 친구들이 → 친구
  for (let i = word.length - 1; i >= 1 && !found.length; i--) {
    const head = word.slice(0, i);
    if (has(head) && !found.includes(head)) { found.push(head); break; }
  }
  return found.slice(0, 4);
}
