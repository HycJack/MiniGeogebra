/**
 * 一般二次曲面的 10 系数分类 —— 对标 GeoGebra GeoQuadric3D.classifyQuadric。
 *
 * 系数布局（flat matrix，与官方 AlgoDependentQuadric3D 一致）：
 *   [0]=xx  [1]=yy  [2]=zz  [3]=const
 *   [4]=xy/2  [5]=xz/2  [6]=yz/2  [7]=x/2  [8]=y/2  [9]=z/2
 * 隐式方程 Σ = 0 对应二次型 xᵀAx + 2bᵀx + c，其中
 *   A = [[m0,m4,m5],[m4,m1,m6],[m5,m6,m2]]，b=[m7,m8,m9]，c=m3。
 *
 * 分类走两条路径（对齐官方）：
 *   - det(A) ≈ 0 → classifyNoMidpoint（无中心：柱面/抛物面/退化面族）
 *   - 否则      → classifyMidpoint（有中心：球/椭球/双曲面/锥/空集/点）
 */

/** 官方 getTypeString() 的短键（与 menu.properties 键一致）。 */
export type QuadricTypeString =
  | 'Sphere'
  | 'Ellipsoid'
  | 'Cone'
  | 'Cylinder'
  | 'HyperboloidOneSheet'
  | 'HyperboloidTwoSheets'
  | 'Paraboloid'
  | 'HyperbolicParaboloid'
  | 'ParabolicCylinder'
  | 'HyperbolicCylinder'
  | 'EmptySet'
  | 'Point'
  | 'Plane'
  | 'IntersectingPlanes'
  | 'ParallelPlanes'
  | 'Line'
  | 'Quadric';

/** 英文全名（对齐 menu.properties，供测试与代数区展示）。 */
export const QUADRIC_TYPE_DISPLAY: Record<QuadricTypeString, string> = {
  Sphere: 'Sphere',
  Ellipsoid: 'Ellipsoid',
  Cone: 'Cone',
  Cylinder: 'Cylinder',
  HyperboloidOneSheet: 'Hyperboloid of one sheet',
  HyperboloidTwoSheets: 'Hyperboloid of two sheets',
  Paraboloid: 'Paraboloid',
  HyperbolicParaboloid: 'Hyperbolic Paraboloid',
  ParabolicCylinder: 'Parabolic Cylinder',
  HyperbolicCylinder: 'Hyperbolic Cylinder',
  EmptySet: 'Empty Set',
  Point: 'Point',
  Plane: 'Plane',
  IntersectingPlanes: 'Intersecting Planes',
  ParallelPlanes: 'Parallel Planes',
  Line: 'Line',
  Quadric: 'Quadric',
};

export type FlatQuadricMatrix = number[]; // 长度 10

const EPS = 1e-10;

/** 隐式值 Q(p) = pᵀAp + 2bᵀp + c。 */
export function evaluateFlatQuadric(m: FlatQuadricMatrix, x: number, y: number, z: number): number {
  return (
    m[0] * x * x + m[1] * y * y + m[2] * z * z + m[3] +
    2 * m[4] * x * y + 2 * m[5] * x * z + 2 * m[6] * y * z +
    2 * m[7] * x + 2 * m[8] * y + 2 * m[9] * z
  );
}

/** 对称 3×3 特征多项式 λ³ - trλ² + c2λ - det 的三个实根（可重根）。 */
function eigenvalues3(m: FlatQuadricMatrix): [number, number, number] {
  const a = m[0], b = m[1], c = m[2];
  const d = m[4], e = m[5], f = m[6]; // xy,xz,yz half-coeffs = off-diagonal
  const tr = a + b + c;
  const c2 = a * b - d * d + a * c - e * e + b * c - f * f;
  const det =
    a * b * c - a * f * f - b * e * e - c * d * d + 2 * d * e * f;
  // 求解 λ³ - tr λ² + c2 λ - det = 0（首一）
  const roots = solveCubicMonic(-tr, c2, -det);
  return roots;
}

/** 首一三次方程 x³ + px² + qx + r = 0 的三个实根（数值稳定，允许重根）。 */
function solveCubicMonic(p: number, q: number, r: number): [number, number, number] {
  // 压抑二次项：x = t - p/3
  const shift = p / 3;
  const pp = q - (p * p) / 3;
  const qq = (2 * p * p * p) / 27 - (p * q) / 3 + r;
  const disc = (qq * qq) / 4 + (pp * pp * pp) / 27;
  const roots: number[] = [];

  if (disc > EPS) {
    // 一实根 + 两复根：只取实根，再降次解二次
    const s = Math.sqrt(disc);
    const u = Math.cbrt(-qq / 2 + s);
    const v = Math.cbrt(-qq / 2 - s);
    const real = u + v - shift;
    roots.push(real);
    // 综合除法：x³+px²+qx+r = (x-real)(x²+b x+c)
    const b = p + real;
    const c = q + real * b;
    const delta = b * b - 4 * c;
    if (delta >= -EPS) {
      const sd = Math.sqrt(Math.max(0, delta));
      roots.push((-b + sd) / 2, (-b - sd) / 2);
    } else {
      // 不应发生（实系数三次必有三实或一实）；补重根占位
      roots.push(real, real);
    }
  } else if (disc > -EPS) {
    // 重根：Cardano 给出 t 的根为 2u, -u, -u → x = t - shift
    // 单根 = 2u - shift，二重根 = -u - shift
    const u = Math.cbrt(-qq / 2);
    const singleRoot = 2 * u - shift;
    const doubleRoot = -u - shift;
    roots.push(doubleRoot, doubleRoot, singleRoot);
  } else {
    // 三个不同实根：三角解法
    const rS = Math.sqrt(-(pp * pp * pp) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -qq / (2 * rS))));
    const mag = 2 * Math.sqrt(-pp / 3);
    for (let k = 0; k < 3; k++) {
      roots.push(mag * Math.cos((phi - 2 * Math.PI * k) / 3) - shift);
    }
  }

  // 恰好三个（去重超采样），按升序返回
  while (roots.length < 3) roots.push(roots[roots.length - 1] ?? 0);
  roots.sort((x, y) => x - y);
  return [roots[0], roots[1], roots[2]];
}

function isZero(v: number, scale = 1): boolean {
  return Math.abs(v) <= EPS * Math.max(1, scale);
}

function almostEqual(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= 1e-7 * scale;
}

/**
 * 对角化后的 rank-2 无中心分类（A 两个非零特征值）。
 * u,v 为两个主方向坐标，w 为零空间方向；在该坐标系下
 *   λu u² + λv v² + 2gu u + 2gv v + 2gw w + c' = 0
 * 官方 twoZeroEigenvalues / one-eigen-zero 主逻辑。
 */
function classifyRank2(
  lu: number,
  lv: number,
  gu: number,
  gv: number,
  gw: number,
  cPrime: number,
): QuadricTypeString {
  // 配方到 (u-u0)² 等：把线性项消进常数（零空间方向 w 若有线性则特殊）
  if (!isZero(gw)) {
    // 含 w 的一次项：抛物型（抛物柱面 / 双曲抛物面 / 抛物面）
    // 在 rank2 且 gw≠0 时官方走 parabolicCylinder 或 hyperbolicParaboloid 分支；
    // rank2 + gw≠0 → 抛物柱面（零方向线性）
    return 'ParabolicCylinder';
  }
  const u0 = isZero(lu) ? 0 : -gu / lu;
  const v0 = isZero(lv) ? 0 : -gv / lv;
  const cDiag = cPrime - (isZero(lu) ? 0 : (gu * gu) / lu) - (isZero(lv) ? 0 : (gv * gv) / lv);
  // λu u'² + λv v'² + cDiag = 0 → λu u'² + λv v'² = -cDiag
  const target = -cDiag;
  const sameSign = lu * lv > 0;
  if (isZero(target)) {
    // λu u'² + λv v'² = 0
    if (sameSign) {
      // 只有原点 → 沿 w 的一条线（u'=v'=0）
      return 'Line';
    }
    // 反号 → 两相交平面
    return 'IntersectingPlanes';
  }
  if (sameSign) {
    // 椭圆型：λu u'² + λv v'² = target
    const solvable = lu * target > 0 || lv * target > 0;
    // 同号 λ，target 须与 λ 同号才有解（或一正一负不可能两同号）
    if (lu * target < 0 && lv * target < 0) return 'EmptySet';
    // 有解 → 两平行平面？不，rank2 无 w 线性是椭圆柱面当 target≠0 且同号可解
    // λ 同号 + target 同号可解：椭圆柱面；target 异号：空
    void solvable;
    return 'Cylinder'; // 椭圆柱（含圆柱）
  }
  // 异号 → 双曲型
  // target 任意非零：双曲柱面；target=0 已在上面处理
  return 'HyperbolicCylinder';
}

/**
 * 分类 10 系数一般二次曲面。
 * 返回官方短键；矩阵非法时返回 'Quadric'（未分类）。
 */
export function classifyFlatQuadric(m: FlatQuadricMatrix): QuadricTypeString {
  if (!Array.isArray(m) || m.length < 10 || m.slice(0, 10).some(v => !Number.isFinite(v))) {
    return 'Quadric';
  }
  const scale = Math.max(
    ...m.slice(0, 10).map(Math.abs),
    1,
  );
  if (isZero(scale, 1) && scale <= EPS) return 'Quadric';

  const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9] = m;
  // det(S)
  const detS =
    m0 * m1 * m2 - m0 * m6 * m6 - m1 * m5 * m5 - m2 * m4 * m4 + 2 * m4 * m5 * m6;
  const maxQuad = Math.max(Math.abs(m0), Math.abs(m1), Math.abs(m2), Math.abs(m4), Math.abs(m5), Math.abs(m6));
  const detScale = Math.pow(Math.max(maxQuad, 1e-12), 3);

  if (Math.abs(detS) <= 1e-12 * Math.max(detScale, 1e-30) || Math.abs(detS) < 1e-14 * scale * scale * scale) {
    return classifyNoMidpoint(m);
  }
  return classifyMidpoint(m, detS);
}

function classifyNoMidpoint(m: FlatQuadricMatrix): QuadricTypeString {
  const eigen = eigenvalues3(m).slice().sort((a, b) => a - b);
  const scale = Math.max(Math.abs(eigen[0]), Math.abs(eigen[1]), Math.abs(eigen[2]), 1);
  const z0 = isZero(eigen[0], scale);
  const z1 = isZero(eigen[1], scale);
  const z2 = isZero(eigen[2], scale);

  const zeroCount = [z0, z1, z2].filter(Boolean).length;
  const hasLinear =
    !isZero(m[7]) || !isZero(m[8]) || !isZero(m[9]);

  if (zeroCount === 3) {
    // S = 0：只剩一次项 → 平面；全零则未定义退化
    return hasLinear ? 'Plane' : 'Quadric';
  }
  if (zeroCount === 2) {
    // rank 1：唯一非零特征方向 u；g 分解为平行/垂直分量
    const lu = z0 ? (z1 ? eigen[2] : eigen[1]) : eigen[0];
    const u = principalDirection1(m);
    if (!u) return hasLinear ? 'Plane' : 'Quadric';
    const g = [m[7], m[8], m[9]];
    const gDotU = g[0] * u[0] + g[1] * u[1] + g[2] * u[2];
    const gPar = [gDotU * u[0], gDotU * u[1], gDotU * u[2]];
    const gPerp = Math.hypot(g[0] - gPar[0], g[1] - gPar[1], g[2] - gPar[2]);
    if (gPerp > 1e-9 * Math.max(1, Math.hypot(g[0], g[1], g[2]))) {
      // 零空间方向有线性 → 抛物柱面（x² − z = 0 等）
      return 'ParabolicCylinder';
    }
    // 仅沿 u：λ s² + 2(g·u)s + c = 0；判别式定 平行平面/单平面/空
    const c = m[3];
    const disc = gDotU * gDotU - lu * c;
    const discScale = Math.max(gDotU * gDotU, Math.abs(lu * c), 1e-30);
    if (disc < -1e-12 * discScale) return 'EmptySet';
    if (Math.abs(disc) <= 1e-12 * discScale) return 'Plane';
    return 'ParallelPlanes';
  }
  // rank 2：一个零特征值
  const n = nullSpace3(m);
  const g = [m[7], m[8], m[9]];
  const gw = n ? g[0] * n[0] + g[1] * n[1] + g[2] * n[2] : 0;
  const [lu, lv] = [eigen[0], eigen[1]].some(v => !isZero(v, scale))
    ? pickNonZeroPair(eigen, scale)
    : ([eigen[1], eigen[2]] as [number, number]);
  // 近似把线性项投影到两个主方向（用对角近似足够分类常见型）
  const gu = m[7];
  const gv = m[8];
  if (!isZero(gw, Math.max(1, Math.hypot(g[0], g[1], g[2])))) {
    // 零空间方向有线性：双曲抛物面（鞍）或抛物柱面
    // rank2 + 全局二次异号已有鞍信息；官方 hyperbolicParaboloid 需 rank1 的两个线性…
    // rank2 + gw≠0：抛物柱面（w 线性，u/v 二次）— 若 u,v 异号仍可能是双曲抛物
    if (lu * lv < 0) return 'HyperbolicParaboloid';
    return 'ParabolicCylinder';
  }
  return classifyRank2(lu, lv, gu, gv, 0, m[3]);
}

function pickNonZeroPair(eigen: number[], scale: number): [number, number] {
  const nz = eigen.filter(v => !isZero(v, scale));
  if (nz.length >= 2) return [nz[0], nz[1]];
  // 不应发生（zeroCount 已保证）
  return [eigen[0] || 1, eigen[1] || 1];
}

/** rank1 对称阵的唯一非零特征方向（单位向量）；取最长列近似。 */
function principalDirection1(m: FlatQuadricMatrix): [number, number, number] | null {
  const cols: number[][] = [
    [m[0], m[4], m[5]],
    [m[4], m[1], m[6]],
    [m[5], m[6], m[2]],
  ];
  let best: number[] | null = null;
  let bestLen = 0;
  for (const col of cols) {
    const len = Math.hypot(col[0], col[1], col[2]);
    if (len > bestLen) {
      best = col;
      bestLen = len;
    }
  }
  if (!best || bestLen < 1e-14) return null;
  return [best[0] / bestLen, best[1] / bestLen, best[2] / bestLen];
}

/** 对称 3×3 的一维零空间单位向量（rank≤2 时）。 */
function nullSpace3(m: FlatQuadricMatrix): [number, number, number] | null {
  const A = [
    [m[0], m[4], m[5]],
    [m[4], m[1], m[6]],
    [m[5], m[6], m[2]],
  ];
  // 叉积行向量（退化时两行近似平行也 OK）
  const r0 = A[0], r1 = A[1], r2 = A[2];
  const c1 = cross3(r0, r1);
  const c2 = cross3(r0, r2);
  const c3 = cross3(r1, r2);
  const cands = [c1, c2, c3];
  let best: [number, number, number] | null = null;
  let bestLen = 0;
  for (const c of cands) {
    const len = Math.hypot(c[0], c[1], c[2]);
    // 验证 A n ≈ 0
    if (len < 1e-14) continue;
    const nrm: [number, number, number] = [c[0] / len, c[1] / len, c[2] / len];
    const res = Math.hypot(
      A[0][0] * nrm[0] + A[0][1] * nrm[1] + A[0][2] * nrm[2],
      A[1][0] * nrm[0] + A[1][1] * nrm[1] + A[1][2] * nrm[2],
      A[2][0] * nrm[0] + A[2][1] * nrm[1] + A[2][2] * nrm[2],
    );
    if (res < 1e-9 && len > bestLen) {
      best = nrm;
      bestLen = len;
    }
  }
  return best;
}

function cross3(a: number[], b: number[]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function classifyMidpoint(m: FlatQuadricMatrix, detS: number): QuadricTypeString {
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9] = m;
  // 中心：A c = -b（Cramer / 伴随矩阵）
  const cx = (
    -m1 * m2 * m7 + m1 * m5 * m9 + m2 * m4 * m8 -
    m4 * m6 * m9 - m5 * m6 * m8 + m6 * m6 * m7
  ) / detS;
  const cy = (
    -m0 * m2 * m8 + m0 * m6 * m9 + m2 * m4 * m7 -
    m4 * m5 * m9 + m5 * m5 * m8 - m5 * m6 * m7
  ) / detS;
  const cz = (
    -m0 * m1 * m9 + m0 * m6 * m8 + m1 * m5 * m7 +
    m4 * m4 * m9 - m4 * m5 * m8 - m4 * m6 * m7
  ) / detS;

  const beta = m7 * cx + m8 * cy + m9 * cz + m3;
  const eigen = eigenvalues3(m).slice().sort((a, b) => a - b);
  const scale = Math.max(...eigen.map(Math.abs), 1);

  if (isZero(beta, Math.max(scale, Math.abs(m3), 1))) {
    // 锥（或退化点）
    const allPos = eigen.every(v => v > 0);
    const allNeg = eigen.every(v => v < 0);
    if (allPos || allNeg) return 'Point';
    return 'Cone';
  }

  const target = -beta; // Σ λi ui² = target
  const signs = eigen.map(v => Math.sign(v) || 0);
  const nPos = signs.filter(s => s > 0).length;
  const nNeg = signs.filter(s => s < 0).length;

  if (nPos === 3 || nNeg === 3) {
    // 定号：椭球 / 球 / 空
    const λ = eigen[0];
    const consistent =
      (nPos === 3 && target > 0) || (nNeg === 3 && target < 0);
    if (!consistent) return 'EmptySet';
    // 球：三个特征值相等
    if (almostEqual(eigen[0], eigen[1]) && almostEqual(eigen[0], eigen[2])) {
      void λ;
      return 'Sphere';
    }
    return 'Ellipsoid';
  }

  // 混合符号 → 双曲面
  // 与 target 同号的特征值个数：
  // 2 同号 + 1 异号 → 单叶；1 同号 + 2 异号 → 双叶
  const nSame = eigen.filter(v => (v > 0 && target > 0) || (v < 0 && target < 0)).length;
  if (nSame === 2) return 'HyperboloidOneSheet';
  if (nSame === 1) return 'HyperboloidTwoSheets';
  // nSame = 0 或 3 不应发生（定号已处理）
  return target > 0 === (nPos > nNeg) ? 'HyperboloidOneSheet' : 'HyperboloidTwoSheets';
}

/**
 * 从完整多项式系数（非 half 存储）构造 flat matrix：
 * poly = A_xx x² + A_yy y² + A_zz z² + C + A_xy xy + A_xz xz + A_yz yz + A_x x + A_y y + A_z z
 */
export function flatMatrixFromPolyCoeffs(
  xx: number, yy: number, zz: number, constant: number,
  xy: number, xz: number, yz: number,
  x: number, y: number, z: number,
): FlatQuadricMatrix {
  return [xx, yy, zz, constant, xy / 2, xz / 2, yz / 2, x / 2, y / 2, z / 2];
}
