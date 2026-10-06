// 옥수수 기원 영상: 지구본 → 평면 세계지도 + 말풍선 → 곡물 5종
import React from 'react';
import {AbsoluteFill, Easing, Img, staticFile} from 'remotion';
import {geoCircle, geoDistance, geoEquirectangular, geoOrthographic, geoPath, type GeoPath} from 'd3-geo';
import {FONT_BOLD, HEIGHT, WIDTH} from '../config';
import {EASE, lerp, progress, typeOpacity} from '../lib/anim';
import {useTime} from '../components/MotionBlur';
import {SvgTypeText} from '../components/SvgTypeText';
import {BORDERS, LAND, LAND_NO_ANTARCTICA} from './geo';

export const CORN_DURATION_SEC = 18;

const C = {
  ocean: '#4a4c55',
  land: '#ebe6dc',
  coast: '#8f897e',
  border: '#b3ab9d',
  hatch: '#9e968a',
  green: '#2fbf2a',
  ink: '#141414',
  label: '#2a1a0d',
  labelOutline: '#fff6e8',
};

// 장면 전환 시각 (초)
const T = {
  cornsOut: 5.6,
  globeToFlat: 6.6,
  globeToFlatEnd: 7.1,
  flatOut: 12.8,
  flatOutEnd: 13.3,
  grains: 13.4,
};

const pop = Easing.out(Easing.back(1.8));
const inOut = EASE.inOutCubic;

// ── 초록 지역 (경도, 위도, 반지름°, 나타나는 시각, 사라지는 시각) ──
type Blob = {lon: number; lat: number; r: number; tIn: number; tOut?: number};

const AMERICAS: Blob[] = [
  {lon: -100, lat: 21, r: 5, tIn: 0.2}, // 멕시코 고원
  {lon: -101, lat: 27, r: 8, tIn: 3.0, tOut: 6.2},
  {lon: -98, lat: 35, r: 7, tIn: 3.2, tOut: 6.2},
  {lon: -86, lat: 36, r: 5, tIn: 3.4, tOut: 6.2},
  {lon: -88, lat: 15, r: 6, tIn: 3.3, tOut: 6.2},
  {lon: -74, lat: 5, r: 8, tIn: 3.5, tOut: 6.2},
  {lon: -72, lat: -12, r: 7, tIn: 3.7}, // 안데스
  {lon: -57, lat: -10, r: 9, tIn: 3.9, tOut: 6.2},
  {lon: -47, lat: -18, r: 6, tIn: 4.1, tOut: 6.2},
];

const OLD_WORLD: Blob[] = [
  {lon: 42, lat: 34, r: 6, tIn: 7.3}, // 비옥한 초승달
  {lon: 38, lat: 10, r: 4.5, tIn: 7.45}, // 에티오피아
  {lon: 8, lat: 13, r: 5, tIn: 7.55}, // 사헬
  {lon: 78, lat: 23, r: 7, tIn: 7.65}, // 인도
  {lon: 112, lat: 33, r: 7, tIn: 7.75}, // 중국
  {lon: 102, lat: 15, r: 5, tIn: 7.85}, // 동남아
  {lon: 143, lat: -6, r: 4, tIn: 7.95}, // 뉴기니
];

const blobRadius = (b: Blob, t: number) =>
  b.r * EASE.outCubic(progress(t, b.tIn, b.tIn + 0.9)) * (b.tOut === undefined ? 1 : 1 - inOut(progress(t, b.tOut, b.tOut + 0.5)));

const BlobPaths: React.FC<{blobs: Blob[]; path: GeoPath; t: number}> = ({blobs, path, t}) => (
  <>
    {blobs.map((b, i) => {
      const r = blobRadius(b, t);
      if (r <= 0.05) return null;
      return <path key={i} d={path(geoCircle().center([b.lon, b.lat]).radius(r)()) ?? ''} fill={C.green} />;
    })}
  </>
);

const Hatch: React.FC<{id: string}> = ({id}) => (
  <pattern id={id} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
    <line x1={0} y1={0} x2={0} y2={9} stroke={C.hatch} strokeWidth={1.6} strokeOpacity={0.45} />
  </pattern>
);

// ── 아이콘 ──
const CORN = {src: 'corn/corn.png', aspect: 347 / 420};
const CROPS = {src: 'corn/crops.png', aspect: 560 / 512};

const iconScale = (t: number, tIn: number, tOut = Infinity) =>
  pop(progress(t, tIn, tIn + 0.35)) * (1 - inOut(progress(t, tOut, tOut + 0.25)));

const Icon: React.FC<{src: string; x: number; y: number; h: number; aspect: number; scale: number; rot?: number; flip?: boolean}> = ({
  src,
  x,
  y,
  h,
  aspect,
  scale,
  rot = 0,
  flip = false,
}) => {
  if (scale <= 0) return null;
  const w = h * aspect;
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h * 0.6,
        width: w,
        height: h,
        transform: `rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
        transformOrigin: '50% 80%',
        filter: 'drop-shadow(2px 4px 4px rgba(40, 25, 10, 0.35))',
      }}
    />
  );
};

// 종이 질감을 지도 위에 곱하기로 얹어 오래된 느낌을 냅니다 (말풍선은 제외)
const PaperTint: React.FC<{left?: number; top?: number}> = ({left = 0, top = 0}) => (
  <Img
    src={staticFile('images/paper.jpg')}
    style={{position: 'absolute', left, top, width: WIDTH, height: HEIGHT, mixBlendMode: 'multiply', opacity: 0.55}}
  />
);

// ── 장면 1: 지구본 ──
type Cam = {lon: number; lat: number; scale: number; cy: number};
const CAM_KEYS: [number, Cam][] = [
  [0, {lon: -100, lat: -30, scale: 1700, cy: 1720}],
  [2.4, {lon: -98, lat: -29, scale: 1600, cy: 1625}],
  [3.2, {lon: -80, lat: -15, scale: 850, cy: 1010}],
  [5.8, {lon: -78, lat: -14, scale: 810, cy: 975}],
  [6.6, {lon: -45, lat: 8, scale: 400, cy: 480}],
];

const camAt = (t: number): Cam => {
  let i = 1;
  while (i < CAM_KEYS.length - 1 && t > CAM_KEYS[i][0]) i++;
  const [t0, a] = CAM_KEYS[i - 1];
  const [t1, b] = CAM_KEYS[i];
  const p = inOut(progress(t, t0, t1));
  return {lon: lerp(a.lon, b.lon, p), lat: lerp(a.lat, b.lat, p), scale: lerp(a.scale, b.scale, p), cy: lerp(a.cy, b.cy, p)};
};

const GLOBE_CORNS: [number, number][] = [
  // 1차: 멕시코 고원
  [-101, 20.5], [-97, 18.5], [-104, 23.5], [-99, 24.5], [-94, 17], [-106, 27],
  // 2차: 아메리카 전역
  [-112, 33], [-104, 31], [-96, 31], [-88, 34], [-90, 17], [-85, 13], [-80, 8], [-75, 5], [-69, 3], [-63, 7],
  [-77, -3], [-75, -11], [-69, -16], [-64, -21], [-58, -12], [-50, -7], [-46, -16], [-54, -23],
];
const cornIn = (i: number) => (i < 6 ? 0.5 + i * 0.2 : 3.3 + (i - 6) * 0.1);

const Globe: React.FC<{t: number}> = ({t}) => {
  const cam = camAt(t);
  const proj = geoOrthographic()
    .rotate([-cam.lon, -cam.lat])
    .scale(cam.scale)
    .translate([WIDTH / 2, cam.cy])
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(proj);
  const sphere = path({type: 'Sphere'}) ?? '';
  const land = path(LAND) ?? '';
  const iconH = 60 + 0.045 * cam.scale;
  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute'}}>
        <defs>
          <clipPath id="gl-land">
            <path d={land} />
          </clipPath>
          <filter id="gl-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={cam.scale * 0.012} />
          </filter>
          <radialGradient id="gl-shade" gradientUnits="userSpaceOnUse" cx={WIDTH / 2} cy={cam.cy} r={cam.scale}>
            <stop offset={0.55} stopColor="#000" stopOpacity={0} />
            <stop offset={0.93} stopColor="#000" stopOpacity={0.35} />
            <stop offset={1} stopColor="#000" stopOpacity={0.6} />
          </radialGradient>
          <Hatch id="gl-hatch" />
        </defs>
        <path d={sphere} fill={C.ocean} />
        <path d={land} fill={C.land} stroke={C.coast} strokeWidth={1.2} />
        <rect width={WIDTH} height={HEIGHT} fill="url(#gl-hatch)" clipPath="url(#gl-land)" />
        <path d={path(BORDERS) ?? ''} fill="none" stroke={C.border} strokeWidth={1} />
        <g clipPath="url(#gl-land)">
          <g filter="url(#gl-blur)">
            <BlobPaths blobs={AMERICAS} path={path} t={t} />
          </g>
        </g>
        <path d={sphere} fill="url(#gl-shade)" />
        <path d={sphere} fill="none" stroke="#2c2c30" strokeWidth={3} />
      </svg>
      {GLOBE_CORNS.map(([lon, lat], i) => {
        if (geoDistance([lon, lat], [cam.lon, cam.lat]) > Math.PI / 2 - 0.12) return null;
        const p = proj([lon, lat]);
        if (!p) return null;
        const scale = iconScale(t, cornIn(i), T.cornsOut + i * 0.015);
        return <Icon key={i} src={CORN.src} aspect={CORN.aspect} x={p[0]} y={p[1]} h={iconH} scale={scale} rot={((i * 37) % 30) - 15} />;
      })}
      <PaperTint />
    </AbsoluteFill>
  );
};

// ── 장면 2: 평면 세계지도 ──
const FRAME = {x: 96, y: 48, w: 1728, h: 864};
const FLAT = geoEquirectangular()
  .rotate([-10, 0])
  .center([0, 12])
  .scale((5.2 * 180) / Math.PI)
  .translate([WIDTH / 2, HEIGHT / 2])
  .precision(0.5);
const flatPath = geoPath(FLAT);
const FLAT_LAND = flatPath(LAND_NO_ANTARCTICA) ?? '';
const FLAT_BORDERS = flatPath(BORDERS) ?? '';

const FLAT_ICONS = [
  {...CORN, lon: -100, lat: 22, h: 120, t: 7.4, rot: -8, flip: false},
  {...CROPS, lon: 42, lat: 36, h: 175, t: 7.8, rot: 0, flip: false},
  {...CROPS, lon: 110, lat: 22, h: 150, t: 8.2, rot: 0, flip: true},
];

type BubbleSpec = {text: string; t: number; x: number; y: number; tail: 'bottom' | 'right'; tip: [number, number]};
const BUBBLES: BubbleSpec[] = [
  {text: '특이하게 생겼네?', t: 9.2, x: 230, y: 226, tail: 'bottom', tip: [398, 372]},
  {text: '응 니가 더', t: 10.6, x: 740, y: 252, tail: 'right', tip: [1042, 330]},
];
const BUBBLE_FONT = 46;
const BUBBLE_H = 86;

// G마켓 산스 글자 폭 (em): 한글 0.962, 공백 0.31, 물음표 0.64
const textWidth = (text: string, size: number) =>
  [...text].reduce((w, ch) => w + (ch === ' ' ? 0.31 : ch === '?' ? 0.64 : /[가-힣]/.test(ch) ? 0.962 : 0.6), 0) * size;

const Bubble: React.FC<{b: BubbleSpec; t: number}> = ({b, t}) => {
  const p = progress(t, b.t, b.t + 0.3);
  if (p <= 0) return null;
  const w = textWidth(b.text, BUBBLE_FONT) + 70;
  const h = BUBBLE_H;
  const [tx, ty] = b.tip;
  const tail =
    b.tail === 'bottom'
      ? `M ${b.x + 105} ${b.y + h - 10} L ${tx} ${ty} L ${b.x + 165} ${b.y + h - 10} Z`
      : `M ${b.x + w - 10} ${b.y + 24} L ${tx} ${ty} L ${b.x + w - 10} ${b.y + 62} Z`;
  const shapes = (
    <>
      <rect x={b.x} y={b.y} width={w} height={h} rx={32} />
      <path d={tail} />
    </>
  );
  return (
    <g transform={`translate(${tx} ${ty}) scale(${pop(p)}) translate(${-tx} ${-ty})`} opacity={progress(t, b.t, b.t + 0.08)}>
      {/* 굵은 검은 외곽선: 같은 모양을 두껍게 그린 뒤 흰색으로 덮음 */}
      <g fill={C.ink} stroke={C.ink} strokeWidth={12} strokeLinejoin="round">
        {shapes}
      </g>
      <g fill="#fff">{shapes}</g>
      <SvgTypeText
        text={b.text}
        x={b.x + w / 2}
        y={b.y + h / 2 + BUBBLE_FONT * 0.36}
        anchor="middle"
        font={FONT_BOLD}
        size={BUBBLE_FONT}
        fill={C.ink}
        opacityOf={(i) => typeOpacity(t, b.t + 0.12, 0.06, i, 0.06)}
      />
    </g>
  );
};

const FlatMap: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill>
    <div
      style={{
        position: 'absolute',
        left: FRAME.x,
        top: FRAME.y,
        width: FRAME.w,
        height: FRAME.h,
        overflow: 'hidden',
        border: '3px solid #262626',
        boxSizing: 'border-box',
        boxShadow: '0 10px 28px rgba(40, 25, 10, 0.35)',
      }}
    >
      <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', left: -FRAME.x, top: -FRAME.y}}>
        <defs>
          <clipPath id="fl-land">
            <path d={FLAT_LAND} />
          </clipPath>
          <filter id="fl-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={9} />
          </filter>
          <radialGradient id="fl-shade" gradientUnits="userSpaceOnUse" cx={WIDTH / 2} cy={HEIGHT / 2} r={1050}>
            <stop offset={0.5} stopColor="#000" stopOpacity={0} />
            <stop offset={1} stopColor="#000" stopOpacity={0.45} />
          </radialGradient>
          <Hatch id="fl-hatch" />
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill={C.ocean} />
        <path d={FLAT_LAND} fill={C.land} stroke={C.coast} strokeWidth={1} />
        <rect width={WIDTH} height={HEIGHT} fill="url(#fl-hatch)" clipPath="url(#fl-land)" />
        <path d={FLAT_BORDERS} fill="none" stroke={C.border} strokeWidth={0.8} />
        <g clipPath="url(#fl-land)">
          <g filter="url(#fl-blur)">
            <BlobPaths blobs={[...AMERICAS, ...OLD_WORLD]} path={flatPath} t={t} />
          </g>
        </g>
        <rect width={WIDTH} height={HEIGHT} fill="url(#fl-shade)" />
      </svg>
      {FLAT_ICONS.map((ic, i) => {
        const [x, y] = FLAT([ic.lon, ic.lat]) ?? [0, 0];
        return (
          <Icon key={i} src={ic.src} aspect={ic.aspect} x={x - FRAME.x} y={y - FRAME.y} h={ic.h} scale={iconScale(t, ic.t)} rot={ic.rot} flip={ic.flip} />
        );
      })}
      <PaperTint left={-FRAME.x} top={-FRAME.y} />
    </div>
    <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute'}}>
      {BUBBLES.map((b, i) => (
        <Bubble key={i} b={b} t={t} />
      ))}
    </svg>
  </AbsoluteFill>
);

// ── 장면 3: 곡물 5종 ──
const GRAINS = [
  {label: '옥수수', cx: 230},
  {label: '보리', cx: 521},
  {label: '조', cx: 965},
  {label: '피', cx: 1385},
  {label: '벼', cx: 1730},
];
const GRAIN_SCALE = 0.9; // grains-sepia 원본(2000×667) 대비
const GRAIN_LEFT = 60;
const GRAIN_TOP = 290;

const Grains: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill>
    {GRAINS.map((g, i) => {
      const t0 = T.grains + i * 0.32;
      const p = EASE.outCubic(progress(t, t0, t0 + 0.45));
      if (p <= 0) return null;
      return (
        <Img
          key={i}
          src={staticFile(`corn/grain-${i}.png`)}
          style={{
            position: 'absolute',
            left: GRAIN_LEFT,
            top: GRAIN_TOP + lerp(24, 0, p),
            width: 2000 * GRAIN_SCALE,
            height: 667 * GRAIN_SCALE,
            opacity: p,
          }}
        />
      );
    })}
    <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute'}}>
      {GRAINS.map((g, i) => {
        const x = GRAIN_LEFT + g.cx * GRAIN_SCALE;
        const opacityOf = (c: number) => typeOpacity(t, T.grains + i * 0.32, 0.08, c, 0.08);
        return (
          <g key={i}>
            <SvgTypeText text={g.label} x={x} y={262} anchor="middle" font={FONT_BOLD} size={66} fill={C.labelOutline} bold={7} opacityOf={opacityOf} />
            <SvgTypeText text={g.label} x={x} y={262} anchor="middle" font={FONT_BOLD} size={66} fill={C.label} bold={0.8} opacityOf={opacityOf} />
          </g>
        );
      })}
    </svg>
  </AbsoluteFill>
);

export const CornOrigins: React.FC = () => {
  const t = useTime();
  const swap = inOut(progress(t, T.globeToFlat, T.globeToFlatEnd));
  const flatOut = progress(t, T.flatOut, T.flatOutEnd);
  return (
    <AbsoluteFill style={{backgroundColor: '#f2dcc6'}}>
      <Img src={staticFile('images/paper.jpg')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
      {t < T.globeToFlatEnd && (
        <AbsoluteFill style={{opacity: 1 - swap, transform: `scale(${lerp(1, 0.9, swap)})`}}>
          <Globe t={t} />
        </AbsoluteFill>
      )}
      {t >= T.globeToFlat && t < T.flatOutEnd && (
        <AbsoluteFill style={{opacity: swap * (1 - flatOut), transform: `scale(${lerp(1.06, 1, swap) * lerp(1, 0.96, flatOut)})`}}>
          <FlatMap t={t} />
        </AbsoluteFill>
      )}
      {t >= T.grains && <Grains t={t} />}
    </AbsoluteFill>
  );
};
