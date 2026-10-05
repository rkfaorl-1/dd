import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';

/** Current time in seconds. Use it inside blurred layers so every blur sample sees its own time. */
export const useTime = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps;
};

// 빠르게 움직이는 동안만 카메라 모션 블러를 켭니다 (원본 영상의 잔상 효과)
export const MotionBlur: React.FC<{active: boolean; children: React.ReactNode}> = ({active, children}) =>
  active ? (
    <CameraMotionBlur samples={8} shutterAngle={180}>
      {children}
    </CameraMotionBlur>
  ) : (
    <AbsoluteFill>{children}</AbsoluteFill>
  );
