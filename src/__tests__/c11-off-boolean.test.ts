import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoPolygonBoolean } from '../kernel/algo/AlgoPolygonBoolean';
import { GeoBooleanRegion } from '../kernel/geo/GeoBooleanRegion';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { polygonBoolean, booleanArea, signedArea, V2 } from '../kernel/geo/polygonBoolean';
import { parseOFF, importOFF } from '../kernel/io/OffParser';
import { GeoMesh3D } from '../kernel/geo/GeoMesh3D';

function makeKernel(): Kernel { return new Kernel(); }

function makePoint(kernel: Kernel, x: number, y: number, label?: string): GeoPoint {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
  if (label) p.label = label;
  kernel.getConstruction().addElement(p);
  return p;
}

function makePoly(kernel: Kernel, pts: [number, number][], label?: string): GeoPolygon {
  const vertices = pts.map(([x, y], i) => makePoint(kernel, x, y, label ? `${label}${i}` : undefined));
  const poly = new GeoPolygon(kernel, vertices);
  if (label) poly.label = label;
  kernel.getConstruction().addElement(poly);
  return poly;
}

function addInput(kernel: Kernel, text: string) {
  const result = parseAlgebraInput(kernel, text);
  for (const el of result) kernel.getConstruction().addElement(el);
  kernel.getConstruction().updateAllAlgorithms();
  kernel.flushNow();
  return result;
}

function ofType<T>(kernel: Kernel, ctor: new (...args: never[]) => T): T[] {
  return kernel.getConstruction().getElements().filter(el => el instanceof ctor) as unknown as T[];
}

// 单位正方形与重叠矩形
const unit: V2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const right: V2[] = [{ x: 0.5, y: 0 }, { x: 1.5, y: 0 }, { x: 1.5, y: 1 }, { x: 0.5, y: 1 }];
const far: V2[] = [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 3, y: 1 }];
const small: V2[] = [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }];

describe('polygonBoolean 纯函数', () => {
  it('union of overlapping squares has area 1.5', () => {
    const area = booleanArea(unit, right, 'union');
    expect(area).toBeCloseTo(1.5, 6);
  });

  it('intersection of overlapping squares has area 0.5', () => {
    const area = booleanArea(unit, right, 'intersection');
    expect(area).toBeCloseTo(0.5, 6);
  });

  it('difference unit−right has area 0.5', () => {
    const area = booleanArea(unit, right, 'difference');
    expect(area).toBeCloseTo(0.5, 6);
  });

  it('difference unit−contained returns empty', () => {
    // 单位正方形完全包含 small：无洞布尔模型下 A−B（B⊂A）无法表达洞，降级为空
    const area = booleanArea(unit, small, 'difference');
    expect(area).toBeCloseTo(0, 6);
  });

  it('union of disjoint returns two contours total area 2', () => {
    const rings = polygonBoolean(unit, far, 'union');
    expect(rings).toHaveLength(2);
    expect(booleanArea(unit, far, 'union')).toBeCloseTo(2, 6);
  });

  it('intersection of disjoint is empty', () => {
    expect(polygonBoolean(unit, far, 'intersection')).toHaveLength(0);
  });

  it('difference of disjoint returns subject', () => {
    expect(booleanArea(unit, far, 'difference')).toBeCloseTo(1, 6);
  });
});

describe('AlgoPolygonBoolean', () => {
  it('computes union contours and area', () => {
    const kernel = makeKernel();
    const a = makePoly(kernel, [[0, 0], [1, 0], [1, 1], [0, 1]], 'p1');
    const b = makePoly(kernel, [[0.5, 0], [1.5, 0], [1.5, 1], [0.5, 1]], 'p2');
    const algo = new AlgoPolygonBoolean(kernel, a, b, 'union');
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().addElement(algo.getOutput());
    const out = algo.getOutput();
    expect(out.isDefined()).toBe(true);
    expect(out.getArea()).toBeCloseTo(1.5, 6);
  });

  it('input polygon vertex move updates result', () => {
    const kernel = makeKernel();
    const a = makePoly(kernel, [[0, 0], [1, 0], [1, 1], [0, 1]], 'p1');
    const b = makePoly(kernel, [[0.5, 0], [1.5, 0], [1.5, 1], [0.5, 1]], 'p2');
    const algo = new AlgoPolygonBoolean(kernel, a, b, 'union');
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().addElement(algo.getOutput());
    // 把 b 挪远 → 不相交并集面积 2
    b.vertices.forEach(v => v.setCoords(v.getX() + 3, v.getY(), 1));
    kernel.getConstruction().updateAllAlgorithms();
    kernel.flushNow();
    expect(algo.getOutput().getArea()).toBeCloseTo(2, 6);
  });
});

describe('Union / Difference / Intersection 代数命令', () => {
  it('Union(p1, p2) creates GeoBooleanRegion', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 0)');
    addInput(kernel, 'C = (1, 1)');
    addInput(kernel, 'D = (0, 1)');
    addInput(kernel, 'E = (0.5, 0)');
    addInput(kernel, 'F = (1.5, 0)');
    addInput(kernel, 'G = (1.5, 1)');
    addInput(kernel, 'H = (0.5, 1)');
    addInput(kernel, 'p1 = Polygon(A, B, C, D)');
    addInput(kernel, 'p2 = Polygon(E, F, G, H)');
    const elements = addInput(kernel, 'u = Union(p1, p2)');
    const region = elements.find(el => el instanceof GeoBooleanRegion) as GeoBooleanRegion | undefined;
    expect(region).toBeDefined();
    expect(region!.isDefined()).toBe(true);
    expect(region!.getArea()).toBeCloseTo(1.5, 6);
  });

  it('Difference(p1, p2) subtracts', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 0)');
    addInput(kernel, 'C = (1, 1)');
    addInput(kernel, 'D = (0, 1)');
    addInput(kernel, 'E = (0.5, 0)');
    addInput(kernel, 'F = (1.5, 0)');
    addInput(kernel, 'G = (1.5, 1)');
    addInput(kernel, 'H = (0.5, 1)');
    addInput(kernel, 'p1 = Polygon(A, B, C, D)');
    addInput(kernel, 'p2 = Polygon(E, F, G, H)');
    const elements = addInput(kernel, 'd = Difference(p1, p2)');
    const region = elements.find(el => el instanceof GeoBooleanRegion) as GeoBooleanRegion | undefined;
    expect(region).toBeDefined();
    expect(region!.getArea()).toBeCloseTo(0.5, 6);
  });

  it('Intersection(p1, p2) of two polygons', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 0)');
    addInput(kernel, 'C = (1, 1)');
    addInput(kernel, 'D = (0, 1)');
    addInput(kernel, 'E = (0.5, 0)');
    addInput(kernel, 'F = (1.5, 0)');
    addInput(kernel, 'G = (1.5, 1)');
    addInput(kernel, 'H = (0.5, 1)');
    addInput(kernel, 'p1 = Polygon(A, B, C, D)');
    addInput(kernel, 'p2 = Polygon(E, F, G, H)');
    const elements = addInput(kernel, 'i = Intersection(p1, p2)');
    const region = elements.find(el => el instanceof GeoBooleanRegion) as GeoBooleanRegion | undefined;
    expect(region).toBeDefined();
    expect(region!.getArea()).toBeCloseTo(0.5, 6);
  });
});

describe('serializer roundtrip', () => {
  it('AlgoPolygonBoolean survives save/load', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 0)');
    addInput(kernel, 'C = (1, 1)');
    addInput(kernel, 'D = (0, 1)');
    addInput(kernel, 'E = (0.5, 0)');
    addInput(kernel, 'F = (1.5, 0)');
    addInput(kernel, 'G = (1.5, 1)');
    addInput(kernel, 'H = (0.5, 1)');
    addInput(kernel, 'p1 = Polygon(A, B, C, D)');
    addInput(kernel, 'p2 = Polygon(E, F, G, H)');
    addInput(kernel, 'u = Union(p1, p2)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const algos = restored.getConstruction().getElements()
      .filter(el => el instanceof AlgoPolygonBoolean) as AlgoPolygonBoolean[];
    expect(algos).toHaveLength(1);
    expect(algos[0].getOp()).toBe('union');
    algos[0].update();
    expect(algos[0].getOutput().getArea()).toBeCloseTo(1.5, 6);
  });

  it('GeoMesh3D free element survives save/load', () => {
    const kernel = makeKernel();
    const off = [
      'OFF',
      '4 2 0',
      '0 0 0',
      '1 0 0',
      '1 1 0',
      '0 1 0',
      '3 0 1 2',
      '3 0 2 3',
    ].join('\n');
    importOFF(kernel, off, 'mesh');
    expect(ofType(kernel, GeoMesh3D)).toHaveLength(1);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const meshes = ofType(restored, GeoMesh3D);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].label).toBe('mesh');
    expect(meshes[0].vertices).toHaveLength(4);
    expect(meshes[0].faces).toHaveLength(2);
    expect(meshes[0].faces[0]).toEqual([0, 1, 2]);
  });
});

describe('OFF 解析与导入', () => {
  it('parses a simple triangle mesh', () => {
    const mesh = parseOFF('OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n');
    expect(mesh.vertices).toHaveLength(3);
    expect(mesh.faces).toHaveLength(1);
    expect(mesh.faces[0]).toEqual([0, 1, 2]);
  });

  it('ignores comments and blank lines', () => {
    const mesh = parseOFF('# comment\n\nOFF\n# c\n2 0 0\n0 0 0\n1 0 0\n');
    expect(mesh.vertices).toHaveLength(2);
    expect(mesh.faces).toHaveLength(0);
  });

  it('rejects missing OFF header', () => {
    expect(() => parseOFF('2 0 0\n0 0 0\n1 0 0\n')).toThrow(/OFF/);
  });

  it('rejects truncated vertices', () => {
    expect(() => parseOFF('OFF\n3 0 0\n0 0 0\n1 0 0\n')).toThrow(/truncated|vertex/i);
  });

  it('importOFF adds labeled GeoMesh3D to construction', () => {
    const kernel = makeKernel();
    const el = importOFF(kernel, 'OFF\n3 1 0\n0 0 0\n2 0 0\n0 2 0\n3 0 1 2\n', 'cube');
    expect(el).toBeInstanceOf(GeoMesh3D);
    expect(el.label).toBe('cube');
    expect(el.isDefined()).toBe(true);
    expect(el.getAlgebraDescription()).toContain('3 顶点');
  });
});

describe('signedArea 规范化', () => {
  it('normalize via signedArea: CCW positive', () => {
    expect(signedArea(unit)).toBeCloseTo(1, 6);
    expect(signedArea([...unit].reverse())).toBeCloseTo(-1, 6);
  });
});
