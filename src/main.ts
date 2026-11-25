import './style.css';
import {Dictionary, KIND, RELATION, LEVEL, type Entry, type Row} from './dict';
import {BASIC_CHO, CHO, JUNG, JONG, split, join, bare, firstLetterSteps} from './hangul';
import {loadState, saveState, inPouch, togglePouch, stampFound, encodeList, decodeList, daySeed} from './store';
import {pickHuntTargets, findChangedForm, type HuntTarget} from './hunt';

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
    const t = audio.currentTime, notes = kind === 'ok' ? [784, 988, 1319] : kind === 'no' ? [330, 262] : [660];
    notes.forEach((f, i) => {
      const o = audio!.createOscillator(), g = audio!.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audio!.destination);
      const s = t + i * 0.09; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.18, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
      o.start(s); o.stop(s + 0.25);
    });
  } catch { /* 소리를 못 내는 기기 */ }
}
function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return toast('이 기기는 읽어 주기를 지원하지 않아요.');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find(v => v.lang?.startsWith('ko')); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { toast('읽어 주기를 할 수 없어요.'); }
}
function toast(msg: string) {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.append(el); setTimeout(() => el.classList.add('show'), 10); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2200);
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
  const nav = [['', '찾기', 'ic-magnify.png'], ['hunt', '찾기 놀이', 'ic-book.png'], ['pouch', '낱말 주머니', 'ic-pouch.png']];
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
    <nav class="menu" aria-label="메뉴">${nav.map(([to, label, icon]) => `<a href="#${to}" class="menu-item${v.mode === (to || 'home') || (to === '' && ['word', 'browse', 'search'].includes(v.mode)) ? ' on' : ''}">${img(icon, 'menu-icon')}<span>${label}</span></a>`).join('')}</nav>
    <footer class="credit">낱말 자료: <a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전</a>(국립국어원, <a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a>) · 기록은 이 기기에만 저장돼요 · <a href="#teacher">선생님 낱말 목록 만들기</a></footer>
  </div>`;
  app.querySelectorAll<HTMLButtonElement>('[data-cho]').forEach(b => b.onclick = () => { chime(); location.hash = 'browse/' + b.dataset.cho; });
  app.querySelector<HTMLButtonElement>('.sound-toggle')!.onclick = () => { state.sound = !state.sound; save(); route(); };
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
    box.innerHTML = (hints.length ? `<div class="hint-card">${img('bbo-think.png', 'hint-bbo')}<p><b>‘${esc(q)}’</b>는 모양이 바뀐 말이에요. 사전에는 <b>기본형</b>으로 실려 있어요.</p><div class="hint-words">${hints.map(h => `<button data-go="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>` : '')
      + (rows.length ? `<ol class="result-list">${rows.map(rowItem).join('')}</ol>` : (hints.length ? '' : `<p class="empty">${img('bbo-think.png', 'empty-bbo')}<span>‘${esc(q)}’는 아직 사전에서 못 찾았어요.<br>글자를 다시 살펴볼까요?</span></p>`));
    box.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b => b.onclick = () => { input.value = b.dataset.go!; render(); goFirst(b.dataset.go!); });
  };
  let timer = 0;
  input.oninput = () => { clearTimeout(timer); timer = window.setTimeout(render, 120); };
  form.onsubmit = e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; const exact = dict.same(q); if (exact.length) return goFirst(q); const r = dict.search(q, 1); if (r.length && !dict.baseForms(q).length) location.hash = 'w/' + r[0].k; else render(); };
  if (input.value) render();
}
function goFirst(w: string) { const s = dict.same(w); if (s.length) { chime(); location.hash = 'w/' + s[0].k; } }
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
    <a class="big-button leaf" href="#hunt">${img('ic-book.png', 'btn-icon')}사전 찾기 놀이 <span aria-hidden="true">▸</span></a>`,
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
function wordCard(e: Entry, k: number) {
  const kind = kindOf(e.p), saved = inPouch(state, e.w, e.n), homonyms = dict.same(e.w).length > 1;
  const rels = (s: Entry['s'][number]) => RELATION.filter(([key]) => (s[key] as string[] | undefined)?.length).map(([key, label]) => `<div class="rel"><span class="rel-label rel-${String(key)}">${label}</span>${(s[key] as string[]).map(w => `<button class="rel-word" data-go="${esc(w)}">${esc(w)}</button>`).join('')}</div>`).join('');
  const quizSenses = e.s.map((s, i) => ({i, x: s.x?.[0]})).filter(q => q.x);
  return `<article class="word-card">
    <div class="card-tags"><span class="kind kind-${kind.color}">${esc(kind.kid)}</span><span class="pos">${esc(e.p || e.u)}</span>${e.lv ? `<span class="lv lv-${e.lv}">${LEVEL[e.lv]}</span>` : ''}</div>
    <h2 class="headword">${esc(bare(e.w))}${homonyms ? `<sup>${e.n}</sup>` : ''}${img('ic-sparkle.png', 'head-sparkle')}</h2>
    <div class="pron">${e.pr ? `<span>[${esc(e.pr.replace(/ː/g, ':'))}]</span>` : ''}<button class="speak" data-say="${esc(bare(e.w))}" aria-label="소리 듣기">${img('ic-speaker.png', 'speak-icon')}</button>${e.o ? `<span class="origin">한자 ${esc(e.o)}</span>` : ''}</div>
    <div class="guess" hidden>
      <p>${img('bbo-think.png', 'guess-bbo')}<span>뜻을 먼저 짐작해 볼까요? 생각한 뜻을 적어 보세요.</span></p>
      <textarea maxlength="120" rows="2" placeholder="내가 짐작한 뜻"></textarea>
      <button class="big-button honey" data-reveal>사전 뜻과 견주어 보기</button>
    </div>
    <div class="meanings">
      <div class="my-guess" hidden></div>
      <ol class="senses">${e.s.map((s, i) => `<li><span class="sense-no">${i + 1}</span><div><p class="def">${esc(s.d)}</p>${s.x ? s.x.slice(0, 2).map(x => `<p class="ex"><span class="ex-tag">예문</span><span>${highlight(x, e.w)}</span></p>`).join('') : ''}${s.t ? `<p class="ex talk"><span class="ex-tag">대화</span><span>${s.t.map(t => highlight(t, e.w)).join('<br>')}</span></p>` : ''}${rels(s)}</div></li>`).join('')}</ol>
    </div>
    <div class="card-actions">
      <button class="big-button berry" data-pouch aria-pressed="${saved}">${img('ic-stamp.png', 'btn-icon')}${saved ? '주머니에 담았어요' : '주머니에 담기'}</button>
      <button class="big-button cream" data-guess>${img('bbo-think.png', 'btn-icon')}뜻 가리고 짐작하기</button>
      ${quizSenses.length >= 2 ? `<button class="big-button cream" data-quiz>${img('ic-sparkle.png', 'btn-icon')}맞는 뜻 고르기</button>` : ''}
    </div>
    <div class="quiz" hidden></div>
    ${e.a ? `<p class="note">${esc(e.a)}</p>` : ''}
  </article>`;
}
function wireCard(e: Entry, k: number) {
  app.querySelectorAll<HTMLButtonElement>('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say!));
  app.querySelectorAll<HTMLButtonElement>('.rel-word').forEach(b => b.onclick = () => { const s = dict.same(b.dataset.go!); if (s.length) { chime(); location.hash = 'w/' + s[0].k; } else toast('‘' + b.dataset.go + '’는 이 사전에 없어요.'); });
  const pouch = app.querySelector<HTMLButtonElement>('[data-pouch]')!;
  pouch.onclick = () => { const added = togglePouch(state, {w: e.w, n: e.n, k, at: Date.now()}); save(); chime(added ? 'ok' : 'pop'); if (added) toast('낱말 주머니에 담았어요 🍓'); route(); };
  const guess = app.querySelector<HTMLDivElement>('.guess')!, meanings = app.querySelector<HTMLDivElement>('.meanings')!;
  app.querySelector<HTMLButtonElement>('[data-guess]')!.onclick = () => { guess.hidden = false; meanings.hidden = true; guess.querySelector('textarea')!.focus(); };
  guess.querySelector<HTMLButtonElement>('[data-reveal]')!.onclick = () => {
    const text = guess.querySelector('textarea')!.value.trim();
    guess.hidden = true; meanings.hidden = false;
    const mine = meanings.querySelector<HTMLDivElement>('.my-guess')!;
    mine.hidden = !text; mine.innerHTML = `<span class="ex-tag">내 짐작</span><span>${esc(text)}</span><em>사전 뜻과 어디가 같고 다른지 견주어 보세요!</em>`;
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
      else { b.classList.add('wrong'); chime('no'); toast('다시 읽어 볼까요? 문장 속 뜻을 살펴봐요.'); }
    });
    box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  };
}
async function wordPage(k: number) {
  if (!(k >= 0 && k < dict.rows.length)) return home();
  const e = await dict.entry(k);
  const size = 10, {rows, start} = pageList(k, size), [g1, g2] = guideOf(rows);
  const steps = firstLetterSteps(e.w);
  frame({mode: 'word', tab: steps ? BASIC_CHO.find(c => c === steps.cho) ?? baseCho(steps.cho) : undefined,
    left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}${esc(g1)}</span><span>${esc(g2)}${img('ic-leaf.png', 'leaf flip')}</span></div>
      ${searchBox()}
      <ol class="page-words">${rows.map(r => rowItem(r, k)).join('')}</ol>
      ${pageNav(start, size, 'w')}`,
    right: `<div class="guide-words right"><span></span><span>${esc(bare(e.w))}${img('ic-leaf.png', 'leaf flip')}</span></div>${wordCard(e, k)}`});
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
  return dict.rows.filter(r => (r.lv === 1 || r.lv === 2) && ['명사', '동사', '형용사'].includes(r.p) && !/[-\s^]/.test(r.w) && r.w.length >= 2 && r.w.length <= 4 && (BASIC_CHO as readonly string[]).includes(CHO[split(r.w[0])?.cho ?? 99] ?? ''));
}
type Hunt = {targets: HuntTarget[]; i: number; step: number; form?: string | null; sentence?: string; listTitle?: string; page?: number; mistakes: number};
let hunt: Hunt | null = null;
async function startHunt(words?: string[], title?: string) {
  const targets = words ? words.map(w => { const s = dict.same(w); const base = s.length ? w : dict.baseForms(w)[0]; const r = base ? dict.same(base)[0] : undefined; return r ? {row: r, given: w} : null; }).filter(Boolean) as HuntTarget[] : pickHuntTargets(huntPool(), 5, Math.random);
  if (!targets.length) { toast('사전에서 찾을 수 있는 낱말이 없어요.'); location.hash = ''; return; }
  hunt = {targets, i: 0, step: 0, mistakes: 0, listTitle: title};
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
    left = head + bbo('bbo-think.png', '사전에는 모양이 바뀌지 않은<br><b>기본형</b>으로 실려 있어요!');
    right = `${huntSteps(h)}<h3 class="ask">‘${esc(h.form!)}’의 기본형은 무엇일까요?</h3><div class="choice-grid wide">${opts.map(o => `<button class="choice" data-ans="${esc(o)}">${esc(o)}</button>`).join('')}</div><p class="tip-text">${img('ic-leaf.png', 'leaf')}움직임이나 성질을 나타내는 말은 ‘-다’를 붙인 모양으로 찾아요.</p>`;
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
    left = head + bbo('bbo-read.png', second ? `‘${esc(s.syllable)}’ 다음 글자가<br>‘${CHO[second.cho]}’로 시작하는 쪽이에요.<br>머리 낱말을 보고 쪽을 넘겨요!` : `‘${esc(s.syllable)}’ 쪽을 펼쳤어요!<br>머리 낱말을 보고 쪽을 넘겨 찾아요.`);
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
  if (h.mistakes >= 2) toast(hints[h.step]); else toast('다시 한번 살펴볼까요?');
}
async function pickWord(b: HTMLButtonElement, k: number) {
  const h = hunt!, t = h.targets[h.i].row;
  if (k !== t.k && bare(dict.rows[k].w) !== bare(t.w)) { chime('no'); b.classList.add('wrong'); toast('이 낱말이 아니에요. 머리 낱말을 보고 쪽을 넘겨 봐요.'); return; }
  b.classList.add('right'); chime('ok'); confetti();
  const fresh = stampFound(state, t.w); save();
  const e = await dict.entry(t.k), done = h.i + 1 >= h.targets.length;
  const right = app.querySelector<HTMLElement>('.page-right')!, left = app.querySelector<HTMLElement>('.page-left')!;
  left.innerHTML = `<div class="found">${img('bbo-cheer.png', 'found-bbo')}<p class="bubble big">찾았다!</p>${fresh ? `<p class="stamp-get">${img('ic-stamp.png', 'stamp big')}낱말 도장 하나!</p>` : ''}</div>`;
  right.innerHTML = `${wordCard(e, t.k)}<div class="next-row">${done ? `<a class="big-button leaf" href="#">다 찾았어요! 첫 화면으로</a><button class="big-button honey" data-again>한 번 더 놀기</button>` : `<button class="big-button leaf" data-next>다음 낱말 찾기 ▸</button>`}</div>`;
  wireCard(e, t.k);
  right.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', async () => { h.i++; await prepareRound(); huntView(); });
  right.querySelector<HTMLButtonElement>('[data-again]')?.addEventListener('click', () => startHunt(h.listTitle ? h.targets.map(x => x.given ?? x.row.w) : undefined, h.listTitle));
  right.scrollTo(0, 0);
}
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── 낱말 주머니 ──
function pouch() {
  const list = state.pouch;
  frame({mode: 'pouch', left: `<div class="guide-words"><span>${img('ic-leaf.png', 'leaf')}낱말 주머니</span><span>${list.length}개${img('ic-leaf.png', 'leaf flip')}</span></div>
    ${list.length ? `<ol class="page-words pouch-list">${list.map(p => `<li><a class="row" href="#w/${p.k}"><b>${esc(bare(p.w))}</b><span class="date">${new Date(p.at).toLocaleDateString('ko-KR', {month: 'long', day: 'numeric'})}</span></a></li>`).join('')}</ol>` : `<p class="empty">${img('bbo-sleep.png', 'empty-bbo')}<span>아직 주머니가 비어 있어요.<br>낱말을 찾고 ‘주머니에 담기’를 눌러 보세요.</span></p>`}`,
  right: `<div class="pouch-big">${img('ic-pouch.png', 'pouch-art big')}<p class="bubble">찾은 낱말 도장 <b>${state.stamps}</b>개<br>짐작해 본 뜻 <b>${state.guesses}</b>번</p></div>
    <div class="stamp-board" aria-label="낱말 도장판">${Array.from({length: 30}, (_, i) => img(i < state.stamps ? 'ic-stamp.png' : 'ic-stamp-empty.png', 'stamp')).join('')}</div>
    ${state.stamps >= 30 ? '<p class="tip-text">도장판을 다 채웠어요! 정말 멋진 사전 탐험가예요 🎉</p>' : `<p class="tip-text">${img('ic-leaf.png', 'leaf')}찾기 놀이에서 새 낱말을 찾으면 도장을 받아요.</p>`}
    <a class="big-button leaf" href="#hunt">${img('ic-book.png', 'btn-icon')}찾기 놀이 하러 가기</a>`});
}

// ── 선생님 낱말 목록 ──
function teacher() {
  frame({mode: 'teacher', left: `<h2 class="page-title">선생님 낱말 목록 만들기</h2>
    <p class="tip-text">이번 주에 배울 낱말을 한 줄에 하나씩 적으면, 아이들이 그 낱말로 찾기 놀이를 하는 주소가 만들어져요. 낱말은 서버에 저장하지 않고 주소 안에만 담겨요.</p>
    <label class="field">목록 이름<input id="list-title" maxlength="30" value="이번 주 낱말"></label>
    <label class="field">낱말(최대 30개)<textarea id="list-words" rows="8" placeholder="다정하다\n씩씩하다\n먹었어요"></textarea></label>
    <button class="big-button leaf" id="make-list">주소 만들기</button>`,
  right: `<div class="check-list"><p class="tip-text">${img('bbo-read.png', 'hint-bbo')}낱말을 적으면 사전에 있는지 바로 살펴 드려요.</p></div><div class="share" hidden></div>`});
  const area = app.querySelector<HTMLTextAreaElement>('#list-words')!, out = app.querySelector<HTMLDivElement>('.check-list')!, share = app.querySelector<HTMLDivElement>('.share')!;
  const check = () => {
    const words = [...new Set(area.value.split(/[\n,]+/).map(w => w.trim()).filter(Boolean))].slice(0, 30);
    out.innerHTML = words.length ? `<ol class="page-words">${words.map(w => { const ok = dict.has(w), base = ok ? [] : dict.baseForms(w); return `<li><span class="row"><b>${esc(w)}</b>${ok ? '<span class="kind kind-leaf">사전에 있어요</span>' : base.length ? `<span class="kind kind-honey">기본형 ‘${esc(base[0])}’로 찾아요</span>` : '<span class="kind kind-berry">사전에 없어요</span>'}</span></li>`; }).join('')}</ol>` : '';
    return words;
  };
  area.oninput = check;
  app.querySelector<HTMLButtonElement>('#make-list')!.onclick = () => {
    const words = check().filter(w => dict.has(w) || dict.baseForms(w).length);
    if (!words.length) return toast('사전에서 찾을 수 있는 낱말을 적어 주세요.');
    const url = location.origin + location.pathname + '#list=' + encodeList(app.querySelector<HTMLInputElement>('#list-title')!.value || '선생님 낱말', words);
    share.hidden = false;
    share.innerHTML = `<p class="tip-text">아래 주소를 아이들에게 보내 주세요.</p><input class="share-url" readonly value="${esc(url)}"><button class="big-button honey" id="copy">주소 복사하기</button><a class="big-button cream" href="${esc(url)}">미리 해 보기</a>`;
    share.querySelector<HTMLButtonElement>('#copy')!.onclick = async () => { try { await navigator.clipboard.writeText(url); toast('주소를 복사했어요.'); } catch { share.querySelector<HTMLInputElement>('.share-url')!.select(); toast('주소를 길게 눌러 복사해 주세요.'); } };
  };
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
  return home();
}
app.innerHTML = `<div class="loading">${img('bbo-read.png', 'loading-bbo')}<p>사전을 펼치는 중…</p></div>`;
dict.load().then(() => { window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#hunt')) hunt = location.hash.startsWith('#list=') ? hunt : null; route(); }); route(); })
  .catch(() => { app.innerHTML = `<div class="loading">${img('bbo-sleep.png', 'loading-bbo')}<p>사전을 펼치지 못했어요. 인터넷을 확인하고 새로고침해 주세요.</p></div>`; });

declare global { interface Window { __dict?: Dictionary } }
window.__dict = dict;
void [JONG];
