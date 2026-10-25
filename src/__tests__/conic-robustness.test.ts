import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const conicOf = (k: Kernel): GeoConic => {
  const c = k.getConstruction().getElements().find(e => e instanceof GeoConic);
  if (!c) throw new Error('no conic');
  return c as GeoConic;
};

const definedPoints = (els: ConstructionElement[]): GeoPoint[] =>
  els.filter((e): e is GeoPoint => e instanceof GeoPoint && e.isDefined());

const addConic = (k: Kernel, coeffs: number[], label: string): GeoConic => {
  const c = new GeoConic(k, coeffs);
  (c as any).label = label;
  k.getConstruction().addElement(c);
  k.getConstruction().updateAllAlgorithms();
  return c;
};

describe('conic 退化判定稳健性与属性命令输出（回归）', () => {
  it('far circle is not degenerate', () => {
    const k = new Kernel();
    addInput(k, 'A = (5000, 0)');
    addInput(k, 'Circle(A, 10)');
    expect(conicOf(k).getConicType()).toBe('circle');
  });

  it('big radius circle at origin not degenerate', () => {
    const k = new Kernel();
    addInput(k, 'Circle((0,0), 1001)');
    expect(conicOf(k).getConicType()).toBe('circle');
  });

  it('Focus(circle) yields exactly one defined point', () => {
    const k = new Kernel();
    addInput(k, 'A = (300, 0)');
    addInput(k, 'Circle(A, 10)');
    const label = conicOf(k).label;
    const res = addInput(k, `Focus(${label})`);
    const pts = definedPoints(res);
    expect(pts.length).toBe(1);
    expect(pts[0].getX()).toBeCloseTo(300);
    expect(pts[0].getY()).toBeCloseTo(0);
  });

  it('Vertex(parabola) 只有一个 defined 输出（幻影回归）', () => {
    const k = new Kernel();
    const c = addConic(k, [0, 0, 1, -4, 0, -4], 'pq'); // y² − 4x − 4 = 0，顶点 (−1,0)
    expect(c.getConicType()).toBe('parabola');
    const res = addInput(k, 'Vertex(pq)');
    const pts = definedPoints(res);
    expect(pts.length).toBe(1);
    expect(pts[0].getX()).toBeCloseTo(-1);
    expect(pts[0].getY()).toBeCloseTo(0);
  });

  it('Directrix(parabola) single defined line', () => {
    const k = new Kernel();
    addConic(k, [0, 0, 1, -4, 0, -4], 'pq');
    const res = addInput(k, 'Directrix(pq)');
    const lines = res.filter((e): e is GeoLine => e instanceof GeoLine && e.isDefined());
    expect(lines.length).toBe(1);
  });

  it('degenerate crossing lines still detected', () => {
    const k = new Kernel();
    const c = new GeoConic(k, [1, 0, -1, 0, 0, 0]);
    expect(c.getConicType()).toBe('degenerate');
  });

  it('parallel lines y²=1 detected degenerate', () => {
    const k = new Kernel();
    const c = new GeoConic(k, [0, 0, 1, 0, 0, -1]);
    expect(c.getConicType()).toBe('degenerate');
  });

  it('ellipse far from origin still analyzed with two foci', () => {
    const k = new Kernel();
    // (x−5000)²/4 + y² = 1 → x²/4 − 2500x + y² + (6.25e6 − 1) = 0
    const c = addConic(k, [0.25, 0, 1, -2500, 0, 6250000 - 1], 'ce');
    expect(c.getConicType()).toBe('ellipse');
    const res = addInput(k, 'Focus(ce)');
    expect(definedPoints(res).length).toBe(2);
  });

  it('parabola far from origin analyzed', () => {
    const k = new Kernel();
    // y² = 4(x−3000) → y² − 4x + 12000 = 0
    const c = addConic(k, [0, 0, 1, -4, 0, 12000], 'cf');
    expect(c.getConicType()).toBe('parabola');
    const v = c.getVertex();
    expect(v.x).toBeCloseTo(3000, 4);
    expect(v.y).toBeCloseTo(0, 6);
  });
});
