// 아이 기록은 이 기기(브라우저)에만 저장한다. 서버로 보내지 않는다.
const KEY = 'berry-dictionary-v1';
/** my: 내가 지은 문장, ctx·sense: 글 속에서 찾은 문장과 고른 뜻(낱말 공책). */
export type Saved = {w: string; n: number; k: number; at: number; my?: string; ctx?: string; sense?: string};
/** font: 글씨 크기(0 보통·1 크게·2 아주 크게), contrast: 고대비, lang: 내 나라 말 뜻(en·vi·ru·mn·ja·th·id·es·fr·ar, ''이면 끔). */
export type State = {pouch: Saved[]; stamps: number; found: string[]; sound: boolean; guesses: number; games: number; notes: number; best: number; font: number; contrast: boolean; lang: string};

const blank = (): State => ({pouch: [], stamps: 0, found: [], sound: true, guesses: 0, games: 0, notes: 0, best: 0, font: 0, contrast: false, lang: ''});

export function loadState(storage: Pick<Storage, 'getItem'> | null = safeStorage()): State {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw) as Partial<State>;
    return {...blank(), ...s, pouch: Array.isArray(s.pouch) ? s.pouch.slice(0, 500) : [], found: Array.isArray(s.found) ? s.found.slice(-300) : []};
  } catch { return blank(); }
}
export function saveState(s: State, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try { storage?.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 공간이 없어도 사전은 그대로 쓴다 */ }
}
function safeStorage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

export function inPouch(s: State, w: string, n: number) { return s.pouch.some(p => p.w === w && p.n === n); }
export function togglePouch(s: State, item: Saved) {
  const i = s.pouch.findIndex(p => p.w === item.w && p.n === item.n);
  if (i >= 0) { s.pouch.splice(i, 1); return false; }
  s.pouch.unshift(item); return true;
}
/** 찾기 놀이에서 처음 찾은 낱말이면 도장 하나. */
export function stampFound(s: State, w: string) {
  if (s.found.includes(w)) return false;
  s.found.push(w); s.stamps += 1; return true;
}

// ── 선생님 낱말 목록: 서버 저장 없이 주소(#list=...) 안에 낱말을 담는다 ──
export function encodeList(title: string, words: string[]) {
  const body = JSON.stringify({t: title.slice(0, 30), w: words.slice(0, 30).map(w => w.slice(0, 20))});
  const bytes = new TextEncoder().encode(body);
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeList(code: string): {title: string; words: string[]} | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const body = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    const words = (Array.isArray(body.w) ? body.w : []).filter((w: unknown) => typeof w === 'string' && w.trim()).map((w: string) => w.trim().slice(0, 20)).slice(0, 30);
    if (!words.length) return null;
    return {title: typeof body.t === 'string' ? body.t.slice(0, 30) : '선생님 낱말', words};
  } catch { return null; }
}

/** 날짜마다 같은 '오늘의 낱말'을 고르는 수(모든 아이가 같은 날 같은 낱말을 본다). */
export function daySeed(d = new Date()) { return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate(); }
