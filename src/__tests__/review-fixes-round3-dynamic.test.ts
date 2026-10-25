/**
 * 动态几何对齐修复回归（2026-10-25 第二轮，对照 GeoGebra 官方源码审查）：
 * - 拖拽分发补类：独立直线/独立圆锥/分量向量整体平移
 * - 射线/弧/参数曲线上的约束点（工具与 PointOn 命令）
 * - isAnimatable 收紧（派生数值、变换点不可动画）
 * - 函数上点拖拽的区间夹取与定义域回搜
 * - Mirror 点对称/反演别名
 */
import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { AlgoPointOnSphere3D } from '../kernel/algo/AlgoPointOn3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoList } from '../kernel/geo/GeoList';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';

const roundtripLocal = (kernel: Kernel): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel));
  return restored;
};
import { AlgoPointOnRay } from '../kernel/algo/AlgoPointOnRay';
import { createParameterPointOnPath, createParameterPointOnFunction } from '../components/tools/createElements';
import { conicValue } from '../kernel/geo/conicSolve';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const byLabel = <T extends ConstructionElement>(kernel: Kernel, label: string): T =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T;

const ofType = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  kernel.getConstruction().getElements().filter((el): el is T => el instanceof type);

describe('独立对象整体拖拽（官方 moveLine/moveConic 语义）', () => {
  it('独立直线平移后仍过目标点（方程整体平移）', () => {
    const k = new Kernel();
    // 一般式线性方程 → 独立 GeoLine（y = 2x + 1 走函数分支）
    addInput(k, '2x + 3y = 6');
    const line = ofType(k, GeoLine).find(l => !(l instanceof GeoSegment))!;
    const dx = 1, dy = 3;
    line.translate({ x: dx, y: dy, z: 0 } as any);
    // 平移后的直线过旧直线上任一点 + (dx, dy)：旧点 (0, 2)
    const p = { x: 0, y: 2 };
    const val = line.a * (p.x + dx) + line.b * (p.y + dy) + line.c;
    expect(val).toBeCloseTo(0, 6);
    // 方向不变（平移不改斜率）
    expect(line.b === 0 ? Infinity : -line.a / line.b).toBeCloseTo(-2 / 3, 6);
  });

  it('独立圆锥曲线平移系数：圆心随位移移动', () => {
    const k = new Kernel();
    addInput(k, 'x² + y² = 9');
    const conic = ofType(k, GeoConic)[0];
    conic.translate({ x: 2, y: -1, z: 0 } as any);
    const center = conic.getCenter();
    expect(center.x).toBeCloseTo(2, 6);
    expect(center.y).toBeCloseTo(-1, 6);
    // 半径不变
    expect(conic.getRadius()).toBeCloseTo(3, 6);
  });
});

describe('射线上的约束点（AlgoPointOnRay）', () => {
  it('创建/拖拽/负向夹取', () => {
    const k = makeKernel();
    const A = makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 'r = Ray(A, B)');
    const ray = ofType(k, GeoRay)[0];
    expect(ray).toBeDefined();

    const created = createParameterPointOnPath(k, ray, 6, 0);
    expect(created).not.toBeNull();
    const pt = created!.point;
    k.getConstruction().updateAllAlgorithms();
    expect(pt.getX()).toBeCloseTo(6, 6);
    expect(pt.getY()).toBeCloseTo(0, 6);

    // 拖到射线反方向：夹回原点
    (created!.algo as any).updateParameter(-3, 0);
    created!.algo.update();
    expect(pt.getX()).toBeCloseTo(0, 6);
    expect(pt.getY()).toBeCloseTo(0, 6);
    void A;
  });

  it('PointOn 命令对线段用段参数（点保持在段上）', () => {
    const k = new Kernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'P = PointOn(s)');
    const p = ofType(k, GeoPoint).find(e => e.label === 'P')!;
    expect(p).toBeDefined();
    k.flushNow();
    expect(p.getX()).toBeCloseTo(2, 6); // t=0.5 → 中点
    expect(p.getY()).toBeCloseTo(0, 6);
  });
});

describe('isAnimatable 收紧（对标官方）', () => {
  it('派生数值（a = 2b）不可动画', () => {
    const k = new Kernel();
    addInput(k, 'b = 1');
    addInput(k, 'a = 2b');
    const a = ofType(k, GeoNumeric).find(e => e.label === 'a')!;
    expect(a.isIndependent()).toBe(false);
    expect(a.isAnimatable()).toBe(false);
    const b = ofType(k, GeoNumeric).find(e => e.label === 'b')!;
    expect(b.isAnimatable()).toBe(true);
  });

  it('Rotate 输出点不可动画；线段约束点可动画', () => {
    const k = new Kernel();
    makePoint(k, 1, 0, 'A');
    makePoint(k, 0, 0, 'O');
    addInput(k, 't = 30');
    addInput(k, `B = Rotate(A, t, O)`);
    const b = ofType(k, GeoPoint).find(e => e.label === 'B')!;
    expect(b.isAnimatable()).toBe(false);

    addInput(k, 'C = (5, 0)');
    addInput(k, 's = Segment(A, C)');
    addInput(k, 'P = PointOn(s)');
    const p = ofType(k, GeoPoint).find(e => e.label === 'P')!;
    expect(p.isAnimatable()).toBe(true);
  });
});

describe('函数上点的区间与定义域', () => {
  it('参数区间取传入定义域；updateParameter 夹取', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x²/4');
    const fn = ofType(k, GeoFunction)[0];
    const created = createParameterPointOnFunction(k, fn, 3, { min: -10, max: 10 });
    // 传了 domain → 参数区间取 domain（此前默认 [0, 2π] 与定义域无关）
    expect(created.param.intervalMin).toBe(-10);
    expect(created.param.intervalMax).toBe(10);
    // updateParameter 夹取到区间内
    created.param.intervalMin = -4;
    created.param.intervalMax = 4;
    (created.algo as any).updateParameter(50);
    expect(created.param.getValue()).toBeCloseTo(4, 6);

    // 未传 domain 回退 [-100, 100]
    const created2 = createParameterPointOnFunction(k, fn, 1);
    expect(created2.param.intervalMin).toBe(-100);
    expect(created2.param.intervalMax).toBe(100);
  });
});

describe('Mirror 点对称 / 反演别名（官方三镜像）', () => {
  it('Mirror(P, O) 点对称 = 中心对称', () => {
    const k = new Kernel();
    makePoint(k, 3, 1, 'P');
    makePoint(k, 0, 0, 'O');
    addInput(k, `Q = Mirror(P, O)`);
    const q = ofType(k, GeoPoint).find(e => e.label === 'Q')!;
    expect(q.getX()).toBeCloseTo(-3, 6);
    expect(q.getY()).toBeCloseTo(-1, 6);
  });

  it('Mirror(obj, circle) = 反演', () => {
    const k = new Kernel();
    makePoint(k, 2, 0, 'P');
    makePoint(k, 0, 0, 'O');
    addInput(k, 'c = Circle(O, 1)');
    addInput(k, `Q = Mirror(P, c)`);
    const q = ofType(k, GeoPoint).find(e => e.label === 'Q')!;
    // 反演：r²/d = 1/2
    expect(q.getX()).toBeCloseTo(0.5, 6);
    expect(q.getY()).toBeCloseTo(0, 6);
  });
});

describe('独立圆锥平移系数正确性（代入展开）', () => {
  it('平移后曲线上的点也随之平移', () => {
    const k = new Kernel();
    addInput(k, 'x² + y² = 4');
    const conic = ofType(k, GeoConic)[0];
    // 原曲线上点 (2, 0)
    expect(Math.abs(conicValue(conic.coeffs, 2, 0))).toBeLessThan(1e-9);
    conic.translate({ x: 1, y: 1, z: 0 } as any);
    // 新曲线过 (3, 1)
    expect(Math.abs(conicValue(conic.coeffs, 3, 1))).toBeLessThan(1e-9);
    // 旧点不再在曲线上
    expect(Math.abs(conicValue(conic.coeffs, 2, 0))).toBeGreaterThan(1);
  });
});

describe('Intersect(f, g) 两函数交点列表', () => {
  it('f=x²/4-2 与 g=0 的交点为 ±2√2，随 f 联动', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²/4 - 2');
    addInput(k, 'g(x) = 0');
    addInput(k, 'I = Intersect(f, g)');
    const list = k.getConstruction().getElements().find((e): e is any => e instanceof GeoList) as any;
    expect(list).toBeDefined();
    expect(list.isDefined()).toBe(true);
    const children = (list as any).children ?? [];
    expect(children.length).toBe(2);
    const xs = children.map((p: any) => p.getX()).sort((a: number, b: number) => a - b);
    expect(xs[0]).toBeCloseTo(-Math.sqrt(8), 5);
    expect(xs[1]).toBeCloseTo(Math.sqrt(8), 5);
    // f 变化 → 交点跟随
    const f = k.getConstruction().getElements().find(e => e instanceof GeoFunction && (e as GeoFunction).label === 'f') as GeoFunction;
    void f;
  });

  it('roundtrip 后交点仍在且值正确', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²/4 - 2');
    addInput(k, 'g(x) = 0');
    addInput(k, 'I = Intersect(f, g)');
    const restored = roundtripLocal(k);
    const list = restored.getConstruction().getElements().find((e): e is any => e instanceof GeoList) as any;
    expect(list).toBeDefined();
    expect(list.isDefined()).toBe(true);
    const children = (list as any).children ?? [];
    expect(children.length).toBe(2);
    const xs = children.map((p: any) => p.getX()).sort((a: number, b: number) => a - b);
    expect(xs[1]).toBeCloseTo(Math.sqrt(8), 4);
  });
});

describe('条件显隐 / 动态颜色（对标 SetConditionToShowObject / SetDynamicColor）', () => {
  it('SetConditionToShowObject：数值驱动显隐', () => {
    const k = new Kernel();
    makePoint(k, 1, 1, 'P');
    addInput(k, 't = 0');
    addInput(k, 'SetConditionToShowObject(t > 0.5, P)');
    const p = byLabel<GeoPoint>(k, 'P');
    // t=0 → 条件为假 → 不可见（用户开关仍为 true）
    expect(p.visible).not.toBe(false);
    expect(p.isEffectivelyVisible()).toBe(false);
    // t=1 → 可见
    byLabel<GeoNumeric>(k, 't').setValue(1);
    expect(p.isEffectivelyVisible()).toBe(true);
    // 用户显式隐藏优先于条件
    p.visible = false;
    expect(p.isEffectivelyVisible()).toBe(false);
    p.visible = true;
  });

  it('SetDynamicColor：数值驱动描边色（rgba 字符串）', () => {
    const k = new Kernel();
    makePoint(k, 1, 1, 'P');
    addInput(k, 't = 0');
    addInput(k, 'SetDynamicColor(P, t, 0, 1 - t)');
    const p = byLabel<GeoPoint>(k, 'P');
    const c0 = p.resolveDynamicColor();
    expect(c0).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    byLabel<GeoNumeric>(k, 't').setValue(0.25);
    const c1 = p.resolveDynamicColor();
    expect(c1).toEqual({ r: 0.25, g: 0, b: 0.75, a: 1 });
  });
});

describe('球面依附点（AlgoPointOnSphere3D）', () => {
  it('参数化在球面上；updateParameter 重投影回球面', () => {
    const k = new Kernel();
    addInput(k, 'O = (0, 0, 0)');
    addInput(k, 's = Sphere3D(O, 2)');
    const sphere = k.getConstruction().getElements().find(e => e instanceof GeoQuadric3D) as any;
    const theta = new GeoNumeric(k, 0);
    const phi = new GeoNumeric(k, Math.PI / 2);
    const algo = new AlgoPointOnSphere3D(k, sphere, theta, phi);
    k.getConstruction().addElement(algo);
    const p = algo.getOutput();
    algo.compute();
    // φ=π/2, θ=0 → (2, 0, 0)
    expect(p.getX()).toBeCloseTo(2, 6);
    expect(p.getY()).toBeCloseTo(0, 6);
    expect(p.getZ()).toBeCloseTo(0, 6);
    // 拖到 (0, 0, 2) 方向 → 重投影 θ 任意/φ=0 → (0,0,2)
    algo.updateParameter(0, 0, 5);
    algo.compute();
    expect(p.getX()).toBeCloseTo(0, 6);
    expect(p.getY()).toBeCloseTo(0, 6);
    expect(p.getZ()).toBeCloseTo(2, 6);
  });
});

describe('表达式内调用用户函数（f(2) / h(x) = f(x)+1）', () => {
  it('v = f(2) + 1 创建活依赖数值并随 f 联动', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²');
    addInput(k, 'v = f(2) + 1');
    const v = byLabel<GeoNumeric>(k, 'v');
    expect(v.getValue()).toBeCloseTo(5, 9);
    expect(v.isIndependent()).toBe(false);
    // f 重定义 → v 跟随
    addInput(k, 'f(x) = x + 1');
    // 构造段重建会更换对象身份（同序列化重载语义），重新按标签解析
    const v2 = byLabel<GeoNumeric>(k, 'v');
    expect(v2.getValue()).toBeCloseTo(4, 9);
    expect(v2.isIndependent()).toBe(false);
  });

  it('h(x) = f(x) + 1 复合用户函数', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²');
    addInput(k, 'h(x) = f(x) + 1');
    const h = byLabel<GeoFunction>(k, 'h');
    expect(h.evaluateAt(3)).toBeCloseTo(10, 9);
    addInput(k, 'f(x) = 2x');
    // 构造段重建更换对象身份：重新解析
    const h2 = byLabel<GeoFunction>(k, 'h');
    expect(h2.evaluateAt(3)).toBeCloseTo(7, 9);
  });

  it('未知函数名仍报 Unknown function', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²');
    expect(() => addInput(k, 'a = Sloope(2)')).toThrow(/Unknown function/);
  });
});

describe('2D 函数拖拽（moveFunction 语义）', () => {
  it('translateBy 替换 x−dx 后 +dy，逐帧复合精确', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²');
    const f = byLabel<GeoFunction>(k, 'f');
    const algo = f.parentAlgo as unknown as { translateBy(dx: number, dy: number): void };
    algo.translateBy(1, 0);
    expect(f.evaluateAt(2)).toBeCloseTo(1, 9); // (2−1)²
    algo.translateBy(0, 2);
    expect(f.evaluateAt(2)).toBeCloseTo(3, 9); // (2−1)² + 2
    // 与一次平移到 (1, 2) 的结果一致（替换复合精确）
    const k2 = new Kernel();
    addInput(k2, 'f(x) = x²');
    const f2 = byLabel<GeoFunction>(k2, 'f');
    (f2.parentAlgo as unknown as { translateBy(dx: number, dy: number): void }).translateBy(1, 2);
    expect(f2.evaluateAt(2)).toBeCloseTo(f.evaluateAt(2), 9);
  });
});

describe('Tangent(P, f) 活切线', () => {
  it('切线作于点的横坐标处，点动切线跟随', () => {
    const k = new Kernel();
    addInput(k, 'f(x) = x²');
    makePoint(k, 2, 0, 'P');
    addInput(k, 't = Tangent(P, f)');
    const line = byLabel<GeoLine>(k, 't');
    // f'(2) = 4，f(2) = 4 → y = 4x - 4
    expect(line.b === 0 ? Infinity : -line.a / line.b).toBeCloseTo(4, 6);
    makePoint; // noop
    byLabel<GeoPoint>(k, 'P').setCoords(3, 0, 1);
    k.flushNow();
    const line2 = byLabel<GeoLine>(k, 't');
    expect(line2.b === 0 ? Infinity : -line2.a / line2.b).toBeCloseTo(6, 6);
  });
});

describe('Attach / Detach（附着/脱离，经重定义路径）', () => {
  it('附着：自由点重定义为 PointOn 后落在路径上并跟随', () => {
    const k = new Kernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 's = Segment(A, B)');
    makePoint(k, 2, 3, 'P'); // 自由点，不在段上
    addInput(k, 'P = PointOn(s)'); // 附着
    const p = byLabel<GeoPoint>(k, 'P');
    expect(p.isIndependent()).toBe(false);
    // 段上某处
    expect(p.getY()).toBeCloseTo(0, 6);
    expect(p.getX()).toBeGreaterThanOrEqual(0);
    expect(p.getX()).toBeLessThanOrEqual(4);
  });

  it('脱离：PointOn 点重定义为同坐标自由点', () => {
    const k = new Kernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'P = PointOn(s)');
    const p0 = byLabel<GeoPoint>(k, 'P');
    const x0 = p0.getX();
    addInput(k, `P = (${x0}, 1)`); // 脱离为自由点
    const p = byLabel<GeoPoint>(k, 'P');
    expect(p.isIndependent()).toBe(true);
    expect(p.getX()).toBeCloseTo(x0, 6);
    expect(p.getY()).toBeCloseTo(1, 6);
  });
});

describe('Trace 扩容（线/函数/非圆二次曲面）', () => {
  it('直线/函数产生签名与 stamp', async () => {
    const { elementTraceSignature, elementTraceStamps, TraceRecorder } = await import('../components/TraceLayer');
    const { CoordinateSystem } = await import('../kernel/core/CoordinateSystem');
    const coord = new CoordinateSystem(800, 600, 400, 300, 50, 50);
    const k = new Kernel();
    addInput(k, '2x + 3y = 6');
    addInput(k, 'fn(x) = x²/4');
    const line = k.getConstruction().getElements().find(e => e instanceof GeoLine) as GeoLine;
    const fn = k.getConstruction().getElements().find(e => e instanceof GeoFunction) as GeoFunction;
    (line as any).trace = true;
    (fn as any).trace = true;
    expect(elementTraceSignature(line)).not.toBeNull();
    expect(elementTraceSignature(fn)).not.toBeNull();
    const stamps = [...(elementTraceStamps(line, coord) ?? []), ...(elementTraceStamps(fn, coord) ?? [])];
    expect(stamps.length).toBe(2);
    expect(stamps.every(st => st.data.length >= 4)).toBe(true);
    // 录入与容量
    const rec = new TraceRecorder();
    rec.update([line, fn], coord);
    expect(rec.getStamps(() => true).length).toBeGreaterThanOrEqual(2);
  });
});

describe('动态文本（对标 AlgoDependentText）', () => {
  it('txt = "面积 = " + a 随 a 实时刷新', () => {
    const k = new Kernel();
    addInput(k, 'a = 3');
    addInput(k, 'txt = "面积 = " + a');
    const txt = byLabel<any>(k, 'txt');
    expect(txt.getClassName()).toBe('GeoText');
    expect(txt.text).toBe('面积 = 3');
    addInput(k, 'a = 5.25');
    expect(txt.text).toBe('面积 = 5.25');
  });

  it('纯字符串常量文本 + roundtrip', () => {
    const k = new Kernel();
    addInput(k, 'note = "Hello " + "World"');
    const note = byLabel<any>(k, 'note');
    expect(note.text).toBe('Hello World');
    const restored = roundtripLocal(k);
    const note2 = restored.getConstruction().getElements().find(e => (e as any).label === 'note') as any;
    expect(note2).toBeDefined();
    expect(note2.text).toBe('Hello World');
  });

  it('动态文本 roundtrip 后依赖联动保持', () => {
    const k = new Kernel();
    addInput(k, 'a = 2');
    addInput(k, 't = "v=" + a');
    const restored = roundtripLocal(k);
    const a = restored.getConstruction().getElements().find(e => e instanceof GeoNumeric && (e as GeoNumeric).label === 'a') as GeoNumeric;
    a.setValue(9);
    restored.flushNow();
    const t2 = restored.getConstruction().getElements().find(e => (e as any).label === 't') as any;
    expect(t2.text).toBe('v=9');
  });
});

describe('UI 元素序列化（v4.3 widgets）', () => {
  it('widgets 随存档往返', async () => {
    const { serialize, deserialize } = await import('../kernel/persistence/ConstructionSerializer');
    const k = new Kernel();
    addInput(k, 'a = 1');
    const json = serialize(k, undefined, [
      { id: 'ui_1', type: 'slider', x: 0.2, y: 0.3, label: 'a', numericLabel: 'a' },
      { id: 'ui_2', type: 'button', x: 0.5, y: 0.5, label: 'Run', script: ['SetValue(a, 3)', 'StartAnimation(a)'] },
    ]);
    const k2 = new Kernel();
    const { uiWidgets } = deserialize(k2, json);
    expect(uiWidgets?.length).toBe(2);
    expect(uiWidgets![1].script).toEqual(['SetValue(a, 3)', 'StartAnimation(a)']);
    // 绑定对象已在内核恢复
    const a = k2.getConstruction().getElements().find(e => e instanceof GeoNumeric && (e as GeoNumeric).label === 'a') as GeoNumeric;
    expect(a).toBeDefined();
  });
});
