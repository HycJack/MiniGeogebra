/**
 * 区域点与区域判断 —— 对标 GeoGebra 的 AlgoPointInRegion / CmdIsInRegion / CmdRandomPointIn。
 *
 * PointIn(region) 生成一个保持在区域内部的约束点：拖拽时 updateParameter(x, y)
 * 把目标位置投影回区域内（多边形 → 最近边；圆/椭圆 → 半径收缩），
 * 因此点永远拖不出边界。
 */

import { IKernel, Region } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoVec3D } from '../core/GeoVec3D';

/** 把 (x, y) 投影到区域内部：多边形取最近边上的点，圆锥取中心向径收缩。 */
export function clampToRegion(region: Region & GeoElement, x: number, y: number): { x: number; y: number } {
  if (region instanceof GeoPolygon) {
    if (region.isInRegionXY(x, y)) return { x, y };
    return nearestOnPolygon(region, x, y);
  }
  if (region instanceof GeoConic) {
    const center = region.getCenter();
    if (region.isInRegionXY(x, y)) return { x, y };
    // 对标 GeoGebra pointChangedForRegion：出界点夹到**边界**上，
    // 沿中心→目标方向解析求交（椭圆/旋转圆锥也精确，不再按半径近似收缩）。
    const dx = x - center.x, dy = y - center.y;
    if (Math.hypot(dx, dy) < 1e-12) return center;
    const theta = Math.atan2(dy, dx);
    const hits = region.rayIntersections(theta, center.x, center.y);
    if (hits.length === 0) return center;
    const t = Math.min(...hits);
    return { x: center.x + t * Math.cos(theta), y: center.y + t * Math.sin(theta) };
  }
  return { x, y };
}

function nearestOnPolygon(poly: GeoPolygon, x: number, y: number): { x: number; y: number } {
  const vs = poly.vertices;
  let best: { x: number; y: number } = vs.length ? { x: vs[0].getX(), y: vs[0].getY() } : { x, y };
  let bestDist = Infinity;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const ax = vs[j].getX(), ay = vs[j].getY();
    const bx = vs[i].getX(), by = vs[i].getY();
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    let t = len2 === 0 ? 0 : ((x - ax) * abx + (y - ay) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * abx, py = ay + t * aby;
    const d = Math.hypot(px - x, py - y);
    if (d < bestDist) { bestDist = d; best = { x: px, y: py }; }
  }
  return best;
}

/** 区域内的初始落点：多边形重心或圆/椭圆中心。 */
export function regionAnchor(region: Region & GeoElement): { x: number; y: number } {
  if (region instanceof GeoPolygon) {
    let sx = 0, sy = 0;
    for (const v of region.vertices) { sx += v.getX(); sy += v.getY(); }
    if (region.vertices.length === 0) return { x: 0, y: 0 };
    return { x: sx / region.vertices.length, y: sy / region.vertices.length };
  }
  if (region instanceof GeoConic) return region.getCenter();
  return { x: 0, y: 0 };
}

export class AlgoPointInRegion extends AlgoElement {
  private outputPoint: GeoPoint;
  private lastX: number;
  private lastY: number;

  constructor(kernel: IKernel, private region: GeoElement) {
    super(kernel);
    const anchor = regionAnchor(region as Region & GeoElement);
    this.lastX = anchor.x;
    this.lastY = anchor.y;
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(anchor.x, anchor.y, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.region];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    // 区域形变时点跟着投影回内部
    const clamped = clampToRegion(this.region as Region & GeoElement, this.lastX, this.lastY);
    this.lastX = clamped.x;
    this.lastY = clamped.y;
    this.outputPoint.setCoords(clamped.x, clamped.y, 1);
    this.outputPoint.setDefined();
  }

  updateParameter(x: number, y: number): void {
    this.lastX = x;
    this.lastY = y;
  }
}

/** 判断点是否在区域内（输出 GeoNumeric 1/0）。 */
export class AlgoIsInRegion extends AlgoElement {
  constructor(kernel: IKernel, private point: GeoPoint, private region: GeoElement) {
    super(kernel);
    this.setOutput([new GeoNumeric(kernel, 0)]);
  }

  setInputOutput(): void {
    this.input = [this.point, this.region];
    this.setOutput([this.output[0]]);
  }

  compute(): void {
    const region = this.region as unknown as Region;
    const inside = typeof region.isInRegion === 'function'
      ? region.isInRegion(this.point)
      : region.isInRegionXY(this.point.getX(), this.point.getY());
    (this.output[0] as GeoNumeric).setValue(inside ? 1 : 0);
  }
}

/** 区域内的随机点：多边形包围盒拒绝采样；圆/椭圆半径-角度采样。 */
export class AlgoRandomPointIn extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private region: GeoElement) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.region];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    const r = this.region as unknown as Region;
    const pt = randomPointIn(r, this.region);
    this.outputPoint.setCoords(pt.x, pt.y, 1);
    this.outputPoint.setDefined();
  }
}

function randomPointIn(region: Region, el: GeoElement): { x: number; y: number } {
  if (el instanceof GeoConic) {
    const center = el.getCenter();
    const radius = el.getRadius();
    const angle = Math.random() * 2 * Math.PI;
    const r = radius * Math.sqrt(Math.random());
    return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
  }
  if (el instanceof GeoPolygon) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const v of el.vertices) {
      minX = Math.min(minX, v.getX()); maxX = Math.max(maxX, v.getX());
      minY = Math.min(minY, v.getY()); maxY = Math.max(maxY, v.getY());
    }
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (region.isInRegionXY(x, y)) return { x, y };
    }
    return regionAnchor(el as Region & GeoElement);
  }
  return { x: 0, y: 0 };
}
