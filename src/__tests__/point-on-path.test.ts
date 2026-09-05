import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint } from './helpers';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { AlgoPolyLine } from '../kernel/algo/AlgoPolyLine';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { AnimationType } from '../kernel/geo/GeoNumeric';
import { createParameterPointOnPath } from '../components/tools/createElements';

describe('point on path', () => {
  it('creates a constrained point without starting its animation', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    const segmentAlgo = new AlgoSegmentTwoPoints(kernel, a, b);
    kernel.getConstruction().addElement(segmentAlgo);
    kernel.getConstruction().addElement(segmentAlgo.getOutput());

    const created = createParameterPointOnPath(kernel, segmentAlgo.getOutput(), 1, 0);

    expect(created).not.toBeNull();
    expect(created!.param.label).toBe('t1');
    expect(created!.param.isAnimating()).toBe(false);
    expect(created!.point.parentAlgo).not.toBeNull();
    expect(created!.point.getX()).toBeCloseTo(1, 8);
    expect(created!.point.getY()).toBeCloseTo(0, 8);
  });

  it('animates a constrained point through its path parameter', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 4, 0, 'B');
    const segmentAlgo = new AlgoSegmentTwoPoints(kernel, a, b);
    kernel.getConstruction().addElement(segmentAlgo);
    kernel.getConstruction().addElement(segmentAlgo.getOutput());

    const created = createParameterPointOnPath(kernel, segmentAlgo.getOutput(), 1, 0)!;
    created.param.setValue(0.25);
    expect(created.point.getX()).toBeCloseTo(1, 8);

    created.param.animationType = AnimationType.INCREASING;
    created.param.animationSpeed = 10;
    created.param.animationIncrement = 0;
    created.param.setAnimating(true);
    created.param.doAnimationStep(10);
    kernel.recomputeDependents(created.param);

    expect(created.param.getValue()).toBeCloseTo(0.35, 8);
    expect(created.point.getX()).toBeCloseTo(1.4, 8);
  });

  it('projects clicks to the closest edge of a polyline', () => {
    const kernel = makeKernel();
    const points = [
      makePoint(kernel, 0, 0, 'A'),
      makePoint(kernel, 2, 0, 'B'),
      makePoint(kernel, 2, 2, 'C'),
    ];
    const polyAlgo = new AlgoPolyLine(kernel, points);
    kernel.getConstruction().addElement(polyAlgo);
    kernel.getConstruction().addElement(polyAlgo.getOutput());

    const created = createParameterPointOnPath(kernel, polyAlgo.getOutput(), 1.5, 1.5)!;

    expect(created.param.intervalMin).toBe(0);
    expect(created.param.intervalMax).toBe(2);
    expect(created.param.getValue()).toBeCloseTo(1.75, 8);
    expect(created.point.getX()).toBeCloseTo(2, 8);
    expect(created.point.getY()).toBeCloseTo(1.5, 8);
    expect(created.point).toBeInstanceOf(GeoPoint);
    expect(created.param).toBeInstanceOf(GeoNumeric);
  });
});
