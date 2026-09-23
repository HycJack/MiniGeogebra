/**
 * 多边形布尔运算 —— Union / Difference / Intersection(多边形)。
 * 对标 GeoGebra AlgoPolygonOperation（AlgoUnionPolygons / AlgoPolygonDifference 等）。
 *
 * 输出 GeoBooleanRegion（可变轮廓数），输入任一未定义时输出 undefined。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoBooleanRegion } from '../geo/GeoBooleanRegion';
import { BooleanOp, polygonBoolean, V2 } from '../geo/polygonBoolean';

export type PolyBooleanOp = BooleanOp;

function polyVertices(p: GeoPolygon): V2[] {
  return p.vertices.map(v => ({ x: v.getX(), y: v.getY() }));
}

export class AlgoPolygonBoolean extends AlgoElement {
  private outputRegion: GeoBooleanRegion;
  private op: PolyBooleanOp;

  constructor(
    kernel: IKernel,
    private poly1: GeoPolygon,
    private poly2: GeoPolygon,
    op: PolyBooleanOp,
  ) {
    super(kernel);
    this.op = op;
    this.outputRegion = new GeoBooleanRegion(kernel);
    this.setInputOutput();
    this.compute();
  }

  setInputOutput(): void {
    this.input = [this.poly1, this.poly2];
    this.setOutput([this.outputRegion]);
  }

  getOutput(): GeoBooleanRegion { return this.outputRegion; }
  getOp(): PolyBooleanOp { return this.op; }

  compute(): void {
    if (!this.poly1.isDefined() || !this.poly2.isDefined()
      || this.poly1.vertices.length < 3 || this.poly2.vertices.length < 3) {
      this.outputRegion.setContours([]);
      this.outputRegion.setUndefined();
      return;
    }
    const contours = polygonBoolean(polyVertices(this.poly1), polyVertices(this.poly2), this.op);
    this.outputRegion.setContours(contours);
  }
}
