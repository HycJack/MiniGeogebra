import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoPolyhedron3D, AlgoPrism3D, AlgoPyramid3D } from '../kernel/algo/AlgoPolyhedron3D';
import { AlgoTransformPolyhedron3D } from '../kernel/algo/AlgoTransformGeo3D';
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

describe('C4a: oblique prism (斜棱柱)', () => {
  it('Prism3D(P1..Pn, Q) extrudes all base points by base0→Q', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (1, 0, 3)');
    const [prism] = outputsOf(kernel, 'Prism3D(A, B, C, T)', GeoPolyhedron3D);

    expect(prism.kind).toBe('prism');
    expect(prism.baseCount()).toBe(3);
    expect(prism.vertices).toHaveLength(6);
    // 斜移向量 = T − A = (1,0,3)，三个顶面点 = 底面 + t
    const t = { x: 1, y: 0, z: 3 };
    for (let i = 0; i < 3; i++) {
      const b = prism.baseVertices()[i];
      const top = prism.topVertices()[i];
      expect(top.getX()).toBeCloseTo(b.getX() + t.x, 9);
      expect(top.getY()).toBeCloseTo(b.getY() + t.y, 9);
      expect(top.getZ()).toBeCloseTo(b.getZ() + t.z, 9);
    }
    // 顶面参考点本身在棱柱上
    expect(prism.topVertices()[0].getX()).toBeCloseTo(1, 9);
    expect(prism.topVertices()[0].getZ()).toBeCloseTo(3, 9);
  });

  it('volume uses perpendicular height, not slant length', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (1, 0, 3)');
    const [prism] = outputsOf(kernel, 'Prism3D(A, B, C, T)', GeoPolyhedron3D);
    // 底面积 2，垂直高 = |(1,0,3)·(0,0,1)| = 3 → V = 6（斜长 √10 不参与）
    expect(prism.baseArea()).toBeCloseTo(2, 9);
    expect(prism.height()).toBeCloseTo(3, 9);
    expect(prism.volume()).toBeCloseTo(6, 9);

    const [v] = outputsOf(kernel, `Volume3D(${prism.label})`, GeoNumeric);
    expect(v.getValue()).toBeCloseTo(6, 9);
  });

  it('updates live when the top reference point moves', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (1, 0, 3)');
    addInput(kernel, 'Prism3D(A, B, C, T)');
    const prism = ofType(kernel, GeoPolyhedron3D)[0];
    const top = ofType(kernel, GeoPoint3D).find(p => p.label === 'T')!;
    top.setCoords(2, 1, 5);
    top.update();
    kernel.flushNow();
    expect(prism.topVertices()[0].getX()).toBeCloseTo(2, 9);
    expect(prism.topVertices()[0].getZ()).toBeCloseTo(5, 9);
    expect(prism.height()).toBeCloseTo(5, 9);
  });

  it('straight Prism3D(base, height) still extrudes along the base normal', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    const [prism] = outputsOf(kernel, 'Prism3D(A, B, C, 4)', GeoPolyhedron3D);
    expect(prism.height()).toBeCloseTo(4, 9);
    expect(prism.topVertices()[0].getX()).toBeCloseTo(0, 9);
    expect(prism.topVertices()[0].getZ()).toBeCloseTo(4, 9);
    expect(prism.volume()).toBeCloseTo(8, 9);
    const algo = ofType(kernel, AlgoPrism3D)[0];
    expect(algo.isOblique()).toBe(false);
    expect(algo.getHeight()).toBe(4);
  });
});

describe('C4a: arbitrary n-gon bases', () => {
  it('Prism3D with a square base builds an 8-vertex prism', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (2, 2, 0)');
    addInput(kernel, 'D = (0, 2, 0)');
    const [prism] = outputsOf(kernel, 'Prism3D(A, B, C, D, 3)', GeoPolyhedron3D);
    expect(prism.baseCount()).toBe(4);
    expect(prism.vertices).toHaveLength(8);
    expect(prism.baseArea()).toBeCloseTo(4, 9);
    expect(prism.volume()).toBeCloseTo(12, 9);
  });

  it('Pyramid3D with a square base builds a 5-vertex pyramid', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (2, 2, 0)');
    addInput(kernel, 'D = (0, 2, 0)');
    addInput(kernel, 'T = (1, 1, 3)');
    const [pyramid] = outputsOf(kernel, 'Pyramid3D(A, B, C, D, T)', GeoPolyhedron3D);
    expect(pyramid.kind).toBe('pyramid');
    expect(pyramid.baseCount()).toBe(4);
    expect(pyramid.vertices).toHaveLength(5);
    // V = 4×3/3 = 4
    expect(pyramid.volume()).toBeCloseTo(4, 9);
    const algo = ofType(kernel, AlgoPyramid3D)[0];
    expect(algo.getOutput()).toBe(pyramid);
  });
});

describe('C4a: persistence & transform', () => {
  it('round-trips oblique and n-gon prisms/pyramids', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (2, 2, 0)');
    addInput(kernel, 'D = (0, 2, 0)');
    addInput(kernel, 'T = (1, 0, 3)');
    addInput(kernel, 'Apex = (1, 1, 4)');
    addInput(kernel, 'Prism3D(A, B, C, T)');       // 斜三棱柱
    addInput(kernel, 'Prism3D(A, B, C, D, 2)');    // 直四棱柱
    addInput(kernel, 'Pyramid3D(A, B, C, D, Apex)'); // 四棱锥

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const polys = ofType(restored, GeoPolyhedron3D);
    expect(polys).toHaveLength(3);

    const oblique = polys.find(p => p.kind === 'prism' && p.baseCount() === 3)!;
    expect(oblique).toBeDefined();
    expect(oblique.topVertices()[0].getX()).toBeCloseTo(1, 6);
    expect(oblique.topVertices()[0].getZ()).toBeCloseTo(3, 6);
    expect(oblique.volume()).toBeCloseTo(6, 6);

    const straight = polys.find(p => p.kind === 'prism' && p.baseCount() === 4)!;
    expect(straight).toBeDefined();
    // 底面积 4 × 高 2 = 8
    expect(straight.volume()).toBeCloseTo(8, 6);

    const pyramid = polys.find(p => p.kind === 'pyramid')!;
    expect(pyramid).toBeDefined();
    // 底面积 4 × 高 4 / 3 = 16/3（Apex=(1,1,4)）
    expect(pyramid.volume()).toBeCloseTo(16 / 3, 6);
  });

  it('rigid transform preserves an oblique prism’s slant', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (1, 0, 3)');
    addInput(kernel, 'Prism3D(A, B, C, T)');
    const source = ofType(kernel, GeoPolyhedron3D)[0];
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Z2 = (0, 0, 1)');
    addInput(kernel, 'zAxis = Line3D(O, Z2)');
    // Rotate3D(源, 轴, 角度) —— 命令会经识别器建 AlgoTransformPolyhedron3D
    addInput(kernel, `Rotate3D(${source.label}, zAxis, 90)`);
    const rotated = ofType(kernel, GeoPolyhedron3D).find(p => p !== source)!;
    expect(rotated).toBeDefined();
    expect(rotated.baseCount()).toBe(3);
    // 垂直高在绕 z 旋转下不变；斜长也应保持 √10
    expect(rotated.height()).toBeCloseTo(3, 6);
    expect(rotated.volume()).toBeCloseTo(6, 6);
    expect(ofType(kernel, AlgoTransformPolyhedron3D).length).toBeGreaterThanOrEqual(1);
  });
});
