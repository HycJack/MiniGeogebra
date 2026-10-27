import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { AlgoLineTwoPoints } from '../kernel/algo/AlgoLineTwoPoints';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel, makePoint } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  return elements;
};

/** 输出的第一个元素是算法对象，属性输出按类型过滤。 */
const outputsOf = <T>(kernel: Kernel, text: string, type: new (...args: any[]) => T): T[] =>
  addInput(kernel, text).filter(el => el instanceof (type as any)) as T[];

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

const addLabeledConic = (kernel: Kernel, coeffs: number[], label: string): GeoConic => {
  const conic = new GeoConic(kernel, coeffs);
  conic.label = label;
  c(kernel).addElement(conic);
  return conic;
};

const addLabeledLine = (kernel: Kernel, p1: GeoPoint, p2: GeoPoint, label: string): GeoLine => {
  const algo = new AlgoLineTwoPoints(kernel, p1, p2);
  const line = algo.getOutput();
  line.label = label;
  c(kernel).addElement(algo);
  c(kernel).addElement(line); // 与 UI 一致：算法输出需单独注册才会出现在元素列表
  c(kernel).updateAllAlgorithms();
  return line;
};

describe('B1: conic property commands', () => {
  it('Focus of x²/4 + y² = 1 gives (±√3, 0)', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [1, 0, 4, 0, 0, -4], 'e');
    const elements = addInput(kernel, 'Focus(e)');
    const foci = elements.filter((el): el is GeoPoint => el instanceof GeoPoint && el.isDefined());
    const xs = foci.map(f => +f.getX().toFixed(6)).sort((a, b) => a - b);
    expect(xs).toEqual([-Math.sqrt(3), Math.sqrt(3)].map(v => +v.toFixed(6)));
    expect(foci.every(f => Math.abs(f.getY()) < 1e-9)).toBe(true);
  });

  it('Eccentricity of the same ellipse is √3/2', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [1, 0, 4, 0, 0, -4], 'e');
    const [num] = outputsOf(kernel, 'Eccentricity(e)', GeoNumeric);
    expect(num.getValue()).toBeCloseTo(Math.sqrt(3) / 2, 9);
  });

  it('Asymptote of x² − y²/4 = 1 gives y = ±2x', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [4, 0, -1, 0, 0, -4], 'h');
    const elements = addInput(kernel, 'Asymptote(h)');
    const lines = elements.filter((el): el is GeoLine => el instanceof GeoLine);
    expect(lines).toHaveLength(2);
    const slopes = lines.map(l => +(-l.a / l.b).toFixed(6)).sort((a, b) => a - b);
    expect(slopes).toEqual([-2, 2]);
    // 过原点
    expect(lines.every(l => Math.abs(l.c) < 1e-9)).toBe(true);
  });

  it('Focus, Vertex and Directrix of y² = 2x', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [0, 0, 1, -2, 0, 0], 'p');
    const [focus] = outputsOf(kernel, 'Focus(p)', GeoPoint);
    expect(focus.getX()).toBeCloseTo(0.5, 9);
    expect(focus.getY()).toBeCloseTo(0, 9);

    const [vertex] = outputsOf(kernel, 'Vertex(p)', GeoPoint);
    expect(vertex.getX()).toBeCloseTo(0, 9);
    expect(vertex.getY()).toBeCloseTo(0, 9);

    // 准线 x = −0.5（法向取 axis 方向 (−1,0)，符号等价）
    const [directrix] = outputsOf(kernel, 'Directrix(p)', GeoLine);
    expect(Math.abs(directrix.a)).toBeCloseTo(1, 9);
    expect(Math.abs(directrix.b)).toBeCloseTo(0, 9);
    expect(directrix.a * -0.5 + directrix.c).toBeCloseTo(0, 9); // (−0.5, 0) 在准线上

    const [param] = outputsOf(kernel, 'Parameter(p)', GeoNumeric);
    expect(param.getValue()).toBeCloseTo(1, 9);
  });

  it('follows the conic when it moves', () => {
    const kernel = makeKernel();
    const circle = addLabeledConic(kernel, [1, 0, 1, 0, 0, -4], 'c'); // r=2 at origin
    const [radius] = outputsOf(kernel, 'Radius(c)', GeoNumeric);
    expect(radius.getValue()).toBeCloseTo(2, 9);
    circle.coeffs = [1, 0, 1, -6, 0, -2]; // (x−3)²+y²=11 → r=√11
    c(kernel).updateAllAlgorithms();
    expect(radius.getValue()).toBeCloseTo(Math.sqrt(11), 9);
  });

  it('Polar of (3,0) w.r.t. the unit circle is x = 1/3', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [1, 0, 1, 0, 0, -1], 'c');
    addInput(kernel, 'T = (3, 0)');
    const [line] = outputsOf(kernel, 'Polar(T, c)', GeoLine);
    expect(line.a).toBeCloseTo(3, 9);
    expect(line.c).toBeCloseTo(-1, 9);
  });
});

describe('B2: relation commands (numeric true/false)', () => {
  it('AreCollinear distinguishes collinear from non-collinear points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 1)');
    addInput(kernel, 'C = (2, 2)');
    addInput(kernel, 'D = (2, 3)');
    const [yes] = outputsOf(kernel, 'AreCollinear(A, B, C)', GeoNumeric);
    const [no] = outputsOf(kernel, 'AreCollinear(A, B, D)', GeoNumeric);
    expect(yes.getValue()).toBe(1);
    expect(no.getValue()).toBe(0);
  });

  it('AreParallel / ArePerpendicular on lines', () => {
    const kernel = makeKernel();
    const A = makePoint(kernel, 0, 0, 'A');
    const B = makePoint(kernel, 1, 0, 'B');
    const C = makePoint(kernel, 0, 1, 'C');
    const l = addLabeledLine(kernel, A, B, 'l'); // 水平
    const n = addLabeledLine(kernel, A, C, 'n'); // 垂直
    void l; void n;
    const [par] = outputsOf(kernel, 'AreParallel(l, n)', GeoNumeric);
    expect(par.getValue()).toBe(0);
    const [perp] = outputsOf(kernel, 'ArePerpendicular(l, n)', GeoNumeric);
    expect(perp.getValue()).toBe(1);
  });

  it('AreConcyclic on four points of a circle', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0)');
    addInput(kernel, 'B = (0, 1)');
    addInput(kernel, 'C = (-1, 0)');
    addInput(kernel, 'D = (0, -1)');
    addInput(kernel, 'E = (0.5, 0.5)');
    const [yes] = outputsOf(kernel, 'AreConcyclic(A, B, C, D)', GeoNumeric);
    const [no] = outputsOf(kernel, 'AreConcyclic(A, B, C, E)', GeoNumeric);
    expect(yes.getValue()).toBe(1);
    expect(no.getValue()).toBe(0);
  });

  it('IsTangent distinguishes a tangent line from a secant', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [1, 0, 1, 0, 0, -1], 'c');
    const P = makePoint(kernel, 1, 0, 'P');
    const Q = makePoint(kernel, 2, 0, 'Q');
    const R = makePoint(kernel, 1, 1, 'R');
    const t1 = addLabeledLine(kernel, P, R, 't1');  // x=1 与单位圆相切
    const sec = addLabeledLine(kernel, P, Q, 'sec'); // y=0 割线
    const outside = addLabeledLine(kernel, Q, R, 'out'); // x=2 不相交
    void t1; void sec; void outside;
    const [tan] = outputsOf(kernel, 'IsTangent(t1, c)', GeoNumeric);
    expect(tan.getValue()).toBe(1);
    const [notTan] = outputsOf(kernel, 'IsTangent(sec, c)', GeoNumeric);
    expect(notTan.getValue()).toBe(0);
    const [missing] = outputsOf(kernel, 'IsTangent(out, c)', GeoNumeric);
    expect(missing.getValue()).toBe(0);
  });
});

describe('B3: triangle centers', () => {
  it('Centroid, Orthocenter of a right triangle and Circumcircle', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (4, 0)');
    addInput(kernel, 'C = (0, 3)');
    const [centroid] = outputsOf(kernel, 'Centroid(A, B, C)', GeoPoint);
    expect(centroid.getX()).toBeCloseTo(4 / 3, 9);
    expect(centroid.getY()).toBeCloseTo(1, 9);

    const [ortho] = outputsOf(kernel, 'Orthocenter(A, B, C)', GeoPoint);
    expect(ortho.getX()).toBeCloseTo(0, 9);
    expect(ortho.getY()).toBeCloseTo(0, 9); // 直角顶点即垂心

    const [circumcircle] = outputsOf(kernel, 'Circumcircle(A, B, C)', GeoConic);
    expect(circumcircle.isCircle()).toBe(true);
    const center = circumcircle.getCenter();
    expect(center.x).toBeCloseTo(2, 9);
    expect(center.y).toBeCloseTo(1.5, 9);
    expect(circumcircle.getRadius()).toBeCloseTo(2.5, 9);
  });

  it('Incenter and Incircle of the 3-4-5 triangle', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (4, 0)');
    addInput(kernel, 'C = (0, 3)');
    const [incenter] = outputsOf(kernel, 'Incenter(A, B, C)', GeoPoint);
    expect(incenter.getX()).toBeCloseTo(1, 9);
    expect(incenter.getY()).toBeCloseTo(1, 9);

    const [incircle] = outputsOf(kernel, 'Incircle(A, B, C)', GeoConic);
    expect(incircle.getRadius()).toBeCloseTo(1, 9); // r = (3+4−5)/2
    const center = incircle.getCenter();
    expect(center.x).toBeCloseTo(1, 9);
    expect(center.y).toBeCloseTo(1, 9);
  });
});

describe('B11: TaylorSeries', () => {
  it('expands sin(x) at 0 to order 5', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = sin(x)');
    const [taylor] = outputsOf(kernel, 'TaylorSeries(f, 5)', GeoFunction);
    const target = Math.sin(0.5);
    expect(taylor.evaluateAt(0.5)).toBeCloseTo(target, 4); // 截断误差 O(0.5^7)
  });

  it('expands around a non-zero center and picks up slider values', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 3');
    addInput(kernel, 'g(x) = a*x^2');
    // 官方参数序 TaylorSeries(f, a, n)：a=展开点、n=阶数（此前 Mini 序相反）
    const [taylor] = outputsOf(kernel, 'TaylorSeries(g, 1, 2)', GeoFunction);
    // g(x)=3x² 在 x=1 的 2 阶泰勒：3 + 6(x−1) + 3(x−1)² = 3x²（精确）
    expect(taylor.evaluateAt(2)).toBeCloseTo(12, 9);
    expect(taylor.evaluateAt(-1)).toBeCloseTo(3, 9);
  });

  it('3-arg form follows the official argument order (f, a, n)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = sin(x)');
    // sin 在 x=1 处的 3 阶泰勒
    const [taylor] = outputsOf(kernel, 'TaylorSeries(f, 1, 3)', GeoFunction);
    const expected = (x: number) =>
      Math.sin(1) + Math.cos(1) * (x - 1) - Math.sin(1) * (x - 1) ** 2 / 2 - Math.cos(1) * (x - 1) ** 3 / 6;
    expect(taylor.evaluateAt(1.4)).toBeCloseTo(expected(1.4), 6);
  });
});

describe('serialization of new algorithm types', () => {
  it('round-trips an AlgoConicFocus', () => {
    const kernel = makeKernel();
    addLabeledConic(kernel, [1, 0, 4, 0, 0, -4], 'e');
    addInput(kernel, 'Focus(e)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    // 恢复后的构造里只有两个焦点（圆锥曲线 + 算法输出）
    const foci = restored.getConstruction().getElements()
      .filter(el => el instanceof GeoPoint && el.isDefined()) as GeoPoint[];
    const xs = foci.map(f => +f.getX().toFixed(6)).sort((a, b) => a - b);
    expect(xs).toEqual([-Math.sqrt(3), Math.sqrt(3)].map(v => +v.toFixed(6)));
  });
});
