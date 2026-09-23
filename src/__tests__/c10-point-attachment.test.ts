/**
 * C10：3D path/region 依附点 + 平面 CoordSys-lite。
 * 对标 GeoGebra GeoPoint3D path/region 与 GeoPlane3D CoordSys 的最小闭环。
 */

import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoPlane3D } from '../kernel/geo/GeoPlane3D';
import { GeoPolyline3D } from '../kernel/geo/GeoPolyline3D';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
import { Coords4 } from '../kernel/core/Coords4';
import {
  AlgoPointOnLine3D,
  AlgoPointOnCircle3D,
  AlgoPointOnConic3D,
  AlgoPointOnPolyline3D,
  AlgoPointInPlane3D,
} from '../kernel/algo/AlgoPointOn3D';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  kernel.flushNow?.();
  return elements;
};

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

const addElement = (kernel: Kernel, el: unknown) => {
  c(kernel).addElement(el as any);
  c(kernel).updateAllAlgorithms();
  kernel.flushNow?.();
  return el;
};

describe('GeoPlane3D CoordSys-lite', () => {
  it('getPoint / getPlaneCoords round-trip on the plane', () => {
    const kernel = makeKernel();
    const plane = new GeoPlane3D(kernel, Coords4.fromDirection(0, 0, 1), 2); // z = 2
    const p = plane.getPoint(3, -4);
    expect(p.getZ()).toBeCloseTo(2, 9);
    const { u, v } = plane.getPlaneCoords(p);
    expect(u).toBeCloseTo(3, 6);
    expect(v).toBeCloseTo(-4, 6);
  });

  it('setCoordSys + project clamps off-plane points', () => {
    const kernel = makeKernel();
    const plane = new GeoPlane3D(kernel, Coords4.fromDirection(1, 0, 0), 0); // x = 0
    plane.setCoordSys(Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(0, 1, 0));
    const projected = plane.project(Coords4.fromPoint(5, 1, 1));
    expect(projected.getX()).toBeCloseTo(0, 9);
    expect(projected.getY()).toBeCloseTo(1, 9);
    expect(projected.getZ()).toBeCloseTo(1, 9);
  });

  it('setGeometry invalidates coord sys and rebuilds', () => {
    const kernel = makeKernel();
    const plane = new GeoPlane3D(kernel, Coords4.fromDirection(0, 0, 1), 0);
    const before = plane.getPoint(1, 0);
    expect(before.getZ()).toBeCloseTo(0, 9);
    plane.setGeometry(Coords4.fromDirection(0, 0, 1), 5);
    const after = plane.getPoint(1, 0);
    expect(after.getZ()).toBeCloseTo(5, 9);
  });
});

describe('AlgoPointOnLine3D', () => {
  it('places a point on the line and follows the parameter', () => {
    const kernel = makeKernel();
    const line = new GeoLine3D(kernel, Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(1, 0, 0));
    addElement(kernel, line);
    const param = new GeoNumeric(kernel, 0.5);
    addElement(kernel, param);
    const algo = new AlgoPointOnLine3D(kernel, line, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    const point = algo.getOutput();
    expect(point.getX()).toBeCloseTo(0.5, 6);
    expect(point.getY()).toBeCloseTo(0, 6);
    expect(line.contains(point.getCoords3())).toBe(true);

    param.setValue(2);
    kernel.flushNow();
    expect(point.getX()).toBeCloseTo(2, 6);
    expect(line.contains(point.getCoords3())).toBe(true);
  });

  it('updateParameter projects a free drag back onto the line', () => {
    const kernel = makeKernel();
    const line = new GeoLine3D(kernel, Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(1, 0, 0));
    addElement(kernel, line);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const algo = new AlgoPointOnLine3D(kernel, line, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    algo.updateParameter(3, 7, -2);
    kernel.flushNow();
    expect(param.getValue()).toBeCloseTo(3, 6);
    const p = algo.getOutput();
    expect(p.getY()).toBeCloseTo(0, 6);
    expect(p.getZ()).toBeCloseTo(0, 6);
  });

  it('segment limits clamp the parameter', () => {
    const kernel = makeKernel();
    const line = new GeoLine3D(kernel, Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(1, 0, 0));
    line.setLimits(0, 1);
    addElement(kernel, line);
    const param = new GeoNumeric(kernel, 0.5);
    addElement(kernel, param);
    const algo = new AlgoPointOnLine3D(kernel, line, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    algo.updateParameter(10, 0, 0);
    kernel.flushNow();
    expect(param.getValue()).toBeCloseTo(1, 6);
    expect(algo.getOutput().getX()).toBeCloseTo(1, 6);
  });
});

describe('AlgoPointOnCircle3D', () => {
  // GeoCircle3D.pointAt 对法向 (0,0,1) 取 ref=(1,0,0) → e1=(0,1,0)、e2=(-1,0,0)：
  // angle 0 → +Y，angle π/2 → -X。参数化与 pointAt 保持一致。
  it('point stays on the circle as the angle changes', () => {
    const kernel = makeKernel();
    const circle = new GeoCircle3D(kernel);
    circle.setCircle(Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(0, 0, 1), 2);
    addElement(kernel, circle);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const algo = new AlgoPointOnCircle3D(kernel, circle, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    const point = algo.getOutput();
    expect(point.getX()).toBeCloseTo(0, 6);
    expect(point.getY()).toBeCloseTo(2, 6);
    expect(circle.isOnCircle(point.getCoords3())).toBe(true);

    param.setValue(Math.PI / 2);
    kernel.flushNow();
    expect(point.getX()).toBeCloseTo(-2, 6);
    expect(point.getY()).toBeCloseTo(0, 6);
    expect(circle.isOnCircle(point.getCoords3())).toBe(true);
  });

  it('updateParameter recovers the angle from a drag target', () => {
    const kernel = makeKernel();
    const circle = new GeoCircle3D(kernel);
    circle.setCircle(Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(0, 0, 1), 1);
    addElement(kernel, circle);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const algo = new AlgoPointOnCircle3D(kernel, circle, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    // 拖到 +X 方向：e1=(0,1,0), e2=(-1,0,0) → u=0, v=-1 → atan2(-1,0) = -π/2
    algo.updateParameter(1, 0, 0.3);
    kernel.flushNow();
    expect(param.getValue()).toBeCloseTo(-Math.PI / 2, 5);
    expect(circle.isOnCircle(algo.getOutput().getCoords3())).toBe(true);
    expect(algo.getOutput().getX()).toBeCloseTo(1, 5);
  });
});

describe('AlgoPointOnConic3D', () => {
  it('ellipse point stays on the conic', () => {
    const kernel = makeKernel();
    const conic = new GeoConic3D(kernel);
    conic.setEllipse(
      Coords4.fromPoint(0, 0, 0),
      Coords4.fromDirection(1, 0, 0),
      Coords4.fromDirection(0, 1, 0),
      3, 2,
    );
    addElement(kernel, conic);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const algo = new AlgoPointOnConic3D(kernel, conic, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    const point = algo.getOutput();
    expect(point.getX()).toBeCloseTo(3, 6);
    expect(point.getY()).toBeCloseTo(0, 6);
    expect(conic.isOnConic(point.getCoords3())).toBe(true);

    param.setValue(Math.PI / 3);
    kernel.flushNow();
    expect(conic.isOnConic(point.getCoords3())).toBe(true);
  });
});

describe('AlgoPointOnPolyline3D', () => {
  it('interpolates along segments by edge index + fraction', () => {
    const kernel = makeKernel();
    const poly = new GeoPolyline3D(kernel, [
      Coords4.fromPoint(0, 0, 0),
      Coords4.fromPoint(1, 0, 0),
      Coords4.fromPoint(1, 1, 0),
    ]);
    addElement(kernel, poly);
    const param = new GeoNumeric(kernel, 0.5);
    addElement(kernel, param);
    const algo = new AlgoPointOnPolyline3D(kernel, poly, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    expect(algo.getOutput().getX()).toBeCloseTo(0.5, 6);

    param.setValue(1.5); // 第二边中点
    kernel.flushNow();
    expect(algo.getOutput().getX()).toBeCloseTo(1, 6);
    expect(algo.getOutput().getY()).toBeCloseTo(0.5, 6);
  });

  it('updateParameter snaps to the nearest edge', () => {
    const kernel = makeKernel();
    const poly = new GeoPolyline3D(kernel, [
      Coords4.fromPoint(0, 0, 0),
      Coords4.fromPoint(2, 0, 0),
      Coords4.fromPoint(2, 2, 0),
    ]);
    addElement(kernel, poly);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const algo = new AlgoPointOnPolyline3D(kernel, poly, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    algo.updateParameter(1, 0.1, 0);
    kernel.flushNow();
    expect(param.getValue()).toBeCloseTo(0.5, 6);
  });
});

describe('AlgoPointInPlane3D (Region3D)', () => {
  it('PointIn(plane) lands on the plane and tracks plane motion', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'C = (0, 1, 0)');
    addInput(kernel, 'pl = Plane3D(A, B, C)');
    const elements = addInput(kernel, 'PointIn(pl)');
    const algo = elements.find(el => el instanceof AlgoPointInPlane3D) as AlgoPointInPlane3D | undefined;
    expect(algo).toBeDefined();
    const point = algo!.getOutput();
    expect(point.isDefined()).toBe(true);
    const plane = ofType(kernel, GeoPlane3D)[0];
    expect(plane.contains(point.getCoords3())).toBe(true);

    // 沿法向移动驱动点 → 平面 z 变化，点应仍在面上
    const a = ofType(kernel, GeoPoint3D).find(p => p.label === 'A')!;
    a.setCoords(0, 0, 3);
    a.update();
    kernel.flushNow();
    expect(plane.contains(point.getCoords3())).toBe(true);
  });

  it('updateParameter projects free drag onto the plane', () => {
    const kernel = makeKernel();
    const plane = new GeoPlane3D(kernel, Coords4.fromDirection(0, 0, 1), 0);
    addElement(kernel, plane);
    const algo = new AlgoPointInPlane3D(kernel, plane, 1, 1);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    algo.updateParameter(4, 5, 9);
    kernel.flushNow();
    const p = algo.getOutput();
    expect(p.getZ()).toBeCloseTo(0, 6);
    expect(plane.contains(p.getCoords3())).toBe(true);
  });
});

describe('PointOn 3D algebra wiring + animation hooks', () => {
  it('PointOn(line3) creates a constrained GeoPoint3D with a driver slider', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'l = Line3D(A, B)');
    const elements = addInput(kernel, 'PointOn(l)');
    const point = elements.find(el => el instanceof GeoPoint3D) as GeoPoint3D | undefined;
    const algo = elements.find(el => el instanceof AlgoPointOnLine3D) as AlgoPointOnLine3D | undefined;
    const param = elements.find(el => el instanceof GeoNumeric) as GeoNumeric | undefined;
    expect(point).toBeDefined();
    expect(algo).toBeDefined();
    expect(param).toBeDefined();
    expect(point!.isDefined()).toBe(true);
    // t 是弧长参数（方向单位化）：Line3D(A,B) 默认 t=0.5 → 从 A 出发 0.5 单位
    expect(point!.getX()).toBeCloseTo(0.5, 6);

    // 动画钩子：有 GeoNumeric 驱动才可动画
    expect(point!.isAnimatable()).toBe(true);
    expect(point!.doAnimationStep(30)).toBe(true);

    param!.setValue(0);
    kernel.flushNow();
    expect(point!.getX()).toBeCloseTo(0, 6);
  });

  it('PointOn(circle3) works via algebra input', () => {
    const kernel = makeKernel();
    const circle = new GeoCircle3D(kernel);
    circle.setCircle(Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(0, 0, 1), 2);
    circle.label = 'c3';
    addElement(kernel, circle);
    const elements = addInput(kernel, 'PointOn(c3)');
    const point = elements.find(el => el instanceof GeoPoint3D) as GeoPoint3D | undefined;
    expect(point).toBeDefined();
    expect(circle.isOnCircle(point!.getCoords3())).toBe(true);
    expect(point!.isAnimatable()).toBe(true);
  });

  it('free GeoPoint3D is not animatable', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F = (1, 2, 3)');
    const free = ofType(kernel, GeoPoint3D).find(p => p.label === 'F')!;
    expect(free.isAnimatable()).toBe(false);
    expect(free.doAnimationStep(30)).toBe(false);
  });

  it('PointOn(polyline3) via algebra', () => {
    const kernel = makeKernel();
    // 折线可能无代数命令：对象级路径
    const poly = new GeoPolyline3D(kernel, [
      Coords4.fromPoint(0, 0, 0),
      Coords4.fromPoint(1, 0, 0),
    ]);
    poly.label = 'pl3';
    addElement(kernel, poly);
    const elements = addInput(kernel, 'PointOn(pl3)');
    const point = elements.find(el => el instanceof GeoPoint3D) as GeoPoint3D;
    expect(point).toBeDefined();
    expect(point.isDefined()).toBe(true);
    expect(ofType(kernel, AlgoPointOnPolyline3D)).toHaveLength(1);
  });
});

describe('C10 serialize round-trip', () => {
  it('PointOn(line3) survives save/load', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, 'PointOn(l)');
    const original = ofType(kernel, AlgoPointOnLine3D)[0];
    const originalPoint = original.getOutput();
    const originalX = originalPoint.getX();

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const algos = restored.getConstruction().getElements()
      .filter(el => el instanceof AlgoPointOnLine3D) as AlgoPointOnLine3D[];
    expect(algos).toHaveLength(1);
    const p = algos[0].getOutput();
    expect(p.getX()).toBeCloseTo(originalX, 6);
    expect(p.isDefined()).toBe(true);
  });

  it('PointIn(plane) survives save/load', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'C = (0, 1, 0)');
    addInput(kernel, 'pl = Plane3D(A, B, C)');
    addInput(kernel, 'PointIn(pl)');
    expect(ofType(kernel, AlgoPointInPlane3D)).toHaveLength(1);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const algos = restored.getConstruction().getElements()
      .filter(el => el instanceof AlgoPointInPlane3D) as AlgoPointInPlane3D[];
    expect(algos).toHaveLength(1);
    const plane = restored.getConstruction().getElements()
      .filter(el => el instanceof GeoPlane3D)[0] as GeoPlane3D;
    expect(plane.contains(algos[0].getOutput().getCoords3())).toBe(true);
  });
});
