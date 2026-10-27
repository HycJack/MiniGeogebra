/**
 * 拖拽 undo 快照回归（MoveSnapshot 模块，2026-10-27 第五批）。
 * 对照官方语义：每种 MoveMode 拖拽结束统一 storeUndo——独立点/数值/依赖函数
 * （moveFunction 表达式）/独立直线（moveLine 方程）/独立圆锥（moveConic 系数）/
 * 独立向量（moveVector 分量）全部可回滚。此前独立线/圆锥/向量拖拽不入 undo、
 * 同一手势拖依赖线可撤销而拖独立线不可撤销。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { captureMoveState, restoreMoveState, moveStateChanged } from '../kernel/core/MoveSnapshot';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string) => {
  // 复用 recognizer 的测试路径：直接构造（独立直线/圆锥不经 parseAlgebraInput，
  // 它们由方程输入创建——这里模拟其最终形态：无 parentAlgo 的独立对象）
  void text; void kernel;
};

describe('MoveSnapshot：独立直线（moveLine）', () => {
  it('拖拽平移方程后回滚恢复原系数', () => {
    const k = makeKernel();
    const l = new GeoLine(k, 2, -1, 1); // y = 2x + 1
    l.label = 'h';
    k.getConstruction().addElement(l);

    const before = captureMoveState(k);
    // 模拟拖拽：方程平移 (0, +2) → c: 1 → 1 - (-1)*2 = ... 直接改系数模拟
    l.c = l.c + 2 * Math.hypot(2, -1); // 平移的简化模拟：截距变化
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    const l2 = k.getConstruction().getElements().find(el => el instanceof GeoLine) as GeoLine;
    expect([l2.a, l2.b, l2.c]).toEqual([2, -1, 1]);
    expect(moveStateChanged(before, captureMoveState(k))).toBe(false);
  });
});

describe('MoveSnapshot：独立圆锥（moveConic）', () => {
  it('系数平移后回滚恢复', () => {
    const k = makeKernel();
    const c = new GeoConic(k, [1, 0, 1, -10, -4, 25]); // (x-5)²+(y-2)²=25
    c.label = 'cc';
    k.getConstruction().addElement(c);

    const before = captureMoveState(k);
    c.coeffs = [1, 0, 1, -6, -4, 9]; // 平移后的系数
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    const c2 = k.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    expect(c2.coeffs).toEqual([1, 0, 1, -10, -4, 25]);
  });
});

describe('MoveSnapshot：独立向量（moveVector）', () => {
  it('分量平移后回滚恢复', () => {
    const k = makeKernel();
    const v = new GeoVector(k, 1, 2, 4, 6);
    v.label = 'u';
    k.getConstruction().addElement(v);

    const before = captureMoveState(k);
    v.startX = 3; v.startY = 4; v.endX = 6; v.endY = 8;
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    const v2 = k.getConstruction().getElements().find(el => el instanceof GeoVector) as GeoVector;
    expect([v2.startX, v2.startY, v2.endX, v2.endY]).toEqual([1, 2, 4, 6]);
  });
});

describe('MoveSnapshot：依赖函数（moveFunction 表达式回滚）', () => {
  it('translateBy 拖拽后回滚恢复原表达式与函数值', async () => {
    const { parseAlgebraInput } = await import('../kernel/algebra/EquationRecognizer');
    const k = makeKernel();
    const els = parseAlgebraInput(k, 'f(x) = x^2');
    els.forEach(el => k.getConstruction().addElement(el));
    k.getConstruction().updateAllAlgorithms();

    const before = captureMoveState(k);
    const f = k.getConstruction().getElements().find(el => el instanceof GeoFunction) as GeoFunction;
    const algo = f.parentAlgo as unknown as { translateBy(dx: number, dy: number): void };
    algo.translateBy(2, 1); // f(x) = (x-2)^2 + 1
    expect(f.evaluateAt(2)).toBeCloseTo(1, 9);
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    k.getConstruction().updateAllAlgorithms();
    const f2 = k.getConstruction().getElements().find(el => el instanceof GeoFunction) as GeoFunction;
    expect(f2.evaluateAt(2)).toBeCloseTo(4, 9); // 回到 x²
    expect(f2.evaluateAt(0)).toBeCloseTo(0, 9);
    expect(moveStateChanged(before, captureMoveState(k))).toBe(false);
  });
});

describe('MoveSnapshot：自由点与数值', () => {
  it('点坐标/滑块值回滚（既有能力回归）', () => {
    const k = makeKernel();
    makePoint(k, 1, 2, 'A');
    const a = new GeoNumeric(k, 5);
    a.label = 'a';
    k.getConstruction().addElement(a);

    const before = captureMoveState(k);
    const pt = k.getConstruction().getElements().find(el => el instanceof GeoPoint) as GeoPoint;
    pt.setCoords(9, 9, 1);
    a.setValue(-3);
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    const pt2 = k.getConstruction().getElements().find(el => el instanceof GeoPoint) as GeoPoint;
    const a2 = k.getConstruction().getElements().find(el => el instanceof GeoNumeric) as GeoNumeric;
    expect(pt2.getX()).toBe(1);
    expect(pt2.getY()).toBe(2);
    expect(a2.getValue()).toBe(5);
  });

  it('依赖对象不进 freeForms/coords（拖拽经输入点入 undo，既有路径）', async () => {
    const { AlgoSegmentTwoPoints } = await import('../kernel/algo/AlgoSegmentTwoPoints');
    const k = makeKernel();
    const a = makePoint(k, 0, 0, 'A');
    const b = makePoint(k, 4, 0, 'B');
    const algo = new AlgoSegmentTwoPoints(k, a, b);
    k.getConstruction().addElement(algo);
    k.getConstruction().addElement(algo.getOutput());
    const snap = captureMoveState(k);
    // 依赖线段不在 freeForms（其拖拽经搬移输入点覆盖）
    expect([...snap.freeForms.values()].filter(ff => ff.kind === 'line')).toHaveLength(0);
  });
});
