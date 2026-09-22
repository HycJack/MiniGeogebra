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

/**
 * 直线与圆锥曲线是否相切（判别式为零的相对判据）。
 * 代入消元方式与 intersectLineWithConic 相同，判别式按系数幅值归一。
 */
export function isLineTangentToConic(coeffs: number[], a: number, b: number, c: number): boolean {
  const [A, B, C, D, E, F] = coeffs;
  let qa: number, qb: number, qc: number;
  if (Math.abs(b) > 1e-12) {
    const p = -a / b;
    const q = -c / b;
    qa = A + B * p + C * p * p;
    qb = B * q + 2 * C * p * q + D + E * p;
    qc = C * q * q + E * q + F;
  } else if (Math.abs(a) > 1e-12) {
    const x = -c / a;
    qa = C;
    qb = B * x + E;
    qc = A * x * x + D * x + F;
  } else {
    return false;
  }
  const delta = qb * qb - 4 * qa * qc;
  const scale = Math.max(qb * qb, 4 * Math.abs(qa * qc), 1e-12);
  return Math.abs(delta) <= 1e-9 * scale;
}

/** 实系数三次方程 a·t³ + b·t² + c·t + d = 0 的实根（升序，含重根）。 */
export function solveCubicReal(a: number, b: number, c: number, d: number): number[] {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  if (scale < 1e-14) return []; // 恒等式（两曲线相同），交点不定
  if (Math.abs(a) < 1e-14 * scale) return solveQuadratic(b, c, d);

  // 归一化到 t³ + pt² + qt + r
  const p = b / a, q = c / a, r = d / a;
  const shift = p / 3;
  // 消二次项：t = u - p/3 → u³ + Pu + Q = 0
  const P = q - p * p / 3;
  const Q = 2 * p * p * p / 27 - p * q / 3 + r;
  const disc = Q * Q / 4 + P * P * P / 27;
  const relDisc = disc / Math.max(1, (Q * Q) / 4, Math.abs(P * P * P) / 27);
  let us: number[];

  if (disc > 0 && relDisc > 1e-12) {
    // 单实根
    const sq = Math.sqrt(disc);
    us = [Math.cbrt(-Q / 2 + sq) + Math.cbrt(-Q / 2 - sq)];
  } else if (Math.abs(relDisc) <= 1e-12) {
    // 重根
    const u1 = Math.cbrt(-Q / 2);
    us = [2 * u1, -u1];
  } else {
    // 三个不同实根（三角法）
    const m = 2 * Math.sqrt(-P / 3);
    const angle = Math.acos(Math.min(1, Math.max(-1, 3 * Q / (P * m))));
    us = [0, 1, 2].map(k => m * Math.cos((angle + 2 * Math.PI * k) / 3));
  }

  // Cardano / 三角法在近重根处有数值消去误差，用牛顿法在原方程上精化
  return us.map(u => polishCubicRoot(a, b, c, d, u - shift))
    .sort((x, y) => x - y);
}

/** 牛顿法精化三次方程的根。 */
function polishCubicRoot(a: number, b: number, c: number, d: number, x: number): number {
  for (let i = 0; i < 4; i++) {
    const f = ((a * x + b) * x + c) * x + d;
    const fp = (3 * a * x + 2 * b) * x + c;
    if (fp === 0) break;
    const next = x - f / fp;
    if (next === x) break;
    x = next;
  }
  return x;
}

/**
 * 把退化圆锥曲线（一对直线）分解为两条直线的系数 [a, b, c]（a x + b y + c = 0）。
 * 非退化或数值上无法分解时返回空数组。
 *
 * 做法：把它当作 y 的二次方程，判别式 Δ(x) 必为完全平方 (px+q)²，
 * 两条直线即 y = (−(Bx+E) ± (px+q)) / (2C)（C≈0 时对 x 做同样的分解）。
 */
export function decomposeDegenerateConic(coeffs: number[]): [number, number, number][] {
  const [A, B, C, D, E, F] = coeffs;
  const mag = Math.max(Math.abs(A), Math.abs(B), Math.abs(C), Math.abs(D), Math.abs(E), Math.abs(F), 1);
  const eps = 1e-10 * mag;

  if (Math.abs(C) > eps) {
    // Δ(x) = (Bx+E)² − 4C(Ax²+Dx+F) = (B²−4CA)x² + (2BE−4CD)x + (E²−4CF)
    const alpha = B * B - 4 * C * A;
    const beta = 2 * B * E - 4 * C * D;
    const gamma = E * E - 4 * C * F;
    if (alpha < -eps * Math.abs(C) || gamma < -eps * Math.abs(C)) return [];
    const p = Math.sqrt(Math.max(0, alpha));
    const q = Math.abs(p) > eps ? beta / (2 * p) : Math.sqrt(Math.max(0, gamma));
    // 完全平方自检：(p x + q)² 的交叉项必须匹配
    if (Math.abs(p * p - alpha) > eps * mag || Math.abs(2 * p * q - beta) > eps * mag) return [];
    return [
      [B + p, 2 * C, E + q],
      [B - p, 2 * C, E - q],
    ];
  }

  if (Math.abs(A) > eps) {
    // 对 x 方向做同样的完全平方分解：Δ(y) = (py+q)²
    const alphaY = B * B - 4 * A * C; // C ≈ 0 时即 B²
    const betaY = 2 * B * D - 4 * A * E;
    const gammaY = D * D - 4 * A * F;
    if (gammaY < -eps * Math.abs(A)) return [];
    const p = Math.sqrt(Math.max(0, alphaY));
    const q = Math.abs(p) > eps ? betaY / (2 * p) : Math.sqrt(Math.max(0, gammaY));
    if (Math.abs(2 * p * q - betaY) > eps * mag) return [];
    return [
      [2 * A, B - p, D - q],
      [2 * A, B + p, D + q],
    ];
  }

  // A = C = 0：F = Bxy + Dx + Ey + F0
  if (Math.abs(B) > eps) {
    // 退化 ⟺ B·F0 = D·E，分解为 (Bx+E) 与 (Dy+F0) 两条直线
    if (Math.abs(B * F - D * E) > eps * eps * mag) return [];
    return [
      [B, 0, E],
      [0, D, F],
    ];
  }
  // A = C = B = 0：F = Dx + Ey + F0，本身是（双重）直线
  if (Math.abs(D) > eps || Math.abs(E) > eps) {
    return [[D, E, F]];
  }
  return [];
}

/**
 * 圆锥曲线×圆锥曲线的一般求交（Plücker μ 法），至多 4 个交点。
 *
 * 过程（对标 GeoGebra AlgoIntersectConics）：
 *   1. 解 det(M1 + t·M2) = 0（M 为 3×3 对称矩阵表示），得到使
 *      C = M1 + t·M2 退化的参数 t——退化圆锥是一对直线；
 *   2. 把每条退化圆锥分解成两条直线；
 *   3. 直线与 M1 求交，汇总去重。
 *
 * 两曲线相同（det 恒为零）返回空数组（交点不构成有限集）。
 */
export function intersectConicConic(
  coeffs1: number[],
  coeffs2: number[],
): { x: number; y: number }[] {
  const M1 = conicMatrix(coeffs1);
  const M2 = conicMatrix(coeffs2);

  // det(M1 + t·M2) 的三次系数：行列式对行多重线性，枚举每行取 M1 还是 M2
  const cubic = [0, 0, 0, 0];
  for (let mask = 0; mask < 8; mask++) {
    const rows: number[][] = [];
    let fromM2 = 0;
    for (let r = 0; r < 3; r++) {
      if (mask & (1 << r)) { rows.push(M2[r]); fromM2++; }
      else rows.push(M1[r]);
    }
    cubic[fromM2] += det3(rows);
  }

  const ts = solveCubicReal(cubic[3], cubic[2], cubic[1], cubic[0]);
  const mag2 = Math.max(...coeffs2.map(Math.abs), 1);
  const results: { x: number; y: number }[] = [];

  for (const t of ts) {
    if (!Number.isFinite(t) || Math.abs(t) > 1e12) continue;
    const M = M1.map((row, r) => row.map((v, col) => v + t * M2[r][col]));
    // 混合矩阵必须真的奇异（三次方程有数值误差）
    if (Math.abs(det3(M)) > 1e-9 * mag2 * mag2 * mag2) continue;

    const degenerate = [
      M[0][0], 2 * M[0][1], M[1][1],
      2 * M[0][2], 2 * M[1][2], M[2][2],
    ];
    for (const [la, lb, lc] of decomposeDegenerateConic(degenerate)) {
      for (const pt of intersectLineWithConic(coeffs1, la, lb, lc)) {
        if (!results.some(r => Math.hypot(r.x - pt.x, r.y - pt.y) < 1e-7 * Math.max(1, Math.hypot(pt.x, pt.y)))) {
          results.push(pt);
        }
      }
    }
  }

  return results.slice(0, 4);
}

/** 圆锥曲线系数 → 3×3 对称矩阵 [[A, B/2, D/2], [B/2, C, E/2], [D/2, E/2, F]]。 */
function conicMatrix(coeffs: number[]): number[][] {
  const [A, B, C, D, E, F] = coeffs;
  return [
    [A, B / 2, D / 2],
    [B / 2, C, E / 2],
    [D / 2, E / 2, F],
  ];
}

function det3(m: number[][]): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

// ---------------------------------------------------------------------------
// 标准形分析（供 Focus / Vertex / Asymptote / Directrix / Eccentricity 等命令共用）
// ---------------------------------------------------------------------------

export interface CanonicalConic {
  type: 'circle' | 'ellipse' | 'hyperbola' | 'parabola';
  /** 中心型曲线的中心（抛物线为 null） */
  center: { x: number; y: number } | null;
  /** 中心化 + 旋转后的常数项 f'：λ1·u² + λ2·v² + f' = 0 */
  fPrime: number;
  /** 二次型特征值（λ1 ≥ λ2）与 λ1 特征向量的方向角 */
  lambda1: number;
  lambda2: number;
  theta: number;
  /** 半轴：椭圆 (a≥b)；双曲线 (a=实半轴, b=虚半轴)；圆 a=b；抛物线 null */
  a: number | null;
  b: number | null;
  /** 长轴/实轴方向角（焦点、顶点、准线沿此方向；抛物线为 null） */
  majorAngle: number | null;
  /** 抛物线：顶点 / 对称轴方向角 / 焦准距 p（>0 表示开口沿轴正方向） */
  vertex: { x: number; y: number } | null;
  axisAngle: number | null;
  focalParameter: number | null;
}

/**
 * 把一般二次曲线化为标准形。
 *
 * 中心型：中心 c 满足 Q·c = −(D,E)/2，平移旋转后 λ1u² + λ2v² + f' = 0；
 * 抛物线：二次型秩 1，沿零特征方向为线性项，配方得 (u−u0)² = 2p(v−v0)。
 */
export function analyzeConic(coeffs: number[]): CanonicalConic | null {
  const [A, B, C, D, E, F] = coeffs;
  const mag = Math.max(Math.abs(A), Math.abs(B), Math.abs(C), Math.abs(D), Math.abs(E), Math.abs(F), 1);
  if (mag < 1e-12) return null;

  const trace = A + C;
  const halfDiff = (A - C) / 2;
  const halfB = B / 2;
  const sqrtDisc = Math.sqrt(halfDiff * halfDiff + halfB * halfB);
  const lambda1 = trace / 2 + sqrtDisc;
  const lambda2 = trace / 2 - sqrtDisc;
  // λ1 特征向量方向
  const theta = 0.5 * Math.atan2(B, A - C);
  const scale = Math.max(Math.abs(lambda1), Math.abs(lambda2), Math.abs(F), 1e-12);
  const relDetQ = (A * C - halfB * halfB) / (scale * scale);

  if (Math.abs(relDetQ) > 1e-10) {
    // ---- 中心型 ----
    const denom = 4 * A * C - B * B;
    const center = {
      x: (B * E - 2 * C * D) / denom,
      y: (B * D - 2 * A * E) / denom,
    };
    const fPrime = F + (D * center.x + E * center.y) / 2;
    const type = (() => {
      if (lambda1 * lambda2 > 0) {
        return Math.abs(lambda1 - lambda2) < 1e-9 * Math.max(Math.abs(lambda1), Math.abs(lambda2))
          ? 'circle' : 'ellipse';
      }
      return 'hyperbola';
    })();

    let a: number | null = null;
    let b: number | null = null;
    let majorAngle: number | null = theta + Math.PI / 2; // 椭圆长轴沿 λ2 方向（半轴更大）
    if (type === 'ellipse') {
      // λ 同号、f' 反号；半轴² = −f'/λ，长轴对应较小特征值
      if (fPrime * lambda1 >= 0) return null; // 空集（如 x²+y²+1=0）
      a = Math.sqrt(-fPrime / lambda2);
      b = Math.sqrt(-fPrime / lambda1);
    } else if (type === 'hyperbola') {
      // 实半轴对应与 f' 异号的特征值
      if (lambda1 * fPrime < 0) {
        a = Math.sqrt(-fPrime / lambda1);
        b = Math.sqrt(Math.abs(fPrime / lambda2));
        majorAngle = theta; // 实轴沿 λ1 方向
      } else {
        a = Math.sqrt(-fPrime / lambda2);
        b = Math.sqrt(Math.abs(fPrime / lambda1));
        majorAngle = theta + Math.PI / 2; // 实轴沿 λ2 方向
      }
    }
    return { type, center, fPrime, lambda1, lambda2, theta, a, b, majorAngle, vertex: null, axisAngle: null, focalParameter: null };
  }

  // ---- 抛物线：二次型秩 1，零特征方向是对称轴 ----
  // 平方项坐标 u 沿非零特征值的特征向量，线性项（对称轴）沿零特征方向
  const squaredIsLambda1 = Math.abs(lambda1) >= Math.abs(lambda2);
  const lambdaSqr = squaredIsLambda1 ? lambda1 : lambda2;
  const thetaSqr = squaredIsLambda1 ? theta : theta + Math.PI / 2;
  const thetaAxis = thetaSqr + Math.PI / 2;

  // 旋转后的线性系数：d'u + e'v + f
  const du = D * Math.cos(thetaSqr) + E * Math.sin(thetaSqr);
  const ev = D * Math.cos(thetaAxis) + E * Math.sin(thetaAxis);
  const eigScale = Math.max(Math.abs(lambda1), Math.abs(lambda2), 1e-12);
  if (Math.abs(lambdaSqr) < 1e-10 * eigScale || Math.abs(ev) < 1e-10 * scale) return null;

  // λSqr·u² + du·u + ev·v + F = 0 → λSqr(u − u0)² + ev(v − v0) = 0
  const u0 = -du / (2 * lambdaSqr);
  const v0 = (du * du / (4 * lambdaSqr) - F) / ev;
  const vertex = {
    x: u0 * Math.cos(thetaSqr) - v0 * Math.sin(thetaSqr),
    y: u0 * Math.sin(thetaSqr) + v0 * Math.cos(thetaSqr),
  };
  // (u−u0)² = −(ev/λSqr)·(v−v0) = 4f(v−v0)，焦点 = 顶点 + f·axis，f 带符号
  const focal = -ev / (4 * lambdaSqr);

  return {
    type: 'parabola',
    center: null,
    fPrime: F,
    lambda1, lambda2, theta,
    a: null, b: null, majorAngle: null,
    vertex,
    axisAngle: thetaAxis,
    focalParameter: focal,
  };
}
