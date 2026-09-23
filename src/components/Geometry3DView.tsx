/**
 * Geometry3DView —— 3D 视图模式。
 *
 * 使用独立 WebGL2 渲染后端（WebGL3DRenderer）把当前构造投影到透视三维空间。
 * 参考 GeoGebra 3D 界面，集成：
 *   - 3D 专用工具栏（投影模式 / 标准视图 / 坐标轴平面 / 网格 / 旋转动画）
 *   - 导航方块（右上角）
 *   - 坐标轴标签（X, Y, Z 绘制在 2D overlay 上）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WebGL3DRenderer, Scene3D, V3, Line3, Fill3, Point3, ProjectionMode, StandardView, Plane3 } from '../kernel/view/WebGL3DRenderer';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { GeoLocus3D } from '../kernel/geo/GeoLocus3D';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoPlane3D } from '../kernel/geo/GeoPlane3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoPolyhedron3D } from '../kernel/algo/AlgoPolyhedron3D';
import { GeoSurface } from '../kernel/geo/GeoSurface';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoPolyline3D } from '../kernel/geo/GeoPolyline3D';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
import { GeoNet3D, AlgoPolyhedronNet } from '../kernel/algo/AlgoPolyhedronNet';
import { GeoMesh3D } from '../kernel/geo/GeoMesh3D';
import { Coords4 } from '../kernel/core/Coords4';
import { rayPlaneIntersect, clipLineToBox, pointSegmentDistance, Ray3 } from '../kernel/view/RayPicker';
import {
  computeClippingBox, isPointInBox,
  REDUCTION_MEDIUM, ClippingReduction,
} from '../kernel/view/ClippingBox';
import { AlgoJoinPoints3D, AlgoMidpoint3D, AlgoPlaneThreePoints3D } from '../kernel/algo/Algo3D';
import { AlgoSphere3D, AlgoCylinder3D, AlgoCone3D, AlgoPrism3D, AlgoPyramid3D } from '../kernel/algo/AlgoPolyhedron3D';
import { AlgoElement } from '../kernel/algo/AlgoElement';
import { useLanguage } from '../i18n/LanguageContext';
import NavigationCube from './NavigationCube';
import Geometry3DToolbar from './Geometry3DToolbar';

export type Tool3D = 'select' | 'point' | 'segment' | 'line' | 'midpoint' | 'plane'
  | 'sphere' | 'cylinder' | 'cone' | 'prism' | 'pyramid';

/** 3D 构造工具配置：所需点击点数、最后一步的数值提示（无则最后一步是点击）。 */
const TOOL3D_CONFIG: Record<Tool3D, { points: number; finalPrompt?: string; labelKey: string }> = {
  select: { points: 0, labelKey: 'tool3dSelect' },
  point: { points: 1, labelKey: 'tool3dPoint' },
  segment: { points: 2, labelKey: 'tool3dSegment' },
  line: { points: 2, labelKey: 'tool3dLine' },
  midpoint: { points: 2, labelKey: 'tool3dMidpoint' },
  plane: { points: 3, labelKey: 'tool3dPlane' },
  sphere: { points: 2, labelKey: 'tool3dSphere' },
  cylinder: { points: 2, finalPrompt: 'tool3dPromptRadius', labelKey: 'tool3dCylinder' },
  cone: { points: 2, finalPrompt: 'tool3dPromptHalfAngle', labelKey: 'tool3dCone' },
  prism: { points: 3, finalPrompt: 'tool3dPromptHeight', labelKey: 'tool3dPrism' },
  pyramid: { points: 4, labelKey: 'tool3dPyramid' },
};

interface Props {
  kernel: Kernel;
  renderRev: number;
  selectedElements: GeoElement[];
  setSelectedElements?: (els: GeoElement[]) => void;
  showGrid: boolean;
  showAxes: boolean;
  setShowGrid: (v: boolean | ((p: boolean) => boolean)) => void;
  setShowAxes: (v: boolean | ((p: boolean) => boolean)) => void;
}

interface Bounds2 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface LineStyle {
  color: string;
  width: number;
  dash?: number[];
}

/** 世界坐标 → 3D 坐标（构造面 z=0，世界 y 向下对应三维 −Y）。 */
const to3 = (x: number, y: number, z = 0): V3 => ({ x, y: -y, z });

/** 坐标轴刻度数字格式化（避免浮点尾差）。 */
function fmtNum(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 1000) return v.toExponential(0);
  return parseFloat(v.toPrecision(6)).toString();
}

/** 依据构造元素估算场景包围盒（带留白）。 */
function computeBounds(elements: readonly ConstructionElement[]): Bounds2 {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const el of elements) {
    if (el instanceof GeoPoint) {
      if (el.isDefined()) add(el.getX(), el.getY());
    } else if (el instanceof GeoSegment) {
      if (el.isDefined()) { add(el.startPoint.getX(), el.startPoint.getY()); add(el.endPoint.getX(), el.endPoint.getY()); }
    } else if (el instanceof GeoPolygon) {
      for (const v of el.vertices) add(v.getX(), v.getY());
    } else if (el instanceof GeoConic) {
      if (el.isDefined()) {
        const c = el.getCenter();
        const r = el.getRadius();
        if (r > 0) { add(c.x - r, c.y - r); add(c.x + r, c.y + r); }
      }
    } else if (el instanceof GeoLocus) {
      for (const s of el.getSamples()) add(s.x, s.y);
    }
  }
  if (!Number.isFinite(minX)) return { minX: -500, maxX: 500, minY: -350, maxY: 350 };
  const pad = Math.max((maxX - minX) * 0.15, (maxY - minY) * 0.15, 60);
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

/** 元素样式。 */
function styleOf(el: GeoElement, selected: boolean): LineStyle {
  const base = el.strokeWidth ?? el.defaultLineWidth;
  return {
    color: selected ? '#3b82f6' : (el.strokeColor ?? el.defaultStrokeColor),
    width: selected ? base * 2 : base,
    dash: el.strokeDash ? [...el.strokeDash] : undefined,
  };
}

function estimatePxPerUnit(renderer: WebGL3DRenderer): number {
  const t = renderer.target;
  const p0 = renderer.projectToScreen(t);
  const p1 = renderer.projectToScreen({ x: t.x + 1, y: t.y, z: t.z });
  if (!p0 || !p1) return 1;
  const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  return d > 1e-6 ? d : 1;
}

function pushSegment(lines: Line3[], ax: number, ay: number, bx: number, by: number, style: LineStyle, pxPerUnit: number): void {
  if (Math.hypot(bx - ax, by - ay) < 1e-9) return;
  lines.push({
    a: to3(ax, ay), b: to3(bx, by),
    color: style.color,
    widthPx: style.width,
    dash: style.dash ? [...style.dash] : undefined,
  });
}

function pushPolyline(lines: Line3[], pts: V3[], style: LineStyle, pxPerUnit: number): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1e-9) continue;
    lines.push({ a, b, color: style.color, widthPx: style.width, dash: style.dash ? [...style.dash] : undefined });
  }
}

function circlePolyline(renderer: WebGL3DRenderer, cx: number, cy: number, r: number, a0: number, a1: number): V3[] {
  if (r <= 0) return [];
  const p0 = renderer.projectToScreen(to3(cx, cy));
  const p1 = renderer.projectToScreen(to3(cx + r, cy));
  const sweep = Math.abs(a1 - a0);
  let steps = 48;
  if (p0 && p1) {
    const dpx = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const full = Math.max(16, Math.min(960, Math.ceil((2 * Math.PI * dpx) / 3)));
    steps = Math.max(8, Math.round((full * sweep) / (2 * Math.PI)));
  }
  const pts: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const ang = a0 + (a1 - a0) * (i / steps);
    pts.push(to3(cx + r * Math.cos(ang), cy + r * Math.sin(ang)));
  }
  return pts;
}

function arcRange(arc: GeoArc): { a0: number; a1: number } {
  let a0 = arc.getStartAngle();
  let a1 = arc.getEndAngle();
  if (arc.isCounterClockwise()) {
    if (a1 <= a0) a1 += 2 * Math.PI;
  } else if (a1 >= a0) {
    a1 -= 2 * Math.PI;
  }
  return { a0, a1 };
}

function clipInfiniteLine(l: GeoLine, b: Bounds2): { x1: number; y1: number; x2: number; y2: number } | null {
  const eps = 1e-6;
  if (Math.abs(l.b) > eps) {
    return { x1: b.minX, y1: (-l.c - l.a * b.minX) / l.b, x2: b.maxX, y2: (-l.c - l.a * b.maxX) / l.b };
  }
  if (Math.abs(l.a) < eps) return null;
  const x = -l.c / l.a;
  return { x1: x, y1: b.minY, x2: x, y2: b.maxY };
}

function faceFacingUp(verts: V3[]): V3[] {
  if (verts.length < 3) return verts;
  const v0 = verts[0], v1 = verts[1], v2 = verts[2];
  const crossZ = (v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x);
  return crossZ > 0 ? verts.slice().reverse() : verts;
}

function isVisibleFace(verts: V3[], renderer: WebGL3DRenderer): boolean {
  if (verts.length < 3) return false;
  const eye = renderer.getEye();
  let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[j], b = verts[i];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
    cx += b.x; cy += b.y; cz += b.z;
  }
  const n = verts.length;
  cx /= n; cy /= n; cz /= n;
  return nx * (eye.x - cx) + ny * (eye.y - cy) + nz * (eye.z - cz) > 0;
}

function buildScene(
  kernel: Kernel,
  selected: readonly GeoElement[],
  showGrid: boolean,
  showAxes: boolean,
  axesPlaneMode: number,
  showXY: boolean,
  showXZ: boolean,
  showYZ: boolean,
  showClipBox: boolean,
  clipReduction: ClippingReduction,
  renderer: WebGL3DRenderer,
): Scene3D {
  const elements = kernel.getConstruction().getElements();
  const bounds = computeBounds(elements);
  const viewBounds = renderer.getViewBoundsXY();
  const selSet = new Set(selected);
  const lines: Line3[] = [];
  const fills: Fill3[] = [];
  const points: Point3[] = [];
  const pxPerUnit = estimatePxPerUnit(renderer);

  for (const el of elements) {
    if (!(el instanceof GeoElement) || !el.isDefined()) continue;
    if (el instanceof GeoSegment) {
      const st = styleOf(el, selSet.has(el));
      pushSegment(lines, el.startPoint.getX(), el.startPoint.getY(), el.endPoint.getX(), el.endPoint.getY(), st, pxPerUnit);
    } else if (el instanceof GeoLine) {
      const clipped = clipInfiniteLine(el, bounds);
      if (clipped) {
        const st = styleOf(el, selSet.has(el));
        pushSegment(lines, clipped.x1, clipped.y1, clipped.x2, clipped.y2, st, pxPerUnit);
      }
    } else if (el instanceof GeoArc) {
      const { a0, a1 } = arcRange(el);
      const st = styleOf(el, selSet.has(el));
      const pts = circlePolyline(renderer, el.getCenter().x, el.getCenter().y, el.getRadius(), a0, a1);
      pushPolyline(lines, pts, st, pxPerUnit);
    } else if (el instanceof GeoConic) {
      const c = el.getCenter();
      const r = el.getRadius();
      if (r <= 0) continue;
      const st = styleOf(el, selSet.has(el));
      const pts = circlePolyline(renderer, c.x, c.y, r, 0, 2 * Math.PI);
      pushPolyline(lines, pts, st, pxPerUnit);
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoPolygon) || !el.isDefined() || el.vertices.length < 3) continue;
    // 展开图的独立面多边形由 GeoNet3D 按 3D 顶点绘制，避免在 z=0 投影上重画
    if (el.parentAlgo instanceof AlgoPolyhedronNet) continue;
    const verts = faceFacingUp(el.vertices.map(v => to3(v.getX(), v.getY())));
    if (isVisibleFace(verts, renderer)) {
      fills.push({ verts, color: el.fillColor ?? el.defaultFillColor ?? 'rgba(59, 130, 246, 0.2)' });
    }
    const st = styleOf(el, selSet.has(el));
    for (let i = 0; i < el.vertices.length; i++) {
      const a = el.vertices[i];
      const b = el.vertices[(i + 1) % el.vertices.length];
      pushSegment(lines, a.getX(), a.getY(), b.getX(), b.getY(), st, pxPerUnit);
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoLocus) || !el.isDefined()) continue;
    const samples = el.getSamples();
    const st = styleOf(el, selSet.has(el));
    for (const seg of el.getSegments()) {
      for (let i = seg.start; i < seg.end && i < samples.length - 1; i++) {
        pushSegment(lines, samples[i].x, samples[i].y, samples[i + 1].x, samples[i + 1].y, st, pxPerUnit);
      }
    }
  }

  // C5：3D 空间轨迹（GeoLocus3D，采样含 z）
  for (const el of elements) {
    if (!(el instanceof GeoLocus3D) || !el.isDefined()) continue;
    const samples = el.getSamples();
    const st = styleOf(el, selSet.has(el));
    for (const seg of el.getSegments()) {
      for (let i = seg.start; i < seg.end && i < samples.length - 1; i++) {
        const a = samples[i];
        const b = samples[i + 1];
        lines.push({
          a: { x: a.x, y: a.y, z: a.z },
          b: { x: b.x, y: b.y, z: b.z },
          color: st.color,
          widthPx: st.width,
          dash: st.dash ? [...st.dash] : undefined,
        });
      }
    }
  }

  // ---- 世界空间裁剪盒（GeoGebra GeoClippingCube3D）----
  // 由相机可见范围 + 缩减档位计算：box 供片元严格裁剪，large 供无限直线段裁剪
  // （对齐 getIntervalClippedLarge：线比面略宽，避免边界自裁）。
  const clipping = computeClippingBox(renderer.getVisibleBounds3(), clipReduction);
  const clipBox = clipping.large;

  for (const el of elements) {
    if (!(el instanceof GeoLine3D) || !el.isDefined()) continue;
    const origin = el.getOrigin();
    const dir = el.getDirection();
    const clipped = clipLineToBox(origin, dir, clipBox);
    if (!clipped) continue;
    const a = origin.add(dir.scale(clipped.tMin));
    const b = origin.add(dir.scale(clipped.tMax));
    const st = styleOf(el, selSet.has(el));
    lines.push({
      a: { x: a.getX(), y: a.getY(), z: a.getZ() },
      b: { x: b.getX(), y: b.getY(), z: b.getZ() },
      color: st.color,
      widthPx: st.width,
      dash: st.dash ? [...st.dash] : undefined,
    });
  }

  for (const el of elements) {
    if (!(el instanceof GeoPlane3D) || !el.isDefined()) continue;
    const normal = el.getNormal();
    const d = el.getDistance();
    // 用内容包围盒中心投影到平面上作为板中心，板尺寸 = 内容跨度
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const cz = 0;
    const center = { x: cx, y: cy, z: cz };
    const nLen = Math.hypot(normal.x, normal.y, normal.z);
    if (nLen < 1e-12) continue;
    const n = { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen };
    const tProj = (d - (n.x * cx + n.y * cy + n.z * cz)) / nLen;
    const plateCenter = { x: cx + n.x * tProj, y: cy + n.y * tProj, z: cz + n.z * tProj };
    // 平面内两个正交基
    const ref = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    let u = { x: n.y * ref.z - n.z * ref.y, y: n.z * ref.x - n.x * ref.z, z: n.x * ref.y - n.y * ref.x };
    let v = { x: n.y * u.z - n.z * u.y, y: n.z * u.x - n.x * u.z, z: n.x * u.y - n.y * u.x };
    const ul = Math.hypot(u.x, u.y, u.z) || 1;
    const vl = Math.hypot(v.x, v.y, v.z) || 1;
    u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
    v = { x: v.x / vl, y: v.y / vl, z: v.z / vl };
    const half = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 1.6;
    const quad = [
      { x: plateCenter.x - u.x * half - v.x * half, y: plateCenter.y - u.y * half - v.y * half, z: plateCenter.z - u.z * half - v.z * half },
      { x: plateCenter.x + u.x * half - v.x * half, y: plateCenter.y + u.y * half - v.y * half, z: plateCenter.z + u.z * half - v.z * half },
      { x: plateCenter.x + u.x * half + v.x * half, y: plateCenter.y + u.y * half + v.y * half, z: plateCenter.z + u.z * half + v.z * half },
      { x: plateCenter.x - u.x * half + v.x * half, y: plateCenter.y - u.y * half + v.y * half, z: plateCenter.z - u.z * half + v.z * half },
    ];
    // 正面朝向相机（法向翻转使新法向指向相机）
    const eye = renderer.getEye();
    const plateNormal = { x: n.x, y: n.y, z: n.z };
    const toEye = { x: eye.x - plateCenter.x, y: eye.y - plateCenter.y, z: eye.z - plateCenter.z };
    const facing = plateNormal.x * toEye.x + plateNormal.y * toEye.y + plateNormal.z * toEye.z;
    fills.push({ verts: facing < 0 ? quad.slice().reverse() : quad, color: el.fillColor ?? 'rgba(16, 185, 129, 0.16)' });
    const st = styleOf(el, selSet.has(el));
    for (let i = 0; i < 4; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      lines.push({ a, b, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoPoint3D) || !el.isDefined()) continue;
    const sel = selSet.has(el);
    points.push({
      pos: { x: el.getX(), y: el.getY(), z: el.getZ() },
      color: el.strokeColor ?? el.defaultStrokeColor,
      radiusPx: sel ? 8 : 6,
      ring: sel ? { color: 'rgba(14, 165, 233, 0.35)', radiusPx: 14 } : undefined,
      label: el.labelVisible && el.labelMode === 'always' ? el.label || el.id : undefined,
    });
  }

  for (const el of elements) {
    if (!(el instanceof GeoQuadric3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    if (el.getKind() === 'ellipsoid') {
      const c = el.getBase();
      const [ra, rb, rc] = el.getRadii();
      const ellipse = (axes: [number, number], plane: 'xy' | 'xz' | 'yz') => {
        const pts: V3[] = [];
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
          const a = (2 * Math.PI * i) / steps;
          const u = Math.cos(a), v = Math.sin(a);
          pts.push(plane === 'xy'
            ? { x: c.getX() + u * ra, y: c.getY() + v * rb, z: c.getZ() }
            : plane === 'xz'
              ? { x: c.getX() + u * ra, y: c.getY(), z: c.getZ() + v * rc }
              : { x: c.getX(), y: c.getY() + u * rb, z: c.getZ() + v * rc });
          void axes;
        }
        pushPolyline(lines, pts, st, pxPerUnit);
      };
      ellipse([ra, rb], 'xy');
      ellipse([ra, rc], 'xz');
      ellipse([rb, rc], 'yz');
    } else if (el.getKind() === 'sphere') {
      const c = el.getBase();
      const r = el.getParam();
      const circle = (axis: 'x' | 'y' | 'z') => {
        const pts: V3[] = [];
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
          const a = (2 * Math.PI * i) / steps;
          const u = Math.cos(a) * r, v = Math.sin(a) * r;
          pts.push(axis === 'x' ? { x: c.getX(), y: c.getY() + u, z: c.getZ() + v }
            : axis === 'y' ? { x: c.getX() + u, y: c.getY(), z: c.getZ() + v }
              : { x: c.getX() + u, y: c.getY() + v, z: c.getZ() });
        }
        pushPolyline(lines, pts, st, pxPerUnit);
      };
      circle('x'); circle('y'); circle('z');
    } else if (el.getKind() === 'general') {
      // 一般二次曲面：未回填解析参时画三个坐标面 traces（径向符号变号近似）
      const m = el.getMatrix();
      if (m) {
        const Q = (x: number, y: number, z: number): number =>
          m[0] * x * x + m[1] * y * y + m[2] * z * z + m[3] +
          2 * m[4] * x * y + 2 * m[5] * x * z + 2 * m[6] * y * z +
          2 * m[7] * x + 2 * m[8] * y + 2 * m[9] * z;
        const center = el.getBase();
        const cx = center.getX(), cy = center.getY(), cz = center.getZ();
        const span = Math.min(
          clipBox.maxZ,
          Math.max(clipBox.maxX - clipBox.minX, clipBox.maxY - clipBox.minY) * 0.9,
          8,
        );
        // 每个固定坐标面：沿 36 条射线二分求 Q=0
        const traceOn = (
          plane: 'xy' | 'xz' | 'yz',
          fixed: number,
        ): V3[] => {
          const pts: V3[] = [];
          const rays = 72;
          for (let i = 0; i < rays; i++) {
            const ang = (2 * Math.PI * i) / rays;
            const dirU = Math.cos(ang), dirV = Math.sin(ang);
            // 沿 (u,v) 射线在 [0, span] 上找符号变号并二分
            const at = (t: number): number => {
              const u = t * dirU, v = t * dirV;
              if (plane === 'xy') return Q(cx + u, cy + v, fixed);
              if (plane === 'xz') return Q(cx + u, fixed, cz + v);
              return Q(fixed, cy + u, cz + v);
            };
            let lo = 0, hi = span;
            const f0 = at(0);
            // 粗扫
            let hit = false;
            let prevT = 0, prevF = f0;
            for (let s = 1; s <= 24; s++) {
              const t = (span * s) / 24;
              const f = at(t);
              if (prevF === 0 || (prevF < 0) !== (f < 0)) {
                lo = prevT; hi = t; hit = true; break;
              }
              prevT = t; prevF = f;
            }
            if (!hit) continue;
            for (let it = 0; it < 20; it++) {
              const mid = (lo + hi) / 2;
              if ((at(lo) < 0) !== (at(mid) < 0)) hi = mid;
              else lo = mid;
            }
            const t = (lo + hi) / 2;
            const u = t * dirU, v = t * dirV;
            if (plane === 'xy') pts.push({ x: cx + u, y: cy + v, z: fixed });
            else if (plane === 'xz') pts.push({ x: cx + u, y: fixed, z: cz + v });
            else pts.push({ x: fixed, y: cy + u, z: cz + v });
          }
          return pts;
        };
        // 中心所在三个坐标面 + 两个偏移面，给出体积感
        for (const fixed of [cz, cz + span * 0.35, cz - span * 0.35]) {
          const pts = traceOn('xy', fixed);
          if (pts.length >= 8) pushPolyline(lines, pts, st, pxPerUnit);
        }
        for (const fixed of [cy, cy + span * 0.35, cy - span * 0.35]) {
          const pts = traceOn('xz', fixed);
          if (pts.length >= 8) pushPolyline(lines, pts, st, pxPerUnit);
        }
        for (const fixed of [cx, cx + span * 0.35, cx - span * 0.35]) {
          const pts = traceOn('yz', fixed);
          if (pts.length >= 8) pushPolyline(lines, pts, st, pxPerUnit);
        }
      }
    } else {
      // 柱/锥：端点圆 + 母线；有限高时两端端盖圆盘填充
      const base = el.getBase();
      const axis = el.getAxis();
      const kind = el.getKind();
      const r = kind === 'cylinder' ? el.getParam() : 0;
      const tanHalf = kind === 'cone' ? Math.tan(el.getParam()) : 0;
      const limited = el.isLimited();
      const height = el.getHeight();
      // 有限：单侧 [0, h]；无限：对称 ±span 线框近似（span 取裁剪大盒量级）
      const span = Math.min(
        clipBox.maxZ,
        Math.max(clipBox.maxX - clipBox.minX, clipBox.maxY - clipBox.minY) * 0.9,
        Math.max(Math.abs(clipBox.minZ), 1) * 1.5,
      );
      const t0 = limited ? 0 : -span;
      const t1 = limited && height !== null ? height : span;
      const radiusAt = (t: number): number =>
        kind === 'cone' ? Math.abs(t) * tanHalf : r;
      const e1e2 = () => {
        const ref = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
        let e1 = { x: axis.y * ref.z - axis.z * ref.y, y: axis.z * ref.x - axis.x * ref.z, z: axis.x * ref.y - axis.y * ref.x };
        const l1 = Math.hypot(e1.x, e1.y, e1.z) || 1;
        e1 = { x: e1.x / l1, y: e1.y / l1, z: e1.z / l1 };
        const e2 = { x: axis.y * e1.z - axis.z * e1.y, y: axis.z * e1.x - axis.x * e1.z, z: axis.x * e1.y - axis.y * e1.x };
        return { e1, e2 };
      };
      const onRing = (t: number, ang: number, rad: number): V3 => {
        const { e1, e2 } = e1e2();
        const u = Math.cos(ang) * rad, v = Math.sin(ang) * rad;
        return {
          x: base.getX() + axis.x * t + e1.x * u + e2.x * v,
          y: base.getY() + axis.y * t + e1.y * u + e2.y * v,
          z: base.getZ() + axis.z * t + e1.z * u + e2.z * v,
        };
      };
      const ringPts = (t: number, rad: number): V3[] => {
        const pts: V3[] = [];
        const steps = 32;
        for (let i = 0; i <= steps; i++) {
          pts.push(onRing(t, (2 * Math.PI * i) / steps, rad));
        }
        return pts;
      };
      pushPolyline(lines, ringPts(t0, radiusAt(t0)), st, pxPerUnit);
      pushPolyline(lines, ringPts(t1, radiusAt(t1)), st, pxPerUnit);
      // 母线（4 条）：连接两端同角
      for (let k = 0; k < 4; k++) {
        const ang = (2 * Math.PI * k) / 4;
        const p1 = onRing(t1, ang, radiusAt(t1));
        const p2 = onRing(t0, ang, radiusAt(t0));
        lines.push({ a: p1, b: p2, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
      }
      // 有限体端盖：底 (t0) + 顶 (t1) 圆盘（锥底半径 0 时只画顶盖）
      if (limited && height !== null) {
        const fill = el.fillColor ?? el.defaultFillColor ?? 'rgba(236, 72, 153, 0.14)';
        const disk = (t: number, rad: number): V3[] => {
          if (rad < 1e-12) return [];
          const verts: V3[] = [onRing(t, 0, 0)];
          const steps = 32;
          for (let i = 0; i <= steps; i++) verts.push(onRing(t, (2 * Math.PI * i) / steps, rad));
          return verts;
        };
        const bottom = disk(t0, radiusAt(t0));
        const top = disk(t1, radiusAt(t1));
        if (bottom.length >= 3 && isVisibleFace(bottom, renderer)) {
          fills.push({ verts: bottom, color: fill });
        }
        if (top.length >= 3 && isVisibleFace(top, renderer)) {
          fills.push({ verts: top, color: fill });
        }
      }
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoPolyhedron3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    const v = el.vertices.map(p => ({ x: p.getX(), y: p.getY(), z: p.getZ() }));
    const n = el.baseCount();
    // 底面填充 + 侧面填充（棱锥）
    const baseFace = v.slice(0, n);
    if (baseFace.length >= 3) {
      if (isVisibleFace(baseFace, renderer)) {
        fills.push({ verts: baseFace, color: el.fillColor ?? el.defaultFillColor ?? 'rgba(168, 85, 247, 0.14)' });
      }
    }
    if (el.kind === 'pyramid' && v.length >= 4) {
      const apex = v[v.length - 1];
      for (let i = 0; i < n; i++) {
        const tri = [baseFace[i], baseFace[(i + 1) % n], apex];
        if (isVisibleFace(tri, renderer)) fills.push({ verts: tri, color: el.fillColor ?? el.defaultFillColor ?? 'rgba(168, 85, 247, 0.14)' });
      }
    } else if (el.kind === 'prism' && v.length >= 2 * n) {
      const top = v.slice(n);
      if (top.length >= 3 && isVisibleFace(top, renderer)) {
        fills.push({ verts: top, color: el.fillColor ?? el.defaultFillColor ?? 'rgba(168, 85, 247, 0.14)' });
      }
      for (let i = 0; i < n; i++) {
        const quad = [baseFace[i], baseFace[(i + 1) % n], top[(i + 1) % n], top[i]];
        if (isVisibleFace(quad, renderer)) fills.push({ verts: quad, color: el.fillColor ?? el.defaultFillColor ?? 'rgba(168, 85, 247, 0.14)' });
      }
    }
    // 边
    for (let i = 0; i < v.length; i++) {
      const a = v[i];
      const b = v[(i + 1) % n === 0 ? (i === n - 1 ? n : i + 1) : i + 1];
      if (i >= n - 1) continue;
      lines.push({ a, b, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
    }
    // 棱柱的竖直边 + 顶面边
    if (el.kind === 'prism' && v.length >= 2 * n) {
      const top = v.slice(n);
      for (let i = 0; i < n; i++) {
        lines.push({ a: baseFace[i], b: top[i], color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
        const a = top[i];
        const b = top[(i + 1) % n];
        lines.push({ a, b, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
      }
    }
    if (el.kind === 'pyramid' && v.length >= n + 1) {
      const apex = v[v.length - 1];
      for (let i = 0; i < n; i++) {
        lines.push({ a: baseFace[i], b: apex, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
      }
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoSurface) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    const grid = el.sampleGrid(18, 18);
    if (grid.length === 0) continue;
    const toV = (g: { x: number; y: number; z: number }) => ({ x: g.x, y: g.y, z: g.z });
    // u 方向线
    for (let j = 0; j <= 18; j++) {
      const pts: V3[] = [];
      for (let i = 0; i <= 18; i++) {
        const g = grid[i * 19 + j];
        if (g) pts.push(toV(g));
      }
      if (pts.length > 1) pushPolyline(lines, pts, st, pxPerUnit);
    }
    // v 方向线
    for (let i = 0; i <= 18; i++) {
      const pts: V3[] = [];
      for (let j = 0; j <= 18; j++) {
        const g = grid[i * 19 + j];
        if (g) pts.push(toV(g));
      }
      if (pts.length > 1) pushPolyline(lines, pts, st, pxPerUnit);
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoCircle3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    const pts: V3[] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const p = el.pointAt((2 * Math.PI * i) / steps);
      pts.push({ x: p.getX(), y: p.getY(), z: p.getZ() });
    }
    pushPolyline(lines, pts, st, pxPerUnit);
  }

  for (const el of elements) {
    if (!(el instanceof GeoConic3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    const pts: V3[] = [];
    const steps = 96;
    if (el.getKind() === 'ellipse') {
      for (let i = 0; i <= steps; i++) {
        const p = el.pointAt((2 * Math.PI * i) / steps);
        pts.push({ x: p.getX(), y: p.getY(), z: p.getZ() });
      }
    } else if (el.getKind() === 'parabola') {
      // 抛物线：t ∈ [-4, 4] 采样
      for (let i = 0; i <= steps; i++) {
        const t = -4 + (8 * i) / steps;
        const p = el.pointAt(t);
        pts.push({ x: p.getX(), y: p.getY(), z: p.getZ() });
      }
    } else {
      // 双曲线：两支各画一段
      for (const branch of [-1, 1]) {
        for (let i = 0; i <= steps; i++) {
          const u = branch * (-3 + (6 * i) / steps);
          const p = el.pointAt(u);
          pts.push({ x: p.getX(), y: p.getY(), z: p.getZ() });
        }
      }
    }
    pushPolyline(lines, pts, st, pxPerUnit);
  }

  for (const el of elements) {
    if (!(el instanceof GeoNet3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    const fill = el.fillColor ?? el.defaultFillColor ?? 'rgba(249, 115, 22, 0.15)';
    for (const face of el.faces) {
      const verts = face.map(p => ({ x: p.getX(), y: p.getY(), z: p.getZ() }));
      if (verts.length < 3) continue;
      if (isVisibleFace(verts, renderer)) fills.push({ verts, color: fill });
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        lines.push({ a, b, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
      }
    }
  }

  // C11：OFF 导入网格（面填充 + 线框）
  for (const el of elements) {
    if (!(el instanceof GeoMesh3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    el.faces.forEach((face, fi) => {
      const verts = face
        .map(idx => el.vertices[idx])
        .filter(Boolean)
        .map(p => ({ x: p.getX(), y: p.getY(), z: p.getZ() }));
      if (verts.length < 3) return;
      const faceFill = el.faceColors?.[fi] || el.fillColor || el.defaultFillColor || 'rgba(100, 116, 139, 0.22)';
      if (isVisibleFace(verts, renderer)) fills.push({ verts, color: faceFill });
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        lines.push({ a, b, color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
      }
    });
  }

  for (const el of elements) {
    if (!(el instanceof GeoPolyline3D) || !el.isDefined()) continue;
    const st = styleOf(el, selSet.has(el));
    const pts = el.points.map(p => ({ x: p.getX(), y: p.getY(), z: p.getZ() }));
    if (pts.length > 1) pushPolyline(lines, pts, st, pxPerUnit);
    if (el.isClosed() && pts.length > 2) {
      lines.push({ a: pts[pts.length - 1], b: pts[0], color: st.color, widthPx: st.width, dash: st.dash ? [...st.dash] : undefined });
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoPoint) || !el.isDefined()) continue;
    const sel = selSet.has(el);
    const color = el.strokeColor ?? el.defaultStrokeColor;
    points.push({
      pos: to3(el.getX(), el.getY()),
      color,
      radiusPx: sel ? 8 : 6,
      ring: sel ? { color: 'rgba(59, 130, 246, 0.35)', radiusPx: 14 } : undefined,
      label: el.labelVisible && el.labelMode === 'always' ? el.label || el.id : undefined,
    });
  }

  // 三坐标平面显示配置（GeoGebra 3D：XY 底部 / XZ / YZ 侧立，各自独立控制填充板）。
  const planes: Plane3[] = [];
  const plateXY = axesPlaneMode >= 2 && showXY;
  const plateXZ = axesPlaneMode >= 2 && showXZ;
  const plateYZ = axesPlaneMode >= 2 && showYZ;
  planes.push({ axis: 'xy', grid: showGrid && (axesPlaneMode === 3 || plateXY), plate: plateXY });
  planes.push({ axis: 'xz', grid: showGrid && plateXZ, plate: plateXZ });
  planes.push({ axis: 'yz', grid: showGrid && plateYZ, plate: plateYZ });

  return {
    gridBounds: viewBounds,
    contentBounds: bounds,
    showGrid,
    showAxes,
    planes,
    lines,
    fills,
    points,
    clippingBox: clipping,
    showClipBox,
    clipBoxColor: 'rgba(100,116,139,0.85)',
  };
}

function elementAnchor(el: GeoElement): V3 | null {
  if (el instanceof GeoSegment) {
    return to3((el.startPoint.getX() + el.endPoint.getX()) / 2, (el.startPoint.getY() + el.endPoint.getY()) / 2);
  }
  if (el instanceof GeoPolygon) {
    if (el.vertices.length === 0) return null;
    let sx = 0, sy = 0;
    for (const v of el.vertices) { sx += v.getX(); sy += v.getY(); }
    return to3(sx / el.vertices.length, sy / el.vertices.length);
  }
  if (el instanceof GeoConic) {
    const c = el.getCenter();
    return to3(c.x, c.y);
  }
  return null;
}

function drawLabels(scene: Scene3D, renderer: WebGL3DRenderer, canvas: HTMLCanvasElement, dpr: number, selected: readonly GeoElement[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontPx = Math.round(14 * dpr);
  const off = 14 * dpr;

  // 坐标轴标签
  if (scene.showAxes) {
    const axisLabels = renderer.getAxisLabelPositions(scene.gridBounds);
    for (const al of axisLabels) {
      ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
      ctx.fillStyle = al.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(al.label, al.x + 12 * dpr, al.y - 12 * dpr);
    }
    // 轴刻度数字（X / Y / Z 轴，正负两侧，间隔=主网格步长）
    const b = scene.gridBounds;
    const step = renderer.getGridStep(scene.gridBounds);
      ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
    ctx.textBaseline = 'middle';
    const xMin = Math.min(0, b.minX);
    const xMax = Math.max(0, b.maxX);
    const yMin = Math.min(0, b.minY);
    const yMax = Math.max(0, b.maxY);
    const zMax = renderer.zExtent(b);
    const zMin = -zMax;
    for (let x = Math.ceil(xMin / step) * step; x <= xMax + 1e-9; x += step) {
      const sp = renderer.projectToScreen({ x, y: 0, z: 0 });
      if (!sp) continue;
      ctx.fillStyle = '#1c1c1f';
      ctx.textAlign = 'center';
      ctx.fillText(fmtNum(x), sp.x, sp.y + 14 * dpr);
    }
    for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step) {
      const sp = renderer.projectToScreen({ x: 0, y: -y, z: 0 });
      if (!sp) continue;
      ctx.fillStyle = '#1c1c1f';
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(y), sp.x - 14 * dpr, sp.y);
    }
    for (let z = Math.ceil(zMin / step) * step; z <= zMax + 1e-9; z += step) {
      const sp = renderer.projectToScreen({ x: 0, y: 0, z });
      if (!sp) continue;
      ctx.fillStyle = '#1c1c1f';
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(z), sp.x - 14 * dpr, sp.y);
    }
  }

  // 点标签
  for (const p of scene.points) {
    if (!p.label) continue;
    const sp = renderer.projectToScreen(p.pos);
    if (!sp) continue;
    ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.fillStyle = '#1f2937';
    ctx.textBaseline = 'bottom';
    ctx.fillText(p.label, sp.x + off, sp.y - off);
  }

  // 选中元素标签
  for (const el of selected) {
    if (!el.labelVisible || el.labelMode !== 'always' || !el.label) continue;
    const anchor = elementAnchor(el);
    if (!anchor) continue;
    const sp = renderer.projectToScreen(anchor);
    if (!sp) continue;
    ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.fillStyle = '#1e40af';
    ctx.textBaseline = 'bottom';
    ctx.fillText(el.label, sp.x + off, sp.y - off);
  }
}

export const Geometry3DView: React.FC<Props> = ({ kernel, renderRev, selectedElements, setSelectedElements, showGrid, showAxes, setShowGrid, setShowAxes }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGL3DRenderer | null>(null);
  const dprRef = useRef(1);
  const fittedRef = useRef(false);
  const lastPointsRef = useRef<V3[]>([]);
  const dragRef = useRef<{ mode: 'none' | 'orbit' | 'pan'; lastX: number; lastY: number; moved: boolean }>({ mode: 'none', lastX: 0, lastY: 0, moved: false });
  const { t } = useLanguage();

  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('perspective');
  const [axesPlaneMode, setAxesPlaneMode] = useState(3); // 坐标轴+平面
  const [planeXY, setPlaneXY] = useState(true);
  const [planeXZ] = useState(false);
  const [planeYZ] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [tool3d, setTool3d] = useState<Tool3D>('select');
  const [showClipBox, setShowClipBox] = useState(false);
  const [clipReduction, setClipReduction] = useState<ClippingReduction>(REDUCTION_MEDIUM);
  const picks3dRef = useRef<Coords4[]>([]);
  const rotationFrameRef = useRef<number>(0);

  /** 切换工具时清空已收集的构造点。 */
  const selectTool3D = (tool: Tool3D): void => {
    picks3dRef.current = [];
    setTool3d(tool);
  };

  const propsRef = useRef({ renderRev, selectedElements, showGrid, showAxes, axesPlaneMode, planeXY, planeXZ, planeYZ, showClipBox, clipReduction });
  propsRef.current = { renderRev, selectedElements, showGrid, showAxes, axesPlaneMode, planeXY, planeXZ, planeYZ, showClipBox, clipReduction };

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const labels = labelRef.current;
    if (!renderer || !canvas || !labels) return;
    const { showGrid: sg, showAxes: sa, selectedElements: sel, axesPlaneMode: apm, planeXY: pxy, planeXZ: pxz, planeYZ: pyz, showClipBox: scb, clipReduction: cr } = propsRef.current;
    const scene = buildScene(kernel, sel, sg, sa, apm, pxy, pxz, pyz, scb, cr, renderer);
    if (!fittedRef.current) {
      renderer.fitScene(scene);
      fittedRef.current = true;
    }
    lastPointsRef.current = scene.points.map(p => p.pos);
    renderer.render(scene);
    drawLabels(scene, renderer, labels, dprRef.current, sel);
  }, [kernel]);

  const syncSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const cssW = el.clientWidth || 1;
    const cssH = el.clientHeight || 1;
    const canvas = canvasRef.current;
    const labels = labelRef.current;
    if (canvas) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      rendererRef.current?.resize(cssW * dpr, cssH * dpr);
    }
    if (labels) {
      labels.width = cssW * dpr;
      labels.height = cssH * dpr;
      labels.style.width = `${cssW}px`;
      labels.style.height = `${cssH}px`;
    }
    draw();
  }, [draw]);

  // 初始化 WebGL2 渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WebGL3DRenderer(canvas);
    rendererRef.current = renderer;
    fittedRef.current = false;
    syncSize();
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [syncSize]);

  // 尺寸同步
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncSize]);

  // 构造 / 选中 / 网格 / 裁剪盒开关变化时重绘
  useEffect(() => {
    draw();
  }, [draw, renderRev, selectedElements, showGrid, showAxes, planeXY, showClipBox, clipReduction]);

  // 投影模式变化
  useEffect(() => {
    rendererRef.current?.setProjectionMode(projectionMode);
    draw();
  }, [projectionMode, draw]);

  // 坐标轴平面模式变化
  useEffect(() => {
    const axes = axesPlaneMode === 1 || axesPlaneMode === 3;
    const plane = axesPlaneMode >= 2;
    setShowAxes(axes);
    setShowGrid(plane);
  }, [axesPlaneMode, setShowAxes, setShowGrid]);

  // 旋转动画
  useEffect(() => {
    if (rotationSpeed === 0) {
      if (rotationFrameRef.current) {
        cancelAnimationFrame(rotationFrameRef.current);
        rotationFrameRef.current = 0;
      }
      return;
    }
    let lastTime = 0;
    const animate = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const dt = time - lastTime;
      lastTime = time;
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.yaw += (rotationSpeed * 0.001 * dt);
        draw();
      }
      rotationFrameRef.current = requestAnimationFrame(animate);
    };
    rotationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (rotationFrameRef.current) cancelAnimationFrame(rotationFrameRef.current);
    };
  }, [rotationSpeed, draw]);

  // 标准视图切换
  const handleSetView = useCallback((view: StandardView) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setStandardView(view);
    draw();
  }, [draw]);

  // wheel 事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      draw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [draw]);

  /** 屏幕坐标 → 构造平面（z=0）或用户平面的交点；未命中任何平面时返回 null。 */
  const pickOnPlane = (clientX: number, clientY: number): Coords4 | null => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * dprRef.current;
    const sy = (clientY - rect.top) * dprRef.current;
    const ray = renderer.screenRay(sx, sy);

    // 优先命中用户定义的 GeoPlane3D（最近的正面交点）
    let best: Coords4 | null = null;
    let bestT = Infinity;
    for (const el of kernel.getConstruction().getElements()) {
      if (!(el instanceof GeoPlane3D) || !el.isDefined()) continue;
      const n = el.getNormal();
      const hit = rayPlaneIntersect(ray, n, el.getDistance());
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        best = Coords4.fromPoint(hit.point.x, hit.point.y, hit.point.z);
      }
    }
    if (best) return best;
    // 回退：构造平面 z=0
    const z0 = rayPlaneIntersect(ray, { x: 0, y: 0, z: 1 }, 0);
    if (z0) return Coords4.fromPoint(z0.point.x, z0.point.y, z0.point.z);
    return null;
  };

  /** 屏幕坐标 → 最近 3D 点（命中半径内）。 */
  const pickPoint3D = (clientX: number, clientY: number): GeoPoint3D | null => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dprRef.current;
    const y = (clientY - rect.top) * dprRef.current;
    const hitR = 14 * dprRef.current;
    let best: GeoPoint3D | null = null;
    let bestDist = hitR;
    // 裁剪盒外的点不可见也不可拾取（与片元裁剪一致）
    const clip = computeClippingBox(renderer.getVisibleBounds3(), clipReduction);
    for (const el of kernel.getConstruction().getElements()) {
      if (!(el instanceof GeoPoint3D) || !el.isDefined()) continue;
      if (!isPointInBox({ x: el.getX(), y: el.getY(), z: el.getZ() }, clip.box)) continue;
      const sp = renderer.projectToScreen({ x: el.getX(), y: el.getY(), z: el.getZ() });
      if (sp && Math.hypot(sp.x - x, sp.y - y) < bestDist) {
        bestDist = Math.hypot(sp.x - x, sp.y - y);
        best = el;
      }
    }
    return best;
  };

  /** 建一个带标签的 3D 自由点并注册到构造。 */
  const addPoint3D = (coords: Coords4): GeoPoint3D => {
    const point = new GeoPoint3D(kernel, coords);
    point.label = kernel.getConstruction().getNextPointLabel();
    kernel.getConstruction().addElement(point);
    return point;
  };

  /** 依据工具与收集到的点构造对象（含数值参数提示）。 */
  const build3DObject = (tool: Tool3D, picks: Coords4[]): void => {
    const c = kernel.getConstruction();
    const pts = picks.map(p => addPoint3D(p));
    let algo: AlgoElement | null = null;
    const finish = () => {
      if (!algo) return;
      c.addElement(algo);
      algo.getGeoElements().forEach(out => {
        c.addElement(out);
        kernel.notifyUpdate(out);
      });
      draw();
    };
    switch (tool) {
      case 'point':
        kernel.notifyUpdate(pts[0]);
        draw();
        return;
      case 'segment':
      case 'line':
        algo = new AlgoJoinPoints3D(kernel, pts[0], pts[1], tool === 'segment');
        break;
      case 'midpoint':
        algo = new AlgoMidpoint3D(kernel, pts[0], pts[1]);
        break;
      case 'plane':
        algo = new AlgoPlaneThreePoints3D(kernel, pts[0], pts[1], pts[2]);
        break;
      case 'sphere':
        algo = new AlgoSphere3D(kernel, pts[0], pts[1]);
        break;
      case 'cylinder':
      case 'cone': {
        const raw = window.prompt(t(TOOL3D_CONFIG[tool].finalPrompt!), '1');
        if (raw === null) return;
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        const axis = new GeoLine3D(kernel, pts[0].getCoords3(), pts[1].getCoords3().sub(pts[0].getCoords3()).normalize());
        c.addElement(axis);
        algo = tool === 'cylinder'
          ? new AlgoCylinder3D(kernel, axis, value)
          : new AlgoCone3D(kernel, axis, (value * Math.PI) / 180);
        break;
      }
      case 'prism': {
        const raw = window.prompt(t(TOOL3D_CONFIG[tool].finalPrompt!), '3');
        if (raw === null) return;
        const height = Number(raw);
        if (!Number.isFinite(height)) return;
        algo = new AlgoPrism3D(kernel, pts.slice(0, 3), height);
        break;
      }
      case 'pyramid':
        algo = new AlgoPyramid3D(kernel, pts.slice(0, 3), pts[3]);
        break;
      default:
        return;
    }
    finish();
  };

  /** 点击处理：构造工具按步骤收集平面上的点；select 工具选中最近 3D 点。 */
  const handleClick = (clientX: number, clientY: number): void => {
    if (tool3d !== 'select') {
      const config = TOOL3D_CONFIG[tool3d];
      const hit = pickOnPlane(clientX, clientY);
      if (!hit) return;
      picks3dRef.current = [...picks3dRef.current, hit];
      if (picks3dRef.current.length >= config.points) {
        build3DObject(tool3d, picks3dRef.current);
        picks3dRef.current = [];
      }
      draw();
      return;
    }
    const picked = pickPoint3D(clientX, clientY);
    setSelectedElements?.(picked ? [picked] : []);
    draw();
  };

  // 构造工具进行中按 Esc 取消当前步骤
  useEffect(() => {
    if (tool3d === 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        picks3dRef.current = [];
        draw();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool3d, draw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    canvas.style.cursor = 'grabbing';
    dragRef.current = { mode: 'none', lastX: e.clientX, lastY: e.clientY, moved: false };
    if (e.button === 1 || e.shiftKey) {
      dragRef.current.mode = 'pan';
    } else if (e.button === 0) {
      dragRef.current.mode = 'orbit';
    }
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none') return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (drag.mode === 'orbit') renderer.orbit(dx, dy);
    else renderer.pan(dx, dy);
    draw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const wasClick = !drag.moved && drag.mode === 'orbit';
    dragRef.current.mode = 'none';
    e.currentTarget.style.cursor = 'grab';
    if (wasClick) handleClick(e.clientX, e.clientY);
  };

  const handleDoubleClick = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.fitScene({ gridBounds: computeBounds(kernel.getConstruction().getElements()) });
    draw();
  };

  // 当前相机朝向（用于导航方块）
  const orientation = rendererRef.current?.getOrientation() ?? { yaw: 0, pitch: 0.6 };

  return (
    <div ref={containerRef} className="absolute inset-0 z-[3] bg-white overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
        style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas ref={labelRef} className="absolute inset-0 pointer-events-none" />

      {/* ── 左上角标识 ── */}
      <div className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none">
        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">3D</span>
        <span className="text-xs text-gray-500">{t('view3D')}</span>
      </div>

      {/* ── 右上角：导航方块 ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
        <NavigationCube yaw={orientation.yaw} pitch={orientation.pitch} onSetView={handleSetView} />
      </div>

      {/* ── 右侧：3D 工具栏 ── */}
      <Geometry3DToolbar
        projectionMode={projectionMode}
        setProjectionMode={setProjectionMode}
        onSetView={handleSetView}
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        axesPlaneMode={axesPlaneMode}
        setAxesPlaneMode={setAxesPlaneMode}
        planeXY={planeXY}
        setPlaneXY={setPlaneXY}
        rotationSpeed={rotationSpeed}
        setRotationSpeed={setRotationSpeed}
        showClipBox={showClipBox}
        setShowClipBox={setShowClipBox}
        clipReduction={clipReduction}
        setClipReduction={setClipReduction}
        t={t}
      />

      {/* ── 顶部：3D 构造工具栏（与 2D 工具栏同风格）── */}
      <div data-testid="toolbar3d" className="absolute top-0 left-0 right-0 h-12 bg-white border-b border-gray-200 px-2 flex items-center gap-1 overflow-x-auto z-30 shadow-sm">
        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold shrink-0">3D</span>
        {([
          ['select', '⌖'],
          ['point', '•'],
          ['segment', '▔'],
          ['line', '╱'],
          ['midpoint', '◉'],
        ] as [Tool3D, string][]).map(([tool, glyph]) => (
          <button
            key={tool}
            onClick={() => selectTool3D(tool)}
            aria-label={t(TOOL3D_CONFIG[tool].labelKey)}
            title={t(TOOL3D_CONFIG[tool].labelKey)}
            className={`shrink-0 flex items-center gap-1 px-2 h-8 rounded text-xs transition-colors ${
              tool3d === tool ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="text-sm leading-none">{glyph}</span>
            <span className="hidden md:inline">{t(TOOL3D_CONFIG[tool].labelKey)}</span>
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 shrink-0 mx-1" />
        {([
          ['plane', '▱'],
          ['sphere', '●'],
          ['cylinder', '▮'],
          ['cone', '▲'],
          ['prism', '▬'],
          ['pyramid', '◆'],
        ] as [Tool3D, string][]).map(([tool, glyph]) => (
          <button
            key={tool}
            onClick={() => selectTool3D(tool)}
            aria-label={t(TOOL3D_CONFIG[tool].labelKey)}
            title={t(TOOL3D_CONFIG[tool].labelKey)}
            className={`shrink-0 flex items-center gap-1 px-2 h-8 rounded text-xs transition-colors ${
              tool3d === tool ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="text-sm leading-none">{glyph}</span>
            <span className="hidden md:inline">{t(TOOL3D_CONFIG[tool].labelKey)}</span>
          </button>
        ))}
      </div>

      {/* ── 底部提示：视图操作 / 当前工具的逐步指引 ── */}
      <div className="absolute bottom-3 left-4 pointer-events-none text-xs text-gray-400 bg-white/70 px-2 py-1 rounded">
        {tool3d !== 'select' && picks3dRef.current.length > 0
          ? t('tool3dStepHint').replace('{current}', String(picks3dRef.current.length + 1))
            .replace('{total}', String(TOOL3D_CONFIG[tool3d].points))
          : tool3d !== 'select'
            ? t('tool3dStepHint').replace('{current}', '1').replace('{total}', String(TOOL3D_CONFIG[tool3d].points)) + ' · ' + t('tool3dEsc')
            : t('view3dHint')}
      </div>
    </div>
  );
};

export default Geometry3DView;
