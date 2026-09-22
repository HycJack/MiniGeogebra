import { describe, expect, it } from 'vitest';
import { rayPlaneIntersect, clipLineToBox, pointSegmentDistance } from '../kernel/view/RayPicker';

describe('RayPicker: ray-plane intersection', () => {
  it('hits a plane in front of the ray', () => {
    const ray = { origin: { x: 0, y: 0, z: 10 }, dir: { x: 0, y: 0, z: -1 } };
    const hit = rayPlaneIntersect(ray, { x: 0, y: 0, z: 1 }, 0); // z=0 平面
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo(10, 9);
    expect(hit!.point.z).toBeCloseTo(0, 9);
  });

  it('returns null for a parallel ray', () => {
    const ray = { origin: { x: 0, y: 0, z: 1 }, dir: { x: 1, y: 0, z: 0 } };
    expect(rayPlaneIntersect(ray, { x: 0, y: 0, z: 1 }, 0)).toBeNull();
  });

  it('returns null when the plane is behind the ray', () => {
    const ray = { origin: { x: 0, y: 0, z: -1 }, dir: { x: 0, y: 0, z: 1 } };
    expect(rayPlaneIntersect(ray, { x: 0, y: 0, z: 1 }, -2)).toBeNull(); // 平面在射线后方
  });
});

describe('RayPicker: line-box clipping (slab method)', () => {
  const box = { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1 };

  it('clips a diagonal line through the box', () => {
    const clip = clipLineToBox({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, box);
    expect(clip).not.toBeNull();
    expect(clip!.tMin).toBeCloseTo(-1, 9); // 直线双向：t=−1 在 (−1,−1,−1) 进入
    expect(clip!.tMax).toBeCloseTo(1, 9);  // t=1 在 (1,1,1) 离开
  });

  it('returns null when the line misses the box', () => {
    const clip = clipLineToBox({ x: 5, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, box);
    expect(clip).toBeNull(); // y=2 恒在盒外
  });

  it('clips a line entering from outside', () => {
    const clip = clipLineToBox({ x: -2, y: 0.5, z: 0 }, { x: 1, y: 0, z: 0 }, box);
    expect(clip).not.toBeNull();
    expect(clip!.tMin).toBeCloseTo(1, 9); // 进入 x=-1 处
    expect(clip!.tMax).toBeCloseTo(3, 9); // 离开 x=1 处
  });
});

describe('RayPicker: point-segment distance', () => {
  it('computes distance to a segment interior', () => {
    expect(pointSegmentDistance({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 2 })).toBeCloseTo(1, 9);
  });

  it('clamps to endpoints outside the segment', () => {
    expect(pointSegmentDistance({ x: 3, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(2, 9);
  });
});
