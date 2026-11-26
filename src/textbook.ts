// 국어 3-2 나 「5. 사전으로 여는 세상」(국어 216~253쪽, 국어활동 72~83쪽, 13차시)과 앱 기능 잇기.
// 교과서 문장은 옮기지 않는다. 차시 이름·쪽수와 교과서에 나온 낱말 목록만 담는다(출처: 3학년 2학기 국어 진도표, 교과서 전자책).
// 성취기준: [4국04-02] 단어를 분류하고 국어사전을 활용하여 능동적인 국어 활동을 한다.
//          [4국04-01] 단어와 단어 간의 의미 관계를 파악한다.  [4국04-04] 높임 표현 등을 이해하고 상황에 맞게 표현한다.

export type Go = {to: string; label: string; icon: string};
export type Lesson = {id: string; no: string; title: string; book: string; act?: string; goal: string; code: string; go: Go[]; words?: string[]};

/** 교과서 붙임 11 '사전에 싣는 순서' — 앱의 hangul.ts CHO·JUNG·JONG 차례와 같아야 한다(tests/textbook.test.ts). */
export const ORDER_CHART = {
  cho: 'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ'.split(' '),
  jung: 'ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ'.split(' '),
  jong: 'ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㄷ ㄹ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅁ ㅂ ㅄ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ'.split(' '),
};

/** 2차시·5~6차시: 교과서에 나온 낱말을 세 바구니로(품사가 둘이거나 헷갈리는 낱말 — 밝다·차다·소 — 은 뺐다). */
export const TEXTBOOK_SORT = {
  name: '전구 운동장 축구공 친구 교실 의자 자전거 학교 칠판 날개 발톱 깃털 젓가락 반찬'.split(' '),
  move: '켜다 뛰다 마시다 앉다 돌아가다 먹다 던지다 울다 날다 펼치다 잡다 달리다'.split(' '),
  look: '맛있다 길다 빠르다 멋있다 착하다 뜨겁다 즐겁다 무섭다 가볍다 날카롭다 둥글다'.split(' '),
};

/** 차시별로 사전에서 찾아볼 교과서 낱말(찾기 놀이 목록으로 바로 쓴다). */
const W = {
  meet: '낱말 사전 뜻 자음 모음 받침'.split(' '),
  kinds: [...TEXTBOOK_SORT.name.slice(0, 4), ...TEXTBOOK_SORT.move.slice(0, 4), ...TEXTBOOK_SORT.look.slice(0, 4)],
  base: '보다 높다 먹다 막다 낮다 잡다 매다 짧다'.split(' '),
  feel: '기쁨 슬픔 사랑 분노 두려움 설레다 괴롭다 흐르다'.split(' '),
  find: '가방 하루 친구 너비 시루 고요 겨레 구기 한과 학문 하교 한파'.split(' '),
  read: '당일 우천 보건 사흘 깃들다 미지 표면 탐험 해저 해류 수온 윤곽'.split(' '),
  season: '땅거미 겨우살이 불볕더위 소나기 한가위 우듬지 옹이 밑동 소스라치다'.split(' '),
  wrap: '갈무리 솜이불 담요 눈요기'.split(' '),
};

const I = {search: 'ic-magnify.png', hunt: 'ic-hunt.png', read: 'ic-read.png', play: 'ic-play.png', note: 'ic-notebook.png', sort: 'ic-basket.png', order: 'ic-order.png', book: 'ic-book.png', pair: 'ic-pair.png', honor: 'ic-honor.png'};

export const UNIT5: Lesson[] = [
  {id: '1', no: '1', title: '배울 내용 살펴보기', book: '국어 216~219쪽', goal: '단서를 듣고 낱말 알아맞히기로 단원을 열어요.', code: '[4국04-02]',
    go: [{to: 'play/clue', label: '세 가지 단서 낱말 맞히기', icon: I.play}], words: W.meet},
  {id: '2', no: '2', title: '낱말의 종류 알기', book: '국어 220~225쪽 · 국어활동 72~73쪽', goal: '이름, 움직임, 성질이나 상태를 나타내는 낱말을 알아요.', code: '[4국04-02]',
    go: [{to: 'play/sort-tb', label: '교과서 낱말 바구니', icon: I.sort}, {to: 'play/sort', label: '새 낱말로 한 판 더', icon: I.sort}], words: W.kinds},
  {id: '3', no: '3~4', title: '형태가 바뀌는 낱말 알기', book: '국어 226~229쪽 · 국어활동 72~73쪽', goal: '바뀌지 않는 부분에 ‘-다’를 붙여 기본형을 찾아요.', code: '[4국04-02]',
    go: [{to: 'try-base', label: '기본형 도우미(먹었어요 → 먹다)', icon: I.search}, {to: 'hunt', label: '찾기 놀이(바뀐 모양 섞임)', icon: I.hunt}], words: W.base},
  {id: '5', no: '5~6', title: '기준에 따라 낱말 분류하기', book: '국어 230~237쪽 · 국어활동 72~73쪽', act: '「낱말을 먹는 아이」', goal: '내가 기준을 정해 낱말을 나누어 봐요.', code: '[4국04-02]',
    go: [{to: 'play/sort-my', label: '내 기준으로 나누기', icon: I.sort}, {to: 'play/sort-tb', label: '교과서 낱말 바구니', icon: I.sort}], words: W.feel},
  {id: '7', no: '7~8', title: '국어사전에서 낱말을 찾는 방법 알기', book: '국어 238~241쪽 · 국어활동 74~75쪽', goal: '첫 자음자 → 모음자 → 받침 차례로 낱말을 찾아요.', code: '[4국04-02]',
    go: [{to: 'chart', label: '사전 싣는 순서(붙임 11)', icon: I.order}, {to: 'play/order', label: '사전 차례 줄 세우기', icon: I.order}, {to: 'hunt', label: '사전 찾기 놀이', icon: I.hunt}], words: W.find},
  {id: '9', no: '9~10', title: '국어사전을 활용하며 글 읽기', book: '국어 242~247쪽 · 국어활동 74~75쪽', goal: '뜻을 먼저 짐작하고, 사전으로 확인하며 글을 읽어요.', code: '[4국04-02]',
    go: [{to: 'stories', label: '베리숲 읽기 글 고르기', icon: I.read}, {to: 'read', label: '선생님이 준 글 읽기', icon: I.read}], words: W.read},
  {id: '11', no: '11~12', title: '배운 내용 실천하기', book: '국어 248~250쪽 · 국어활동 76~83쪽', act: '세 가지 단서로 낱말 놀이 · 나만의 국어사전', goal: '단서 문제를 내고, 찾은 낱말로 나만의 국어사전을 만들어요.', code: '[4국04-02] [4국04-01]',
    go: [{to: 'play/clue-make', label: '단서 문제 내기', icon: I.play}, {to: 'mydict', label: '나만의 국어사전 만들기', icon: I.note}, {to: 'play/pair-a', label: '반대말 짝 찾기', icon: I.pair}], words: W.season},
  {id: '13', no: '13', title: '배운 내용 마무리하기', book: '국어 251~253쪽', goal: '사전에서 얻는 정보, 같은 모양의 낱말, 소리 나는 대로 읽기를 정리해요.', code: '[4국04-02]',
    go: [{to: 'play/wrap', label: '마무리 도전', icon: I.book}, {to: 'play/honor', label: '높임말 바꾸기(4단원 복습)', icon: I.honor}], words: W.wrap},
];
export const lessonOf = (id: string) => UNIT5.find(l => l.id === id) ?? UNIT5[0];

/** 9~10차시 읽기 글: 베리숲에서 새로 쓴 글(교과서 글이 아님). 사전에서 찾아볼 만한 낱말을 조금씩 넣었다. */
export const STORIES = [
  {t: '바닷속 미지의 세계', x: '우리가 사는 땅의 대부분은 바다로 덮여 있어요. 그런데 해저 깊은 곳은 아직 사람이 가 보지 못한 미지의 세계예요. 깊은 바다는 수온이 아주 낮고, 햇빛이 닿지 않아 캄캄해요. 과학자들은 잠수정을 타고 탐험을 떠나요. 잠수정의 불빛에 낯선 물고기의 윤곽이 희미하게 보였어요. 해류를 따라 천천히 움직이는 그 물고기는 몸에서 스스로 빛을 냈어요.'},
  {t: '할머니의 장독대', x: '할머니 댁 마당 한쪽에는 장독대가 있어요. 크고 작은 항아리에는 된장과 간장이 담겨 있지요. 할머니께서는 볕이 좋은 날이면 항아리 뚜껑을 열어 두세요. 장이 맛있게 익으려면 햇볕과 바람이 꼭 필요하대요. 가을이 깊어지면 할머니께서는 겨울을 날 채소를 갈무리하세요. 나는 할머니 곁에서 무를 나르며 일손을 보태었어요.'},
  {t: '겨울잠 자는 동물', x: '날씨가 추워지면 어떤 동물들은 겨울잠을 자요. 다람쥐는 가을 내내 도토리를 모아 굴속에 저장해요. 개구리는 땅속 깊이 들어가 몸을 웅크리고 봄을 기다려요. 겨울잠을 자는 동안에는 숨을 쉬는 횟수가 줄고 몸이 차가워져요. 사흘이 지나도 한 번도 깨지 않을 때가 있대요. 따뜻한 봄바람이 불면 동물들은 하나둘 굴 밖으로 나와요.'},
];

/** 13차시 마무리 도전: 사전에서 얻는 정보, 동형이의어·다의어, 소리 나는 대로 읽기([4국04-02] 성취기준 해설). */
export const WRAP_QUIZ: {q: string; options: string[]; a: number; why: string; word?: string}[] = [
  {q: '국어사전에서 알 수 <b>없는</b> 것은 무엇일까요?', options: ['낱말의 뜻', '낱말을 읽는 소리(발음)', '낱말을 처음 만든 사람'], a: 2, why: '국어사전에는 낱말의 뜻, 종류, 발음, 쓰는 예(예문)가 실려 있어요.'},
  {q: '‘배’를 찾았더니 <b>배¹, 배², 배³</b>가 따로 있어요. 작은 숫자는 무엇을 알려 줄까요?', options: ['모양은 같지만 뜻이 서로 다른 낱말이에요', '한 낱말에 뜻이 여러 개예요', '배를 세는 숫자예요'], a: 0, why: '먹는 배, 몸의 배, 타는 배처럼 모양만 같고 서로 다른 낱말이라 번호를 붙여 따로 실어요.', word: '배'},
  {q: '‘손’ 한 낱말 안에 <b>뜻 ①, 뜻 ②</b>가 있어요. 무슨 뜻일까요?', options: ['서로 다른 낱말이 둘 있어요', '한 낱말이 여러 뜻으로 쓰여요', '손이 두 개라는 뜻이에요'], a: 1, why: '한 낱말이 비슷하게 이어진 여러 뜻으로 쓰이면, 한 표제어 안에 뜻 ①, ②로 나누어 실어요.', word: '손'},
  {q: '‘솜이불’은 어떻게 소리 내어 읽을까요?', options: ['[소미불]', '[솜니불]', '[솜이불]'], a: 1, why: '앞말에 받침이 있고 뒷말이 ‘이’로 시작하면 ‘ㄴ’ 소리가 덧나요. 사전의 [ ] 발음을 보면 알 수 있어요.', word: '솜이불'},
  {q: '‘담요’는 어떻게 소리 내어 읽을까요?', options: ['[담뇨]', '[다묘]', '[담요]'], a: 0, why: '‘담’ 다음에 ‘요’가 오면서 ‘ㄴ’ 소리가 덧나 [담뇨]로 읽어요.', word: '담요'},
  {q: '‘갈무리했다’를 사전에서 찾으려면 어떤 모양으로 찾을까요?', options: ['갈무리했다', '갈무리하다', '갈무리'], a: 1, why: '모양이 바뀌는 낱말은 바뀌지 않는 부분 ‘갈무리하-’에 ‘-다’를 붙인 기본형으로 찾아요.', word: '갈무리하다'},
  {q: '국어사전에 <b>먼저</b> 나오는 낱말은?', options: ['하교', '학문'], a: 0, why: '첫 글자 ‘하’와 ‘학’은 첫 자음·모음이 같아요. 받침이 없는 ‘하’가 받침 있는 ‘학’보다 먼저 나와요.'},
  {q: '국어사전에 <b>먼저</b> 나오는 낱말은?', options: ['겨레', '고요'], a: 0, why: '첫 자음 ‘ㄱ’은 같아요. 모음 차례는 ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ … ㅗ 이므로 ‘ㅕ’가 ‘ㅗ’보다 먼저예요.'},
];

// ── 세 가지 단서 낱말 맞히기(1차시·11~12차시) ──
type Rand = () => number;
/** 뜻풀이에서 답 낱말(과 '-하다' 앞부분)을 ○로 가린다. */
export function maskDef(def: string, word: string) {
  const stems = [word, word.replace(/다$/, '')].filter(s => s.length >= 1).sort((a, b) => b.length - a.length);
  let out = def;
  for (const s of stems) if (s.length >= 2 || s === word) out = out.split(s).join('○'.repeat(s.length));
  return out;
}
/** 단서 3개: ① 뜻(답 가림) ② 낱말 종류 ③ 첫 자음과 글자 수. 보기는 같은 종류 낱말 4개. */
export function clueOf(word: string, kind: string, def: string, cho: string, others: string[], rand: Rand = Math.random) {
  const options = [word, ...others.filter(o => o !== word).slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return {word, clues: [`뜻: ${maskDef(def, word)}`, `낱말 종류: ${kind}`, `첫 자음은 ‘${cho}’, ${word.length}글자예요.`], options};
}
