# 🍉 말랑이 쇼타로 수박게임

과일이 합쳐지며 커지는 수박게임 스타일 웹앱. 모바일 터치 / PC 마우스 모두 지원.

## 실행 (로컬)
정적 사이트라 그냥 `index.html` 을 열거나, 로컬 서버로:

```bash
node .claude/serve.js   # http://localhost:8125
```

## 구성
- `index.html`, `style.css`, `game.js` — 게임 본체 (Matter.js 물리엔진, CDN 로드)
- `assets/faces/out/*.png` — 캐릭터 얼굴 (원형 크롭)
- `assets/fruits/*.png` — 단계별 과일 프레임

## 배포
정적 호스팅(Netlify 등)에 루트를 그대로 올리면 됩니다. 빌드 과정 없음.
