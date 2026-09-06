import { describe, expect, it } from 'vitest';
import { GeoFunction, DEFAULT_VIEW_HEIGHT } from '../kernel/geo/GeoFunction';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { makeKernel } from './helpers';

/** 直接构造函数对象（不走代数输入），便于隔离测试采样行为。 */
const makeFn = (text: string, variableName = 'x') =>
  new GeoFunction(makeKernel(), parseExpression(text), variableName, text);

const baseCount = (pixelWidth: number) =>
  Math.max(64, Math.min(1200, Math.ceil(pixelWidth / 2))) + 1;

describe('GeoFunction adaptive sampling', () => {
  it('keeps the interval endpoints as the first and last samples', () => {
    const fn = makeFn('1/(x-2)');
    const samples = fn.updateSamples(0, 4, 100);
    expect(samples[0].x).toBe(0);
    expect(samples[0].y).toBeCloseTo(-0.5, 8);
    expect(samples[samples.length - 1].x).toBe(4);
    expect(samples[samples.length - 1].y).toBeCloseTo(0.5, 8);
  });

  it('emits NaN only where the function is genuinely undefined', () => {
    const fn = makeFn('sqrt(x)');
    const samples = fn.updateSamples(-2, 2, 100);

    const negativeSide = samples.filter(sample => sample.x < 0);
    const positiveSide = samples.filter(sample => sample.x > 0);
    expect(negativeSide.length).toBeGreaterThan(0);
    expect(negativeSide.every(sample => Number.isNaN(sample.y))).toBe(true);
    expect(positiveSide.every(sample => Number.isFinite(sample.y))).toBe(true);
  });

  it('refines high-curvature regions instead of relying on uniform spacing', () => {
    const fn = makeFn('tan(x)');
    const samples = fn.updateSamples(-3, 3, 100);
    // 基础采样 65 点；自适应细分必须在渐近线附近加密
    expect(samples.length).toBeGreaterThan(baseCount(100));
  });

  it('does not over-refine a linear function', () => {
    const fn = makeFn('2x + 1');
    const samples = fn.updateSamples(-5, 5, 100);
    expect(samples.length).toBe(baseCount(100));
    // 线性函数无断点：唯一一次过零点不应被误判为渐近线
    expect(samples.every(sample => Number.isFinite(sample.y))).toBe(true);
  });

  it('breaks the path at a vertical asymptote not aligned with the sample grid', () => {
    const fn = makeFn('1/(x-2.13)');
    const samples = fn.updateSamples(0, 4.5, 100);

    const nanIndex = samples.findIndex(sample => Number.isNaN(sample.y));
    expect(nanIndex).toBeGreaterThan(0);

    const left = samples.slice(0, nanIndex).filter(sample => Number.isFinite(sample.y)).pop()!;
    const right = samples.slice(nanIndex + 1).find(sample => Number.isFinite(sample.y))!;
    expect(left.y).toBeLessThan(0);
    expect(right.y).toBeGreaterThan(0);
  });

  it('does not insert spurious gaps at ordinary zero crossings', () => {
    for (const text of ['sin(x)', '2x^2 - 2']) {
      const fn = makeFn(text);
      const samples = fn.updateSamples(-3.5, 3.5, 400);
      expect(samples.some(sample => Number.isNaN(sample.y))).toBe(false);
    }
  });

  it('preserves finite values instead of clamping them to an arbitrary range', () => {
    const fn = makeFn('x^10');
    const samples = fn.updateSamples(0, 4, 200);

    const atEnd = samples[samples.length - 1];
    expect(atEnd.x).toBeCloseTo(4, 9);
    expect(atEnd.y).toBeGreaterThan(1e6);
    expect(Number.isFinite(atEnd.y)).toBe(true);
  });

  it('reuses cached samples for identical arguments and invalidates on change', () => {
    const fn = makeFn('x^2');
    const first = fn.updateSamples(0, 4, 100);
    expect(fn.updateSamples(0, 4, 100)).toBe(first);
    expect(fn.updateSamples(0, 4, 400)).not.toBe(first);
    expect(fn.updateSamples(0, 4, 100, { minY: -100, maxY: 100 })).not.toBe(first);
  });

  it('lets the visible height drive asymptote detection', () => {
    const fn = makeFn('1/(x-2.13)');
    const tightView = fn.updateSamples(0, 4.5, 100, { minY: -1, maxY: 1 });
    const wideView = fn.updateSamples(0, 4.5, 100, { minY: -100000, maxY: 100000 });

    // 紧视图：峰值远超视高 → 插入断点
    expect(tightView.some(sample => Number.isNaN(sample.y))).toBe(true);
    // 极宽视图：同样的高度在屏幕上不足 1 像素，不应断开曲线
    expect(wideView.some(sample => Number.isNaN(sample.y))).toBe(false);
  });

  it('handles a degenerate zero-width range', () => {
    const fn = makeFn('x^2 + 1');
    const samples = fn.updateSamples(3, 3, 100);
    expect(samples).toEqual([{ x: 3, y: 10 }]);
  });

  it('honours the pixel width for the base sampling density', () => {
    expect(makeFn('2x + 1').updateSamples(-30, 30, 200).length).toBe(baseCount(200));
    expect(makeFn('2x + 1').updateSamples(-30, 30, 2400).length).toBe(baseCount(2400));
  });

  it('keeps the adaptive sample budget bounded even near many asymptotes', () => {
    const dense = makeFn('tan(x)').updateSamples(-30, 30, 2400);
    expect(dense.length).toBeGreaterThan(baseCount(2400));
    // 基础 1201 点 + 细分预算 4096 + 断点标记，必须远小于无上限的 2^4 全展开
    expect(dense.length).toBeLessThan(6000);
  });

  it('exposes the last sampling and a default view height for callers', () => {
    const fn = makeFn('3x');
    expect(fn.getSamples()).toHaveLength(0);
    const samples = fn.updateSamples(-1, 1, 100);
    expect(fn.getSamples()).toBe(samples);
    expect(DEFAULT_VIEW_HEIGHT).toBeGreaterThan(0);
  });
});
