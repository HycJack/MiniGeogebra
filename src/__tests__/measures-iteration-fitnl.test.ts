/**
 * 几何度量杂项 + 迭代 + 非线性拟合回归（L4-A3/A6，官方 AlgoAffineRatio/AlgoFitSin 等对齐）：
 * AffineRatio/Barycenter/CrossRatio/AreConcurrent/InteriorAngles/Direction/
 * DynamicCoordinates/PathParameter/TriangleCenter X(1)–X(10)、
 * Iteration/IterationList、Fit(list,f)/FitSin/FitLogistic（LM）。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoList } from '../kernel/geo/GeoList';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { triangleCenter } from '../kernel/algo/AlgoGeoMeasures';

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

describe('L4-A6 几何度量杂项（官方 AlgoAffineRatio / AlgoCrossRatio / ...）', () => {
  it('AffineRatio：P = A + λ(B−A) 的有符号 λ', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 'P = (1, 2)');   // λ = 0.25
    addInput(k, 'ar = AffineRatio(P, A, B)');
    expect(findEl(k, GeoNumeric, 'ar').getValue()).toBeCloseTo(0.25, 9);
  });

  it('CrossRatio：(AC/BC)/(AD/BD) 有符号', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (1, 0)');
    addInput(k, 'C = (2, 0)');
    addInput(k, 'D = (4, 0)');
    addInput(k, 'cr = CrossRatio(A, B, C, D)');
    // (2/1)/(4/3) = 1.5
    expect(findEl(k, GeoNumeric, 'cr').getValue()).toBeCloseTo(1.5, 9);
  });

  it('Barycenter：等权与加权', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (2, 0)');
    addInput(k, 'C = (4, 6)');
    addInput(k, 'g1 = Barycenter({A, B, C})');
    expect(findEl(k, GeoPoint, 'g1').getX()).toBeCloseTo(2, 9);
    addInput(k, 'w = {1, 1, 2}');
    addInput(k, 'g2 = Barycenter({A, B, C}, w)');
    // (0+2+8)/4 = 2.5, (0+0+12)/4 = 3
    expect(findEl(k, GeoPoint, 'g2').getX()).toBeCloseTo(2.5, 9);
    expect(findEl(k, GeoPoint, 'g2').getY()).toBeCloseTo(3, 9);
  });

  it('AreConcurrent：三线共点 1 / 平行 0', () => {
    const k = makeKernel();
    addInput(k, 'l1: x = 0');
    addInput(k, 'l2: y = 0');
    addInput(k, 'l3: x + y = 1');   // 过 (0,1)? 不共点 → 0
    addInput(k, 'l4: x + y = 0');   // 过原点 → 共点 → 1
    addInput(k, 'c1 = AreConcurrent(l1, l2, l4)');
    addInput(k, 'c2 = AreConcurrent(l1, l2, l3)');
    expect(findEl(k, GeoNumeric, 'c1').getValue()).toBe(1);
    expect(findEl(k, GeoNumeric, 'c2').getValue()).toBe(0);
  });

  it('InteriorAngles：正方形内角全 90°', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (2, 0)');
    addInput(k, 'C = (2, 2)');
    addInput(k, 'D = (0, 2)');
    addInput(k, 'poly = Polygon(A, B, C, D)');
    addInput(k, 'angs = InteriorAngles(poly)');
    const angs = findEl(k, GeoList, 'angs');
    const values = (angs.getChildren() as GeoNumeric[]).map(a => a.getValue());
    expect(values.length).toBe(4);
    values.forEach(v => expect(v).toBeCloseTo(Math.PI / 2, 9));
  });

  it('Direction：方向向量与直线平行', () => {
    const k = makeKernel();
    addInput(k, 'l: 2x + 3y = 6');
    addInput(k, 'd = Direction(l)');
    // 方向 (−3,2)/√13 与法向 (2,3) 点积为 0
    const d = findEl(k, GeoVectorLike, 'd');
    const dx = d.endX - d.startX;
    const dy = d.endY - d.startY;
    expect(Math.abs(2 * dx + 3 * dy)).toBeLessThan(EPS);
  });

  it('DynamicCoordinates：坐标被表达式改写', () => {
    const k = makeKernel();
    addInput(k, 'A = (3, 4)');
    addInput(k, 'B = (5, 0)');
    addInput(k, 'snap = DynamicCoordinates(A, x(B), 2y(B))');
    const snap = findEl(k, GeoPoint, 'snap');
    expect(snap).toBeDefined();
    expect(snap.getX()).toBeCloseTo(5, 9);
    expect(snap.getY()).toBeCloseTo(0, 9);
  });

  it('PathParameter：路径点的隐藏参数读出', () => {
    const k = makeKernel();
    addInput(k, 'c: x^2 + y^2 = 1');
    addInput(k, 'P = PointOn(c, 0.7)');
    addInput(k, 'pp = PathParameter(P)');
    expect(findEl(k, GeoNumeric, 'pp').getValue()).toBeCloseTo(0.7, 6);
    // 非路径点 → undefined
    addInput(k, 'Q = (1, 2)');
    addInput(k, 'qq = PathParameter(Q)');
    expect(findEl(k, GeoNumeric, 'qq').isDefined()).toBe(false);
  });
});

import { GeoVector as GeoVectorLike } from '../kernel/geo/GeoVector';

describe('TriangleCenter：Kimberling X(1)–X(10)', () => {
  // 3-4-5 直角三角形：A(0,0), B(4,0), C(0,3)
  const A = { x: 0, y: 0 };
  const B = { x: 4, y: 0 };
  const C = { x: 0, y: 3 };

  it('X1 内心 = (1,1)', () => {
    expect(triangleCenter(1, A, B, C)).toEqual({ x: 1, y: 1 });
  });
  it('X2 重心 = (4/3, 1)', () => {
    const g = triangleCenter(2, A, B, C)!;
    expect(g.x).toBeCloseTo(4 / 3, 9);
    expect(g.y).toBeCloseTo(1, 9);
  });
  it('X3 外心 = (2, 1.5)', () => {
    expect(triangleCenter(3, A, B, C)).toEqual({ x: 2, y: 1.5 });
  });
  it('X4 垂心 = 直角顶点 A', () => {
    expect(triangleCenter(4, A, B, C)).toEqual({ x: 0, y: 0 });
  });
  it('X5 九点圆心 = (1, 0.75)', () => {
    const n = triangleCenter(5, A, B, C)!;
    expect(n.x).toBeCloseTo(1, 9);
    expect(n.y).toBeCloseTo(0.75, 9);
  });
  it('X7 Gergonne 与 X8 Nagel 在三角形内（重心坐标均正）', () => {
    for (const n of [7, 8, 10]) {
      const p = triangleCenter(n, A, B, C)!;
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x / 4 + p.y / 3).toBeLessThan(1);
    }
  });
  it('X11+ 返回 undefined', () => {
    expect(triangleCenter(11, A, B, C)).toBeNull();
  });

  it('命令面 + 活 n：TriangleCenter(A, B, C, k)', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 'C = (0, 3)');
    addInput(k, 'kk = Slider(1, 10, 1)');
    addInput(k, 'tc = TriangleCenter(A, B, C, kk)');
    const tc = findEl(k, GeoPoint, 'tc');
    const kk = findEl(k, GeoNumeric, 'kk');
    kk.setValue(2);
    k.getConstruction().updateAllAlgorithms();
    expect(tc.getX()).toBeCloseTo(4 / 3, 9);
    kk.setValue(3);
    k.getConstruction().updateAllAlgorithms();
    expect(tc.getX()).toBeCloseTo(2, 9);
    kk.setValue(11);
    k.getConstruction().updateAllAlgorithms();
    expect(tc.isDefined()).toBe(false);
  });
});

describe('Iteration / IterationList（官方 AlgoIteration）', () => {
  it('Iteration(f, start, n)：f 复合 n 次', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = 2x + 1');
    addInput(k, 'v = Iteration(f, 0, 3)');
    // 0 → 1 → 3 → 7
    expect(findEl(k, GeoNumeric, 'v').getValue()).toBe(7);
  });

  it('IterationList：轨道含初值', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x/2');
    addInput(k, 'orb = IterationList(f, 16, 4)');
    const orb = findEl(k, GeoList, 'orb');
    const values = (orb.getChildren() as GeoNumeric[]).map(c => c.getValue());
    expect(values).toEqual([16, 8, 4, 2, 1]);
  });

  it('活依赖：f 重定义后迭代值跟随', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x + 1');
    addInput(k, 'v = Iteration(f, 0, 2)');
    expect(findEl(k, GeoNumeric, 'v').getValue()).toBe(2);
    addInput(k, 'f(x) = 10x');
    k.getConstruction().updateAllAlgorithms();
    expect(findEl(k, GeoNumeric, 'v').getValue()).toBe(0); // 0 → 0 → 0
  });
});

describe('非线性拟合（官方 AlgoFit / AlgoFitSin / AlgoFitLogistic，LM）', () => {
  it('Fit(list, f)：自由参数自动发现（f(x) = a x^b，a/b 未定义）', () => {
    const k = makeKernel();
    for (const [x, y] of [[1, 2], [2, 2 * Math.pow(2, 0.7)], [3, 2 * Math.pow(3, 0.7)]]) {
      makePoint(k, x, y, `F${x}`);
    }
    addInput(k, 'model(x) = a x^b');
    addInput(k, 'fit = Fit({F1, F2, F3}, model)');
    const fit = findEl(k, GeoFunction, 'fit');
    expect(fit).toBeDefined();
    expect(fit.isDefined()).toBe(true);
    expect(fit.evaluateAt(2)).toBeCloseTo(2 * Math.pow(2, 0.7), 3);
    expect(fit.evaluateAt(4)).toBeCloseTo(2 * Math.pow(4, 0.7), 2);
  });

  it('FitSin：a·sin(bx+c)+d 数据还原', () => {
    const k = makeKernel();
    for (let i = 0; i < 24; i++) {
      const x = (i / 24) * 4 * Math.PI;
      makePoint(k, x, 3 * Math.sin(x + 0.5) + 1, `S${i}`);
    }
    const pts = Array.from({ length: 24 }, (_, i) => `S${i}`).join(', ');
    addInput(k, `fs = FitSin({${pts}})`);
    const fs = findEl(k, GeoFunction, 'fs');
    expect(fs).toBeDefined();
    expect(fs.isDefined()).toBe(true);
    // 还原精度：若干采样点误差 < 0.1
    for (const x of [0.5, 2, 5, 9]) {
      expect(fs.evaluateAt(x)).toBeCloseTo(3 * Math.sin(x + 0.5) + 1, 1);
    }
  });

  it('FitLogistic：S 型曲线还原', () => {
    const k = makeKernel();
    for (let i = 0; i < 20; i++) {
      const x = i - 10;
      makePoint(k, x, 10 / (1 + 2 * Math.exp(-0.8 * x)), `G${i + 100}`);
    }
    const pts = Array.from({ length: 20 }, (_, i) => `G${i + 100}`).join(', ');
    addInput(k, `fl = FitLogistic({${pts}})`);
    const fl = findEl(k, GeoFunction, 'fl');
    expect(fl.isDefined()).toBe(true);
    expect(fl.evaluateAt(0)).toBeCloseTo(10 / 3, 1);
  });

  it('序列化 roundtrip：Iteration 与 TriangleCenter 重建', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = 2x + 1');
    addInput(k, 'v = Iteration(f, 0, 3)');
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 'C = (0, 3)');
    addInput(k, 'tc = TriangleCenter(A, B, C, 1)');
    const json = serialize(k);
    const k2 = makeKernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    expect(findEl(k2, GeoNumeric, 'v').getValue()).toBe(7);
    expect(findEl(k2, GeoPoint, 'tc').getX()).toBeCloseTo(1, 9);
  });
});
