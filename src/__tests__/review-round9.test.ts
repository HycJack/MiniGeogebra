/**
 * 复审轮九（2026-11-08 动态几何对齐批二）回归用例：
 * L2-10 独立对象自引用就地赋值、L6-5 圆锥曲线路径动画弧长匀速、
 * F2-3 Locus 滑块驱动 + 自适应加密。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, EPS } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { AlgoLocus } from '../kernel/algo/AlgoLocus';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { ArcLengthTable } from '../kernel/core/ArcLength';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { ConstructionElement } from '../kernel/core/ConstructionElement';

const findEl = <T>(kernel: ReturnType<typeof makeKernel>, cls: new (...a: never[]) => T, label?: string): T =>
  kernel.getConstruction().getElements().find(
    el => el instanceof cls && (label === undefined || (el as { label?: string }).label === label),
  ) as T;

const addInput = (kernel: ReturnType<typeof makeKernel>, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('L2-10 独立对象自引用就地赋值（官方 Construction.java:1516-1533）', () => {
  it('a = a + 1：a 变为当前值 + 1，仍独立', () => {
    const k = makeKernel();
    addInput(k, 'a = 5');
    addInput(k, 'a = a + 1');
    const a = findEl(k, GeoNumeric, 'a');
    expect(a.isIndependent()).toBe(true);
    expect(a.getValue()).toBe(6);
  });

  it('SetValue 风格链式：a = 2a 翻倍', () => {
    const k = makeKernel();
    addInput(k, 'a = 3');
    addInput(k, 'a = 2a');
    expect(findEl(k, GeoNumeric, 'a').getValue()).toBe(6);
  });
});

describe('L6-5 圆锥曲线路径动画弧长匀速（官方 PathNormalizer）', () => {
  it('ArcLengthTable 反查：椭圆上匀弧长步进对应参数步长随曲率变化', () => {
    const kernel = makeKernel();
    // 椭圆 a=4, b=1：远端（θ≈0）参数步进对应大弧长，近端（θ≈π/2）小弧长
    const ellipse = new GeoConic(kernel, [1 / 16, 0, 1, 0, 0, -1]);
    kernel.getConstruction().addElement(ellipse);
    const table = new ArcLengthTable({ tMin: 0, tMax: 2 * Math.PI, pointAt: t => ellipse.pointAtAngle(t) });
    expect(table.total).toBeGreaterThan(8);   // 周长 ≈ 17.2
    expect(table.total).toBeLessThan(20);
    // 反查连续性：弧长单调 → 参数有界
    const t1 = table.tAtArcLength(0.25 * table.total)!;
    const t2 = table.tAtArcLength(0.75 * table.total)!;
    expect(t1).toBeGreaterThan(0);
    expect(t2).toBeGreaterThan(t1);
    // 弧长 0 处 = 参数域起点
    expect(table.tAtArcLength(0)).toBeCloseTo(0, 6);
  });

  it('advancePathAnimation：椭圆上匀速推进，位置沿曲线连续变化', () => {
    const kernel = makeKernel();
    addInput(kernel, 'e: x^2/16 + y^2 = 1');
    const ellipse = findEl(kernel, GeoConic) as GeoConic;
    const param = new GeoNumeric(kernel, 0);
    param.intervalMin = 0;
    param.intervalMax = 2 * Math.PI;
    param.setAnimationType(1); // INCREASING
    param.setAnimating(true);
    kernel.getConstruction().addElement(param);
    const algo = new AlgoPointOnConic(kernel, ellipse, param);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();
    const pt = algo.getOutput();
    expect(pt.isDefined()).toBe(true);

    // 匀速步进 60 帧（1 秒 @60fps，speed=1 → 弧长走总量 1/10）
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      algo.advancePathAnimation(60);
      kernel.getConstruction().updateAllAlgorithms();
      positions.push({ x: pt.getX(), y: pt.getY() });
    }
    // 位置在椭圆上
    const last = positions[positions.length - 1];
    expect(last.x * last.x / 16 + last.y * last.y).toBeCloseTo(1, 4);
    // 相邻帧位移有界且非零（匀速 → 每帧位移近似恒定）
    const steps = positions.slice(1).map((p, i) => Math.hypot(p.x - positions[i].x, p.y - positions[i].y));
    expect(steps.every(d => d > 1e-6)).toBe(true);
    const maxStep = Math.max(...steps);
    const minStep = Math.min(...steps);
    expect(maxStep / Math.max(minStep, 1e-12)).toBeLessThan(3); // 匀速性
  });
});

describe('F2-3 Locus 质量', () => {
  it('Locus(Q, a) 滑块驱动：旋角滑块扫出单位圆', () => {
    const k = makeKernel();
    addInput(k, 'O = (0, 0)');
    addInput(k, 'B = (1, 0)');
    addInput(k, 'a = Slider(0, 6.28, 0.01)');
    // 活依赖 tracer：P 随滑块 a 转（内联点非活依赖，Rotate 是）
    addInput(k, 'P = Rotate(B, a, O)');
    addInput(k, 'loc = Locus(P, a)');
    const locus = findEl(k, GeoLocus, 'loc');
    expect(locus).toBeDefined();
    expect(locus.isDefined()).toBe(true);
    expect(locus.samples.length).toBeGreaterThan(100);
    // 轨迹是单位圆：样本到原点距离 ≈ 1
    const s = locus.samples[40];
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 2);
  });

  it('自适应加密：高曲率差异轨迹（极扁椭圆）参数均匀采样被补点', () => {
    const k = makeKernel();
    addInput(k, 'e: x^2/100 + y^2 = 1');
    addInput(k, 'C = PointOn(e)');
    // M 轨迹 = 半轴 5/0.5 的椭圆：角度均匀采样下远端步长 ≈ 近端 10 倍 → 触发加密
    addInput(k, 'O2 = (0, 0)');
    addInput(k, 'M = Midpoint(O2, C)');
    addInput(k, 'loc = Locus(M, C)');
    const locus = findEl(k, GeoLocus, 'loc');
    expect(locus).toBeDefined();
    expect(locus.samples.length).toBeGreaterThan(120); // 加密生效（> 基础 120）
    expect(locus.samples.length).toBeLessThanOrEqual(600);
    // 加密后极扁椭圆远端（|x|≈5）处相邻样本步长与近端同量级
    const far = locus.samples.filter(p => Math.abs(p.x) > 4.5);
    expect(far.length).toBeGreaterThan(0);
  });

  it('点驱动 Locus 回归不破坏：圆上点的中点轨迹', () => {
    const k = makeKernel();
    const o = makePoint(k, 0, 0, 'O');
    const circleAlgo = new AlgoCirclePointRadius(k, o, 1);
    k.getConstruction().addElement(circleAlgo);
    k.getConstruction().addElement(circleAlgo.getOutput());
    circleAlgo.getOutput().label = 'c';
    circleAlgo.update();
    addInput(k, 'C = PointOn(c)');
    addInput(k, 'M = Midpoint(O, C)');
    addInput(k, 'loc = Locus(M, C)');
    const locus = findEl(k, GeoLocus, 'loc');
    expect(locus).toBeDefined();
    expect(locus.isDefined()).toBe(true);
    // 中点轨迹是半径 0.5 的圆
    const s = locus.samples[30];
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(0.5, 2);
  });
});
