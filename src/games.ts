// 놀이터 문제 고르기: 낱말 분류, 사전 차례 줄 세우기, 비슷한말·반대말 짝 찾기, 높임말 바꾸기.
import type {Row} from './dict';
import {bare, split} from './hangul';

type Rand = () => number;
export const shuffle = <T,>(a: T[], rand: Rand = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = <T,>(a: T[], rand: Rand) => a[Math.floor(rand() * a.length)];

/** 놀이에 쓰는 쉬운 낱말: 초급·중급, 아이에게 어울리는 낱말, 붙임표·띄어쓰기 없는 2~4글자. */
export function playPool(rows: Row[]) {
  return rows.filter(r => (r.lv === 1 || r.lv === 2) && !r.x && !/[-\s^]/.test(r.w) && r.w.length >= 1 && r.w.length <= 4);
}

// ── 낱말 분류: 이름을 나타내는 말 / 움직임을 나타내는 말 / 성질이나 모양을 나타내는 말 ──
export const BASKETS = [
  {key: 'name', label: '이름을 나타내는 말', pos: ['명사'], color: 'berry'},
  {key: 'move', label: '움직임을 나타내는 말', pos: ['동사'], color: 'leaf'},
  {key: 'look', label: '모양이나 성질을 나타내는 말(예쁘다, 차갑다)', pos: ['형용사'], color: 'sky'},
] as const;
export type BasketKey = typeof BASKETS[number]['key'];
export const basketOf = (r: Row): BasketKey | null => BASKETS.find(b => (b.pos as readonly string[]).includes(r.p))?.key ?? null;

/** 낱말 바구니에 쓰는 낱말: 3학년이 바로 떠올릴 수 있는 구체적인 낱말만 사람이 골랐다(뜻이 추상적이거나 품사가 둘인 낱말 제외). */
export const SORT_WORDS = {
  name: '사과 연필 강아지 학교 운동장 친구 나무 의자 우산 가방 자동차 비행기 꽃 바다 하늘 구름 책상 우유 신발 모자 시계 고양이 토끼 기차 공책 가위 냉장고 빵 딸기 눈사람'.split(' '),
  move: '달리다 먹다 마시다 읽다 쓰다 걷다 웃다 울다 던지다 줍다 씻다 그리다 부르다 앉다 자르다 열다 닫다 뛰다 접다 만들다 타다 찾다 잡다 날다 헤엄치다 노래하다 청소하다 말하다 듣다'.split(' '),
  look: '예쁘다 크다 작다 길다 짧다 높다 낮다 무겁다 가볍다 빨갛다 파랗다 노랗다 차갑다 뜨겁다 달다 짜다 맵다 시끄럽다 조용하다 깨끗하다 더럽다 둥글다 부드럽다 딱딱하다 밝다 어둡다 넓다 좁다 귀엽다 따뜻하다'.split(' '),
} as const;
/** 바구니마다 2개씩(모두 n개) 고른다. 같은 첫 글자는 피한다. */
export function pickSortRound(rows: Row[], n = 6, rand: Rand = Math.random, words: {name: readonly string[]; move: readonly string[]; look: readonly string[]} = SORT_WORDS) {
  const out: Row[] = [], used = new Set<string>();
  const byWord = new Map<string, Row>();
  for (const r of rows) { const w = bare(r.w); if (!byWord.has(w) && basketOf(r)) byWord.set(w, r); }
  for (let b = 0, tries = 0; out.length < n && tries < 2000; tries++) {
    const basket = BASKETS[b % 3], w = pick([...words[basket.key]], rand), r = byWord.get(w);
    if (!r || basketOf(r) !== basket.key || used.has(w) || used.has(w[0])) continue;
    used.add(w); used.add(w[0]); out.push(r); b++;
  }
  return shuffle(out, rand);
}

// ── 사전 차례 줄 세우기 ──
/** level 1: 첫 자음이 모두 다름, 2: 첫 자음은 같고 모음이 다름, 3: 첫 글자가 같음(둘째 글자로 견줌). 정답 차례는 사전 위치(k). */
export function pickOrderRound(rows: Row[], level: 1 | 2 | 3, n = 5, rand: Rand = Math.random): Row[] {
  const pool = playPool(rows).filter(r => r.lv === 1 && r.w.length >= 2);
  for (let attempt = 0; attempt < 200; attempt++) {
    const seed = pick(pool, rand), s0 = split(bare(seed.w)[0])!;
    const same = (r: Row) => { const s = split(bare(r.w)[0]); if (!s) return false; return level === 1 ? true : level === 2 ? s.cho === s0.cho : bare(r.w)[0] === bare(seed.w)[0]; };
    const key = (r: Row) => { const w = bare(r.w), s = split(w[0])!; return level === 1 ? String(s.cho) : level === 2 ? String(s.jung * 28 + s.jong) : w.slice(1, 2); };
    const cand = shuffle(pool.filter(same), rand), out: Row[] = [], keys = new Set<string>(), words = new Set<string>();
    for (const r of cand) { const k = key(r), w = bare(r.w); if (keys.has(k) || words.has(w)) continue; keys.add(k); words.add(w); out.push(r); if (out.length === n) break; }
    if (out.length === n) return shuffle(out, rand);
  }
  return [];
}
export const isDictOrder = (picked: Row[]) => picked.every((r, i) => i === 0 || picked[i - 1].k < r.k);

// ── 비슷한말·반대말 짝 찾기 ──
export type Pair = [string, string, 's' | 'a'];
/** 한 판에 같은 종류(비슷한말 또는 반대말) n쌍. 한 낱말이 두 번 나오지 않게 한다. */
export function pickPairRound(pairs: Pair[], kind: 's' | 'a', n = 4, rand: Rand = Math.random): Pair[] {
  const out: Pair[] = [], used = new Set<string>(), mine = pairs.filter(p => p[2] === kind);
  // 판 안의 다른 낱말끼리도 짝이 되면(게임↔놀이, 게임↔시합) 정답이 둘이 되므로 그런 짝은 함께 내지 않는다.
  const link = new Set(mine.flatMap(p => [p[0] + '|' + p[1], p[1] + '|' + p[0]]));
  for (const p of shuffle([...mine], rand)) {
    if (used.has(p[0]) || used.has(p[1])) continue;
    if ([...used].some(u => link.has(u + '|' + p[0]) || link.has(u + '|' + p[1]))) continue;
    used.add(p[0]); used.add(p[1]); out.push(p);
    if (out.length === n) break;
  }
  return out;
}

// ── 높임말 바꾸기 [4국04-04] ──
/** s의 [ ] 안 낱말을 웃어른께 쓰는 말 h로 바꾼다. base: 사전에서 찾을 기본형. d: 그 자리에 넣으면 말이 안 되는 오답(정답이 둘이 되지 않게 사람이 고름). */
export const HONOR: {s: string; p: string; h: string; base: string; d: string}[] = [
  {s: '할아버지께 [밥]을 차려 드렸어요.', p: '밥', h: '진지', base: '진지', d: '말씀'},
  {s: '할머니, [나이]가 어떻게 되세요?', p: '나이', h: '연세', base: '연세', d: '진지'},
  {s: '선생님, [이름]이 어떻게 되세요?', p: '이름', h: '성함', base: '성함', d: '진지'},
  {s: '오늘은 할아버지 [생일]이에요.', p: '생일', h: '생신', base: '생신', d: '성함'},
  {s: '주말에 할머니 [집]에 놀러 갔어요.', p: '집', h: '댁', base: '댁', d: '진지'},
  {s: '선생님 [말]을 귀 기울여 들어요.', p: '말', h: '말씀', base: '말씀', d: '연세'},
  {s: '할아버지의 [병]이 다 나으셨어요.', p: '병', h: '병환', base: '병환', d: '성함'},
  {s: '저기 계신 [사람]이 우리 할머니예요.', p: '사람', h: '분', base: '분', d: '댁'},
  {s: '할머니께서 감기로 [아파요].', p: '아파요', h: '편찮으세요', base: '편찮다', d: '여쭈어요'},
  {s: '할아버지께서 방에서 [자요].', p: '자요', h: '주무세요', base: '주무시다', d: '드렸어요'},
  {s: '선생님께서 교실에 [있어요].', p: '있어요', h: '계세요', base: '계시다', d: '모시고'},
  {s: '할머니께서 떡을 [먹어요].', p: '먹어요', h: '잡수세요', base: '잡수시다', d: '여쭈어요'},
  {s: '할머니께 선물을 [줬어요].', p: '줬어요', h: '드렸어요', base: '드리다', d: '계셨어요'},
  {s: '선생님께 모르는 것을 [물어봤어요].', p: '물어봤어요', h: '여쭈어봤어요', base: '여쭈다', d: '주무셨어요'},
  {s: '할머니를 [데리고] 병원에 갔어요.', p: '데리고', h: '모시고', base: '모시다', d: '잡수시고'},
];
/** 높임말 문제 n개: 보기는 정답, 원래 낱말, 말이 안 되는 높임말 하나. */
export function pickHonorRound(n = 5, rand: Rand = Math.random) {
  return shuffle([...HONOR], rand).slice(0, n).map(q => ({...q, options: shuffle([q.h, q.p, q.d], rand)}));
}
