// 사전 자료 읽기: 가벼운 목록(index.json)을 먼저 받고, 뜻은 500낱말 조각(e/<n>.json)을 필요할 때 받는다.
import {bare, initials, isInitialQuery, baseFormHints} from './hangul';

export type Sense = {d: string; x?: string[]; t?: string[]; s?: string[]; a?: string[]; h?: string[]; l?: string[]; b?: string[]; m?: string[]; j?: string[]; o?: string[]; r?: string[]; f?: string[]; w?: string[]};
export type Entry = {i: number; w: string; n: number; p: string; u: string; lv: number; s: Sense[]; o?: string; pr?: string; c?: string; a?: string};
/** x: 1이면 아이 놀이(찾기 놀이·오늘의 낱말·놀이터)에서 빼는 낱말(술·담배 등). 검색은 된다. */
/** g: 국립국어원 국어 기초 어휘 등급(1=학령 전, 2=초1~2, 3=초3~4, 4=초5~6). 0이면 등급 목록에 없는 교과서 낱말. */
type Trans = ([string, string] | null)[] | 0;
export type Row = {k: number; w: string; n: number; p: string; lv: number; x: number; g: number};
type Index = {chunk: number; count: number; pos: string[]; source: string; words: [string, number, number, number, number?, number?][]};

const BASE = (import.meta as {env?: {BASE_URL?: string}}).env?.BASE_URL ?? '/';

export class Dictionary {
  rows: Row[] = [];
  source = '';
  private chunk = 500;
  private byWord = new Map<string, number[]>();
  private initialsCache: string[] = [];
  private chunks = new Map<number, Promise<Entry[]>>();
  private trans = new Map<string, Promise<Trans[]>>();
  constructor(private fetcher: (path: string) => Promise<unknown> = p => fetch(BASE + p).then(r => { if (!r.ok) throw Error(p + ' ' + r.status); return r.json(); })) {}

  async load() {
    const idx = await this.fetcher('data/index.json') as Index;
    this.chunk = idx.chunk; this.source = idx.source;
    this.rows = idx.words.map(([w, n, p, lv, x, g], k) => ({k, w, n, p: idx.pos[p] ?? '', lv, x: x ?? 0, g: g ?? 0}));
    for (const r of this.rows) { const key = bare(r.w); const list = this.byWord.get(key); if (list) list.push(r.k); else this.byWord.set(key, [r.k]); }
    return this;
  }
  /** 사전에 실린 낱말인가(‘놀라-’ 같은 붙임표 조각만 있으면 아니다 — 그래야 ‘놀라’ → ‘놀라다’로 안내한다). */
  has = (w: string) => (this.byWord.get(w) ?? []).some(k => !this.rows[k].w.includes('-'));
  /** 같은 모양 낱말(동음이의어) 모두 */
  same(w: string) { return (this.byWord.get(bare(w)) ?? []).map(k => this.rows[k]); }

  entry(k: number): Promise<Entry> {
    const c = Math.floor(k / this.chunk);
    let p = this.chunks.get(c);
    if (!p) { p = this.fetcher(`data/e/${c}.json`) as Promise<Entry[]>; this.chunks.set(c, p); p.catch(() => this.chunks.delete(c)); }
    return p.then(list => list[k % this.chunk]);
  }

  /** 내 나라 말 뜻(한국어기초사전 대역): 뜻 차례대로 [낱말, 짧은 풀이] 또는 null. 언어 조각은 고를 때만 받는다. */
  translation(k: number, lang: string): Promise<([string, string] | null)[]> {
    const c = Math.floor(k / this.chunk), key = lang + '/' + c;
    let p = this.trans.get(key);
    if (!p) { p = this.fetcher(`data/t/${lang}/${c}.json`) as Promise<Trans[]>; this.trans.set(key, p); p.catch(() => this.trans.delete(key)); }
    return p.then(list => list[k % this.chunk] || []);
  }

  /** 낱말 찾기: 똑같은 낱말 → 앞부분이 같은 낱말 → 초성 → 안에 든 낱말 차례. 3학년이 보기 좋게 쉬운 등급을 먼저. */
  search(query: string, limit = 60): Row[] {
    const q = query.trim().replace(/\s+/g, ' ');
    if (!q) return [];
    const easy = (r: Row) => (r.lv === 1 ? 0 : r.lv === 2 ? 1 : r.lv === 3 ? 2 : 3);
    const out: Row[] = [], seen = new Set<number>();
    const add = (r: Row) => { if (!seen.has(r.k) && out.length < limit) { seen.add(r.k); out.push(r); } };
    if (isInitialQuery(q)) {
      if (!this.initialsCache.length) this.initialsCache = this.rows.map(r => initials(bare(r.w)));
      const hits = this.rows.filter((_, k) => this.initialsCache[k].startsWith(q));
      hits.sort((a, b) => (this.initialsCache[a.k].length - this.initialsCache[b.k].length) || easy(a) - easy(b) || a.k - b.k);
      hits.forEach(add);
      return out;
    }
    this.same(q).forEach(add);
    const prefix = this.rows.filter(r => !seen.has(r.k) && bare(r.w).startsWith(q));
    prefix.sort((a, b) => easy(a) - easy(b) || bare(a.w).length - bare(b.w).length || a.k - b.k);
    prefix.forEach(add);
    if (out.length < limit && q.length >= 2) this.rows.filter(r => !seen.has(r.k) && bare(r.w).includes(q)).slice(0, limit).forEach(add);
    return out;
  }

  /** '먹었어요' → ['먹다'] 처럼 사전에 있는 기본형 후보 */
  baseForms(q: string) { return baseFormHints(q.trim(), this.has); }

  /** 사전 쪽 번호처럼 쓰는 위치: k 주변 낱말 몇 개(찾기 놀이 책장). */
  page(k: number, size = 12) {
    const start = Math.max(0, Math.min(this.rows.length - size, k - Math.floor(size / 2)));
    return this.rows.slice(start, start + size);
  }
  /** 첫 글자(완성 글자)로 시작하는 첫 낱말 위치 */
  firstIndexOf(prefix: string) {
    let lo = 0, hi = this.rows.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (bare(this.rows[mid].w) < prefix) lo = mid + 1; else hi = mid; }
    return lo;
  }
}

export const KIND: Record<string, {kid: string; color: string}> = {
  '명사': {kid: '이름을 나타내는 말', color: 'berry'},
  '대명사': {kid: '이름 대신 가리키는 말', color: 'berry'},
  '수사': {kid: '수를 나타내는 말', color: 'berry'},
  '동사': {kid: '움직임을 나타내는 말', color: 'leaf'},
  '형용사': {kid: '성질이나 모양을 나타내는 말', color: 'sky'},
  '부사': {kid: '꾸며 주는 말', color: 'honey'},
  '관형사': {kid: '꾸며 주는 말', color: 'honey'},
  '감탄사': {kid: '느낌을 나타내는 말', color: 'plum'},
  '조사': {kid: '낱말 뒤에 붙는 말', color: 'stone'},
  '어미': {kid: '낱말 끝에 붙는 말', color: 'stone'},
  '접사': {kid: '낱말 앞뒤에 붙는 말', color: 'stone'},
};
export const RELATION: [keyof Sense, string][] = [['s', '비슷한말'], ['a', '반대말'], ['h', '높임말'], ['l', '낮춤말'], ['j', '준말'], ['o', '본말'], ['b', '큰말'], ['m', '작은말'], ['f', '센말'], ['w', '여린말'], ['r', '함께 보기']];
export const LEVEL = ['', '쉬움', '보통', '어려움'];
/** 내 나라 말: 한국어기초사전 공개 자료에 있는 10개 언어(중국어는 자료에 없음). */
export const LANGS: [string, string][] = [['en', 'English'], ['vi', 'Tiếng Việt'], ['ru', 'Русский'], ['mn', 'Монгол'], ['ja', '日本語'], ['th', 'ไทย'], ['id', 'Bahasa Indonesia'], ['es', 'Español'], ['fr', 'Français'], ['ar', 'العربية']];
/** 국어 기초 어휘 등급 → 학년 이름 */
export const GRADE_NAME = ['', '학령 전', '초1~2', '초3~4', '초5~6', '교과서'];
