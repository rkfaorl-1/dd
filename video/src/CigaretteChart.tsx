import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {T} from './config';
import {Chart, LegendLayer} from './components/chart/Chart';
import {FinalPack} from './components/FinalPack';
import {MotionBlur, useTime} from './components/MotionBlur';
import {PackGroup} from './components/PackGroup';
import {QuestionMarks} from './components/QuestionMarks';
import {RidingIcons} from './components/RidingIcons';
import {chartExit, iconsMoving, legendMoving, packMoving} from './timeline';

export const CigaretteChart: React.FC = () => {
  const t = useTime();
  const exit = chartExit(t);

  return (
    <AbsoluteFill style={{backgroundColor: '#f2dcc6'}}>
      <Img src={staticFile('images/paper.jpg')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />

      {/* 장면 1~4: 담뱃갑 → 그래프 (끝날 때 살짝 작아지며 사라짐) */}
      {t < T.chartOutEnd && (
        <AbsoluteFill style={{transform: `scale(${exit.scale})`, transformOrigin: '960px 440px', opacity: exit.opacity}}>
          <Chart t={t} />
          <MotionBlur active={legendMoving(t)}>
            <LegendLayer />
          </MotionBlur>
          <MotionBlur active={iconsMoving(t)}>
            <RidingIcons />
          </MotionBlur>
          <MotionBlur active={packMoving(t)}>
            <PackGroup part="image" />
          </MotionBlur>
          <PackGroup part="label" />
        </AbsoluteFill>
      )}

      {/* 장면 5: 큰 담뱃갑 + 물음표 */}
      {t >= T.finalPackIn && <FinalPack t={t} />}
      {t >= T.questionLeftIn && (
        <MotionBlur active>
          <QuestionMarks />
        </MotionBlur>
      )}
    </AbsoluteFill>
  );
};
