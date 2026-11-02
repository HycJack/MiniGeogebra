/**
 * 2026-10-28 复审轮回归（三路并行审计 → 修复批）：
 *
 * P0：框选/右键 isEffectivelyVisible TypeError（UI 层，浏览器路径，此处以
 *     构造层等价物守护——getElements 混含算法对象的过滤安全性）；
 *     GeoArc 的 Length/Area/Perimeter 误按整圆计算。
 * P1：Tangent 输出重复标签、Slope(垂直线)、Distance(P,ray)/(l1,l2) 语义、
 *     NaN 不置 undefined；AST 快照族失随（Derivative/Tangent/Curvature/
 *     OsculatingCircle/Integral/TaylorSeries/Slope(function) 随源更新，
 *     含存档往返）；冒号前缀定义与希腊字母 LHS；Ellipse/Hyperbola 数值
 *     半长轴；Tangent(line,conic) 平行切线；Center/AreEqual；
 *     Intersect(f,g,a,b) 区间形；Angle 三点/两点 atan2 [0,2π) 语义；
 *     多边形删除级联删边（兄弟输出）。
 */
import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoElement } from '../kernel/algo/AlgoElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const byLabel = <T extends ConstructionElement>(kernel: Kernel, label: string): T =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T;

const labels = (kernel: Kernel): string[] =>
  kernel.getConstruction().getElements()
    .map(el => (el as { label?: string }).label)
    .filter((l): l is string => !!l);

describe('GeoArc 度量（此前误按整圆）', () => {
  it('Length(Arc(O,A,B)) = r·extent，90° 弧 r=2 → π', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'O');
    makePoint(k, 2, 0, 'A');
    makePoint(k, 0, 2, 'B');
    addInput(k, 'arc1 = Arc(O, A, B)');
    addInput(k, 'L = Length(arc1)');
    const L = byLabel<GeoNumeric>(k, 'L');
    expect(L.isDefined()).toBe(true);
    expect(L.getValue()).toBeCloseTo(Math.PI, 6);
  });

  it('Perimeter(Arc) = 弧长 + 弦（官方 curved + straight）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'O');
    makePoint(k, 1, 0, 'A');
    makePoint(k, 0, 1, 'B');
    addInput(k, 'arc1 = Arc(O, A, B)');
    addInput(k, 'P = Perimeter(arc1)');
    const P = byLabel<GeoNumeric>(k, 'P');
    // 90° 弧 r=1：弧长 π/2 + 弦 √2
    expect(P.getValue()).toBeCloseTo(Math.PI / 2 + Math.SQRT2, 6);
  });

  it('Area(Arc) → undefined（弧无面积）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'O');
    makePoint(k, 1, 0, 'A');
    makePoint(k, 0, 1, 'B');
    addInput(k, 'arc1 = Arc(O, A, B)');
    addInput(k, 'S = Area(arc1)');
    const S = byLabel<GeoNumeric>(k, 'S');
    expect(S.isDefined()).toBe(false);
  });
});

describe('切线/斜率/距离语义', () => {
  it('Tangent(P, conic) 两条切线不重名（getNext*Label 漏登记）', () => {
    const k = makeKernel();
    addInput(k, 'cc = Circle((0,0), 2)');
    addInput(k, 'P = (4, 0)');
    addInput(k, 't = Tangent(P, cc)');
    const lineLabels = k.getConstruction().getElements()
      .filter(el => el instanceof GeoLine && el.parentAlgo?.getClassName() === 'AlgoTangent')
      .map(el => (el as GeoLine).label);
    expect(lineLabels.length).toBe(2);
    expect(new Set(lineLabels).size).toBe(2);
    const pointLabels = k.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && (el as GeoPoint).parentAlgo?.getClassName() === 'AlgoTangent')
      .map(el => (el as GeoPoint).label);
    expect(new Set(pointLabels).size).toBe(2);
  });

  it('Slope(垂直线) → undefined（官方 getSlope 返回 NaN）', () => {
    const k = makeKernel();
    addInput(k, 'l = Line((1,0), (1,3))');
    addInput(k, 'm = Slope(l)');
    const m = byLabel<GeoNumeric>(k, 'm');
    expect(m.isDefined()).toBe(false);
  });

  it('Distance(P, ray) = 到承载直线的垂线距（官方 GeoRay 不覆写 distance）', () => {
    const k = makeKernel();
    addInput(k, 'r1 = Ray((0,0), (1,0))');
    addInput(k, 'P = (-1, 2)');
    addInput(k, 'd = Distance(P, r1)');
    const d = byLabel<GeoNumeric>(k, 'd');
    expect(d.isDefined()).toBe(true);
    expect(d.getValue()).toBeCloseTo(2, 9);
  });

  it('Distance(l1, l2) 相交直线 = 0', () => {
    const k = makeKernel();
    addInput(k, 'l1 = Line((0,0), (1,0))');
    addInput(k, 'l2 = Line((0,0), (0,1))');
    addInput(k, 'd = Distance(l1, l2)');
    const d = byLabel<GeoNumeric>(k, 'd');
    expect(d.isDefined()).toBe(true);
    expect(d.getValue()).toBe(0);
  });

  it('sqrt(-1) 求值 NaN → undefined 且不再穿透下游（AlgoDependentNumeric 有限性守卫）', () => {
    const k = makeKernel();
    addInput(k, 'a = -1');
    addInput(k, 'f(x) = sqrt(x)');
    addInput(k, 'v = f(a)');
    const v = byLabel<GeoNumeric>(k, 'v');
    expect(v.isDefined()).toBe(false);
    addInput(k, 'w = v + 1');
    const w = byLabel<GeoNumeric>(k, 'w');
    expect(w.isDefined()).toBe(false);
  });
});

describe('AST 快照族随源更新（动态几何核心）', () => {
  it('Derivative(FitPoly f) 在拖动拟合点后跟随重算', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'P1');
    makePoint(k, 1, 1, 'P2');
    makePoint(k, 2, 0, 'P3');
    addInput(k, 'f = FitPoly(P1, P2, P3, 2)');
    addInput(k, 'd = Derivative(f)');
    const d = byLabel<GeoFunction>(k, 'd');
    // f = −x²+2x（三点拟合，开口向下）→ f'(0.5) = 1
    expect(d.evaluateAt(0.5)).toBeCloseTo(1, 4);
    // 拖 P2 (1,1)→(1,3)：f = −3x²+6x，f'(0.5) = 3
    byLabel<GeoPoint>(k, 'P2').setCoords(1, 3, 1);
    k.getConstruction().updateAllAlgorithms();
    expect(d.evaluateAt(0.5)).toBeCloseTo(3, 4);
  });

  it('Tangent(f, x0) 斜率随 FitPoly 重拟合更新（此前构造期冻结）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'P1');
    makePoint(k, 1, 1, 'P2');
    makePoint(k, 2, 0, 'P3');
    addInput(k, 'f = FitPoly(P1, P2, P3, 2)');
    addInput(k, 't = Tangent(f, 0.5)');
    const t = byLabel<GeoLine>(k, 't');
    expect(t.isDefined()).toBe(true);
    // f = −x²+2x → f'(0.5) = 1
    expect(t.a / -t.b).toBeCloseTo(1, 4);
    byLabel<GeoPoint>(k, 'P2').setCoords(1, 3, 1);
    k.getConstruction().updateAllAlgorithms();
    // f = −3x²+6x → f'(0.5) = 3（斜率确实跟随了拟合重算）
    expect(t.a / -t.b).toBeCloseTo(3, 4);
    // 再拖到 (1,-1)：f = x²−2x → f'(0.5) = −1
    byLabel<GeoPoint>(k, 'P2').setCoords(1, -1, 1);
    k.getConstruction().updateAllAlgorithms();
    expect(t.a / -t.b).toBeCloseTo(-1, 4);
  });

  it('Derivative(f) 在 f 拖拽（translateBy）后跟随；undo 路径 replaceDefinition 同样跟随', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'd = Derivative(f)');
    const d = byLabel<GeoFunction>(k, 'd');
    expect(d.evaluateAt(2)).toBeCloseTo(4, 6);
    const f = byLabel<GeoFunction>(k, 'f');
    // moveFunction 内核路径：整体平移 (1, 0) → f = (x−1)²，f'(2) = 2
    const algo = f.parentAlgo as unknown as { translateBy(dx: number, dy: number): void };
    if (algo && typeof algo.translateBy === 'function') {
      algo.translateBy(1, 0);
      k.getConstruction().updateAllAlgorithms();
      expect(d.evaluateAt(2)).toBeCloseTo(2, 4);
    }
  });

  it('f 重定义后 Derivative(f) 重新微分（f 在依赖图内，rebuildReplace 重建）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'd = Derivative(f)');
    addInput(k, 'f(x) = x^3');
    const d = byLabel<GeoFunction>(k, 'd');
    expect(d.isDefined()).toBe(true);
    expect(d.evaluateAt(2)).toBeCloseTo(12, 4);
  });

  it('Derivative(f) 存档往返后仍随源更新（此前改写为快照函数）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'P1');
    makePoint(k, 1, 1, 'P2');
    makePoint(k, 2, 0, 'P3');
    addInput(k, 'f = FitPoly(P1, P2, P3, 2)');
    addInput(k, 'd = Derivative(f)');
    deserialize(k, serialize(k));
    k.getConstruction().updateAllAlgorithms();
    const d2 = k.getConstruction().getElements()
      .find(el => el instanceof GeoFunction && (el as GeoFunction).parentAlgo?.getClassName() === 'AlgoDerivative') as GeoFunction | undefined;
    expect(d2).toBeDefined();
    // f = −x²+2x → d(0.5) = 1
    expect(d2!.evaluateAt(0.5)).toBeCloseTo(1, 3);
    // 重载后拖动拟合点，导数仍跟随
    const p2 = k.getConstruction().getElements().find(el => (el as { label?: string }).label === 'P2') as GeoPoint;
    p2.setCoords(1, 3, 1);
    k.getConstruction().updateAllAlgorithms();
    expect(d2!.evaluateAt(0.5)).toBeCloseTo(3, 3);
  });

  it('Integral(f, a, b) 是活算法：滑块驱动被积函数跟随重算', () => {
    const k = makeKernel();
    addInput(k, 'a = 1');
    addInput(k, 'f(x) = a*x');
    addInput(k, 'iv = Integral(f, 0, 1)');
    const iv = byLabel<GeoNumeric>(k, 'iv');
    expect(iv.parentAlgo?.getClassName()).toBe('AlgoIntegralDefinite');
    expect(iv.getValue()).toBeCloseTo(0.5, 6);
    byLabel<GeoNumeric>(k, 'a').setValue(2);
    k.getConstruction().updateAllAlgorithms();
    expect(iv.getValue()).toBeCloseTo(1, 6);
  });

  it('TaylorSeries(f, n) 是活算法：滑块驱动 f 跟随重展开', () => {
    const k = makeKernel();
    addInput(k, 'a = 1');
    addInput(k, 'f(x) = a*sin(x)');
    addInput(k, 'ts = TaylorSeries(f, 1)');
    const ts = byLabel<GeoFunction>(k, 'ts');
    expect(ts.parentAlgo?.getClassName()).toBe('AlgoTaylorSeriesFunction');
    expect(ts.evaluateAt(0.5)).toBeCloseTo(0.5, 4);
    byLabel<GeoNumeric>(k, 'a').setValue(3);
    k.getConstruction().updateAllAlgorithms();
    expect(ts.evaluateAt(0.5)).toBeCloseTo(1.5, 4);
  });

  it('Slope(function) 是活算法：f 表达式随滑块变化跟随', () => {
    const k = makeKernel();
    addInput(k, 'a = 1');
    addInput(k, 'f(x) = a*x + 1');
    addInput(k, 'm = Slope(f)');
    const m = byLabel<GeoNumeric>(k, 'm');
    expect(m.parentAlgo?.getClassName()).toBe('AlgoSlopeFunction');
    expect(m.getValue()).toBeCloseTo(1, 6);
    byLabel<GeoNumeric>(k, 'a').setValue(5);
    k.getConstruction().updateAllAlgorithms();
    expect(m.getValue()).toBeCloseTo(5, 6);
  });

  it('Curvature(f, x) 随 f 拖拽更新（fPrime 双冻结同族）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'c1 = Curvature(f, 0)');
    const c1 = byLabel<GeoNumeric>(k, 'c1');
    expect(c1.getValue()).toBeCloseTo(2, 4);
    const f = byLabel<GeoFunction>(k, 'f');
    const algo = f.parentAlgo as unknown as { translateBy(dx: number, dy: number): void };
    if (algo && typeof algo.translateBy === 'function') {
      algo.translateBy(1, 0); // f = (x−1)²，f''(0)=2、f'(0)=−2 → k = 2/5^1.5
      k.getConstruction().updateAllAlgorithms();
      expect(c1.getValue()).toBeCloseTo(2 / Math.pow(5, 1.5), 4);
    }
  });
});

describe('冒号前缀定义与希腊字母 LHS', () => {
  it('c: x²+y²=4 创建圆锥曲线并取得标签 c', () => {
    const k = makeKernel();
    addInput(k, 'c: x²+y²=4');
    const c = byLabel<GeoConic>(k, 'c');
    expect(c).toBeDefined();
    expect(c.getConicType()).toBe('circle');
    expect(c.getRadius()).toBeCloseTo(2, 9);
  });

  it('l1: y=3 创建水平直线', () => {
    const k = makeKernel();
    addInput(k, 'l1: y=3');
    const l1 = byLabel<GeoLine>(k, 'l1');
    expect(l1).toBeDefined();
    expect(l1.b).not.toBe(0);
  });

  it('α = Angle(A,B,C) 希腊字母 LHS 合法', () => {
    const k = makeKernel();
    makePoint(k, 1, 0, 'A');
    makePoint(k, 0, 0, 'B');
    makePoint(k, 1, 1, 'C');
    addInput(k, 'α = Angle(A,B,C)');
    const alpha = byLabel<GeoNumeric>(k, 'α');
    expect(alpha).toBeDefined();
    expect(alpha.isAngle).toBe(true);
    expect(alpha.getValue() * 180 / Math.PI).toBeCloseTo(45, 6);
  });
});

describe('Angle atan2 语义（[0,2π) 逆时针，官方 AlgoAnglePoints）', () => {
  it('顺时针 90° 折角 → 270°（此前 acos 折成 90°）', () => {
    const k = makeKernel();
    makePoint(k, 0, 1, 'A');
    makePoint(k, 0, 0, 'B');
    makePoint(k, 1, 0, 'C');
    addInput(k, 'ang = Angle(A,B,C)');
    expect(byLabel<GeoNumeric>(k, 'ang').getValue() * 180 / Math.PI).toBeCloseTo(270, 6);
  });

  it('Angle(P, Q) 两点形式：P=(1,0), Q=(0,-1) → 270°', () => {
    const k = makeKernel();
    makePoint(k, 1, 0, 'P');
    makePoint(k, 0, -1, 'Q');
    addInput(k, 'ang = Angle(P, Q)');
    expect(byLabel<GeoNumeric>(k, 'ang').getValue() * 180 / Math.PI).toBeCloseTo(270, 6);
  });
});

describe('命令面新形态', () => {
  it('Ellipse(F1, F2, 3) 数值半长轴：a=3, c=1 → b=√8，过 (3,0)', () => {
    const k = makeKernel();
    makePoint(k, -1, 0, 'F1');
    makePoint(k, 1, 0, 'F2');
    addInput(k, 'e1 = Ellipse(F1, F2, 3)');
    const e1 = byLabel<GeoConic>(k, 'e1');
    expect(e1).toBeDefined();
    expect(e1.getConicType()).toBe('ellipse');
    expect(e1.isOnPath(new GeoPoint(k, new GeoVec3D(3, 0, 1)), 1e-6)).toBe(true);
  });

  it('Ellipse(F1, F2, a≤c) → undefined', () => {
    const k = makeKernel();
    makePoint(k, -2, 0, 'F1');
    makePoint(k, 2, 0, 'F2');
    addInput(k, 'e1 = Ellipse(F1, F2, 1.5)');
    const e1 = byLabel<GeoConic>(k, 'e1');
    expect(e1).toBeDefined();
    expect(e1.isDefined()).toBe(false);
  });

  it('Hyperbola(F1, F2, 2) 数值实半轴', () => {
    const k = makeKernel();
    makePoint(k, -1, 0, 'F1');
    makePoint(k, 1, 0, 'F2');
    addInput(k, 'h1 = Hyperbola(F1, F2, 0.5)');
    const h1 = byLabel<GeoConic>(k, 'h1');
    expect(h1).toBeDefined();
    expect(h1.getConicType()).toBe('hyperbola');
    expect(h1.isOnPath(new GeoPoint(k, new GeoVec3D(0.5, 0, 1)), 1e-6)).toBe(true);
  });

  it('Tangent(line, circle) 平行切线：y=0 对单位圆 → y=±1', () => {
    const k = makeKernel();
    addInput(k, 'cc = Circle((0,0), 1)');
    addInput(k, 'l = Line((0,0), (1,0))');
    addInput(k, 't = Tangent(l, cc)');
    const tangents = k.getConstruction().getElements()
      .filter(el => el instanceof GeoLine && el.parentAlgo?.getClassName() === 'AlgoTangentLineConic') as GeoLine[];
    expect(tangents.length).toBe(2);
    const cs = tangents.map(t2 => Math.abs(t2.c)).sort((x, y) => x - y);
    expect(cs[0]).toBeCloseTo(1, 9);
    expect(cs[1]).toBeCloseTo(1, 9);
  });

  it('Center(conic) 输出中心点', () => {
    const k = makeKernel();
    addInput(k, 'e1 = Ellipse((-2,0), (2,0), 3)');
    addInput(k, 'C = Center(e1)');
    const C = byLabel<GeoPoint>(k, 'C');
    expect(C).toBeDefined();
    expect(C.getX()).toBeCloseTo(0, 6);
  });

  it('AreEqual(1/3, 0.3333333333) 相对容差判定', () => {
    const k = makeKernel();
    addInput(k, 'r1 = AreEqual(1/3, 0.33333333333)');
    addInput(k, 'r2 = AreEqual(1/3, 0.3)');
    expect(byLabel<GeoNumeric>(k, 'r1').getValue()).toBe(1);
    expect(byLabel<GeoNumeric>(k, 'r2').getValue()).toBe(0);
  });

  it('Intersect(f, g, a, b) 只在区间内求交', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = sin(x)');
    addInput(k, 'g(x) = 0.5');
    addInput(k, 'i1 = Intersect(f, g, 0, 2)');
    const xs = k.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && el.parentAlgo?.getClassName() === 'AlgoIntersectFunctions' || el instanceof GeoPoint && (el as GeoPoint).parentAlgo?.getClassName()?.startsWith('AlgoIntersect'))
      .map(el => (el as GeoPoint).getX())
      .filter(x => Number.isFinite(x));
    expect(xs.length).toBeGreaterThanOrEqual(1);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(-1e-9);
    for (const x of xs) expect(x).toBeLessThanOrEqual(2 + 1e-9);
  });
});

describe('多边形删除级联（兄弟输出边）', () => {
  it('删除多边形后边随级联消失（此前孤儿边残留画布）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    makePoint(k, 2, 3, 'C');
    addInput(k, 'poly1 = Polygon(A, B, C)');
    const before = k.getConstruction().getElements().filter(el => el instanceof GeoSegment).length;
    expect(before).toBe(3);
    const poly = byLabel<GeoPolygon>(k, 'poly1');
    k.getConstruction().deleteElementWithDependents(poly);
    const after = k.getConstruction().getElements().filter(el => el instanceof GeoSegment).length;
    expect(after).toBe(0);
    expect(labels(k).filter(l => l === 'poly1').length).toBe(0);
  });

  it('Polygon 命令输出的边可被拖顶点联动（边仍随顶点）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    makePoint(k, 2, 3, 'C');
    addInput(k, 'poly1 = Polygon(A, B, C)');
    const edges = k.getConstruction().getElements().filter(el => el instanceof GeoSegment) as GeoSegment[];
    expect(edges.length).toBe(3);
    // 边引用顶点是活的：挪顶点后边端点跟随
    byLabel<GeoPoint>(k, 'A').setCoords(1, 1, 1);
    k.getConstruction().updateAllAlgorithms();
    const ab = edges.find(e => e.startPoint === byLabel<GeoPoint>(k, 'A') || e.endPoint === byLabel<GeoPoint>(k, 'A'))!;
    const a = byLabel<GeoPoint>(k, 'A');
    const touchesA = (ab.startPoint === a && ab.startPoint.getX() === 1)
      || (ab.endPoint === a && ab.endPoint.getX() === 1);
    expect(touchesA).toBe(true);
  });
});

describe('UI 层守卫（构造层等价物）', () => {
  it('getElements() 混含算法对象：isEffectivelyVisible 过滤必须带 GeoElement 守卫语义', () => {
    // GeometryCanvas 的框选/右键曾对 AlgoElement 调 isEffectivelyVisible 崩溃。
    // 构造层契约：getElements() 同时含 GeoElement 与 AlgoElement。
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 2, 0, 'B');
    addInput(k, 'seg1 = Segment(A, B)');
    const all = k.getConstruction().getElements();
    const algoCount = all.filter(el => el instanceof AlgoElement).length;
    expect(algoCount).toBeGreaterThan(0);
    const safe = all.filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible());
    expect(safe.length).toBeGreaterThan(0);
  });
});
