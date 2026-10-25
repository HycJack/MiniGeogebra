/**
 * 多边形构造算法（对标 GeoGebra AlgoPolygon）：顶点为输入、多边形为输出。
 * 此前多边形是裸 GeoPolygon（无 AlgoElement）——顶点→多边形的正向依赖边
 * 根本不存在，移动顶点后 Area/Perimeter/变换像全部不重算，删除顶点也不级联。
 * 顶点引用是活的，compute 只需置 defined。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPolygon } from '../geo/GeoPolygon';

export class AlgoPolygonPoints extends AlgoElement {
  private outputPolygon: GeoPolygon;

  constructor(kernel: IKernel, private points: GeoPoint[]) {
    super(kernel);
    this.outputPolygon = new GeoPolygon(kernel, points);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.points];
    this.setOutput([this.outputPolygon]);
  }

  getOutput(): GeoPolygon { return this.outputPolygon; }

  compute(): void {
    // 顶点引用是活的：周长/面积/命中均实时遍历顶点
    this.outputPolygon.setDefined();
  }
}
