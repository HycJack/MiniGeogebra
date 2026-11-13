/**
 * L6-5 全路径匀速动画回归：线段/函数路径点的 advancePathAnimation 走弧长归一
 * （此前仅圆锥曲线接入，线段等参数线性步进）。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';

const addInput = (kernel: ReturnType<typeof makeKernel>, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const findAlgo = (kernel: ReturnType<typeof makeKernel>, clsName: string) =>
  kernel.getConstruction().getElements().find(el => el.constructor.name === clsName) as unknown as {
    advancePathAnimation(frameRate: number): boolean;
    getOutput(): GeoPoint;
  };

describe('L6-5 全路径匀速动画', () => {
  it('线段路径点：匀速推进（每帧位移近似恒定）', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 10, 0, 'B');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'P = PointOn(s)');
    const algo = findAlgo(k, 'AlgoPointOnSegment');
    expect(algo).toBeDefined();
    const pt = algo.getOutput();
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      algo.advancePathAnimation(60);
      k.getConstruction().updateAllAlgorithms();
      positions.push({ x: pt.getX(), y: pt.getY() });
    }
    const steps = positions.slice(1).map((p, i) => Math.hypot(p.x - positions[i].x, p.y - positions[i].y));
    expect(steps.every(d => d > 1e-6)).toBe(true);
    const ratio = Math.max(...steps) / Math.min(...steps);
    expect(ratio).toBeLessThan(3);
  });

  it('函数路径点：匀速推进不越定义域', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'Q = PointOn(f)');
    const algo = findAlgo(k, 'AlgoPointOnFunction');
    expect(algo).toBeDefined();
    const pt = algo.getOutput();
    for (let i = 0; i < 30; i++) {
      algo.advancePathAnimation(60);
      k.getConstruction().updateAllAlgorithms();
      expect(pt.isDefined()).toBe(true);
    }
  });
});
