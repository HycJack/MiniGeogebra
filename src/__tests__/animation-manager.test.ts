import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeKernel } from './helpers';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { AnimationType } from '../kernel/geo/GeoNumeric';

describe('AnimationManager', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  it('stopAllAnimation pauses and restores each animated value', () => {
    const kernel = makeKernel();
    const manager = kernel.getAnimationManager();
    const numeric = new GeoNumeric(kernel, 0.25);
    numeric.intervalMin = 0;
    numeric.intervalMax = 1;
    numeric.animationType = AnimationType.INCREASING;
    numeric.animationIncrement = 0;
    numeric.animationSpeed = 10;
    kernel.getConstruction().addElement(numeric);
    numeric.setAnimating(true);

    expect(numeric.isAnimating()).toBe(true);
    numeric.doAnimationStep(10);
    kernel.recomputeDependents(numeric);

    manager.stopAllAnimation();
    expect(numeric.isAnimating()).toBe(false);
    expect(numeric.getValue()).toBeCloseTo(0.25, 8);
    expect(manager.isRunning()).toBe(false);
  });
});
