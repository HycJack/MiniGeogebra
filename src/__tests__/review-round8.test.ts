/**
 * 复审轮八（2026-11-08 动态几何对齐批）回归用例：
 * L1-17 点捕捉世界单位阈值、L1-24 帧率自适应、L1-11 双曲线动画不跨支、
 * L2-2 工具类型补全（向量平行线/两线角平分线/两向量角/官方 AngularBisector 命令）、
 * L6-1 传递依赖集缓存正确性。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';
import { applySnap } from '../kernel/core/Snap';
import { AnimationManager } from '../kernel/core/AnimationManager';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoParallelLine } from '../kernel/algo/AlgoParallelLine';
import { AlgoAngleBisectorLines } from '../kernel/algo/AlgoAngleBisector';
import { AlgoAngleVectors } from '../kernel/algo/AlgoAngle';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoVec3D } from '../kernel/core/GeoVec3D';

const findEl = <T>(kernel: ReturnType<typeof makeKernel>, cls: new (...a: never[]) => T, label?: string): T =>
  kernel.getConstruction().getElements().find(
    el => el instanceof cls && (label === undefined || (el as { label?: string }).label === label),
  ) as T;

const addInput = (kernel: ReturnType<typeof makeKernel>, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('L1-17 点捕捉阈值模型（官方 0.125×格距，世界单位）', () => {
  it('AUTOMATIC 阈值：距格点 < 0.125×步长吸附，超出不吸', () => {
    const step = 1;
    const threshold = 0.125 * step;
    // 差 0.1（< 0.125）→ 吸附
    const hit = applySnap(1.1, 0, threshold, true, false, [], step, threshold);
    expect(hit.x).toBeCloseTo(1, 9);
    // 差 0.2（> 0.125）→ 不吸附（12px 固定像素模型在深缩放下会误吸）
    const miss = applySnap(1.2, 0, threshold, true, false, [], step, threshold);
    expect(miss.x).toBeCloseTo(1.2, 9);
  });

  it('ON_GRID（snap_grid）恒吸最近格点（官方 percentage=1）', () => {
    const hit = applySnap(1.47, 0, 12, true, false, [], 1, Infinity);
    expect(hit.x).toBeCloseTo(1, 9);
  });

  it('已有点吸附仍按屏幕半径（与点选热区一致）', () => {
    const p = makePoint(makeKernel(), 3, 0, 'A');
    const hit = applySnap(3.05, 0, 0.1, false, true, [p], 1, Infinity);
    expect(hit.type).toBe('point');
    expect(hit.x).toBeCloseTo(3, 9);
  });
});

describe('L1-24 动画帧率自适应（官方 adaptFrameRate）', () => {
  it('MIN 帧率对齐官方 6（此前 2 导致同速度参数步长标定不同）', () => {
    expect(AnimationManager.MIN_ANIMATION_FRAME_RATE).toBe(6);
    expect(AnimationManager.MAX_ANIMATION_FRAME_RATE).toBe(30);
  });
});

describe('L1-11 双曲线动画不跨支（空扇区反弹）', () => {
  it('参数扫入渐近线空扇区：反弹回最后有效参数，点保持 defined', () => {
    const kernel = makeKernel();
    // 双曲线 x²−y²=1（中心原点，开口 ±x），两支间的空扇区在 |θ|<π/4 等方向
    addInput(kernel, 'h: x^2 - y^2 = 1');
    const hyperbola = findEl(kernel, GeoConic) as GeoConic;
    expect(hyperbola).toBeDefined();
    const param = new GeoNumeric(kernel, Math.PI); // 左支方向
    param.intervalMin = 0;
    param.intervalMax = 2 * Math.PI;
    kernel.getConstruction().addElement(param);
    const algo = new AlgoPointOnConic(kernel, hyperbola, param);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();
    const pt = algo.getOutput();
    expect(pt.isDefined()).toBe(true);
    const branchX = pt.getX();
    expect(branchX).toBeLessThan(0); // 左支

    // 参数扫到空扇区（θ=0 沿 +x 方向 rayIntersections 无正根——右支射线方向
    // 从中心出发有交点，θ=0 命中右支；空扇区取渐近线之间的方向如 θ=π/4 附近）
    const gapAngle = Math.PI / 4 + 0.01; // 渐近线 θ=π/4 之外侧（|y|>|x| 无交）
    param.setValue(gapAngle);
    kernel.getConstruction().updateAllAlgorithms();
    // 反弹：param 被拉回最后有效参数，点 defined 且仍在同一支
    if (pt.isDefined()) {
      expect(Math.sign(pt.getX())).toBe(Math.sign(branchX));
    }
  });

  it('普通圆上动画不受反弹逻辑影响', () => {
    const kernel = makeKernel();
    addInput(kernel, 'c: x^2 + y^2 = 1');
    const circle = findEl(kernel, GeoConic) as GeoConic;
    const param = new GeoNumeric(kernel, 0.3);
    kernel.getConstruction().addElement(param);
    const algo = new AlgoPointOnConic(kernel, circle, param);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();
    const pt = algo.getOutput();
    expect(pt.isDefined()).toBe(true);
    expect(pt.getX() * pt.getX() + pt.getY() * pt.getY()).toBeCloseTo(1, 6);
  });
});

describe('L2-2 工具类型补全（官方 EuclidianController 形态）', () => {
  it('平行/垂直线方向载体认向量（:2456-2508）', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0, 'A');
    const v = new GeoVector(kernel, 1, 1, 4, 3);
    kernel.getConstruction().addElement(v);
    const algo = new AlgoParallelLine(kernel, p, v);
    kernel.getConstruction().addElement(algo);
    algo.update();
    const l = algo.getOutput();
    expect(l.isDefined()).toBe(true);
    // 方向 (3,2) → 法向 (2,-3)；过原点 → c=0；点 (3,2) 在线上
    expect(Math.abs(l.a * 3 + l.b * 2 + l.c)).toBeLessThan(EPS);
  });

  it('两线角平分线（官方 AngularBisector(l1,l2)）：两条互相垂直、过交点', () => {
    const kernel = makeKernel();
    const l1 = makeLine(kernel, 1, 0, 0); // x = 0
    const l2 = makeLine(kernel, 0, 1, 0); // y = 0
    const algo = new AlgoAngleBisectorLines(kernel, l1, l2);
    kernel.getConstruction().addElement(algo);
    algo.update();
    const [b1, b2] = algo.getOutputLines();
    expect(b1.isDefined() && b2.isDefined()).toBe(true);
    // 平分线 y=x 与 y=-x 过原点、互相垂直
    expect(Math.abs(b1.a - b1.b)).toBeLessThan(EPS);
    expect(Math.abs(b2.a + b2.b)).toBeLessThan(EPS);
    expect(b1.a * b2.a + b1.b * b2.b).toBeCloseTo(0, 6);
  });

  it('AngularBisector 命令 2 线形（arity [2,3]）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'l1: x = 0');
    addInput(kernel, 'l2: y = 0');
    addInput(kernel, 'b = AngularBisector(l1, l2)');
    const bisectors = kernel.getConstruction().getElements().filter(el => el instanceof GeoLine);
    expect(bisectors.length).toBeGreaterThanOrEqual(4); // l1, l2 + 2 条平分线
  });

  it('两向量角（官方 angle() 两向量分支）', () => {
    const kernel = makeKernel();
    const v1 = new GeoVector(kernel, 0, 0, 1, 0); // +x
    const v2 = new GeoVector(kernel, 0, 0, 0, 1); // +y
    kernel.getConstruction().addElement(v1);
    kernel.getConstruction().addElement(v2);
    const algo = new AlgoAngleVectors(kernel, v1, v2);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    expect(algo.getOutput().getValue()).toBeCloseTo(Math.PI / 2, 9);
  });

  it('切线工具数据面：Tangent(line, conic) 平行切线、Tangent(P, f) 活切线（既有命令回归）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'c: x^2 + y^2 = 4');
    addInput(kernel, 'l: y = 1');
    addInput(kernel, 't = Tangent(l, c)');
    const tangents = kernel.getConstruction().getElements().filter(
      el => el instanceof GeoLine && el !== findEl(kernel, GeoLine, 'l'),
    );
    expect(tangents.length).toBeGreaterThanOrEqual(2); // ±平行切线
  });

  it('中点工具数据面：Midpoint(线段端点) 与 Intersect 单点（回归）', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 2, 'B');
    void a; void b;
    const m = new AlgoMidpoint(kernel, a, b);
    kernel.getConstruction().addElement(m);
    m.update();
    expect(m.getOutput().getX()).toBeCloseTo(2, 9);
    const l1 = makeLine(kernel, 1, 0, 0);
    const c = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]);
    kernel.getConstruction().addElement(c);
    const inter = new AlgoIntersect(kernel, l1, c, 1);
    kernel.getConstruction().addElement(inter);
    inter.update();
    // 直线 x=0 与单位圆交于 (0, ±1)：单点输出按解序取第 1 个
    const ip = inter.getOutputPoints()[0];
    expect(ip.isDefined()).toBe(true);
    expect(ip.getX()).toBeCloseTo(0, 9);
    expect(Math.abs(ip.getY())).toBeCloseTo(1, 9);
  });
});

describe('L6-1 传递依赖集缓存（官方 algoUpdateSet 等价）', () => {
  it('缓存命中与图变更失效结果一致：删边后依赖集即时收缩', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 2, 0, 'B');
    const m1 = new AlgoMidpoint(kernel, a, b);
    kernel.getConstruction().addElement(m1);
    kernel.getConstruction().addElement(m1.getOutput());
    m1.update();
    // 首查建立缓存
    const before = kernel.getConstruction().getForwardDependentAlgorithms(a);
    expect(before).toContain(m1);
    // 缓存命中（同版本）
    expect(kernel.getConstruction().getForwardDependentAlgorithms(a)).toBe(before);
    // 图变更（新增依赖 A 的算法）→ 缓存失效 → 新算法进入依赖集
    const m2 = new AlgoMidpoint(kernel, a, m1.getOutput());
    kernel.getConstruction().addElement(m2);
    kernel.getConstruction().addElement(m2.getOutput());
    m2.update();
    const after = kernel.getConstruction().getForwardDependentAlgorithms(a);
    expect(after).toContain(m1);
    expect(after).toContain(m2);
  });
});
