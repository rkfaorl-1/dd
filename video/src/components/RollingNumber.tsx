import React, {useId} from 'react';
import {COLORS, FONT_BOLD} from '../config';

// "X,XXX원" 슬롯머신 숫자. 각 자리가 따로 굴러가다 목표 숫자에 멈춥니다.
// 위치 값은 글자 크기(em) 기준으로, 원본의 "4,500원"을 측정한 값입니다.
const DIGIT_X = [0.676, 0, -0.658, -1.567]; // 일, 십, 백, 천의 자리 (가운데 기준)
const COMMA_X = -1.109;
const WON_X = 1.475;
const BASELINE = 0.306; // 숫자 가운데 → 기준선
const PITCH = 1.1; // 릴에서 숫자 간격
const WINDOW_TOP = -0.8;
const WINDOW_BOTTOM = 0.17;
const WINDOW_HALF_WIDTH = 0.37;

const mod10 = (n: number) => ((n % 10) + 10) % 10;

type Props = {
  from: number;
  to: number;
  /** eased 0..1 progress per digit column (0 = units) */
  progress: (column: number) => number;
  fontSize: number;
  /** white outline thickness in em */
  outline?: number;
  opacity?: number;
  /** anchor (centre of the digits) in the parent's coordinates */
  x: number;
  y: number;
};

export const RollingNumber: React.FC<Props> = ({from, to, progress, fontSize: F, outline = 0.078, opacity = 1, x, y}) => {
  const id = 'rn' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const baseline = BASELINE * F;
  const r = outline * F;

  const textProps = {
    fontFamily: FONT_BOLD,
    fontSize: F,
    textAnchor: 'middle' as const,
  };

  return (
    <svg
      width={1}
      height={1}
      style={{position: 'absolute', left: x, top: y, overflow: 'visible', opacity}}
    >
      <defs>
        <filter id={`${id}-outline`} x="-20%" y="-50%" width="140%" height="200%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius={r * 0.62} result="dilated" />
          <feGaussianBlur in="dilated" stdDeviation={r * 0.22} result="blurred" />
          <feComponentTransfer in="blurred" result="mask">
            <feFuncA type="linear" slope={6} intercept={-1.2} />
          </feComponentTransfer>
          <feFlood floodColor="#ffffff" />
          <feComposite in2="mask" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {DIGIT_X.map((cx, c) => (
          <clipPath key={c} id={`${id}-clip${c}`}>
            <rect
              x={(cx - WINDOW_HALF_WIDTH) * F}
              y={baseline + WINDOW_TOP * F}
              width={WINDOW_HALF_WIDTH * 2 * F}
              height={(WINDOW_BOTTOM - WINDOW_TOP) * F}
            />
          </clipPath>
        ))}
      </defs>
      <g filter={`url(#${id}-outline)`}>
        {DIGIT_X.map((cx, c) => {
          const a = Math.floor(from / 10 ** c);
          const b = Math.floor(to / 10 ** c);
          const pos = a + (b - a) * progress(c);
          const base = Math.floor(pos);
          const frac = pos - base;
          return (
            <g key={c} clipPath={`url(#${id}-clip${c})`}>
              {[-1, 0, 1, 2].map((d) => (
                <text key={d} {...textProps} x={cx * F} y={baseline + (d - frac) * PITCH * F} fill={COLORS.numberRed}>
                  {mod10(base + d)}
                </text>
              ))}
            </g>
          );
        })}
        <text {...textProps} x={COMMA_X * F} y={baseline} fill={COLORS.numberRed}>
          ,
        </text>
        <text {...textProps} x={WON_X * F} y={baseline} fill={COLORS.ink}>
          원
        </text>
      </g>
    </svg>
  );
};
