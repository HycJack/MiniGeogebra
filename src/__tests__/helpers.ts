import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoVec3D } from '../kernel/core/GeoVec3D';

/** Create a minimal Kernel with Construction for testing. */
export function makeKernel(): Kernel {
  return new Kernel();
}

/** Create a free point at (x, y) and add it to the construction. */
export function makePoint(kernel: Kernel, x: number, y: number, label?: string): GeoPoint {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
  if (label) p.label = label;
  kernel.getConstruction().addElement(p);
  return p;
}

/** Create a GeoLine from ax + by + c = 0. */
export function makeLine(kernel: Kernel, a: number, b: number, c: number, label?: string): GeoLine {
  const l = new GeoLine(kernel, a, b, c);
  if (label) l.label = label;
  kernel.getConstruction().addElement(l);
  return l;
}

export const EPS = 1e-6;
