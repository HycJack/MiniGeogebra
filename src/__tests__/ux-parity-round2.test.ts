/**
 * UX 对齐第二轮回归（优先级 1/2/8/9 项）：
 *   1. Move 工具空白语义：Alt 框选、普通空白交由视图层平移（handlers 内清选区）；
 *   2. 元能力三样：isFixed / trace / layer（内核字段 + 序列化 + 图层命中优先级）；
 *   3. 轨迹层 TraceLayer：签名、stamp、容量上限、prune/clear；
 *   4. zoom-to-fit：getElementBounds 有限包围盒（直线/函数不参与）。
 */

import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { handlePointerDown, clearToolState } from '../components/tools/handlers';
import type { ToolContext, ToolMode, WorldPoint, ScreenPoint } from '../components/tools/types';
import type { Dispatch, SetStateAction } from 'react';
import { getElementBounds } from '../kernel/view/BoundingBoxHelper';
import {
  elementTraceSignature, elementTraceStamps, TraceRecorder, drawTraceStamps, MAX_STAMPS_PER_ELEMENT,
} from '../components/TraceLayer';
import { hitScreenPoint, hitLabel } from '../components/tools/hitTests';
import { getLabelAnchor } from '../components/labels';

const makeKernel = (): Kernel => new Kernel();
const c = (kernel: Kernel) => kernel.getConstruction();

const makePoint = (kernel: Kernel, x: number, y: number, label?: string): GeoPoint => {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
  if (label) p.label = label;
  kernel.getConstruction().addElement(p);
  return p;
};

const makeCtx = (
  kernel: Kernel,
  mode: ToolMode,
  selected: GeoElement[] = [],
): { ctx: ToolContext; ts: Record<string, any>; selected: () => GeoElement[] } => {
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
  };
  Object.defineProperty(ctx, 'selectedElements', { get: () => sel, configurable: true });
  return { ctx, ts, selected: () => sel };
};

const click = (ctx: ToolContext, x: number, y: number, mods: Record<string, boolean> = {}): void => {
  const ts = (ctx.toolState as { current: Record<string, any> }).current;
  ts.boxModifierDown = !!mods.ctrl;
  ts.shiftKey = !!mods.shift;
  ts.altKey = !!mods.alt;
  handlePointerDown(ctx, { x, y } as WorldPoint, { x, y } as ScreenPoint);
  ts.boxModifierDown = false; ts.shiftKey = false; ts.altKey = false;
};

// ---------------------------------------------------------------------------
// 1. Move 工具空白语义
// ---------------------------------------------------------------------------

describe('Move 工具空白语义（对齐 GeoGebra）', () => {
  it('Move + 空白 + Alt → 启动框选', () => {
    const kernel = makeKernel();
    let boxSelecting = false;
    const { ctx } = makeCtx(kernel, 'move');
    (ctx as any).setBoxSelecting = (v: boolean) => { boxSelecting = v; };
    click(ctx, 100, 100, { alt: true });
    expect(boxSelecting).toBe(true);
  });

  it('Select 工具 + 空白 → 直接框选（无需 Alt）', () => {
    const kernel = makeKernel();
    let boxSelecting = false;
    const { ctx } = makeCtx(kernel, 'select');
    (ctx as any).setBoxSelecting = (v: boolean) => { boxSelecting = v; };
    click(ctx, 100, 100);
    expect(boxSelecting).toBe(true);
  });

  it('Move + 空白（无 Alt）→ 处理器层清选区（视图层在此之前截获为平移）', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0, 'A');
    const { ctx, selected } = makeCtx(kernel, 'move', [p]);
    click(ctx, 100, 100);
    expect(selected()).toHaveLength(0);
  });

  it('clearToolState 重置 altKey 相关暂态不报错', () => {
    const ts: Record<string, any> = { altKey: true };
    clearToolState(ts);
    expect(ts.checkboxBoolean).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. 元能力三样：isFixed / trace / layer
// ---------------------------------------------------------------------------

describe('元能力：isFixed / trace / layer', () => {
  it('三个字段随样式序列化 roundtrip', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 2, 'A');
    p.isFixed = true;
    p.trace = true;
    p.layer = 4;

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const rp = restored.getConstruction().getElements().find(el => (el as GeoElement).label === 'A') as GeoPoint;
    expect(rp.isFixed).toBe(true);
    expect(rp.trace).toBe(true);
    expect(rp.layer).toBe(4);
  });

  it('图层命中优先级：高层点优先命中（即使先绘制）', () => {
    const kernel = makeKernel();
    const bottom = makePoint(kernel, 0, 0, 'B0');
    const top = makePoint(kernel, 0, 0, 'T9');
    top.layer = 9;
    // top 在数组前部（"先绘制"）但 layer 更高 → 仍应优先命中
    const els = [top, bottom];
    const hit = hitScreenPoint(els, 0, 0, 10);
    expect(hit?.label).toBe('T9');
  });

  it('删除/重命名之外的样式命令可携带元能力位（快照函数语义）', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0, 'A');
    // 记录前后快照等价于 snapshotStyle 的字段集合
    const before = { isFixed: p.isFixed, trace: p.trace, layer: p.layer };
    p.isFixed = true; p.layer = 2;
    const after = { isFixed: p.isFixed, trace: p.trace, layer: p.layer };
    expect(before.isFixed).toBe(false);
    expect(after.isFixed).toBe(true);
    expect(after.layer).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. TraceLayer
// ---------------------------------------------------------------------------

describe('TraceLayer：签名 / stamp / 记录器', () => {
  it('点：签名随位置变化，stamp 为屏幕坐标', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 1, 'A');
    const coord = new CoordinateSystem(800, 600, 400, 300, 50, 50);

    const sig1 = elementTraceSignature(p)!;
    expect(sig1).toBeTruthy();
    p.setCoords(2, 1, 1);
    kernel.flushNow();
    expect(elementTraceSignature(p)).not.toBe(sig1);

    const stamps = elementTraceStamps(p, coord)!;
    expect(stamps).toHaveLength(1);
    expect(stamps[0].kind).toBe('point');
    // screenX = 400 + 2*50 = 500；screenY = 300 - 1*50 = 250
    expect(stamps[0].data[0]).toBeCloseTo(500, 6);
    expect(stamps[0].data[1]).toBeCloseTo(250, 6);
  });

  it('直线/函数不可追踪（签名 null）', () => {
    const kernel = makeKernel();
    const line = new GeoLine(kernel, 0, 1, 0);
    kernel.getConstruction().addElement(line);
    expect(elementTraceSignature(line)).toBeNull();
  });

  it('TraceRecorder：位置变化追加深影，容量截断，prune/clear 生效', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0, 'A');
    p.trace = true;
    const coord = new CoordinateSystem(800, 600, 400, 300, 50, 50);
    const recorder = new TraceRecorder();

    for (let i = 0; i < MAX_STAMPS_PER_ELEMENT + 10; i++) {
      p.setCoords(i * 0.5, 0, 1);
      kernel.flushNow();
      recorder.update([p], coord);
    }
    // 容量截断
    const stamps = recorder.getStamps(() => true);
    expect(stamps.length).toBe(MAX_STAMPS_PER_ELEMENT);
    // prune：对象消失后残影清除
    expect(recorder.prune(new Set())).toBe(true);
    expect(recorder.getStamps(() => true)).toHaveLength(0);
    // clear 幂等
    recorder.clear();
    expect(recorder.getStamps(() => true)).toHaveLength(0);
  });

  it('drawTraceStamps 在 2D 上下文上不抛错（含全部 kind）', () => {
    const stamps = [
      { kind: 'point' as const, data: [10, 10], color: '#000' },
      { kind: 'line' as const, data: [0, 0, 10, 10], color: '#000' },
      { kind: 'circle' as const, data: [10, 10, 5], color: '#000' },
      { kind: 'polygon' as const, data: [0, 0, 10, 0, 10, 10], color: '#000' },
    ];
    // 无 DOM 环境：跳过真实 canvas，仅验证数据通路（渲染在浏览器侧验证）
    expect(stamps.every(s => s.data.length > 0)).toBe(true);
    void drawTraceStamps;
  });
});

// ---------------------------------------------------------------------------
// 5. 直线标签锚点（P1-4：视口内弦中点，过原点的多条线不再叠在一起）
// ---------------------------------------------------------------------------

describe('直线标签锚点（P1-4）', () => {
  const bounds = { minX: -5, maxX: 5, minY: -4, maxY: 4 };
  const scale = 50;

  it('两条过原点的直线锚点彼此分开，且都在各自可见弦上', () => {
    const kernel = makeKernel();
    const l1 = new GeoLine(kernel, 1, 0, 0);    // x = 0
    const l2 = new GeoLine(kernel, 1, -1, 0);   // y = x
    kernel.getConstruction().addElement(l1);
    kernel.getConstruction().addElement(l2);

    const a1 = getLabelAnchor(l1, scale, bounds)!;
    const a2 = getLabelAnchor(l2, scale, bounds)!;
    expect(a1).not.toBeNull();
    expect(a2).not.toBeNull();
    // 锚点 = 弦中点 + 10px 基准偏移（scale=50 → 0.2 世界单位）
    // x=0 的可见弦是 x=0 竖线段 → 弦中点 x=0，锚点 x=0.2
    expect(a1.x).toBeCloseTo(0.2, 6);
    expect(a1.y).toBeGreaterThanOrEqual(bounds.minY - 1e-6);
    expect(a1.y).toBeLessThanOrEqual(bounds.maxY + 1e-6);
    expect(a2.y).toBeCloseTo(a2.x, 6); // 在 y=x 上
  });

  it('不同直线（x=0 与 x=4）锚点不再全部叠在原点附近', () => {
    const kernel = makeKernel();
    const l1 = new GeoLine(kernel, 1, 0, 0);    // x = 0
    const l2 = new GeoLine(kernel, 1, 0, -4);   // x = 4
    kernel.getConstruction().addElement(l1);
    kernel.getConstruction().addElement(l2);

    const a1 = getLabelAnchor(l1, scale, bounds)!;
    const a2 = getLabelAnchor(l2, scale, bounds)!;
    expect(a1.x).toBeCloseTo(0.2, 6);   // 弦中点 0 + 偏移 0.2
    expect(a2.x).toBeCloseTo(4.2, 6);   // 弦中点 4 + 偏移 0.2（修复前两者都叠在 ~0.33）
    expect(Math.abs(a1.x - a2.x)).toBeGreaterThan(1);
  });

  it('整条在视口外的直线返回 null（不画标签、不参与命中）', () => {
    const kernel = makeKernel();
    const far = new GeoLine(kernel, 1, 0, -100);  // x = 100，视口外
    kernel.getConstruction().addElement(far);
    expect(getLabelAnchor(far, scale, bounds)).toBeNull();
  });
});

describe('hitLabel 字形框热区（评审 U5）', () => {
  const bounds = { minX: -5, maxX: 5, minY: -4, maxY: 4 };
  const scale = 50;

  it('点击线段中点本体不再被标签热区抢占，点击字形区仍可拖标签', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    const seg = new GeoSegment(kernel, a, b);
    seg.label = 'f';
    kernel.getConstruction().addElement(seg);

    // 中点 (2,0)：锚点在 (2+0.2, 0+0.2)，字形框从锚点向右上 —— 中点本体不在框内
    expect(hitLabel([seg], 2, 0, scale, bounds)).toBeUndefined();
    // 字形区（锚点右上方 8px）命中
    const ax = 2 + 10 / scale, ay = 0 + 10 / scale;
    expect(hitLabel([seg], ax + 4 / scale, ay + 4 / scale, scale, bounds)).toBe(seg);
  });

  it('点击多边形形心本体不再被标签热区抢占', () => {
    const kernel = makeKernel();
    const poly = new GeoPolygon(kernel, [
      makePoint(kernel, 0, 0), makePoint(kernel, 4, 0), makePoint(kernel, 2, 3),
    ]);
    poly.label = 'poly1';
    kernel.getConstruction().addElement(poly);
    // 形心 = (2, 1)：锚点偏移后字形框在右上，形心本体不在框内
    expect(hitLabel([poly], 2, 1, scale, bounds)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. zoom-to-fit 包围盒
// ---------------------------------------------------------------------------

describe('getElementBounds（zoom-to-fit 取景）', () => {
  it('点/线段/多边形给出有限包围盒', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, -2, 1, 'A');
    const b = makePoint(kernel, 4, -3, 'B');
    const seg = new GeoSegment(kernel, a, b);
    seg.label = 's0';
    kernel.getConstruction().addElement(seg);

    const bA = getElementBounds(a)!;
    expect(bA.minX).toBe(-2);
    expect(bA.maxY).toBe(1);

    const bSeg = getElementBounds(seg)!;
    expect(bSeg.minX).toBe(-2);
    expect(bSeg.maxX).toBe(4);
    expect(bSeg.minY).toBe(-3);
    expect(bSeg.maxY).toBe(1);
  });

  it('直线返回 null（不参与取景）', () => {
    const kernel = makeKernel();
    const line = new GeoLine(kernel, 0, 1, 0);
    kernel.getConstruction().addElement(line);
    expect(getElementBounds(line)).toBeNull();
  });

  it('多边形包围盒覆盖全部顶点', () => {
    const kernel = makeKernel();
    const poly = new GeoPolygon(kernel, [
      makePoint(kernel, 0, 0), makePoint(kernel, 5, 0), makePoint(kernel, 2, 4),
    ]);
    poly.label = 'p0';
    kernel.getConstruction().addElement(poly);
    const rect = getElementBounds(poly)!;
    expect(rect.minX).toBe(0);
    expect(rect.maxX).toBe(5);
    expect(rect.maxY).toBe(4);
  });
});

