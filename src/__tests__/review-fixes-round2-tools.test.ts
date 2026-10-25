/**
 * 工具层修复回归（2026-10-25 审查轮）：
 * - 两点工具两次空白点击可完成构造（此前第二击被吞）
 * - angle 工具顶点在第二击（GeoGebra ∠ABC 语义）
 * - tangent 工具按点击位置选中圆锥曲线（此前恒取"最新一条"）
 * - polygon 工具只回收本工具新建的点
 * - 解析器拒绝 1.2.3 一类数字粘合
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { AlgoTangent } from '../kernel/algo/AlgoTangent';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { handlePointerDown } from '../components/tools/handlers';
import { ToolMode } from '../components/tools/types';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';

const roundtripLocal = (kernel: Kernel): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel));
  return restored;
};

const c = (kernel: Kernel) => kernel.getConstruction();
const makePoint = (kernel: Kernel, x: number, y: number, label?: string) => {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
  if (label) p.label = label;
  c(kernel).addElement(p);
  return p;
};

/** 最小 ToolContext 桩（与 tool-interaction-fixes 同构）。 */
const makeToolCtx = (kernel: Kernel, mode: ToolMode, selected: GeoElement[] = []) => {
  let sel = selected;
  const ts: Record<string, any> = {};
  const setSel: any = (v: any) => { sel = typeof v === 'function' ? v(sel) : v; };
  const createdPoints: GeoPoint[] = [];
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
    polygonCreatedPoints: createdPoints,
    setMode: noop, setSelectedElements: setSel, setRenderRev: noop, setPolygonPoints: noop,
    addCommand: noop, captureState: () => ({}),
    setBoxSelecting: noop, setBoxStartScreen: noop, setBoxEndScreen: noop,
    setDraggedElement: noop,
    toolState: { current: ts },
    t: (k: string) => k,
  };
  Object.defineProperty(ctx, 'selectedElements', { get: () => sel, configurable: true });
  const clickAt = (x: number, y: number) => handlePointerDown(ctx, { x, y } as any, { x, y } as any);
  return { ctx, clickAt, ts, createdPoints };
};

describe('两点工具（segment）空白两次点击', () => {
  it('两次空白点击 → 两个自由点 + 一条线段', () => {
    const kernel = new Kernel();
    const { clickAt } = makeToolCtx(kernel, 'segment');
    clickAt(-2, -1); // 空白：建 P1 并选中
    clickAt(3, 2);   // 空白：此前因"已有选区"被吞，工具卡死
    const pts = c(kernel).getElements().filter(e => e instanceof GeoPoint) as GeoPoint[];
    const segs = c(kernel).getElements().filter(e => e instanceof GeoSegment) as GeoSegment[];
    expect(pts.length).toBe(2);
    expect(segs.length).toBe(1);
  });
});

describe('angle 工具顶点语义', () => {
  it('第二击是顶点：∠ABC = 90°', () => {
    const kernel = new Kernel();
    makePoint(kernel, 2, 0, 'A');
    makePoint(kernel, 0, 0, 'B');
    makePoint(kernel, 0, 1, 'C');
    const { clickAt } = makeToolCtx(kernel, 'angle');
    clickAt(2, 0);
    clickAt(0, 0); // 顶点
    clickAt(0, 1);
    const angles = c(kernel).getElements().filter(e => e instanceof GeoNumeric && (e as GeoNumeric).isAngle) as GeoNumeric[];
    expect(angles.length).toBe(1);
    expect(angles[0].getValue()).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('tangent 工具按点击选曲线', () => {
  const setup = () => {
    const kernel = new Kernel();
    makePoint(kernel, 4, 0, 'P'); // 圆外一点
    const circle1 = new GeoConic(kernel, [1, 0, 1, 0, 0, -4]); // x²+y²=4
    circle1.label = 'c1';
    c(kernel).addElement(circle1);
    const circle2 = new GeoConic(kernel, [1, 0, 1, -20, 0, 0]); // (x-10)²+y²=100
    circle2.label = 'c2';
    c(kernel).addElement(circle2);
    return kernel;
  };

  it('先点后点曲线：切线作于命中的曲线（旧实现恒取最新一条 c2）', () => {
    const kernel = setup();
    const { clickAt } = makeToolCtx(kernel, 'tangent');
    clickAt(4, 0);  // 点 P
    clickAt(0, 2);  // c1 北极（无点处）→ 应选 c1
    const tangents = c(kernel).getElements().filter((e): e is AlgoTangent => e instanceof AlgoTangent);
    expect(tangents.length).toBe(1);
    const conic = (tangents[0] as any).conic as GeoConic;
    expect(conic.label).toBe('c1');
  });

  it('先点曲线后点点：同样成立（反向顺序）', () => {
    const kernel = setup();
    const { clickAt } = makeToolCtx(kernel, 'tangent');
    clickAt(0, 2);  // c1
    clickAt(4, 0);  // P
    const tangents = c(kernel).getElements().filter((e): e is AlgoTangent => e instanceof AlgoTangent);
    expect(tangents.length).toBe(1);
    expect(((tangents[0] as any).conic as GeoConic).label).toBe('c1');
  });
});

describe('polygon 工具只回收新建点', () => {
  it('命中既有点不进 createdPoints；空白点进入', () => {
    const kernel = new Kernel();
    const existing = makePoint(kernel, 1, 1, 'A');
    const { clickAt, createdPoints } = makeToolCtx(kernel, 'polygon');
    clickAt(1, 1);  // 既有点 A
    clickAt(5, 3);  // 空白 → 新建点
    expect(createdPoints.length).toBe(1);
    expect(createdPoints[0]).not.toBe(existing);
    // 顶点序列包含 A 与新点（通过 polygonPoints 状态外部不可见，但 createdPoints 契约已验证）
  });
});

describe('解析器数字边界', () => {
  it('1.2.3 报 Invalid number 而非静默按 1.2·0.3 求值', () => {
    const kernel = new Kernel();
    expect(() => parseAlgebraInput(kernel, 'a = 1.2.3')).toThrow(/Invalid number/);
  });
});

describe('解析器隐式乘积切分（GeoGebra 上下文敏感词法）', () => {
  const addInput = (kernel: Kernel, text: string) => {
    const elements = parseAlgebraInput(kernel, text);
    elements.forEach(el => kernel.getConstruction().addElement(el));
    kernel.getConstruction().updateAllAlgorithms();
    return elements;
  };
  const numericOf = (kernel: Kernel, label: string): GeoNumeric =>
    kernel.getConstruction().getElements().find(e => e instanceof GeoNumeric && (e as GeoNumeric).label === label) as GeoNumeric;

  it('uv 按构造标签切成 u·v（2·3=6）', () => {
    const kernel = new Kernel();
    // 注意 x = 2 是竖直线（GeoGebra 语义），数值标签用非保留字母
    addInput(kernel, 'u = 2');
    addInput(kernel, 'v = 3');
    addInput(kernel, 'a = uv');
    expect(numericOf(kernel, 'a').getValue()).toBeCloseTo(6, 9);
  });

  it('xsin(x) 在函数定义中切成 x·sin(x)', () => {
    const kernel = new Kernel();
    addInput(kernel, 'f(x) = xsin(x)');
    const f = kernel.getConstruction().getElements().find((e): e is any => e instanceof GeoFunction) as any;
    expect(f).toBeDefined();
    expect(f.evaluateAt(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 6); // x·sin(x) 在 π/2
  });

  it('拼错的函数名仍报 Unknown function（调用位置不切成变量积）', () => {
    const kernel = new Kernel();
    // 预置 S/L/O/P/E 标签：若无"调用位置"守卫，Sloope 会被切成 S·l·o·o·p·e
    for (const [x, y, label] of [[1, 1, 'S'], [2, 1, 'L'], [3, 1, 'O'], [4, 1, 'P'], [5, 1, 'E']] as const) {
      const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
      p.label = label;
      kernel.getConstruction().addElement(p);
    }
    expect(() => addInput(kernel, 'a = Sloope(2)')).toThrow(/Unknown function/);
  });

  it('sinx 不切成 s·i·n·x（函数段必须紧跟括号）', () => {
    const kernel = new Kernel();
    expect(() => addInput(kernel, 'a = sinx')).toThrow();
  });

  it('含隐式乘积的依赖数值 roundtrip 后值不变', () => {
    const kernel = new Kernel();
    addInput(kernel, 'u = 2');
    addInput(kernel, 'v = 3');
    addInput(kernel, 'a = uv');
    const restored = roundtripLocal(kernel);
    const a = restored.getConstruction().getElements().find(e => e instanceof GeoNumeric && (e as GeoNumeric).label === 'a') as GeoNumeric;
    expect(a).toBeDefined();
    expect(a.getValue()).toBeCloseTo(6, 9);
  });
});
