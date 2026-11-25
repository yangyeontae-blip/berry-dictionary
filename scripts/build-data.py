"""한국어기초사전 XML(국립국어원, CC BY-SA 2.0 KR) -> 웹용 JSON 조각.
출력: public/data/index.json (검색 목록), public/data/e/<n>.json (뜻 조각, 500단어씩)
"""
import json, glob, os, re, io, sys, xml.etree.ElementTree as ET
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, OUT = os.path.join(ROOT, 'raw'), os.path.join(ROOT, 'public', 'data')
LV = {'초급': 1, '중급': 2, '고급': 3}
REL = {'비슷한말': 's', '유의어': 's', '반대말': 'a', '높임말': 'h', '낮춤말': 'l', '큰말': 'b', '작은말': 'm', '센말': 'f', '여린말': 'w', '준말': 'j', '본말': 'o', '참고어': 'r'}

# 한국어기초사전은 어른 학습자용이라 술·결혼·이혼·담배 같은 예문이 많다. 초등학생 화면에는 이런 예문을 싣지 않는다.
ADULT = re.compile(r'(남편|아내|부부|결혼|이혼|신혼|연애|애인|데이트|남자 ?친구|여자 ?친구|키스|(?<![가-힣])술(?![래술])|소주|맥주|양주|와인|막걸리|칵테일|폭탄주|술에 취|만취|숙취|담배|흡연|담뱃|마약|도박|노름|임신|출산|성관계|섹스|성적인|성폭|성희롱|자살|살인|살해|시체|불륜|바람을 피|바람둥이|맞선|며느리|시어머니|시아버지|시댁|장모|장인어른|사위|회식|월급|대출|빚|(부장|과장|대리|사장|차장)님|[김이박최정] (부장|과장|대리|사장|차장)|총을|총으로|총에 맞|칼로 찌|죽였|피투성|조폭|감옥|교도소|범죄|유흥|룸살롱|(?<!친구를 )(?<!친구와 )(?<!친구들을 )(?<!친구들과 )사귀|소개팅|짝사랑|고백|끌어안|뽀뽀|다이어트|살을 빼|주식|투자|성형|장례|사망|숨을 거두|돌아가셨|군대|입대|제대|전쟁|이별|헤어졌|헤어지자|매춘|매음|창녀|포주|윤락|성매매|강간|성추행|추행|기생집|기생[은이을들]|화대|목을 매|목매|스스로 목숨|피를 흘리며 쓰러|칼에 찔|칼로 심장|칼에 심장|폭행|폭력|잔인|범행|범인|징역|혐의|구속|체포|살인|납치|협박|학대|자해|피투성이|시신|유골|총살|사형|마피아|깡패|몸을 팔|미성년자를 팔|여자를 팔|여성을 팔|칼로 .{0,10}찔|사정없이 찔|주먹으로 얼굴|몽둥이|뺨을 (친|때|맞)|두들겨 패|가죽을 벗|아이를 (치|쳐)|콧날|피가 흐르|피를 흘|맞아 죽|때려|싸움을 걸|귀신|유령|시체)')
# 뜻 자체가 아이에게 맞지 않으면(몸을 팔다 등) 그 뜻을 예문째 뺀다.
SENSE_BAD = re.compile(r'(윤락|몸이나 얼굴을 돈벌이|몸을 팔|매춘|매음|성적|성행위|성교|성관계|간음|술을 마시|술에 취|도박|마약|자살|살해|목숨을 끊|노름)')
# 아이 화면에서는 어른 직장 예문을 뒤로 보낸다(다른 예문이 없을 때만 남김).
WORK = re.compile(r'(회사|직장|출근|퇴근|면접|부도|어음|사장|부장|과장|대리|승진|연봉|사업|거래처|계약|은행|세금|월세|전세|정치|선거)')
def kid_first(xs):
    return sorted(xs, key=lambda x: 1 if WORK.search(x) else 0)
# 낱말 자체가 아이 놀이(찾기 놀이·오늘의 낱말·놀이터)에 어울리지 않으면 표시한다. 검색해서 찾아보는 것은 그대로 된다.
ADULT_WORD = re.compile(r'((?<![가-힣])술(?![래술])|담배|마약|도박|자살|살인|이혼|임신|성교|성기|성적인|유흥|매춘|불륜|연애|애인|흡연|시체|범죄|감옥|교도소|야하|강간|매음|창녀|포주|화대|성매매|윤락|추행|폭행|폭력|학대|납치|사형|승진|직장|회사원|월급|주식|정치|선거|세금|대출)')
clean = lambda xs: [x for x in xs if not ADULT.search(x)]

def feats(el):
    d = {}
    for f in el.findall('feat'):
        d.setdefault(f.get('att'), []).append(f.get('val') or '')
    return d

entries = []
files = sorted(glob.glob(os.path.join(RAW, '*.xml')), key=lambda p: int(os.path.basename(p)[:-4]))
for path in files:
    # 30000.xml 등 외국어 대역에 맨 '<'가 섞여 있어 속성값 안의 '<'만 고쳐 읽는다.
    text = open(path, encoding='utf-8').read()
    text = re.sub(r'val="([^"]*)"', lambda m: 'val="' + m.group(1).replace('<', '&lt;') + '"', text)
    for _, el in ET.iterparse(io.BytesIO(text.encode('utf-8'))):
        if el.tag != 'LexicalEntry':
            continue
        f = feats(el)
        lemma = el.find('Lemma')
        lf = feats(lemma) if lemma is not None else {}
        word = (lf.get('writtenForm') or [''])[0].strip()
        if not word:
            el.clear(); continue
        prons = []
        for wf in el.findall('WordForm'):
            w = feats(wf)
            if (w.get('type') or [''])[0] == '발음' and w.get('pronunciation'):
                prons.append(w['pronunciation'][0])
        senses = []
        senses_total = sum(1 for _ in el.findall('Sense'))
        for s in el.findall('Sense'):
            sf = feats(s)
            d = (sf.get('definition') or [''])[0].strip()
            if not d:
                continue
            ex_sent, ex_phrase, ex_talk = [], [], []
            for ex in s.findall('SenseExample'):
                e = feats(ex); t = (e.get('type') or [''])[0]; vals = [v.strip() for v in e.get('example', []) if v.strip()]
                if not vals: continue
                if t == '문장': ex_sent.append(vals[0])
                elif t == '구': ex_phrase.append(vals[0])
                elif t == '대화': ex_talk.append(vals[:2])
            sense = {'d': d}
            ex = kid_first(clean(ex_sent))[:3] or kid_first(clean(ex_phrase))[:3]
            if ex: sense['x'] = ex
            talk = [t for t in ex_talk if not any(ADULT.search(v) for v in t)]
            if talk: sense['t'] = talk[0]
            for r in s.findall('SenseRelation'):
                rf = feats(r); k = REL.get((rf.get('type') or [''])[0])
                lem = (rf.get('lemma') or [''])[0].strip()
                if k and lem:
                    sense.setdefault(k, [])
                    if lem not in sense[k]: sense[k].append(lem)
            if SENSE_BAD.search(d) and senses_total > 1:
                continue
            senses.append(sense)
        if not senses:
            el.clear(); continue
        entry = {'i': int(el.get('val')), 'w': word, 'n': int((f.get('homonym_number') or ['0'])[0] or 0),
                 'p': (f.get('partOfSpeech') or [''])[0], 'u': (f.get('lexicalUnit') or [''])[0],
                 'lv': LV.get((f.get('vocabularyLevel') or [''])[0], 0), 's': senses}
        if f.get('origin') and f['origin'][0].strip() and f['origin'][0].strip() != word: entry['o'] = f['origin'][0].strip()
        if prons: entry['pr'] = prons[0]
        cat = (f.get('semanticCategory') or [''])[0]
        if cat: entry['c'] = cat
        if f.get('annotation'): entry['a'] = f['annotation'][0].strip()
        if ADULT_WORD.search(word) or ADULT_WORD.search(senses[0]['d']): entry['adult'] = 1
        entries.append(entry)
        el.clear()
    print(os.path.basename(path), len(entries), file=sys.stderr)

def key(e):
    return (e['w'].strip('-'), e['n'])
entries.sort(key=key)
os.makedirs(os.path.join(OUT, 'e'), exist_ok=True)
CH = 500
index = []
POS = []
for k in range(0, len(entries), CH):
    chunk = entries[k:k + CH]
    flags = [e.pop('adult', 0) for e in chunk]
    with open(os.path.join(OUT, 'e', f'{k // CH}.json'), 'w', encoding='utf-8') as fh:
        json.dump(chunk, fh, ensure_ascii=False, separators=(',', ':'))
    for j, e in enumerate(chunk):
        e['adult'] = flags[j]
        # [단어, 동음이의 번호, 품사 번호, 등급] — 휴대폰에서도 가볍게 받도록 뜻은 조각 파일에만 둔다.
        if e['p'] not in POS: POS.append(e['p'])
        index.append([e['w'], e['n'], POS.index(e['p']), e['lv'], e.pop('adult', 0)])
with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
    json.dump({'chunk': CH, 'count': len(entries), 'pos': POS, 'source': '한국어기초사전(국립국어원), CC BY-SA 2.0 KR, 2019-08-02 자료', 'words': index}, fh, ensure_ascii=False, separators=(',', ':'))
# 비슷한말·반대말 짝 놀이용: 둘 다 쉬운(초급·중급) 낱말이고 아이에게 어울리는 짝만.
easy = {}
for k, e in enumerate(entries):
    if e['lv'] in (1, 2) and not index[k][4] and e['p'] in ('명사', '동사', '형용사', '부사'):
        easy.setdefault(e['w'], k)
# 사람이 살펴서 뺀 짝(틀렸거나 초3에게 헷갈리거나 맞지 않는 짝).
PAIR_BLOCK = {frozenset(x.split('/')) for x in '''학교/학원 평소/평일 평상시/평일 코/콧물 발꿈치/발끝 박스/칸 때/계절 걸치다/감다 최신/최고 옳다/정하다 지난번/전자 마음씨/심정 덥다/차다 사라지다/죽다
약/건전지 시야/시계 대로/큰길 뇌/골 뼈/골 목숨/명 이름/명 명예/이름 도시/대처 형제/동기 큰일/대사 밝히다/새우다 인연/연고 외면/표면 곧/즉
객관적/주관적 이상적/현실적 기혼/미혼 신랑/신부 죽이다/살리다 남편/아내 부부/남편 계단/단계
날씨/일기 노트/필기 눈/시력 뜻/의사 뜻/의지 뜻/의도 말/소리 받다/거두다 불/화재 사실/정말 시각/시간 실례/실수 안/이내 밉다/싫다 어둡다/흐리다 여/남 현실/이상 두뇌/머리 그릇/용기 숫자/수 일자리/직장 취업/취직 부부/내외 대체로/대부분 국수/면 오른쪽/우편 게임/시합 출근/퇴근 성인/어른
던지다/받다 가끔/흔히 계절/시절 일어나다/일어서다 여쭈다/여쭙다 집안일/가사 열쇠/키'''.split()}
LV = {}
for k, e in enumerate(entries): LV.setdefault(e['w'], e['lv'])
pairs, seen = [], set()
for k, e in enumerate(entries):
    if e['w'] not in easy or easy[e['w']] != k: continue
    for s in e['s']:
        for t in ('s', 'a'):
            for other in s.get(t, []):
                o = re.sub(r'[\d^-]', '', other)
                key2 = (t,) + tuple(sorted((e['w'], o)))
                if o in easy and o != e['w'] and key2 not in seen and o not in e['w'] and e['w'] not in o and sorted(o) != sorted(e['w']) and frozenset((o, e['w'])) not in PAIR_BLOCK and not (e['w'].endswith('적') or o.endswith('적')) and (LV[e['w']] == 1 or LV[o] == 1) and len(e['w']) <= 4 and len(o) <= 4:
                    seen.add(key2); pairs.append([e['w'], o, t])
with open(os.path.join(OUT, 'pairs.json'), 'w', encoding='utf-8') as fh:
    json.dump(pairs, fh, ensure_ascii=False, separators=(',', ':'))
print('pairs', len(pairs), 'similar', sum(1 for p in pairs if p[2] == 's'), 'opposite', sum(1 for p in pairs if p[2] == 'a'), 'adult words', sum(r[4] for r in index), file=sys.stderr)
# 검사: 아이가 자주 찾는 초급·중급 낱말 예문에 위험한 말이 한 건도 없어야 한다.
HARD = re.compile(r'(매춘|창녀|윤락|성매매|강간|목을 매|자살|살인|폭행|마약|담배|이혼|소주|맥주|몸을 팔|칼로 .{0,10}찔)')
bad = [(e['w'], x) for e in entries if e['lv'] in (1, 2) for s in e['s'] for x in (s.get('x', []) + s.get('t', [])) if HARD.search(x)]
assert not bad, bad[:5]
print('entries', len(entries), 'levels', {l: sum(1 for e in entries if e['lv'] == l) for l in (0, 1, 2, 3)}, file=sys.stderr)
