# 하나은행 WEB 프로토타입

Figma 원본 파일 `[하나은행]프로토타입.fig`의 `web` 페이지를 코드로 1:1 재현한 React 프로토타입입니다.
화면 19개와 Figma 프로토타입 연결을 그대로 옮겼습니다. 화면별 검증 결과는 [VERIFICATION.md](VERIFICATION.md)에 있습니다.

## 화면 규격
- 기준 화면: **1920px 너비** (Figma 웹 프레임)
- 브라우저 너비에 맞춰 비율을 유지한 채 확대/축소, 페이지는 세로 스크롤
- 960px 너비 프레임(상품비교, 상담 예약)은 같은 배율로 가운데 표시

## GitHub Pages 배포
빌드된 결과물이 `docs/` 폴더에 들어 있어서 따로 빌드하지 않아도 바로 배포할 수 있습니다.

1. GitHub에서 새 저장소를 만들고 이 폴더의 내용을 전부 올립니다.
2. 저장소 **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더: **/docs** → Save
3. 1~2분 뒤 `https://<아이디>.github.io/<저장소이름>/` 에서 열립니다.

주소는 해시 방식(`#/화면ID`)이라 새로고침이나 특정 화면 주소로 바로 들어가도 정상적으로 열립니다.
예: `https://<아이디>.github.io/<저장소이름>/#/1:24140`

## 직접 빌드하기 (소스를 수정했을 때)
```bash
npm install
npm run build   # src/ + public/ → docs/
npm run dev     # http://localhost:8000 에서 미리보기
```

## 구조
```
src/
  main.jsx        React 진입점
  Prototype.jsx   화면 전환, 뒤로가기, 클릭/드래그/시간 지연 인터랙션, 스크롤·고정 영역 처리
  loader.js       화면 데이터 불러오기
  styles.css      스타일
public/
  index.html
  data/manifest.json        화면 목록과 Figma 플로우 시작점
  data/screens/*.json       Figma 프레임별 화면 데이터 (레이어 위치·크기·색·그림자·이미지와 프로토타입 연결)
  data/glyphs.svg           Figma에 저장된 글자 모양 (기기마다 글꼴이 달라지지 않도록 사용)
  img/                      Figma 원본 이미지
docs/                       GitHub Pages 배포용 빌드 결과
```

`data/screens`의 화면 데이터는 Figma 파일에서 레이어 정보를 그대로 읽어 만든 것입니다. 디자인을 수정할 때는 Figma에서 고친 뒤 다시 변환하는 것을 권장합니다.
