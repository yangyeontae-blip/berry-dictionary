// 베리의 숲 국어사전 Cloudflare Worker: 화면 파일은 그대로 내주고, /api/stdict 만 표준국어대사전 오픈 API로 이어 준다.
// API 키(STDICT_KEY)는 Cloudflare 비밀 값으로만 두고 브라우저에는 보내지 않는다. 키가 없으면 {off:true}.
interface Env { ASSETS: {fetch: (r: Request) => Promise<Response>}; STDICT_KEY?: string }
const CORS = {'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8'};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), {status, headers: {...CORS, ...extra}});

export default {
  async fetch(req: Request, env: Env, ctx: {waitUntil: (p: Promise<unknown>) => void}): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/api/stdict') return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, {headers: {...CORS, 'access-control-allow-methods': 'GET'}});
    if (url.searchParams.has('status')) return json({on: !!env.STDICT_KEY}, 200, {'cache-control': 'public, max-age=600'});
    if (!env.STDICT_KEY) return json({off: true});
    const q = (url.searchParams.get('q') ?? '').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '').trim().slice(0, 20);
    if (!q) return json({items: []});
    const cache = (caches as unknown as {default: Cache}).default, key = new Request('https://cache.berry-dictionary/stdict?q=' + encodeURIComponent(q));
    const hit = await cache.match(key); if (hit) return hit;
    const api = `https://stdict.korean.go.kr/api/search.do?key=${encodeURIComponent(env.STDICT_KEY)}&q=${encodeURIComponent(q)}&req_type=json&num=10`;
    try {
      const r = await fetch(api, {headers: {'user-agent': 'berry-dictionary'}});
      const text = await r.text();
      const body = text.trim() ? JSON.parse(text) : {};
      const raw = body?.channel?.item ?? [];
      const items = (Array.isArray(raw) ? raw : [raw]).flatMap((it: {word?: string; sup_no?: string; pos?: string; sense?: {definition?: string} | {definition?: string}[]}) =>
        (Array.isArray(it.sense) ? it.sense : [it.sense]).filter(Boolean).map(s => ({w: String(it.word ?? '').replace(/[-^]/g, ''), n: Number(it.sup_no) || 0, p: String(it.pos ?? ''), d: String(s!.definition ?? '').replace(/<[^>]+>/g, '')})))
        .filter((x: {d: string}) => x.d).slice(0, 8);
      const res = json({items}, 200, {'cache-control': 'public, max-age=86400'});
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    } catch {
      return json({error: 'upstream'}, 502);
    }
  },
};
