/**
 * Shared material palette for the dorm set.
 *
 * Muted beige / grey / brown / off-white, matte finishes. Materials are shared
 * between meshes so the renderer can batch state changes.
 */
import * as THREE from 'three';
import {
  carpetTextures,
  cmuTextures,
  plasterBump,
  woodTexture,
  fabricTextures,
  vctTexture,
  ceilingTileTexture,
} from '../../lib/textures.js';

export function createMaterials() {
  const cmu = cmuTextures();
  const carpet = carpetTextures();
  const wood = woodTexture();
  const fabric = fabricTextures();
  const plaster = plasterBump();

  const std = (params) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params });

  return {
    // --- architecture ---
    wallRoom: std({ color: '#d6cebf', map: cmu.map, bumpMap: cmu.bumpMap, bumpScale: 1.2, roughness: 0.92 }),
    wallHall: std({ color: '#d9d2bf', map: cmu.map, bumpMap: cmu.bumpMap, bumpScale: 1.2, roughness: 0.9 }),
    ceiling: std({ color: '#e6e2d8', bumpMap: plaster, bumpScale: 0.12, roughness: 0.95 }),
    hallCeiling: std({ map: ceilingTileTexture(), roughness: 0.95 }),
    carpet: std({ map: carpet.map, bumpMap: carpet.bumpMap, bumpScale: 1.5, roughness: 1 }),
    vct: std({ map: vctTexture(), roughness: 0.42 }),
    coveBase: std({ color: '#3d3833', roughness: 0.7 }),
    doorFrame: std({ color: '#8f8a80', roughness: 0.55, metalness: 0.25 }),
    doorVeneer: std({ color: '#9a7652', map: wood, roughness: 0.6 }),
    windowFrame: std({ color: '#a3a39e', roughness: 0.45, metalness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#9fb3c4',
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    }),
    blinds: std({ color: '#e3ded2', roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }),
    sill: std({ color: '#cfc8ba', roughness: 0.6 }),
    switchPlate: std({ color: '#f1efe9', roughness: 0.35 }),
    metal: std({ color: '#a5a39e', roughness: 0.35, metalness: 0.8 }),
    darkMetal: std({ color: '#3a3a3a', roughness: 0.45, metalness: 0.6 }),
    brass: std({ color: '#b39a68', roughness: 0.35, metalness: 0.8 }),

    // --- furniture ---
    laminate: std({ color: '#b8996f', map: wood, roughness: 0.62 }),
    laminateDark: std({ color: '#8c7154', map: wood, roughness: 0.65 }),
    hardboard: std({ color: '#8a6f55', roughness: 0.9 }), // wardrobe back panel
    chairWood: std({ color: '#a8875f', map: wood, roughness: 0.6 }),
    mattress: std({ color: '#3b4a5c', roughness: 0.55 }), // institutional vinyl
    sheetWhite: std({ color: '#dcd8cf', map: fabric.map, bumpMap: fabric.bumpMap, bumpScale: 0.5, roughness: 0.95 }),
    comforterNarrator: std({ color: '#66707a', map: fabric.map, bumpMap: fabric.bumpMap, bumpScale: 0.8, roughness: 1, side: THREE.DoubleSide }),
    comforterRoommate: std({ color: '#55534b', map: fabric.map, bumpMap: fabric.bumpMap, bumpScale: 0.8, roughness: 1, side: THREE.DoubleSide }),
    pillow: std({ color: '#d7d3c9', map: fabric.map, roughness: 0.95 }),
    pillowGrey: std({ color: '#9b978e', map: fabric.map, roughness: 0.95 }),
    plasticBlack: std({ color: '#1b1b1c', roughness: 0.45 }),
    plasticWhite: std({ color: '#e7e5df', roughness: 0.4 }),
    plasticGrey: std({ color: '#7d7c78', roughness: 0.6 }),
    binClear: new THREE.MeshStandardMaterial({ color: '#c8cfd4', roughness: 0.3, transparent: true, opacity: 0.55 }),
    fabricDark: std({ color: '#2f3237', map: fabric.map, roughness: 1 }),
    fabricOlive: std({ color: '#5a5a48', map: fabric.map, roughness: 1 }),
    paper: std({ color: '#e8e4da', roughness: 0.9 }),
    ceramic: std({ color: '#d9d4c8', roughness: 0.3 }),
  };
}
