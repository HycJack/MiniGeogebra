/**
 * 平面 × 二次曲面的**解析**截面（对标 GeoGebra AlgoIntersectPlaneQuadric 的
 * 合同变换精确求法），替代"采样环拟合椭圆"的近似路径。
 *
 * 方法：把每种曲面写成一般二次型 xᵀA x + 2bᵀx + c = 0，代入平面的正交参数化
 * x = p0 + z1·p1 + z2·p2，得到平面内 2D 二次方程 zᵀQ2 z + 2l2ᵀz + c2 = 0，
 * 对 Q2 做特征分解并配方 → 精确的椭圆/双曲线（中心 + 主轴方向 + 半轴）。
 *
 * 无法用 GeoConic3D 表示的情形返回 null（由调用方决定回退）：
 *   - 抛物截面（锥的平面恰平行于一条母线）；
 *   - 两平行线/两相交线（平面 ∥ 柱轴等退化情形）；
 *   - 空截面（平面与曲面不相交）。
 */
import { Coords4 } from '../core/Coords4';
import { GeoPlane3D } from './GeoPlane3D';
import { GeoQuadric3D } from './GeoQuadric3D';

/** 一般二次型：xᵀ A x + 2 bᵀ x + c = 0（A 行主序 3×3 对称）。 */
interface QuadraticForm {
  A: [number[], number[], number[]];
  b: [number, number, number];
  c: number;
}

export interface QuadricSection {
  kind: 'ellipse' | 'hyperbola';
  center: Coords4;
  /** 椭圆长轴 / 双曲线横轴方向（单位向量，位于截面平面内）。 */
  dir1: Coords4;
  /** 与 dir1 正交的共轭方向。 */
  dir2: Coords4;
  a: number;
  b: number;
}

/** 把四种曲面的解析描述统一为隐式二次型。 */
function quadricQuadraticForm(q: GeoQuadric3D): QuadraticForm {
  const kind = q.getKind();
  if (kind === 'sphere') {
    const c = q.getBase();
    const r = q.getParam();
    // |x−c|² = r²
    return {
      A: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      b: [-c.getX(), -c.getY(), -c.getZ()],
      c: c.getX() ** 2 + c.getY() ** 2 + c.getZ() ** 2 - r * r,
    };
  }
  if (kind === 'ellipsoid') {
    const c = q.getBase();
    const [ra, rb, rc] = q.getRadii();
    const [e1, e2, e3] = q.getBasis();
    // A = E D Eᵀ，D = diag(1/ra², 1/rb², 1/rc²)；b = −A c；c0 = cᵀA c − 1
    const A: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const cols = [e1, e2, e3];
    const inv = [1 / (ra * ra), 1 / (rb * rb), 1 / (rc * rc)];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let v = 0;
        for (let k = 0; k < 3; k++) v += cols[i].dot(cols[k]) * inv[k] * cols[j].dot(cols[k]);
        A[i][j] = v;
      }
    }
    const cx = c.getX(), cy = c.getY(), cz = c.getZ();
    const b: [number, number, number] = [
      -(A[0][0] * cx + A[0][1] * cy + A[0][2] * cz),
      -(A[1][0] * cx + A[1][1] * cy + A[1][2] * cz),
      -(A[2][0] * cx + A[2][1] * cy + A[2][2] * cz),
    ];
    const c0 = cx * (A[0][0] * cx + A[0][1] * cy + A[0][2] * cz)
      + cy * (A[1][0] * cx + A[1][1] * cy + A[1][2] * cz)
      + cz * (A[2][0] * cx + A[2][1] * cy + A[2][2] * cz) - 1;
    return { A: A as [number[], number[], number[]], b, c: c0 };
  }
  if (kind === 'cylinder') {
    const base = q.getBase();
    const a = q.getAxis();
    const r = q.getParam();
    // |x−base|² − ((x−base)·a)² = r²，即 A = I − a aᵀ
    const ax = a.getX(), ay = a.getY(), az = a.getZ();
    const A: number[][] = [
      [1 - ax * ax, -ax * ay, -ax * az],
      [-ay * ax, 1 - ay * ay, -ay * az],
      [-az * ax, -az * ay, 1 - az * az],
    ];
    const bx = base.getX(), by = base.getY(), bz = base.getZ();
    const b: [number, number, number] = [
      -(A[0][0] * bx + A[0][1] * by + A[0][2] * bz),
      -(A[1][0] * bx + A[1][1] * by + A[1][2] * bz),
      -(A[2][0] * bx + A[2][1] * by + A[2][2] * bz),
    ];
    const c0 = bx * (A[0][0] * bx + A[0][1] * by + A[0][2] * bz)
      + by * (A[1][0] * bx + A[1][1] * by + A[1][2] * bz)
      + bz * (A[2][0] * bx + A[2][1] * by + A[2][2] * bz) - r * r;
    return { A: A as [number[], number[], number[]], b, c: c0 };
  }
  // 锥：((x−apex)·a)² = cos²α·|x−apex|²，展开 A = a aᵀ − cos²α·I，b = −A·apex
  const apex = q.getBase();
  const a = q.getAxis();
  const cos2 = Math.cos(q.getParam()) ** 2;
  const ax = a.getX(), ay = a.getY(), az = a.getZ();
  const A: number[][] = [
    [ax * ax - cos2, ax * ay, ax * az],
    [ay * ax, ay * ay - cos2, ay * az],
    [az * ax, az * ay, az * az - cos2],
  ];
  const px = apex.getX(), py = apex.getY(), pz = apex.getZ();
  const b: [number, number, number] = [
    -(A[0][0] * px + A[0][1] * py + A[0][2] * pz),
    -(A[1][0] * px + A[1][1] * py + A[1][2] * pz),
    -(A[2][0] * px + A[2][1] * py + A[2][2] * pz),
  ];
  const c0 = px * (A[0][0] * px + A[0][1] * py + A[0][2] * pz)
    + py * (A[1][0] * px + A[1][1] * py + A[1][2] * pz)
    + pz * (A[2][0] * px + A[2][1] * py + A[2][2] * pz);
  return { A: A as [number[], number[], number[]], b, c: c0 };
}

/** 2×2 对称矩阵 [[p, s],[s, t]] 的特征分解（l1 ≥ l2；特征向量归一化）。 */
function eigen2(p: number, s: number, t: number): { l1: number; l2: number; v1: [number, number]; v2: [number, number] } {
  const trace = p + t;
  const disc = Math.sqrt(Math.max(0, ((p - t) / 2) ** 2 + s * s));
  const l1 = trace / 2 + disc;
  const l2 = trace / 2 - disc;
  if (Math.abs(s) < 1e-14) {
    // 已对角：l1 = max(p, t)，特征向量按对应关系选
    return p >= t
      ? { l1, l2, v1: [1, 0], v2: [0, 1] }
      : { l1, l2, v1: [0, 1], v2: [1, 0] };
  }
  // λ1 的特征向量：(s, l1−p)（对 [[p,s],[s,t]] 满足 (A−λ1 I)v = 0）
  const n1 = Math.hypot(s, l1 - p) || 1;
  const v1: [number, number] = [s / n1, (l1 - p) / n1];
  const v2: [number, number] = [-v1[1], v1[0]];
  return { l1, l2, v1, v2 };
}

/**
 * 精确平面截面。返回 null 表示无法用 GeoConic3D 表示（抛物/两直线/空）。
 */
export function quadricPlaneSection(q: GeoQuadric3D, plane: GeoPlane3D): QuadricSection | null {
  const form = quadricQuadraticForm(q);
  const n = plane.getNormal();
  const d = plane.getDistance();

  // 平面正交参数化：x = p0 + z1·p1 + z2·p2
  const p0 = n.scale(d);
  const ref = Math.abs(n.getZ()) < 0.9 ? Coords4.fromDirection(0, 0, 1) : Coords4.fromDirection(1, 0, 0);
  const p1 = n.cross(ref).normalize();
  const p2 = n.cross(p1).normalize();

  const Av = (v: Coords4): Coords4 => {
    const vx = v.getX(), vy = v.getY(), vz = v.getZ();
    return Coords4.fromDirection(
      form.A[0][0] * vx + form.A[0][1] * vy + form.A[0][2] * vz,
      form.A[1][0] * vx + form.A[1][1] * vy + form.A[1][2] * vz,
      form.A[2][0] * vx + form.A[2][1] * vy + form.A[2][2] * vz,
    );
  };
  const bv = Coords4.fromDirection(form.b[0], form.b[1], form.b[2]);

  // 代入 x = p0 + P z（P = [p1 p2]）：
  //   zᵀ (PᵀAP) z + 2 (A p0 + b)ᵀ P z + (p0ᵀA p0 + 2 bᵀ p0 + c) = 0
  const g = Av(p0).add(bv); // A p0 + b
  const q11 = p1.dot(Av(p1));
  const q12 = p1.dot(Av(p2));
  const q22 = p2.dot(Av(p2));
  const l21 = p1.dot(g);
  const l22 = p2.dot(g);
  const c2 = p0.dot(Av(p0)) + 2 * p0.dot(bv) + form.c;

  const { l1, l2, v1, v2 } = eigen2(q11, q12, q22);
  const eigTol = 1e-9 * Math.max(Math.abs(l1), 1e-30);
  const m1 = v1[0] * l21 + v1[1] * l22; // Vᵀ l2
  const m2 = v2[0] * l21 + v2[1] * l22;
  // 配方后：λ1 ŷ1² + λ2 ŷ2² = K，K = m1²/λ1 + m2²/λ2 − c2
  const kScale = Math.max(
    Math.abs(m1 * m1 / l1), Math.abs(m2 * m2 / l2), Math.abs(c2), 1e-30,
  );
  const kTol = 1e-9 * kScale;

  const centerZ = (y01: number, y02: number): Coords4 =>
    p0.add(p1.scale(y01)).add(p2.scale(y02));

  const build = (kind: 'ellipse' | 'hyperbola', y01: number, y02: number,
                 dir1: [number, number], dir2: [number, number], a: number, b: number): QuadricSection => {
    const d1 = p1.scale(dir1[0]).add(p2.scale(dir1[1])).normalize();
    const d2raw = p1.scale(dir2[0]).add(p2.scale(dir2[1]));
    // 正交化兜底（理论已正交，防数值漂移）
    const d2 = d2raw.sub(d1.scale(d2raw.dot(d1))).normalize();
    return { kind, center: centerZ(y01, y02), dir1: d1, dir2: d2, a, b };
  };

  if (Math.abs(l2) < eigTol) {
    // 秩 1：一条方向无二次约束
    const mTol = 1e-9 * Math.max(Math.abs(m1), Math.abs(m2), 1e-30);
    if (Math.abs(m2) > mTol) return null; // 抛物线（GeoConic3D 无表示）
    // λ1 y1² + c2 = 0：>0 两平行线（不支持），≤0 空
    return null;
  }

  if (l2 > 0) {
    // 正定（Q2 正定 → 截面有界）。椭圆按"长轴在前"输出：
    // 较小特征值 → 较大半轴 → 长轴沿 v2。
    const K = (m1 * m1) / l1 + (m2 * m2) / l2 - c2;
    if (K <= kTol) return null; // 空 / 切点退化
    return build('ellipse', -m1 / l1, -m2 / l2, v2, v1, Math.sqrt(K / l2), Math.sqrt(K / l1));
  }

  // 不定（λ1 > 0 > λ2）→ 双曲线 / 抛物线
  const K = (m1 * m1) / l1 + (m2 * m2) / l2 - c2;
  if (K > kTol) {
    // 横轴沿 λ1 的特征方向：ŷ1²/(K/λ1) − ŷ2²/(−K/λ2) = 1
    return build('hyperbola', -m1 / l1, -m2 / l2, v1, v2, Math.sqrt(K / l1), Math.sqrt(-K / l2));
  }
  if (K < -kTol) {
    // 共轭双曲线：横轴沿 λ2 方向
    return build('hyperbola', -m1 / l1, -m2 / l2, v2, v1, Math.sqrt(-K / l2), Math.sqrt(K / l1));
  }
  // K ≈ 0：抛物线（平面平行于锥的一条母线）
  return null;
}
