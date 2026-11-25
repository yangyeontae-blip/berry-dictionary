// 사전 자료 읽기: 가벼운 목록(index.json)을 먼저 받고, 뜻은 500낱말 조각(e/<n>.json)을 필요할 때 받는다.
import {bare, initials, isInitialQuery, baseFormHints} from './hangul';

export type Sense = {d: string; x?: string[]; t?: string[]; s?: string[]; a?: string[]; h?: string[]; l?: string[]; b?: string[]; m?: string[]; j?: string[]; o?: string[]; r?: string[]; f?: string[]; w?: string[]};
export type Entry = {i: number; w: string; n: number; p: string; u: string; lv: number; s: Sense[]; o?: string; pr?: string; c?: string; a?: string};
export type Row = {k: number; w: string; n: number; p: string; lv: number};
type Index = {chunk: number; count: number; pos: string[]; source: string; words: [string, number, number, number][]};

const BASE = (import.meta as {env?: {BASE_URL?: string}}).env?.BASE_URL ?? '/';

export class Dictionary {
  rows: Row[] = [];
  source = '';
  private chunk = 500;
  private byWord = new Map<string, number[]>();
  private initialsCache: string[] = [];
  private chunks = new Map<number, Promise<Entry[]>>();
  constructor(private fetcher: (path: string) => Promise<unknown> = p => fetch(BASE + p).then(r => { if (!r.ok) throw Error(p + ' ' + r.status); return r.json(); })) {}

  async load() {
    const idx = await this.fetcher('data/index.json') as Index;
    this.chunk = idx.chunk; this.source = idx.source;
    this.rows = idx.words.map(([w, n, p, lv], k) => ({k, w, n, p: idx.pos[p] ?? '', lv}));
    for (const r of this.rows) { const key = bare(r.w); const list = this.byWord.get(key); if (list) list.push(r.k); else this.byWord.set(key, [r.k]); }
    return this;
  }
  has = (w: string) => this.byWord.has(w);
  /** 같은 모양 낱말(동음이의어) 모두 */
  same(w: string) { return (this.byWord.get(bare(w)) ?? []).map(k => this.rows[k]); }

  entry(k: number): Promise<Entry> {
    const c = Math.floor(k / this.chunk);
    let p = this.chunks.get(c);
    if (!p) { p = this.fetcher(`data/e/${c}.json`) as Promise<Entry[]>; this.chunks.set(c, p); p.catch(() => this.chunks.delete(c)); }
    return p.then(list => list[k % this.chunk]);
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
