import React from 'react';
import {Img, staticFile} from 'remotion';
import {COLORS, PACK, T} from '../config';
import {clamp01, lerp} from '../lib/anim';
import {packState} from '../timeline';
import {RollingNumber} from './RollingNumber';
import {useTime} from './MotionBlur';

export const PACK_W = PACK.imageWidth * PACK.scale;
export const PACK_H = PACK.imageHeight * PACK.scale;
const NUMBER_FONT_SIZE = 142;

// 담뱃갑 그림 + "X,XXX원" 가격표. 한 덩어리로 움직이고 커졌다 작아집니다.
// 테두리·외곽선·그림자는 작아져도 화면에서 일정한 두께로 보이게 배율로 나눠 줍니다.
// 그림(part="image")은 모션 블러 레이어에, 숫자(part="label")는 선명하게 따로 그립니다.
export const PackGroup: React.FC<{part: 'image' | 'label'}> = ({part}) => {
  const t = useTime();
  if (t < T.packAppear) return null;
  const state = packState(t);
  const s = state.scale;
  const small = clamp01((1 - s) / (1 - PACK.chartScale)); // 0 = 장면 1 크기, 1 = 그래프 아이콘 크기
  const outlinePx = lerp(11, 4.2, small);
  const shadow = {x: lerp(3, 1.5, small) / s, y: lerp(7, 3, small) / s, blur: lerp(9, 3.5, small) / s};
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    left: -PACK_W / 2,
    top: -PACK_H / 2,
    width: PACK_W,
    height: PACK_H,
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: state.x,
        top: state.y,
        width: 0,
        height: 0,
        transform: `scale(${s})`,
        transformOrigin: '0 0',
      }}
    >
      {part === 'image' && (
        <div style={{filter: `drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${COLORS.stickerShadow})`}}>
          <Img src={staticFile('images/pack.png')} style={imgStyle} />
          {small > 0 && <Img src={staticFile('images/pack-chart.png')} style={{...imgStyle, opacity: small}} />}
        </div>
      )}
      {part === 'label' && (
        <RollingNumber
          x={PACK.labelOffset.x}
          y={PACK.labelOffset.y}
          fontSize={NUMBER_FONT_SIZE}
          outline={outlinePx / s / NUMBER_FONT_SIZE}
          from={state.labelFrom}
          to={state.labelTo}
          progress={state.labelProgress}
          opacity={state.labelOpacity}
        />
      )}
    </div>
  );
};
