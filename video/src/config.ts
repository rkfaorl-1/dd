// 영상 전체 설정: 크기, 색, 차트 좌표, 타이밍(초 단위).
// 숫자는 원본 영상(1920x960 화면)을 픽셀 단위로 측정한 값입니다.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 960; // 원본이 2:1 비율
export const DURATION_SEC = 24;

export const FONT_BOLD = 'GmarketSansBold';
export const FONT_MEDIUM = 'GmarketSansMedium';

export const COLORS = {
  ink: '#000000',
  red: '#FF0000', // 담뱃값 점
  areaFill: 'rgba(255, 0, 0, 0.5)', // 담뱃값 영역
  legendRed: '#C80000',
  brown: '#956300', // 짜장면
  blue: '#0094FD', // 최저임금
  numberRed: '#FF0000', // 큰 숫자 "4,500"
  question: '#FEB301',
  stickerShadow: 'rgba(70, 40, 10, 0.32)',
};

// 차트 좌표계 (px)
export const CHART = {
  axisX: 252, // 세로축 x
  axisY: 747, // 가로축 y
  zeroY: 746.8, // 값 0의 y
  axisTopY: 193, // 세로축 화살표 끝
  axisRightX: 1807, // 가로축 화살표 끝
  gridEndX: 1790,
  axisWidth: 3.5,
  gridWidth: 2,
  dashLength: 8.5,
  dashPeriod: 18.7,
  firstYear: 1988,
  lastYear: 2026,
  firstYearX: 269.7,
  yearStep: 38.03,
  // 1원당 픽셀: 최대 5,000원 눈금 → 10,000원 눈금
  pxPerWon5k: 0.090894,
  pxPerWon10k: 0.045447,
  dotRadius: 8.5,
  lineWidth: 3.5,
  // 영역/선이 그려지는 앞쪽 끝의 부드러운 경계
  revealFeatherBack: 12,
  revealFeatherFront: 18,
};

export const xOfYear = (year: number) =>
  CHART.firstYearX + (year - CHART.firstYear) * CHART.yearStep;

// 글자 크기와 위치 (y는 글자 기준선 baseline)
export const TEXT = {
  axisFontSize: 44.3,
  yLabelRightX: 233.7,
  yLabelBaselineOffset: 15, // 눈금선에서 기준선까지
  xLabelBaselineY: 797.2,
  xLabelOffsetX: 1.5,
  titleFontSize: 88.3,
  titleBaselineY: 170,
  title1CenterX: 1015.5,
  title2CenterX: 946,
  sourceFontSize: 35.5,
  sourceRightX: 1804.4,
  sourceBaselineY: 255.8,
  unitFontSize: 26,
  unitRightX: 234,
  unitBaselineY: 255.8,
  legendFontSize: 44.6,
  legendBaselineY: 277,
  legendSquareY: 242,
  legendSquareSize: 42,
  legendTextGap: 12, // 네모 오른쪽 끝 → 글자 시작
  spaceWidthEm: 0.31, // G마켓 산스에는 공백 글자가 없어 직접 띄웁니다
};

// 범례 네모의 x 위치: 항목 1개 → 2개 → 3개일 때
export const LEGEND_X = {
  cigarette: [848, 972, 1096],
  jajangmyeon: [760, 735, 624],
  minWage: [838, 838, 838],
};

// 장면 1의 담뱃갑(그림 자체 크기 기준)과 숫자 위치
export const PACK = {
  // public/images/pack.png 를 이 배율로 그리면 원본 담뱃갑 크기(약 426x582)가 됩니다
  scale: 0.5013,
  imageWidth: 905,
  imageHeight: 1225,
  center: {x: 1007, y: 450},
  // 담뱃갑 중심에서 숫자 중심까지 (배율 1 기준)
  labelOffset: {x: -45, y: 85},
  chartScale: 0.233, // 그래프 위에 올라갔을 때 배율
  finalScale: 1.066, // 마지막 장면 배율 (장면 1 대비)
  finalCenter: {x: 1005, y: 457.5},
};

// 타이밍 (초). 원본 유튜브 영상 0:00~0:23 구간과 같은 박자입니다.
export const T = {
  packAppear: 0.1,
  countStart: 0.1,
  countEnd: [1.3, 1.2, 1.0, 0.75], // 일·십·백·천의 자리 멈추는 시각

  chartBuildStart: 2.9,
  redRevealStart: 3.2,
  redRevealEnd: 3.72,
  packFlyStart: 3.25,
  packFlyEnd: 4.4,

  jumpStart: 6.4, // 2014 → 2015 (2,500 → 4,500원)
  jumpEnd: 7.55,
  extendStart: 9.9, // 2015 → 2026
  extendEnd: 11.1,

  titleOutStart: 11.6,
  rescaleStart: 11.6, // 세로축 5,000 → 10,000
  rescaleEnd: 13.15,
  oldTicksOutStart: 11.65, // 1,000~4,000 눈금 사라짐
  oldTicksOutEnd: 12.1,
  tick10kInStart: 12.6, // 10,000 눈금 나타남
  tick10kInEnd: 13.1,
  title2Start: 12.35,
  packLabelFadeStart: 12.6,
  packLabelFadeEnd: 12.9,

  legendRedIn: 12.55,
  legendSlide1Start: 13.05,
  legendSlide1End: 14.1,
  legendBrownIn: 13.3,

  brownLineStart: 13.6,
  brownIconStart: 13.75,
  brownLineEnd: 16.05,

  legendSlide2Start: 15.85,
  legendSlide2End: 16.95,
  legendBlueIn: 16.4,

  blueLineStart: 17.25,
  blueIconStart: 17.3,
  blueLineEnd: 19.15,

  chartOutStart: 20.38,
  chartOutEnd: 20.7,
  finalPackIn: 20.72,

  questionLeftIn: 21.62,
  questionLeftOut: 22.48,
  questionRightIn: 21.87,
  questionRightOut: 22.73,
};
