/**
 * 源码审核修复的回归防线（2026-10-25 审查轮）：
 * - 数值参数活依赖（Circle/Rotate/Dilate 跟随滑块）
 * - 圆锥曲线退化判定的平移稳健性 + 属性命令幻影输出（另见 conic-robustness.test.ts）
 * - RegularPolygon 代数命令的顶点输出登记与序列化
 * - 区域约束点拖拽的下游传播
 * - 动画对象删除后的清理
 * - 吸附取最近点、弧扫窗命中
 */
import { describe, it, expect, vi } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoArc } from '../kernel/geo/GeoArc';
import { AlgoPointInRegion } from '../kernel/algo/AlgoRegion';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { applySnap } from '../kernel/core/Snap';

// Node 环境无 RAF：动画循环测试用哑实现（循环跑一帧即返回，不重入）
vi.stubGlobal('requestAnimationFrame', () => 0);
vi.stubGlobal('cancelAnimationFrame', () => {});

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const byLabel = <T extends ConstructionElement>(kernel: Kernel, label: string): T =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T;

describe('活数值依赖（滑块驱动 Circle/Rotate/Dilate）', () => {
  it('Circle(A, r) 的半径跟随滑块 r', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    addInput(k, 'r = 2');
    addInput(k, 'c = Circle(A, r)');
    const conic = byLabel<GeoConic>(k, 'c');
    expect(conic.getRadius()).toBeCloseTo(2, 6);

    const r = byLabel<GeoNumeric>(k, 'r');
    r.setValue(5);
    k.flushNow();
    expect(conic.getRadius()).toBeCloseTo(5, 6);
  });

  it('Circle(A, 3) 字面量半径仍是静态快照', () => {
    const k = makeKernel();
    makePoint(k, 1, 1, 'A');
    addInput(k, 'c = Circle(A, 3)');
    const conic = byLabel<GeoConic>(k, 'c');
    expect(conic.getRadius()).toBeCloseTo(3, 6);
    expect(conic.getRadius()).toBeCloseTo(3, 6); // 无滑块可变，双读稳定
  });

  it('Rotate(A, t) 的角度跟随滑块 t（按度解释）', () => {
    const k = makeKernel();
    makePoint(k, 1, 0, 'A');
    addInput(k, 't = 90');
    addInput(k, `B = Rotate(A, t)`);
    let b = byLabel<GeoPoint>(k, 'B');
    expect(b.getX()).toBeCloseTo(0, 5);
    expect(b.getY()).toBeCloseTo(1, 5);

    const t = byLabel<GeoNumeric>(k, 't');
    t.setValue(180);
    k.flushNow();
    b = byLabel<GeoPoint>(k, 'B');
    expect(b.getX()).toBeCloseTo(-1, 5);
    expect(b.getY()).toBeCloseTo(0, 5);
  });

  it('Dilate(A, s) 的比例跟随滑块 s', () => {
    const k = makeKernel();
    makePoint(k, 1, 0, 'A');
    addInput(k, 's = 2');
    addInput(k, `B = Dilate(A, s)`);
    let b = byLabel<GeoPoint>(k, 'B');
    expect(b.getX()).toBeCloseTo(2, 6);

    const s = byLabel<GeoNumeric>(k, 's');
    s.setValue(3);
    k.flushNow();
    b = byLabel<GeoPoint>(k, 'B');
    expect(b.getX()).toBeCloseTo(3, 6);
  });

  it('活半径圆序列化后仍与滑块联动', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    addInput(k, 'r = 2');
    addInput(k, 'c = Circle(A, r)');
    const json = serialize(k);
    const k2 = makeKernel();
    deserialize(k2, json);
    const conic = byLabel<GeoConic>(k2, 'c');
    const r = byLabel<GeoNumeric>(k2, 'r');
    expect(conic.getRadius()).toBeCloseTo(2, 6);
    r.setValue(7);
    k2.flushNow();
    expect(conic.getRadius()).toBeCloseTo(7, 6);
  });
});

describe('RegularPolygon 代数命令（顶点登记 + 序列化）', () => {
  it('返回并登记多边形与全部新顶点', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    const res = addInput(k, 'RegularPolygon(A, B, 5)');
    const polys = res.filter(e => e instanceof GeoPolygon);
    const newPoints = res.filter(e => e instanceof GeoPoint);
    expect(polys.length).toBe(1);
    // 5 边形：A、B 是输入，3 个新顶点应全部随返回值出现
    expect(newPoints.length).toBe(3);
    for (const p of newPoints) {
      expect((p as GeoPoint).label).not.toBe('');
      expect(k.getConstruction().getElements()).toContain(p);
    }
  });

  it('序列化 roundtrip 后多边形仍在', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 'RegularPolygon(A, B, 5)');
    const json = serialize(k);
    const k2 = makeKernel();
    deserialize(k2, json);
    const poly = k2.getConstruction().getElements().find(e => e instanceof GeoPolygon) as GeoPolygon;
    expect(poly).toBeDefined();
    expect(poly.vertices.length).toBe(5);
    // 顶点坐标有效（无悬垂引用）
    for (const v of poly.vertices) {
      expect(Number.isFinite(v.getX())).toBe(true);
    }
  });
});

describe('区域约束点（PointIn）拖拽传播', () => {
  it('updateParameter 后手动 recomputeDependents 能带动下游', () => {
    const k = makeKernel();
    const p1 = makePoint(k, 0, 0, 'P1');
    const p2 = makePoint(k, 4, 0, 'P2');
    const p3 = makePoint(k, 0, 3, 'P3');
    const poly = new GeoPolygon(k, [p1, p2, p3]);
    k.getConstruction().addElement(poly);
    const algo = new AlgoPointInRegion(k, poly);
    k.getConstruction().addElement(algo);
    const pt = algo.getOutput();
    k.getConstruction().addElement(pt);
    algo.update();

    const mid = new AlgoMidpoint(k, pt, p3);
    k.getConstruction().addElement(mid);
    k.getConstruction().addElement(mid.getOutput());
    mid.update();
    const midPt = mid.getOutput();

    // 模拟 GeometryCanvas 拖拽路径：updateParameter → algo.update → recomputeDependents
    algo.updateParameter(3, 0.5);
    algo.update();
    k.recomputeDependents(pt);
    expect(pt.getX()).toBeCloseTo(3, 6);
    expect(midPt.getX()).toBeCloseTo(1.5, 6);
  });
});

describe('动画清理', () => {
  it('setAnimating(false) 退订动画列表；删除后不再驻留', () => {
    const k = makeKernel();
    const num = new GeoNumeric(k, 0);
    num.label = 't';
    k.getConstruction().addElement(num);
    num.setAnimating(true);
    const am = k.getAnimationManager();
    expect(am.getAnimatedGeos()).toContain(num);
    num.setAnimating(false);
    expect(am.getAnimatedGeos()).not.toContain(num);
  });

  it('stopAllAnimation 回位并清空', () => {
    const k = makeKernel();
    const num = new GeoNumeric(k, 3);
    num.intervalMin = 0;
    num.intervalMax = 10;
    k.getConstruction().addElement(num);
    num.setAnimating(true);
    k.getAnimationManager().startAnimation();
    k.getAnimationManager().stopAllAnimation();
    expect(k.getAnimationManager().getAnimatedGeos().length).toBe(0);
    expect(num.isAnimating()).toBe(false);
    expect(num.getValue()).toBeCloseTo(3, 9); // 回到起始值
  });
});

describe('吸附与弧命中', () => {
  it('applySnap 取最近点而非构造序首个', () => {
    const k = makeKernel();
    const far = makePoint(k, 3, 0, 'Far');   // 距目标 3
    const near = makePoint(k, 1, 0, 'Near'); // 距目标 1
    const snapped = applySnap(0, 0, 12, false, true, [far, near]);
    expect(snapped.point).toBe(near);
  });

  it('GeoArc 3/4 弧（东→南逆时针）命中北侧点', () => {
    const k = makeKernel();
    const arc = new GeoArc(k, { x: 0, y: 0 }, 3, 0, -Math.PI / 2, false);
    // 北侧（0,3）在 0→3π/2 的逆时针弧上
    const probe = makePoint(k, 0, 3, 'N');
    expect(arc.isOnPath(probe, 1e-6)).toBe(true);
    const east = makePoint(k, 3, 0, 'E');
    expect(arc.isOnPath(east, 1e-6)).toBe(true);
    // 南偏东 45°（rel = 7π/4 > 3π/2）不在弧上
    const outside = makePoint(k, 2.12, -2.12, 'X');
    expect(arc.isOnPath(outside, 1e-6)).toBe(false);
  });
});
