// 시간(초) → 차트 상태 계산. 모든 장면이 이 함수들을 공유합니다.
import {CHART, PACK, T, xOfYear} from './config';
import {CIGARETTE, JAJANGMYEON, MIN_WAGE, valueAt} from './data';
import {EASE, easeOutPow, lerp, progress} from './lib/anim';

const X_2014 = xOfYear(2014);
const X_2015 = xOfYear(2015);
const X_END = xOfYear(CHART.lastYear);
// reveal starts fully hidden behind the y axis
const REVEAL_START_X = CHART.axisX - CHART.revealFeatherFront;

export const yearOfX = (x: number) => CHART.firstYear + (x - CHART.firstYearX) / CHART.yearStep;

/** 0 → 1 while the y axis rescales from 5,000 to 10,000 won. */
export const rescaleProgress = (t: number) => progress(t, T.rescaleStart, T.rescaleEnd, EASE.rescale);

/** Pixels per won (y scale). */
export const pxPerWon = (t: number) => lerp(CHART.pxPerWon5k, CHART.pxPerWon10k, rescaleProgress(t));

export const yOfValue = (value: number, k: number) => CHART.zeroY - value * k;

/** Value of a series at pixel x (flat before the first year). */
export const seriesValueAtX = (series: number[], x: number) => valueAt(series, Math.max(CHART.firstYear, yearOfX(x)));

// ── 담뱃값(빨강) ──
export const redTipX = (t: number) => {
  if (t < T.jumpStart) {
    return lerp(REVEAL_START_X, X_2014, progress(t, T.redRevealStart, T.redRevealEnd, EASE.outCubic));
  }
  if (t < T.extendStart) {
    return lerp(X_2014, X_2015, progress(t, T.jumpStart, T.jumpEnd, EASE.jump));
  }
  return lerp(X_2015, X_END, progress(t, T.extendStart, T.extendEnd, EASE.extend));
};

// ── 짜장면(갈색) / 최저임금(파랑) ──
const lineTipX = (t: number, lineStart: number, iconStart: number, lineEnd: number, iconStartX: number, easing: (x: number) => number) => {
  if (t < iconStart) return lerp(REVEAL_START_X, iconStartX, progress(t, lineStart, iconStart));
  return lerp(iconStartX, X_END, progress(t, iconStart, lineEnd, easing));
};

export const brownTipX = (t: number) => lineTipX(t, T.brownLineStart, T.brownIconStart, T.brownLineEnd, 306, EASE.brownLine);
export const blueTipX = (t: number) => lineTipX(t, T.blueLineStart, T.blueIconStart, T.blueLineEnd, 305, EASE.blueLine);

// ── 아이콘(그림)이 선 끝을 따라가는 위치 ──
// 원본처럼 아이콘은 선 끝보다 1년 앞의 높이를 바라보고, 선보다 살짝 위에 떠 있습니다.
export const ridingIconPos = (series: number[], tipX: number, k: number, dx: number, dy: number) => ({
  x: tipX + dx,
  y: yOfValue(valueAt(series, Math.min(CHART.lastYear, Math.max(CHART.firstYear, yearOfX(tipX)) + 1)), k) + dy,
});

export const brownIconPos = (t: number) => ridingIconPos(JAJANGMYEON, brownTipX(t), pxPerWon(t), 0, -32);
export const blueIconPos = (t: number) => ridingIconPos(MIN_WAGE, blueTipX(t), pxPerWon(t), 4, -36);

/** Fly-in of a riding icon: 0 → 1 */
export const iconEnter = (t: number, iconStart: number) => progress(t, iconStart - 0.03, iconStart + 0.1, EASE.outCubic);

// ── 담뱃갑 + 가격표 묶음 ──
export type PackState = {
  x: number;
  y: number;
  scale: number;
  labelFrom: number;
  labelTo: number;
  /** progress for each digit column, index 0 = units */
  labelProgress: (column: number) => number;
  labelOpacity: number;
};

const packTipOffset = (t: number) => ({
  x: -3,
  // 2014년에 머무를 땐 조금 더 위에, 2015년 이후엔 선 끝에 맞춰 내려옵니다
  y: lerp(-23, -2, progress(t, T.jumpStart, T.jumpEnd, EASE.jump)),
});

// 장면 1 카운트: 자리마다 감속 정도가 다름 (원본 측정값)
const COUNT_EASE = [easeOutPow(2), easeOutPow(1.8), easeOutPow(1.55), easeOutPow(1.3)];

export const packState = (t: number): PackState => {
  const k = pxPerWon(t);

  // 장면 1: 0 → 4,500원 슬롯머신 카운트 (높은 자리부터 멈춤)
  if (t < T.packFlyStart) {
    return {
      x: PACK.center.x,
      y: PACK.center.y,
      scale: 1,
      labelFrom: 0,
      labelTo: 4500,
      labelProgress: (c) => progress(t, T.countStart, T.countEnd[c], COUNT_EASE[c]),
      labelOpacity: 1,
    };
  }

  // 그래프 2014년 끝으로 날아가며 작아짐, 숫자는 4,500 → 2,500
  if (t < T.packFlyEnd) {
    const p = progress(t, T.packFlyStart, T.packFlyEnd, EASE.inOutQuad);
    const off = packTipOffset(t);
    const tx = X_2014 + off.x;
    const ty = yOfValue(2500, k) + off.y;
    const span = T.packFlyEnd - T.packFlyStart;
    return {
      x: lerp(PACK.center.x, tx, p),
      y: lerp(PACK.center.y, ty, p),
      scale: lerp(1, PACK.chartScale, p),
      labelFrom: 4500,
      labelTo: 2500,
      labelProgress: (c) => progress(t, T.packFlyStart, T.packFlyEnd - c * 0.12 * span, EASE.inOutQuad),
      labelOpacity: 1,
    };
  }

  // 그래프 끝을 따라감 (2015년 점프, 2026년까지 연장, 축 변경)
  const tipX = redTipX(t);
  const value = seriesValueAtX(CIGARETTE, tipX);
  const off = packTipOffset(t);
  const jumpP = Math.max(0, Math.min(1, (value - 2500) / 2000));
  return {
    x: tipX + off.x,
    y: yOfValue(value, k) + off.y,
    scale: PACK.chartScale,
    labelFrom: 2500,
    labelTo: 4500,
    labelProgress: () => jumpP,
    labelOpacity: 1 - progress(t, T.packLabelFadeStart, T.packLabelFadeEnd),
  };
};

/** Chart exit: scale + fade, used for everything drawn on the chart. */
export const chartExit = (t: number) => {
  const p = progress(t, T.chartOutStart, T.chartOutEnd, EASE.inOutQuad);
  return {scale: lerp(1, 0.94, p), opacity: 1 - p};
};

// 모션 블러를 켤 구간 (움직임이 빠른 때)
const within = (t: number, ranges: [number, number][]) => ranges.some(([a, b]) => t >= a && t <= b);

export const packMoving = (t: number) =>
  within(t, [
    [T.packFlyStart - 0.05, T.packFlyEnd + 0.05],
    [T.jumpStart - 0.05, T.jumpEnd + 0.05],
    [T.extendStart - 0.05, T.extendEnd + 0.05],
    [T.rescaleStart - 0.05, T.rescaleEnd + 0.05],
  ]);

export const iconsMoving = (t: number) =>
  within(t, [
    [T.brownIconStart - 0.1, T.brownLineEnd + 0.05],
    [T.blueIconStart - 0.1, T.blueLineEnd + 0.05],
  ]);

export const legendMoving = (t: number) =>
  within(t, [
    [T.legendSlide1Start - 0.05, T.legendSlide1End + 0.05],
    [T.legendSlide2Start - 0.05, T.legendSlide2End + 0.05],
  ]);
