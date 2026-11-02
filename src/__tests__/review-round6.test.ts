/**
 * 复审轮六（2026-10-31 官方源码全面比对轮 L 节）回归用例：
 * L1-1 除零/∞ 语义、L1-2 Round HALF_UP、L1-5 sin/cos 近零吸零、
 * L1-6 expressionToString 大数往返、L1-7 Center 语义、L1-8 三点圆退化、
 * L1-10 GeoList defined、L1-14 命令大小写、L1-16 派生元素 setCoords 级联、
 * L2-1 点工具交点分支（内核侧探针经 AlgoIntersect pointIndex 覆盖）。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { evaluate } from '../kernel/algebra/ExpressionEvaluator';
import { expressionToString } from '../kernel/algebra/Differentiator';
import { AlgoDependentNumeric } from '../kernel/algo/AlgoDependentNumeric';
import { AlgoCircleCenter } from '../kernel/algo/AlgoCircleCenter';
import { AlgoCircleThreePoints } from '../kernel/algo/AlgoCircleThreePoints';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { GeoList } from '../kernel/geo/GeoList';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoElement } from '../kernel/geo/GeoElement';

describe('L1-1 除零/∞ 语义（官方 MyDouble）', () => {
  it('1/0 = +∞、(-1)/0 = -∞（defined，保符号）', () => {
    expect(evaluate(parseExpression('1/0'), new Map())).toBe(Infinity);
    expect(evaluate(parseExpression('(-1)/0'), new Map())).toBe(-Infinity);
  });

  it('0/0 = NaN、∞^0 = NaN', () => {
    expect(evaluate(parseExpression('0/0'), new Map())).toBeNaN();
    // ∞^0 特判（Math.pow(∞,0)=1 与官方相悖，求值器需显式拦）
    const infNode = parseExpression('exp(1000)^0');
    expect(evaluate(infNode, new Map())).toBeNaN();
  });

  it('∞ 参与后续运算自然传播：exp(1000)/2 = ∞、exp(1000)·0 = NaN', () => {
    expect(evaluate(parseExpression('exp(1000)/2'), new Map())).toBe(Infinity);
    expect(evaluate(parseExpression('exp(1000)*0'), new Map())).toBeNaN();
  });

  it('依赖数值 1/0 保持 defined 且值为 ∞（AlgoDependentNumeric 不再误杀）', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 1, 0, 'A');
    void a;
    const algo = new AlgoDependentNumeric(
      kernel,
      { kind: 'binary', op: '/', left: { kind: 'number', value: 1 }, right: { kind: 'number', value: 0 } },
      [],
    );
    kernel.getConstruction().addElement(algo);
    algo.compute();
    const out = algo.getOutput();
    expect(out.isDefined()).toBe(true);
    expect(out.getValue()).toBe(Infinity);
  });
});

describe('L1-2 / L1-5 Round HALF_UP 与 sin/cos 近零吸零', () => {
  it('Round(-2.5) = -3（远离零，官方 HALF_UP）', () => {
    expect(evaluate(parseExpression('round(-2.5)'), new Map())).toBe(-3);
    expect(evaluate(parseExpression('round(2.5)'), new Map())).toBe(3);
  });

  it('sin(π) = 0、cos(π/2) = 0（浮点噪声吸零）', () => {
    const scope = new Map([['pi', Math.PI]]);
    expect(evaluate(parseExpression('sin(pi)'), scope)).toBe(0);
    expect(evaluate(parseExpression('cos(pi/2)'), scope)).toBe(0);
  });
});

describe('L1-6 expressionToString 大/小数值往返', () => {
  it('1e21 不再被截断为 1e+2，科学计数法可往返', () => {
    const node = parseExpression('1000000000000000000000*x');
    const text = expressionToString(node);
    const roundTripped = evaluate(parseExpression(text), new Map([['x', 2]]));
    expect(roundTripped).toBe(2e21);
  });

  it('极小系数不为 0', () => {
    const text = expressionToString({ kind: 'number', value: 1e-12 });
    expect(evaluate(parseExpression(text), new Map())).toBeCloseTo(1e-12, 20);
  });
});

describe('L1-7 Center 语义（官方 AlgoCenterConic）', () => {
  it('Center(抛物线) = undefined（此前回退顶点）', () => {
    const kernel = makeKernel();
    const parabola = new GeoConic(kernel, [0, 0, 1, -4, 0, 0]); // y² = 4x
    kernel.getConstruction().addElement(parabola);
    const algo = new AlgoCircleCenter(kernel, parabola);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    expect(algo.getOutput().isDefined()).toBe(false);
  });

  it('Center(圆) = 圆心', () => {
    const kernel = makeKernel();
    const circle = new GeoConic(kernel, [1, 0, 1, -4, -2, 3]); // (x-2)²+(y-1)²=2
    kernel.getConstruction().addElement(circle);
    const algo = new AlgoCircleCenter(kernel, circle);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    expect(algo.getOutput().isDefined()).toBe(true);
    expect(algo.getOutput().getX()).toBeCloseTo(2, 6);
    expect(algo.getOutput().getY()).toBeCloseTo(1, 6);
  });

  it('Center(两相交直线) = 交点', () => {
    const kernel = makeKernel();
    // (x-1)(y-2) = 0 → xy - 2x - y + 2 = 0，中心 (1, 2)
    const lines = new GeoConic(kernel, [0, 1, 0, -2, -1, 2]);
    kernel.getConstruction().addElement(lines);
    const algo = new AlgoCircleCenter(kernel, lines);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    expect(algo.getOutput().isDefined()).toBe(true);
    expect(algo.getOutput().getX()).toBeCloseTo(1, 6);
    expect(algo.getOutput().getY()).toBeCloseTo(2, 6);
  });

  it('Center(两平行线) = undefined（此前给 (0,0)/顶点）', () => {
    const kernel = makeKernel();
    // (y-1)(y-3) = y² - 4y + 3
    const parallel = new GeoConic(kernel, [0, 0, 1, 0, -4, 3]);
    kernel.getConstruction().addElement(parallel);
    const algo = new AlgoCircleCenter(kernel, parallel);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    expect(algo.getOutput().isDefined()).toBe(false);
  });
});

describe('L1-8 三点圆退化语义（官方 AlgoCircleThreePoints）', () => {
  const circleOf = (kernel: ReturnType<typeof makeKernel>, p1: GeoElement, p2: GeoElement, p3: GeoElement) => {
    const algo = new AlgoCircleThreePoints(kernel, p1 as never, p2 as never, p3 as never);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    return algo.getOutput();
  };

  it('普通三点圆正确', () => {
    const kernel = makeKernel();
    const c = circleOf(kernel, makePoint(kernel, 1, 0), makePoint(kernel, -1, 0), makePoint(kernel, 0, 1));
    expect(c.isDefined()).toBe(true);
    // 单位圆
    expect(c.coeffs[3]).toBeCloseTo(0, 9);
    expect(c.coeffs[4]).toBeCloseTo(0, 9);
    expect(c.coeffs[5]).toBeCloseTo(-1, 9);
  });

  it('微小三角形（边长 ~1e-5）不再被绝对阈值误判共线', () => {
    const kernel = makeKernel();
    const c = circleOf(kernel, makePoint(kernel, 0, 0), makePoint(kernel, 1e-5, 0), makePoint(kernel, 0, 1e-5));
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('circle');
  });

  it('三点共线 → 退化为过三点的直线（defined，官方语义）', () => {
    const kernel = makeKernel();
    const c = circleOf(kernel, makePoint(kernel, 0, 0), makePoint(kernel, 1, 1), makePoint(kernel, 2, 2));
    expect(c.isDefined()).toBe(true);
    // 直线一般式 y - x = 0：A=B=C=0
    expect(Math.abs(c.coeffs[0])).toBeLessThan(EPS);
    expect(Math.abs(c.coeffs[1])).toBeLessThan(EPS);
    expect(Math.abs(c.coeffs[2])).toBeLessThan(EPS);
    // 三个点都满足直线方程
    const [D, E, F] = [c.coeffs[3], c.coeffs[4], c.coeffs[5]];
    expect(Math.abs(D * 0 + E * 0 + F)).toBeLessThan(EPS);
    expect(Math.abs(D * 1 + E * 1 + F)).toBeLessThan(EPS);
    expect(Math.abs(D * 2 + E * 2 + F)).toBeLessThan(EPS);
  });

  it('三点重合 → 半径 0 点圆', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 3, 4);
    const c = circleOf(kernel, p, p, p);
    expect(c.isDefined()).toBe(true);
    expect(c.getRadius()).toBeCloseTo(0, 9);
    expect(c.getCenter().x).toBeCloseTo(3, 9);
  });
});

describe('L1-10 GeoList defined 语义（官方 GeoList）', () => {
  it('空列表 {} 是 defined 对象', () => {
    const kernel = makeKernel();
    const list = new GeoList(kernel, []);
    kernel.getConstruction().addElement(list);
    expect(list.isDefined()).toBe(true);
  });

  it('含 undefined 子元素的列表本身仍 defined', () => {
    const kernel = makeKernel();
    const undefinedPoint = makePoint(kernel, 0, 0);
    undefinedPoint.setUndefined();
    const list = new GeoList(kernel, [undefinedPoint]);
    kernel.getConstruction().addElement(list);
    expect(list.isDefined()).toBe(true);
  });
});

describe('L1-14 命令名大小写不敏感（官方 equalsIgnoreCase）', () => {
  it('MIDPOINT(A, B) 等任意大小写拼法可用', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    void b;
    const els = parseAlgebraInput(kernel, 'MIDPOINT(A, B)', undefined);
    const mid = els.find(el => el instanceof GeoElement && !(el instanceof GeoList) && el !== a) as GeoElement | undefined;
    expect(mid).toBeDefined();
  });

  it('PolyLine(A, B, C)（官方拼写，此前精确匹配失败）', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 1, 0, 'B');
    makePoint(kernel, 1, 1, 'C');
    const els = parseAlgebraInput(kernel, 'PolyLine(A, B, C)', undefined);
    expect(els.length).toBeGreaterThan(0);
  });
});

describe('L1-16 派生元素 setCoords 同步级联（官方 updateRepaint）', () => {
  it('中点的中点：拖动一阶派生点，二阶派生点立即跟随', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    const m1 = new AlgoMidpoint(kernel, a, b);
    kernel.getConstruction().addElement(m1);
    kernel.getConstruction().addElement(m1.getOutput());
    m1.update();
    const m2 = new AlgoMidpoint(kernel, m1.getOutput(), b);
    kernel.getConstruction().addElement(m2);
    kernel.getConstruction().addElement(m2.getOutput());
    m2.update();
    expect(m2.getOutput().getX()).toBeCloseTo(3, 9);

    // 直接挪一阶派生点（非独立元素）：依赖者无需调用方手动 recomputeDependents
    m1.getOutput().setCoords(0, 10);
    // (0,10) 与 B(4,0) 的中点 = (2,5)
    expect(m2.getOutput().getX()).toBeCloseTo(2, 9);
    expect(m2.getOutput().getY()).toBeCloseTo(5, 9);
  });
});

describe('L2-1 点工具交点分支（AlgoIntersect pointIndex 单点语义）', () => {
  it('直线×圆：指定 index 输出单个交点', () => {
    const kernel = makeKernel();
    const l = makeLine(kernel, 0, 1, 0); // x 轴
    const circle = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]); // 单位圆
    kernel.getConstruction().addElement(circle);
    const algo = new AlgoIntersect(kernel, l, circle, 1);
    kernel.getConstruction().addElement(algo);
    algo.compute();
    const pts = algo.getOutputPoints();
    expect(pts.length).toBe(1);
    expect(pts[0].isDefined()).toBe(true);
    expect(pts[0].getX()).toBeCloseTo(-1, 9);
    expect(pts[0].getY()).toBeCloseTo(0, 9);
  });
});
