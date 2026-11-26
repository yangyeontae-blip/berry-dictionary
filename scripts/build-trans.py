# 한국어기초사전 원자료(raw/*.xml)의 외국어 대역을 언어별 조각으로 만든다: public/data/t/<언어>/<조각>.json
# 조각은 public/data/e/<조각>.json 과 같은 차례·같은 크기다. 낱말마다 [뜻1 대역, 뜻2 대역, …], 대역 = [낱말, 짧은 풀이] 또는 null.
# 뜻은 뜻풀이 글자가 같은 것끼리 짝짓는다(kid-filter.mjs가 어른 뜻을 뺀 뒤에도 맞게).
# 실행: python -I scripts/build-trans.py <raw xml 폴더>   (kid-filter.mjs 뒤에 돌린다)
import glob, io, json, os, re, sys
import xml.etree.ElementTree as ET

RAW = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data')
LANG = {'영어': 'en', '베트남어': 'vi', '러시아어': 'ru', '몽골어': 'mn', '일본어': 'ja', '타이어': 'th',
        '인도네시아어': 'id', '스페인어': 'es', '프랑스어': 'fr', '아랍어': 'ar'}
norm = lambda s: re.sub(r'[\s.,·‘’“”\'"()<>{}\[\]「」-]', '', s or '')

chunks = sorted(glob.glob(os.path.join(DATA, 'e', '*.json')), key=lambda p: int(os.path.basename(p)[:-5]))
ours = []  # (조각 번호, 조각 안 위치, 기초사전 번호, [뜻풀이 정규화])
for p in chunks:
    c = int(os.path.basename(p)[:-5])
    for j, e in enumerate(json.load(open(p, encoding='utf-8'))):
        ours.append((c, j, e['i'], [norm(s['d']) for s in e['s']]))
want = {i for _, _, i, _ in ours}

found = {}  # 기초사전 번호 → {정규화 뜻풀이: {언어: [낱말, 풀이]}}
for path in sorted(glob.glob(os.path.join(RAW, '*.xml'))):
    # 원자료 일부 val 속성 안에 '<'가 그대로 있어(build-data.py와 같은 방법으로) 고쳐 읽는다
    text = open(path, encoding='utf-8').read()
    text = re.sub(r'val="([^"]*)"', lambda m: 'val="' + m.group(1).replace('<', '&lt;') + '"', text)
    for _, el in ET.iterparse(io.BytesIO(text.encode('utf-8')), events=('end',)):
        if el.tag != 'LexicalEntry':
            continue
        i = int(el.get('val') or 0)
        if i in want:
            senses = {}
            for s in el.iter('Sense'):
                d = next((f.get('val') for f in s.findall('feat') if f.get('att') == 'definition'), '')
                eq = {}
                for q in s.findall('Equivalent'):
                    f = {x.get('att'): x.get('val') for x in q.findall('feat')}
                    code = LANG.get(f.get('language', ''))
                    if code and f.get('lemma'):
                        gloss = (f.get('definition') or '').strip()
                        eq[code] = [f['lemma'].strip()[:40], gloss[:90] + ('…' if len(gloss) > 90 else '')]
                if eq:
                    senses[norm(d)] = eq
            found[i] = senses
        el.clear()
    print(os.path.basename(path), len(found), file=sys.stderr)

out = {code: {} for code in LANG.values()}
hit = total = 0
for c, j, i, defs in ours:
    senses = found.get(i, {})
    for code in out:
        row = []
        for d in defs:
            q = senses.get(d, {}).get(code)
            row.append(q)
        out[code].setdefault(c, []).append(row if any(row) else 0)
    total += len(defs); hit += sum(1 for d in defs if d in senses)
for code, by_chunk in out.items():
    folder = os.path.join(DATA, 't', code)
    os.makedirs(folder, exist_ok=True)
    for c, rows in by_chunk.items():
        with open(os.path.join(folder, f'{c}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
print(f'뜻 {total}개 중 대역을 찾은 뜻 {hit}개 ({hit * 100 // max(total, 1)}%)')
