import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoNet3D, AlgoPolyhedronNet } from '../kernel/algo/AlgoPolyhedronNet';
import { GeoPolyhedron3D } from '../kernel/algo/AlgoPolyhedron3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { Coords4 } from '../kernel/core/Coords4';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  return elements;
};

const outputsOf = <T>(kernel: Kernel, text: string, type: new (...args: any[]) => T): T[] =>
  addInput(kernel, text).filter(el => el instanceof (type as any)) as T[];

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

describe('Net: polyhedron unfold', () => {
  it('unfolds a pyramid: area is conserved and all faces become coplanar', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (0, 0, 2)');
    const pyramid = ofType(kernel, GeoPolyhedron3D)[0];
    addInput(kernel, `Pyramid3D(A, B, C, T)`);
    const py = ofType(kernel, GeoPolyhedron3D)[0];
    const [net] = outputsOf(kernel, `Net(${py.label})`, GeoNet3D);
    expect(net.faces.length).toBe(4); // 底面 + 3 侧面
    // 面积守恒：展开图面积 = 各面面积之和
    const polyArea = py.vertices.length >= 4 ? sideArea(py) : 0;
    expect(net.area()).toBeCloseTo(polyArea, 6);
    // 展开后所有面共面
    expect(net.isCoplanar()).toBe(true);
  });

  it('unfolded side keeps edge lengths from the apex', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (0, 0, 2)');
    addInput(kernel, 'Pyramid3D(A, B, C, T)');
    const py = ofType(kernel, GeoPolyhedron3D)[0];
    const [net] = outputsOf(kernel, `Net(${py.label})`, GeoNet3D);
    // 第一个侧面 [A, B, T']：|T'A| = |TA|, |T'B| = |TB|
    const face = net.faces[1];
    const a = face[0], b = face[1], tp = face[2];
    const apex = py.vertices[3];
    expect(tp.distanceTo(a)).toBeCloseTo(apex.distanceTo(a), 6);
    expect(tp.distanceTo(b)).toBeCloseTo(apex.distanceTo(b), 6);
  });

  it('unfolds a prism: 底面 + 3 侧面 + 顶面，共面且面积守恒', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'Prism3D(A, B, C, 3)');
    const py = ofType(kernel, GeoPolyhedron3D)[0];
    const [net] = outputsOf(kernel, `Net(${py.label})`, GeoNet3D);
    expect(net.faces.length).toBe(5); // 底 + 3 侧 + 顶
    expect(net.area()).toBeCloseTo(sideArea(py), 6);
    expect(net.isCoplanar()).toBe(true);
  });
});

/** 多面体各面面积之和（底面 + 侧面 + 顶面，作为表面积参考）。 */
function sideArea(py: GeoPolyhedron3D): number {
  const v = py.vertices;
  if (v.length < 4) return 0;
  const n = py.baseCount();
  const base = v.slice(0, n);
  let sum = polyArea3D(base);
  if (py.kind === 'prism') {
    const top = v.slice(n);
    sum += polyArea3D(top);
    for (let i = 0; i < n; i++) {
      sum += polyArea3D([base[i], base[(i + 1) % n], top[(i + 1) % n], top[i]]);
    }
  } else {
    const apex = v[n];
    for (let i = 0; i < n; i++) {
      sum += polyArea3D([base[i], base[(i + 1) % n], apex]);
    }
  }
  return sum;
}

function polyArea3D(pts: Coords4[]): number {
  if (pts.length < 3) return 0;
  let acc = Coords4.fromDirection(0, 0, 0);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    acc = acc.add(pts[i].asDirection().cross(pts[j].asDirection()));
  }
  return acc.norm() / 2;
}

describe('Rotated ellipsoid basis', () => {
  it('isOnSurface and line intersection work in a rotated frame', () => {
    const kernel = makeKernel();
    const ell = new GeoQuadric3D(kernel, 'ellipsoid');
    // 绕 z 轴旋转 90° 的椭球：半轴 2(沿y), 1(沿x), 3(沿z)
    const basis: [Coords4, Coords4, Coords4] = [
      Coords4.fromDirection(0, 1, 0),
      Coords4.fromDirection(-1, 0, 0),
      Coords4.fromDirection(0, 0, 1),
    ];
    ell.setEllipsoid(Coords4.origin(), 2, 1, 3, basis);
    ell.setDefined();
    // 局部轴端点在曲面上：(0,2,0)、(1,0,0)、(0,0,3)
    expect(ell.isOnSurface(Coords4.fromPoint(0, 2, 0))).toBe(true);
    expect(ell.isOnSurface(Coords4.fromPoint(1, 0, 0))).toBe(true);
    expect(ell.isOnSurface(Coords4.fromPoint(0, 0, 3))).toBe(true);
    expect(ell.isOnSurface(Coords4.fromPoint(2, 0, 0))).toBe(false);
    expect(ell.volume()).toBeCloseTo((4 / 3) * Math.PI * 2 * 1 * 3, 9);

    // 沿世界 x 轴穿过中心的直线：交于 (±1, 0, 0)
    const line = new GeoLine3D(
      kernel, Coords4.fromPoint(-5, 0, 0), Coords4.fromDirection(1, 0, 0));
    const hits = ell.intersectLine(line);
    expect(hits.length).toBe(2);
    expect(Math.abs(hits[0].point.getX())).toBeCloseTo(1, 6);
    expect(Math.abs(hits[1].point.getX())).toBeCloseTo(1, 6);
  });
});
