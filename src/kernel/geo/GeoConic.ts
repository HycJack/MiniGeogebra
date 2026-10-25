import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';
import { analyzeConic, isConicDegenerate } from './conicSolve';

export type ConicType = 'circle' | 'ellipse' | 'hyperbola' | 'parabola' | 'degenerate';

export class GeoConic extends GeoElement implements Path {
  // 一般二次曲线：A x² + B xy + C y² + D x + E y + F = 0
  constructor(kernel: IKernel, public coeffs: number[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoConic'; }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const [A, B, C, D, E, F] = this.coeffs;

    if (this.isCircle()) {
      const { x: h, y: k } = this.getCenter();
      const r = this.getRadius();
      const hStr = Math.abs(h) < 1e-9 ? '' : h >= 0 ? `- ${this.fmt(h)}` : `+ ${this.fmt(Math.abs(h))}`;
      const kStr = Math.abs(k) < 1e-9 ? '' : k >= 0 ? `- ${this.fmt(k)}` : `+ ${this.fmt(Math.abs(k))}`;
      return `${this.label} : (x ${hStr})² + (y ${kStr})² = ${this.fmt(r)}²`;
    }

    const parts: string[] = [];
    if (Math.abs(A) > 1e-9) parts.push(`${this.fmt(A)}x²`);
    if (Math.abs(B) > 1e-9) parts.push(`${this.fmt(B)}xy`);
    if (Math.abs(C) > 1e-9) parts.push(`${this.fmt(C)}y²`);
    if (Math.abs(D) > 1e-9) parts.push(`${this.fmt(D)}x`);
    if (Math.abs(E) > 1e-9) parts.push(`${this.fmt(E)}y`);
    if (Math.abs(F) > 1e-9) parts.push(`${this.fmt(F)}`);
    let expr = parts.join(' + ').replace(/\+ -/g, '- ');
    if (expr === '') expr = '0';
    return `${this.label} : ${expr} = 0`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const x = PI.getX();
    const y = PI.getY();
    const [a, b, c, d, e, f] = this.coeffs;
    const val = a * x * x + b * x * y + c * y * y + d * x + e * y + f;
    return Math.abs(val) < eps;
  }

  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return 2 * Math.PI; }

  createPathMover(): PathMover {
    return new ConicPathMover(this);
  }

  /** General conic center formula (works for all conics with finite center). */
  getCenter(): { x: number; y: number } {
    const [A, B, C, D, E] = this.coeffs;
    const denom = 4 * A * C - B * B;
    if (Math.abs(denom) < 1e-12) {
      // Parabola — no finite center. Use vertex as anchor.
      return this.getVertex();
    }
    return {
      x: (B * E - 2 * C * D) / denom,
      y: (B * D - 2 * A * E) / denom,
    };
  }

  /** Vertex of parabola (also used as ray origin for sampling). */
  getVertex(): { x: number; y: number } {
    const [A, B, C, D, E, F] = this.coeffs;
    // Axis-aligned parabola: y² + Dx + Ey + F = 0 (A=0, B=0, C≠0)
    if (Math.abs(A) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(C) > 1e-12 && Math.abs(D) > 1e-12) {
      const yv = -E / (2 * C);
      const xv = (E * E - 4 * C * F) / (4 * C * D);
      return { x: xv, y: yv };
    }
    // Axis-aligned parabola: x² + Dx + Ey + F = 0 (C=0, B=0, A≠0)
    if (Math.abs(C) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(A) > 1e-12 && Math.abs(E) > 1e-12) {
      const xv = -D / (2 * A);
      const yv = (D * D - 4 * A * F) / (4 * A * E);
      return { x: xv, y: yv };
    }
    // 旋转抛物线（B≠0）：走 analyzeConic 的完整旋转分析，
    // 不再回退 (0,0)——pointAtAngle / PointOnConic / 采样共用本方法。
    const canonical = analyzeConic(this.coeffs);
    if (canonical && canonical.type === 'parabola' && canonical.vertex) {
      return canonical.vertex;
    }
    return { x: 0, y: 0 };
  }

  translate(v: GeoVec3D): void {
    const dx = v.x;
    const dy = v.y;
    if (this.parentAlgo) {
      this.parentAlgo.getInput().forEach(el => {
        if (el instanceof GeoPoint && el.isIndependent()) {
          el.setCoords(el.getX() + dx, el.getY() + dy);
        }
      });
      this.parentAlgo.update();
    } else {
      // 独立圆锥曲线（方程输入创建，无输入点可搬）：直接平移系数。
      // 曲线平移 (dx,dy) = 旧方程代入 x_old = x−dx, y_old = y−dy 展开同次项
      const [A, B, C, D, E, F] = this.coeffs;
      this.coeffs = [
        A, B, C,
        D - 2 * A * dx - B * dy,
        E - B * dx - 2 * C * dy,
        F + A * dx * dx + B * dx * dy + C * dy * dy - D * dx - E * dy,
      ];
    }
    this.update();
  }

  /** Get radius — only meaningful for circles. */
  getRadius(): number {
    const { x: h, y: k } = this.getCenter();
    const [A, B, C, D, E, F] = this.coeffs;
    if (this.isCircle()) {
      const Fc = A * h * h + C * k * k + D * h + E * k + F;
      const r2 = -Fc / A;
      return r2 > 0 ? Math.sqrt(r2) : 0;
    }
    return this.getApproxRadius();
  }

  /** Approximate semi-major axis for non-circular conics. */
  getApproxRadius(): number {
    const [A, B, C, D, E, F] = this.coeffs;
    const { x: h, y: k } = this.getCenter();
    const Fc = A * h * h + B * h * k + C * k * k + D * h + E * k + F;
    if (Math.abs(Fc) < 1e-12) return 1;
    const trace = A + C;
    const det = A * C - (B * B) / 4;
    const disc = Math.max(0, trace * trace / 4 - det);
    const sqrtDisc = Math.sqrt(disc);
    const lambda1 = trace / 2 + sqrtDisc;
    const lambda2 = trace / 2 - sqrtDisc;
    const a1 = Math.abs(lambda1) > 1e-12 ? Math.sqrt(Math.abs(-Fc / lambda1)) : 1e6;
    const a2 = Math.abs(lambda2) > 1e-12 ? Math.sqrt(Math.abs(-Fc / lambda2)) : 1e6;
    return Math.max(a1, a2);
  }

  isCircle(): boolean {
    const [A, B, C] = this.coeffs;
    return Math.abs(B) < 1e-9 && Math.abs(A - C) < 1e-9 && Math.abs(A) > 1e-9;
  }

  getConicType(): ConicType {
    const [A, B, C, D, E, F] = this.coeffs;
    // 退化（空集/单点/一对直线）优先判定（平移稳健的相对判据）。此前退化曲线会被
    // 误按椭圆/双曲线/抛物线处理（切线/取点/采样全部走错分支）。
    if (isConicDegenerate(this.coeffs)) return 'degenerate';
    if (this.isCircle()) return 'circle';
    const disc = B * B - 4 * A * C;
    // 判别式相对阈值：绝对 1e-9 会把大系数（x²/1e10 − y² = 1）的双曲线误判成抛物线
    const qmag = Math.max(A * A, C * C, 1e-30);
    if (Math.abs(disc) < 1e-12 * qmag) return 'parabola';
    if (disc < 0) return 'ellipse';
    return 'hyperbola';
  }

  /**
   * 圆/椭圆区域（内部判定）。
   * 判据与系数整体符号无关：内部点与中心点的 F 值同号（此前硬编码
   * "中心值 < 0"，同一曲线系数乘 −1 会把内外翻转）。
   */
  isInRegionXY(x0: number, y0: number): boolean {
    const type = this.getConicType();
    // 抛物线/双曲线/退化曲线没有有界内部，不做区域
    if (type !== 'circle' && type !== 'ellipse') return false;
    const [A, B, C, D, E, F] = this.coeffs;
    const center = this.getCenter();
    const valAt = (x: number, y: number) =>
      A * x * x + B * x * y + C * y * y + D * x + E * y + F;
    const centerVal = valAt(center.x, center.y);
    if (Math.abs(centerVal) < 1e-12) return false;
    return valAt(x0, y0) * centerVal >= 0;
  }

  /**
   * 射线求交：自锚点 (h, k) 出发、方向角为 theta 的射线与圆锥曲线的交点参数 t（> 0）。
   * 椭圆/圆至多一个正根；双曲线可能返回两支的解；无交点返回空数组。
   * 由 `pointAtAngle` 与采样共用，避免两处重复的二次方程推导。
   */
  rayIntersections(theta: number, h: number, k: number): number[] {
    const [A, B, C, D, E, F] = this.coeffs;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const a = A * dx * dx + B * dx * dy + C * dy * dy;
    const b = 2 * A * h * dx + B * (h * dy + k * dx) + 2 * C * k * dy + D * dx + E * dy;
    const cVal = A * h * h + B * h * k + C * k * k + D * h + E * k + F;

    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) <= 1e-12) return [];
      const t = -cVal / b;
      return t > 1e-6 ? [t] : [];
    }

    const disc = b * b - 4 * a * cVal;
    if (disc < -1e-9) return [];
    const sqrtDisc = Math.sqrt(Math.max(0, disc));
    const t1 = (-b + sqrtDisc) / (2 * a);
    const t2 = (-b - sqrtDisc) / (2 * a);
    return [t1, t2].filter(t => t > 1e-6);
  }

  /**
   * 求圆锥曲线上“自锚点出发、极角为 theta”的交点，取离锚点最近的一个。
   *
   * 锚点按类型选择：抛物线用顶点（无有限中心），其余用中心。
   * 因此对圆、椭圆、双曲线、抛物线均给出解析解，而非采样近似。
   * 射线未命中曲线时（如双曲线中某些方向两支都未穿过）返回 null。
   */
  pointAtAngle(theta: number): { x: number; y: number } | null {
    const anchor = this.getConicType() === 'parabola' ? this.getVertex() : this.getCenter();
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const candidates = this.rayIntersections(theta, anchor.x, anchor.y).sort((p, q) => p - q);
    const t = candidates[0];
    return t === undefined ? null : { x: anchor.x + t * dx, y: anchor.y + t * dy };
  }

  // ------------------------------------------------------------------
  // 采样
  // ------------------------------------------------------------------

  /**
   * 沿圆锥曲线采样点。
   * 中心型圆锥曲线（圆/椭圆/双曲线）：自中心射线扫描；
   * 抛物线：沿轴参数化。
   */
  samplePoints(nSamples = 360): { x: number; y: number }[] {
    const type = this.getConicType();
    if (type === 'degenerate') return []; // 点/两直线/空集：不按曲线采样（两直线未来应走 GeoLine 表示）
    if (type === 'parabola') return this.sampleParabola(nSamples);
    return this.sampleCentered(nSamples);
  }

  /** 射线扫描采样（圆 / 椭圆 / 双曲线），结果按极角升序排列。 */
  private sampleCentered(nSamples: number): { x: number; y: number }[] {
    const { x: h, y: k } = this.getCenter();
    const allPts: { x: number; y: number; angle: number }[] = [];

    for (let i = 0; i < nSamples; i++) {
      const theta = (2 * Math.PI * i) / nSamples;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      for (const t of this.rayIntersections(theta, h, k)) {
        allPts.push({ x: h + t * dx, y: k + t * dy, angle: theta });
      }
    }

    allPts.sort((p, q) => p.angle - q.angle);
    // 双曲线两支之间存在"射线打不到曲线"的空扇区（渐近线之间）。若不在此断开，
    // 相邻采样点会被直线连接，表现为"两支双曲线端点相连"。圆/椭圆每方向必有
    // 交点，不受影响。NaN 是 polyline 绘制与动画的通用断笔标记。
    const gapStep = (2 * Math.PI / nSamples) * 1.5;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < allPts.length; i++) {
      const p = allPts[i];
      if (i > 0 && p.angle - allPts[i - 1].angle > gapStep) {
        pts.push({ x: NaN, y: NaN });
      }
      pts.push({ x: p.x, y: p.y });
    }
    return pts;
  }

  /** Parametric sampling for parabolas. */
  private sampleParabola(nSamples: number): { x: number; y: number }[] {
    const [A, B, C, D, E, F] = this.coeffs;
    const pts: { x: number; y: number }[] = [];
    const vertex = this.getVertex();

    // y² + Dx + Ey + F = 0 → parametrize by y
    if (Math.abs(A) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(C) > 1e-12 && Math.abs(D) > 1e-12) {
      // x = -(Cy² + Ey + F) / D
      const yCenter = vertex.y;
      // Estimate range: pick a range that covers the visible curve well
      const scale = Math.max(1, Math.abs(vertex.x)) * 2 + 20;
      const yRange = Math.sqrt(Math.abs(scale * D / C));
      for (let i = 0; i <= nSamples; i++) {
        const y = yCenter + (i / nSamples - 0.5) * 2 * yRange;
        const x = -(C * y * y + E * y + F) / D;
        pts.push({ x, y });
      }
      return pts;
    }

    // x² + Dx + Ey + F = 0 → parametrize by x
    if (Math.abs(C) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(A) > 1e-12 && Math.abs(E) > 1e-12) {
      // y = -(Ax² + Dx + F) / E
      const xCenter = vertex.x;
      const scale = Math.max(1, Math.abs(vertex.y)) * 2 + 20;
      const xRange = Math.sqrt(Math.abs(scale * E / A));
      for (let i = 0; i <= nSamples; i++) {
        const x = xCenter + (i / nSamples - 0.5) * 2 * xRange;
        const y = -(A * x * x + D * x + F) / E;
        pts.push({ x, y });
      }
      return pts;
    }

    // Rotated parabola or degenerate — fallback to ray-cast from vertex
    return this.sampleCenteredFrom(vertex.x, vertex.y, nSamples);
  }

  private sampleCenteredFrom(h: number, k: number, nSamples: number): { x: number; y: number }[] {
    const allPts: { x: number; y: number; angle: number }[] = [];
    for (let i = 0; i < nSamples; i++) {
      const theta = (2 * Math.PI * i) / nSamples;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      for (const t of this.rayIntersections(theta, h, k)) {
        allPts.push({ x: h + t * dx, y: k + t * dy, angle: theta });
      }
    }
    allPts.sort((p, q) => p.angle - q.angle);
    return allPts;
  }
}

class ConicPathMover implements PathMover {
  private idx = 0;
  private points: { x: number; y: number }[] = [];

  constructor(private conic: GeoConic) {
    // NaN 断点（双曲线两支间空扇区）不参与动画路径
    this.points = conic.samplePoints(180).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  getCurrentPosition(p: GeoPoint) {
    if (this.points.length === 0) {
      const c = this.conic.getCenter();
      p.setCoords(c.x, c.y, 1);
      return;
    }
    const pt = this.points[this.idx % this.points.length];
    p.setCoords(pt.x, pt.y, 1);
  }
  getNext(p: GeoPoint): boolean {
    if (this.idx >= this.points.length) return false;
    this.idx++;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.idx < this.points.length; }
  resetStartParameter(): void { this.idx = 0; }
  changeOrientation(): void { this.points.reverse(); }
}
