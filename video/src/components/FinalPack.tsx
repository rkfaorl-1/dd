import React from 'react';
import {Img, staticFile} from 'remotion';
import {COLORS, PACK, T} from '../config';
import {keyframes, progress} from '../lib/anim';
import {PACK_H, PACK_W} from './PackGroup';

// 그래프가 사라진 뒤 가운데에 큰 담뱃갑이 흐릿하게 커지며 등장
export const FinalPack: React.FC<{t: number}> = ({t}) => {
  const t0 = T.finalPackIn;
  const scale =
    PACK.finalScale *
    keyframes(t, [
      [t0, 0.75],
      [t0 + 0.13, 0.98],
      [t0 + 0.18, 1.025],
      [t0 + 0.28, 1.014],
      [t0 + 0.38, 1.002],
      [t0 + 0.48, 1],
    ]);
  const blur = 14 * (1 - progress(t, t0, t0 + 0.22));
  const opacity = progress(t, t0, t0 + 0.16);
  return (
    <div
      style={{
        position: 'absolute',
        left: PACK.finalCenter.x,
        top: PACK.finalCenter.y,
        width: 0,
        height: 0,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        opacity,
      }}
    >
      <Img
        src={staticFile('images/pack.png')}
        style={{
          position: 'absolute',
          left: -PACK_W / 2,
          top: -PACK_H / 2,
          width: PACK_W,
          height: PACK_H,
          filter: `blur(${blur}px) drop-shadow(3px 7px 9px ${COLORS.stickerShadow})`,
        }}
      />
    </div>
  );
};
