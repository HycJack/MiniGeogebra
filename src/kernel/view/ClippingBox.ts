/**
 * 3D 视图裁剪盒 —— 对应 GeoGebra GeoClippingCube3D / DrawClippingCube3D。
 * 纯函数：可见世界包围盒 + 缩减档位 → 严格裁剪盒（面/点）与大盒（线）。
 * 数值公式照抄 GeoGebra REDUCTION_VALUES / REDUCTION_ENLARGE，便于对齐行为。
 */

import type { Box3 } from './RayPicker';

/** 盒尺寸档位（GeoGebra REDUCTION_SMALL/MEDIUM/LARGE）。 */
export type ClippingReduction = 0 | 1 | 2;
export const REDUCTION_SMALL = 0;
export const REDUCTION_MEDIUM = 1;
export const REDUCTION_LARGE = 2;
export const REDUCTION_MAX = 2;

/**
 * 各档位从视口边界内缩的比例 rv（DrawClippingCube3D.REDUCTION_VALUES）：
 * small 内缩最多 → 盒最小；large 不内缩 → 盒 = 视口。
 */
export const REDUCTION_VALUES: readonly number[] = [
  (1 - 1 / Math.sqrt(3)) / 2,
  (1 - 1 / Math.sqrt(2)) / 2,
  0,
];

/** 线裁剪盒相对严格盒的放大系数（GeoGebra REDUCTION_ENLARGE）。 */
export const REDUCTION_ENLARGE = 1.5;

/** 当前相机可见的世界 AABB（裁剪盒的输入基准）。 */
export interface ViewBounds3 {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface ClippingBoxes {
  /** 严格裁剪盒（GeoGebra minMax：面/点等）。 */
  box: Box3;
  /** 线裁剪盒（GeoGebra minMaxLarge：略大，避免线框在边界自裁）。 */
  large: Box3;
}

/**
 * 由可见世界包围盒与缩减档位计算裁剪盒对。
 * large 的内缩比例 rv' = ENLARGE·rv + (1−ENLARGE)/2：
 * 内缩多（rv 大）时 large 仍在视口内但比严格盒大；rv=0 时 large 比视口各大 25%。
 */
export function computeClippingBox(
  view: ViewBounds3,
  reduction: ClippingReduction = REDUCTION_MEDIUM,
): ClippingBoxes {
  const rv = REDUCTION_VALUES[reduction] ?? REDUCTION_VALUES[REDUCTION_MEDIUM];
  const rvLarge = REDUCTION_ENLARGE * rv + (1 - REDUCTION_ENLARGE) / 2;
  const shrink = (lo: number, hi: number, r: number): [number, number] => {
    const d = hi - lo;
    return [lo + d * r, hi - d * r];
  };
  const [bx0, bx1] = shrink(view.minX, view.maxX, rv);
  const [by0, by1] = shrink(view.minY, view.maxY, rv);
  const [bz0, bz1] = shrink(view.minZ, view.maxZ, rv);
  const [lx0, lx1] = shrink(view.minX, view.maxX, rvLarge);
  const [ly0, ly1] = shrink(view.minY, view.maxY, rvLarge);
  const [lz0, lz1] = shrink(view.minZ, view.maxZ, rvLarge);
  return {
    box: { minX: bx0, maxX: bx1, minY: by0, maxY: by1, minZ: bz0, maxZ: bz1 },
    large: { minX: lx0, maxX: lx1, minY: ly0, maxY: ly1, minZ: lz0, maxZ: lz1 },
  };
}

type Corner = [0 | 1, 0 | 1, 0 | 1];

/**
 * 裁剪盒线框的 12 条棱（顶点配对顺序对齐 GeoGebra DrawClippingCube3D.drawSegment）。
 */
export function clippingCubeEdges(box: Box3): { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } }[] {
  const v = (c: Corner): { x: number; y: number; z: number } => ({
    x: c[0] ? box.maxX : box.minX,
    y: c[1] ? box.maxY : box.minY,
    z: c[2] ? box.maxZ : box.minZ,
  });
  const pairs: Array<[Corner, Corner]> = [
    [[0, 0, 0], [1, 0, 0]],
    [[0, 0, 0], [0, 1, 0]],
    [[0, 0, 0], [0, 0, 1]],
    [[1, 1, 0], [0, 1, 0]],
    [[1, 1, 0], [1, 0, 0]],
    [[1, 1, 0], [1, 1, 1]],
    [[1, 0, 1], [0, 0, 1]],
    [[1, 0, 1], [1, 1, 1]],
    [[1, 0, 1], [1, 0, 0]],
    [[0, 1, 1], [1, 1, 1]],
    [[0, 1, 1], [0, 0, 1]],
    [[0, 1, 1], [0, 1, 0]],
  ];
  return pairs.map(([p, q]) => ({ a: v(p), b: v(q) }));
}

/** 点是否在（严格）裁剪盒内，含边界。 */
export function isPointInBox(
  p: { x: number; y: number; z: number },
  box: Box3,
  eps = 1e-9,
): boolean {
  return p.x >= box.minX - eps && p.x <= box.maxX + eps
    && p.y >= box.minY - eps && p.y <= box.maxY + eps
    && p.z >= box.minZ - eps && p.z <= box.maxZ + eps;
}
