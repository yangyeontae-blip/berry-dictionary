// 베리의 숲 국어사전 Cloudflare Worker: 화면 파일은 그대로 내주고, /api/stdict 만 표준국어대사전으로 이어 준다.
// 표준국어대사전 키는 berry-dict Worker에 비밀 값으로 들어 있다. 이 Worker는 서비스 바인딩(DICT)으로
// berry-dict의 /api/search 를 불러 쓴다(키를 두 곳에 넣지 않으려고). 브라우저에는 키가 가지 않는다.
// 이 Worker에 STDICT_KEY를 직접 넣으면 그 키로 직접 부른다.
interface Env {
  ASSETS: {fetch: (r: Request) => Promise<Response>};
  DICT?: {fetch: (r: Request | string) => Promise<Response>};
  STDICT_KEY?: string;
}
type Item = {w: string; n: number; p: string; d: string; i?: string}; // i: 표준국어대사전 낱말 번호(자세히 보기용)
const CORS = {'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8'};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), {status, headers: {...CORS, ...extra}});

// 직접 부르기: 2026년 API 주소가 kdict.korean.go.kr/standard/api 로 바뀜.
// 키 끝에 보이지 않는 줄바꿈 문자가 붙으면 오류 없이 빈 응답이 오므로 trim.
async function direct(key: string, q: string): Promise<Item[]> {
  const api = `https://kdict.korean.go.kr/standard/api/search.do?key=${encodeURIComponent(key.trim())}&q=${encodeURIComponent(q)}&req_type=json&num=10`;
  const text = await (await fetch(api, {headers: {'user-agent': 'berry-dictionary'}})).text();
  const body = text.trim() ? JSON.parse(text) : {};
  const raw = body?.channel?.item ?? [];
  return (Array.isArray(raw) ? raw : [raw]).flatMap((it: {word?: string; sup_no?: string; pos?: string; target_code?: string; sense?: {definition?: string} | {definition?: string}[]}) =>
    (Array.isArray(it.sense) ? it.sense : [it.sense]).filter(Boolean).map(s => ({w: String(it.word ?? '').replace(/[-^]/g, ''), n: Number(it.sup_no) || 0, p: String(it.pos ?? ''), d: String(s!.definition ?? '').replace(/<[^>]+>/g, ''), i: String(it.target_code ?? '')})));
}

// berry-dict 거쳐 부르기: {items:[{word, supNo, pos, senses[]}]} → 화면이 쓰는 {w,n,p,d}
async function viaDict(dict: NonNullable<Env['DICT']>, q: string): Promise<Item[]> {
  const r = await dict.fetch(`https://berry-dict/api/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('dict ' + r.status);
  const body = await r.json() as {items?: {id: string; word: string; supNo: number; pos: string; senses: string[]}[]};
  return (body.items ?? []).flatMap(it => it.senses.map(d => ({w: it.word, n: it.supNo, p: it.pos, d, i: it.id})));
}

export default {
  async fetch(req: Request, env: Env, ctx: {waitUntil: (p: Promise<unknown>) => void}): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/api/stdict') return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, {headers: {...CORS, 'access-control-allow-methods': 'GET'}});
    const on = !!env.STDICT_KEY?.trim() || !!env.DICT;
    if (url.searchParams.has('status')) return json({on}, 200, {'cache-control': 'public, max-age=600'});
    if (!on) return json({off: true});
    // 자세히 보기(발음·예문·관련어): berry-dict의 /api/word 를 그대로 넘긴다
    const id = url.searchParams.get('id');
    if (id !== null) {
      if (!/^\d{1,10}$/.test(id) || !env.DICT) return json({error: 'bad id'}, 400);
      const r = await env.DICT.fetch(`https://berry-dict/api/word?id=${id}`);
      return json(await r.json(), r.status, r.ok ? {'cache-control': 'public, max-age=86400'} : {});
    }
    const q = (url.searchParams.get('q') ?? '').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '').trim().slice(0, 20);
    if (!q) return json({items: []});
    const cache = (caches as unknown as {default: Cache}).default, key = new Request('https://cache.berry-dictionary/stdict?q=' + encodeURIComponent(q));
    const hit = await cache.match(key); if (hit) return hit;
    try {
      const all = env.STDICT_KEY?.trim() ? await direct(env.STDICT_KEY, q) : await viaDict(env.DICT!, q);
      const items = all.filter(x => x.d).slice(0, 8);
      const res = json({items}, 200, items.length ? {'cache-control': 'public, max-age=86400'} : {});
      if (items.length) ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    } catch {
      return json({error: 'upstream'}, 502);
    }
  },
};
