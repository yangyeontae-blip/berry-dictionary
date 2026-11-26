// 초등학생용으로 사전 자료 거르기: public/data(index.json, e/*.json, pairs.json)를 다시 쓴다.
// 실행: node scripts/kid-filter.mjs [--dry]   (npm run data 가 원자료로 자료를 새로 만든 뒤에 이어서 돌린다)
// 1) 성·마약·술·담배·도박·폭력·자살·욕설·낮잡는 말은 낱말째 뺀다(뜻풀이에 그런 내용이 있어도 뺀다).
//    원자료의 '놀이에서 숨김'(x) 표시는 직장 낱말 등도 넓게 붙어 있어 빼는 기준으로 쓰지 않는다.
// 2) 초등 6학년 수준: 국립국어원 「국어 기초 어휘 선정 및 어휘 등급화 목록」(2023, 공공누리 제1유형)의
//    1~4등급(학령 전~초등 5·6학년) 낱말만 남긴다(scripts/nikl-grade.json, build-grade.py로 만든다).
//    속담·관용구는 등급 목록에 없어 한국어기초사전 초급·중급인 것만 남긴다. 교과서 낱말(src/textbook.ts)은 등급과 상관없이 남긴다.
//    남긴 낱말에는 등급(g)을 index에 붙여 낱말 카드에 '초3~4 낱말'처럼 보여 준다.
// 3) 남은 낱말의 예문·관련어에 뺀 낱말이 나오면 그 예문·관련어만 뺀다.
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const DIR = 'public/data';
const idx = JSON.parse(fs.readFileSync(`${DIR}/index.json`, 'utf8'));
const entries = [];
for (let c = 0; c * idx.chunk < idx.words.length; c++) entries.push(...JSON.parse(fs.readFileSync(`${DIR}/e/${c}.json`, 'utf8')));
if (entries.length !== idx.words.length) throw Error('index와 뜻 조각 수가 달라요');
const bare = w => w.replace(/^-+|-+$/g, '');
const GRADE = JSON.parse(fs.readFileSync('scripts/nikl-grade.json', 'utf8'));
const gradeOf = w => GRADE[bare(w)] ?? GRADE[bare(w).replace(/\s+/g, '')] ?? 0;
const MAX_GRADE = 4; // 4등급 = 초등 5·6학년

// 낱말째 막는 목록: 뜻이 하나뿐인 어른 낱말만 적는다.
// 뜻이 여럿인 모양(정부·고문·사정·년·술·질·첩·기생·시가…)은 여기 적지 않고, 아래 DEF_BAD로 어른 뜻만 뺀다.
const BLOCK_WORDS = `창녀 창부 매춘 매춘부 매음 매음녀 성매매 성교 성행위 섹스 섹시 강간 윤간 성폭행 성폭력 성추행 성희롱 음란 음탕 음행 외설 포르노 야동 야설 에로 자위행위 수음 음경 음낭 음부 정액 콘돔 피임약 낙태 불륜 간통 오입 오입쟁이 화냥년 갈보 홍등가 유흥가 유곽 오르가슴 스트립쇼
마약 마약쟁이 마약범 대마초 마리화나 필로폰 히로뽕 코카인 헤로인 아편 아편쟁이 모르핀 각성제 환각제 약쟁이
술집 술꾼 술주정 술주정뱅이 주정뱅이 술잔 소주 맥주 양주 막걸리 위스키 보드카 칵테일 음주 과음 폭음 숙취 만취 주점 담배 담뱃불 담뱃재 흡연 흡연자 꽁초 니코틴 궐련
도박 노름 노름꾼 노름빚 도박꾼 도박장 카지노 투전 화투 고스톱
자살 자결 투신 살인 살인자 살해 살인범 학살 참살 교수형 칼부림 총살 독살 암살
포주 애무 나체 누드 반라 성감대 근친상간 육욕 정욕 숫처녀 숫총각 처녀성 섹시하다 작은마누라 독살 대취하다 만취하다 만취되다 곤드레만드레
새끼 개새끼 씨발 병신 미친놈 미친년 쌍놈 잡놈 계집 계집애 빌어먹을 젠장 제기랄 염병 지랄 개수작 개자식 후레자식 쌍년 육시랄`.split(/\s+/).filter(Boolean);
const BLOCK = new Set(BLOCK_WORDS);
// 뜻풀이(뜻 하나하나)에 이런 말이 있으면 그 뜻을 뺀다. 모든 뜻이 빠지면 낱말째 뺀다.
// (?<![가-힣])로 낱말 앞에서만 맞춘다 — '처음부터'의 '음부', '정액제'의 '정액' 같은 오검출을 막는다.
const B = '(?<![가-힣])';
const DEF_BAD = new RegExp([
  '성교(?!육)', '성행위', '창녀', '포주', '애무', '성적인 (?:행위|관계|욕구|쾌감)', `${B}성욕`, '매춘', '매음', '성매매', '음란', '외설', '생식기', `${B}성기(?![가-힣]*다)`, `${B}음부${B}`, `${B}정액(?!제)`, '포르노',
  `${B}마약`, '환각', '필로폰', `${B}아편`, `${B}대마(?:초| 잎|의 잎)`, `${B}도박`, `${B}노름`, `${B}자살`, '강간', '성폭행', '성추행', `${B}살해`, `${B}살인`,
  '취하게 (?:하는|만드는) (?:음료|성분)', '알코올 성분', `${B}술을 (?:마시|파는|팔|먹)`, `${B}술에 취`, `${B}담배를 (?:피|파는)`, '니코틴',
  '성적 (?:관계|쾌감|욕구|욕망|본능|순결|수치심|매력)', '정식 아내 외에', '술자리에서 손님', '유흥 주점', `${B}술(?:에| 등에)? ?(?:몹시 |심하게 |흠뻑 )?취하`, `${B}술이나 (?:잠|약)(?:에| 등의 기운으로)`, '술 중독', '술을 오랫동안', '독을 탄 술', '독약이 든 술', '목을 매어 죽이', '유혹에 흠뻑 취', '벌거벗은 모습',
  '욕으로 이르는', '욕하여 이르는', '낮잡아 이르는', '속되게 이르는', '비속하게', '비하하여',
].join('|'));
// 예문에 이런 낱말이 있으면 그 예문만 뺀다(낱말 앞에서만 맞춘다: 기술·수술·미술의 '술'은 괜찮다)
const EX_BAD = new RegExp(`${B}(?:술(?:을|이|에|집|잔|자리|기운|김|꾼|주정|에 취)|담배|소주|맥주|마약|도박|자살|살인|살해|섹스|음란|창녀|매춘|성폭|강간|만취|포르노|성교(?!육)|애무|성적 (?:표현|관계|호기심)|취해서 비틀|술에)`);

// 교과서 낱말: 등급과 상관없이 남긴다
const tb = fs.readFileSync('src/textbook.ts', 'utf8');
const KEEP = new Set([...tb.matchAll(/'([가-힣 ]+)'\.split\(' '\)/g)].flatMap(m => m[1].split(' ')).concat(['배', '손', '갈무리하다', '솜이불', '담요', '위안부', '후궁', '벌거벗다', '벌거숭이']));

// 뜻이 여럿이면 어른 내용인 뜻만 빼고, 모든 뜻이 어른 내용일 때만 낱말째 뺀다(고추·태우다·화상은 남는다).
const goodSenses = e => e.s.filter(s => !DEF_BAD.test(s.d));
const isBad = e => BLOCK.has(bare(e.w)) || goodSenses(e).length === 0;
const isKidLevel = e => {
  if (KEEP.has(bare(e.w))) return true;
  const g = gradeOf(e.w);
  if (g >= 1 && g <= MAX_GRADE) return true;
  if ((e.u === '속담' || e.u === '관용구') && (e.lv === 1 || e.lv === 2)) return true; // 5~6학년 국어에서 속담·관용 표현을 배운다
  return false;
};

const keep = [], dropBad = [], dropLevel = [];
entries.forEach((e, k) => {
  if (isBad(e) && !KEEP.has(bare(e.w))) dropBad.push(e.w);
  else if (!isKidLevel(e)) dropLevel.push(e.w);
  else keep.push(k);
});
const keptWords = new Set(keep.map(k => bare(entries[k].w)));
const REL = ['s', 'a', 'h', 'l', 'b', 'm', 'j', 'o', 'r', 'f', 'w'];
const cleanSense = s => {
  const out = {...s};
  for (const key of ['x', 't']) if (out[key]) { out[key] = out[key].filter(x => !EX_BAD.test(x)); if (!out[key].length) delete out[key]; }
  for (const key of REL) if (out[key]) { out[key] = out[key].filter(w => keptWords.has(bare(w)) && !BLOCK.has(bare(w))); if (!out[key].length) delete out[key]; }
  return out;
};

console.log(`처음 ${entries.length} → 남김 ${keep.length} (부적절 ${dropBad.length}, 초등 수준 밖 ${dropLevel.length})`);
console.log('부적절로 뺀 예:', dropBad.filter((_, i) => i % 40 === 0).slice(0, 40).join(' '));
console.log('수준 밖으로 뺀 예:', dropLevel.filter((_, i) => i % 700 === 0).slice(0, 40).join(' '));
for (const w of ['창녀', '마약', '섹스', '포르노', '음경', '담배', '고래', '고드름', '땅거미', '갈무리', '솜이불', '하교', '사과', '다정하다', '고추', '태우다', '화상', '은상', '전교생', '동료', '질', '내내', '시종일관', '정부', '고문', '사정', '년', '술', '기술', '미술', '전자', '첩', '기생']) console.log(w, keptWords.has(w) ? '남음' : '빠짐');
if (DRY) process.exit(0);

// 다시 쓰기: 새 위치(k)로 index와 500낱말 조각을 만든다
// i(한국어기초사전 번호)는 원래 값을 그대로 둔다(번역 자료를 붙일 때 쓴다).
// [낱말, 번호, 품사, 기초사전 등급, 놀이 숨김(x), 국어 기초 어휘 등급(g)]
const words = keep.map(k => { const r = idx.words[k]; return [r[0], r[1], r[2], r[3], r[4] ?? 0, gradeOf(r[0])]; });
const newEntries = keep.map(k => { const g = goodSenses(entries[k]); return {...entries[k], s: (g.length ? g : entries[k].s).map(cleanSense)}; }); // 교과서 낱말(KEEP)은 뜻이 다 걸려도 원래 뜻을 둔다
fs.rmSync(`${DIR}/e`, {recursive: true, force: true}); fs.mkdirSync(`${DIR}/e`);
for (let c = 0; c * idx.chunk < newEntries.length; c++) fs.writeFileSync(`${DIR}/e/${c}.json`, JSON.stringify(newEntries.slice(c * idx.chunk, (c + 1) * idx.chunk)));
fs.writeFileSync(`${DIR}/index.json`, JSON.stringify({...idx, count: words.length, words, filter: 'kid-filter: 국어 기초 어휘 1~4등급(초6까지)·부적절 낱말 제외'}));
const pairsPath = `${DIR}/pairs.json`;
if (fs.existsSync(pairsPath)) {
  const pairs = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
  const ok = pairs.filter(p => keptWords.has(bare(p[0])) && keptWords.has(bare(p[1])) && !BLOCK.has(bare(p[0])) && !BLOCK.has(bare(p[1])));
  fs.writeFileSync(pairsPath, JSON.stringify(ok));
  console.log(`짝 낱말 ${pairs.length} → ${ok.length}`);
}
console.log('다 썼어요.');
