import React from 'react';
import {Composition} from 'remotion';
import {CigaretteChart} from './CigaretteChart';
import {DURATION_SEC, FPS, HEIGHT, WIDTH} from './config';
import {loadFonts} from './lib/fonts';

loadFonts();

export const RemotionRoot: React.FC = () => (
  <Composition
    id="CigaretteChart"
    component={CigaretteChart}
    durationInFrames={Math.round(DURATION_SEC * FPS)}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
