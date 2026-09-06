/**
 * 圆锥曲线解析求解原语（纯函数，不接触 kernel / 几何对象）。
 *
 * 一般二次曲线：A x² + B x y + C y² + D x + E y + F = 0，系数按此顺序存放。
 * 所有函数对系数整体缩放不敏感（结果按定义同比例缩放，判据用相对容差）。
 *
 * 供 AlgoTangent（切线）与 AlgoIntersect（直线-圆锥求交）共用，
 * 避免两处各自推导同一套代入消元。
 */

/** 二次方程求实根，按升序返回。无实根返回空数组。 */
export function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    return [-c / b];
  }
  const delta = b * b - 4 * a * c;
  if (delta < 0) return [];
  if (Math.abs(delta) < 1e-12) return [-b / (2 * a)];
  const s = Math.sqrt(delta);
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}

/** 求 (x, y) 在圆锥曲线上的函数值。|v| < tol ⟺ 点在曲线上（tol 应与 v 的量级匹配）。 */
export function conicValue(coeffs: number[], x: number, y: number): number {
  const [A, B, C, D, E, F] = coeffs;
  return A * x * x + B * x * y + C * y * y + D * x + E * y + F;
}

/**
 * 圆锥曲线是否退化（空集、单点、一对直线）。
 *
 * 判据是 3×3 矩阵行列式为零：
 *   |A    B/2  D/2|
 *   |B/2   C   E/2|
 *   |D/2  E/2   F| = 0
 * 展开为 ACF − (AE² + B²F + CD²)/4 + BDE/4。det3 按系数三次方缩放，
 * 因此容差也必须按 mag³ 缩放，否则「缩放过的同一曲线」判定会翻转。
 */
export function isConicDegenerate(coeffs: number[], mag = 1): boolean {
  const [A, B, C, D, E, F] = coeffs;
  const det3 = A * C * F - (A * E * E + B * B * F + C * D * D) / 4 + (B * D * E) / 4;
  return Math.abs(det3) < 1e-12 * mag * mag * mag;
}

/**
 * 点 (u, v) 关于圆锥曲线的**对偶线**（极线）：a x + b y + c = 0。
 *
 * 这是极坐标的线性化形式：x² → x·u、y² → y·v、xy → (x·v + y·u)/2、
 * x → (x+u)/2、y → (y+v)/2。两个用途共用同一个公式：
 *   - (u, v) 在曲线上时，对偶线就是**过 (u, v) 的切线**；
 *   - (u, v) 在曲线外时，对偶线是**切点弦**——它与圆锥曲线的交点，
 *     恰好是「过该点的切线经过 (u, v)」的那些点（极线的定义）。
 *
 * a = b = 0 时为退化对偶线（无对应直线），由调用方判断。
 */
export function dualLine(coeffs: number[], u: number, v: number): [number, number, number] {
  const [A, B, C, D, E, F] = coeffs;
  return [
    A * u + (B * v) / 2 + D / 2,
    (B * u) / 2 + C * v + E / 2,
    (D * u + E * v) / 2 + F,
  ];
}

/**
 * 直线 a x + b y + c = 0 与圆锥曲线的交点，按 x 升序返回（至多 2 个）。
 *
 * 分两支代入消元，避免除以接近零的系数：
 *   b ≠ 0 → y = (−a x − c)/b，代回得关于 x 的一元二次；
 *   b = 0 → x = −c/a（垂直线），得关于 y 的一元二次。
 *
 * 数值稳定性：二次项系数 qa 接近零时退化为一次方程，由 solveQuadratic 处理；
 * 结果里仍可能出现非有限的浮点垃圾，因此最后统一过滤。
 */
export function intersectLineWithConic(
  coeffs: number[],
  a: number,
  b: number,
  c: number,
): { x: number; y: number }[] {
  const [A, B, C, D, E, F] = coeffs;
  let pts: { x: number; y: number }[];

  if (Math.abs(b) > 1e-12) {
    const p = -a / b;
    const q = -c / b;
    const qa = A + B * p + C * p * p;
    const qb = B * q + 2 * C * p * q + D + E * p;
    const qc = C * q * q + E * q + F;
    pts = solveQuadratic(qa, qb, qc).map(x => ({ x, y: p * x + q }));
  } else if (Math.abs(a) > 1e-12) {
    const x = -c / a;
    const qa = C;
    const qb = B * x + E;
    const qc = A * x * x + D * x + F;
    pts = solveQuadratic(qa, qb, qc).map(y => ({ x, y }));
  } else {
    return []; // 退化直线，无唯一交点
  }

  return pts.filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y));
}
