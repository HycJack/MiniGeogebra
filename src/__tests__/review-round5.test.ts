/**
 * 2026-10-30 重审轮回归（渲染/外围模块审计 + E1 交互批）：
 *
 * P0 序列化：Angle(P,Q)/Angle(l1,l2)/弧上点/函数单交点四类算法此前缺
 *   createAlgo case，存档重载静默丢对象；IntegralDefinite 混合端点错位；
 *   Intersect(f,g,index) 的 index 不落盘；自由分量向量 u=(1,2) 存档即丢。
 * P1：动画"停止"语义（保持当前值可续播，官方 isPaused）；GeoText/GeoList
 *   样式字段。
 * 数学：FitPoly 归一化（幂基大偏移病态）；Intersect 平行线创建 undefined 交点。
 */
import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoText } from '../kernel/geo/GeoText';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { AnimationManager } from '../kernel/core/AnimationManager';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const byLabel = <T extends ConstructionElement>(kernel: Kernel, label: string): T =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T;

/** roundtrip 后按标签查对象（反序列化就地重建 kernel）。 */
const roundtrip = (kernel: Kernel): void => {
  deserialize(kernel, serialize(kernel));
  kernel.getConstruction().updateAllAlgorithms();
};

describe('序列化 P0：此前缺 createAlgo case 的四类算法', () => {
  it('Angle(P,Q) roundtrip 后角度对象与数值保留', () => {
    const k = makeKernel();
    makePoint(k, 1, 0, 'P');
    makePoint(k, 0, 1, 'Q');
    addInput(k, 'ang = Angle(P, Q)');
    roundtrip(k);
    const ang = byLabel<GeoNumeric>(k, 'ang');
    expect(ang).toBeDefined();
    expect(ang.isDefined()).toBe(true);
    expect(ang.getValue() * 180 / Math.PI).toBeCloseTo(90, 4);
  });

  it('Angle(l1,l2) roundtrip 后保留', () => {
    const k = makeKernel();
    addInput(k, 'l1 = Line((0,0), (1,0))');
    addInput(k, 'l2 = Line((0,0), (0,1))');
    addInput(k, 'ang = Angle(l1, l2)');
    roundtrip(k);
    const ang = byLabel<GeoNumeric>(k, 'ang');
    expect(ang).toBeDefined();
    expect(ang.getValue() * 180 / Math.PI).toBeCloseTo(90, 4);
  });

  it('弧上点（PointOn Arc）roundtrip 后保留且仍在弧上', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'O');
    makePoint(k, 2, 0, 'A');
    makePoint(k, 0, 2, 'B');
    addInput(k, 'arc1 = Arc(O, A, B)');
    addInput(k, 'Pon = PointOn(arc1)');
    const before = byLabel<GeoPoint>(k, 'Pon');
    expect(before.isDefined()).toBe(true);
    roundtrip(k);
    const after = byLabel<GeoPoint>(k, 'Pon');
    expect(after).toBeDefined();
    expect(after.isDefined()).toBe(true);
    // 仍在圆 O 半径 2 上
    expect(Math.hypot(after.getX(), after.getY())).toBeCloseTo(2, 4);
  });

  it('Intersect(f,g,2) 的 index roundtrip 后保留（输出仍为单个交点）', () => {
    const k = makeKernel();
    addInput(k, 'f1(x) = x^2 - 1');
    addInput(k, 'g1(x) = 0');
    addInput(k, 'i2 = Intersect(f1, g1, 2)');
    // 函数×函数走 AlgoIntersectFunctionsPoint（AlgoIntersect 不支持函数输入）
    const before = byLabel<GeoPoint>(k, 'i2');
    expect(before.isDefined()).toBe(true);
    expect(before.getX()).toBeCloseTo(1, 6);
    roundtrip(k);
    const after = byLabel<GeoPoint>(k, 'i2');
    expect(after).toBeDefined();
    expect(after.isDefined()).toBe(true);
    // 仍是第 2 个交点（index 丢失会漂移到 x=-1 或输出全部交点）
    expect(after.getX()).toBeCloseTo(1, 6);
  });
});

describe('序列化 P0：IntegralDefinite 混合端点', () => {
  it('Integral(f, 2, t)（a 冻结、b 活滑块）roundtrip 后端点不错位', () => {
    const k = makeKernel();
    addInput(k, 't = 3');
    addInput(k, 'f1(x) = x');
    addInput(k, 'iv = Integral(f1, 2, t)');
    const iv = byLabel<GeoNumeric>(k, 'iv');
    // ∫₂³ x dx = 2.5
    expect(iv.getValue()).toBeCloseTo(2.5, 4);
    roundtrip(k);
    const iv2 = byLabel<GeoNumeric>(k, 'iv');
    expect(iv2.isDefined()).toBe(true);
    // 若错位（t 的值当 a），结果会是别的数
    expect(iv2.getValue()).toBeCloseTo(2.5, 4);
    // 滑块变化仍跟随
    byLabel<GeoNumeric>(k, 't').setValue(4);
    k.getConstruction().updateAllAlgorithms();
    expect(byLabel<GeoNumeric>(k, 'iv').getValue()).toBeCloseTo(6, 3);
  });
});

describe('序列化：自由分量向量与样式字段', () => {
  it('Vector(1, 2) 分量形式 roundtrip 后保留（此前存档即丢）', () => {
    const k = makeKernel();
    addInput(k, 'u = Vector(1, 2)');
    const u = byLabel<GeoVector>(k, 'u');
    expect(u).toBeDefined();
    roundtrip(k);
    const u2 = byLabel<GeoVector>(k, 'u');
    expect(u2).toBeDefined();
    expect(u2.startX).toBeCloseTo(0, 9);
    expect(u2.endX).toBeCloseTo(1, 9);
    expect(u2.endY).toBeCloseTo(2, 9);
  });

  it('自由 GeoText 的 labelOffset/isFixed roundtrip 后保留（此前只存颜色/可见性）', () => {
    const k = makeKernel();
    addInput(k, 'txt = Text("面积", 3, 4)');
    const txt = byLabel<GeoText>(k, 'txt');
    expect(txt).toBeDefined();
    txt.labelOffsetX = 12;
    txt.labelOffsetY = -8;
    txt.isFixed = true;
    roundtrip(k);
    const txt2 = byLabel<GeoText>(k, 'txt');
    expect(txt2).toBeDefined();
    expect(txt2.labelOffsetX).toBe(12);
    expect(txt2.labelOffsetY).toBe(-8);
    expect(txt2.isFixed).toBe(true);
  });
});

describe('动画停止语义（官方 isPaused：保持当前值可续播）', () => {
  it('stopAnimation 后值保持、列表保留（ Vitest 无 RAF，仅验证状态不重置）', () => {
    const k = makeKernel();
    addInput(k, 'a = Slider(0, 10)');
    const a = byLabel<GeoNumeric>(k, 'a');
    const am = k.getAnimationManager();
    a.setAnimating(true);
    am.addAnimatedGeo(a);
    // 推进几帧（不经 startAnimation——测试环境无 requestAnimationFrame）
    a.doAnimationStep(30);
    a.doAnimationStep(30);
    const midValue = a.getValue();
    am.stopAnimation();
    // 值不回弹到起点（此前"停止"走 stopAllAnimation 会重置）
    expect(a.getValue()).toBe(midValue);
    // 列表保留：续播无需逐对象重新开启
    expect(am.getAnimatedGeos().length).toBe(1);
    expect(am.isRunning()).toBe(false);
  });
});

describe('FitPoly 归一化（幂基大偏移病态）', () => {
  it('x ∈ [1e3, 2e5] 四次拟合残差不再灾难化（此前 136 倍）', () => {
    const k = makeKernel();
    // 严格落在 y = 0.0001x² − 2x + 5000 上的 5 个点（4 次拟合应精确）
    const xs = [1000, 60000, 110000, 160000, 200000];
    const f = (x: number) => 0.0001 * x * x - 2 * x + 5000;
    xs.forEach((x, i) => makePoint(k, x, f(x), `P${i + 1}`));
    addInput(k, 'p1 = FitPoly(P1, P2, P3, P4, P5, 4)');
    const fit = byLabel<GeoFunction>(k, 'p1');
    expect(fit.isDefined()).toBe(true);
    // 精确插值：每个数据点与区间中点残差应接近机器精度
    let maxResidual = 0;
    for (const x of [...xs, 55000, 150000]) {
      maxResidual = Math.max(maxResidual, Math.abs(fit.evaluateAt(x) - f(x)));
    }
    expect(maxResidual).toBeLessThan(1e-3);
  });

  it('常规小坐标拟合结果不变（归一化是等价变换）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'Q1');
    makePoint(k, 1, 1, 'Q2');
    makePoint(k, 2, 0, 'Q3');
    addInput(k, 'p1 = FitPoly(Q1, Q2, Q3, 2)');
    const fit = byLabel<GeoFunction>(k, 'p1');
    // −x² + 2x
    expect(fit.evaluateAt(0.5)).toBeCloseTo(0.75, 6);
    expect(fit.evaluateAt(1.5)).toBeCloseTo(0.75, 6);
  });
});

describe('Intersect 平行线语义（官方：创建暂未定义交点）', () => {
  it('平行线 Intersect 创建 undefined 点，非平行组合仍干净报错', () => {
    const k = makeKernel();
    addInput(k, 'l1 = Line((0, 0), (4, 0))');
    addInput(k, 'l2 = Line((0, 1), (4, 1))');
    const elements = addInput(k, 'X = Intersect(l1, l2)');
    const pts = elements.filter((el): el is GeoPoint => el instanceof GeoPoint);
    expect(pts.length).toBe(1);
    expect(pts[0].isDefined()).toBe(false);

    const k2 = makeKernel();
    addInput(k2, 'c1 = Circle((0,0), 1)');
    addInput(k2, 'c2 = Circle((10,0), 1)');
    expect(() => addInput(k2, 'Y = Intersect(c1, c2)')).toThrow(/do not intersect/);
  });
});
