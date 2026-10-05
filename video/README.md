# 담뱃값 그래프 영상 (Remotion)

유튜브 인포그래픽 영상(0:00~0:23 구간)의 화면 편집을 코드로 똑같이 재현한 프로젝트입니다.
오디오와 자막은 넣지 않았습니다.

- 출력: 1920×960 (원본과 같은 2:1 비율), 30fps, 24초
- 장면: 담뱃갑 + 슬롯머신 숫자 → 그래프로 날아가며 영역 그래프 그리기 → 2015년 인상 → 세로축 변경 + 짜장면·최저임금 선 → 큰 담뱃갑 + 물음표

## 실행 방법

Node.js 18 이상이 필요합니다 (Firebase Studio의 `nodejs_20` 그대로 사용 가능).

```bash
cd video
npm install
npm run dev       # 브라우저에서 타임라인을 보며 미리보기 (Remotion Studio, 포트 3000)
npm run render    # out/video.mp4 로 렌더링
```

## 파일 구조

| 파일 | 내용 |
|---|---|
| `src/config.ts` | 화면 크기, 색, 차트 좌표, 글자 크기, **장면별 타이밍(초)** |
| `src/data.ts` | 그래프 데이터 (담뱃값·짜장면·최저임금, 1988~2026년) |
| `src/timeline.ts` | 시간에 따른 그래프 끝 위치, 담뱃갑 위치, 축 눈금 변화 계산 |
| `src/components/chart/` | 축·눈금·제목·범례·영역/선 그래프 |
| `src/components/PackGroup.tsx` | 담뱃갑 + 가격표 묶음 |
| `src/components/RollingNumber.tsx` | 자리마다 굴러가는 슬롯머신 숫자 + 흰 외곽선 |
| `src/components/RidingIcons.tsx` | 선 끝을 따라가는 짜장면·돈 그림 |
| `src/components/QuestionMarks.tsx` | 마지막 물음표 + 떨림 곡선 |
| `assets-src/` | 원본 그림 (투명 배경 webp) |
| `public/images/` | 영상에 쓰는 그림과 종이 배경 (`scripts/prepare_assets.py`로 생성) |
| `public/fonts/` | G마켓 산스 Bold / Medium |

## 자주 바꿀 부분

- **숫자·데이터**: `src/data.ts`의 배열을 바꾸면 그래프와 가격표가 함께 바뀝니다.
- **제목·범례 글자**: `src/components/chart/Chart.tsx` 위쪽의 `TITLE_1`, `TITLE_2`, `LEGEND`.
- **타이밍**: `src/config.ts`의 `T` (초 단위). 내레이션에 맞출 때 여기만 고치면 됩니다.
- **그림 교체**: `assets-src/`의 파일을 같은 이름으로 바꾼 뒤 아래 명령으로 다시 만듭니다.

  ```bash
  pip install numpy pillow opencv-python-headless
  python scripts/prepare_assets.py
  ```

  투명 배경 그림이면 크림색 스티커 테두리는 스크립트가 자동으로 붙입니다.

## 참고

- 위치·크기·색·움직임은 원본 영상을 프레임 단위로 측정해서 맞췄습니다. 최저임금 선은 최저임금위원회 공식 시급과 같습니다.
- 폰트는 G마켓 산스(무료 폰트)입니다. 사용 전에 G마켓 공식 페이지에서 라이선스 조건을 확인하세요.
- Remotion은 개인과 직원 3명 이하 회사는 무료이고, 그보다 큰 회사는 유료 라이선스가 필요합니다.
- 원본 영상의 대본·그림·목소리는 원작자 것이므로, 똑같이 만든 영상은 연습용으로만 쓰고 업로드할 때는 내 대본·그림·음성으로 바꿔 주세요.
