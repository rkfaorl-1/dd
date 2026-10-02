/**
 * Material palette for the reference-look room: grimy grey-beige plaster, dark
 * patterned carpet, worn mid-brown oak, navy upholstery, charcoal / dark-green bedding.
 */
import * as THREE from 'three';
import {
  grungyPlasterTextures,
  patternedCarpetTextures,
  quiltTextures,
  woodTexture,
  fabricTextures,
  vctTexture,
} from '../../lib/textures.js';

export function createMaterials() {
  const plaster = grungyPlasterTextures();
  const carpet = patternedCarpetTextures();
  const quilt = quiltTextures();
  const wood = woodTexture();
  const fabric = fabricTextures();
  const std = (params) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params });

  return {
    wall: std({ color: '#b2ada3', map: plaster.map, bumpMap: plaster.bumpMap, bumpScale: 0.9, roughness: 0.93 }),
    ceiling: std({ color: '#a7a198', map: plaster.map, bumpMap: plaster.bumpMap, bumpScale: 0.5, roughness: 0.96 }),
    hallWall: std({ color: '#bfb8aa', map: plaster.map, bumpMap: plaster.bumpMap, bumpScale: 0.8, roughness: 0.92 }),
    carpet: std({ color: new THREE.Color(1.45, 1.45, 1.5), map: carpet.map, bumpMap: carpet.bumpMap, bumpScale: 1.4, roughness: 1 }),
    hallFloor: std({ map: vctTexture(), color: '#a9a49a', roughness: 0.45 }),
    baseboard: std({ color: '#2b2926', roughness: 0.7 }),
    darkTrim: std({ color: '#2e2c2a', roughness: 0.55, metalness: 0.2 }),
    frameShadow: std({ color: '#141414', roughness: 0.6, metalness: 0.2 }),
    doorFrame: std({ color: '#38363a', roughness: 0.5, metalness: 0.3 }),
    doorWood: std({ color: '#6b4530', map: wood, roughness: 0.62 }),
    blackMetal: std({ color: '#161616', roughness: 0.4, metalness: 0.7 }),
    hardware: std({ color: '#2b2b2e', roughness: 0.38, metalness: 0.35 }),
    satinMetal: std({ color: '#8a8c8f', roughness: 0.35, metalness: 0.85 }),
    switchPlate: std({ color: '#c4baa5', map: plaster.map, roughness: 0.5 }),
    windowFrame: std({ color: '#2b2c2e', roughness: 0.5, metalness: 0.3 }),
    sill: std({ color: '#b5afa3', roughness: 0.7 }),
    blind: std({ color: '#77736b', roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: '#1b232c', roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false }),
    wallUnit: std({ color: '#a39d90', map: plaster.map, roughness: 0.6, metalness: 0.2 }),
    grille: std({ color: '#2a2a2a', roughness: 0.6, metalness: 0.3 }),
    oak: std({ color: '#88694a', map: wood, roughness: 0.66 }),
    oakDark: std({ color: '#5f4430', map: wood, roughness: 0.7 }),
    upholstery: std({ color: '#1f2532', map: fabric.map, bumpMap: fabric.bumpMap, bumpScale: 0.6, roughness: 0.95 }),
    sheet: std({ color: '#cbc8c2', map: fabric.map, roughness: 0.95 }),
    pillow: std({ color: '#d5d2cb', map: fabric.map, roughness: 0.95 }),
    comforterCharcoal: std({
      color: '#2d2f33',
      map: quilt.map,
      bumpMap: quilt.bumpMap,
      bumpScale: 1.2,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    comforterGreen: std({
      color: '#3d4b3f',
      map: quilt.map,
      bumpMap: quilt.bumpMap,
      bumpScale: 1.2,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    plasticBlack: std({ color: '#1c1d1f', roughness: 0.5 }),
    plasticDark: std({ color: '#2a2c2f', roughness: 0.6 }),
    laptop: std({ color: '#8d9095', roughness: 0.35, metalness: 0.6 }),
    fabricBlack: std({ color: '#1b1c1e', map: fabric.map, roughness: 1 }),
    paper: std({ color: '#e2ded5', roughness: 0.9 }),
  };
}
