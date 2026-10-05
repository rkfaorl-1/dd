import React from 'react';
import {CHART, HEIGHT, WIDTH, xOfYear} from '../../config';
import {YEARS} from '../../data';
import {yOfValue} from '../../timeline';

/** Horizontal soft-edged reveal: visible left of `tipX`, hidden right of it. */
export const RevealMask: React.FC<{id: string; tipX: number}> = ({id, tipX}) => (
  <>
    <linearGradient
      id={`${id}-grad`}
      gradientUnits="userSpaceOnUse"
      x1={tipX - CHART.revealFeatherBack}
      x2={tipX + CHART.revealFeatherFront}
      y1={0}
      y2={0}
    >
      <stop offset={0} stopColor="#fff" />
      <stop offset={1} stopColor="#000" />
    </linearGradient>
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={WIDTH} height={HEIGHT}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={`url(#${id}-grad)`} />
    </mask>
  </>
);

const points = (series: number[], k: number) => YEARS.map((year, i) => ({x: xOfYear(year), y: yOfValue(series[i], k)}));

/** 담뱃값: 반투명 빨간 영역 (세로축에서 시작) */
export const AreaFill: React.FC<{series: number[]; k: number; fill: string; mask: string}> = ({series, k, fill, mask}) => {
  const pts = points(series, k);
  const last = pts[pts.length - 1];
  const d = [
    `M ${CHART.axisX} ${CHART.axisY}`,
    `L ${CHART.axisX} ${pts[0].y}`,
    ...pts.map((p) => `L ${p.x} ${p.y}`),
    `L ${last.x} ${CHART.axisY}`,
    'Z',
  ].join(' ');
  return <path d={d} fill={fill} mask={`url(#${mask})`} />;
};

export const Dots: React.FC<{series: number[]; k: number; color: string; mask: string}> = ({series, k, color, mask}) => (
  <g mask={`url(#${mask})`}>
    {points(series, k).map((p, i) => (
      <circle key={i} cx={p.x} cy={p.y} r={CHART.dotRadius} fill={color} />
    ))}
  </g>
);

export const Line: React.FC<{series: number[]; k: number; color: string; mask: string}> = ({series, k, color, mask}) => (
  <polyline
    points={points(series, k)
      .map((p) => `${p.x},${p.y}`)
      .join(' ')}
    fill="none"
    stroke={color}
    strokeWidth={CHART.lineWidth}
    strokeLinejoin="round"
    mask={`url(#${mask})`}
  />
);
