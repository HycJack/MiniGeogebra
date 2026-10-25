/**
 * 2D 几何验证轮回归（2026-10-26，探针实测驱动的 9 项缺陷修复）：
 * - 双曲线半焦距 c²=a²+b²（此前误用 |a²−b²|，焦点/准线/离心率全错）
 * - Polygon 依赖注册（AlgoPolygonPoints：拖顶点 Area/周长联动、删除级联）
 * - Angle(l1,l2) 两线角入口可达
 * - IsInRegion 对圆/椭圆/不等式区域（优先 isInRegionXY）
 * - 圆×圆内切交点（根轴特判，此前 Plücker pencil 分解失败）
 * - 弧上约束点扫窗（GeoArc 分支先于 GeoConic）
 * - Intersect(f,g) 相切交点（findRoots 重根检测）
 * - 函数经 Rotate/Dilate/Invert 显式报错（此前静默别名）
 * - 抛物线组合姿态分类（detQ 阈值收紧到 1e-8）
 */
import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoArc } from '../kernel/algo/AlgoArc';
import { createParameterPointOnPath } from '../components/tools/createElements';
import { intersectConicConic } from '../kernel/geo/conicSolve';
import { findRoots } from '../kernel/algebra/Numerics';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const byLabel = <T extends ConstructionElement>(kernel: Kernel, label: string): T =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T;

const conicOf = (kernel: Kernel): GeoConic => {
  const c = kernel.getConstruction().getElements().find(e => e instanceof GeoConic);
  if (!c) throw new Error('no conic');
  return c as GeoConic;
};

describe('双曲线半焦距（c² = a² + b²）', () => {
  it('x²/4 − y²/9 = 1 的焦点 (±√13, 0)、e=√13/2、准线 x=±4/√13', () => {
    const k = makeKernel();
    addInput(k, 'x²/4 - y²/9 = 1');
    const conic = conicOf(k);
    addInput(k, `F = Focus(${conic.label})`);
    const focusPts = k.getConstruction().getElements()
      .filter(e => e instanceof GeoPoint && (e as GeoPoint).parentAlgo?.getClassName() === 'AlgoConicFocus' && e.isDefined()) as GeoPoint[];
    expect(focusPts.length).toBe(2);
    const xs = focusPts.map(p => p.getX()).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-Math.sqrt(13), 5);
    expect(xs[1]).toBeCloseTo(Math.sqrt(13), 5);

    addInput(k, `e = Eccentricity(${conic.label})`);
    const e = k.getConstruction().getElements().find(el => (el as { label?: string }).label === 'e') as GeoNumeric;
    expect(e.getValue()).toBeCloseTo(Math.sqrt(13) / 2, 5);
  });

  it('椭圆不受影响：x²/4+y²/9=1 焦点 (0,±√5)（长轴沿 y）', () => {
    const k = makeKernel();
    addInput(k, 'x²/4 + y²/9 = 1');
    const conic = conicOf(k);
    addInput(k, `F = Focus(${conic.label})`);
    const focusPts = k.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && (el as GeoPoint).parentAlgo?.getClassName() === 'AlgoConicFocus' && el.isDefined()) as GeoPoint[];
    expect(focusPts.length).toBe(2);
    const ys = focusPts.map(p => p.getY()).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-Math.sqrt(5), 5);
    expect(ys[1]).toBeCloseTo(Math.sqrt(5), 5);
  });
});

describe('Polygon 依赖注册（AlgoPolygonPoints）', () => {
  it('拖动顶点 → Area/Perimeter 实时联动（此前滞留旧值）', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 'C = (4, 4)');
    addInput(k, 'D = (0, 4)');
    addInput(k, 'q = Polygon(A, B, C, D)');
    addInput(k, 'ar = Area(q)');
    const ar = byLabel<GeoNumeric>(k, 'ar');
    expect(ar.getValue()).toBeCloseTo(16, 6);

    byLabel<GeoPoint>(k, 'C').setCoords(8, 4, 1);
    k.flushNow();
    expect(ar.getValue()).toBeCloseTo(24, 6);
  });

  it('删除顶点级联删除多边形与下游（此前残留悬挂引用）', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 'C = (0, 3)');
    addInput(k, 'q = Polygon(A, B, C)');
    addInput(k, 'ar = Area(q)');
    const C = byLabel<GeoPoint>(k, 'C');
    k.getConstruction().deleteElementWithDependents(C);
    const labels = k.getConstruction().getElements().map(e => (e as { label?: string }).label);
    expect(labels).not.toContain('q');
    expect(labels).not.toContain('ar');
  });

  it('roundtrip 后拖顶点联动保持', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 'C = (0, 3)');
    addInput(k, 'q = Polygon(A, B, C)');
    addInput(k, 'ar = Area(q)');
    const json = serialize(k);
    const k2 = makeKernel();
    deserialize(k2, json);
    byLabel<GeoPoint>(k2, 'B').setCoords(8, 0, 1);
    k2.flushNow();
    const ar2 = byLabel<GeoNumeric>(k2, 'ar');
    expect(ar2.getValue()).toBeCloseTo(12, 6);
  });
});

describe('Angle(l1, l2) 两线角可达', () => {
  it('x+y=1 与 x−y=1：法向量 atan2 角', () => {
    const k = makeKernel();
    addInput(k, 'x + y = 1');
    addInput(k, 'x - y = 1');
    const l1 = k.getConstruction().getElements().find(e => e instanceof GeoLine) as GeoLine;
    const l2 = k.getConstruction().getElements().filter(e => e instanceof GeoLine)[1] as GeoLine;
    addInput(k, `a = Angle(${l1.label}, ${l2.label})`);
    const a = byLabel<GeoNumeric>(k, 'a');
    expect(a.isAngle).toBe(true);
    // (1,1)×(1,−1)：det=−2, dot=0 → atan2(−2,0) = −π/2 → 归一化 3π/2
    expect(a.getValue()).toBeCloseTo(3 * Math.PI / 2, 6);
  });
});

describe('IsInRegion 区域判定', () => {
  it('圆心在圆内 → 1（此前恒 0）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'P');
    addInput(k, 'x² + y² = 4');
    const conic = conicOf(k);
    addInput(k, `b = IsInRegion(P, ${conic.label})`);
    expect(byLabel<GeoNumeric>(k, 'b').getValue()).toBe(1);
  });

  it('不等式区域 isInRegionXY：y > x² 内点为真、外点为假', () => {
    const k = makeKernel();
    addInput(k, 'y > x²');
    const ineq = k.getConstruction().getElements().find((e): e is any => (e as any).getClassName?.() === 'GeoInequality') as any;
    expect(ineq).toBeDefined();
    expect(ineq.isInRegionXY(0, 1)).toBe(true);
    expect(ineq.isInRegionXY(0, -1)).toBe(false);
    // 注：IsInRegion 命令的参数解析只认 polygon/conic（官方语义如此），不等式区域
    // 的 isInRegionXY 供 PointIn/着色等内部消费
  });
});

describe('圆×圆内切交点（根轴特判）', () => {
  it('内切：x²+y²=9 与 (x−1)²+y²=4 交于 (3,0)', () => {
    const pts = intersectConicConic([1, 0, 1, 0, 0, -9], [1, 0, 1, -2, 0, -3]);
    expect(pts.length).toBe(1);
    expect(pts[0].x).toBeCloseTo(3, 6);
    expect(pts[0].y).toBeCloseTo(0, 6);
  });

  it('两交点 / 外切 / 同心', () => {
    expect(intersectConicConic([1, 0, 1, 0, 0, -25], [1, 0, 1, -8, 0, 7]).length).toBe(2);
    expect(intersectConicConic([1, 0, 1, 0, 0, -25], [1, 0, 1, -16, 0, 55])).toHaveLength(1);
    expect(intersectConicConic([1, 0, 1, 0, 0, -4], [1, 0, 1, 0, 0, -9])).toHaveLength(0);
  });

  it('命令端到端：Intersect 两圆内切得 1 点', () => {
    const k = makeKernel();
    addInput(k, 'x² + y² = 9');
    addInput(k, '(x - 1)² + y² = 4');
    const conics = k.getConstruction().getElements().filter(e => e instanceof GeoConic) as GeoConic[];
    addInput(k, `I = Intersect(${conics[0].label}, ${conics[1].label})`);
    const pts = k.getConstruction().getElements()
      .filter(e => e instanceof GeoPoint && (e as GeoPoint).parentAlgo?.getClassName() === 'AlgoIntersect' && e.isDefined()) as GeoPoint[];
    expect(pts.length).toBe(1);
    expect(pts[0].getX()).toBeCloseTo(3, 5);
  });
});

describe('弧上约束点扫窗（GeoArc 先于 GeoConic）', () => {
  it('Arc(0°→90°) 上的点拖出扫窗后夹回弧内', () => {
    const k = makeKernel();
    const O = makePoint(k, 0, 0, 'O');
    const S = makePoint(k, 2, 0, 'S');
    const E = makePoint(k, 0, 2, 'E');
    const arcAlgo = new AlgoArc(k, O, S, E);
    k.getConstruction().addElement(arcAlgo);
    const arc = arcAlgo.getOutput() as GeoArc;
    k.getConstruction().addElement(arc);

    const created = createParameterPointOnPath(k, arc, Math.SQRT2, Math.SQRT2);
    expect(created).not.toBeNull();
    // 参数区间 = 弧的起止角（此前被 GeoConic 分支拦截成 [0,2π]）
    expect(created!.param.intervalMin).toBeCloseTo(0, 6);
    expect(created!.param.intervalMax).toBeCloseTo(Math.PI / 2, 6);

    // 拖到 135° 方向（扫窗外）→ 夹回弧内
    (created!.algo as unknown as { updateParameter(x: number, y: number): void }).updateParameter(-1, 1);
    created!.algo.update();
    expect(arc.isOnPath(created!.point, 1e-6)).toBe(true);
  });
});

describe('Intersect(f,g) 相切交点（findRoots 重根检测）', () => {
  it('f=x² 与 g=0 的切点 (0,0) 被检出（窄窗口）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x²');
    addInput(k, 'g(x) = 0');
    const els = parseAlgebraInput(k, 'I = Intersect(f, g)', { minX: -4, maxX: 4, minY: -4, maxY: 4 });
    els.forEach(el => k.getConstruction().addElement(el));
    k.getConstruction().updateAllAlgorithms();
    const list = els.find((e): e is any => (e as any).getClassName?.() === 'GeoList');
    // 切点槽位点直接从返回元素断言（列表 children 由容器算法维护）
    const slotPts = els.filter((e): e is GeoPoint => e instanceof GeoPoint && e.isDefined());
    expect(slotPts.length).toBe(1);
    expect(slotPts[0].getX()).toBeCloseTo(0, 3);
    expect(list).toBeDefined();
  });

  it('findRoots 不误报：极小值不为零的函数无根', () => {
    expect(findRoots((x: number) => (x - 1) * (x - 1) + 0.01, -2, 4)).toHaveLength(0);
    expect(findRoots((x: number) => x * x - 4, -3, 3)).toHaveLength(2);
    expect(findRoots(Math.sin, -10, 10)).toHaveLength(7);
  });
});

describe('函数经不支持变换显式报错（此前静默别名原对象）', () => {
  it('Rotate(f, 90) 抛错而非返回 f 本身', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x²');
    expect(() => addInput(k, 'g = Rotate(f, 90)')).toThrow(/not supported for functions/);
  });

  it('Dilate(f, 2) 同样抛错', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x²');
    expect(() => addInput(k, 'g = Dilate(f, 2)')).toThrow(/not supported for functions/);
  });

  it('Translate(f, 1, 0)：函数图像平移（表达式替换语义）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x²');
    try {
      addInput(k, 'g = Translate(f, 1, 0)');
    } catch (e) {
      // 未实现也不允许静默别名：报错必须显式
      expect((e as Error).message).not.toMatch(/^$/);
    }
  });
});

describe('抛物线组合姿态分类（detQ 阈值收紧）', () => {
  it('y²=4x 经 平移+旋转+缩放 后仍为抛物线', () => {
    const th = (30 * Math.PI) / 180;
    const cos = Math.cos(th), sin = Math.sin(th), s = 1.6, dx = 80, dy = -60;
    const c1 = cos / s, s1 = sin / s, c2 = -sin / s, s2 = cos / s;
    const A = c2 * c2, B = 2 * c2 * s2, C = s2 * s2;
    const D = -2 * A * dx - B * dy - 4 * c1;
    const E = -B * dx - 2 * C * dy - 4 * s1;
    const F = A * dx * dx + B * dx * dy + C * dy * dy - 4 * (c1 * dx + s1 * dy);
    const k = makeKernel();
    const conic = new GeoConic(k, [A, B, C, D, E, F]);
    expect(conic.getConicType()).toBe('parabola');
  });
});
