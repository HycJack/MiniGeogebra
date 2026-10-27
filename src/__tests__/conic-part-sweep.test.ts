/**
 * 弧/扇形族（GeoArc / GeoConicPart）扫向统一回归。
 *
 * 2026-10-26 审计发现：同一 ccw 旗标在代码里有三种解释——渲染（Canvas
 * anticlockwise = 递减扫）、GeoConicPart.isAngleInRange（递增窗）、剪切采样与
 * 3D 视图（递增）。统一为渲染端约定（ccw=true = 递减扫），生产端按 det(A,B,C)
 * 定向。本文件锁定"画出来的集合 == 命中/取点/求交所用的集合"这一核心不变量，
 * 以及 Area 扇形/椭圆语义、重定义（含 Attach）与函数拖拽的序列化往返。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';
import { GeoArc, arcSweep } from '../kernel/geo/GeoArc';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoSemicircle } from '../kernel/algo/AlgoSemicircle';
import { AlgoCircularSector } from '../kernel/algo/AlgoCircularSector';
import { AlgoCircumcircularArc } from '../kernel/algo/AlgoCircumcircularArc';
import { AlgoPointOnArc } from '../kernel/algo/AlgoPointOnArc';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { AlgoDependentFunction } from '../kernel/algo/AlgoDependentFunction';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const roundtrip = (kernel: Kernel): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel, new CoordinateSystem(800, 600, 400, 300, 50, 50)));
  restored.getConstruction().updateAllAlgorithms();
  return restored;
};

const labelOf = (kernel: Kernel, label: string): ConstructionElement | undefined =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label);

const probe = (kernel: Kernel, x: number, y: number): GeoPoint =>
  new GeoPoint(kernel, new GeoVec3D(x, y, 1));

/** 沿扫向采样弧上点（渲染端画的就是这个集合），全部应命中 isOnPath。 */
const sampleAlongSweep = (part: GeoArc | GeoConicPart, kernel: Kernel, n = 24): GeoPoint[] => {
  const start = part.getStartAngle();
  const ccw = part.isCounterClockwise();
  const sweep = arcSweep(start, part.getEndAngle(), ccw);
  const c = part.getCenter();
  const r = part.getRadius();
  const pts: GeoPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + (ccw ? -1 : 1) * sweep * (i / n);
    pts.push(probe(kernel, c.x + r * Math.cos(t), c.y + r * Math.sin(t)));
  }
  return pts;
};

describe('弧/扇形族扫向统一（渲染 = 命中 = 取点 = 求交）', () => {
  it('CircumcircularArc 逆时针三点：弧经过 B，不经过互补弧中点', () => {
    const k = makeKernel();
    const a = makePoint(k, 1, 0, 'A');
    const b = makePoint(k, 0, 1, 'B');
    const c = makePoint(k, -1, 0, 'C');
    const algo = new AlgoCircumcircularArc(k, a, b, c);
    algo.compute();
    const arc = algo.getOutput();
    for (const p of sampleAlongSweep(arc, k)) expect(arc.isOnPath(p, 1e-9)).toBe(true);
    expect(arc.isOnPath(probe(k, 0, 1), 1e-9)).toBe(true);   // B 在弧上
    expect(arc.isOnPath(probe(k, 0, -1), 1e-9)).toBe(false); // 互补弧中点不在
  });

  it('CircumcircularArc 顺时针三点：弧经过 B（此前恒 ccw=true 画成互补弧）', () => {
    const k = makeKernel();
    const a = makePoint(k, 1, 0, 'A');
    const b = makePoint(k, 0, -1, 'B');
    const c = makePoint(k, -1, 0, 'C');
    const algo = new AlgoCircumcircularArc(k, a, b, c);
    algo.compute();
    const arc = algo.getOutput();
    for (const p of sampleAlongSweep(arc, k)) expect(arc.isOnPath(p, 1e-9)).toBe(true);
    expect(arc.isOnPath(probe(k, 0, -1), 1e-9)).toBe(true);
    expect(arc.isOnPath(probe(k, 0, 1), 1e-9)).toBe(false);
  });

  it('Semicircle：渲染画上半圆，isOnPath 也认上半圆（此前命中认的是下半）', () => {
    const k = makeKernel();
    const a = makePoint(k, 0, 0, 'A');
    const b = makePoint(k, 4, 0, 'B');
    const algo = new AlgoSemicircle(k, a, b);
    algo.compute();
    const sc = algo.getOutput();
    expect(sc.isOnPath(probe(k, 2, 2), 1e-9)).toBe(true);
    expect(sc.isOnPath(probe(k, 2, -2), 1e-9)).toBe(false);
    for (const p of sampleAlongSweep(sc, k)) expect(sc.isOnPath(p, 1e-9)).toBe(true);
  });

  it('CircularSector(M,A,B) = 从 A 逆时针到 B 的扇形（此前画互补 270°）', () => {
    const k = makeKernel();
    const m = makePoint(k, 0, 0, 'M');
    const s = makePoint(k, 3, 0, 'S');
    const e = makePoint(k, 0, 3, 'E');
    const algo = new AlgoCircularSector(k, m, s, e);
    algo.compute();
    const sec = algo.getOutput();
    expect(sec.isOnPath(probe(k, 3, 0), 1e-9)).toBe(true);
    expect(sec.isOnPath(probe(k, 0, 3), 1e-9)).toBe(true);
    expect(sec.isOnPath(probe(k, -3, 0), 1e-9)).toBe(false);
    expect(sec.isOnPath(probe(k, 0, -3), 1e-9)).toBe(false);
    for (const p of sampleAlongSweep(sec, k)) expect(sec.isOnPath(p, 1e-9)).toBe(true);
  });

  it('Intersect(半圆, 直线)：窗外交点被过滤（对标 allowOutlyingIntersections=false）', () => {
    const k = makeKernel();
    addInput(k, 'S = Semicircle((0,0), (4,0))');
    const sc = k.getConstruction().getElements().find(el => el instanceof GeoConicPart) as GeoConicPart;
    expect(sc).toBeDefined();

    // y = 1：两个解都在上半圆窗内（U/V 标签避开内联元组点自动占用的 A、B）
    makePoint(k, 0, 1, 'U1');
    makePoint(k, 4, 1, 'U2');
    addInput(k, 'lu = Line(U1, U2)');
    const interUp = new AlgoIntersect(k, sc, labelOf(k, 'lu') as GeoConic);
    interUp.compute();
    expect(interUp.getOutputPoints().filter(p => p.isDefined()).length).toBe(2);

    // y = −1：圆上有解（下半），但都不在半圆窗内 → 全部 undefined
    makePoint(k, 0, -1, 'V1');
    makePoint(k, 4, -1, 'V2');
    addInput(k, 'ld = Line(V1, V2)');
    const interDown = new AlgoIntersect(k, sc, labelOf(k, 'ld') as GeoConic);
    interDown.compute();
    expect(interDown.getOutputPoints().filter(p => p.isDefined()).length).toBe(0);
  });

  it('PointOn(半圆) 命令：点落在弧窗内，拖拽反解被夹回（此前走整圆锥参数）', () => {
    const k = makeKernel();
    addInput(k, 'S = Semicircle((0,0), (4,0))');
    const sc = k.getConstruction().getElements().find(el => el instanceof GeoConicPart) as GeoConicPart;
    addInput(k, 'P = PointOn(S)');
    const p = labelOf(k, 'P') as GeoPoint;
    expect(p).toBeDefined();
    expect(p.isDefined()).toBe(true);
    expect(sc.isOnPath(p, 1e-9)).toBe(true);
    const algo = p.parentAlgo as AlgoPointOnArc;
    expect(algo).toBeInstanceOf(AlgoPointOnArc);
    algo.updateParameter(2, -2); // 拖到下半圆远端
    algo.compute();
    expect(sc.isOnPath(p, 1e-9)).toBe(true);
  });

  it('GeoConicPart 的 ConicPartPathMover 沿扫向采样不越窗（Locus 载体）', () => {
    const k = makeKernel();
    const a = makePoint(k, 1, 0, 'A');
    const b = makePoint(k, 0, -1, 'B');
    const c = makePoint(k, -1, 0, 'C');
    const algo = new AlgoCircumcircularArc(k, a, b, c);
    algo.compute();
    const arc = algo.getOutput();
    const mover = arc.createPathMover();
    expect(mover).not.toBeNull();
    const p = new GeoPoint(k, new GeoVec3D(0, 0, 1));
    let guard = 0;
    while (mover.getNext(p) && guard++ < 1000) {
      expect(arc.isOnPath(p, 1e-9)).toBe(true);
    }
    expect(guard).toBeGreaterThan(0);
  });
});

describe('Area 语义（扇形/椭圆/抛物线/弧）', () => {
  const areaOf = (k: Kernel, label: string): { value: number; defined: boolean } => {
    const el = labelOf(k, label) as GeoNumeric;
    return { value: el.getValue(), defined: el.isDefined() };
  };

  it('90° 扇形面积 = r²·extent/2（此前返回整圆 πr²，4 倍误差）', () => {
    const k = makeKernel();
    addInput(k, 'M = (0,0)');
    addInput(k, 'S = (3,0)');
    addInput(k, 'E = (0,3)');
    addInput(k, 'CircularSector(M, S, E)');
    const sec = k.getConstruction().getElements().find(el => el instanceof GeoConicPart) as GeoConicPart;
    addInput(k, `ar = Area(${sec.label})`);
    const { value, defined } = areaOf(k, 'ar');
    expect(defined).toBe(true);
    expect(value).toBeCloseTo(9 * (Math.PI / 2) / 2, 6);
  });

  it('椭圆面积 = πab（此前丢短半轴，2 倍误差）', () => {
    const k = makeKernel();
    addInput(k, 'x²/4 + y² = 1');
    const conic = k.getConstruction().getElements().find(
      el => el instanceof GeoConic && !(el instanceof GeoConicPart)) as GeoConic;
    addInput(k, `ar = Area(${conic.label})`);
    const { value, defined } = areaOf(k, 'ar');
    expect(defined).toBe(true);
    expect(value).toBeCloseTo(2 * Math.PI, 6);
  });

  it('圆面积仍为 πr²；抛物线面积 undefined（此前假有限值）', () => {
    const k = makeKernel();
    addInput(k, 'x² + y² = 9');
    const circle = k.getConstruction().getElements().find(
      el => el instanceof GeoConic && (el as GeoConic).getConicType() === 'circle') as GeoConic;
    addInput(k, `a1 = Area(${circle.label})`);
    expect(areaOf(k, 'a1').value).toBeCloseTo(9 * Math.PI, 6);

    const k2 = makeKernel();
    addInput(k2, 'y² = x');
    const parabola = k2.getConstruction().getElements().find(
      el => el instanceof GeoConic && (el as GeoConic).getConicType() === 'parabola') as GeoConic;
    addInput(k2, `a2 = Area(${parabola.label})`);
    expect(areaOf(k2, 'a2').defined).toBe(false);
  });

  it('半圆（弧型）无面积：Area undefined（对标官方 Area(arc)）', () => {
    const k = makeKernel();
    addInput(k, 'Semicircle((0,0), (4,0))');
    const sc = k.getConstruction().getElements().find(el => el instanceof GeoConicPart) as GeoConicPart;
    addInput(k, `ar = Area(${sc.label})`);
    expect(areaOf(k, 'ar').defined).toBe(false);
  });
});

describe('重定义 / Attach 的存档往返（P0：此前重定义后对象静默丢失）', () => {
  it('自由数值重定义为依赖式后，导出再导入对象仍在且值正确', () => {
    const k = makeKernel();
    addInput(k, 'n = 1');
    addInput(k, 'a = 1');
    addInput(k, 'a = n + 1'); // 重定义：自由 → 依赖
    const restored = roundtrip(k);
    const a = labelOf(restored, 'a') as GeoNumeric;
    expect(a).toBeDefined();
    expect(a.isDefined()).toBe(true);
    expect(a.getValue()).toBeCloseTo(2, 9);
    expect(a.parentAlgo).not.toBeNull();
  });

  it('Attach 附着点：PointOn 隐藏参数已登记（无孤儿 constIndex），往返后仍附着在直线上', () => {
    const k = makeKernel();
    makePoint(k, 1, 1, 'A');
    makePoint(k, 0, -1, 'B');
    makePoint(k, 0, 1, 'C');
    addInput(k, 'ln = Line(B, C)');
    addInput(k, 'A = PointOn(ln)'); // Attach 语义：自由点重定义为路径点
    // 无孤儿：全部元素的 constIndex 都已登记（孤儿 param 会停在 −1，
    // 序列化写出引用 −1 的算法记录，导入时整条算法被跳过）
    for (const el of k.getConstruction().getElements()) {
      expect(el.constIndex).toBeGreaterThanOrEqual(0);
    }
    const restored = roundtrip(k);
    const a = labelOf(restored, 'A') as GeoPoint;
    expect(a).toBeDefined();
    expect(a.isDefined()).toBe(true);
    expect(a.parentAlgo?.getClassName()).toBe('AlgoPointOnLine');
    // 直线 x=0 上的点
    expect(Math.abs(a.getX())).toBeLessThan(1e-9);
  });

  it('函数拖拽 translateBy 后：expressionText 为纯 RHS，往返重建可用', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    const fn = labelOf(k, 'f') as unknown as {
      evaluateAt(x: number): number;
      parentAlgo: AlgoDependentFunction;
    };
    const algo = fn.parentAlgo;
    expect(algo).toBeInstanceOf(AlgoDependentFunction);
    algo.translateBy(2, 1); // f(x) = (x−2)² + 1
    expect(algo.getExpressionText()).not.toContain('=');
    const restored = roundtrip(k);
    const f2 = labelOf(restored, 'f') as unknown as {
      evaluateAt(x: number): number;
      isDefined(): boolean;
    };
    expect(f2).toBeDefined();
    expect(f2.isDefined()).toBe(true);
    expect(f2.evaluateAt(2)).toBeCloseTo(1, 6);
    expect(f2.evaluateAt(0)).toBeCloseTo(5, 6);
  });
});
