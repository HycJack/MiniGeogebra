/**
 * 3D 拾取/裁剪纯函数 —— 与渲染器解耦，便于单元测试。
 * 射线-平面求交、线段裁剪、点-线段最近距离。
 */

export interface Ray3 { origin: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number } }

export interface Box3 {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const sub = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/**
 * 射线与平面 n·p = d 求交。dir·n ≈ 0（平行/共面）返回 null。
 * 返回参数 t（> 0 表示在射线前方）与交点。
 */
export function rayPlaneIntersect(
  ray: Ray3,
  normal: { x: number; y: number; z: number },
  d: number,
): { t: number; point: { x: number; y: number; z: number } } | null {
  const denom = dot(ray.dir, normal);
  if (Math.abs(denom) < 1e-12) return null;
  const t = (d - dot(ray.origin, normal)) / denom;
  if (!Number.isFinite(t) || t <= 0) return null;
  return { t, point: { x: ray.origin.x + t * ray.dir.x, y: ray.origin.y + t * ray.dir.y, z: ray.origin.z + t * ray.dir.z } };
}

/**
 * 直线 origin + t·dir 与 AABB 的交点参数区间（slab 法）。
 * 不相交返回 null。
 */
export function clipLineToBox(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  box: Box3,
): { tMin: number; tMax: number } | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  const pairs: Array<[number, number, number]> = [
    [box.minX, box.maxX, dir.x],
    [box.minY, box.maxY, dir.y],
    [box.minZ, box.maxZ, dir.z],
  ];
  const o = [origin.x, origin.y, origin.z];
  for (let i = 0; i < 3; i++) {
    const [lo, hi, d] = pairs[i];
    const p = o[i];
    if (Math.abs(d) < 1e-12) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let t1 = (lo - p) / d;
    let t2 = (hi - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (!Number.isFinite(tMin)) return null;
  return { tMin, tMax };
}

/** 点到线段的最近距离（2D 屏幕空间拾取线段用）。 */
export function pointSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
