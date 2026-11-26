import './style.css';
import {Dictionary, KIND, RELATION, LEVEL, type Entry, type Row} from './dict';
import {BASIC_CHO, CHO, JUNG, JONG, split, join, bare, firstLetterSteps} from './hangul';
import {loadState, saveState, inPouch, togglePouch, stampFound, encodeList, decodeList, daySeed, type Saved} from './store';
import {pickHuntTargets, findChangedForm, type HuntTarget} from './hunt';
import qrcode from 'qrcode-generator';
import {BASKETS, basketOf, pickSortRound, pickOrderRound, pickPairRound, pickHonorRound, shuffle, type BasketKey, type Pair} from './games';
import {UNIT5, lessonOf, ORDER_CHART, TEXTBOOK_SORT, STORIES, WRAP_QUIZ, clueOf, type Lesson} from './textbook';

const ART = import.meta.env.BASE_URL + 'art/';
const app = document.getElementById('app')!;
const dict = new Dictionary();
const state = loadState();
const save = () => saveState(state);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const img = (name: string, cls = '', alt = '') => `<img class="${cls}" src="${ART}${name}" alt="${esc(alt)}" ${alt ? '' : 'aria-hidden="true"'} draggable="false" decoding="async">`;
const kindOf = (p: string) => KIND[p] ?? {kid: p || '낱말', color: 'stone'};

// ── 소리: 작은 '뽀롱' 효과음(기기에서 만든 소리, 끌 수 있음)과 읽어 주기 ──
let audio: AudioContext | null = null;
function chime(kind: 'ok' | 'no' | 'pop' = 'pop') {
  if (!state.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const t = audio.currentTime, notes = kind === 'ok' ? [784, 988, 1319] : kind === 'no' ? [330, 262] : [660];
    notes.forEach((f, i) => {
      const o = audio!.createOscillator(), g = audio!.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audio!.destination);
      const s = t + i * 0.09; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.18, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
      o.start(s); o.stop(s + 0.25);
    });
  } catch { /* 소리를 못 내는 기기 */ }
}
// 읽어 주기: 크롬은 cancel() 바로 뒤 speak()가 씹히는 버그가 있어 잠깐 쉬고 말한다. 목소리 목록은 늦게 오기도 해서 기다렸다 고른다.
let voices: SpeechSynthesisVoice[] = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch { /* 없음 */ } };
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.addEventListener?.('voiceschanged', loadVoices); }
function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return toast('이 기기는 읽어 주기를 지원하지 않아요.');
    const say = () => {
      loadVoices();
      const ko = voices.filter(v => v.lang?.toLowerCase().replace('_', '-').startsWith('ko'));
      if (voices.length && !ko.length) toast('이 기기에 한국어 목소리가 없어요. 설정 → 언어에서 한국어 음성을 추가해 주세요.');
      const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.85; u.volume = 1;
      const v = ko.find(v => /google|yuna|heami|sunhi|injoon/i.test(v.name)) ?? ko[0]; if (v) u.voice = v;
      u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') toast('읽어 주기를 할 수 없어요. 소리 크기를 확인해 주세요.'); };
      speechSynthesis.resume(); speechSynthesis.speak(u);
    };
    if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(say, 120); } else say();
  } catch { toast('읽어 주기를 할 수 없어요.'); }
}
function toast(msg: string, mood: 'ok' | 'no' | '' = '') {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  const face = mood === 'ok' || /맞았|잘 |담았|적었|복사|받았/.test(msg) ? 'bbo-cheer.png' : 'bbo-think.png';
  el.innerHTML = `${img(face, 'toast-bbo')}<span></span>`; el.querySelector('span')!.textContent = msg;
  document.body.append(el); setTimeout(() => el.classList.add('show'), 10); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2600);
}
function confetti() {
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 26; i++) { const s = document.createElement('i'); s.style.setProperty('--x', (Math.random() * 100) + 'vw'); s.style.setProperty('--d', (0.6 + Math.random() * 0.9) + 's'); s.style.setProperty('--r', (Math.random() * 360) + 'deg'); s.className = ['b', 'l', 'f'][i % 3]; box.append(s); }
  document.body.append(box); setTimeout(() => box.remove(), 1800);
}

// ── 틀: 간판 + 펼친 책 + 자음 책갈피 + 아래 메뉴 ──
type View = {left: string; right: string; tab?: string; mode: string; bubble?: string};
const LEFT_TABS = BASIC_CHO.slice(0, 7), RIGHT_TABS = BASIC_CHO.slice(7);
const TAB_COLORS = ['#f7a8b8', '#ffd98a', '#b9e08c', '#9fd3f0', '#c8b4f0', '#f7c0a0', '#a8e0cf'];
function tabs(list: readonly string[], side: string, active?: string, offset = 0) {
  return `<nav class="tabs tabs-${side}" aria-label="첫 자음으로 펼치기">${list.map((c, i) => `<button class="tab${c === active ? ' on' : ''}" style="--tab:${TAB_COLORS[(i + offset) % 7]}" data-cho="${c}" aria-label="${c}으로 시작하는 쪽 펼치기">${c}</button>`).join('')}</nav>`;
}
function frame(v: View) {
  const nav = [['', '찾기', 'ic-magnify.png'], ['unit5', '교과서 길', 'ic-book.png'], ['hunt', '찾기 놀이', 'ic-hunt.png'], ['read', '글 속 낱말', 'ic-read.png'], ['play', '놀이터', 'ic-play.png'], ['pouch', '낱말 공책', 'ic-notebook.png']];
  app.innerHTML = `
  <div class="scene" data-mode="${v.mode}">
    <header class="sign"><a href="#" class="sign-board" aria-label="첫 화면으로">${img('sign.png', 'sign-art')}<span class="sign-title">베리의 숲 국어사전</span></a>
      <button class="sound-toggle" aria-pressed="${state.sound}" aria-label="효과음 ${state.sound ? '끄기' : '켜기'}">${state.sound ? '🔔' : '🔕'}</button></header>
    <div class="chip-strip" aria-label="첫 자음으로 펼치기">${BASIC_CHO.map((c, i) => `<button class="tab${c === v.tab ? ' on' : ''}" style="--tab:${TAB_COLORS[i % 7]}" data-cho="${c}">${c}</button>`).join('')}</div>
    <main class="book">
      ${tabs(LEFT_TABS, 'left', v.tab)}
      <section class="page page-left">${v.left}</section>
      <section class="page page-right">${v.right}</section>
      ${tabs(RIGHT_TABS, 'right', v.tab, 7)}
    </main>
    <nav class="menu" aria-label="메뉴">${nav.map(([to, label, icon]) => `<a href="#${to}" class="menu-item${v.mode === (to || 'home') || (to === 'play' && v.mode.startsWith('play')) || (to === '' && ['word', 'browse', 'search'].includes(v.mode)) ? ' on' : ''}">${img(icon, 'menu-icon')}<span>${label}</span></a>`).join('')}</nav>
    <footer class="credit">낱말 자료: <a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전</a>(국립국어원, <a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a>) · 기록은 이 기기에만 저장돼요 · <a href="#teacher">선생님 메뉴</a>${installEvt ? ' · <button class="install">앱으로 설치</button>' : ''}</footer>
  </div>`;
  app.querySelectorAll<HTMLButtonElement>('[data-cho]').forEach(b => b.onclick = () => { chime(); location.hash = 'browse/' + b.dataset.cho; });
  app.querySelector<HTMLButtonElement>('.sound-toggle')!.onclick = () => { state.sound = !state.sound; save(); route(); };
  app.querySelector<HTMLButtonElement>('.install')?.addEventListener('click', install);
}
const searchBox = (value = '') => `<form class="search" role="search"><label class="sr" for="q">낱말 찾기</label><input id="q" name="q" autocomplete="off" enterkeyhint="search" placeholder="궁금한 낱말을 찾아보세요" value="${esc(value)}"><button aria-label="찾기">${img('ic-magnify.png', 'search-icon')}</button></form><div class="search-results" hidden></div>`;
function wireSearch() {
  const form = app.querySelector<HTMLFormElement>('.search'); if (!form) return;
  const input = form.querySelector<HTMLInputElement>('input')!, box = app.querySelector<HTMLDivElement>('.search-results')!;
  const render = () => {
    const q = input.value.trim();
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const rows = dict.search(q, 30), hints = dict.has(q) ? [] : dict.baseForms(q);
    box.hidden = false;
    box.innerHTML = (hints.length ? `<div class="hint-card">${img('bbo-think.png', 'hint-bbo')}<p><b>‘${esc(q)}’</b>는 모양이 바뀐 말이에요. 사전에는 <b>기본형</b>(‘-다’로 끝나는 처음 모양)으로 실려 있어요.</p><div class="hint-words">${hints.map(h => `<button data-go="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>` : '')
      + (rows.length ? `<ol class="result-list">${rows.map(rowItem).join('')}</ol>` : (hints.length ? '' : `<p class="empty">${img('bbo-think.png', 'empty-bbo')}<span>‘${esc(q)}’는 아직 사전에서 못 찾았어요.<br>글자를 다시 살펴볼까요?</span></p><button class="big-button cream" data-big hidden>${img('ic-book.png', 'btn-icon')}더 큰 사전에서 찾아보기</button><div class="big-dict" hidden></div>`));
    bigOn().then(on => { const b = box.querySelector<HTMLButtonElement>('[data-big]'); if (b && on) b.hidden = false; });
    box.querySelector<HTMLButtonElement>('[data-big]')?.addEventListener('click', e => bigDict(q, e.currentTarget as HTMLButtonElement));
    box.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b => b.onclick = () => { input.value = b.dataset.go!; render(); goFirst(b.dataset.go!); });
  };
  let timer = 0;
  input.oninput = () => { clearTimeout(timer); timer = window.setTimeout(render, 120); };
  form.onsubmit = e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; const exact = dict.same(q); if (exact.length) return goFirst(q); const r = dict.search(q, 1); if (r.length && !dict.baseForms(q).length) location.hash = 'w/' + r[0].k; else render(); };
  if (input.value) render();
}
/** 같은 모양 낱말 중 아이가 찾는 낱말을 먼저: 접사·어미(배⁰, 손⁰)보다 쉬운 등급의 보통 낱말을 앞에 둔다. */
function mainRow(w: string) { const s = dict.same(w); return s.find(r => r.lv && !['접사', '어미', '조사'].includes(r.p)) ?? s.find(r => !['접사', '어미'].includes(r.p)) ?? s[0]; }
function goFirst(w: string) { const r = mainRow(w); if (r) { chime(); location.hash = 'w/' + r.k; } }
const rowItem = (r: Row, cur?: number) => `<li><a href="#w/${r.k}" class="row${r.k === cur ? ' current' : ''}"><b>${esc(bare(r.w))}${dict.same(r.w).length > 1 ? `<sup>${r.n}</sup>` : ''}</b><span class="kind kind-${kindOf(r.p).color}">${esc(kindOf(r.p).kid)}</span>${r.lv ? `<span class="lv lv-${r.lv}">${LEVEL[r.lv]}</span>` : ''}</a></li>`;

// ── 첫 화면 ──
async function home() {
  const pool = huntPool();
  const today = pool[daySeed() % pool.length];
  const e = today ? await dict.entry(today.k) : null;
  const stamps = Array.from({length: 5}, (_, i) => img(i < state.stamps % 5 || (state.stamps && state.stamps % 5 === 0) ? 'ic-stamp.png' : 'ic-stamp-empty.png', 'stamp')).join('');
  frame({mode: 'home', left: `
    <div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}가다</span><span>하늘${img('ic-leaf.png', 'leaf flip')}</span></div>
    ${searchBox()}
    ${e ? `<a class="today" href="#w/${today.k}"><span class="ribbon">${img('ic-flower.png', 'ribbon-flower')}오늘의 낱말${img('ic-flower.png', 'ribbon-flower')}</span><strong>${esc(bare(e.w))}</strong><span class="kind kind-${kindOf(e.p).color}">${esc(kindOf(e.p).kid)}</span><p>${esc(e.s[0].d)}</p>${img('bbo-read.png', 'today-bbo')}</a>` : ''}
    <a class="big-button leaf" href="#hunt">${img('ic-hunt.png', 'btn-icon')}사전 찾기 놀이 <span aria-hidden="true">▸</span></a>
    <a class="big-button honey wide" href="#read">${img('ic-read.png', 'btn-icon')}글 읽다 모르는 낱말 찾기 <span aria-hidden="true">▸</span></a>`,
  right: `
    <div class="guide-words right"><span></span><span>하늘${img('ic-leaf.png', 'leaf flip')}</span></div>
    <div class="peek">${img('bbo-peek.png', 'peek-bbo')}<p class="bubble">어떤 낱말을<br>찾아볼까?</p></div>
    <a class="pouch-card" href="#pouch">${img('ic-pouch.png', 'pouch-art')}<span class="pill">낱말 주머니</span><span class="pill count">${state.pouch.length}개</span></a>
    <div class="tip-row">
      <button class="tip" data-try="먹었어요">${img('ic-leaf.png', 'leaf')}먹었어요 → 먹다</button>
      <div class="stamps" aria-label="찾은 낱말 도장 ${state.stamps}개">${img('ic-leaf.png', 'leaf')}낱말 도장 ${stamps}<b>${state.stamps}</b></div>
    </div>`});
  wireSearch();
  app.querySelector<HTMLButtonElement>('[data-try]')!.onclick = () => { const i = app.querySelector<HTMLInputElement>('#q')!; i.value = '먹었어요'; i.dispatchEvent(new Event('input')); i.focus(); };
}

// ── 낱말 쪽 ──
function guideOf(rows: Row[]) { return rows.length ? [bare(rows[0].w), bare(rows.at(-1)!.w)] : ['', '']; }
function pageList(k: number, size: number) {
  const start = Math.floor(k / size) * size;
  return {rows: dict.rows.slice(start, start + size), start};
}
function pageNav(start: number, size: number, target: string) {
  const last = dict.rows.length - 1, jump = size * 10;
  const btn = (to: number, label: string, aria: string, off: boolean) => `<button data-target="${target}" data-turn="${Math.max(0, Math.min(Math.floor(last / size) * size, to))}" ${off ? 'disabled' : ''} aria-label="${aria}">${label}</button>`;
  return `<div class="page-turn">${btn(start - jump, '◀◀', '앞으로 10쪽', start === 0)}${btn(start - size, '◀ 앞 쪽', '앞 쪽', start === 0)}<span class="page-no">${Math.floor(start / size) + 1}쪽</span>${btn(start + size, '다음 쪽 ▶', '다음 쪽', start + size > last)}${btn(start + jump, '▶▶', '뒤로 10쪽', start + size > last)}</div>`;
}
function wireTurns(onTurn: (start: number) => void) {
  app.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach(b => b.onclick = () => { chime(); app.querySelector('.page-left')?.classList.add('flip'); onTurn(+b.dataset.turn!); });
}
function highlight(text: string, word: string) {
  const stem = bare(word).replace(/다$/, '');
  const t = esc(text);
  if (stem.length < 1) return t;
  const re = new RegExp('(' + esc(stem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[가-힣]*)', 'g');
  return t.replace(re, '<mark>$1</mark>');
}
/** 국어사전에서 얻는 정보 5가지(국어활동 75쪽, [4국04-02] 해설): 표기·발음·낱말 종류·뜻·쓰임(예문). */
function infoStrip(e: Entry) {
  const ex = e.s.reduce((n, s) => n + (s.x?.length ?? 0) + (s.t?.length ? 1 : 0), 0);
  const chip = (ok: boolean, label: string, val: string, extra = '') => `<span class="info5-chip${ok ? '' : ' off'}"${extra}><b>${label}</b>${val}</span>`;
  return `<div class="info5" aria-label="이 낱말에서 얻는 정보"><span class="info5-title">사전에서 얻는 정보</span>
    ${chip(true, '표기', esc(bare(e.w)))}${chip(!!e.pr, '발음', e.pr ? `[${esc(e.pr.replace(/ː/g, ':'))}]` : '쓴 대로', ' role="button" tabindex="0" data-info-say')}${chip(true, '종류', esc(kindOf(e.p).kid.replace(/[을를] 나타내는 말$/, '')))}${chip(true, '뜻', `${e.s.length}개`)}${chip(ex > 0, '예문', `${ex}개`)}</div>`;
}
/** 모양이 같은 다른 낱말(배¹·배²)과 뜻이 여러 개인 낱말(다의어)을 구별해 보여 준다. */
function sameShape(e: Entry, k: number, same: {k: number; n: number; d: string}[]) {
  const w = esc(bare(e.w)), parts: string[] = [];
  if (same.length > 1) parts.push(`<div class="same-box"><p><b>모양이 같은 낱말이 ${same.length}개</b> 있어요. 번호(어깨번호)가 다르면 <b>서로 다른 낱말</b>이에요.</p><div class="same-list">${same.map(x => `<a class="same-item${x.k === k ? ' on' : ''}" href="#w/${x.k}"><b>${w}<sup>${x.n}</sup></b><span>${esc(x.d.length > 26 ? x.d.slice(0, 26) + '…' : x.d)}</span></a>`).join('')}</div></div>`);
  if (e.s.length > 1) parts.push(`<p class="poly-note">${img('ic-leaf.png', 'leaf')}<span>‘${w}’${same.length > 1 ? `<sup>${e.n}</sup>` : ''} 한 낱말에 <b>뜻이 ${e.s.length}개</b> 있어요. 글에서는 문장에 맞는 뜻 하나를 골라 읽어요.</span></p>`);
  return parts.join('');
}
function wordCard(e: Entry, k: number, same: {k: number; n: number; d: string}[] = []) {
  const kind = kindOf(e.p), saved = inPouch(state, e.w, e.n), homonyms = dict.same(e.w).length > 1;
  const rels = (s: Entry['s'][number]) => RELATION.filter(([key]) => (s[key] as string[] | undefined)?.length).map(([key, label]) => `<div class="rel"><span class="rel-label rel-${String(key)}">${label}</span>${(s[key] as string[]).map(w => `<button class="rel-word" data-go="${esc(w)}">${esc(w)}</button>`).join('')}</div>`).join('');
  const quizSenses = e.s.map((s, i) => ({i, x: s.x?.[0]})).filter(q => q.x);
  return `<article class="word-card">
    <div class="card-tags"><span class="kind kind-${kind.color}">${esc(kind.kid)}</span><span class="pos">${esc(e.p || e.u)}</span>${e.lv ? `<span class="lv lv-${e.lv}">${LEVEL[e.lv]}</span>` : ''}</div>
    <h2 class="headword">${esc(bare(e.w))}${homonyms ? `<sup>${e.n}</sup>` : ''}${img('ic-sparkle.png', 'head-sparkle')}</h2>
    <div class="pron">${e.pr ? `<span>[${esc(e.pr.replace(/ː/g, ':'))}]</span>` : ''}<button class="speak" data-say="${esc(bare(e.w))}" aria-label="소리 듣기">${img('ic-speaker.png', 'speak-icon')}</button>${e.o ? `<span class="origin">한자 ${esc(e.o)}</span>` : ''}</div>
    ${infoStrip(e)}
    ${sameShape(e, k, same)}
    <div class="guess" hidden>
      <p>${img('bbo-think.png', 'guess-bbo')}<span>뜻을 먼저 짐작해 볼까요? 생각한 뜻을 적어 보세요.</span></p>
      <textarea maxlength="120" rows="2" placeholder="내가 짐작한 뜻"></textarea>
      <button class="big-button honey" data-reveal>사전 뜻이랑 비교하기</button>
    </div>
    <div class="meanings">
      <div class="my-guess" hidden></div>
      <ol class="senses">${e.s.map((s, i) => `<li><span class="sense-no">${i + 1}</span><div><p class="def">${esc(s.d)}<button class="speak mini" data-say="${esc(s.d)}" aria-label="뜻 읽어 주기">${img('ic-speaker.png', 'speak-icon')}</button></p>${s.x ? s.x.slice(0, 2).map(x => `<p class="ex"><span class="ex-tag">예문</span><span>${highlight(x, e.w)}</span></p>`).join('') : ''}${s.t ? `<p class="ex talk"><span class="ex-tag">대화</span><span>${s.t.map(t => highlight(t, e.w)).join('<br>')}</span></p>` : ''}${rels(s)}</div></li>`).join('')}</ol>
    </div>
    <div class="card-actions">
      <button class="big-button berry" data-pouch aria-pressed="${saved}">${img('ic-stamp.png', 'btn-icon')}${saved ? '주머니에 담았어요' : '주머니에 담기'}</button>
      <button class="big-button cream" data-guess>${img('bbo-think.png', 'btn-icon')}뜻 가리고 짐작하기</button>
      ${quizSenses.length >= 2 ? `<button class="big-button cream" data-quiz>${img('ic-sparkle.png', 'btn-icon')}맞는 뜻 고르기</button>` : ''}
    </div>
    <div class="quiz" hidden></div>
    <button class="big-button cream std-open" hidden>${img('ic-book.png', 'btn-icon')}표준국어대사전에서도 보기</button><div class="big-dict" hidden></div>
    ${sentenceBox(e, k)}
    ${e.a ? `<p class="note">${esc(e.a)}</p>` : ''}
  </article>`;
}
function wireCard(e: Entry, k: number) {
  wireSentence(e, k);
  const big = app.querySelector<HTMLButtonElement>('.std-open');
  if (big) { bigOn().then(on => { big.hidden = !on; }); big.onclick = () => bigDict(bare(e.w), big); }
  app.querySelector<HTMLElement>('[data-info-say]')?.addEventListener('click', () => speak(bare(e.w)));
  app.querySelectorAll<HTMLButtonElement>('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say!));
  app.querySelectorAll<HTMLButtonElement>('.rel-word').forEach(b => b.onclick = () => { const s = dict.same(b.dataset.go!); if (s.length) { chime(); location.hash = 'w/' + s[0].k; } else toast('‘' + b.dataset.go + '’는 이 사전에 없어요.'); });
  const pouch = app.querySelector<HTMLButtonElement>('[data-pouch]')!;
  pouch.onclick = () => { const added = togglePouch(state, {w: e.w, n: e.n, k, at: Date.now()}); save(); chime(added ? 'ok' : 'pop'); if (added) toast('낱말 공책에 담았어요!', 'ok'); route(); };
  const guess = app.querySelector<HTMLDivElement>('.guess')!, meanings = app.querySelector<HTMLDivElement>('.meanings')!;
  app.querySelector<HTMLButtonElement>('[data-guess]')!.onclick = () => { guess.hidden = false; meanings.hidden = true; guess.querySelector('textarea')!.focus(); };
  guess.querySelector<HTMLButtonElement>('[data-reveal]')!.onclick = () => {
    const text = guess.querySelector('textarea')!.value.trim();
    guess.hidden = true; meanings.hidden = false;
    const mine = meanings.querySelector<HTMLDivElement>('.my-guess')!;
    mine.hidden = !text; mine.innerHTML = `<span class="ex-tag">내 짐작</span><span>${esc(text)}</span><em>사전 뜻이랑 어디가 같고 다른지 비교해 봐요!</em>`;
    if (text) { state.guesses++; save(); chime('ok'); }
  };
  const quizBtn = app.querySelector<HTMLButtonElement>('[data-quiz]');
  if (quizBtn) quizBtn.onclick = () => {
    const choices = e.s.map((s, i) => ({i, x: s.x?.[0]})).filter(q => q.x) as {i: number; x: string}[];
    const q = choices[Math.floor(Math.random() * choices.length)];
    const box = app.querySelector<HTMLDivElement>('.quiz')!; box.hidden = false;
    box.innerHTML = `<p class="quiz-q">${img('bbo-magnify.png', 'quiz-bbo')}<span>이 문장의 <b>${esc(bare(e.w))}</b>는 몇 번 뜻일까요?</span></p><p class="ex"><span>${highlight(q.x, e.w)}</span></p><div class="quiz-options">${e.s.map((s, i) => `<button data-pick="${i}"><b>${i + 1}</b> ${esc(s.d)}</button>`).join('')}</div>`;
    box.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.onclick = () => {
      if (+b.dataset.pick! === q.i) { b.classList.add('right'); chime('ok'); confetti(); toast('맞았어요! 문장에 맞는 뜻을 잘 골랐어요.'); }
      else { b.classList.add('wrong'); chime('no'); toast('이 뜻을 예문 속 낱말 자리에 넣어 읽어 봐요. 말이 이상하면 다른 뜻이에요!', 'no'); }
    });
    box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  };
}
async function wordPage(k: number) {
  if (!(k >= 0 && k < dict.rows.length)) return home();
  const e = await dict.entry(k);
  const sameRows = dict.same(e.w);
  const same = sameRows.length > 1 ? await Promise.all(sameRows.slice(0, 6).map(async r => ({k: r.k, n: r.n, d: (await dict.entry(r.k).catch(() => null))?.s[0]?.d ?? ''}))) : [];
  const size = 10, {rows, start} = pageList(k, size), [g1, g2] = guideOf(rows);
  const steps = firstLetterSteps(e.w);
  frame({mode: 'word', tab: steps ? BASIC_CHO.find(c => c === steps.cho) ?? baseCho(steps.cho) : undefined,
    left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}${esc(g1)}</span><span>${esc(g2)}${img('ic-leaf.png', 'leaf flip')}</span></div>
      ${searchBox()}
      <ol class="page-words">${rows.map(r => rowItem(r, k)).join('')}</ol>
      ${pageNav(start, size, 'w')}`,
    right: `<div class="guide-words right"><span></span><span>${esc(bare(e.w))}${img('ic-leaf.png', 'leaf flip')}</span></div>${wordCard(e, k, same)}`});
  wireSearch(); wireCard(e, k);
  wireTurns(s => { location.hash = 'w/' + s; });
  app.querySelector('.page-right')?.scrollTo(0, 0);
}
function baseCho(c: string) { const m: Record<string, string> = {'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ'}; return m[c] ?? c; }
function browse(cho: string) {
  const i = CHO.indexOf(cho as never); if (i < 0) return home();
  const k = dict.firstIndexOf(join({cho: i, jung: 0, jong: 0}));
  return wordPage(k);
}

// ── 사전 찾기 놀이 ──
function huntPool() {
  return dict.rows.filter(r => r.lv === 1 && !r.x && ['명사', '동사', '형용사'].includes(r.p) && !/[-\s^]/.test(r.w) && r.w.length >= 2 && r.w.length <= 4 && (BASIC_CHO as readonly string[]).includes(CHO[split(r.w[0])?.cho ?? 99] ?? ''));
}
type Hunt = {targets: HuntTarget[]; i: number; step: number; form?: string | null; sentence?: string; listTitle?: string; page?: number; mistakes: number; t0: number};
let hunt: Hunt | null = null;
async function startHunt(words?: string[], title?: string) {
  const targets = words ? words.map(w => { const s = dict.same(w); const base = s.length ? w : dict.baseForms(w)[0]; const r = base ? dict.same(base)[0] : undefined; return r ? {row: r, given: w} : null; }).filter(Boolean) as HuntTarget[] : pickHuntTargets(huntPool(), 5, Math.random);
  if (!targets.length) { toast('사전에서 찾을 수 있는 낱말이 없어요.'); location.hash = ''; return; }
  if (!words) { const pool = huntPool(), v = pickHuntTargets(pool.filter(r => r.p !== '명사'), 2, Math.random), n = pickHuntTargets(pool.filter(r => r.p === '명사' && !v.some(x => x.row.w[0] === r.w[0])), 3, Math.random); if (v.length === 2 && n.length === 3) targets.splice(0, targets.length, n[0], v[0], n[1], v[1], n[2]); }
  hunt = {targets, i: 0, step: 0, mistakes: 0, listTitle: title, t0: Date.now()};
  await prepareRound();
  huntView();
}
async function prepareRound() {
  const h = hunt!, t = h.targets[h.i];
  h.mistakes = 0; h.page = undefined;
  if (t.given && t.given !== t.row.w) { h.form = t.given; h.sentence = undefined; h.step = 0; return; }
  // 세 번째 문제마다(움직임·성질을 나타내는 말일 때) 예문 속 바뀐 모양으로 기본형 단계부터 시작
  const e = await dict.entry(t.row.k);
  const changed = (h.i % 2 === 1 && (e.p === '동사' || e.p === '형용사')) ? findChangedForm(e) : null;
  h.form = changed?.form ?? null; h.sentence = changed?.sentence; h.step = h.form ? 0 : 1;
}
function huntSteps(h: Hunt) {
  const labels = ['기본형 바꾸기', '첫 자음 고르기', '모음 고르기', '받침 고르기', '사전에서 찾기'];
  const t = h.targets[h.i].row, s = firstLetterSteps(t.w)!;
  const got = ['', s.cho, s.jung, s.jong || '없음', ''];
  return `<ol class="steps">${labels.map((l, i) => (i === 0 && !h.form) ? '' : `<li class="${i < h.step ? 'done' : i === h.step ? 'now' : ''}"><span class="step-no">${i + (h.form ? 1 : 0)}</span>${l}${i < h.step && got[i] ? `<b>${got[i]}</b>` : ''}</li>`).join('<li class="arrow" aria-hidden="true">→</li>').replace(/^<li class="arrow"[^>]*>→<\/li>/, '')}</ol>`;
}
function huntView() {
  const h = hunt!; if (!h) return;
  const t = h.targets[h.i].row, s = firstLetterSteps(t.w)!;
  const word = bare(t.w);
  const head = `<div class="hunt-head"><span class="ribbon small">${h.listTitle ? esc(h.listTitle) : '사전 찾기 놀이'} ${h.i + 1}/${h.targets.length}</span>
    <p class="target-label">찾을 낱말</p><strong class="target">${esc(h.step === 0 && h.form ? h.form : word)}</strong>
    ${h.sentence && h.step === 0 ? `<p class="ex"><span>${esc(h.sentence).replace(esc(h.form!), '<mark>' + esc(h.form!) + '</mark>')}</span></p>` : ''}</div>`;
  let right = '', left = '';
  const bbo = (pose: string, text: string) => `<div class="hunt-bbo">${img(pose, 'hunt-bbo-art')}<p class="bubble">${text}</p></div>`;
  if (h.step === 0) {
    const base = word, opts = shuffle([base, h.form!, h.form!.replace(/[요다]$/, '') + '다'].filter((x, i, a) => a.indexOf(x) === i));
    left = head + bbo('bbo-think.png', '사전에는 ‘-다’로 끝나는<br>처음 모양(<b>기본형</b>)으로 실려 있어요!');
    right = `${huntSteps(h)}<h3 class="ask">‘${esc(h.form!)}’의 기본형은 무엇일까요?</h3><div class="choice-grid wide">${opts.map(o => `<button class="choice" data-ans="${esc(o)}">${esc(o)}</button>`).join('')}</div><p class="tip-text">${img('ic-leaf.png', 'leaf')}움직임이나 모양을 나타내는 말은 ‘-다’를 붙인 모양으로 찾아요.</p>`;
  } else if (h.step === 1) {
    left = head + bbo('bbo-magnify.png', `‘${esc(word[0])}’의 <b>첫 자음</b>은<br>무엇일까요?`);
    right = `${huntSteps(h)}<h3 class="ask">첫 자음을 골라요</h3><div class="choice-grid cho">${BASIC_CHO.map((c, i) => `<button class="choice" style="--tab:${TAB_COLORS[i % 7]}" data-ans="${c}">${c}</button>`).join('')}</div><p class="tip-text">${img('ic-leaf.png', 'leaf')}국어사전은 ㄱ ㄴ ㄷ ㄹ … 차례로 실려 있어요.</p>`;
  } else if (h.step === 2) {
    left = head + bbo('bbo-magnify.png', `‘${esc(word[0])}’에 들어 있는<br><b>모음</b>을 골라요`);
    right = `${huntSteps(h)}<h3 class="ask">모음을 골라요</h3><div class="choice-grid jung">${JUNG.map(c => `<button class="choice" data-ans="${c}">${c}</button>`).join('')}</div><p class="tip-text">${img('ic-leaf.png', 'leaf')}모음 차례: ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ … ㅣ</p>`;
  } else if (h.step === 3) {
    const finals = jongOptions(split(word[0])!.cho, split(word[0])!.jung);
    left = head + bbo('bbo-magnify.png', `‘${esc(word[0])}’ 아래에<br><b>받침</b>이 있나요?`);
    right = `${huntSteps(h)}<h3 class="ask">받침을 골라요</h3><div class="choice-grid jong">${finals.map(c => `<button class="choice" data-ans="${c || '없음'}">${c || '없음'}</button>`).join('')}</div><p class="tip-text">${img('ic-leaf.png', 'leaf')}받침이 없는 글자가 받침 있는 글자보다 먼저 나와요.</p>`;
  } else {
    // 첫 글자만으로는 수백 쪽이 될 수 있어, 둘째 글자의 첫 자음까지 맞춘 쪽을 펼친다(실제 사전에서 둘째 글자 차례로 좁혀 가는 방법).
    const size = 8, second = word[1] ? split(word[1]) : null;
    const near = second ? word[0] + join({cho: second.cho, jung: 0, jong: 0}) : s.syllable;
    const first = dict.firstIndexOf(near);
    h.page ??= Math.floor(first / size) * size;
    const rows = dict.rows.slice(h.page, h.page + size), [g1, g2] = guideOf(rows);
    left = head + bbo('bbo-read.png', second ? `‘${esc(s.syllable)}’ 다음 글자가<br>‘${CHO[second.cho]}’로 시작하는 쪽이에요.<br>쪽 맨 위 낱말을 보고 넘겨요!` : `‘${esc(s.syllable)}’ 쪽을 펼쳤어요!<br>쪽 맨 위 낱말을 보고 넘겨 찾아요.`);
    right = `${huntSteps(h)}<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}${esc(g1)}</span><span>${esc(g2)}${img('ic-leaf.png', 'leaf flip')}</span></div>
      <ol class="page-words hunt-page">${rows.map(r => `<li><button class="row" data-pick="${r.k}"><b>${esc(bare(r.w))}${dict.same(r.w).length > 1 ? `<sup>${r.n}</sup>` : ''}</b><span class="kind kind-${kindOf(r.p).color}">${esc(kindOf(r.p).kid)}</span></button></li>`).join('')}</ol>
      ${pageNav(h.page, size, 'h')}`;
  }
  frame({mode: 'hunt', tab: h.step >= 2 ? s.cho : undefined, left, right});
  app.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.onclick = () => answer(b, b.dataset.ans!));
  app.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.onclick = () => pickWord(b, +b.dataset.pick!));
  wireTurns(st => { if (st >= 0 && st < dict.rows.length) { h.page = st; huntView(); } });
}
function jongOptions(cho: number, jung: number) {
  const set = new Set<number>();
  const from = dict.firstIndexOf(join({cho, jung, jong: 0}));
  const to = dict.firstIndexOf(jung === 20 ? join({cho: cho + 1 > 18 ? 18 : cho + 1, jung: 0, jong: 0}) : join({cho, jung: jung + 1, jong: 0}));
  for (let k = from; k < Math.max(to, from) && k < dict.rows.length; k++) { const s = split(bare(dict.rows[k].w)[0]); if (s && s.cho === cho && s.jung === jung) set.add(s.jong); }
  set.add(0);
  return [...set].sort((a, b) => a - b).map(j => JONG[j]);
}
function answer(b: HTMLButtonElement, ans: string) {
  const h = hunt!, word = bare(h.targets[h.i].row.w), s = firstLetterSteps(word)!;
  const right = h.step === 0 ? ans === word : h.step === 1 ? ans === s.cho : h.step === 2 ? ans === s.jung : (ans === '없음' ? '' : ans) === s.jong;
  if (right) { chime('ok'); b.classList.add('right'); setTimeout(() => { h.step++; huntView(); }, 450); return; }
  h.mistakes++; chime('no'); b.classList.add('wrong');
  const hints = [`‘${word}’처럼 ‘-다’로 끝나는 모양을 찾아봐요.`, `‘${word[0]}’를 소리 내어 읽어 봐요. 처음 소리는 ‘${s.cho}’예요.`, `‘${word[0]}’에서 자음 ‘${s.cho}’ 오른쪽이나 아래에 있는 모음을 봐요.`, s.jong ? `‘${word[0]}’ 아래쪽 받침을 살펴봐요.` : `‘${word[0]}’에는 받침이 없어요.`];
  toast(h.mistakes >= 2 ? hints[h.step] : ['‘-다’로 끝나는 모양을 골라 봐요.', `‘${word[0]}’를 소리 내어 읽어 봐요.`, `‘${word[0]}’에서 자음 옆이나 아래에 있는 모음을 봐요.`, `‘${word[0]}’ 맨 아래를 봐요.`][h.step]);
}
async function pickWord(b: HTMLButtonElement, k: number) {
  const h = hunt!, t = h.targets[h.i].row;
  if (k !== t.k && bare(dict.rows[k].w) !== bare(t.w)) { chime('no'); b.classList.add('wrong'); toast('이 낱말이 아니에요. 쪽 맨 위 낱말을 보고 앞뒤로 넘겨 봐요.'); return; }
  b.classList.add('right'); chime('ok'); confetti();
  const fresh = stampFound(state, t.w); save();
  const e = await dict.entry(t.k), done = h.i + 1 >= h.targets.length;
  const took = Date.now() - h.t0, record = done && !h.listTitle && h.targets.length === 5 && (!state.best || took < state.best);
  if (record) { state.best = took; save(); }
  const right = app.querySelector<HTMLElement>('.page-right')!, left = app.querySelector<HTMLElement>('.page-left')!;
  left.innerHTML = `<div class="found">${img('bbo-cheer.png', 'found-bbo')}<p class="bubble big">찾았다!</p>${fresh ? `<p class="stamp-get">${img('ic-stamp.png', 'stamp big')}낱말 도장 하나!</p>${titleGet()}` : ''}${done ? `${img('bbo-run.png', 'record-bbo')}<p class="record${record ? ' new' : ''}">${h.targets.length}낱말을 ${clock(took)} 만에 찾았어요!${record ? '<br><b>내 최고 기록!</b> 🏆' : state.best && !h.listTitle ? `<br>내 최고 기록 ${clock(state.best)}` : ''}</p>` : ''}</div>`;
  right.innerHTML = `${wordCard(e, t.k)}<div class="next-row">${done ? `<a class="big-button leaf" href="#">다 찾았어요! 첫 화면으로</a><button class="big-button honey" data-again>한 번 더 놀기</button>` : `<button class="big-button leaf" data-next>다음 낱말 찾기 ▸</button>`}</div>`;
  wireCard(e, t.k);
  right.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', async () => { h.i++; await prepareRound(); huntView(); });
  right.querySelector<HTMLButtonElement>('[data-again]')?.addEventListener('click', () => startHunt(h.listTitle ? h.targets.map(x => x.given ?? x.row.w) : undefined, h.listTitle));
  right.scrollTo(0, 0);
}

// ── 낱말 공책(주머니): 담은 낱말, 내가 지은 문장, 글 속에서 찾은 뜻 ──
function pouch() {
  const list = state.pouch;
  frame({mode: 'pouch', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}낱말 공책</span><span>${list.length}개${img('ic-leaf.png', 'leaf flip')}</span></div>
    ${list.length ? `<ol class="page-words pouch-list">${list.map(p => `<li><a class="row note-row" href="#w/${p.k}"><b>${esc(bare(p.w))}</b><span class="date">${new Date(p.at).toLocaleDateString('ko-KR', {month: 'long', day: 'numeric'})}</span>${p.sense ? `<span class="note-line"><i>글 속 뜻</i>${esc(p.sense)}</span>` : ''}${p.ctx ? `<span class="note-line ctx"><i>찾은 문장</i>${esc(p.ctx)}</span>` : ''}${p.my ? `<span class="note-line mine"><i>내 문장</i>${esc(p.my)}</span>` : ''}</a></li>`).join('')}</ol>` : `<p class="empty">${img('bbo-sleep.png', 'empty-bbo')}<span>아직 공책이 비어 있어요.<br>낱말을 찾고 ‘주머니에 담기’나 ‘내 문장 짓기’를 해 보세요.</span></p>`}`,
  right: `<div class="pouch-big">${img('ic-notebook.png', 'pouch-art big')}<p class="bubble">${myTitle() ? `<b class="my-title">${myTitle()}</b><br>` : ''}찾은 낱말 도장 <b>${state.stamps}</b>개<br>내가 지은 문장 <b>${list.filter(p => p.my).length}</b>개<br>짐작해 본 뜻 <b>${state.guesses}</b>번${state.best ? `<br>빨리 찾기 최고 기록 <b>${clock(state.best)}</b>` : ''}</p></div>
    <div class="stamp-board" aria-label="낱말 도장판">${Array.from({length: 30}, (_, i) => img(i < state.stamps ? 'ic-stamp.png' : 'ic-stamp-empty.png', 'stamp')).join('')}</div>
    ${state.stamps >= 30 ? '<p class="tip-text">도장판을 다 채웠어요! 정말 멋진 사전 탐험가예요 🎉</p>' : `<p class="tip-text">${img('ic-leaf.png', 'leaf')}찾기 놀이에서 새 낱말을 찾거나 놀이터에서 한 판을 끝내면 도장을 받아요.</p>`}
    <a class="big-button leaf" href="#hunt">${img('ic-hunt.png', 'btn-icon')}찾기 놀이 하러 가기</a>`});
}

// ── 선생님 메뉴: 낱말 목록 주소, 글 보내기 주소(QR), 40분 수업 흐름, 오프라인 ──
function shareBox(box: HTMLElement, url: string, label: string) {
  const qr = qrcode(0, 'L'); qr.addData(url); qr.make();
  box.hidden = false;
  box.innerHTML = `<p class="tip-text">${label} 주소예요. 복사해서 보내거나 QR을 화면에 띄워 주세요.</p><input class="share-url" readonly value="${esc(url)}"><div class="qr">${qr.createSvgTag({cellSize: 4, margin: 2, scalable: true})}</div><div class="next-row"><button class="big-button honey" data-copy>주소 복사하기</button><a class="big-button cream" href="${esc(url)}">미리 해 보기</a></div>`;
  box.querySelector<HTMLButtonElement>('[data-copy]')!.onclick = async () => { try { await navigator.clipboard.writeText(url); toast('주소를 복사했어요.'); } catch { box.querySelector<HTMLInputElement>('.share-url')!.select(); toast('주소를 길게 눌러 복사해 주세요.'); } };
  box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
const LESSON = [
  ['도입 5분', '사전 차례 줄 세우기 1단계', '#play/order', '[4국04-02]'],
  ['전개① 15분', '이번 주 낱말로 사전 찾기 놀이(아래 낱말 목록 주소)', '#hunt', '[4국04-02]'],
  ['전개② 15분', '글 속 낱말 찾기: 왼쪽 ②에 교과서 문단을 넣어 주소를 보내면, 아이들이 모르는 낱말 → 기본형 → 문맥에 맞는 뜻을 골라 각자 낱말 공책에 모아요', '#read', '[4국04-02]'],
  ['정리 5분', '낱말 공책의 ‘내 문장’ 발표하기 · 반대말/높임말 놀이로 마무리', '#pouch', '[4국04-01] [4국04-04]'],
];
function teacher() {
  const base = location.origin + location.pathname;
  frame({mode: 'teacher', left: `<h2 class="page-title">선생님 메뉴</h2>
    <section class="t-card"><h3>① 낱말 목록으로 찾기 놀이</h3>
    <p class="tip-text">배울 낱말을 한 줄에 하나씩 적으면, 아이들이 그 낱말로 찾기 놀이를 하는 주소가 만들어져요. ‘먹었어요’처럼 바뀐 모양을 적으면 기본형 바꾸기부터 시작해요.</p>
    <label class="field">목록 이름<input id="list-title" maxlength="30" value="이번 주 낱말"></label>
    <label class="field">낱말(최대 30개)<textarea id="list-words" rows="6" placeholder="다정하다&#10;씩씩하다&#10;먹었어요"></textarea></label>
    <button class="big-button leaf" id="make-list">낱말 목록 주소 만들기</button><div class="share share-list" hidden></div></section>
    <section class="t-card"><h3>② 글 보내기(글 속 낱말 찾기)</h3>
    <p class="tip-text">교과서 문단이나 읽기 자료를 붙여 넣으면, 아이들이 그 글에서 모르는 낱말을 눌러 사전을 찾는 주소가 만들어져요(1,200자까지).</p>
    <label class="field">글 제목<input id="text-title" maxlength="30" value="오늘 읽을 글"></label>
    <label class="field">글<textarea id="text-body" rows="6" maxlength="1200" placeholder="여기에 글을 붙여 넣어 주세요."></textarea></label>
    <button class="big-button cream" id="sample-text">예시 글 넣어 보기</button><button class="big-button leaf" id="make-text">글 주소 만들기</button><div class="share share-text" hidden></div></section>
    <p class="tip-text">낱말과 글은 서버에 저장하지 않고 주소 안에만 담겨요. 아이 기록은 각 기기에만 남아요.</p>`,
  right: `<a class="big-button leaf" href="#unit5">${img('ic-book.png', 'btn-icon')}교과서 길: 국어 3-2 나 5단원 13차시별 활동 ▸</a>
    <section class="t-card lesson"><h3>40분 수업 흐름 예시</h3><ol>${LESSON.map(([t, what, to, code]) => `<li><b>${t}</b><span>${what} <em class="code">${code}</em></span><a href="${to}">열기 ▸</a></li>`).join('')}</ol></section>
    <div class="check-list"><p class="tip-text">${img('bbo-read.png', 'hint-bbo')}낱말을 적으면 사전에 있는지 바로 살펴 드려요.</p></div>
    ${offlineBox()}`});
  wireOffline();
  const area = app.querySelector<HTMLTextAreaElement>('#list-words')!, out = app.querySelector<HTMLDivElement>('.check-list')!;
  const check = () => {
    const words = [...new Set(area.value.split(/[\n,]+/).map(w => w.trim()).filter(Boolean))].slice(0, 30);
    out.innerHTML = words.length ? `<ol class="page-words">${words.map(w => { const ok = dict.has(w), base = ok ? [] : dict.baseForms(w); return `<li><span class="row"><b>${esc(w)}</b>${ok ? '<span class="kind kind-leaf">사전에 있어요</span>' : base.length ? `<span class="kind kind-honey">기본형 ‘${esc(base[0])}’로 찾아요</span>` : '<span class="kind kind-berry">사전에 없어요</span>'}</span></li>`; }).join('')}</ol>` : '';
    return words;
  };
  area.oninput = check;
  app.querySelector<HTMLButtonElement>('#make-list')!.onclick = () => {
    const words = check().filter(w => dict.has(w) || dict.baseForms(w).length);
    if (!words.length) return toast('사전에서 찾을 수 있는 낱말을 적어 주세요.');
    shareBox(app.querySelector<HTMLElement>('.share-list')!, base + '#list=' + encodeList(app.querySelector<HTMLInputElement>('#list-title')!.value || '선생님 낱말', words), '낱말 목록');
  };
  app.querySelector<HTMLButtonElement>('#sample-text')!.onclick = () => { app.querySelector<HTMLInputElement>('#text-title')!.value = SAMPLE.t; app.querySelector<HTMLTextAreaElement>('#text-body')!.value = SAMPLE.x; };
  app.querySelector<HTMLButtonElement>('#make-text')!.onclick = () => {
    const body = app.querySelector<HTMLTextAreaElement>('#text-body')!.value.trim();
    if (body.length < 10) return toast('글을 조금 더 넣어 주세요.');
    shareBox(app.querySelector<HTMLElement>('.share-text')!, base + '#read=' + encodeText(app.querySelector<HTMLInputElement>('#text-title')!.value.trim() || '선생님 글', body.slice(0, 1200)), '글');
  };
}

// ── 놀이터: 낱말 분류 · 사전 차례 · 짝 찾기 · 높임말 ──
const GAMES = [
  {to: 'play/sort', title: '낱말 바구니', sub: '이름·움직임·모양을 나타내는 말로 나눠 담아요', code: '[4국04-02]', art: 'ic-basket.png', color: 'berry'},
  {to: 'play/order', title: '사전 차례 줄 세우기', sub: '국어사전에 실린 차례대로 낱말 카드를 세워요', code: '[4국04-02]', art: 'ic-order.png', color: 'honey'},
  {to: 'play/pair-a', title: '반대말 짝 찾기', sub: '뜻이 반대인 낱말끼리 짝을 지어요', code: '[4국04-01]', art: 'ic-pair.png', color: 'leaf', also: ['play/pair-s', '비슷한말 짝 찾기']},
  {to: 'play/honor', title: '높임말 바꾸기', sub: '웃어른께 쓰는 말로 바꿔 말해요', code: '[4국04-04]', art: 'ic-honor.png', color: 'plum'},
];
function playHub() {
  frame({mode: 'play', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}놀이터</span><span>놀이 도장 ${state.games ?? 0}${img('ic-leaf.png', 'leaf flip')}</span></div>
    <div class="play-hello">${img('bbo-cheer.png', 'play-bbo')}<p class="bubble">사전 놀이터에 온 걸 환영해!<br>한 판 끝낼 때마다<br><b>도장</b>을 하나 줄게!</p></div>
    <p class="tip-text">${img('ic-leaf.png', 'leaf')}놀이가 끝나면 나온 낱말을 눌러 사전에서 뜻을 확인할 수 있어요.</p>
    ${titleTrack()}`,
  right: `<div class="game-cards">${GAMES.map(g => `<div class="game-card gc-${g.color}"><a href="#${g.to}" class="game-main">${img(g.art, 'game-art')}<span><b>${g.title}</b><small>${g.sub}</small></span><em class="code">${g.code}</em></a>${g.also ? `<a href="#${g.also[0]}" class="game-also">${g.also[1]} ▸</a>` : ''}</div>`).join('')}</div>`});
}
const PRAISE: Record<string, string> = {'sort-tb': '교과서 낱말 정리왕!', 'sort-my': '나만의 기준 발견!', clue: '단서 탐정!', wrap: '5단원 마무리 완료!', sort: '바구니 정리왕!', order: '줄 세우기 박사!', 'pair-a': '반대말 탐정!', 'pair-s': '비슷한말 탐정!', honor: '예절 왕!'};
const TITLES: [number, string][] = [[5, '새싹 탐험가'], [10, '산딸기 탐험가'], [20, '숲속 사전 박사'], [30, '베리숲 사전왕']];
/** 도장이 5·10·20·30개가 되는 순간 칭호를 준다. */
function titleGet() { const t = TITLES.find(([n]) => n === state.stamps); return t ? `<p class="title-get">${img('bbo-cheer.png', 'title-bbo')}<span>새 칭호를 얻었어요!<br><b>${t[1]}</b></span></p>` : ''; }
function titleTrack() {
  const next = TITLES.find(([n]) => n > state.stamps), now = myTitle();
  return `<div class="title-track"><b>${now ? `지금 칭호: ${now}` : '첫 칭호에 도전해 봐요!'}</b>${next ? `<span>‘${next[1]}’까지 도장 <b>${next[0] - state.stamps}</b>개 남았어요</span><progress max="${next[0]}" value="${state.stamps}"></progress>` : '<span>모든 칭호를 모았어요!</span>'}<div class="stamps-row">${Array.from({length: Math.min(state.stamps, 30)}, () => img('ic-stamp.png', 'stamp')).join('')}</div></div>`;
}
function myTitle() { return [...TITLES].reverse().find(([n]) => state.stamps >= n)?.[1] ?? ''; }
function gameDone(kind: string, words: string[]) {
  state.games = (state.games ?? 0) + 1; state.stamps += 1; save();
  chime('ok'); confetti();
  const links = [...new Set(words)].map(w => { const r = dict.same(w)[0]; return r ? `<a class="rel-word" href="#w/${r.k}">${esc(bare(w))}</a>` : ''; }).join('');
  return `<div class="game-done">${img('bbo-cheer.png', 'found-bbo')}<p class="bubble big">${PRAISE[kind] ?? '다 했다!'}</p><p class="stamp-get">${img('ic-stamp.png', 'stamp big')}놀이 도장 하나! (모두 ${state.stamps}개)</p>${titleGet()}
    ${links ? `<p class="tip-text">${img('ic-leaf.png', 'leaf')}낱말을 눌러 사전에서 뜻을 확인해 봐요.</p><div class="rel">${links}</div>` : ''}
    <div class="next-row"><button class="big-button leaf" data-again="${kind}">한 판 더 ▸</button><a class="big-button honey" href="#play">다른 놀이 하기</a></div></div>`;
}
function wireAgain() { app.querySelectorAll<HTMLButtonElement>('[data-again]').forEach(b => b.onclick = () => playGame(b.dataset.again!)); }
let pairsCache: Pair[] | null = null;
async function playGame(kind: string) {
  if (kind === 'sort') return sortGame();
  if (kind === 'sort-tb') return sortGame(true);
  if (kind === 'sort-my') return sortMyGame();
  if (kind === 'clue') return clueGame();
  if (kind === 'clue-make') return clueMake();
  if (kind === 'wrap') return wrapGame();
  if (kind === 'order') return orderGame(1);
  if (kind === 'pair-a' || kind === 'pair-s') {
    pairsCache ??= await fetch(import.meta.env.BASE_URL + 'data/pairs.json').then(r => r.json()).catch(() => null);
    if (!pairsCache) { toast('짝 낱말을 불러오지 못했어요.'); return playHub(); }
    return pairGame(kind === 'pair-a' ? 'a' : 's');
  }
  if (kind === 'honor') return honorGame();
  return playHub();
}
const gameHead = (title: string, _code: string, bubble: string, pose = 'bbo-think.png') => `<div class="hunt-head"><span class="ribbon small">${title}</span></div><div class="hunt-bbo">${img(pose, 'hunt-bbo-art')}<p class="bubble">${bubble}</p></div>`;
const shake = (b: Element) => { b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 400); };

// 낱말 바구니: 카드를 고르고 바구니를 누른다(끌어 놓기 없이 누르기만으로 — 태블릿·휴대폰에서도 쉽게).
function sortGame(textbook = false) {
  const cards = pickSortRound(dict.rows, 6, Math.random, textbook ? TEXTBOOK_SORT : undefined);
  const placed = new Map<number, BasketKey>(), miss = new Map<number, number>(); let picked: number | null = null;
  const draw = () => {
    const left = cards.filter(c => !placed.has(c.k));
    const baskets = `<div class="baskets">${BASKETS.map(b => `<button class="basket bk-${b.color}" data-basket="${b.key}">${img('ic-basket.png', 'basket-art')}<b>${b.label}</b><span class="in">${cards.filter(c => placed.get(c.k) === b.key).map(c => `<i>${esc(bare(c.w))}</i>`).join('')}</span></button>`).join('')}</div>`;
    frame({mode: 'play-sort',
      left: gameHead(textbook ? '교과서 낱말 바구니' : '낱말 바구니', '[4국04-02]', !left.length ? '바구니에<br>다 담았어요!' : picked === null ? '낱말 카드를 하나 누르고,<br>알맞은 <b>바구니</b>를 눌러요!' : `‘${esc(bare(dict.rows[picked].w))}’는<br>어느 바구니에 담을까?`, 'bbo-basket.png') +
        `<div class="sort-cards">${left.map(c => `<button class="word-chip${c.k === picked ? ' on' : ''}" data-card="${c.k}">${esc(bare(c.w))}</button>`).join('')}</div>`,
      right: left.length ? baskets + `<p class="tip-text">${img('ic-leaf.png', 'leaf')}<span class="kind-guide"><span><i class="dot berry"></i><b>이름</b>: 부를 수 있는 것(사과, 친구)</span><span><i class="dot leaf"></i><b>움직임</b>: ‘지금 ○○한다’가 말이 되는 것(달린다)</span><span><i class="dot sky"></i><b>모양·성질</b>: 어떤지 말하는 것(예쁘다, 차갑다)</span></span></p>` : baskets + gameDone(textbook ? 'sort-tb' : 'sort', cards.map(c => c.w))});
    wireAgain();
    app.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(b => b.onclick = () => { chime(); picked = +b.dataset.card!; draw(); });
    app.querySelectorAll<HTMLButtonElement>('[data-basket]').forEach(b => b.onclick = () => {
      if (!left.length) return;
      if (picked === null) return toast('먼저 낱말 카드를 골라요.');
      const r = dict.rows[picked], key = b.dataset.basket as BasketKey;
      if (basketOf(r) === key) { placed.set(picked, key); picked = null; chime('ok'); draw(); return; }
      chime('no'); shake(b);
      const n = (miss.get(picked) ?? 0) + 1; miss.set(picked, n);
      const w = bare(r.w), stem = w.replace(/다$/, '');
      toast(n >= 2 ? `‘${w}’는 ‘${BASKETS.find(x => x.key === basketOf(r))!.label}’이에요. 사전에도 그렇게 나와요!` : basketOf(r) === 'name' ? '‘-다’로 끝나지 않아요. 무엇을 부르는 이름일까요?' : basketOf(r) === 'move' ? `‘${stem}’ 하고 몸을 움직이는 모습을 떠올려 봐요. 움직임이에요!` : `‘${w}’는 움직이는 게 아니라 ‘어떤지’를 말해요.`);
    });
  };
  draw();
}

// 사전 차례 줄 세우기: 3단계(첫 자음 → 모음·받침 → 둘째 글자).
const ORDER_TIP = ['', '첫 자음 차례: ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ', '첫 자음이 같으면 모음 차례(ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ …)로 비교해요. 모음도 같으면 받침이 없는 글자가 먼저예요.', '첫 글자가 같으면 둘째 글자를 비교해요.'];
function orderGame(level: 1 | 2 | 3, done: string[] = []) {
  const cards = pickOrderRound(dict.rows, level, 5);
  if (!cards.length) return playHub();
  const answer = [...cards].sort((a, b) => a.k - b.k), line: Row[] = [];
  const draw = () => {
    const full = line.length === answer.length, all = [...done, ...answer.map(r => r.w)];
    frame({mode: 'play-order',
      left: gameHead(`사전 차례 줄 세우기 ${level}/3`, '[4국04-02]', full ? '사전 차례대로<br>줄을 세웠어요!' : '사전에 <b>먼저</b> 나오는 낱말부터<br>차례로 눌러요!', 'bbo-magnify.png') +
        (level === 1 ? `<div class="cho-line" aria-label="첫 자음 차례">${CHO.map(c => `<span>${c}</span>`).join('')}</div>` : `<p class="tip-text big">${img('ic-leaf.png', 'leaf')}${ORDER_TIP[level]}</p>`),
      right: `<ol class="order-line">${answer.map((_, i) => `<li class="${line[i] ? 'filled' : ''}"><span>${i + 1}</span>${line[i] ? `<b>${esc(bare(line[i].w))}</b>` : ''}</li>`).join('')}</ol>
        <div class="sort-cards">${cards.filter(c => !line.includes(c)).map(c => `<button class="word-chip" data-card="${c.k}">${esc(bare(c.w))}</button>`).join('')}</div>
        ${full ? (level < 3 ? `<div class="next-row"><button class="big-button leaf" data-level>다음 단계 ▸</button></div>` : gameDone('order', all)) : ''}`});
    wireAgain();
    app.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(b => b.onclick = () => {
      const r = dict.rows[+b.dataset.card!];
      if (r.k === answer[line.length].k) { line.push(r); chime('ok'); draw(); return; }
      chime('no'); shake(b);
      toast(`‘${bare(r.w)}’보다 먼저 나오는 낱말이 있어요. ${level === 1 ? '첫 자음을' : level === 2 ? '모음과 받침을' : '둘째 글자를'} 비교해 봐요.`);
    });
    app.querySelector<HTMLButtonElement>('[data-level]')?.addEventListener('click', () => orderGame((level + 1) as 2 | 3, all));
  };
  draw();
}

// 비슷한말·반대말 짝 찾기
function pairGame(kind: 's' | 'a') {
  const pairs = pickPairRound(pairsCache!, kind, 4);
  const lefts = pairs.map(p => p[0]); let rights = shuffle(pairs.map(p => p[1]));
  for (let t = 0; t < 20 && rights.some((r, i) => pairs[i][1] === r); t++) rights = shuffle(rights);
  const matched = new Set<string>(); let picked: string | null = null;
  const name = kind === 'a' ? '반대말' : '비슷한말';
  const draw = () => {
    const col = (list: string[], side: string) => list.map(w => { const i = pairs.findIndex(p => p[0] === w || p[1] === w); return `<button class="word-chip${matched.has(w) ? ' matched pc-' + i : ''}${picked === w ? ' on' : ''}" data-${side}="${esc(w)}" ${matched.has(w) ? 'disabled' : ''}>${esc(bare(w))}</button>`; }).join('');
    const full = matched.size === pairs.length * 2;
    frame({mode: 'play-pair',
      left: gameHead(`${name} 짝 찾기`, '[4국04-01]', kind === 'a' ? '뜻이 <b>반대</b>인 낱말끼리<br>짝을 지어 줘!' : '뜻이 <b>비슷한</b> 낱말끼리<br>짝을 지어 줘!', 'bbo-read.png') +
        `<p class="tip-text">${img('ic-leaf.png', 'leaf')}왼쪽 낱말을 누르고, 짝이 되는 오른쪽 낱말을 눌러요. 짝 낱말은 사전의 ‘${name}’ 칸에 실려 있어요.</p>
        <a class="big-button cream" href="#play/pair-${kind === 'a' ? 's' : 'a'}">${kind === 'a' ? '비슷한말' : '반대말'} 짝 찾기로 바꾸기</a>`,
      right: `<div class="pair-board"><div class="pair-col">${col(lefts, 'l')}</div><div class="pair-col">${col(rights, 'r')}</div></div>
        ${full ? `<ul class="pair-list">${pairs.map(p => `<li><b>${esc(p[0])}</b> ${kind === 'a' ? '↔' : '≈'} <b>${esc(p[1])}</b></li>`).join('')}</ul>` + gameDone('pair-' + kind, pairs.flatMap(p => [p[0], p[1]])) : ''}`});
    wireAgain();
    app.querySelectorAll<HTMLButtonElement>('[data-l]').forEach(b => b.onclick = () => { chime(); picked = b.dataset.l!; draw(); });
    app.querySelectorAll<HTMLButtonElement>('[data-r]').forEach(b => b.onclick = () => {
      if (!picked) return toast('먼저 왼쪽 낱말을 골라요.');
      const w = b.dataset.r!;
      if (pairs.some(p => p[0] === picked && p[1] === w)) { matched.add(picked); matched.add(w); picked = null; chime('ok'); draw(); return; }
      chime('no'); shake(b); toast(kind === 'a' ? `‘${bare(picked)}’와 거꾸로인 뜻을 찾아봐요. ‘${bare(w)}’는 아니에요.` : `‘${bare(picked)}’와 뜻이 거의 같은 말을 찾아봐요. ‘${bare(w)}’는 아니에요.`);
    });
  };
  draw();
}

// 높임말 바꾸기
function honorGame() {
  const qs = pickHonorRound(5); let i = 0;
  const draw = (solved = false, finished = false) => {
    const q = qs[i], [before, after] = q.s.split(/\[.*?\]/);
    const r = dict.same(q.base)[0];
    frame({mode: 'play-honor',
      left: gameHead(`높임말 바꾸기 ${i + 1}/${qs.length}`, '[4국04-04]', '웃어른께 말할 때는<br><b>높임말</b>을 써요!', 'bbo-bow.png') +
        `<p class="tip-text">${img('ic-leaf.png', 'leaf')}할머니·할아버지·선생님처럼 웃어른을 높일 때 쓰는 말을 골라요. 사전 낱말 쪽의 ‘높임말’ 칸에서도 찾을 수 있어요.</p>`,
      right: `<p class="honor-sent">${esc(before)}<mark>${esc(solved ? q.h : q.p)}</mark>${esc(after)}</p>
        <h3 class="ask">밑줄 친 말을 높임말로 바꾸면?</h3>
        <div class="choice-grid wide honor-choices">${q.options.map(o => `<button class="choice${solved && o === q.h ? ' right' : ''}" data-ans="${esc(o)}" ${solved ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
        ${solved && !finished ? `<div class="next-row">${r ? `<a class="big-button cream" href="#w/${r.k}">사전에서 ‘${esc(q.base)}’ 보기</a>` : ''}<button class="big-button leaf" data-next>${i + 1 < qs.length ? '다음 문제 ▸' : '다 했어요!'}</button></div>` : ''}
        ${finished ? gameDone('honor', qs.map(x => x.base)) : ''}`});
    wireAgain();
    app.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.onclick = () => {
      if (b.dataset.ans === q.h) { chime('ok'); return draw(true); }
      chime('no'); shake(b);
      toast(b.dataset.ans === q.p ? '그건 원래 낱말이에요. 웃어른께 쓰는 말로 바꿔 봐요.' : '어른께서 하시는 일이나 어른의 것을 높이는 말이에요. 문장에 넣어 읽어 보고 다시 골라 봐요.');
    });
    app.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { if (i + 1 < qs.length) { i++; draw(); } else draw(true, true); });
  };
  draw();
}

// ── 더 큰 사전(표준국어대사전): 한국어기초사전에 없는 낱말. 키는 Cloudflare 서버에만 있고 브라우저에는 오지 않는다. ──
const API = location.hostname.endsWith('workers.dev') ? '' : 'https://berry-dictionary.yangyeontae.workers.dev';
// 키가 들어가 있을 때만 버튼을 보인다(한 번 묻고 기억).
let bigState: Promise<boolean> | null = null;
function bigOn() { return bigState ??= fetch(`${API}/api/stdict?status=1`).then(r => r.json()).then(b => !!b.on).catch(() => false); }
async function bigDict(q: string, btn: HTMLButtonElement) {
  const out = btn.nextElementSibling as HTMLDivElement; btn.disabled = true;
  out.hidden = false; out.innerHTML = `<p class="tip-text">${img('bbo-magnify.png', 'hint-bbo')}큰 사전을 펼치는 중…</p>`;
  try {
    const res = await fetch(`${API}/api/stdict?q=${encodeURIComponent(q.slice(0, 20))}`);
    const body = await res.json() as {off?: boolean; items?: {w: string; n: number; p: string; d: string; i?: string}[]};
    if (body.off) { out.innerHTML = `<p class="tip-text">${img('bbo-sleep.png', 'hint-bbo')}더 큰 사전 연결은 아직 준비 중이에요. 선생님께 여쭤봐요!</p>`; return; }
    const items = body.items ?? [];
    out.innerHTML = items.length ? `<div class="big-card"><span class="ribbon small">표준국어대사전에서 찾았어요</span><ol class="senses">${items.map((it, i) => `<li><span class="sense-no">${i + 1}</span><div><p class="def"><b>${esc(it.w)}${it.n ? `<sup>${it.n}</sup>` : ''}</b> <span class="pos">${esc(it.p)}</span></p><p class="def">${esc(it.d)}</p>${it.i && items.findIndex(x => x.i === it.i) === i ? `<button class="more-btn" data-std-id="${esc(it.i)}">발음·예문·비슷한말 더 보기 ▾</button><div class="std-detail" hidden></div>` : ''}</div></li>`).join('')}</ol><p class="note">뜻 풀이: <a href="https://stdict.korean.go.kr" target="_blank" rel="noopener">표준국어대사전</a>(국립국어원). 어른용 사전이라 어려운 말이 나올 수 있어요.</p></div>`
      : `<p class="tip-text">${img('bbo-think.png', 'hint-bbo')}큰 사전에도 ‘${esc(q)}’는 없어요. 띄어쓰기나 글자를 살펴봐요.</p>`;
    out.querySelectorAll<HTMLButtonElement>('[data-std-id]').forEach(b => b.onclick = () => stdDetail(b.dataset.stdId!, b));
  } catch { out.innerHTML = `<p class="tip-text">${img('bbo-sleep.png', 'hint-bbo')}큰 사전에 닿지 못했어요. 인터넷을 확인해 주세요.</p>`; btn.disabled = false; }
}

// 표준국어대사전 자세히 보기: 발음(표기와 다른 소리), 고유어·한자어, 뜻마다 예문과 관련어 — [4국04-02] 해설의 '표기, 발음, 품사, 의미, 용례'
type StdWord = {word: string; wordType?: string; pronunciation?: string[]; senses: {pos: string; definition: string; examples: string[]; related?: {word: string}[]}[]};
async function stdDetail(id: string, btn: HTMLButtonElement) {
  const box = btn.nextElementSibling as HTMLDivElement;
  if (!box.hidden) { box.hidden = true; btn.textContent = '발음·예문·비슷한말 더 보기 ▾'; return; }
  box.hidden = false; btn.textContent = '접기 ▴'; box.innerHTML = '<p class="tip-text">펼치는 중…</p>';
  try {
    const w = await fetch(`${API}/api/stdict?id=${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : Promise.reject()) as StdWord;
    const pr = (w.pronunciation ?? []).filter(Boolean);
    box.innerHTML = `<p class="std-line">${pr.length ? `<span class="info-chip">발음 [${esc(pr.join('/'))}]</span>${pr[0] !== bare(w.word) ? '<em>쓰는 것과 읽는 소리가 달라요!</em>' : ''}` : ''}${w.wordType ? `<span class="info-chip">${esc(w.wordType)}</span>` : ''}</p>
      ${w.senses.slice(0, 4).map((s, j) => `<div class="std-sense"><b>${j + 1}</b> ${esc(s.definition)}${s.examples.slice(0, 2).map(x => `<p class="ex"><span class="ex-tag">예문</span><span>${esc(x)}</span></p>`).join('')}${s.related?.length ? `<div class="rel"><span class="rel-label">함께 보기</span>${s.related.map(r => `<button class="rel-word" data-go="${esc(r.word)}">${esc(r.word)}</button>`).join('')}</div>` : ''}</div>`).join('')}`;
    box.querySelectorAll<HTMLButtonElement>('.rel-word').forEach(b => b.onclick = () => { const s = dict.same(b.dataset.go!); if (s.length) { chime(); location.hash = 'w/' + s[0].k; } else toast('‘' + b.dataset.go + '’는 베리 사전에 없어요. 찾기 칸에 넣어 큰 사전에서 찾아봐요.'); });
  } catch { box.innerHTML = '<p class="tip-text">자세한 내용을 불러오지 못했어요.</p>'; }
}

// ── 앱으로 설치·오프라인 ──
let installEvt: (Event & {prompt: () => Promise<void>}) | null = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e as typeof installEvt; const f = app.querySelector('.credit'); if (f && !f.querySelector('.install')) { f.insertAdjacentHTML('beforeend', ' · <button class="install">앱으로 설치</button>'); f.querySelector<HTMLButtonElement>('.install')!.onclick = install; } });
async function install() { if (!installEvt) return; await installEvt.prompt(); installEvt = null; app.querySelector('.install')?.remove(); }
const offlineBox = () => `<div class="offline-box"><h3 class="ask">교실 와이파이가 약할 때</h3>
  <p class="tip-text">이 기기에 사전을 통째로 받아 두면 인터넷이 끊겨도 낱말을 찾을 수 있어요(한 번만, 약 30MB). 크롬·엣지에서는 아래쪽 ‘앱으로 설치’로 바탕화면에 아이콘도 만들 수 있어요. 아이패드는 공유 → 홈 화면에 추가.</p>
  <button class="big-button honey" data-offline>사전 통째로 받아 두기</button><progress hidden max="1" value="0"></progress><p class="offline-state tip-text"></p></div>`;
function wireOffline() {
  const btn = app.querySelector<HTMLButtonElement>('[data-offline]'); if (!btn) return;
  const bar = app.querySelector('progress')!, msg = app.querySelector<HTMLElement>('.offline-state')!;
  const chunks = Math.ceil(dict.rows.length / 500);
  if (!('serviceWorker' in navigator) || !('caches' in window)) { btn.disabled = true; msg.textContent = '이 브라우저는 받아 두기를 지원하지 않아요.'; return; }
  caches.match(new URL(`data/e/${chunks - 1}.json`, location.href).href).then(r => { if (r) msg.textContent = '✅ 이 기기에 사전이 받아져 있어요.'; }).catch(() => {});
  btn.onclick = async () => {
    if (!navigator.serviceWorker.controller) { msg.textContent = '준비 중이에요. 새로고침한 뒤 다시 눌러 주세요.'; return; }
    btn.disabled = true; bar.hidden = false; bar.max = chunks; let done = 0, failed = 0;
    const queue = Array.from({length: chunks}, (_, i) => i);
    await Promise.all(Array.from({length: 4}, async () => { for (let c = queue.shift(); c !== undefined; c = queue.shift()) { try { const r = await fetch(import.meta.env.BASE_URL + `data/e/${c}.json`); if (!r.ok) failed++; } catch { failed++; } bar.value = ++done; msg.textContent = `${done} / ${chunks}`; } }));
    msg.textContent = failed ? `${failed}조각을 받지 못했어요. 다시 눌러 주세요.` : '✅ 다 받았어요! 이제 인터넷이 없어도 찾을 수 있어요.';
    btn.disabled = false; bar.hidden = true;
  };
}
if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));

// ── 글 속 낱말 찾기 [4국04-02]: 글을 읽다 모르는 낱말 → 기본형 → 사전 → 글에 맞는 뜻 고르기 → 낱말 공책 ──
const SAMPLE = {t: '뽀짝이의 숲 산책', x: '아침 햇살이 숲속 오솔길을 따뜻하게 비추었어요. 뽀짝이는 꼬리를 흔들며 산딸기 덤불 쪽으로 뛰어갔어요. 덤불 아래에는 작은 다람쥐가 도토리를 모으느라 바빴어요. 뽀짝이가 반갑게 인사하자 다람쥐는 깜짝 놀라 나무 위로 재빨리 올라갔어요. 뽀짝이는 조금 서운했지만, 다음에는 살금살금 다가가기로 마음먹었어요.'};
const PARTICLES = ['으로부터', '에서부터', '에게서', '한테서', '이라도', '처럼', '보다', '까지', '부터', '에서', '에게', '한테', '께서', '으로', '마저', '조차', '이나', '이랑', '하고', '은', '는', '이', '가', '을', '를', '에', '도', '만', '와', '과', '의', '로', '께', '야', '랑', '나'];
/** 글 속 어절 → 사전에 실린 모양 후보(그대로 → 기본형 → 조사 떼기). */
function lookupToken(tok: string): {base: string; how: 'same' | 'base' | 'particle'; rest?: string} | null {
  const w = tok.replace(/[^가-힣]/g, '');
  if (!w) return null;
  if (dict.has(w)) return {base: w, how: 'same'};
  const b = dict.baseForms(w); if (b.length) return {base: b[0], how: 'base'};
  for (const p of PARTICLES) if (w.endsWith(p) && w.length > p.length && dict.has(w.slice(0, -p.length))) return {base: w.slice(0, -p.length), how: 'particle', rest: p};
  return null;
}
function readPage(code?: string) {
  const fromLink = code ? decodeText(code) : null;
  const doc = fromLink ?? (readDoc ?? SAMPLE);
  readDoc = doc;
  const sentences = doc.x.split(/(?<=[.!?。])\s+/);
  const tokens = (s: string) => s.split(/(\s+)/).map(t => /\s/.test(t) ? t : `<button class="tok" data-tok="${esc(t)}">${esc(t)}</button>`).join('');
  frame({mode: 'read',
    left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}글 속 낱말 찾기</span><span>${img('ic-leaf.png', 'leaf flip')}</span></div>
      <h2 class="page-title">${esc(doc.t)}</h2>
      <div class="passage">${sentences.map((s, i) => `<p data-sent="${i}">${tokens(s)}</p>`).join('')}</div>
      <p class="tip-text">${img('ic-leaf.png', 'leaf')}글을 읽다가 뜻을 모르는 낱말을 콕 눌러 보세요.</p>
      <details class="own-text"><summary>다른 글 넣기</summary>
        <label class="field">제목<input id="read-title" maxlength="30" value="${esc(doc.t)}"></label>
        <label class="field">글(교과서 문단을 붙여 넣어도 돼요)<textarea id="read-text" rows="6" maxlength="1200">${esc(doc.x)}</textarea></label>
        <div class="next-row"><button class="big-button leaf" id="read-open">이 글 펼치기</button><button class="big-button cream" id="read-share">아이들에게 보낼 주소</button></div>
        <input class="share-url" readonly hidden></details>`,
    right: `<div class="read-panel"><div class="peek">${img('bbo-read.png', 'peek-bbo')}<p class="bubble">모르는 낱말을<br>눌러 볼래?</p></div></div>`});
  app.querySelectorAll<HTMLButtonElement>('[data-tok]').forEach(b => b.onclick = () => {
    app.querySelectorAll('.tok.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
    const sent = b.closest('p')!.textContent ?? '';
    readLookup(b.dataset.tok!, sent);
  });
  const title = app.querySelector<HTMLInputElement>('#read-title')!, text = app.querySelector<HTMLTextAreaElement>('#read-text')!;
  app.querySelector<HTMLButtonElement>('#read-open')!.onclick = () => { if (!text.value.trim()) return toast('글을 넣어 주세요.'); readDoc = {t: title.value.trim() || '내 글', x: text.value.trim().slice(0, 1200)}; history.replaceState(null, '', '#read'); readPage(); };
  app.querySelector<HTMLButtonElement>('#read-share')!.onclick = async () => {
    if (!text.value.trim()) return toast('글을 넣어 주세요.');
    const url = location.origin + location.pathname + '#read=' + encodeText(title.value.trim() || '선생님 글', text.value.trim().slice(0, 1200));
    const box = app.querySelector<HTMLInputElement>('.own-text .share-url')!; box.hidden = false; box.value = url; box.select();
    try { await navigator.clipboard.writeText(url); toast('주소를 복사했어요. 아이들에게 보내 주세요.'); } catch { toast('주소를 길게 눌러 복사해 주세요.'); }
  };
}
let readDoc: {t: string; x: string} | null = null;
function encodeText(t: string, x: string) { const bytes = new TextEncoder().encode(JSON.stringify({t: t.slice(0, 30), x})); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeText(code: string): {t: string; x: string} | null {
  try { const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); return typeof o.x === 'string' && o.x.trim() ? {t: String(o.t ?? '선생님 글').slice(0, 30), x: o.x.slice(0, 1200)} : null; } catch { return null; }
}
async function readLookup(tok: string, sentence: string) {
  const panel = app.querySelector<HTMLElement>('.read-panel')!;
  const hit = lookupToken(tok), word = tok.replace(/[^가-힣]/g, '');
  if (!hit) { chime('no'); panel.innerHTML = `<p class="empty">${img('bbo-think.png', 'empty-bbo')}<span>‘${esc(word || tok)}’는 이 사전에 없어요.<br>이름(사람·땅 이름)이거나 붙여 쓴 말일 수 있어요.</span></p><button class="big-button cream" data-big hidden>${img('ic-book.png', 'btn-icon')}더 큰 사전에서 찾아보기</button><div class="big-dict" hidden></div>`; bigOn().then(on => { const b = panel.querySelector<HTMLButtonElement>('[data-big]'); if (b && on) b.hidden = false; }); panel.querySelector<HTMLButtonElement>('[data-big]')!.onclick = e => bigDict(word, e.currentTarget as HTMLButtonElement); return; }
  chime();
  const rows = dict.same(hit.base), e = await dict.entry(rows[0].k);
  const why = hit.how === 'base' ? `‘${esc(word)}’는 모양이 바뀐 말이에요. 사전에는 기본형(‘-다’로 끝나는 처음 모양) <b>‘${esc(hit.base)}’</b>로 실려 있어요.` : hit.how === 'particle' ? `‘${esc(word)}’에서 뒤에 붙은 ‘${esc(hit.rest!)}’를 떼면 <b>‘${esc(hit.base)}’</b>예요. 사전에는 ‘${esc(hit.base)}’로 찾아요.` : `사전에서 <b>‘${esc(hit.base)}’</b>를 찾아요.`;
  const senses = rows.length > 1 ? (await Promise.all(rows.map(r => dict.entry(r.k)))).flatMap(en => en.s.map(s => ({en, s}))).slice(0, 8) : e.s.map(s => ({en: e, s}));
  panel.innerHTML = `<div class="hint-card">${img('bbo-magnify.png', 'hint-bbo')}<p>${why}</p></div>
    <p class="ex"><span class="ex-tag">글 속 문장</span><span>${esc(sentence).replace(esc(tok.replace(/[.,!?]+$/, '')), m => `<mark>${m}</mark>`)}</span></p>
    <h3 class="ask">이 글에서는 몇 번 뜻일까요?</h3><p class="tip-text">${img('ic-leaf.png', 'leaf')}뜻을 문장 속 낱말 자리에 넣어 읽어 보고, 말이 되는 뜻을 골라요.</p>
    <div class="quiz-options">${senses.map((x, i) => `<button data-sense="${i}" ${i >= 4 ? 'hidden' : ''}><b>${i + 1}</b> ${esc(x.s.d)}</button>`).join('')}${senses.length > 4 ? `<button class="more" data-more>뜻 ${senses.length - 4}개 더 보기 ▾</button>` : ''}</div>
    <div class="read-after" hidden></div>
    <div class="next-row"><button class="big-button honey" data-hunt>${img('ic-book.png', 'btn-icon')}사전 찾기 놀이로 직접 찾기</button><a class="big-button cream" href="#w/${rows[0].k}">사전 쪽 펼치기</a></div>`;
  panel.querySelector<HTMLButtonElement>('[data-more]')?.addEventListener('click', e => { panel.querySelectorAll<HTMLButtonElement>('[data-sense]').forEach(b => b.hidden = false); (e.currentTarget as HTMLElement).remove(); });
  panel.querySelectorAll<HTMLButtonElement>('[data-sense]').forEach(b => b.onclick = () => {
    panel.querySelectorAll('[data-sense]').forEach(x => x.classList.remove('right')); b.classList.add('right'); chime('ok');
    const pick = senses[+b.dataset.sense!], k = dict.same(pick.en.w).find(r => r.n === pick.en.n)?.k ?? rows[0].k;
    const after = panel.querySelector<HTMLElement>('.read-after')!; after.hidden = false;
    after.innerHTML = `<p class="tip-text">${img('bbo-think.png', 'hint-bbo')}고른 뜻을 글 속 문장에 넣어 읽어 봐요. 말이 자연스러우면 잘 고른 거예요!</p><button class="big-button berry" data-note>${img('ic-stamp.png', 'btn-icon')}낱말 공책에 적기</button>`;
    after.querySelector<HTMLButtonElement>('[data-note]')!.onclick = () => { addNote({w: pick.en.w, n: pick.en.n, k, at: Date.now(), ctx: sentence.slice(0, 160), sense: pick.s.d.slice(0, 160)}); };
  });
  panel.querySelector<HTMLButtonElement>('[data-hunt]')!.onclick = () => { location.hash = 'list=' + encodeList('글 속 낱말', [word]); };
  panel.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
function addNote(item: Saved) {
  const i = state.pouch.findIndex(p => p.w === item.w && p.n === item.n);
  const prev = i >= 0 ? state.pouch.splice(i, 1)[0] : {};
  state.pouch.unshift({...prev, ...item}); save();
  chime('ok'); toast('낱말 공책에 적었어요 📒');
}

// ── 낱말 공책: 찾은 낱말로 내 문장 짓기 ──
function sentenceBox(e: Entry, k: number) {
  const mine = state.pouch.find(p => p.w === e.w && p.n === e.n)?.my ?? '';
  return `<div class="my-sentence"><p>${img('bbo-write.png', 'guess-bbo')}<span><b>‘${esc(bare(e.w))}’</b>를 넣어 내 문장을 지어 볼까요?</span></p>
    <textarea maxlength="120" rows="2" placeholder="예: ${esc(exampleStarter(e))}">${esc(mine)}</textarea>
    <button class="big-button honey" data-mine="${k}">낱말 공책에 저장</button></div>`;
}
const exampleStarter = (e: Entry) => e.p === '동사' || e.p === '형용사' ? `오늘 나는 …` : `우리 집 …`;
function wireSentence(e: Entry, k: number) {
  const btn = app.querySelector<HTMLButtonElement>('[data-mine]'); if (!btn) return;
  btn.onclick = () => {
    const text = btn.previousElementSibling as HTMLTextAreaElement, v = text.value.trim();
    if (v.length < 4) return toast('문장을 조금 더 길게 써 볼까요?');
    if (!v.includes(bare(e.w)[0])) return toast(`문장 안에 ‘${bare(e.w)}’(또는 바뀐 모양)를 넣어 볼까요?`);
    addNote({w: e.w, n: e.n, k, at: Date.now(), my: v.slice(0, 120)});
    state.notes = (state.notes ?? 0) + 1; save();
  };
}

const clock = (ms: number) => { const s = Math.floor(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };
setInterval(() => { const t = document.querySelector('.timer'); if (t && hunt) t.textContent = clock(Date.now() - hunt.t0); }, 1000);

// ── 교과서 길: 국어 3-2 나 5단원 「사전으로 여는 세상」 13차시를 이 앱으로 ──
const wordLink = (w: string) => { const base = dict.has(w) ? w : dict.baseForms(w)[0]; const r = base ? mainRow(base) : undefined; return r ? `<a class="rel-word" href="#w/${r.k}">${esc(w)}</a>` : ''; };
const goHref = (to: string) => to.startsWith('list=') ? '#' + to : '#' + to;
function unit5Page(id = '') {
  const cur: Lesson | null = id ? lessonOf(id) : null;
  const path = `<ol class="unit-path">${UNIT5.map(l => `<li><a href="#unit5/${l.id}" class="unit-stop${cur?.id === l.id ? ' on' : ''}"><span class="unit-no">${l.no}</span><span class="unit-title">${esc(l.title)}<small>${esc(l.book)}</small></span></a></li>`).join('')}</ol>`;
  const detail = cur ? `<div class="unit-card">
      <span class="ribbon small">${cur.no}차시</span>
      <h2 class="page-title">${esc(cur.title)}</h2>
      <p class="unit-book">${img('ic-book.png', 'leaf')}${esc(cur.book)}${cur.act ? ` · ${esc(cur.act)}` : ''}</p>
      <p class="bubble unit-goal">${esc(cur.goal)} <em class="code">${cur.code}</em></p>
      <div class="unit-go">${cur.go.map(g => `<a class="big-button ${g.to.startsWith('play') ? 'leaf' : 'honey'}" href="${goHref(g.to)}">${img(g.icon, 'btn-icon')}${esc(g.label)} <span aria-hidden="true">▸</span></a>`).join('')}</div>
      ${cur.words?.length ? `<h3 class="ask">교과서에 나온 낱말 사전에서 찾아보기</h3><div class="rel">${cur.words.map(wordLink).join('')}</div>
      <a class="big-button cream" href="#list=${encodeList(`${cur.no}차시 교과서 낱말`, cur.words.filter(w => dict.has(w) || dict.baseForms(w).length).slice(0, 10))}">${img('ic-hunt.png', 'btn-icon')}이 낱말들로 찾기 놀이</a>` : ''}
    </div>` : `<div class="peek">${img('bbo-read.png', 'peek-bbo')}<p class="bubble">국어 3-2 나<br><b>5. 사전으로 여는 세상</b><br>차시를 골라 봐요!</p></div>
    <p class="tip-text">${img('ic-leaf.png', 'leaf')}차시마다 교과서 쪽수와 바로 할 수 있는 활동을 모아 두었어요. 교과서와 나란히 펴 놓고 함께 써요.</p>`;
  frame({mode: 'unit5', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}교과서 길</span><span>5단원 · 13차시${img('ic-leaf.png', 'leaf flip')}</span></div>${path}`, right: detail});
}

// 7~8차시: 교과서 붙임 11 '사전에 싣는 순서'
function chartPage() {
  const row = (title: string, list: string[]) => `<h3 class="ask">${title}</h3><div class="chart-row">${list.map(c => `<span>${c}</span>`).join('')}</div>`;
  frame({mode: 'unit5', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}사전에 싣는 순서</span><span>7~8차시${img('ic-leaf.png', 'leaf flip')}</span></div>
    ${row('① 첫 자음자', ORDER_CHART.cho)}${row('② 모음자', ORDER_CHART.jung)}${row('③ 받침', ORDER_CHART.jong)}`,
  right: `<div class="hunt-bbo">${img('bbo-magnify.png', 'hunt-bbo-art')}<p class="bubble">첫 자음자가 같으면 <b>모음자</b>,<br>모음자도 같으면 <b>받침</b>을 봐요.<br>받침이 없는 글자가 먼저예요!</p></div>
    <p class="tip-text">${img('ic-leaf.png', 'leaf')}예: ‘하교’와 ‘학문’ — ‘하’에는 받침이 없어서 ‘하교’가 먼저 나와요.</p>
    <div class="unit-go"><a class="big-button honey" href="#play/order">${img('ic-order.png', 'btn-icon')}사전 차례 줄 세우기 ▸</a><a class="big-button leaf" href="#hunt">${img('ic-hunt.png', 'btn-icon')}사전 찾기 놀이 ▸</a><a class="big-button cream" href="#unit5/7">교과서 길로 돌아가기</a></div>`});
}

// 9~10차시: 베리숲 읽기 글(새로 쓴 글) 고르기 → 글 속 낱말 찾기
function storiesPage() {
  frame({mode: 'unit5', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}베리숲 읽기 글</span><span>9~10차시${img('ic-leaf.png', 'leaf flip')}</span></div>
    <div class="hunt-bbo">${img('bbo-read.png', 'hunt-bbo-art')}<p class="bubble">글을 읽다 모르는 낱말이 나오면<br>① 뜻을 <b>짐작</b>하고<br>② <b>사전</b>으로 확인해요!</p></div>`,
  right: `<div class="game-cards">${STORIES.map(s => `<div class="game-card gc-honey"><a class="game-main" href="#read=${encodeText(s.t, s.x)}">${img('ic-read.png', 'game-art')}<span><b>${esc(s.t)}</b><small>${esc(s.x.slice(0, 38))}…</small></span></a></div>`).join('')}</div>
    <a class="big-button cream" href="#unit5/9">교과서 길로 돌아가기</a>`});
}

// 11~12차시: 나만의 국어사전 — 낱말 공책을 사전 쪽처럼 인쇄
async function myDictPage() {
  const list = state.pouch.slice(0, 24);
  const entries = await Promise.all(list.map(p => dict.entry(p.k).catch(() => null)));
  const items = list.map((p, i) => ({p, e: entries[i]})).filter(x => x.e).sort((a, b) => a.p.k - b.p.k);
  const card = ({p, e}: {p: Saved; e: Entry | null}) => `<article class="mydict-entry"><h4>${esc(bare(e!.w))}${dict.same(e!.w).length > 1 ? `<sup>${e!.n}</sup>` : ''}${e!.pr ? ` <span class="pron">[${esc(e!.pr.replace(/ː/g, ':'))}]</span>` : ''} <span class="kind kind-${kindOf(e!.p).color}">${esc(kindOf(e!.p).kid)}</span></h4>
    <p>${esc(p.sense ?? e!.s[0].d)}</p>${p.my ? `<p class="mine">내 문장: ${esc(p.my)}</p>` : e!.s[0].x?.[0] ? `<p class="ex">예: ${esc(e!.s[0].x[0])}</p>` : ''}</article>`;
  frame({mode: 'unit5', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}나만의 국어사전</span><span>${items.length}낱말${img('ic-leaf.png', 'leaf flip')}</span></div>
    ${items.length ? `<p class="tip-text">${img('ic-leaf.png', 'leaf')}<span>낱말 공책에 담은 낱말이 <b>사전 차례대로</b> 정리됐어요. 표제어·발음·낱말 종류·뜻·예문이 들어간 진짜 사전 쪽이에요.</span></p>
      <div class="unit-go"><button class="big-button leaf" data-print>${img('ic-notebook.png', 'btn-icon')}A4로 인쇄하기</button></div>` : `<p class="empty">${img('bbo-sleep.png', 'empty-bbo')}<span>낱말 공책이 비어 있어요.<br>낱말을 찾고 ‘주머니에 담기’를 눌러 모아 보세요.</span></p>`}
    <a class="big-button cream" href="#unit5/11">교과서 길로 돌아가기</a>`,
  right: `<div class="mydict-sheet" id="mydict-sheet"><h3 class="mydict-title">나만의 국어사전</h3>${items.map(card).join('')}</div>`});
  app.querySelector<HTMLButtonElement>('[data-print]')?.addEventListener('click', () => window.print());
}

// 5~6차시: 내가 기준을 정해 나누기(정답 없음 — 기준을 말로 설명하는 것이 목표)
function sortMyGame() {
  const words = shuffle(['기쁨', '슬픔', '사랑', '두려움', '설레다', '괴롭다', '흐르다', '초콜릿', '침대', ...shuffle([...TEXTBOOK_SORT.name]).slice(0, 3)]).slice(0, 10);
  const names = ['', ''], placed = new Map<string, number>(); let picked: string | null = null, named = false;
  const draw = () => {
    const left = words.filter(w => !placed.has(w));
    if (!named) {
      frame({mode: 'play-sort', left: gameHead('내 기준으로 나누기', '[4국04-02]', '낱말을 두 무리로 나눌<br><b>기준</b>을 정해 봐요!', 'bbo-think.png') + `<div class="sort-cards">${words.map(w => `<span class="word-chip">${esc(w)}</span>`).join('')}</div>`,
        right: `<p class="tip-text">${img('ic-leaf.png', 'leaf')}예: ‘마음을 나타내는 말 / 물건을 나타내는 말’, ‘-다로 끝나는 말 / 아닌 말’</p>
          <label class="field">첫째 바구니 이름<input id="b0" maxlength="16" placeholder="예: 마음을 나타내는 말"></label>
          <label class="field">둘째 바구니 이름<input id="b1" maxlength="16" placeholder="예: 물건을 나타내는 말"></label>
          <div class="next-row"><button class="big-button leaf" data-start>나누기 시작 ▸</button></div>`});
      app.querySelector<HTMLButtonElement>('[data-start]')!.onclick = () => {
        names[0] = app.querySelector<HTMLInputElement>('#b0')!.value.trim(); names[1] = app.querySelector<HTMLInputElement>('#b1')!.value.trim();
        if (!names[0] || !names[1]) return toast('바구니 이름을 두 개 모두 적어 주세요.');
        named = true; chime('ok'); draw();
      };
      return;
    }
    const baskets = `<div class="baskets two">${names.map((n, i) => `<button class="basket bk-${i ? 'sky' : 'berry'}" data-basket="${i}">${img('ic-basket.png', 'basket-art')}<b>${esc(n)}</b><span class="in">${words.filter(w => placed.get(w) === i).map(w => `<i>${esc(w)}</i>`).join('')}</span></button>`).join('')}</div>`;
    frame({mode: 'play-sort', left: gameHead('내 기준으로 나누기', '[4국04-02]', left.length ? (picked ? `‘${esc(picked)}’는 어느 바구니?` : '낱말을 누르고 바구니를 눌러요!') : '다 나누었어요!<br>왜 그렇게 나눴는지<br><b>친구에게 말해 봐요</b>.', 'bbo-basket.png') + `<div class="sort-cards">${left.map(w => `<button class="word-chip${picked === w ? ' on' : ''}" data-card="${esc(w)}">${esc(w)}</button>`).join('')}</div>`,
      right: baskets + (left.length ? `<p class="tip-text">${img('ic-leaf.png', 'leaf')}정답은 없어요. 내가 정한 기준에 맞게 나누면 돼요. 헷갈리는 낱말은 사전에서 뜻을 찾아봐요.</p>` : gameDone('sort-my', words))});
    wireAgain();
    app.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(b => b.onclick = () => { chime(); picked = b.dataset.card!; draw(); });
    app.querySelectorAll<HTMLButtonElement>('[data-basket]').forEach(b => b.onclick = () => { if (!picked) return toast('먼저 낱말을 골라요.'); placed.set(picked, +b.dataset.basket!); picked = null; chime('ok'); draw(); });
  };
  draw();
}

// 1차시·11~12차시: 세 가지 단서 낱말 맞히기(단서를 적게 보고 맞힐수록 열매 별이 많아요)
async function clueGame(n = 5) {
  const pool = shuffle(huntPool().filter(r => r.p !== '의존 명사')).slice(0, 60);
  const qs: ReturnType<typeof clueOf>[] = [];
  for (const r of pool) {
    if (qs.length === n) break;
    const e = await dict.entry(r.k).catch(() => null); if (!e) continue;
    const w = bare(e.w), def = e.s[0]?.d ?? '';
    if (!def || def.length > 70) continue;
    const others = shuffle(huntPool().filter(x => x.p === r.p && bare(x.w) !== w && x.w.length === r.w.length)).slice(0, 3).map(x => bare(x.w));
    if (others.length < 3) continue;
    qs.push(clueOf(w, kindOf(e.p).kid, def, CHO[split(w[0])!.cho], others));
  }
  if (!qs.length) return playHub();
  let i = 0, shown = 1, score = 0; const words: string[] = [];
  const draw = (solved = false) => {
    const q = qs[i], done = i >= qs.length;
    if (done) { frame({mode: 'play-clue', left: gameHead('세 가지 단서', '[4국04-02]', `열매 별 <b>${score}</b>개를 모았어요!`, 'bbo-cheer.png'), right: gameDone('clue', words)}); wireAgain(); return; }
    frame({mode: 'play-clue', left: gameHead(`세 가지 단서 ${i + 1}/${qs.length}`, '[4국04-02]', '단서를 보고<br>어떤 낱말인지 맞혀 봐요!', 'bbo-think.png') +
      `<ol class="clue-list">${q.clues.map((c, j) => `<li class="${j < shown ? 'open' : 'closed'}">${j < shown ? `<b>단서 ${j + 1}</b> ${esc(c)}` : `<b>단서 ${j + 1}</b> ?`}</li>`).join('')}</ol>
      ${!solved && shown < 3 ? `<button class="big-button cream" data-more>단서 하나 더 보기</button>` : ''}
      <p class="tip-text">${img('ic-leaf.png', 'leaf')}<span>단서 1개로 맞히면 별 3개, 2개면 2개, 3개면 1개예요. 모은 별 <b>${score}</b>개</span></p>`,
    right: `<h3 class="ask">이 낱말은 무엇일까요?</h3><div class="choice-grid wide">${q.options.map(o => `<button class="choice${solved && o === q.word ? ' right' : ''}" data-ans="${esc(o)}" ${solved ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
      ${solved ? `<div class="next-row">${wordLink(q.word)}<button class="big-button leaf" data-next>${i + 1 < qs.length ? '다음 문제 ▸' : '다 했어요!'}</button></div>` : ''}`});
    app.querySelector<HTMLButtonElement>('[data-more]')?.addEventListener('click', () => { shown++; chime(); draw(); });
    app.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.onclick = () => {
      if (b.dataset.ans === q.word) { score += 4 - shown; words.push(q.word); shown = 3; chime('ok'); return draw(true); }
      chime('no'); shake(b);
      if (shown < 3) { shown++; toast('아쉬워요! 단서를 하나 더 보여 줄게요.'); draw(); } else toast('다른 낱말을 골라 봐요.');
    });
    app.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { i++; shown = 1; draw(); });
  };
  draw();
}

// 11~12차시: 아이가 단서 문제를 내고 친구에게 보여 주기(서버에 저장하지 않음)
function clueMake() {
  frame({mode: 'play-clue', left: gameHead('단서 문제 내기', '[4국04-02]', '사전에서 낱말을 찾아<br>단서 <b>세 가지</b>를 만들어 봐요!', 'bbo-write.png') +
    `<p class="tip-text">${img('ic-leaf.png', 'leaf')}단서는 ① 뜻 ② 낱말의 종류 ③ 첫 자음이나 글자 수처럼, 점점 쉬워지게 써요.</p>`,
  right: `<label class="field">정답 낱말<input id="c-word" maxlength="12" placeholder="예: 우산"></label>
    <label class="field">단서 1(가장 어렵게)<input id="c1" maxlength="60" placeholder="예: 비가 올 때 펴서 써요."></label>
    <label class="field">단서 2<input id="c2" maxlength="60" placeholder="예: 이름을 나타내는 말이에요."></label>
    <label class="field">단서 3(가장 쉽게)<input id="c3" maxlength="60" placeholder="예: ‘ㅇ’으로 시작하는 두 글자예요."></label>
    <div class="next-row"><button class="big-button cream" data-check>사전에서 확인</button><button class="big-button leaf" data-show>친구에게 문제 내기 ▸</button></div><div class="clue-check"></div>`});
  const v = (id: string) => app.querySelector<HTMLInputElement>('#' + id)!.value.trim();
  app.querySelector<HTMLButtonElement>('[data-check]')!.onclick = async () => {
    const w = v('c-word'), box = app.querySelector<HTMLDivElement>('.clue-check')!;
    const r = dict.same(w)[0] ?? dict.same(dict.baseForms(w)[0] ?? '')[0];
    if (!r) { box.innerHTML = `<p class="tip-text">‘${esc(w)}’는 사전에서 찾지 못했어요. 기본형으로 써 볼까요?</p>`; return; }
    const e = await dict.entry(r.k);
    box.innerHTML = `<p class="tip-text">${img('ic-book.png', 'leaf')}사전 뜻: ${esc(e.s[0].d)} <span class="kind kind-${kindOf(e.p).color}">${esc(kindOf(e.p).kid)}</span></p>`;
  };
  app.querySelector<HTMLButtonElement>('[data-show]')!.onclick = () => {
    const w = v('c-word'), clues = [v('c1'), v('c2'), v('c3')];
    if (!w || clues.some(c => !c)) return toast('정답과 단서 세 개를 모두 적어 주세요.');
    let shown = 1, open = false;
    const show = () => {
      frame({mode: 'play-clue', left: gameHead('친구에게 문제 내기', '[4국04-02]', '단서를 하나씩 열어 주세요!', 'bbo-cheer.png') + `<ol class="clue-list big">${clues.map((c, j) => `<li class="${j < shown ? 'open' : 'closed'}"><b>단서 ${j + 1}</b> ${j < shown ? esc(c) : '?'}</li>`).join('')}</ol>`,
        right: `<div class="unit-go">${shown < 3 ? '<button class="big-button cream" data-more>다음 단서 열기</button>' : ''}<button class="big-button leaf" data-open>${open ? `정답: ${esc(w)}` : '정답 보기'}</button>${open ? wordLink(w) : ''}<a class="big-button honey" href="#play/clue-make">새 문제 만들기</a></div>`});
      app.querySelector<HTMLButtonElement>('[data-more]')?.addEventListener('click', () => { shown++; chime(); show(); });
      app.querySelector<HTMLButtonElement>('[data-open]')!.onclick = () => { open = true; chime('ok'); show(); };
    };
    show();
  };
}

// 13차시: 마무리 도전 — 사전에서 얻는 정보, 동형이의어·다의어, 소리 나는 대로 읽기, 기본형, 사전 차례
function wrapGame() {
  let i = 0, right = 0, tried = false;
  const draw = (solved = false) => {
    if (i >= WRAP_QUIZ.length) { frame({mode: 'play-wrap', left: gameHead('5단원 마무리 도전', '[4국04-02]', `${WRAP_QUIZ.length}문제 중 <b>${right}</b>문제를<br>한 번에 맞혔어요!`, 'bbo-cheer.png'), right: gameDone('wrap', WRAP_QUIZ.map(q => q.word ?? '').filter(Boolean))}); wireAgain(); return; }
    const q = WRAP_QUIZ[i];
    frame({mode: 'play-wrap', left: gameHead(`5단원 마무리 도전 ${i + 1}/${WRAP_QUIZ.length}`, '[4국04-02]', '배운 것을<br>정리해 봐요!', 'bbo-think.png') + (solved ? `<p class="tip-text big">${img('ic-leaf.png', 'leaf')}${esc(q.why)}</p>` : ''),
      right: `<h3 class="ask">${q.q}</h3><div class="choice-grid wide">${q.options.map((o, j) => `<button class="choice${solved && j === q.a ? ' right' : ''}" data-ans="${j}" ${solved ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
        ${solved ? `<div class="next-row">${q.word ? wordLink(q.word) : ''}<button class="big-button leaf" data-next>${i + 1 < WRAP_QUIZ.length ? '다음 문제 ▸' : '다 했어요!'}</button></div>` : ''}`});
    app.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.onclick = () => {
      if (+b.dataset.ans! === q.a) { if (!tried) right++; chime('ok'); return draw(true); }
      tried = true; chime('no'); shake(b); toast('다시 생각해 봐요!');
    });
    app.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { i++; tried = false; draw(); });
  };
  draw();
}

// ── 길 찾기 ──
async function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('w/')) return wordPage(+h.slice(2));
  if (h.startsWith('browse/')) return browse(h.slice(7));
  if (h === 'hunt') { if (!hunt || hunt.listTitle) await startHunt(); else huntView(); return; }
  if (h.startsWith('list=')) { const l = decodeList(h.slice(5)); if (!l) { toast('목록 주소가 망가졌어요.'); return home(); } return startHunt(l.words, l.title); }
  if (h === 'pouch') return pouch();
  if (h === 'teacher') return teacher();
  if (h === 'read') return readPage();
  if (h.startsWith('read=')) return readPage(h.slice(5));
  if (h === 'unit5') return unit5Page();
  if (h.startsWith('unit5/')) return unit5Page(h.slice(6));
  if (h === 'chart') return chartPage();
  if (h === 'stories') return storiesPage();
  if (h === 'mydict') return myDictPage();
  if (h === 'try-base') { await home(); app.querySelector<HTMLButtonElement>('[data-try]')?.click(); return; }
  if (h === 'play') return playHub();
  if (h.startsWith('play/')) return playGame(h.slice(5));
  return home();
}
app.innerHTML = `<div class="loading">${img('bbo-read.png', 'loading-bbo')}<p>사전을 펼치는 중…</p></div>`;
dict.load().then(() => { window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#hunt')) hunt = location.hash.startsWith('#list=') ? hunt : null; route(); }); route(); })
  .catch(() => { app.innerHTML = `<div class="loading">${img('bbo-sleep.png', 'loading-bbo')}<p>사전을 펼치지 못했어요. 인터넷을 확인하고 새로고침해 주세요.</p></div>`; });

declare global { interface Window { __dict?: Dictionary } }
window.__dict = dict;
void [JONG];
