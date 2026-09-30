import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoRegularPolygonEdge } from '../kernel/algo/AlgoRegularPolygonEdge';
import { GeoConicPart, CONIC_PART_ARC } from '../kernel/geo/GeoConicPart';
import { buildTransformed } from '../kernel/algo/AlgoRotate';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { handlePointerDown } from '../components/tools/handlers';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { ToolMode, ToolContext } from '../components/tools/types';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { GeoFunction } from '../kernel/geo/GeoFunction';

const makeLine = (kernel: Kernel, a: number, b: number, cc: number, label?: string) => {
  const l = new GeoLine(kernel, a, b, cc);
  if (label) l.label = label;
  c(kernel).addElement(l);
  return l;
};

const makeKernel = () => new Kernel();
const roundtripLocal = (kernel: Kernel): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel));
  return restored;
};
const ofTypeLocal = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  kernel.getConstruction().getElements().filter((el): el is T => el instanceof type);
const c = (kernel: Kernel) => kernel.getConstruction();
const makePoint = (kernel: Kernel, x: number, y: number, label?: string) => {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
  if (label) p.label = label;
  c(kernel).addElement(p);
  return p;
};

describe('AlgoRegularPolygonEdge（GeoGebra 边两点模型）', () => {
  it('A(0,0)→B(4,0) 的正方形在上方（世界 y 为正），顶点序逆时针', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    const algo = new AlgoRegularPolygonEdge(kernel, a, b, 4);
    c(kernel).addElement(algo);
    for (const out of algo.getGeoElements()) c(kernel).addElement(out);
    algo.update();

    const poly = algo.getOutput();
    expect(poly).toBeInstanceOf(GeoPolygon);
    expect(poly.vertices).toHaveLength(4);
    // 世界 y-up，v2、v3 在 AB 上方（y 为正），顶点序逆时针
    expect(poly.vertices[2].getX()).toBeCloseTo(4, 6);
    expect(poly.vertices[2].getY()).toBeCloseTo(4, 6);
    expect(poly.vertices[3].getX()).toBeCloseTo(0, 6);
    expect(poly.vertices[3].getY()).toBeCloseTo(4, 6);
    // 前两个顶点引用输入点（拖动联动）
    expect(poly.vertices[0]).toBe(a);
    expect(poly.vertices[1]).toBe(b);
    // 边长全部相等
    const edges: number[] = [];
    for (let i = 0; i < 4; i++) {
      const p = poly.vertices[i], q = poly.vertices[(i + 1) % 4];
      edges.push(Math.hypot(q.getX() - p.getX(), q.getY() - p.getY()));
    }
    for (const e of edges) expect(e).toBeCloseTo(4, 6);
  });

  it('拖动 A 或 B 时其余顶点联动重算', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 3, 0, 'B');
    const algo = new AlgoRegularPolygonEdge(kernel, a, b, 6);
    c(kernel).addElement(algo);
    for (const out of algo.getGeoElements()) c(kernel).addElement(out);
    algo.update();

    b.setCoords(0, 3, 1);
    kernel.flushNow();
    const poly = algo.getOutput();
    for (let i = 0; i < 6; i++) {
      const p = poly.vertices[i], q = poly.vertices[(i + 1) % 6];
      const side = Math.hypot(q.getX() - p.getX(), q.getY() - p.getY());
      expect(side).toBeCloseTo(3, 6);
    }
  });
});

describe('AlgoIntersect：多边形 × 圆锥曲线', () => {
  it('逐边求交并过滤出边上的交点（GeoGebra AlgoIntersectPolyLineConic 语义）', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 6, 0, 'B');
    const d = makePoint(kernel, 6, 6, 'D');
    const poly = new GeoPolygon(kernel, [a, b, d]);
    // 圆 (4,2) r=2：与边 AB(y=0) 交于 x=4（1 点）；与边 BD(x=6) 交于 y=2（1 点）；与边 DA(对角线 y=x) 相切于 (3.414,3.414) 附近 1 点
    const circle = new GeoConic(kernel, [1, 0, 1, -8, -4, 16]);
    const algo = new AlgoIntersect(kernel, poly, circle);
    c(kernel).addElement(algo);
    for (const p of algo.getOutputPoints()) c(kernel).addElement(p);
    algo.update();

    const defined = algo.getOutputPoints().filter(p => p.isDefined());
    expect(defined.length).toBeGreaterThanOrEqual(2);
    // 边 AB 上的交点
    const onAB = defined.find(p => Math.abs(p.getY()) < 1e-6 && Math.abs(p.getX() - 4) < 1e-6);
    expect(onAB).toBeDefined();
    // 边 BD 上的交点
    const onBD = defined.find(p => Math.abs(p.getX() - 6) < 1e-6 && Math.abs(p.getY() - 2) < 1e-6);
    expect(onBD).toBeDefined();
    // 所有交点都在圆上
    for (const p of defined) {
      const dx = p.getX() - 4, dy = p.getY() - 2;
      expect(Math.hypot(dx, dy)).toBeCloseTo(2, 5);
    }
  });
});

describe('序列化 roundtrip（新增构造）', () => {
  it('AlgoRegularPolygonEdge：多边形 + 新顶点标签/坐标往返保持', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    const algo = new AlgoRegularPolygonEdge(kernel, a, b, 5);
    algo.getOutput().label = 'pent';
    algo.getNewPoints().forEach((p, i) => { p.label = `P${i}`; });
    c(kernel).addElement(algo);
    for (const out of algo.getGeoElements()) c(kernel).addElement(out);
    algo.update();

    const restored = roundtripLocal(kernel);
    const poly = ofTypeLocal(restored, GeoPolygon).find(el => el.label === 'pent');
    expect(poly).toBeDefined();
    expect(poly!.vertices).toHaveLength(5);
    // 边长全部相等（正五边形）
    for (let i = 0; i < 5; i++) {
      const p = poly!.vertices[i], q = poly!.vertices[(i + 1) % 5];
      expect(Math.hypot(q.getX() - p.getX(), q.getY() - p.getY())).toBeCloseTo(4, 5);
    }
  });

  it('AlgoIntersect（多边形 × 圆）：交点列表往返保持', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 6, 0, 'B');
    const d = makePoint(kernel, 6, 6, 'D');
    const poly = new GeoPolygon(kernel, [a, b, d]);
    poly.label = 'tri';
    c(kernel).addElement(poly);
    const circle = new GeoConic(kernel, [1, 0, 1, -8, -4, 16]);
    circle.label = 'circ';
    c(kernel).addElement(circle);
    const algo = new AlgoIntersect(kernel, poly, circle);
    algo.getOutputPoints().forEach(p => { p.label = p.label || 'S'; c(kernel).addElement(p); });
    c(kernel).addElement(algo);
    algo.update();
    const before = algo.getOutputPoints().filter(p => p.isDefined()).length;
    expect(before).toBeGreaterThanOrEqual(2);

    const restored = roundtripLocal(kernel);
    const algos = ofTypeLocal(restored, AlgoIntersect);
    expect(algos).toHaveLength(1);
    const after = algos[0].getOutputPoints().filter(p => p.isDefined()).length;
    expect(after).toBe(before);
  });
});

describe('GeoConicPart（弧/扇形）变换保留部分圆语义', () => {
  it('rotate 后仍是弧段（此前返回整圆），角度随中心映射', () => {
    const kernel = makeKernel();
    // 单位圆上 0°→90° 的弧
    const arc = new GeoConicPart(kernel, { x: 0, y: 0 }, 2, 0, Math.PI / 2, CONIC_PART_ARC, true);
    const center = { x: 0, y: 0 };
    const out = buildTransformed(kernel, arc, 'rotate', { center, angle: Math.PI / 2 }) as GeoConicPart;
    expect(out).toBeInstanceOf(GeoConicPart);
    expect(out.getPartType()).toBe(CONIC_PART_ARC);
    // 正角 = 数学逆时针（世界 y-up）：0°→90°，90°→180°
    expect(out.getStartAngle()).toBeCloseTo(Math.PI / 2, 5);
    expect(out.getEndAngle()).toBeCloseTo(Math.PI, 5);
    expect(out.getRadius()).toBeCloseTo(2, 5);
  });
});

/** 最小 ToolContext 桩（与 b10 测试同构），供点击顺序类测试共用。 */
const makeToolCtx = (kernel: Kernel, mode: ToolMode, selected: GeoElement[] = []) => {
  let sel = selected;
  const ts: Record<string, any> = {};
  const setSel: any = (v: any) => { sel = typeof v === 'function' ? v(sel) : v; };
  const noop = () => {};
  const ctx: any = {
    kernel,
    construction: c(kernel),
    coord: new CoordinateSystem(800, 600, 400, 300, 50, 50),
    get elements() { return c(kernel).getElements(); },
    selectedElements: sel,
    mode,
    mousePos: { x: 0, y: 0 },
    hoveredPoint: null,
    radius: 50,
    setMode: noop, setSelectedElements: setSel, setRenderRev: noop, setPolygonPoints: noop,
    addCommand: noop, captureState: () => ({}),
    setBoxSelecting: noop, setBoxStartScreen: noop, setBoxEndScreen: noop,
    setDraggedElement: noop,
    toolState: { current: ts },
    t: (k: string) => k,
  };
  Object.defineProperty(ctx, 'selectedElements', { get: () => sel, configurable: true });
  const clickAt = (x: number, y: number) => handlePointerDown(ctx, { x, y } as any, { x, y } as any);
  return { ctx, clickAt, ts };
};

describe('mirror_line 任意点击顺序', () => {
  it('先点源对象、再点镜像线（GeoGebra 顺序）即可完成镜像', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 1, 1, 'A');
    makeLine(kernel, 1, 0, 0, 'l'); // x = 0
    const { clickAt } = makeToolCtx(kernel, 'mirror_line', []);
    clickAt(1, 1);   // 源对象（点 A）
    clickAt(0, 5);   // 镜像线 l（本击应直接执行）

    const mirrors = c(kernel).getElements().filter(el => (el as any).getClassName?.() === 'AlgoMirror');
    expect(mirrors).toHaveLength(1);
    const image = (mirrors[0] as any).getOutput() as GeoPoint;
    expect(image.getX()).toBeCloseTo(-1, 6);
    expect(image.getY()).toBeCloseTo(1, 6);
    void a;
  });
});

describe('Shear / Stretch 代数命令', () => {
  it('Shear(P, y=0, 2) 沿 x 正比于 y 剪切', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'P');
    makeLine(kernel, 0, 1, 0, 'l'); // y = 0
    const result = parseAlgebraInput(kernel, 'Shear(P, l, 2)');
    const out = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(out).toBeDefined();
    // (1,1) 关于 y=0 剪切 λ=2：x' = x + 2y = 3, y' = 1
    expect(out.getX()).toBeCloseTo(3, 6);
    expect(out.getY()).toBeCloseTo(1, 6);
  });

  it('Stretch(P, y=0, 3) 沿法向缩放', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'P');
    makeLine(kernel, 0, 1, 0, 'l'); // y = 0
    const result = parseAlgebraInput(kernel, 'Stretch(P, l, 3)');
    const out = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(out).toBeDefined();
    // y' = 3y = 3, x 不变
    expect(out.getX()).toBeCloseTo(1, 6);
    expect(out.getY()).toBeCloseTo(3, 6);
  });
});

describe('mirror_point 任意点击顺序', () => {
  it('先点线段源对象、再点中心点（GeoGebra 顺序）', () => {
    const kernel = makeKernel();
    const p1 = makePoint(kernel, -2, 0, 'P');
    const p2 = makePoint(kernel, 2, 0, 'Q');
    const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
    c(kernel).addElement(segAlgo);
    c(kernel).addElement(segAlgo.getOutput());
    segAlgo.update();
    const center = makePoint(kernel, 0, 0, 'M');
    void center;
    const { clickAt } = makeToolCtx(kernel, 'mirror_point', []);
    clickAt(0, 0);   // 线段中部（源对象）
    clickAt(0, 0);   // 中心点 M（第二次点击；注意第一击后源已记录）
    const dilates = c(kernel).getElements().filter(el => (el as any).getClassName?.() === 'AlgoDilate');
    expect(dilates.length).toBeGreaterThanOrEqual(1);
  });
});

describe('2D 隐式方程输入（GeoGebra 对齐）', () => {
  it('y=0 创建 x 轴直线，x=3 创建竖直直线', () => {
    const kernel = makeKernel();
    const r1 = parseAlgebraInput(kernel, 'y=0');
    const l1 = r1.find(el => el instanceof GeoLine) as GeoLine;
    expect(l1).toBeDefined();
    expect(l1.a).toBeCloseTo(0, 9);
    expect(l1.b).toBeCloseTo(1, 9);
    expect(l1.c).toBeCloseTo(0, 9);

    const r2 = parseAlgebraInput(kernel, 'x=3');
    const l2 = r2.find(el => el instanceof GeoLine) as GeoLine;
    expect(l2).toBeDefined();
    expect(l2.a).toBeCloseTo(1, 9);
    expect(l2.b).toBeCloseTo(0, 9);
    expect(l2.c).toBeCloseTo(-3, 9);
  });

  it('x^2+y^2=25 创建圆；x=y^2 创建抛物线形圆锥曲线', () => {
    const kernel = makeKernel();
    const r1 = parseAlgebraInput(kernel, 'x^2 + y^2 = 25');
    const conic1 = r1.find(el => el instanceof GeoConic) as GeoConic;
    expect(conic1).toBeDefined();
    expect(conic1.getConicType()).toBe('circle');
    expect(conic1.getCenter().x).toBeCloseTo(0, 6);
    expect(conic1.getRadius()).toBeCloseTo(5, 6);

    const r2 = parseAlgebraInput(kernel, 'x = y^2');
    const conic2 = r2.find(el => el instanceof GeoConic) as GeoConic;
    expect(conic2).toBeDefined();
    expect(conic2.getConicType()).toBe('parabola');
  });

  it('y = x^2 仍是函数（不退化成圆锥曲线）', () => {
    const kernel = makeKernel();
    const r = parseAlgebraInput(kernel, 'y = x^2');
    expect(r.some(el => el instanceof GeoFunction || (el as any).getClassName === 'AlgoDependentFunction')).toBe(true);
    expect(r.find(el => el instanceof GeoConic)).toBeUndefined();
  });
});

describe('命令参数中的方程字符串（GeoGebra 对齐）', () => {
  it('Intersect(y=0, x^2+y^2=25) 自动创建对象并求交', () => {
    const kernel = makeKernel();
    const r = parseAlgebraInput(kernel, 'Intersect(y=0, x^2+y^2=25)');
    const lines = r.filter(el => el instanceof GeoLine).length
      + kernel.getConstruction().getElements().filter(el => el instanceof GeoLine).length;
    void lines;
    // 参数对象已入构造
    const all = kernel.getConstruction().getElements();
    expect(all.some(el => el instanceof GeoLine)).toBe(true);
    expect(all.some(el => el instanceof GeoConic)).toBe(true);
    // 交点 (±5, 0)
    const pts = r.filter(el => el instanceof GeoPoint) as GeoPoint[];
    expect(pts.length).toBe(2);
    const xs = pts.map(p => p.getX()).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-5, 6);
    expect(xs[1]).toBeCloseTo(5, 6);
    for (const p of pts) expect(p.getY()).toBeCloseTo(0, 6);
  });

  it('Shear(圆方程, y=0, 0.6) 创建剪切椭圆', () => {
    const kernel = makeKernel();
    const returned = parseAlgebraInput(kernel, 'Shear(x^2+y^2=25, y=0, 0.6)');
    // 返回 [algo, output]；参数里的圆/直线对象在预处理时已入构造
    const image = returned.find(el => el instanceof GeoConic) as GeoConic;
    expect(image).toBeDefined();
    expect(image.getConicType()).toBe('ellipse');
  });
});

describe('旧存档 y-down → y-up 迁移', () => {
  it('无 yUp 标记的 v2 存档：点/直线/圆锥/文本 y 镜像，表达式不动', () => {
    const kernel = makeKernel();
    // 手工构造一份 v2 y-down 存档：点 (1,3)、直线 y=-2（[0,1,2]）、圆 x²+(y+1)²=4
    const legacy = {
      version: 2,
      generator: 'MiniGeogebra',
      independentElements: [
        { type: 'GeoPoint', constIndex: 0, label: 'A', coords: [1, 3, 1] },
        { type: 'GeoLine', constIndex: 1, label: 'l', lineCoeffs: [0, 1, 2] },
        { type: 'GeoConic', constIndex: 2, label: 'c', coeffs: [1, 0, 1, 0, 2, -3] },
        { type: 'GeoNumeric', constIndex: 3, label: 'a', value: 2 },
      ],
      algorithms: [],
    };
    const restored = new Kernel();
    deserialize(restored, JSON.stringify(legacy));
    const els = restored.getConstruction().getElements();
    const pt = els.find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'A') as GeoPoint;
    expect(pt.getY()).toBeCloseTo(-3, 6);
    const line = els.find(el => el instanceof GeoLine && (el as GeoLine).label === 'l') as GeoLine;
    expect([line.a, line.b, line.c]).toEqual([0, -1, 2]); // y=-2 保持不变（镜像后同一条线）
    const conic = els.find(el => el instanceof GeoConic && (el as GeoConic).label === 'c') as GeoConic;
    // (x)²+(y+1)²=4 镜像 → x²+(y-1)²=4：E 系数 2 → −2
    expect(conic.coeffs[4]).toBeCloseTo(-2, 6);
  });

  it('带 yUp 标记的新存档不二次镜像', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 3, 'A');
    const json = JSON.parse(serialize(kernel));
    expect(json.yUp).toBe(true);
    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const pt = restored.getConstruction().getElements().find(el => el instanceof GeoPoint) as GeoPoint;
    expect(pt.getY()).toBeCloseTo(3, 6);
  });
});
