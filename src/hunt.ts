// 사전 찾기 놀이 문제 고르기.
import type {Entry, Row} from './dict';
import {bare} from './hangul';

export type HuntTarget = {row: Row; given?: string};

/** 서로 다른 첫 자음이 고루 나오도록 n개 고른다. */
export function pickHuntTargets(pool: Row[], n: number, rand: () => number): HuntTarget[] {
  const out: HuntTarget[] = [], usedFirst = new Set<string>(), usedWord = new Set<string>();
  for (let tries = 0; out.length < n && tries < n * 60 && pool.length; tries++) {
    const r = pool[Math.floor(rand() * pool.length)];
    const w = bare(r.w);
    if (usedWord.has(w) || (usedFirst.has(w[0]) && tries < n * 30)) continue;
    usedWord.add(w); usedFirst.add(w[0]); out.push({row: r});
  }
  return out;
}

/**
 * 움직임·성질을 나타내는 말의 예문에서 모양이 바뀐 꼴(다정한, 먹었다 …)을 찾는다.
 * 줄기(‘다’ 앞)로 시작하지만 기본형과 다른 어절만 고른다. 불규칙 활용처럼 줄기가 바뀌면 고르지 않는다.
 */
export function findChangedForm(e: Entry): {form: string; sentence: string} | null {
  const word = bare(e.w);
  if (!word.endsWith('다') || word.length < 2) return null;
  const stem = word.slice(0, -1);
  for (const s of e.s) for (const x of s.x ?? []) {
    for (const raw of x.split(/\s+/)) {
      const tok = raw.replace(/[.,!?"'“”‘’…·()]/g, '');
      if (tok.startsWith(stem) && tok !== word && tok.length > stem.length && tok.length <= stem.length + 4 && /^[가-힣]+$/.test(tok)) return {form: tok, sentence: x};
    }
  }
  return null;
}
