# 국립국어원 「국어 기초 어휘 선정 및 어휘 등급화 목록 전체.xlsx」(2023 연구, 공공누리 제1유형)에서
# 낱말 → 가장 낮은 등급(1~5)만 뽑아 scripts/nikl-grade.json 으로 저장한다. kid-filter.mjs 가 이것을 읽는다.
# 등급 뜻(등급별 낱말 수와 낱말 성격으로 판단): 1=학령 전, 2=초1~2, 3=초3~4, 4=초5~6, 5=그 이상.
# 실행: python -I scripts/build-grade.py <xlsx 경로>
import json, os, sys
import openpyxl

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nikl-grade.json')
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
grade = {}
for ws in wb.worksheets:
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0 or not row or not row[0] or not row[1]:
            continue
        g = int(str(row[0]).strip()[0])
        w = str(row[1]).strip().replace('-', '').replace('^', ' ')
        if w and (w not in grade or g < grade[w]):
            grade[w] = g
with open(out, 'w', encoding='utf-8') as f:
    json.dump(dict(sorted(grade.items())), f, ensure_ascii=False, separators=(',', ':'))
counts = {g: sum(1 for v in grade.values() if v == g) for g in range(1, 6)}
print(len(grade), counts)
