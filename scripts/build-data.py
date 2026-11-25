"""한국어기초사전 XML(국립국어원, CC BY-SA 2.0 KR) -> 웹용 JSON 조각.
출력: public/data/index.json (검색 목록), public/data/e/<n>.json (뜻 조각, 500단어씩)
"""
import json, glob, os, re, io, sys, xml.etree.ElementTree as ET
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, OUT = os.path.join(ROOT, 'raw'), os.path.join(ROOT, 'public', 'data')
LV = {'초급': 1, '중급': 2, '고급': 3}
REL = {'비슷한말': 's', '반대말': 'a', '높임말': 'h', '낮춤말': 'l', '큰말': 'b', '작은말': 'm', '센말': 'f', '여린말': 'w', '준말': 'j', '본말': 'o', '참고어': 'r'}

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
            ex = ex_sent[:3] or ex_phrase[:3]
            if ex: sense['x'] = ex
            if ex_talk: sense['t'] = ex_talk[0]
            for r in s.findall('SenseRelation'):
                rf = feats(r); k = REL.get((rf.get('type') or [''])[0])
                lem = (rf.get('lemma') or [''])[0].strip()
                if k and lem:
                    sense.setdefault(k, [])
                    if lem not in sense[k]: sense[k].append(lem)
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
    with open(os.path.join(OUT, 'e', f'{k // CH}.json'), 'w', encoding='utf-8') as fh:
        json.dump(chunk, fh, ensure_ascii=False, separators=(',', ':'))
    for j, e in enumerate(chunk):
        # [단어, 동음이의 번호, 품사 번호, 등급] — 휴대폰에서도 가볍게 받도록 뜻은 조각 파일에만 둔다.
        if e['p'] not in POS: POS.append(e['p'])
        index.append([e['w'], e['n'], POS.index(e['p']), e['lv']])
with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
    json.dump({'chunk': CH, 'count': len(entries), 'pos': POS, 'source': '한국어기초사전(국립국어원), CC BY-SA 2.0 KR, 2019-08-02 자료', 'words': index}, fh, ensure_ascii=False, separators=(',', ':'))
print('entries', len(entries), 'levels', {l: sum(1 for e in entries if e['lv'] == l) for l in (0, 1, 2, 3)}, file=sys.stderr)
