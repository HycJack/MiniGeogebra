import { describe, it, expect } from 'vitest';
import { makeKernel } from './helpers';
import { GeoNumeric, AnimationType } from '../kernel/geo/GeoNumeric';

describe('GeoNumeric animation modes', () => {
  it('uses oscillating by default and reverses at the interval boundary', () => {
    const numeric = new GeoNumeric(makeKernel(), 0.9);
    numeric.intervalMin = 0;
    numeric.intervalMax = 1;
    numeric.animationIncrement = 0;
    numeric.animationSpeed = 10;
    expect(numeric.animationType).toBe(AnimationType.OSCILLATING);

    expect(numeric.doAnimationStep(10)).toBe(true);
    expect(numeric.getValue()).toBeCloseTo(1, 8);
    expect(numeric.doAnimationStep(10)).toBe(true);
    expect(numeric.getValue()).toBeCloseTo(0.9, 8);
  });

  it('increasing animation wraps around the interval', () => {
    const numeric = new GeoNumeric(makeKernel(), 0.95);
    numeric.intervalMin = 0;
    numeric.intervalMax = 1;
    numeric.animationIncrement = 0;
    numeric.animationSpeed = 10;
    numeric.setAnimationType(AnimationType.INCREASING);

    numeric.doAnimationStep(10);
    expect(numeric.getValue()).toBeCloseTo(0.05, 8);
  });

  it('decreasing animation moves backward and wraps', () => {
    const numeric = new GeoNumeric(makeKernel(), 0.05);
    numeric.intervalMin = 0;
    numeric.intervalMax = 1;
    numeric.animationIncrement = 0;
    numeric.animationSpeed = 10;
    numeric.setAnimationType(AnimationType.DECREASING);

    numeric.doAnimationStep(10);
    expect(numeric.getValue()).toBeCloseTo(0.95, 8);
  });

  it('increasing once stops at the upper boundary', () => {
    const numeric = new GeoNumeric(makeKernel(), 0.9);
    numeric.intervalMin = 0;
    numeric.intervalMax = 1;
    numeric.animationIncrement = 0;
    numeric.animationSpeed = 10;
    numeric.setAnimationType(AnimationType.INCREASING_ONCE);
    numeric.setAnimating(true);

    expect(numeric.doAnimationStep(10)).toBe(true);
    expect(numeric.getValue()).toBeCloseTo(1, 8);
    expect(numeric.isAnimating()).toBe(false);
    expect(numeric.doAnimationStep(10)).toBe(false);
    expect(numeric.getValue()).toBeCloseTo(1, 8);
  });
});
