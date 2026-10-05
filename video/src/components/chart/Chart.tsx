import React from 'react';
import {CHART, COLORS, FONT_BOLD, FONT_MEDIUM, HEIGHT, LEGEND_X, T, TEXT, WIDTH, xOfYear} from '../../config';
import {CIGARETTE, JAJANGMYEON, MIN_WAGE} from '../../data';
import {EASE, lerp, progress, typeOpacity} from '../../lib/anim';
import {blueTipX, brownTipX, pxPerWon, redTipX, yOfValue} from '../../timeline';
import {useTime} from '../MotionBlur';
import {SvgTypeText} from '../SvgTypeText';
import {AreaFill, Dots, Line, RevealMask} from './Series';

const TITLE_1 = '한국의 일반 궐련 소매가격';
const TITLE_2 = '물가 상승률';
const TITLE_CHAR = 0.055;
const TITLE_START = T.chartBuildStart + 0.15;
const TITLE_BOLD = 0.8; // 원본처럼 살짝 더 굵게
const LABEL_BOLD = 0.5;
const X_LABEL_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025];

const format = (v: number) => v.toLocaleString('en-US');

// 축 눈금이 바뀌는 동안 1,000~4,000 눈금은 사라지고 10,000 눈금이 나타납니다
const tickOpacity = (t: number, value: number) => {
  if (value === 10000) return progress(t, T.tick10kInStart, T.tick10kInEnd);
  if (value < 5000 && value > 0) return 1 - progress(t, T.oldTicksOutStart, T.oldTicksOutEnd);
  return 1;
};

const Grid: React.FC<{t: number; k: number}> = ({t, k}) => (
  <g stroke={COLORS.ink} strokeWidth={CHART.gridWidth} strokeDasharray={`${CHART.dashLength} ${CHART.dashPeriod - CHART.dashLength}`}>
    {[1000, 2000, 3000, 4000, 5000, 10000].map((value, i) => {
      const start = T.chartBuildStart + 0.1 + i * 0.1;
      const wipe = value === 10000 ? 1 : progress(t, start, start + 0.7, EASE.outCubic);
      const opacity = tickOpacity(t, value);
      if (wipe <= 0 || opacity <= 0) return null;
      const y = yOfValue(value, k);
      const x0 = CHART.axisX + 2;
      return <line key={value} x1={x0} x2={lerp(x0, CHART.gridEndX, wipe)} y1={y} y2={y} opacity={opacity} />;
    })}
  </g>
);

const Axes: React.FC<{t: number}> = ({t}) => {
  const py = progress(t, T.chartBuildStart + 0.1, T.chartBuildStart + 0.7, EASE.outCubic);
  const px = progress(t, T.chartBuildStart + 0.1, T.chartBuildStart + 0.9, EASE.outCubic);
  if (py <= 0) return null;
  const top = lerp(CHART.axisY, CHART.axisTopY, py);
  const right = lerp(CHART.axisX, CHART.axisRightX, px);
  return (
    <g stroke={COLORS.ink} strokeWidth={CHART.axisWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={CHART.axisX} y1={CHART.axisY} x2={CHART.axisX} y2={top} />
      <polyline points={`${CHART.axisX - 9.5},${top + 10} ${CHART.axisX},${top} ${CHART.axisX + 9.5},${top + 10}`} />
      <line x1={CHART.axisX} y1={CHART.axisY} x2={right} y2={CHART.axisY} />
      <polyline points={`${right - 10},${CHART.axisY - 9.5} ${right},${CHART.axisY} ${right - 10},${CHART.axisY + 9.5}`} />
    </g>
  );
};

const AxisLabels: React.FC<{t: number; k: number}> = ({t, k}) => {
  const b = T.chartBuildStart;
  const yTicks = [
    {value: 0, start: b + 0.1},
    {value: 1000, start: b + 0.1},
    {value: 2000, start: b + 0.16},
    {value: 3000, start: b + 0.22},
    {value: 4000, start: b + 0.28},
    {value: 5000, start: b + 0.34},
    {value: 10000, start: 0},
  ];
  return (
    <g>
      {yTicks.map(({value, start}) => {
        const opacity = tickOpacity(t, value);
        if (opacity <= 0) return null;
        return (
          <SvgTypeText
            key={value}
            text={format(value)}
            x={TEXT.yLabelRightX}
            y={yOfValue(value, k) + TEXT.yLabelBaselineOffset}
            anchor="end"
            font={FONT_BOLD}
            size={TEXT.axisFontSize}
            bold={LABEL_BOLD}
            opacity={opacity}
            opacityOf={(i) => (value === 10000 ? 1 : typeOpacity(t, start, 0.05, i))}
          />
        );
      })}
      {X_LABEL_YEARS.map((year, j) => (
        <SvgTypeText
          key={year}
          text={String(year)}
          x={xOfYear(year) + TEXT.xLabelOffsetX}
          y={TEXT.xLabelBaselineY}
          anchor="middle"
          font={FONT_BOLD}
          size={TEXT.axisFontSize}
          bold={LABEL_BOLD}
          opacityOf={(i) => typeOpacity(t, b + j * 0.05, 0.05, i)}
        />
      ))}
      <SvgTypeText
        text="(원)"
        x={TEXT.unitRightX}
        y={TEXT.unitBaselineY}
        anchor="end"
        font={FONT_MEDIUM}
        size={TEXT.unitFontSize}
        opacityOf={(i) => typeOpacity(t, b + 0.65, 0.05, i)}
      />
      <SvgTypeText
        text="(자료: 한국보건사회연구원)"
        x={TEXT.sourceRightX}
        y={TEXT.sourceBaselineY}
        anchor="end"
        font={FONT_MEDIUM}
        size={TEXT.sourceFontSize}
        opacityOf={(i) => typeOpacity(t, b + 0.6, 0.025, i)}
      />
    </g>
  );
};

const Titles: React.FC<{t: number}> = ({t}) => {
  const n = [...TITLE_1].length;
  return (
    <g>
      {t < T.title2Start && (
        <SvgTypeText
          text={TITLE_1}
          x={TEXT.title1CenterX}
          y={TEXT.titleBaselineY}
          anchor="middle"
          font={FONT_BOLD}
          size={TEXT.titleFontSize}
          bold={TITLE_BOLD}
          opacityOf={(i) =>
            typeOpacity(t, TITLE_START, TITLE_CHAR, i, 0.12) * (1 - typeOpacity(t, T.titleOutStart, TITLE_CHAR, n - 1 - i, 0.06))
          }
        />
      )}
      {t >= T.title2Start && (
        <SvgTypeText
          text={TITLE_2}
          x={TEXT.title2CenterX}
          y={TEXT.titleBaselineY}
          anchor="middle"
          font={FONT_BOLD}
          size={TEXT.titleFontSize}
          bold={TITLE_BOLD}
          opacityOf={(i) => typeOpacity(t, T.title2Start, 0.135, i, 0.12)}
        />
      )}
    </g>
  );
};

type LegendItem = {label: string; color: string; xs: number[]; squareIn: number; textIn: number; perChar: number};
const LEGEND: LegendItem[] = [
  {label: '짜장면', color: COLORS.brown, xs: LEGEND_X.jajangmyeon, squareIn: T.legendBrownIn, textIn: T.legendBrownIn + 0.1, perChar: 0.1},
  {label: '최저임금', color: COLORS.blue, xs: LEGEND_X.minWage, squareIn: T.legendBlueIn, textIn: T.legendBlueIn + 0.2, perChar: 0.1},
  {label: '담뱃값', color: COLORS.legendRed, xs: LEGEND_X.cigarette, squareIn: T.legendRedIn, textIn: T.legendRedIn + 0.02, perChar: 0.07},
];

// 범례는 미끄러질 때 모션 블러를 주기 위해 별도 레이어로 그립니다
export const LegendLayer: React.FC = () => {
  const t = useTime();
  const s1 = progress(t, T.legendSlide1Start, T.legendSlide1End, EASE.legend1);
  const s2 = progress(t, T.legendSlide2Start, T.legendSlide2End, EASE.legend2);
  return (
    <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', left: 0, top: 0}}>
      {LEGEND.map((item) => {
        const squareOpacity = progress(t, item.squareIn, item.squareIn + 0.15);
        if (squareOpacity <= 0) return null;
        const x = lerp(lerp(item.xs[0], item.xs[1], s1), item.xs[2], s2);
        return (
          <g key={item.label}>
            <rect x={x} y={TEXT.legendSquareY} width={TEXT.legendSquareSize} height={TEXT.legendSquareSize} fill={item.color} opacity={squareOpacity} />
            <SvgTypeText
              text={item.label}
              x={x + TEXT.legendSquareSize + TEXT.legendTextGap}
              y={TEXT.legendBaselineY}
              anchor="start"
              font={FONT_MEDIUM}
              size={TEXT.legendFontSize}
              opacityOf={(i) => typeOpacity(t, item.textIn, item.perChar, i, 0.12)}
            />
          </g>
        );
      })}
    </svg>
  );
};

// 차트 (눈금, 축, 글자, 데이터). 범례는 LegendLayer, 그림 아이콘은 RidingIcons, 담뱃갑은 PackGroup에서 그립니다.
export const Chart: React.FC<{t: number}> = ({t}) => {
  const k = pxPerWon(t);
  return (
    <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <RevealMask id="reveal-red" tipX={redTipX(t)} />
        <RevealMask id="reveal-brown" tipX={brownTipX(t)} />
        <RevealMask id="reveal-blue" tipX={blueTipX(t)} />
      </defs>
      {t >= T.redRevealStart && (
        <>
          <AreaFill series={CIGARETTE} k={k} fill={COLORS.areaFill} mask="reveal-red" />
          <Dots series={CIGARETTE} k={k} color={COLORS.red} mask="reveal-red" />
        </>
      )}
      {t >= T.blueLineStart && (
        <>
          <Line series={MIN_WAGE} k={k} color={COLORS.blue} mask="reveal-blue" />
          <Dots series={MIN_WAGE} k={k} color={COLORS.blue} mask="reveal-blue" />
        </>
      )}
      {t >= T.brownLineStart && (
        <>
          <Line series={JAJANGMYEON} k={k} color={COLORS.brown} mask="reveal-brown" />
          <Dots series={JAJANGMYEON} k={k} color={COLORS.brown} mask="reveal-brown" />
        </>
      )}
      <Grid t={t} k={k} />
      <Axes t={t} />
      <AxisLabels t={t} k={k} />
      <Titles t={t} />
    </svg>
  );
};
