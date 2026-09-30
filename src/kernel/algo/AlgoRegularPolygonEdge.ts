/**
 * 正多边形构造（GeoGebra RegularPolygon(A, B, n) 语义）——
 * A、B 为相邻两顶点（第一条边），n 为边数，弹出数值输入后创建。
 *
 * 方向语义：多边形顶点序在屏幕上呈逆时针（与 GeoGebra y-up 世界的
 * 数学逆时针视觉一致）。世界坐标 y 向下为正，故边向量按 −2π/n 旋转。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoRegularPolygonEdge extends AlgoElement {
  private polygon: GeoPolygon;
  private newPoints: GeoPoint[] = [];
  private nSides: number;

  constructor(kernel: IKernel, private a: GeoPoint, private b: GeoPoint, nSides: number) {
    super(kernel);
    this.nSides = Math.max(3, Math.round(nSides));
    const n = this.nSides;
    // 其余 n−2 个顶点为新建点（v0 = A、v1 = B 直接引用输入点，拖动联动）
    for (let i = 2; i < n; i++) {
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      this.newPoints.push(p);
    }
    this.polygon = new GeoPolygon(kernel, [this.a, this.b, ...this.newPoints]);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.a, this.b];
    this.setOutput([this.polygon, ...this.newPoints]);
  }

  getOutput(): GeoPolygon { return this.polygon; }

  getNewPoints(): GeoPoint[] { return this.newPoints; }
  getSidesValue(): number { return this.nSides; }

  /** 由 A、B 与边数重建其余顶点（顶点序屏幕逆时针 → 世界系边向量旋转 −2π/n）。 */
  compute(): void {
    const ax = this.a.getX(), ay = this.a.getY();
    const bx = this.b.getX(), by = this.b.getY();
    const ex = bx - ax, ey = by - ay;
    const delta = (-2 * Math.PI) / this.nSides;
    // 边 k（v_k → v_{k+1}）= e0 旋转 k·δ；v_{k+1} = v_k + 边 k。
    // newPoints[j] 存放 v_{j+2}，故 k ∈ [1, n−2] 对应 newPoints[k−1]。
    let vx = bx, vy = by;
    for (let k = 1; k < this.nSides - 1; k++) {
      const cos = Math.cos(delta * k), sin = Math.sin(delta * k);
      vx += ex * cos - ey * sin;
      vy += ex * sin + ey * cos;
      this.newPoints[k - 1].setCoords(vx, vy, 1);
    }
    // GeoPolygon 的周长/面积/命中均实时遍历顶点，无需缓存刷新
    this.polygon.setDefined();
  }
}
