/**
 * GeoGebra 对齐修复的回归测试（2026-09 比对报告 A 类修复项）。
 * 覆盖：Are* 容差与 Ptolemy 共圆、退化圆锥分类、符号无关区域判定、
 * 旋转抛物线顶点、交点标签防抖、变换活输入、发散积分、Durand-Kerner 残差与重根、
 * 命令嵌套（A1-8）、视区注入与区间参数（A1-9）、随机动画（B8）。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric, AnimationType } from '../kernel/geo/GeoNumeric';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
import { GeoList } from '../kernel/geo/GeoList';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { AlgoPointInRegion } from '../kernel/algo/AlgoRegion';
import { polynomialRealRoots } from '../kernel/algebra/Polynomial';
import { integrate } from '../kernel/algebra/Numerics';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';

import { makeKernel, makePoint, makeLine } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('Are* 关系判断对齐 GeoGebra 容差模型', () => {
  it('近似共线（1e-9 < 偏差 < 1e-5）判 true（绝对容差 1e-5）', async () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 4, 0, 'B');
    // C 的 y 偏差 1e-6：叉积 = 4e-6，介于 1e-9 与 1e-5 之间
    makePoint(kernel, 2, 1e-6, 'C');
    const result = addInput(kernel, 'AreCollinear(A, B, C)');
    const algo = result.find(el => el.constructor.name === 'AlgoAreCollinear') as any;
    expect(algo.output[0].getValue()).toBe(1);
  });

  it('四点共线判共圆 true（Ptolemy，对标 GeoPoint.concyclic）', async () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 1, 0, 'B');
    makePoint(kernel, 2, 0, 'C');
    makePoint(kernel, 3, 0, 'D');
    const result = addInput(kernel, 'AreConcyclic(A, B, C, D)');
    const algo = result.find(el => el.constructor.name === 'AlgoAreConcyclic') as any;
    expect(algo.output[0].getValue()).toBe(1);
  });

  it('真不共圆判 false', async () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 1, 0, 'B');
    makePoint(kernel, 0, 1, 'C');
    makePoint(kernel, 5, 5, 'D');
    const result = addInput(kernel, 'AreConcyclic(A, B, C, D)');
    const algo = result.find(el => el.constructor.name === 'AlgoAreConcyclic') as any;
    expect(algo.output[0].getValue()).toBe(0);
  });
});

describe('圆锥曲线分类与区域', () => {
  it('两相交直线分类为 degenerate', () => {
    const kernel = makeKernel();
    const c = new GeoConic(kernel, [1, 0, -1, 0, 0, 0]); // x² − y² = 0
    expect(c.getConicType()).toBe('degenerate');
    expect(c.samplePoints()).toHaveLength(0);
  });

  it('区域判定与系数整体符号无关', () => {
    const kernel = makeKernel();
    const ellipse = new GeoConic(kernel, [1 / 4, 0, 1, 0, 0, -1]); // x²/4 + y² = 1
    const flipped = new GeoConic(kernel, ellipse.coeffs.map(v => -v));
    expect(ellipse.isInRegionXY(0.5, 0)).toBe(true);
    expect(flipped.isInRegionXY(0.5, 0)).toBe(true);
    expect(ellipse.isInRegionXY(3, 0)).toBe(false);
    expect(flipped.isInRegionXY(3, 0)).toBe(false);
  });

  it('旋转抛物线顶点来自 analyzeConic 而非 (0,0) 回退', () => {
    const kernel = makeKernel();
    // x² − 4(y−1) = 0（顶点 (0,1)）绕原点转 45°：
    // u² − 2uv + v² − 4√2·u − 4√2·v + 8 = 0
    const s2 = Math.SQRT2;
    const c = new GeoConic(kernel, [1, -2, 1, -4 * s2, -4 * s2, 8]);
    expect(c.getConicType()).toBe('parabola');
    const v = c.getVertex();
    expect(Math.hypot(v.x, v.y)).toBeGreaterThan(1e-6); // 不是 (0,0) 回退
    // 该系数代入对应 −45° 旋转：顶点 (0,1) → (√2/2, √2/2)，且在曲线上
    expect(v.x).toBeCloseTo(s2 / 2, 6);
    expect(v.y).toBeCloseTo(s2 / 2, 6);
    const val = c.coeffs[0] * v.x * v.x + c.coeffs[1] * v.x * v.y + c.coeffs[2] * v.y * v.y
      + c.coeffs[3] * v.x + c.coeffs[4] * v.y + c.coeffs[5];
    expect(Math.abs(val)).toBeLessThan(1e-9);
  });
});

describe('PointIn 区域点夹到边界', () => {
  it('椭圆出界点精确夹回边界', () => {
    const kernel = makeKernel();
    const ellipse = new GeoConic(kernel, [1 / 4, 0, 1, 0, 0, -1]);
    kernel.getConstruction().addElement(ellipse);
    const p = new AlgoPointInRegion(kernel, ellipse);
    kernel.getConstruction().addElement(p);
    p.compute();
    // 拖到远处 (10, 0)：应夹到 (2, 0) 边界上
    p.updateParameter(10, 0);
    p.compute();
    expect(p.getOutput().getX()).toBeCloseTo(2, 6);
    expect(p.getOutput().getY()).toBeCloseTo(0, 6);
    // 45° 方向也精确：x²/4 + y² = 1 与方向 (1,1)/√2 的交点
    p.updateParameter(10, 10);
    p.compute();
    const x = p.getOutput().getX();
    const y = p.getOutput().getY();
    expect(x * x / 4 + y * y).toBeCloseTo(1, 6);
  });
});

describe('交点标签防抖（对标 AlgoIntersectAbstract）', () => {
  it('交点经过 undefined 后标签记忆保留，恢复时不互换', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'O');
    // 单位圆：addInput Circle(O, 1)
    addInput(kernel, 'c = Circle(O, 1)');
    const circle = kernel.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    const line = new GeoLine(kernel, 0, 1, -0.5); // y = 0.5
    line.label = 'l';
    kernel.getConstruction().addElement(line);
    const algo = new AlgoIntersect(kernel, line, circle);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();

    const [p1, p2] = algo.getOutputPoints();
    expect(p1.isDefined() && p2.isDefined()).toBe(true);
    const upper = p1.getY() > 0 ? p1 : p2;
    const lower = p1.getY() > 0 ? p2 : p1;
    const upperLabel = upper.label;
    const lowerLabel = lower.label;
    expect(upperLabel).not.toBe(lowerLabel);

    // 移到无交点：两个输出都 undefined
    line.a = 0; line.b = 1; line.c = 5;
    algo.update();
    expect(p1.isDefined() || p2.isDefined()).toBe(false);

    // 移回：标签应保持"上=上、下=下"
    line.a = 0; line.b = 1; line.c = -0.5;
    algo.update();
    expect(p1.isDefined() && p2.isDefined()).toBe(true);
    const upper2 = p1.getY() > 0 ? p1 : p2;
    const lower2 = p1.getY() > 0 ? p2 : p1;
    expect(upper2.label).toBe(upperLabel);
    expect(lower2.label).toBe(lowerLabel);
  });

  it('近切点（解几乎重合）时沿用上次置换不抖动', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'O');
    addInput(kernel, 'c = Circle(O, 1)');
    const circle = kernel.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    const line = new GeoLine(kernel, 0, 1, 0); // y = 0（直径，两个交点）
    kernel.getConstruction().addElement(line);
    const algo = new AlgoIntersect(kernel, line, circle);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();
    const [p1, p2] = algo.getOutputPoints();
    const leftLabel = p1.getX() < 0 ? p1.label : p2.label;
    const rightLabel = p1.getX() < 0 ? p2.label : p1.label;

    // 移到近切点 y = 1 − 1e-9（两交点几乎重合）
    line.a = 0; line.b = 1; line.c = -(1 - 1e-9);
    algo.update();
    // 再回到直径：左右标签应稳定
    line.a = 0; line.b = 1; line.c = 0;
    algo.update();
    const left2 = p1.getX() < 0 ? p1.label : p2.label;
    const right2 = p1.getX() < 0 ? p2.label : p1.label;
    expect(left2).toBe(leftLabel);
    expect(right2).toBe(rightLabel);
  });
});

describe('变换活输入（中心/镜轴联动）', () => {
  it('Rotate(A, 90, B)：移动中心 B 像随之移动', () => {
    const kernel = makeKernel();
    makePoint(kernel, 2, 0, 'A');
    makePoint(kernel, 0, 0, 'B');
    const result = addInput(kernel, 'Rotate(A, 90, B)');
    const image = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(image).toBeDefined();
    // 世界 y-up，正角 = 数学逆时针：A(2,0) 绕原点 90° → (0, 2)
    expect(image.getX()).toBeCloseTo(0, 6);
    expect(image.getY()).toBeCloseTo(2, 6);

    // 移动中心到 (1, 1)：A(2,0) 绕 B(1,1) 逆时针 90° → (2, 2)
    const bPoint = kernel.getConstruction().getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'B') as GeoPoint;
    bPoint.setCoords(1, 1, 1);
    kernel.getConstruction().updateAllAlgorithms();
    expect(image.getX()).toBeCloseTo(2, 6);
    expect(image.getY()).toBeCloseTo(2, 6);
  });

  it('Mirror(A, l)：移动镜轴 l 像随之移动', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    makeLine(kernel, 1, 0, 0, 'l'); // x = 0
    const result = addInput(kernel, 'Mirror(A, l)');
    const image = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(image.getX()).toBeCloseTo(-1, 6);
    expect(image.getY()).toBeCloseTo(1, 6);

    const axis = kernel.getConstruction().getElements().find(el => el instanceof GeoLine && (el as GeoLine).label === 'l') as GeoLine;
    axis.a = 1; axis.b = 0; axis.c = -2; // x = 2
    kernel.getConstruction().updateAllAlgorithms();
    expect(image.getX()).toBeCloseTo(3, 6);
    expect(image.getY()).toBeCloseTo(1, 6);
  });
});

describe('数值修复回归', () => {
  it('Durand-Kerner 重根保留与残差验收', () => {
    // (x−1)² 降幂 [1, −2, 1]：keepDuplicates 保留两个 1
    const dup = polynomialRealRoots([1, -2, 1], { keepDuplicates: true });
    expect(dup).toHaveLength(2);
    expect(dup[0]).toBeCloseTo(1, 6);
    expect(dup[1]).toBeCloseTo(1, 6);
    // 默认去重为一个根
    expect(polynomialRealRoots([1, -2, 1])).toHaveLength(1);
  });

  it('发散积分为 NaN，可积奇点正常积分', () => {
    expect(Number.isFinite(integrate(x => 1 / x, 0, 2).value)).toBe(false);
    expect(Number.isFinite(integrate(x => 1 / ((x - 1) * (x - 1)), 0, 2).value)).toBe(false);
    expect(integrate(x => 1 / Math.sqrt(x), 0, 1).value).toBeCloseTo(2, 0);
  });
});

describe('命令嵌套（A1-8，对标 resArgs 递归求值）', () => {
  it('Midpoint(A, Midpoint(B, C)) 嵌套命令作为参数', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 2, 0, 'B');
    makePoint(kernel, 4, 2, 'C');
    const result = addInput(kernel, 'Midpoint(A, Midpoint(B, C))');
    const mids = result.filter(el => el instanceof GeoPoint) as GeoPoint[];
    expect(mids).toHaveLength(1);
    // Midpoint(B,C) = (3,1)；Midpoint(A, (3,1)) = (1.5, 0.5)
    expect(mids[0].getX()).toBeCloseTo(1.5, 9);
    expect(mids[0].getY()).toBeCloseTo(0.5, 9);
    // 嵌套产物已成为构造成员
    const all = kernel.getConstruction().getElements().filter(el => el instanceof GeoPoint);
    expect(all.length).toBe(5); // A B C + 嵌套中点 + 外层中点
  });

  it('Circle(A, Distance(B, C))：数值型嵌套命令', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 1, 0, 'B');
    makePoint(kernel, 4, 0, 'C');
    const result = addInput(kernel, 'Circle(A, Distance(B, C))');
    const circle = result.find(el => el instanceof GeoConic) as GeoConic;
    expect(circle).toBeDefined();
    expect(circle.getRadius()).toBeCloseTo(3, 9);
  });

  it('嵌套层数过深报错', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 1, 0, 'B');
    const deep = Array.from({ length: 12 }, () => 'Midpoint(A, ').join('') + 'B' + ')'.repeat(12);
    expect(() => addInput(kernel, deep)).toThrow(/nesting|deep/i);
  });
});

describe('视区注入与区间参数（A1-9）', () => {
  it('Root(f) 只搜索视区内', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 - 4'); // 根 ±2
    // 视区 [-3, 3]：两个根都能找到（列表 + 2 个占用槽点）
    const both = parseAlgebraInput(kernel, 'Root(f)', { minX: -3, maxX: 3, minY: -2, maxY: 2 });
    expect(both.filter(el => el instanceof GeoPoint && el.isDefined())).toHaveLength(2);
    // 视区 [0, 3]：只有 +2（定义在创建时；-2 槽点已创建但 undefined）
    const right = parseAlgebraInput(kernel, 'Root(f)', { minX: 0, maxX: 3, minY: -2, maxY: 2 });
    const pts = right.filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    expect(pts).toHaveLength(1);
    expect(pts[0].getX()).toBeCloseTo(2, 9);
  });

  it('Extremum(f, a, b) 尊重显式区间', () => {
    const kernel = makeKernel();
    addInput(kernel, 'g(x) = x^3 - 3x'); // 极值 ±1
    const result = parseAlgebraInput(kernel, 'Extremum(g, 0, 2)', { minX: -5, maxX: 5, minY: -5, maxY: 5 });
    const pts = result.filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    expect(pts).toHaveLength(1); // 区间 [0,2] 内只有极小值 x=1
    expect(pts[0].getX()).toBeCloseTo(1, 9);
    expect(pts[0].getY()).toBeCloseTo(-2, 9);
  });
});

describe('随机动画类型（B8）', () => {
  it('RANDOM 每步在区间内随机跳值', () => {
    const kernel = makeKernel();
    const n = new GeoNumeric(kernel, 0);
    kernel.getConstruction().addElement(n);
    n.intervalMin = 0;
    n.intervalMax = 10;
    n.setAnimationType(AnimationType.RANDOM);
    n.setAnimating(true);
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) n.doAnimationStep(30);
    seen.push(n.getValue());
    expect(seen[0]).toBeGreaterThanOrEqual(0);
    expect(seen[0]).toBeLessThanOrEqual(10);
    // 连续两步取值大概率不同（随机跳值）
    const v1 = n.getValue();
    n.doAnimationStep(30);
    const v2 = n.getValue();
    expect(v1 === v2 && v1 === 0).toBe(false);
  });
});

describe('A3-1：平面 × 二次曲面解析截面', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };
  const outputsOf = <T>(kernel: Kernel, text: string, type: new (...args: any[]) => T): T[] =>
    addInput(kernel, text).filter(el => el instanceof (type as any)) as T[];

  it('球被 z=1 平面截出精确圆（r=√3，圆心 (0,0,1)）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Sphere3D(O, 2)');
    addInput(kernel, 'T1 = (0, 0, 1)');
    addInput(kernel, 'T2 = (1, 0, 1)');
    addInput(kernel, 'T3 = (0, 1, 1)');
    addInput(kernel, 'cut = Plane3D(T1, T2, T3)');
    const sphere = kernel.getConstruction().getElements().find(el => el.constructor.name === 'GeoQuadric3D') as any;
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${sphere.label})`, GeoConic3D);
    expect(section.getKind()).toBe('ellipse');
    expect(section.getA()).toBeCloseTo(Math.sqrt(3), 9);
    expect(section.getB()).toBeCloseTo(Math.sqrt(3), 9);
    const c = section.getCenter();
    expect(c.getX()).toBeCloseTo(0, 9);
    expect(c.getZ()).toBeCloseTo(1, 9);
  });

  it('圆柱被 45° 斜面截出精确椭圆 (√2, 1)，中心在轴与平面的交点', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    addInput(kernel, 'P1 = (2, 0, 0)');
    addInput(kernel, 'P2 = (2, 1, 0)');
    addInput(kernel, 'P3 = (1, 0, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cyl = kernel.getConstruction().getElements().find(el => el.constructor.name === 'GeoQuadric3D') as any;
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${cyl.label})`, GeoConic3D);
    expect(section.getA()).toBeCloseTo(Math.SQRT2, 9);
    expect(section.getB()).toBeCloseTo(1, 9);
    const c = section.getCenter();
    // 轴（z 轴）∩ 平面 (x+z=2) = (0, 0, 2)
    expect(c.getX()).toBeCloseTo(0, 9);
    expect(c.getZ()).toBeCloseTo(2, 9);
    // 精确性：参数点全在柱面上（距轴距离 1，不再是拟合近似）
    for (const u of [0, 0.5, 1, 2, 3, 4.2, 5.7]) {
      const p = section.pointAt(u);
      expect(Math.hypot(p.getX(), p.getY())).toBeCloseTo(1, 9);
    }
  });

  it('平面平行于柱轴 → 两直线退化，不再输出伪椭圆（置 undefined）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    addInput(kernel, 'P1 = (0.5, 0, 0)');
    addInput(kernel, 'P2 = (0.5, 1, 0)');
    addInput(kernel, 'P3 = (0.5, 0, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cyl = kernel.getConstruction().getElements().find(el => el.constructor.name === 'GeoQuadric3D') as any;
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${cyl.label})`, GeoConic3D);
    expect(section.isDefined()).toBe(false);
  });

  it('45° 锥被平行于轴的平面截出精确双曲线（z² − y² = 1，a = b = 1）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'V = (0, 0, 0)');
    addInput(kernel, 'Ax = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(V, Ax)');
    addInput(kernel, 'Cone3D(z, 45)');
    // 平面 x = 1（平行于 z 轴）
    addInput(kernel, 'P1 = (1, 0, 0)');
    addInput(kernel, 'P2 = (1, 1, 0)');
    addInput(kernel, 'P3 = (1, 0, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cone = kernel.getConstruction().getElements().find(el => el.constructor.name === 'GeoQuadric3D') as any;
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${cone.label})`, GeoConic3D);
    expect(section.getKind()).toBe('hyperbola');
    expect(section.getA()).toBeCloseTo(1, 9);
    expect(section.getB()).toBeCloseTo(1, 9);
    // 中心 = 轴 ∩ 平面 = (1, 0, 0)；参数点满足 z² − y² = 1 且 x = 1
    const c = section.getCenter();
    expect(c.getX()).toBeCloseTo(1, 9);
    expect(c.getY()).toBeCloseTo(0, 9);
    expect(c.getZ()).toBeCloseTo(0, 9);
    for (const u of [-2, -1, -0.5, 0.5, 1, 2]) {
      const p = section.pointAt(u);
      expect(p.getX()).toBeCloseTo(1, 9);
      expect(p.getZ() * p.getZ() - p.getY() * p.getY()).toBeCloseTo(1, 9);
    }
  });

  it('椭球被 x=0.5 平面截出精确圆（r=√15/4）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'C = (0, 0, 0)');
    addInput(kernel, 'Ellipsoid3D(C, 2, 1, 1)');
    addInput(kernel, 'P1 = (0.5, 0, 0)');
    addInput(kernel, 'P2 = (0.5, 1, 0)');
    addInput(kernel, 'P3 = (0.5, 0, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const ell = kernel.getConstruction().getElements().find(el => el.constructor.name === 'GeoQuadric3D') as any;
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${ell.label})`, GeoConic3D);
    expect(section.getKind()).toBe('ellipse');
    expect(section.getA()).toBeCloseTo(Math.sqrt(15) / 4, 9);
    expect(section.getB()).toBeCloseTo(Math.sqrt(15) / 4, 9);
    // 参数点在椭球面上
    for (const u of [0, 1, 2, 3, 4, 5]) {
      const p = section.pointAt(u);
      const v = (p.getX() / 2) ** 2 + p.getY() ** 2 + p.getZ() ** 2;
      expect(v).toBeCloseTo(1, 9);
    }
  });
});

describe('B5：FitPoly 最小二乘拟合', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };

  it('三点精确拟合一次式 y = 2x + 1', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P1 = (0, 1)');
    addInput(kernel, 'P2 = (1, 3)');
    addInput(kernel, 'P3 = (2, 5)');
    const result = addInput(kernel, 'FitPoly(P1, P2, P3, 1)');
    const fn = result.find(el => el.constructor.name === 'GeoFunction') as any;
    expect(fn).toBeDefined();
    expect(fn.evaluateAt(0.5)).toBeCloseTo(2, 9);
    expect(fn.evaluateAt(-3)).toBeCloseTo(-5, 9);
  });

  it('三点一次最小二乘：slope=0.5, intercept=1/6', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P1 = (0, 0)');
    addInput(kernel, 'P2 = (1, 1)');
    addInput(kernel, 'P3 = (2, 1)');
    const result = addInput(kernel, 'FitPoly(P1, P2, P3, 1)');
    const fn = result.find(el => el.constructor.name === 'GeoFunction') as any;
    expect(fn.evaluateAt(0)).toBeCloseTo(1 / 6, 9);
    expect(fn.evaluateAt(2)).toBeCloseTo(1 / 6 + 1, 9);
    expect(fn.getAlgebraDescription()).toContain('0.5*x');
  });

  it('移动输入点自动重新拟合（活依赖）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P1 = (0, 1)');
    addInput(kernel, 'P2 = (1, 3)');
    addInput(kernel, 'P3 = (2, 5)');
    const result = addInput(kernel, 'FitPoly(P1, P2, P3, 1)');
    const fn = result.find(el => el.constructor.name === 'GeoFunction') as any;
    expect(fn.evaluateAt(0)).toBeCloseTo(1, 9);
    // 把 P2 挪到 (1, 0)：三点 (0,1),(1,0),(2,5) 的最小二乘一次式
    const p2 = kernel.getConstruction().getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'P2') as GeoPoint;
    p2.setCoords(1, 0, 1);
    kernel.getConstruction().updateAllAlgorithms();
    // slope = ( (0-1)(1-2) + (2-1)(5-2) ) / (1+1) = (1+3)/2 = 2; intercept = 2 - 2*1 = 0
    expect(fn.evaluateAt(0)).toBeCloseTo(0, 9);
    expect(fn.evaluateAt(1)).toBeCloseTo(2, 9);
  });

  it('序列化 roundtrip 保留拟合函数与点依赖', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P1 = (0, 1)');
    addInput(kernel, 'P2 = (1, 3)');
    addInput(kernel, 'P3 = (2, 5)');
    addInput(kernel, 'fit = FitPoly(P1, P2, P3, 1)');
    const json = serialize(kernel);
    const kernel2 = makeKernel();
    deserialize(kernel2, json);
    kernel2.getConstruction().updateAllAlgorithms();
    const fn = kernel2.getConstruction().getElements().find(el => el.constructor.name === 'GeoFunction') as any;
    expect(fn).toBeDefined();
    expect(fn.evaluateAt(0.5)).toBeCloseTo(2, 9);
  });
});

describe('A1-3 部分：Root 单根派生点（随 f/滑块联动）', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };

  it('Root(f, x0) 输出派生点：驱动滑块变化时根自动跟随', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 1');
    addInput(kernel, 'f(x) = a*x - 2');
    const result = addInput(kernel, 'Root(f, 3)');
    const point = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(point).toBeDefined();
    expect(point.getX()).toBeCloseTo(2, 9); // a=1 → 根 = 2

    // 滑块 a → 4：根变为 0.5，派生点自动跟随（旧实现是快照自由点，不会动）
    const a = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a') as GeoNumeric;
    a.setValue(4);
    kernel.getConstruction().updateAllAlgorithms();
    expect(point.getX()).toBeCloseTo(0.5, 9);
  });

  it('Root(f, a, b) 派生点随 f 变化并保持标签连续', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 1');
    addInput(kernel, 'g(x) = a*x^2 - 4');
    const result = addInput(kernel, 'Root(g, 0, 5)');
    const point = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(point.getX()).toBeCloseTo(2, 9);
    const label = point.label;
    // a=1 → a=2：正根 √2
    const sl = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a') as GeoNumeric;
    sl.setValue(2);
    kernel.getConstruction().updateAllAlgorithms();
    expect(point.getX()).toBeCloseTo(Math.SQRT2, 9);
    expect(point.label).toBe(label);
  });
});

describe('B4：GeoText 文本对象', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };

  it('Text("内容", x, y) 创建自由文本', () => {
    const kernel = makeKernel();
    const result = addInput(kernel, 'Text("你好, 世界", 1, 2)');
    const text = result.find(el => el.constructor.name === 'GeoText') as any;
    expect(text).toBeDefined();
    expect(text.text).toBe('你好, 世界');
    expect(text.x).toBe(1);
    expect(text.y).toBe(2);
  });

  it('Text("内容", P) 锚定文本随点移动', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P = (1, 1)');
    const result = addInput(kernel, 'Text("顶点", P)');
    const text = result.find(el => el.constructor.name === 'GeoText') as any;
    expect(text.x).toBeCloseTo(1, 9);
    expect(text.y).toBeCloseTo(1, 9);
    const p = kernel.getConstruction().getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'P') as GeoPoint;
    p.setCoords(3, 4, 1);
    kernel.getConstruction().updateAllAlgorithms();
    expect(text.x).toBeCloseTo(3, 9);
    expect(text.y).toBeCloseTo(4, 9);
  });

  it('引号内逗号不参与参数切分', () => {
    const kernel = makeKernel();
    const result = addInput(kernel, "Text('a, b', 0, 0)");
    const text = result.find(el => el.constructor.name === 'GeoText') as any;
    expect(text.text).toBe('a, b');
  });

  it('自由文本序列化 roundtrip', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Text("标注", 2, 3)');
    const json = serialize(kernel);
    const kernel2 = makeKernel();
    deserialize(kernel2, json);
    kernel2.getConstruction().updateAllAlgorithms();
    const text = kernel2.getConstruction().getElements().find(el => el.constructor.name === 'GeoText') as any;
    expect(text).toBeDefined();
    expect(text.text).toBe('标注');
    expect(text.x).toBe(2);
    expect(text.y).toBe(3);
  });
});

describe('GeoList（v1）', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };

  it('{A, B, C} 列表字面量收集已有元素', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 0)');
    addInput(kernel, 'C = (0, 1)');
    const result = addInput(kernel, '{A, B, C}');
    const list = result.find(el => el.constructor.name === 'GeoList') as any;
    expect(list).toBeDefined();
    expect(list.getChildren()).toHaveLength(3);
    expect(list.getChildren().map((c: any) => c.label)).toEqual(['A', 'B', 'C']);
  });

  it('列表里未知标签报错', () => {
    const kernel = makeKernel();
    expect(() => addInput(kernel, '{A, Nope}')).toThrow(/Unknown object/);
  });

  it('FitPoly({P1, P2, P3}, 1) 列表语法（对标 CmdFitPoly）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P1 = (0, 1)');
    addInput(kernel, 'P2 = (1, 3)');
    addInput(kernel, 'P3 = (2, 5)');
    const result = addInput(kernel, 'FitPoly({P1, P2, P3}, 1)');
    const fn = result.find(el => el.constructor.name === 'GeoFunction') as any;
    expect(fn.evaluateAt(0.5)).toBeCloseTo(2, 9);
  });

  it('Root(f) 输出派生根点列表：滑块变化全部根自动跟随且标签稳定', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 4');
    addInput(kernel, 'f(x) = x^2 - a');
    const result = addInput(kernel, 'Root(f)');
    const list = result.find(el => el.constructor.name === 'GeoList') as any;
    const points = result.filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    expect(points.map(p => p.getX()).sort((x, y) => x - y)).toEqual([-2, 2]);
    const negLabel = points.find(p => p.getX() < 0)!.label;
    const posLabel = points.find(p => p.getX() > 0)!.label;

    // a=4 → a=1：根 ±1，负槽位仍锁负根、正槽位仍锁正根（标签不互换）
    const a = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a') as GeoNumeric;
    a.setValue(1);
    kernel.getConstruction().updateAllAlgorithms();
    const still = points.map(p => [p.label, +p.getX().toFixed(6)]);
    expect(still.find(([l]) => l === negLabel)![1]).toBeCloseTo(-1, 6);
    expect(still.find(([l]) => l === posLabel)![1]).toBeCloseTo(1, 6);
    expect(list.getChildren().filter((c: any) => c.isDefined())).toHaveLength(2);
  });

  it('Root(f) 列表序列化 roundtrip', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 - 4');
    addInput(kernel, 'roots = Root(f)');
    const json = serialize(kernel);
    const kernel2 = makeKernel();
    deserialize(kernel2, json);
    kernel2.getConstruction().updateAllAlgorithms();
    const pts = kernel2.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    const xs = pts.map(p => +p.getX().toFixed(6)).sort((x, y) => x - y);
    expect(xs).toEqual([-2, 2]);
  });

  it('Extremum(f) 输出派生极值点列表：滑块变化全部极值自动跟随且标签稳定', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 1');
    addInput(kernel, 'f(x) = a*(x^3 - 3x)'); // a=1 极值 ±1；a=2 仍在 ±1（x 不变，y 缩放）
    const result = addInput(kernel, 'Extremum(f)');
    const list = result.find(el => el.constructor.name === 'GeoList') as any;
    expect(list).toBeDefined();
    const points = result.filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    expect(points).toHaveLength(2);
    const leftLabel = points.find(p => p.getX() < 0)!.label;
    const rightLabel = points.find(p => p.getX() > 0)!.label;
    expect(points.find(p => p.getX() < 0)!.getY()).toBeCloseTo(2, 6);
    expect(points.find(p => p.getX() > 0)!.getY()).toBeCloseTo(-2, 6);

    // a=1 → a=2：极值 x 仍为 ±1，y 翻倍；标签不互换
    const a = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a') as GeoNumeric;
    a.setValue(2);
    kernel.getConstruction().updateAllAlgorithms();
    const left = points.find(p => p.label === leftLabel)!;
    const right = points.find(p => p.label === rightLabel)!;
    expect(left.getX()).toBeCloseTo(-1, 6);
    expect(left.getY()).toBeCloseTo(4, 6);
    expect(right.getX()).toBeCloseTo(1, 6);
    expect(right.getY()).toBeCloseTo(-4, 6);
    expect(list.getChildren().filter((c: any) => c.isDefined())).toHaveLength(2);
  });

  it('Extremum(f) 随 f 形状变化极值点联动（x 位置随滑块平移）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'b = 0');
    addInput(kernel, 'g(x) = (x - b)^3 - 3*(x - b)'); // 极值在 x = b±1
    const result = addInput(kernel, 'Extremum(g)');
    const points = result.filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    expect(points).toHaveLength(2);
    const labels = points.map(p => p.label);

    // b=0 → b=5：极值移到 x=4 与 x=6，派生点跟随（旧实现是快照自由点，不会动）
    const b = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'b') as GeoNumeric;
    b.setValue(5);
    kernel.getConstruction().updateAllAlgorithms();
    const xs = kernel.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && el.isDefined() && labels.includes((el as GeoPoint).label))
      .map(el => +(el as GeoPoint).getX().toFixed(6))
      .sort((x, y) => x - y);
    expect(xs).toEqual([4, 6]);
  });

  it('Extremum(f) 列表序列化 roundtrip', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^3 - 3x');
    addInput(kernel, 'extrema = Extremum(f)');
    const json = serialize(kernel);
    const kernel2 = makeKernel();
    deserialize(kernel2, json);
    kernel2.getConstruction().updateAllAlgorithms();
    const pts = kernel2.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    const xs = pts.map(p => +p.getX().toFixed(6)).sort((x, y) => x - y);
    expect(xs).toEqual([-1, 1]);
  });
});

describe('B3：有向角 DirectedAngle', () => {
  it('逆时针角 ∈ [0, 2π)：A(1,0)-O-B(0,1) = 90°、B-O-A = 270°', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 0, 'A');
    makePoint(kernel, 0, 0, 'O');
    makePoint(kernel, 0, 1, 'B');
    const r1 = parseAlgebraInput(kernel, 'DirectedAngle(A, O, B)');
    r1.forEach(el => kernel.getConstruction().addElement(el));
    const r2 = parseAlgebraInput(kernel, 'DirectedAngle(B, O, A)');
    r2.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    const algos = kernel.getConstruction().getElements().filter(el => el.constructor.name === 'AlgoAngleOriented') as any[];
    const a1 = algos[0].output[0].getValue() * 180 / Math.PI;
    const a2 = algos[1].output[0].getValue() * 180 / Math.PI;
    expect(a1).toBeCloseTo(90, 6);
    expect(a2).toBeCloseTo(270, 6);
  });

  it('Angle 命令（无向版）也可用', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 0, 'A');
    makePoint(kernel, 0, 0, 'O');
    makePoint(kernel, 0, 1, 'B');
    const r = parseAlgebraInput(kernel, 'Angle(A, O, B)');
    r.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    const algo = kernel.getConstruction().getElements().find(el => el.constructor.name === 'AlgoAngle') as any;
    expect(algo.output[0].getValue() * 180 / Math.PI).toBeCloseTo(90, 6);
  });
});

describe('B7：路径点动画', () => {
  it('约束点 isAnimatable 且 doAnimationStep 驱动参数滑块', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'P');
    makePoint(kernel, 4, 0, 'Q');
    addInput(kernel, 's = Segment(P, Q)');
    const result = addInput(kernel, 'PointOnLine((2, 0), s)');
    const m = result.find(el => el instanceof GeoPoint && el.label !== 'P' && el.label !== 'Q') as GeoPoint;
    // M 是约束点（parentAlgo 有 GeoNumeric 参数）→ 可动画
    expect(m.isAnimatable()).toBe(true);
    const before = m.getX();
    m.setAnimating(true);
    const moved = m.doAnimationStep(30);
    // 参数推进一步后点沿路径移动（或值恰被量化到同处，此处区间足够大必动）
    expect(moved || m.getX() !== before).toBe(true);
    // 自由点不可动画
    const p = kernel.getConstruction().getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'P') as GeoPoint;
    expect(p.isAnimatable()).toBe(false);
  });
});

describe('Slider 命令（对标 CmdSlider）', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };

  it('Slider() 创建匿名滑块（默认区间 [0,10]，值 5）', () => {
    const kernel = makeKernel();
    const result = addInput(kernel, 'Slider()');
    const n = result.find(el => el instanceof GeoNumeric) as GeoNumeric;
    expect(n).toBeDefined();
    expect(n.intervalMin).toBe(0);
    expect(n.intervalMax).toBe(10);
    expect(n.getValue()).toBe(5);
    expect(n.label).toBeTruthy();
  });

  it('Slider(0, 100, 5, 20) 带区间/步长/初值', () => {
    const kernel = makeKernel();
    const result = addInput(kernel, 'Slider(0, 100, 5, 20)');
    const n = result.find(el => el instanceof GeoNumeric) as GeoNumeric;
    expect(n.intervalMin).toBe(0);
    expect(n.intervalMax).toBe(100);
    expect(n.animationIncrement).toBe(5);
    expect(n.getValue()).toBe(20);
  });

  it('Slider(a) 返回已有数值自身（不新建对象），退化区间才补默认值', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 3');
    const result = addInput(kernel, 'Slider(a)');
    expect(result).toHaveLength(0); // 空数组哨兵：对象已在构造中
    const all = kernel.getConstruction().getElements().filter(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a') as GeoNumeric[];
    expect(all).toHaveLength(1);
    // a 的默认区间 [0, 2π] 有效 → 原样保留
    expect(all[0].intervalMin).toBe(0);
    expect(all[0].intervalMax).toBeCloseTo(2 * Math.PI, 9);
    // 退化区间（max<=min）才补 [v, v+10]
    addInput(kernel, 'b = 0');
    const b = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'b') as GeoNumeric;
    b.intervalMax = b.intervalMin; // 人为退化
    addInput(kernel, 'Slider(b)');
    expect(b.intervalMax).toBe(10);
  });

  it('Slider 产出的滑块可驱动依赖对象', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Slider(0, 10, 1, 2)');
    addInput(kernel, 'f(x) = t1*x');
    // 找到 Slider 创建的数值（标签 t1）
    const t1 = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 't1') as GeoNumeric;
    expect(t1.getValue()).toBe(2);
    const fn = kernel.getConstruction().getElements().find(el => (el as any).evaluateAt) as any;
    expect(fn.evaluateAt(3)).toBeCloseTo(6, 9);
    // 拖滑块（改值）→ f 跟随
    t1.setValue(5);
    kernel.getConstruction().updateAllAlgorithms();
    expect(fn.evaluateAt(3)).toBeCloseTo(15, 9);
  });
});
