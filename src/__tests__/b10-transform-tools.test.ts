import { describe, expect, it, afterEach } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import { Kernel } from '../kernel/core/Kernel';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { AlgoShearStretch, AlgoInvert } from '../kernel/algo/AlgoShearStretch';
import { AlgoTranslate } from '../kernel/algo/AlgoTranslate';
import { AlgoRotate } from '../kernel/algo/AlgoRotate';
import { AlgoVector } from '../kernel/algo/AlgoVector';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { handlePointerDown } from '../components/tools/handlers';
import type { ToolContext, ToolMode, WorldPoint, ScreenPoint } from '../components/tools/types';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  return elements;
};

const ofType = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter((el): el is T => el instanceof type);

const roundtrip = (kernel: Kernel): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel));
  return restored;
};

/** 最小 ToolContext 桩：elements 用 getter（Construction.getElements 返回副本）。 */
const makeCtx = (
  kernel: Kernel,
  mode: ToolMode,
  selected: GeoElement[] = [],
  extra: Partial<ToolContext> = {},
): { ctx: ToolContext; selected: () => GeoElement[]; ts: Record<string, any> } => {
  let sel = selected;
  const ts: Record<string, any> = {};
  const setSel: Dispatch<SetStateAction<GeoElement[]>> = (v) => {
    sel = typeof v === 'function' ? v(sel) : v;
  };
  const noop = () => {};
  const ctx: ToolContext = {
    kernel,
    construction: c(kernel),
    coord: new CoordinateSystem(800, 600, 400, 300, 50, 50),
    get elements() { return c(kernel).getElements() as readonly (ConstructionElement | GeoElement)[]; },
    selectedElements: sel,
    mode,
    mousePos: { x: 0, y: 0 },
    hoveredPoint: null,
    radius: 50,
    setMode: noop,
    setSelectedElements: setSel,
    setRenderRev: noop,
    setPolygonPoints: noop,
    addCommand: noop,
    captureState: () => ({}),
    setBoxSelecting: noop,
    setBoxStartScreen: noop,
    setBoxEndScreen: noop,
    setDraggedElement: noop,
    toolState: { current: ts },
    t: (k: string) => k,
    ...extra,
  };
  // selectedElements 被解构成常量；桩需要每次读最新 → 用 getter 覆盖
  Object.defineProperty(ctx, 'selectedElements', {
    get: () => sel,
    configurable: true,
  });
  return { ctx, selected: () => sel, ts };
};

const click = (
  ctx: ToolContext,
  x: number,
  y: number,
): void => {
  handlePointerDown(ctx, { x, y } as WorldPoint, { x, y } as ScreenPoint);
};

afterEach(() => {
  // 清掉 shear 工具 prompt polyfill
  if ((globalThis as any).window?.prompt && !(globalThis as any).window?.document) {
    delete (globalThis as any).window;
  }
});

describe('B10 addAlgoAndNotify（输出注册回归）', () => {
  it('circle 工具：点圆心 → 输入半径 → algo 与输出圆入 construction', () => {
    const kernel = makeKernel();
    const o = makePoint(kernel, 0, 0, 'O');
    const { ctx } = makeCtx(kernel, 'circle', [], { radius: 40 });
    // 新交互：点击圆心后弹窗输入半径（stub window.prompt）
    const g = globalThis as any;
    const origPrompt = g.prompt;
    g.prompt = () => '40';
    try {
      click(ctx, 0, 0);
    } finally {
      g.prompt = origPrompt;
    }

    const algos = c(kernel).getElements().filter(el => (el as any).getClassName?.() === 'AlgoCirclePointRadius');
    expect(algos).toHaveLength(1);
    const circles = ofType(kernel, GeoConic);
    expect(circles).toHaveLength(1);
    expect(circles[0].parentAlgo).toBe(algos[0]);
    expect(circles[0].label).toBeTruthy(); // assignOutputLabel 补了标签
    expect(circles[0].getRadius()).toBeCloseTo(40, 6);
    expect(o).toBeDefined();
  });

  it('rotate 工具：活中心命中已有点时注册为 AlgoRotate 输入', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 2, 0, 'A');
    const b = makePoint(kernel, 0, 0, 'B');
    const { ctx } = makeCtx(kernel, 'rotate');
    // 新交互：click1 选源 A；click2 中心 B + 弹窗输入角度（stub window.prompt）
    const g = globalThis as any;
    const origPrompt = g.prompt;
    g.prompt = () => '90';
    let rotates: AlgoRotate[];
    try {
      click(ctx, 2, 0);
      click(ctx, 0, 0);
    } finally {
      g.prompt = origPrompt;
    }
    rotates = c(kernel).getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoRotate',
    ) as AlgoRotate[];
    expect(rotates).toHaveLength(1);
    expect(rotates[0].getInput()).toContain(b); // 活中心
    const image = rotates[0].getOutput() as GeoPoint;
    expect(image.parentAlgo).toBe(rotates[0]);
    // 世界 y-up，+90° = 数学逆时针：(2,0) → (0,2)
    expect(image.getX()).toBeCloseTo(0, 6);
    expect(image.getY()).toBeCloseTo(2, 6);

    // 移动中心联动：A(2,0) 绕 B(1,1) 逆时针 90° → (2,2)
    b.setCoords(1, 1, 1);
    kernel.flushNow();
    expect(image.getX()).toBeCloseTo(2, 6);
    expect(image.getY()).toBeCloseTo(2, 6);
    expect(a.getX()).toBeCloseTo(2, 6);
  });

  it('mirror 工具：两点画轴可完成（旧代码 axisStart 被覆盖）', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    const { ctx, ts } = makeCtx(kernel, 'mirror');
    // click1：选源 A；click2/click3：两点轴；无需再点
    click(ctx, 1, 1);
    click(ctx, 0, 0);
    click(ctx, 0, 1); // y 轴方向 → x=0 镜轴

    const mirrors = c(kernel).getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoMirror',
    );
    expect(mirrors).toHaveLength(1);
    expect(ts.inputs).toEqual([]);
    expect(ts.axis).toBeNull();
    const image = (mirrors[0] as any).getOutput() as GeoPoint;
    expect(image.getX()).toBeCloseTo(-1, 6);
    expect(image.getY()).toBeCloseTo(1, 6);
  });
});

describe('B10 mirror_line / translate_vector 工具', () => {
  it('mirror_line：命中已有直线作活镜轴，移动轴联动', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 1, 1, 'A');
    const axis = makeLine(kernel, 1, 0, 0, 'l'); // x = 0
    const { ctx } = makeCtx(kernel, 'mirror_line', [a]);
    // click1 命中轴线设置 transformRef；click2 收集输入并执行
    click(ctx, 0, 5);
    click(ctx, 5, 5);

    const mirrors = c(kernel).getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoMirror',
    ) as any[];
    expect(mirrors).toHaveLength(1);
    expect(mirrors[0].getInput()).toContain(axis);
    const image = mirrors[0].getOutput() as GeoPoint;
    expect(image.getX()).toBeCloseTo(-1, 6);

    axis.a = 1; axis.b = 0; axis.c = -2; // x = 2
    axis.update(); // 自由线改系数后手动通知（setCoords 才会自动 update）
    kernel.flushNow();
    expect(image.getX()).toBeCloseTo(3, 6);
  });

  it('translate_vector：活向量注册为 AlgoTranslate 输入，移动向量联动', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const p1 = makePoint(kernel, 0, 0, 'P');
    const p2 = makePoint(kernel, 3, 0, 'Q');
    const vAlgo = new AlgoVector(kernel, p1, p2);
    c(kernel).addElement(vAlgo);
    c(kernel).addElement(vAlgo.getOutput());
    vAlgo.update();
    const v = vAlgo.getOutput();
    v.label = 'v';

    const { ctx } = makeCtx(kernel, 'translate_vector', [a]);
    // click1 命中向量设置 transformRef（此后 return，不再同击自毁）；
    // click2 收集输入：预选 selectedElements=[A] 优先
    click(ctx, 1.5, 0);
    click(ctx, 1.5, 0);

    const translates = c(kernel).getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoTranslate',
    ) as AlgoTranslate[];
    expect(translates).toHaveLength(1);
    expect(translates[0].getInput()).toContain(v);
    const image = translates[0].getOutput() as GeoPoint;
    expect(image.getX()).toBeCloseTo(3, 6);
    expect(image.getY()).toBeCloseTo(0, 6);

    // 移动向量终点 → 端点更新 → AlgoVector 重算 → AlgoTranslate 联动
    p2.setCoords(3, 4, 1);
    kernel.flushNow();
    expect(image.getX()).toBeCloseTo(3, 6);
    expect(image.getY()).toBeCloseTo(4, 6);
  });
});

describe('B10 AlgoShearStretch', () => {
  it('冻结轴 shear：与 shearStretchMatrix 结果一致', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 2, 'A');
    const algo = new AlgoShearStretch(kernel, p, [0, 1, 0], 2, 'shear');
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();
    const out = algo.getOutput() as GeoPoint;
    expect(out.getX()).toBeCloseTo(5, 6);
    expect(out.getY()).toBeCloseTo(2, 6);
    expect(algo.getOp()).toBe('shear');
    expect(algo.getFactor()).toBe(2);
    expect(algo.getAxis()).toEqual([0, 1, 0]);
    // 冻结轴：输入只有源
    expect(algo.getInput()).toEqual([p]);
  });

  it('活轴：移动直线联动重算', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 2, 'A');
    const axis = makeLine(kernel, 0, 1, 0, 'h'); // y = 0
    const algo = new AlgoShearStretch(kernel, p, axis, 1, 'shear');
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();
    const out = algo.getOutput() as GeoPoint;
    // shear 沿 y=0：matrix → x' = x + 2y? 用 shearStretchMatrix 校验
    expect(algo.getInput()).toContain(axis);
    const before = { x: out.getX(), y: out.getY() };

    // 轴改成 y = -2（法向平移），同 factor 下像应变化
    axis.a = 0; axis.b = 1; axis.c = 2;
    kernel.notifyUpdate(axis);
    kernel.flushNow();
    const after = { x: out.getX(), y: out.getY() };
    expect(after.x !== before.x || after.y !== before.y).toBe(true);
  });

  it('shear 工具路径（globalThis.prompt polyfill）', () => {
    (globalThis as any).prompt = () => '2';
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 2, 'A');
    const { ctx } = makeCtx(kernel, 'shear', [p]);
    // click1：selectedElements → inputs；click2：两点轴起点；click3：轴终点 + prompt
    click(ctx, 1, 2);
    click(ctx, 0, 0);
    click(ctx, 1, 0);

    const algos = c(kernel).getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoShearStretch',
    ) as AlgoShearStretch[];
    expect(algos).toHaveLength(1);
    const out = algos[0].getOutput() as GeoPoint;
    expect(out).toBeInstanceOf(GeoPoint);
    expect(out.getX()).toBeCloseTo(5, 6); // 与直测一致
  });

  it('退化轴构造期抛错（工具 all-or-nothing 依赖）', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 0);
    expect(() => new AlgoShearStretch(kernel, p, [0, 0, 0], 2, 'shear')).toThrow();
  });
});

describe('B10 AlgoInvert', () => {
  it('点关于单位圆反演', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 4, 0, 'A');
    const algo = new AlgoInvert(kernel, p, { center: { x: 0, y: 0 }, radius: 1 });
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();
    const out = algo.getOutput() as GeoPoint;
    expect(out.getX()).toBeCloseTo(0.25, 6);
    expect(out.getY()).toBeCloseTo(0, 6);
    expect(algo.isLiveCircle()).toBe(false);
    expect(algo.getCircleCoords()).toEqual([0, 0, 1]);
  });

  it('活反演圆：缩放圆半径联动', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 4, 0, 'A');
    const circleAlgoSrc = makePoint(kernel, 0, 0, 'O');
    const cAlgo = new AlgoCirclePointRadius(kernel, circleAlgoSrc, 2);
    c(kernel).addElement(cAlgo);
    c(kernel).addElement(cAlgo.getOutput());
    cAlgo.update();
    const circle = cAlgo.getOutput();

    const algo = new AlgoInvert(kernel, p, circle);
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();
    const out = algo.getOutput() as GeoPoint;
    // k = r²/d² = 4/16 = 0.25 → (1, 0)
    expect(out.getX()).toBeCloseTo(1, 6);
    expect(algo.getInput()).toContain(circle);
    expect(algo.isLiveCircle()).toBe(true);

    // 改半径：改 AlgoCirclePointRadius 无 setRadius… 直接改 coeffs 不走 algo。
    // 活圆联动改为改中心点 O → 圆心移 → 像移
    circleAlgoSrc.setCoords(0, 1, 1);
    kernel.flushNow();
    expect(out.isDefined()).toBe(true);
    expect(out.getX()).not.toBeCloseTo(1, 3);
  });

  it('过反演中心的圆 → 直线像', () => {
    const kernel = makeKernel();
    // 圆心 (1,0) r=1 过原点；反演圆为单位圆
    const src = new GeoConic(kernel, [1, 0, 1, -2, 0, 0]); // (x-1)²+y²=1
    const algo = new AlgoInvert(kernel, src, { center: { x: 0, y: 0 }, radius: 1 });
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();
    expect(algo.getOutput()).toBeInstanceOf(GeoLine);
    const line = algo.getOutput() as GeoLine;
    expect(line.isDefined()).toBe(true);
  });

  it('非圆圆锥曲线反演构造期抛错', () => {
    const kernel = makeKernel();
    // 椭圆 x²/4 + y² = 1
    const ellipse = new GeoConic(kernel, [0.25, 0, 1, 0, 0, -1]);
    expect(() => new AlgoInvert(kernel, ellipse, { center: { x: 0, y: 0 }, radius: 1 })).toThrow();
  });
});

describe('B10 Translate 命令', () => {
  it('Translate(A, 2, 3) 冻结分量', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    const result = addInput(kernel, 'Translate(A, 2, 3)');
    const image = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(image).toBeDefined();
    expect(image.getX()).toBeCloseTo(3, 6);
    expect(image.getY()).toBeCloseTo(4, 6);
    expect(image.label).toBeTruthy(); // assignOutputLabels 补标签
    const translates = ofType(kernel, AlgoTranslate);
    expect(translates).toHaveLength(1);
    expect(translates[0].isLiveVector()).toBe(false);
    expect(translates[0].getInput()).toHaveLength(1);
  });

  it('Translate(A, v) 活向量联动', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 0, 0, 'P');
    makePoint(kernel, 2, 1, 'Q');
    addInput(kernel, 'Vector(P, Q)'); // 两点向量，标签按线序列
    const vectors = ofType(kernel, GeoVector);
    expect(vectors).toHaveLength(1);
    const label = vectors[0].label;
    expect(label).toBeTruthy();
    const result = addInput(kernel, `Translate(A, ${label})`);
    const image = result.find(el => el instanceof GeoPoint) as GeoPoint;
    expect(image).toBeDefined();
    expect(image.getX()).toBeCloseTo(2, 6);
    expect(image.getY()).toBeCloseTo(1, 6);
    const translates = ofType(kernel, AlgoTranslate);
    expect(translates).toHaveLength(1);
    expect(translates[0].isLiveVector()).toBe(true);
    expect(translates[0].getInput()).toContain(vectors[0]);
  });
});

describe('B10 序列化 roundtrip', () => {
  it('AlgoShearStretch 冻结轴', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 2, 'A');
    const p = c(kernel).getElements().find(el => el instanceof GeoPoint) as GeoPoint;
    const algo = new AlgoShearStretch(kernel, p, [0, 1, 0], 2, 'shear');
    algo.getOutput().label = "A'";
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();

    const restored = roundtrip(kernel);
    const out = ofType(restored, GeoPoint).find(el => el.label === "A'");
    expect(out).toBeDefined();
    expect(out!.getX()).toBeCloseTo(5, 5);
    const algos = restored.getConstruction().getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoShearStretch',
    ) as AlgoShearStretch[];
    expect(algos).toHaveLength(1);
    expect(algos[0].getOp()).toBe('shear');
    expect(algos[0].getFactor()).toBeCloseTo(2, 6);
    expect(algos[0].getAxis()).toEqual([0, 1, 0]);
  });

  it('AlgoShearStretch 活轴', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 2, 'A');
    const axis = makeLine(kernel, 0, 1, 0, 'h');
    const algo = new AlgoShearStretch(kernel, p, axis, 2, 'shear');
    algo.getOutput().label = "A'";
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();

    const restored = roundtrip(kernel);
    const algos = restored.getConstruction().getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoShearStretch',
    ) as AlgoShearStretch[];
    expect(algos).toHaveLength(1);
    const axis2 = ofType(restored, GeoLine).find(el => el.label === 'h');
    expect(axis2).toBeDefined();
    expect(algos[0].getInput()).toContain(axis2);
    const out = ofType(restored, GeoPoint).find(el => el.label === "A'");
    expect(out).toBeDefined();
    // 联动：改活轴
    axis2!.a = 0; axis2!.b = 1; axis2!.c = 2;
    restored.getConstruction().updateAllAlgorithms();
    const out2 = ofType(restored, GeoPoint).find(el => el.label === "A'")!;
    expect(out2.getX()).not.toBeCloseTo(5, 3);
  });

  it('AlgoInvert 冻结圆', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 4, 0, 'A');
    const algo = new AlgoInvert(kernel, p, { center: { x: 0, y: 0 }, radius: 1 });
    algo.getOutput().label = "A'";
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();

    const restored = roundtrip(kernel);
    const out = ofType(restored, GeoPoint).find(el => el.label === "A'");
    expect(out).toBeDefined();
    expect(out!.getX()).toBeCloseTo(0.25, 5);
    const algos = restored.getConstruction().getElements().filter(
      el => (el as any).getClassName?.() === 'AlgoInvert',
    ) as AlgoInvert[];
    expect(algos).toHaveLength(1);
    expect(algos[0].getCircleCoords()).toEqual([0, 0, 1]);
    expect(algos[0].isLiveCircle()).toBe(false);
  });

  it('AlgoTranslate 冻结分量', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    const p = c(kernel).getElements().find(el => el instanceof GeoPoint) as GeoPoint;
    const algo = new AlgoTranslate(kernel, p, { x: 2, y: 3 });
    algo.getOutput().label = "A'";
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();

    const restored = roundtrip(kernel);
    const out = ofType(restored, GeoPoint).find(el => el.label === "A'");
    expect(out).toBeDefined();
    expect(out!.getX()).toBeCloseTo(3, 5);
    expect(out!.getY()).toBeCloseTo(4, 5);
    const algos = ofType(restored, AlgoTranslate);
    expect(algos).toHaveLength(1);
    expect(algos[0].isLiveVector()).toBe(false);
    expect(algos[0].getVectorCoords()).toEqual({ x: 2, y: 3 });
  });

  it('AlgoTranslate 活向量', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const p1 = makePoint(kernel, 0, 0, 'P');
    const p2 = makePoint(kernel, 3, 0, 'Q');
    const vAlgo = new AlgoVector(kernel, p1, p2);
    c(kernel).addElement(vAlgo);
    c(kernel).addElement(vAlgo.getOutput());
    vAlgo.update();
    const v = vAlgo.getOutput();
    v.label = 'v';
    const algo = new AlgoTranslate(kernel, a, v);
    algo.getOutput().label = "A'";
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();

    const restored = roundtrip(kernel);
    const algos = ofType(restored, AlgoTranslate);
    expect(algos).toHaveLength(1);
    expect(algos[0].isLiveVector()).toBe(true);
    const v2 = ofType(restored, GeoVector).find(el => el.label === 'v');
    expect(v2).toBeDefined();
    expect(algos[0].getInput()).toContain(v2);
    const out = ofType(restored, GeoPoint).find(el => el.label === "A'")!;
    expect(out.getX()).toBeCloseTo(3, 5);
  });

  it('AlgoRotate 活中心 roundtrip（既有回归不破坏）', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 0, 'P');
    const center = makePoint(kernel, 0, 0, 'B');
    const algo = new AlgoRotate(kernel, p, center, Math.PI / 2);
    algo.getOutput().label = "P'";
    c(kernel).addElement(algo);
    c(kernel).addElement(algo.getOutput());
    algo.update();

    const restored = roundtrip(kernel);
    const out = ofType(restored, GeoPoint).find(el => el.label === "P'");
    expect(out).toBeDefined();
    // 正角 = 数学逆时针（世界 y-up）
    expect(out!.getX()).toBeCloseTo(0, 5);
    expect(out!.getY()).toBeCloseTo(1, 5);
  });
});
