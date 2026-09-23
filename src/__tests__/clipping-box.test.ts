import { describe, expect, it } from 'vitest';
import {
  computeClippingBox,
  clippingCubeEdges,
  isPointInBox,
  REDUCTION_VALUES,
  REDUCTION_SMALL,
  REDUCTION_MEDIUM,
  REDUCTION_LARGE,
  REDUCTION_ENLARGE,
  ViewBounds3,
} from '../kernel/view/ClippingBox';
import { clipLineToBox } from '../kernel/view/RayPicker';

const view: ViewBounds3 = {
  minX: -100, maxX: 100,
  minY: -50, maxY: 50,
  minZ: -40, maxZ: 40,
};

describe('ClippingBox: reduction values (GeoGebra parity)', () => {
  it('matches GeoGebra REDUCTION_VALUES formulas', () => {
    expect(REDUCTION_VALUES[REDUCTION_SMALL]).toBeCloseTo((1 - 1 / Math.sqrt(3)) / 2, 12);
    expect(REDUCTION_VALUES[REDUCTION_MEDIUM]).toBeCloseTo((1 - 1 / Math.sqrt(2)) / 2, 12);
    expect(REDUCTION_VALUES[REDUCTION_LARGE]).toBe(0);
  });

  it('REDUCTION_ENLARGE matches GeoGebra 1.5', () => {
    expect(REDUCTION_ENLARGE).toBe(1.5);
  });
});

describe('ClippingBox: computeClippingBox', () => {
  it('large reduction keeps the box equal to the view bounds', () => {
    const { box, large } = computeClippingBox(view, REDUCTION_LARGE);
    expect(box).toEqual(view);
    // rv=0 时 large 内缩比例 = (1−1.5)/2 = −0.25，每侧外扩全跨度的 25%
    expect(large.minX).toBeCloseTo(view.minX - 50, 9);
    expect(large.maxX).toBeCloseTo(view.maxX + 50, 9);
    expect(large.minY).toBeCloseTo(view.minY - 25, 9);
    expect(large.maxY).toBeCloseTo(view.maxY + 25, 9);
  });

  it('small shrinks more than medium, medium more than large', () => {
    const s = computeClippingBox(view, REDUCTION_SMALL).box;
    const m = computeClippingBox(view, REDUCTION_MEDIUM).box;
    const l = computeClippingBox(view, REDUCTION_LARGE).box;
    expect(s.maxX).toBeLessThan(m.maxX);
    expect(m.maxX).toBeLessThan(l.maxX);
    expect(s.minX).toBeGreaterThan(m.minX);
    expect(m.minX).toBeGreaterThan(l.minX);
  });

  it('line box (large) always contains the strict box', () => {
    for (const r of [REDUCTION_SMALL, REDUCTION_MEDIUM, REDUCTION_LARGE] as const) {
      const { box, large } = computeClippingBox(view, r);
      expect(large.minX).toBeLessThanOrEqual(box.minX);
      expect(large.maxX).toBeGreaterThanOrEqual(box.maxX);
      expect(large.minY).toBeLessThanOrEqual(box.minY);
      expect(large.maxY).toBeGreaterThanOrEqual(box.maxY);
      expect(large.minZ).toBeLessThanOrEqual(box.minZ);
      expect(large.maxZ).toBeGreaterThanOrEqual(box.maxZ);
    }
  });

  it('defaults to medium reduction', () => {
    expect(computeClippingBox(view)).toEqual(computeClippingBox(view, REDUCTION_MEDIUM));
  });

  it('shrinks each axis independently per its range', () => {
    const rv = REDUCTION_VALUES[REDUCTION_MEDIUM];
    const { box } = computeClippingBox(view, REDUCTION_MEDIUM);
    expect(box.maxX).toBeCloseTo(100 - 200 * rv, 9);
    expect(box.maxY).toBeCloseTo(50 - 100 * rv, 9);
    expect(box.maxZ).toBeCloseTo(40 - 80 * rv, 9);
  });
});

describe('ClippingBox: clippingCubeEdges', () => {
  it('returns the 12 cube edges', () => {
    const { box } = computeClippingBox(view, REDUCTION_MEDIUM);
    expect(clippingCubeEdges(box)).toHaveLength(12);
  });

  it('endpoints are box corners and each corner has degree 3', () => {
    const { box } = computeClippingBox(view, REDUCTION_LARGE);
    const edges = clippingCubeEdges(box);
    const key = (p: { x: number; y: number; z: number }) => `${p.x},${p.y},${p.z}`;
    const corners = new Set<string>();
    const degree = new Map<string, number>();
    for (const e of edges) {
      for (const p of [e.a, e.b]) {
        const xs = [box.minX, box.maxX];
        const ys = [box.minY, box.maxY];
        const zs = [box.minZ, box.maxZ];
        expect(xs).toContain(p.x);
        expect(ys).toContain(p.y);
        expect(zs).toContain(p.z);
        const k = key(p);
        corners.add(k);
        degree.set(k, (degree.get(k) ?? 0) + 1);
      }
    }
    expect(corners.size).toBe(8);
    for (const d of degree.values()) expect(d).toBe(3);
  });
});

describe('ClippingBox: isPointInBox + line clip consistency', () => {
  it('accepts points on the boundary and rejects outside', () => {
    const { box } = computeClippingBox(view, REDUCTION_MEDIUM);
    expect(isPointInBox({ x: box.minX, y: 0, z: 0 }, box)).toBe(true);
    expect(isPointInBox({ x: box.maxX + 1, y: 0, z: 0 }, box)).toBe(false);
    expect(isPointInBox({ x: 0, y: 0, z: box.maxZ + 0.01 }, box)).toBe(false);
  });

  it('clipping a line against the large box yields a wider interval than the strict box', () => {
    const { box, large } = computeClippingBox(view, REDUCTION_MEDIUM);
    const origin = { x: -500, y: 0, z: 0 };
    const dir = { x: 1, y: 0, z: 0 };
    const strict = clipLineToBox(origin, dir, box)!;
    const wide = clipLineToBox(origin, dir, large)!;
    expect(wide.tMax - wide.tMin).toBeGreaterThan(strict.tMax - strict.tMin);
    expect(wide.tMin).toBeLessThanOrEqual(strict.tMin);
    expect(wide.tMax).toBeGreaterThanOrEqual(strict.tMax);
  });

  it('a line outside the view misses both boxes', () => {
    const { box, large } = computeClippingBox(view, REDUCTION_LARGE);
    // large 档 large 盒外扩 25%（y 至 75），取更外侧保证两盒都落空
    const origin = { x: 0, y: view.maxY + 50, z: 0 };
    const dir = { x: 1, y: 0, z: 0 };
    expect(clipLineToBox(origin, dir, box)).toBeNull();
    expect(clipLineToBox(origin, dir, large)).toBeNull();
  });
});
