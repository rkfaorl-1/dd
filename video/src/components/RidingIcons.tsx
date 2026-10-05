import React from 'react';
import {Img, staticFile} from 'remotion';
import {COLORS, T} from '../config';
import {lerp} from '../lib/anim';
import {blueIconPos, brownIconPos, iconEnter} from '../timeline';
import {useTime} from './MotionBlur';

// 그림 크기는 원본에서 잰 너비(짜장면 132px, 돈 140px)에 두꺼운 스티커 테두리만큼 더한 값
const ICONS = [
  {src: 'images/jajangmyeon.png', width: 138.4, aspect: 417 / 755, start: T.brownIconStart, pos: brownIconPos},
  {src: 'images/money.png', width: 145.8, aspect: 530 / 750, start: T.blueIconStart, pos: blueIconPos},
];

// 짜장면 / 돈 그림: 왼쪽에서 날아와 선 끝을 따라갑니다
export const RidingIcons: React.FC = () => {
  const t = useTime();
  return (
    <>
      {ICONS.map((icon) => {
        const enter = iconEnter(t, icon.start);
        if (enter <= 0) return null;
        const p = icon.pos(t);
        const w = icon.width;
        const h = w * icon.aspect;
        return (
          <Img
            key={icon.src}
            src={staticFile(icon.src)}
            style={{
              position: 'absolute',
              left: p.x - w / 2 + lerp(-90, 0, enter),
              top: p.y - h / 2 + lerp(-30, 0, enter),
              width: w,
              height: h,
              opacity: enter,
              transform: `scale(${lerp(0.85, 1, enter)})`,
              filter: `drop-shadow(1.5px 3px 3.5px ${COLORS.stickerShadow})`,
            }}
          />
        );
      })}
    </>
  );
};
