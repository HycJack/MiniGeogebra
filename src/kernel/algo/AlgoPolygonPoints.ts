/**
 * 多边形构造算法（对标 GeoGebra AlgoPolygon）：顶点为输入、多边形与各边
 * 线段为输出（官方同构——边是多边形算法的附加输出，删除多边形时随级联
 * 整组消失，拖顶点时边也联动）。此前工具路径的边是独立 AlgoSegmentTwoPoints，
 * 与多边形无依赖关系：删多边形留孤儿边。
 * 顶点引用是活的，compute 只需置 defined。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoSegment } from '../geo/GeoSegment';

export class AlgoPolygonPoints extends AlgoElement {
  private outputPolygon: GeoPolygon;
  private outputEdges: GeoSegment[] = [];

  constructor(kernel: IKernel, private points: GeoPoint[]) {
    super(kernel);
    this.outputPolygon = new GeoPolygon(kernel, points);
    // 顶点数 ≥ 3 才封口成边（退化调用不加边）
    if (points.length >= 3) {
      for (let i = 0; i < points.length; i++) {
        this.outputEdges.push(new GeoSegment(kernel, points[i], points[(i + 1) % points.length]));
      }
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.points];
    this.setOutput([this.outputPolygon, ...this.outputEdges]);
  }

  getOutput(): GeoPolygon { return this.outputPolygon; }

  /** 多边形的边（与多边形同一算法的兄弟输出）。 */
  getEdges(): GeoSegment[] { return this.outputEdges; }

  compute(): void {
    // 顶点引用是活的：周长/面积/命中均实时遍历顶点
    this.outputPolygon.setDefined();
    this.outputEdges.forEach(edge => edge.setDefined());
  }
}
