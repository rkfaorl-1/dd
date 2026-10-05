import React from 'react';
import {COLORS, HEIGHT, T, WIDTH} from '../config';
import {EASE, lerp, progress} from '../lib/anim';
import {useTime} from './MotionBlur';

// 담뱃갑 양옆에서 노란 물음표가 떨어지며 흔들리는 효과
// 물음표는 원본 비율(가로 약 102px, 세로 약 174px, 큰 점)에 맞춘 도형입니다. 원점 = 물음표 가운데.
const HOOK_PATH = [
  'M -50 -48',
  'C -46 -74, -22 -88, 4 -87',
  'C 32 -86, 52 -68, 51 -45',
  'C 50 -24, 36 -14, 23 -5',
  'C 14 1, 12 8, 12 16',
  'L 12 33 Q 12 38, 7 38 L -7 38 Q -12 38, -12 33 L -12 12',
  'C -12 -3, -2 -13, 8 -21',
  'C 15 -27, 19 -34, 19 -43',
  'C 19 -52, 11 -58, 2 -58',
  'C -10 -58, -17 -52, -21 -44',
  'C -30 -45, -41 -47, -50 -48 Z',
].join(' ');
const DOT = {x: 1, y: 64, r: 24};

type Mark = {
  tIn: number;
  tOut: number;
  from: {x: number; y: number; scale: number};
  to: {x: number; y: number};
  dropDuration: number;
  wobblePhase: number;
};

const MARKS: Mark[] = [
  {tIn: T.questionLeftIn, tOut: T.questionLeftOut, from: {x: 739, y: 210, scale: 1.15}, to: {x: 765, y: 403}, dropDuration: 0.5, wobblePhase: 0},
  {tIn: T.questionRightIn, tOut: T.questionRightOut, from: {x: 1060, y: 293, scale: 1.14}, to: {x: 1085, y: 487}, dropDuration: 0.42, wobblePhase: 1.3},
];

// 물음표 점 주변에 그려지는 떨림 곡선
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const rad = (a: number) => (a * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
};

const QuestionMark: React.FC<{mark: Mark; t: number}> = ({mark, t}) => {
  if (t < mark.tIn || t > mark.tOut + 0.05) return null;
  const pop = progress(t, mark.tIn, mark.tIn + 0.05, EASE.outQuad);
  const out = progress(t, mark.tOut, mark.tOut + 0.05);
  const drop = progress(t, mark.tIn, mark.tIn + mark.dropDuration, EASE.outCubic);
  const x = lerp(mark.from.x, mark.to.x, drop);
  const y = lerp(mark.from.y, mark.to.y, drop);
  const scale = lerp(mark.from.scale, 1, drop) * lerp(0.6, 1, pop) * lerp(1, 0.7, out);
  const age = t - mark.tIn;
  const wobble = 9 * Math.sin(age * 2 * Math.PI * 2.6 + mark.wobblePhase) * Math.exp(-age * 1.2);
  const opacity = pop * (1 - out);
  const arcsVisible = age > 0.05;
  const flicker = Math.floor(age * 14);
  return (
    <g transform={`translate(${x} ${y}) rotate(${wobble}) scale(${scale})`} opacity={opacity}>
      {arcsVisible &&
        [0, 1, 2].map((i) =>
          (flicker + i) % 4 === 0 ? null : (
            <g key={i} stroke={COLORS.question} strokeWidth={3} strokeLinecap="round" fill="none">
              <path d={arc(DOT.x, DOT.y + 30, 42 + i * 16, 100, 185)} />
              <path d={arc(DOT.x, DOT.y + 30, 42 + i * 16, -5, 80)} />
            </g>
          ),
        )}
      <g transform="skewX(-5)">
        <path d={HOOK_PATH} fill={COLORS.question} />
        <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={COLORS.question} />
      </g>
    </g>
  );
};

export const QuestionMarks: React.FC = () => {
  const t = useTime();
  return (
    <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', left: 0, top: 0}}>
      {MARKS.map((mark, i) => (
        <QuestionMark key={i} mark={mark} t={t} />
      ))}
    </svg>
  );
};
