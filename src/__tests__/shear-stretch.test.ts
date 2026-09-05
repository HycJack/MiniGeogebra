import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint } from './helpers';
import { buildTransformed, shearStretchMatrix } from '../kernel/algo/AlgoRotate';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPolyLine } from '../kernel/geo/GeoPolyLine';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoConicPart, CONIC_PART_SECTOR } from '../kernel/geo/GeoConicPart';

describe('shear and stretch transforms', () => {
  it('shears points parallel to the horizontal axis like GeoGebra', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 1, 2);
    const matrix = shearStretchMatrix(0, 1, 0, 2, 'shear');
    const out = buildTransformed(kernel, p, 'shear', { matrix }) as any;
    expect(out.getX()).toBeCloseTo(5, 6);
    expect(out.getY()).toBeCloseTo(2, 6);
  });

  it('stretches offsets parallel to an anchored horizontal axis', () => {
    const kernel = makeKernel();
    const point = makePoint(kernel, 1, 0);
    const matrix = shearStretchMatrix(0, 1, -2, 3, 'stretch');
    const out = buildTransformed(kernel, point, 'stretch', { matrix }) as any;
    expect(out.getX()).toBeCloseTo(1, 6);
    expect(out.getY()).toBeCloseTo(4, 6);

    const axisPoint = makePoint(kernel, 0, -2);
    const fixed = buildTransformed(kernel, axisPoint, 'stretch', { matrix }) as any;
    expect(fixed.getX()).toBeCloseTo(0, 6);
    expect(fixed.getY()).toBeCloseTo(-2, 6);
  });

  it('maps a circle to a general conic under shear', () => {
    const kernel = makeKernel();
    const circle = new GeoConic(kernel, [1, 0, 1, 0, 0, -4]);
    const matrix = shearStretchMatrix(0, 1, 0, 2, 'shear');
    const out = buildTransformed(kernel, circle, 'shear', { matrix }) as GeoConic;
    expect(out).toBeInstanceOf(GeoConic);
    const expected = [1, -4, 5, 0, 0, -4];
    expected.forEach((value, index) => {
      expect(out.coeffs[index]).toBeCloseTo(value, 6);
    });
    const sample = out.isOnPath(makePoint(kernel, 4, 2));
    expect(sample).toBe(true);
  });

  it('transforms every polyline vertex', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0);
    const b = makePoint(kernel, 1, 1);
    const poly = new GeoPolyLine(kernel, [a, b]);
    const matrix = shearStretchMatrix(0, 1, 0, 2, 'shear');
    const out = buildTransformed(kernel, poly, 'shear', { matrix }) as GeoPolyLine;
    expect(out).toBeInstanceOf(GeoPolyLine);
    expect(out.vertices[0].getX()).toBeCloseTo(0, 6);
    expect(out.vertices[1].getX()).toBeCloseTo(3, 6);
    expect(out.vertices[1].getY()).toBeCloseTo(1, 6);
  });

  it('keeps a limited arc finite instead of stretching the full circle', () => {
    const kernel = makeKernel();
    const arc = new GeoArc(kernel, { x: 0, y: 0 }, 2, 0, Math.PI / 2, false);
    const matrix = shearStretchMatrix(0, 1, 0, 2, 'shear');
    const out = buildTransformed(kernel, arc, 'shear', { matrix }) as GeoPolyLine;
    expect(out).toBeInstanceOf(GeoPolyLine);
    expect(out.vertices.length).toBeGreaterThan(8);
    expect(out.vertices[0].getX()).toBeCloseTo(2, 6);
    expect(out.vertices[0].getY()).toBeCloseTo(0, 6);
    const last = out.vertices[out.vertices.length - 1];
    expect(last.getX()).toBeCloseTo(4, 6);
    expect(last.getY()).toBeCloseTo(2, 6);
  });

  it('keeps a sector region closed around the transformed center', () => {
    const kernel = makeKernel();
    const sector = new GeoConicPart(
      kernel, { x: 0, y: 0 }, 2, 0, Math.PI / 2, CONIC_PART_SECTOR, true,
    );
    const matrix = shearStretchMatrix(0, 1, 0, 2, 'shear');
    const out = buildTransformed(kernel, sector, 'shear', { matrix }) as GeoPolygon;
    expect(out).toBeInstanceOf(GeoPolygon);
    expect(out.vertices.length).toBeGreaterThan(8);
    const center = out.vertices[out.vertices.length - 1];
    expect(center.getX()).toBeCloseTo(0, 6);
    expect(center.getY()).toBeCloseTo(0, 6);
  });

  it('rejects a zero-length axis instead of creating invalid geometry', () => {
    expect(() => shearStretchMatrix(0, 0, 0, 2, 'shear')).toThrow();
  });
});
