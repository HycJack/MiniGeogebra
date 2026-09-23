import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { Coords4 } from '../kernel/core/Coords4';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  return elements;
};

const outputsOf = <T>(kernel: Kernel, text: string, type: new (...args: any[]) => T): T[] =>
  addInput(kernel, text).filter(el => el instanceof (type as any)) as T[];

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

describe('Ellipse3D (foci + point)', () => {
  it('builds the ellipse from foci (-2,0,0),(2,0,0) through (0,3,0)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-2, 0, 0)');
    addInput(kernel, 'F2 = (2, 0, 0)');
    addInput(kernel, 'P = (0, 3, 0)');
    const [ell] = outputsOf(kernel, 'Ellipse3D(F1, F2, P)', GeoConic3D);
    expect(ell.getKind()).toBe('ellipse');
    // a = (|PF1|+|PF2|)/2 = √13, c = 2, b = √(13−4) = 3
    expect(ell.getA()).toBeCloseTo(Math.sqrt(13), 9);
    expect(ell.getB()).toBeCloseTo(3, 9);
    expect(ell.isOnConic(Coords4.fromPoint(0, 3, 0))).toBe(true);
    // 参数点都在椭圆上
    for (const u of [0, 0.7, 1.3, 2.1, 3.4, 4.9]) {
      expect(ell.isOnConic(ell.pointAt(u))).toBe(true);
    }
  });
});

describe('Hyperbola3D (foci + point)', () => {
  it('builds the hyperbola from foci (±3,0,0) through (2,1,0)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-3, 0, 0)');
    addInput(kernel, 'F2 = (3, 0, 0)');
    addInput(kernel, 'P = (2, 1, 0)');
    const [hyp] = outputsOf(kernel, 'Hyperbola3D(F1, F2, P)', GeoConic3D);
    expect(hyp.getKind()).toBe('hyperbola');
    // a = ||PF1|−|PF2||/2 = (√26−√2)/2；c = 3；b = √(c²−a²)
    const a = (Math.sqrt(26) - Math.sqrt(2)) / 2;
    expect(hyp.getA()).toBeCloseTo(a, 9);
    expect(hyp.getB()).toBeCloseTo(Math.sqrt(9 - a * a), 9);
    expect(hyp.isOnConic(Coords4.fromPoint(2, 1, 0))).toBe(true);
    // 两支参数点都在双曲线上
    for (const u of [-2, -0.8, 0.5, 1.6]) {
      expect(hyp.isOnConic(hyp.pointAt(u))).toBe(true);
    }
  });
});

describe('IntersectConic: plane × quadric → exact conic', () => {
  it('cylinder cut by a perpendicular plane yields a circle (a = b = r)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'xy = Plane3D(P1, P2, P3)');
    const cyl = ofType(kernel, GeoQuadric3D)[0];
    const [section] = outputsOf(kernel, `IntersectConic(xy, ${cyl.label})`, GeoConic3D);
    expect(section.getKind()).toBe('ellipse');
    expect(section.getA()).toBeCloseTo(1, 6);
    expect(section.getB()).toBeCloseTo(1, 6);
  });

  it('cylinder cut by a 45° plane yields an ellipse with semi-axes (√2, 1)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    // 平面 x + z = 2（法向 (1,0,1)，与轴成 45°）
    addInput(kernel, 'P1 = (2, 0, 0)');
    addInput(kernel, 'P2 = (2, 1, 0)');
    addInput(kernel, 'P3 = (1, 0, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cyl = ofType(kernel, GeoQuadric3D)[0];
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${cyl.label})`, GeoConic3D);
    expect(section.getA()).toBeCloseTo(Math.SQRT2, 5);
    expect(section.getB()).toBeCloseTo(1, 5);
    // 拟合出的椭圆上的参数点都应在圆柱面上（距轴 1）
    for (const u of [0, 1, 2, 3, 4, 5]) {
      const p = section.pointAt(u);
      expect(Math.hypot(p.getX(), p.getY())).toBeCloseTo(1, 4);
    }
  });
});

describe('serialization of 3D conics', () => {
  it('round-trips an Ellipse3D and an IntersectConic section', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-2, 0, 0)');
    addInput(kernel, 'F2 = (2, 0, 0)');
    addInput(kernel, 'P = (0, 3, 0)');
    addInput(kernel, 'Ellipse3D(F1, F2, P)');
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'xy = Plane3D(P1, P2, P3)');
    addInput(kernel, `IntersectConic(xy, ${ofType(kernel, GeoQuadric3D)[0].label})`);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const conics = ofType(restored, GeoConic3D);
    expect(conics).toHaveLength(2);
    const ellipse = conics.find(k => k.getKind() === 'ellipse' && Math.abs(k.getA() - Math.sqrt(13)) < 1e-6)!;
    expect(ellipse.isOnConic(Coords4.fromPoint(0, 3, 0))).toBe(true);
  });
});

describe('Parabola3D (focus + directrix)', () => {
  it('builds x² = 4y from F=(0,1,0) and the line y = −1', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F = (0, 1, 0)');
    addInput(kernel, 'A = (0, -1, 0)');
    addInput(kernel, 'B = (1, -1, 0)');
    addInput(kernel, 'd = Line3D(A, B)');
    const [par] = outputsOf(kernel, 'Parabola3D(F, d)', GeoConic3D);
    expect(par.getKind()).toBe('parabola');
    // 顶点 = F 与垂足中点 = (0,0,0)；轴 = +y；焦距 = 1
    const v = par.getCenter();
    expect(v.getX()).toBeCloseTo(0, 9);
    expect(v.getY()).toBeCloseTo(0, 9);
    expect(v.getZ()).toBeCloseTo(0, 9);
    expect(par.getA()).toBeCloseTo(1, 9);
    expect(par.getE1().getX()).toBeCloseTo(0, 9);
    expect(par.getE1().getY()).toBeCloseTo(1, 9);
    // pointAt(t) = (2t, t², 0)：满足 x² = 4y 且在 z = 0 平面
    for (const t of [-2, -0.5, 0, 1, 3]) {
      const p = par.pointAt(t);
      expect(p.getX() * p.getX()).toBeCloseTo(4 * p.getY(), 9);
      expect(p.getZ()).toBeCloseTo(0, 9);
      expect(par.isOnConic(p)).toBe(true);
    }
    expect(par.isOnConic(par.pointAt(1))).toBe(true);
    expect(par.isOnConic(Coords4.fromPoint(1, 0, 0))).toBe(false);
    expect(par.isOnConic(Coords4.fromPoint(0, -1, 0))).toBe(false); // 准线上，非曲线上
  });

  it('focus on the directrix → undefined (degenerate)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F = (0, 0, 0)');
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'd = Line3D(A, B)');
    const [par] = outputsOf(kernel, 'Parabola3D(F, d)', GeoConic3D);
    expect(par.isDefined()).toBe(false);
  });
});

describe('IntersectConic: cone cut parallel to a generator → exact parabola', () => {
  it('45° cone (x²+y²=z²) ∩ plane z = x+1 yields y² = 2x+1', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cone3D(z, 45)');
    // 平面 z = x + 1（法向 (−1,0,1)，⊥ 母线 (1,0,1)）
    addInput(kernel, 'P1 = (0, 0, 1)');
    addInput(kernel, 'P2 = (1, 0, 2)');
    addInput(kernel, 'P3 = (0, 1, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cone = ofType(kernel, GeoQuadric3D)[0];
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${cone.label})`, GeoConic3D);
    expect(section.getKind()).toBe('parabola');
    // y² = 2x+1 → 顶点 (−1/2, 0, 1/2)。平面 z=x+1 上 x 方向弧长被拉伸 √2，
    // 内蕴焦距 = 参数焦距 0.5 / √2 = √2/4（v² = 4a·u 中的 a）
    const v = section.getCenter();
    expect(v.getX()).toBeCloseTo(-0.5, 6);
    expect(v.getY()).toBeCloseTo(0, 6);
    expect(v.getZ()).toBeCloseTo(0.5, 6);
    expect(section.getA()).toBeCloseTo(Math.SQRT2 / 4, 6);
    for (const t of [-3, -1, 0, 0.7, 2, 4]) {
      const p = section.pointAt(t);
      expect(p.getY() * p.getY()).toBeCloseTo(2 * p.getX() + 1, 5);
      expect(p.getX() - p.getZ()).toBeCloseTo(-1, 5); // 在平面上
      expect(section.isOnConic(p)).toBe(true);
    }
  });
});

describe('GeoConic3D matrix: coeffs / polar / degenerate', () => {
  it('ellipse getMatrix matches GeoGebra flat order [A, C, F, B/2, D/2, E/2]', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-2, 0, 0)');
    addInput(kernel, 'F2 = (2, 0, 0)');
    addInput(kernel, 'P = (0, 3, 0)');
    const [ell] = outputsOf(kernel, 'Ellipse3D(F1, F2, P)', GeoConic3D);
    // a = √13, b = 3：u²/13 + v²/9 − 1 = 0
    expect(ell.getCoeffs()[0]).toBeCloseTo(1 / 13, 12);
    expect(ell.getCoeffs()[2]).toBeCloseTo(1 / 9, 12);
    const m = ell.getMatrix();
    expect(m[0]).toBeCloseTo(1 / 13, 12); // A
    expect(m[1]).toBeCloseTo(1 / 9, 12);  // C
    expect(m[2]).toBeCloseTo(-1, 12);     // F
    expect(m[3]).toBeCloseTo(0, 12);      // B/2
    expect(m[4]).toBeCloseTo(0, 12);      // D/2
    expect(m[5]).toBeCloseTo(0, 12);      // E/2
    expect(ell.isDegenerate()).toBe(false);
  });

  it('parabola coeffs v² − 4a u = 0; vertex tangent ⊥ axis; focus polar = directrix', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F = (0, 1, 0)');
    addInput(kernel, 'A = (0, -1, 0)');
    addInput(kernel, 'B = (1, -1, 0)');
    addInput(kernel, 'd = Line3D(A, B)');
    const [par] = outputsOf(kernel, 'Parabola3D(F, d)', GeoConic3D);
    expect(par.getCoeffs()).toEqual([0, 0, 1, -4, 0, 0]);
    expect(par.isDegenerate()).toBe(false);

    // 顶点处对偶线即切线：u = 0，方向沿 e2，⊥ 开口轴 e1
    const tangent = par.polarLine(par.getCenter())!;
    expect(tangent).not.toBeNull();
    const dir = tangent.getDirection().normalize();
    expect(Math.abs(dir.dot(par.getE1()))).toBeCloseTo(0, 9);

    // 焦点的极线 = 准线：平面坐标 u = −a
    const focusPolar = par.polarLine(Coords4.fromPoint(0, 1, 0))!;
    expect(focusPolar).not.toBeNull();
    // 准线过 (0,−1,0) 方向 (1,0,0)：焦点极线应包含该点且方向 ∥ x
    expect(focusPolar.contains(Coords4.fromPoint(0, -1, 0))).toBe(true);
    expect(focusPolar.contains(Coords4.fromPoint(1, -1, 0))).toBe(true);
  });
});

describe('serialization of Parabola3D', () => {
  it('round-trips a Parabola3D via expression reconstruction', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F = (0, 1, 0)');
    addInput(kernel, 'A = (0, -1, 0)');
    addInput(kernel, 'B = (1, -1, 0)');
    addInput(kernel, 'd = Line3D(A, B)');
    addInput(kernel, 'Parabola3D(F, d)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const [par] = ofType(restored, GeoConic3D);
    expect(par).toBeDefined();
    expect(par.getKind()).toBe('parabola');
    expect(par.getA()).toBeCloseTo(1, 9);
    expect(par.isOnConic(Coords4.fromPoint(2, 1, 0))).toBe(true); // pointAt(1)
  });
});
