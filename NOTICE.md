# 저작권·출처 안내

## 낱말 자료
`public/data/` 의 낱말 자료는 국립국어원 **한국어기초사전**(https://krdict.korean.go.kr, 2019-08-02 내려받기 자료)을 웹에서 쓰기 좋게 줄이고 나눈 것입니다.
원자료와 이 가공 자료는 **크리에이티브 커먼즈 저작자표시-동일조건변경허락 2.0 대한민국(CC BY-SA 2.0 KR)** 라이선스를 따릅니다.
https://creativecommons.org/licenses/by-sa/2.0/kr/

- 바꾼 점: 외국어 대역·발음 파일 주소·일부 속성을 빼고, 뜻·예문(뜻마다 최대 3개)·관련어만 남겼습니다. 표제어 차례로 500낱말씩 나누었습니다.
- 초등학생용으로 거름(`scripts/kid-filter.mjs`): 성·마약·술·담배·도박·폭력·자살·욕설·낮잡는 말은 낱말째 빼고, 뜻이 여럿인 낱말은 그런 뜻·예문만 뺐습니다.
- 초등 6학년까지만 남김: 국립국어원 「국어 기초 어휘 선정 및 어휘 등급화 목록 전체.xlsx」(『2023년 국어 기초 어휘 선정 및 어휘 등급화 연구』 첨부, 공공누리 제1유형, https://korean.go.kr/front/reportData/reportDataView.do?report_seq=1160)의 1~4등급 낱말과 교과서 낱말만 남겼습니다(약 2만 3천 낱말). 등급은 `scripts/nikl-grade.json`(낱말과 등급만 뽑은 것)에 있고, 낱말 카드의 ‘초3~4 낱말’ 같은 표시에 씁니다.
- 내 나라 말 뜻(`public/data/t/<언어>/`): 한국어기초사전 원자료의 외국어 대역(영어·베트남어·러시아어·몽골어·일본어·타이어·인도네시아어·스페인어·프랑스어·아랍어)에서 낱말과 짧은 풀이만 뽑았습니다(`scripts/build-trans.py`). 2019년 공개 자료에 중국어 대역은 없습니다.
- 발음 파일은 재배포할 수 없어 넣지 않았습니다. 앱의 '소리 듣기'는 기기 자체의 읽어 주기 기능을 씁니다.
- 원자료 사본: https://github.com/spellcheck-ko/korean-dict-nikl-krdict

## 교육과정 참고
초등 3~4학년 국어 문법 성취기준([4국04-01]·[4국04-02]·[4국04-04])과 성취기준 해설의 요소는
DECK6/korean-elementary-learning-map(MIT, 2022 개정 초등 교육과정 학습 온톨로지)의 정리를 참고해 기능으로 옮겼습니다. 교육과정 원문은 싣지 않았습니다.

## 글꼴
- 메이플스토리 서체(넥슨) — `public/fonts/LICENSE-Maplestory.txt`
- Berry Forest Sans(Noto Sans KR 기반, SIL OFL 1.1) — `public/fonts/LICENSE-NotoSansKR.txt`

## 그림
뽀짝이와 화면 그림은 이 앱을 위해 새로 그린 것입니다.
