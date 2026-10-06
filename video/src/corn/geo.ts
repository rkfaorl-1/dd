// 세계 지도 데이터 (Natural Earth 1:50m, world-atlas 패키지)
import {feature, mesh} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';
import type {FeatureCollection, MultiLineString} from 'geojson';
import world from 'world-atlas/countries-50m.json';

const topo = world as unknown as Topology<{countries: GeometryCollection; land: GeometryCollection}>;

export const LAND = feature(topo, topo.objects.land) as FeatureCollection;

/** 국경선 (나라 사이 경계만) */
export const BORDERS: MultiLineString = mesh(topo, topo.objects.countries, (a, b) => a !== b);

/** 평면 지도용: 남극 대륙 제외 */
export const LAND_NO_ANTARCTICA: FeatureCollection = {
  type: 'FeatureCollection',
  features: LAND.features.map((f) =>
    f.geometry.type === 'MultiPolygon'
      ? {...f, geometry: {...f.geometry, coordinates: f.geometry.coordinates.filter((poly) => poly[0].some(([, lat]) => lat > -60))}}
      : f,
  ),
};
