import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {FONT_BOLD, FONT_MEDIUM} from '../config';

// G마켓 산스 (Gmarket Sans) - 무료 상업용 폰트
export const loadFonts = () =>
  Promise.all([
    loadFont({family: FONT_BOLD, url: staticFile('fonts/GmarketSansBold.woff'), weight: '400'}),
    loadFont({family: FONT_MEDIUM, url: staticFile('fonts/GmarketSansMedium.woff'), weight: '400'}),
  ]);
