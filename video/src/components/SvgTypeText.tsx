import React from 'react';
import {TEXT} from '../config';

type Props = {
  text: string;
  x: number;
  y: number; // baseline
  anchor: 'start' | 'middle' | 'end';
  font: string;
  size: number;
  fill?: string;
  /** extra weight: stroke drawn under the fill, in px */
  bold?: number;
  /** opacity of the character at `index` (spaces included in the count) */
  opacityOf: (index: number) => number;
  opacity?: number;
};

// 한 글자씩 나타나는 SVG 글자 (타자 효과). 안 보이는 글자도 자리는 차지해서 위치가 흔들리지 않습니다.
export const SvgTypeText: React.FC<Props> = ({text, x, y, anchor, font, size, fill = '#000', bold = 0, opacityOf, opacity = 1}) => {
  const spans: React.ReactNode[] = [];
  let gap = 0;
  [...text].forEach((ch, i) => {
    if (ch === ' ') {
      gap += TEXT.spaceWidthEm * size;
      return;
    }
    const o = opacityOf(i);
    spans.push(
      <tspan key={i} dx={gap || undefined} fillOpacity={o} strokeOpacity={o}>
        {ch}
      </tspan>,
    );
    gap = 0;
  });
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={font}
      fontSize={size}
      fill={fill}
      opacity={opacity}
      stroke={bold > 0 ? fill : undefined}
      strokeWidth={bold > 0 ? bold * 2 : undefined}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {spans}
    </text>
  );
};
