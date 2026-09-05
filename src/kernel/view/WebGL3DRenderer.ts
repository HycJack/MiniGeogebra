/**
 * WebGL3DRenderer —— 独立的 WebGL2 三维渲染后端。
 *
 * 坐标约定（与 2D 世界坐标保持一致）：
 *   - 构造元素位于 z=0 平面：3D (x, y, z) = (worldX, -worldY, 0)
 *   - 相机：轨道相机（yaw 绕 Z 轴 / pitch 俯仰 / 距离缩放）
 *
 * 渲染策略：画家算法（网格 → 填充 → 线 → 点），无深度缓冲。
 * 支持透视 / 正交投影切换。
 */

/** 三维点。 */
export interface V3 { x: number; y: number; z: number; }

/** 三维线段。 */
export interface Line3 { a: V3; b: V3; color: string; widthPx: number; dash?: number[]; }

/** 三维填充面片。 */
export interface Fill3 { verts: V3[]; color: string; }

/** 坐标平面标识：XY(底部, z=0) / XZ(侧立, y=0) / YZ(侧立, x=0)。 */
export type PlaneAxis = 'xy' | 'xz' | 'yz';

/** 坐标平面显示配置。 */
export interface Plane3 {
  axis: PlaneAxis;
  /** 是否显示网格线。 */
  grid: boolean;
  /** 是否显示半透明填充板。 */
  plate: boolean;
}

/** 坐标轴端点标签。 */
export interface AxisEnd3 {
  pos: V3;
  color: string;
}

/** 三维点精灵。 */
export interface Point3 {
  pos: V3;
  color: string;
  radiusPx: number;
  ring?: { color: string; radiusPx: number };
  label?: string;
}

/** 一帧的完整 3D 场景描述。 */
export interface Scene3D {
  /** 当前相机可见的 XY 世界范围；网格和轴使用它，而不是元素包围盒。 */
  gridBounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** 构造内容包围盒，仅用于“适配内容”。 */
  contentBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  showGrid: boolean;
  showAxes: boolean;
  /** 三坐标平面显示配置（XY / XZ / YZ 各自控制网格与填充板）。 */
  planes: Plane3[];
  lines: Line3[];
  fills: Fill3[];
  points: Point3[];
}

/** 屏幕投影结果。 */
export interface ScreenProject { x: number; y: number; ndcZ: number; clipW: number; }

/** 投影模式。 */
export type ProjectionMode = 'perspective' | 'orthographic';

/** 标准视图预设。 */
export type StandardView = 'home' | 'xy' | 'xz' | 'yz';

interface ProgramInfo {
  program: WebGLProgram;
  attribs: { pos: GLint; col: GLint; corner?: GLint; scale?: GLint };
  uniforms: { mvp: WebGLUniformLocation | null; pixel?: WebGLUniformLocation | null };
}

type Mat4 = Float32Array;

const FOV_Y = (45 * Math.PI) / 180;
const NEAR = 1;
const FAR = 10000;

/** 坐标轴颜色（GeoGebra 3D：X 红 / Y 绿 / Z 蓝）。 */
const AXIS_X = '#ff0000';
const AXIS_Y = '#008000';
const AXIS_Z = '#0000ff';

/** GeoGebra 网格与坐标轴默认色。 */
const GRID_MAIN_COLOR = '#b4b3ba';
const GRID_MINOR_COLOR = 'rgba(180, 179, 186, 0.24)';
const PLANE_EDGE_COLOR = 'rgba(28, 28, 31, 0.24)';

/** 坐标平面填充色（GeoGebra 风格：XY 灰 / XZ 偏红 / YZ 偏绿，半透明）。 */
const PLANE_XY_FILL = 'rgba(203, 209, 218, 0.28)';
const PLANE_XZ_FILL = 'rgba(239, 68, 68, 0.14)';
const PLANE_YZ_FILL = 'rgba(34, 197, 94, 0.14)';

/** 坐标系与画布边缘留出的比例；两侧共留 2 × 6% 的显示边距。 */
const VIEWPORT_PADDING_RATIO = 0.06;

export class WebGL3DRenderer {
  private gl: WebGL2RenderingContext;
  private triProg: ProgramInfo;
  private pointProg: ProgramInfo;
  private triVbo: WebGLBuffer | null = null;
  private pointVbo: WebGLBuffer | null = null;
  private triCapacity = 0;
  private pointCapacity = 0;

  private width = 1;
  private height = 1;

  /** 相机状态。 */
  yaw = 0;
  pitch = 0.6;
  dist = 600;
  target: V3 = { x: 0, y: 0, z: 0 };

  /** 投影模式。 */
  projectionMode: ProjectionMode = 'perspective';

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 context not available for 3D view');
    this.gl = gl;
    this.triProg = this.buildProgram(gl, triVertexSource, triFragmentSource, ['a_pos', 'a_col']);
    this.pointProg = this.buildProgram(gl, pointVertexSource, triFragmentSource, ['a_pos', 'a_col', 'a_corner', 'a_scale']);
    this.triVbo = gl.createBuffer();
    this.pointVbo = gl.createBuffer();
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  // ---------------------------------------------------------------- 生命周期

  resize(w: number, h: number): void {
    if (!w || !h) return;
    const canvas = this.gl.canvas as HTMLCanvasElement;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.width = w;
    this.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  dispose(): void {
    const gl = this.gl;
    try {
      if (this.triProg.program) gl.deleteProgram(this.triProg.program);
      if (this.pointProg.program) gl.deleteProgram(this.pointProg.program);
      if (this.triVbo) gl.deleteBuffer(this.triVbo);
      if (this.pointVbo) gl.deleteBuffer(this.pointVbo);
    } catch { /* noop */ }
  }

  // ---------------------------------------------------------------- 投影模式

  setProjectionMode(mode: ProjectionMode): void {
    this.projectionMode = mode;
  }

  // ---------------------------------------------------------------- 标准视图

  setStandardView(view: StandardView): void {
    switch (view) {
      case 'home':
        this.yaw = 0;
        this.pitch = 0.6;
        break;
      case 'xy': // 俯视 XY 平面
        this.yaw = 0;
        this.pitch = Math.PI / 2 - 0.01;
        break;
      case 'xz': // 正面看 XZ 平面
        this.yaw = 0;
        this.pitch = 0.01;
        break;
      case 'yz': // 右侧看 YZ 平面
        this.yaw = Math.PI / 2;
        this.pitch = 0.01;
        break;
    }
  }

  // ---------------------------------------------------------------- 坐标轴标签辅助

  /** 返回各轴端点的屏幕坐标（用于 2D overlay 绘制轴标签）。 */
  getAxisLabelPositions(bounds: { minX: number; maxX: number; minY: number; maxY: number }): { label: string; x: number; y: number; color: string }[] {
    const xExt = this.axisExtent('x');
    const yExt = this.axisExtent('y');
    const zMax = this.axisExtent('z');
    const labels: { label: string; x: number; y: number; color: string }[] = [];
    const axes: { label: string; pos: V3; color: string }[] = [
      { label: 'X', pos: { x: xExt, y: 0, z: 0 }, color: AXIS_X },
      { label: 'Y', pos: { x: 0, y: yExt, z: 0 }, color: AXIS_Y },
      { label: 'Z', pos: { x: 0, y: 0, z: zMax }, color: AXIS_Z },
    ];
    for (const a of axes) {
      const sp = this.projectToScreen(a.pos);
      if (sp) labels.push({ label: a.label, x: sp.x, y: sp.y, color: a.color });
    }
    return labels;
  }

  /** 由 XY 包围盒估算 Z 轴视觉高度（与 XY 范围相当）。 */
  zExtent(bounds: { minX: number; maxX: number; minY: number; maxY: number }): number {
    void bounds;
    return this.axisExtent('z');
  }

  /** 返回当前相机朝向（用于导航方块）。 */
  getOrientation(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  // ---------------------------------------------------------------- 相机控制

  /** 拖拽旋转（dx/dy 为像素位移）。 */
  orbit(dxPx: number, dyPx: number): void {
    this.yaw += dxPx * 0.008;
    this.pitch = Math.max(-0.1, Math.min(1.5, this.pitch + dyPx * 0.008));
  }

  /** 滚轮缩放（factor > 1 拉近）。 */
  zoom(factor: number): void {
    this.dist = Math.max(20, Math.min(5000, this.dist * factor));
  }

  /** 平移（dx/dy 为像素位移）。 */
  pan(dxPx: number, dyPx: number): void {
    const wpp = this.worldPerPixelAt(this.target) || 1;
    const eye = this.getEye();
    const fwd = norm3(sub3(this.target, eye));
    const right = norm3(cross3(fwd, { x: 0, y: 0, z: 1 }));
    const up = cross3(right, fwd);
    this.target = add3(this.target, scale3(right, -dxPx * wpp));
    this.target = add3(this.target, scale3(up, dyPx * wpp));
  }

  /** 根据场景范围重置相机。 */
  fitScene(scene: Pick<Scene3D, 'gridBounds'>): void {
    const content = (scene as Scene3D).contentBounds;
    const b = content ?? scene.gridBounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    this.target = { x: cx, y: -cy, z: 0 };
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
    this.dist = Math.max(60, (span / 2 / Math.tan(FOV_Y / 2)) * 1.25);
    this.yaw = 0;
    this.pitch = 0.6;
  }

  getEye(): V3 {
    const cp = Math.cos(this.pitch);
    return {
      x: this.target.x + this.dist * Math.sin(this.yaw) * cp,
      y: this.target.y + this.dist * -Math.cos(this.yaw) * cp,
      z: this.target.z + this.dist * Math.sin(this.pitch),
    };
  }

  /** 当前 3D 显示区域覆盖的 XY 平面范围（网格使用）。 */
  getViewBoundsXY(): { minX: number; maxX: number; minY: number; maxY: number } {
    const b = this.visiblePlaneBounds('xy', { padded: false });
    return { minX: b.uMin, maxX: b.uMax, minY: -b.vMax, maxY: -b.vMin };
  }

  /** 坐标轴/坐标平面使用的内缩范围。 */
  getCoordinateBoundsXY(): { minX: number; maxX: number; minY: number; maxY: number } {
    const b = this.visiblePlaneBounds('xy', { padded: true });
    return { minX: b.uMin, maxX: b.uMax, minY: -b.vMax, maxY: -b.vMin };
  }

  /** 当前相机可见的单个坐标平面范围。 */
  private visiblePlaneBounds(axis: PlaneAxis, options?: { padded?: boolean }): { uMin: number; uMax: number; vMin: number; vMax: number } {
    const corners: { nx: number; ny: number }[] = [
      { nx: -1, ny: -1 }, { nx: 1, ny: -1 }, { nx: 1, ny: 1 }, { nx: -1, ny: 1 },
    ];
    const pts: V3[] = [];
    const eye = this.getEye();
    const fwd = norm3(sub3(this.target, eye));
    const right = norm3(cross3(fwd, { x: 0, y: 0, z: 1 }));
    const up = cross3(right, fwd);
    const tanHalf = Math.tan(FOV_Y / 2);
    const halfH = this.dist * tanHalf;
    const halfW = halfH * (this.width / Math.max(1, this.height));
    const normal = axis === 'xy' ? { x: 0, y: 0, z: 1 } : axis === 'xz' ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const planeOffset = axis === 'xy' ? this.target.z : axis === 'xz' ? this.target.y : this.target.x;
    // 网格铺满整个 3D 显示区域；坐标轴/坐标平面略小，边缘保留空白。
    const visibleNdcExtent = options?.padded === false ? 1 : 1 - VIEWPORT_PADDING_RATIO * 2;
    const maxRadius = Math.max(this.dist * 3, halfH * 3, 200);

    for (const c of corners) {
      let origin: V3;
      let dir: V3;
      if (this.projectionMode === 'orthographic') {
        origin = add3(eye, add3(scale3(right, c.nx * halfW * visibleNdcExtent), scale3(up, c.ny * halfH * visibleNdcExtent)));
        dir = fwd;
      } else {
        dir = norm3(add3(fwd, add3(
          scale3(right, c.nx * tanHalf * (this.width / Math.max(1, this.height)) * visibleNdcExtent),
          scale3(up, c.ny * tanHalf * visibleNdcExtent),
        )));
        origin = eye;
      }
      const denom = dot3(dir, normal);
      if (Math.abs(denom) < 1e-5) continue;
      const t = (planeOffset - dot3(origin, normal)) / denom;
      if (!Number.isFinite(t) || t <= 0) continue;
      const p = add3(origin, scale3(dir, t));
      if (dist3(p, this.target) > maxRadius) continue;
      pts.push(p);
    }

    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const p of pts) {
      const uv = this.planeUV(axis, p);
      uMin = Math.min(uMin, uv.u); uMax = Math.max(uMax, uv.u);
      vMin = Math.min(vMin, uv.v); vMax = Math.max(vMax, uv.v);
    }
    if (!pts.length || !Number.isFinite(uMin) || !Number.isFinite(vMin)) {
      return this.fallbackPlaneBounds(axis);
    }
    // 近乎平行/穿过平面时，交点会迅速发散。收敛到相机附近可保证网格数量稳定。
    return this.clampPlaneBounds(axis, { uMin, uMax, vMin, vMax });
  }

  private planeUV(axis: PlaneAxis, p: V3): { u: number; v: number } {
    if (axis === 'xy') return { u: p.x, v: -p.y };
    if (axis === 'xz') return { u: p.x, v: p.z };
    return { u: p.y, v: p.z };
  }

  private fallbackPlaneBounds(axis: PlaneAxis): { uMin: number; uMax: number; vMin: number; vMax: number } {
    const tanHalf = Math.tan(FOV_Y / 2);
    const halfH = this.dist * tanHalf;
    const halfW = halfH * (this.width / Math.max(1, this.height));
    if (axis === 'xy') {
      return { uMin: this.target.x - halfW, uMax: this.target.x + halfW, vMin: -this.target.y - halfH, vMax: -this.target.y + halfH };
    }
    if (axis === 'xz') {
      return { uMin: this.target.x - halfW, uMax: this.target.x + halfW, vMin: this.target.z - halfH, vMax: this.target.z + halfH };
    }
    return { uMin: this.target.y - halfW, uMax: this.target.y + halfW, vMin: this.target.z - halfH, vMax: this.target.z + halfH };
  }

  private clampPlaneBounds(axis: PlaneAxis, b: { uMin: number; uMax: number; vMin: number; vMax: number }) {
    const targetUV = this.planeUV(axis, this.target);
    const halfH = this.dist * Math.tan(FOV_Y / 2);
    const halfW = halfH * (this.width / Math.max(1, this.height));
    const uLimit = Math.max(halfW * 1.5, 40);
    const vLimit = Math.max(halfH * 1.5, 40);
    return {
      uMin: Math.max(targetUV.u - uLimit, b.uMin),
      uMax: Math.min(targetUV.u + uLimit, b.uMax),
      vMin: Math.max(targetUV.v - vLimit, b.vMin),
      vMax: Math.min(targetUV.v + vLimit, b.vMax),
    };
  }

  /** 某条坐标轴相对原点的正/负可见半径。 */
  private axisExtent(axis: 'x' | 'y' | 'z'): number {
    if (axis === 'z') {
      const xz = this.visiblePlaneBounds('xz', { padded: true });
      const yz = this.visiblePlaneBounds('yz', { padded: true });
      return Math.max(Math.abs(xz.vMin), Math.abs(xz.vMax), Math.abs(yz.vMin), Math.abs(yz.vMax), 20);
    }
    const xy = this.visiblePlaneBounds('xy', { padded: true });
    return axis === 'x'
      ? Math.max(Math.abs(xy.uMin), Math.abs(xy.uMax), 20)
      : Math.max(Math.abs(xy.vMin), Math.abs(xy.vMax), 20);
  }

  /** 世界坐标 → 屏幕坐标（设备像素）。 */
  projectToScreen(p: V3): ScreenProject | null {
    if (this.width <= 0) return null;
    const mvp = this.mvpMatrix();
    const clip = {
      x: mvp[0] * p.x + mvp[4] * p.y + mvp[8] * p.z + mvp[12],
      y: mvp[1] * p.x + mvp[5] * p.y + mvp[9] * p.z + mvp[13],
      z: mvp[2] * p.x + mvp[6] * p.y + mvp[10] * p.z + mvp[14],
      w: mvp[3] * p.x + mvp[7] * p.y + mvp[11] * p.z + mvp[15],
    };
    if (clip.w <= 1e-6) return null;
    const nx = clip.x / clip.w;
    const ny = clip.y / clip.w;
    if (nx < -1.5 || nx > 1.5 || ny < -1.5 || ny > 1.5) return null;
    return { x: ((nx + 1) / 2) * this.width, y: ((1 - ny) / 2) * this.height, ndcZ: clip.z / clip.w, clipW: clip.w };
  }

  // ---------------------------------------------------------------- 渲染

  render(scene: Scene3D): void {
    const gl = this.gl;
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const gridLines: Line3[] = [];
    const planeFills: Fill3[] = [];
    if (scene.showGrid || scene.showAxes) this.buildGrid(scene, gridLines);
    this.buildPlanes(scene, planeFills, gridLines);

    // 画家算法：平面填充板 → 网格线 → 元素填充 → 元素线 → 点。
    // 平面填充先画（作为背景），网格线叠加在填充板之上。
    this.drawTriangles(this.fillTriangles(planeFills));
    this.drawTriangles(this.gridTriangles(gridLines));
    this.drawTriangles(this.fillTriangles(scene.fills));
    this.drawTriangles(this.lineTriangles(scene.lines));
    this.drawPoints(scene.points, this.mvpMatrix());
  }

  // ---------------------------------------------------------------- 场景转换

  private buildGrid(scene: Scene3D, out: Line3[]): void {
    // 坐标轴仍限制在内缩的坐标系矩形内；只有网格铺满显示区域。
    const b = this.getCoordinateBoundsXY();
    const step = this.gridStep(b);
    const xMin = Math.min(0, b.minX);
    const xMax = Math.max(0, b.maxX);
    const yMin = Math.min(0, b.minY);
    const yMax = Math.max(0, b.maxY);
    const zMax = this.axisExtent('z');
    const zMin = -zMax;
    const wpp = this.worldPerPixelAt(this.target) || 1;

    if (scene.showAxes) {
      // 三坐标轴都从原点双向延伸到当前视野边缘。
      out.push({ a: { x: xMin, y: 0, z: 0 }, b: { x: xMax, y: 0, z: 0 }, color: AXIS_X, widthPx: 2.4 });
      out.push({ a: { x: 0, y: -yMax, z: 0 }, b: { x: 0, y: -yMin, z: 0 }, color: AXIS_Y, widthPx: 2.4 });
      out.push({ a: { x: 0, y: 0, z: zMin }, b: { x: 0, y: 0, z: zMax }, color: AXIS_Z, widthPx: 2.4 });

      // 正方向箭头（屏幕空间三角，绘制在轴端点）
      this.axisArrows(out, { x: xMax, y: 0, z: 0 }, { x: 0, y: -yMax, z: 0 }, { x: 0, y: 0, z: zMax });

      // 刻度标记：正负两侧都生成，Z 轴也完整生成。
      const tickLen = 6 * wpp;
      for (let x = Math.ceil(xMin / step) * step; x <= xMax + 1e-9; x += step) {
        if (Math.abs(x) < 1e-9) continue;
        this.pushTick(out, { x, y: 0, z: 0 }, { x, y: tickLen, z: 0 }, AXIS_X);
        this.pushTick(out, { x, y: 0, z: 0 }, { x, y: -tickLen, z: 0 }, AXIS_X);
      }
      for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step) {
        if (Math.abs(y) < 1e-9) continue;
        this.pushTick(out, { x: 0, y: -y, z: 0 }, { x: tickLen, y: -y, z: 0 }, AXIS_Y);
        this.pushTick(out, { x: 0, y: -y, z: 0 }, { x: -tickLen, y: -y, z: 0 }, AXIS_Y);
      }
      const zTickLen = 5 * wpp;
      const minorTickLen = 3 * wpp;
      const minorStep = step / 5;
      for (let x = Math.ceil(xMin / minorStep) * minorStep; x <= xMax + 1e-9; x += minorStep) {
        if (Math.abs(x) < 1e-9 || Math.abs(x / step - Math.round(x / step)) < 1e-9) continue;
        this.pushTick(out, { x, y: 0, z: 0 }, { x, y: minorTickLen, z: 0 }, AXIS_X);
        this.pushTick(out, { x, y: 0, z: 0 }, { x, y: -minorTickLen, z: 0 }, AXIS_X);
      }
      for (let y = Math.ceil(yMin / minorStep) * minorStep; y <= yMax + 1e-9; y += minorStep) {
        if (Math.abs(y) < 1e-9 || Math.abs(y / step - Math.round(y / step)) < 1e-9) continue;
        this.pushTick(out, { x: 0, y: -y, z: 0 }, { x: minorTickLen, y: -y, z: 0 }, AXIS_Y);
        this.pushTick(out, { x: 0, y: -y, z: 0 }, { x: -minorTickLen, y: -y, z: 0 }, AXIS_Y);
      }
      for (let z = Math.ceil(zMin / step) * step; z <= zMax + 1e-9; z += step) {
        if (Math.abs(z) < 1e-9) continue;
        this.pushTick(out, { x: 0, y: 0, z }, { x: zTickLen, y: 0, z }, AXIS_Z);
        this.pushTick(out, { x: 0, y: 0, z }, { x: -zTickLen, y: 0, z }, AXIS_Z);
      }
      for (let z = Math.ceil(zMin / minorStep) * minorStep; z <= zMax + 1e-9; z += minorStep) {
        if (Math.abs(z) < 1e-9 || Math.abs(z / step - Math.round(z / step)) < 1e-9) continue;
        this.pushTick(out, { x: 0, y: 0, z }, { x: minorTickLen, y: 0, z }, AXIS_Z);
        this.pushTick(out, { x: 0, y: 0, z }, { x: -minorTickLen, y: 0, z }, AXIS_Z);
      }
    }
  }

  /** 构建三坐标平面的网格线与填充板（若启用）。 */
  private buildPlanes(scene: Scene3D, fills: Fill3[], out: Line3[]): void {
    const fullBounds = this.getViewBoundsXY();
    const coordinateBounds = this.getCoordinateBoundsXY();
    const gridColor = GRID_MAIN_COLOR;
    const outlineColor = PLANE_EDGE_COLOR;

    for (const pl of scene.planes) {
      if (!pl.grid && !pl.plate) continue;

      let uMin: number, uMax: number, vMin: number, vMax: number;
      let gridMinU: number, gridMaxU: number, gridMinV: number, gridMaxV: number;
      if (pl.axis === 'xy') {
        uMin = coordinateBounds.minX; uMax = coordinateBounds.maxX;
        vMin = -coordinateBounds.maxY; vMax = -coordinateBounds.minY;
        gridMinU = fullBounds.minX; gridMaxU = fullBounds.maxX;
        gridMinV = -fullBounds.maxY; gridMaxV = -fullBounds.minY;
      } else {
        const pz = this.visiblePlaneBounds(pl.axis, { padded: true });
        const pzFull = this.visiblePlaneBounds(pl.axis, { padded: false });
        uMin = Math.min(0, pz.uMin); uMax = Math.max(0, pz.uMax);
        vMin = Math.min(0, pz.vMin); vMax = Math.max(0, pz.vMax);
        gridMinU = Math.min(0, pzFull.uMin); gridMaxU = Math.max(0, pzFull.uMax);
        gridMinV = Math.min(0, pzFull.vMin); gridMaxV = Math.max(0, pzFull.vMax);
      }

      const step = this.gridStep({ minX: gridMinU, maxX: gridMaxU, minY: gridMinV, maxY: gridMaxV });
      const minorStep = step / 5;
      const verts: V3[] = pl.axis === 'xy'
        ? [
            { x: uMin, y: -vMax, z: 0 },
            { x: uMax, y: -vMax, z: 0 },
            { x: uMax, y: -vMin, z: 0 },
            { x: uMin, y: -vMin, z: 0 },
          ]
        : pl.axis === 'xz'
          ? [
              { x: uMin, y: 0, z: vMin },
              { x: uMax, y: 0, z: vMin },
              { x: uMax, y: 0, z: vMax },
              { x: uMin, y: 0, z: vMax },
            ]
          : [
              { x: 0, y: uMin, z: vMin },
              { x: 0, y: uMin, z: vMax },
              { x: 0, y: uMax, z: vMax },
              { x: 0, y: uMax, z: vMin },
            ];

      if (pl.plate) {
        const color = pl.axis === 'xy' ? PLANE_XY_FILL : pl.axis === 'xz' ? PLANE_XZ_FILL : PLANE_YZ_FILL;
        fills.push({ verts: [...verts], color });
      }

      if (!pl.grid) continue;
      for (let u = Math.ceil(gridMinU / minorStep) * minorStep; u <= gridMaxU + 1e-9; u += minorStep) {
        if (Math.abs(u / step - Math.round(u / step)) < 1e-9) continue;
        out.push({ a: this.planePoint(pl.axis, u, vMin), b: this.planePoint(pl.axis, u, vMax), color: GRID_MINOR_COLOR, widthPx: 1 });
      }
      for (let v = Math.ceil(gridMinV / minorStep) * minorStep; v <= gridMaxV + 1e-9; v += minorStep) {
        if (Math.abs(v / step - Math.round(v / step)) < 1e-9) continue;
        out.push({ a: this.planePoint(pl.axis, uMin, v), b: this.planePoint(pl.axis, uMax, v), color: GRID_MINOR_COLOR, widthPx: 1 });
      }
      for (let u = Math.ceil(gridMinU / step) * step; u <= gridMaxU + 1e-9; u += step) {
        out.push({ a: this.planePoint(pl.axis, u, vMin), b: this.planePoint(pl.axis, u, vMax), color: gridColor, widthPx: 1 });
      }
      for (let v = Math.ceil(gridMinV / step) * step; v <= gridMaxV + 1e-9; v += step) {
        out.push({ a: this.planePoint(pl.axis, uMin, v), b: this.planePoint(pl.axis, uMax, v), color: gridColor, widthPx: 1 });
      }

      const edge = (x1: V3, x2: V3) => out.push({ a: x1, b: x2, color: outlineColor, widthPx: 1, dash: [5, 5] });
      edge(verts[0], verts[1]);
      edge(verts[1], verts[2]);
      edge(verts[2], verts[3]);
      edge(verts[3], verts[0]);
    }
  }

  /** 平面内参数点 → 世界坐标。 */
  private planePoint(axis: PlaneAxis, u: number, v: number): V3 {
    if (axis === 'xy') return { x: u, y: -v, z: 0 };
    if (axis === 'xz') return { x: u, y: 0, z: v };
    return { x: 0, y: u, z: v };
  }

  /** 在轴端点绘制正方向箭头（屏幕空间小三角）。 */
  private axisArrows(out: Line3[], xEnd: V3, yEnd: V3, zEnd: V3): void {
    this.pushArrow(out, xEnd, AXIS_X);
    this.pushArrow(out, yEnd, AXIS_Y);
    this.pushArrow(out, zEnd, AXIS_Z);
  }

  private pushArrow(out: Line3[], tip: V3, color: string): void {
    const sp = this.projectToScreen(tip);
    if (!sp) return;
    const wpp = this.worldPerPixelAt(tip) || 1;
    const size = 6 * wpp; // 箭头边长（世界单位）
    // 沿朝向单位向量
    const eye = this.getEye();
    const dir = norm3(sub3(tip, eye));
    const up = norm3({ x: 0, y: 0, z: 1 });
    let perp = cross3(dir, up);
    if (Math.hypot(perp.x, perp.y, perp.z) < 1e-9) perp = norm3({ x: 1, y: 0, z: 0 });
    else perp = norm3(perp);
    const base = { x: tip.x - dir.x * size * 1.6, y: tip.y - dir.y * size * 1.6, z: tip.z - dir.z * size * 1.6 };
    const l1 = { x: base.x + perp.x * size, y: base.y + perp.y * size, z: base.z + perp.z * size };
    const l2 = { x: base.x - perp.x * size, y: base.y - perp.y * size, z: base.z - perp.z * size };
    out.push({ a: tip, b: l1, color, widthPx: 2.5 });
    out.push({ a: tip, b: l2, color, widthPx: 2.5 });
  }

  private pushTick(out: Line3[], pos: V3, end: V3, color: string): void {
    if (dist3(pos, end) < 1e-12) return;
    out.push({ a: pos, b: end, color, widthPx: 1 });
  }

  private gridStep(b: Scene3D['gridBounds']): number {
    void b;
    const wpp = this.worldPerPixelAt(this.target) || 1;
    // wpp 是“每个像素对应多少世界单位”；要让主网格约占 48px，
    // 世界步长应当乘以 wpp，而不是除以它。
    const target = 48 * wpp;
    if (!Number.isFinite(target) || target <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(target)));
    const r = target / pow;
    const nice = r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1;
    return nice * pow;
  }

  /** 公开的主网格步长（世界单位），供轴刻度/标签复用。 */
  getGridStep(b: Scene3D['gridBounds']): number {
    return this.gridStep(b);
  }

  private worldPerPixelAt(p: V3): number {
    if (this.height <= 0) return 0;
    const d = dist3(this.getEye(), p);
    if (this.projectionMode === 'orthographic') {
      // 正交模式：worldPerPixel 不随距离变化
      return (2 * this.dist * Math.tan(FOV_Y / 2)) / this.height;
    }
    return (2 * d * Math.tan(FOV_Y / 2)) / this.height;
  }

  // ---------------------------------------------------------------- 顶点流

  private gridTriangles(grid: Line3[]): Float32Array {
    const n = this.countLineVerts(grid);
    const v = new Float32Array(n * 7);
    let k = 0;
    for (const l of grid) k = this.appendLineVerts(v, k, l, l.widthPx);
    return v;
  }

  private fillTriangles(fills: Fill3[]): Float32Array {
    let count = 0;
    for (const f of fills) if (f.verts.length >= 3) count += (f.verts.length - 2) * 3;
    const v = new Float32Array(count * 7);
    let k = 0;
    for (const f of fills) {
      if (f.verts.length < 3) continue;
      const col = this.parseColor(f.color);
      const v0 = f.verts[0];
      for (let i = 1; i < f.verts.length - 1; i++) {
        k = this.pushTri(v, k, v0, f.verts[i], f.verts[i + 1], col);
      }
    }
    return v;
  }

  private lineTriangles(lines: Line3[]): Float32Array {
    const n = this.countLineVerts(lines);
    const v = new Float32Array(n * 7);
    let k = 0;
    for (const l of lines) {
      k = this.appendLineVerts(v, k, l, l.widthPx);
    }
    return v;
  }

  private countLineVerts(lines: Line3[]): number {
    let n = 0;
    for (const l of lines) {
      const segs = l.dash ? this.decomposeDash(l.a, l.b, l.dash) : [{ a: l.a, b: l.b }];
      for (const s of segs) {
        if (dist3(s.a, s.b) < 1e-9) continue;
        n += 6;
      }
    }
    return n;
  }

  private appendLineVerts(v: Float32Array, k: number, l: Line3, widthPx: number): number {
    const segs = l.dash ? this.decomposeDash(l.a, l.b, l.dash) : [{ a: l.a, b: l.b }];
    const col = this.parseColor(l.color);
    for (const s of segs) {
      const len = dist3(s.a, s.b);
      if (len < 1e-9) continue;
      const wpp = this.worldPerPixelAt(mid3(s.a, s.b)) || 1;
      const half = (widthPx * wpp) / 2;
      const dir = scale3(sub3(s.b, s.a), 1 / len);
      const side = norm3(cross3(dir, sub3(this.getEye(), mid3(s.a, s.b))));
      const nx = side.x * half;
      const ny = side.y * half;
      const nz = side.z * half;
      const ax = s.a.x, ay = s.a.y, az = s.a.z;
      const bx = s.b.x, by = s.b.y, bz = s.b.z;
      k = this.pushTri(v, k, { x: ax - nx, y: ay - ny, z: az - nz }, { x: ax + nx, y: ay + ny, z: az + nz }, { x: bx + nx, y: by + ny, z: bz + nz }, col);
      k = this.pushTri(v, k, { x: ax - nx, y: ay - ny, z: az - nz }, { x: bx + nx, y: by + ny, z: bz + nz }, { x: bx - nx, y: by - ny, z: bz - nz }, col);
    }
    return k;
  }

  private decomposeDash(a: V3, b: V3, dashPx: number[]): { a: V3; b: V3 }[] {
    const out: { a: V3; b: V3 }[] = [];
    const len = dist3(a, b);
    if (len < 1e-12) return out;
    const wpp = this.worldPerPixelAt(mid3(a, b)) || 1;
    const dash = dashPx.map(d => d * wpp);
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    const tz = (b.z - a.z) / len;
    let t = 0;
    let on = true;
    let i = 0;
    while (t < len && i < 512) {
      const seg = dash[i % dash.length];
      i++;
      t += seg;
      if (on) {
        const s = Math.max(t - seg, 0);
        const e = Math.min(t, len);
        if (e - s > 1e-9) {
          out.push({
            a: { x: a.x + s * tx, y: a.y + s * ty, z: a.z + s * tz },
            b: { x: a.x + e * tx, y: a.y + e * ty, z: a.z + e * tz },
          });
        }
      }
      on = !on;
    }
    return out;
  }

  private drawTriangles(data: Float32Array): void {
    const gl = this.gl;
    if (data.length === 0) return;
    this.uploadBuffer(this.triVbo, data);
    const info = this.triProg;
    gl.useProgram(info.program);
    gl.uniformMatrix4fv(info.uniforms.mvp, false, this.mvpMatrix());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.triVbo);
    gl.enableVertexAttribArray(info.attribs.pos);
    gl.vertexAttribPointer(info.attribs.pos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(info.attribs.col);
    gl.vertexAttribPointer(info.attribs.col, 4, gl.FLOAT, false, 28, 12);
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);
  }

  private drawPoints(points: Point3[], mvp: Float32Array): void {
    const gl = this.gl;
    let n = 0;
    for (const p of points) n += p.ring ? 12 : 6;
    if (n === 0) return;
    const v = new Float32Array(n * 10);
    let k = 0;
    const corners = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
    for (const p of points) {
      if (p.ring) k = this.pushPointVerts(v, k, p, p.ring.color, p.ring.radiusPx, corners);
      k = this.pushPointVerts(v, k, p, p.color, p.radiusPx, corners);
    }
    this.uploadBuffer(this.pointVbo, v);
    const info = this.pointProg;
    gl.useProgram(info.program);
    gl.uniformMatrix4fv(info.uniforms.mvp, false, mvp);
    gl.uniform2f(info.uniforms.pixel, 2 / this.width, 2 / this.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVbo);
    gl.enableVertexAttribArray(info.attribs.pos);
    gl.vertexAttribPointer(info.attribs.pos, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(info.attribs.col);
    gl.vertexAttribPointer(info.attribs.col, 4, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(info.attribs.corner!);
    gl.vertexAttribPointer(info.attribs.corner!, 2, gl.FLOAT, false, 40, 28);
    gl.enableVertexAttribArray(info.attribs.scale!);
    gl.vertexAttribPointer(info.attribs.scale!, 1, gl.FLOAT, false, 40, 36);
    gl.drawArrays(gl.TRIANGLES, 0, n);
  }

  private pushPointVerts(v: Float32Array, k: number, p: Point3, color: string, radiusPx: number, corners: number[]): number {
    const col = this.parseColor(color);
    for (let i = 0; i < 12; i += 2) {
      v[k++] = p.pos.x; v[k++] = p.pos.y; v[k++] = p.pos.z;
      v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
      v[k++] = corners[i]; v[k++] = corners[i + 1];
      v[k++] = radiusPx;
    }
    return k;
  }

  private pushTri(v: Float32Array, k: number, a: V3, b: V3, c: V3, col: number[]): number {
    v[k++] = a.x; v[k++] = a.y; v[k++] = a.z;
    v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
    v[k++] = b.x; v[k++] = b.y; v[k++] = b.z;
    v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
    v[k++] = c.x; v[k++] = c.y; v[k++] = c.z;
    v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
    return k;
  }

  private uploadBuffer(vbo: WebGLBuffer | null, data: Float32Array): void {
    const gl = this.gl;
    if (!vbo) {
      const nb = gl.createBuffer();
      if (nb) {
        gl.bindBuffer(gl.ARRAY_BUFFER, nb);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      }
      if (nb === this.pointVbo) this.pointCapacity = data.byteLength;
      else this.triCapacity = data.byteLength;
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const capacity = vbo === this.triVbo ? this.triCapacity : this.pointCapacity;
    if (data.byteLength > capacity) {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      if (vbo === this.triVbo) this.triCapacity = data.byteLength;
      else this.pointCapacity = data.byteLength;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
  }

  // ---------------------------------------------------------------- 着色器

  private buildProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string, attribNames: string[]): ProgramInfo {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(`3D VS compile: ${gl.getShaderInfoLog(vs)}`);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(`3D FS compile: ${gl.getShaderInfoLog(fs)}`);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    attribNames.forEach((name, i) => { gl.bindAttribLocation(program, i, name); });
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`3D program link: ${gl.getProgramInfoLog(program)}`);
    const attribs: ProgramInfo['attribs'] = {
      pos: gl.getAttribLocation(program, 'a_pos'),
      col: gl.getAttribLocation(program, 'a_col'),
      corner: gl.getAttribLocation(program, 'a_corner'),
      scale: gl.getAttribLocation(program, 'a_scale'),
    };
    return {
      program,
      attribs,
      uniforms: { mvp: gl.getUniformLocation(program, 'u_mvp'), pixel: gl.getUniformLocation(program, 'u_pixel') },
    };
  }

  private parseColor(css: string): number[] {
    const c = css.trim();
    const hex = c.match(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
    if (hex) {
      let s = hex[1];
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255, 1];
    }
    const rgba = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (rgba) {
      const to01 = (v: string) => {
        const n = parseFloat(v);
        return v.endsWith('%') ? n / 100 : Math.min(1, n / 255);
      };
      return [to01(rgba[1]), to01(rgba[2]), to01(rgba[3]), rgba[4] !== undefined ? (rgba[4].endsWith('%') ? parseFloat(rgba[4]) / 100 : parseFloat(rgba[4])) : 1];
    }
    return [0, 0, 0, 1];
  }

  // ---------------------------------------------------------------- 矩阵

  private mvpMatrix(): Float32Array {
    const eye = this.getEye();
    const view = lookAt(eye, this.target, { x: 0, y: 0, z: 1 });
    const aspect = this.width / Math.max(1, this.height);
    const proj = this.projectionMode === 'orthographic'
      ? orthographic(aspect, this.dist)
      : perspective(FOV_Y, aspect, NEAR, FAR);
    return mat4Multiply(proj, view);
  }
}

/** 三角形/线段顶点着色器 */
const triVertexSource = `#version 300 es
precision mediump float;
in vec3 a_pos;
in vec4 a_col;
uniform mat4 u_mvp;
out vec4 v_col;
void main() {
  gl_Position = u_mvp * vec4(a_pos, 1.0);
  v_col = a_col;
}`;

/** 点精灵着色器 */
const pointVertexSource = `#version 300 es
precision mediump float;
in vec3 a_pos;
in vec4 a_col;
in vec2 a_corner;
in float a_scale;
uniform mat4 u_mvp;
uniform vec2 u_pixel;
out vec4 v_col;
void main() {
  gl_Position = u_mvp * vec4(a_pos, 1.0);
  gl_Position.xy += a_corner * u_pixel * a_scale * gl_Position.w;
  v_col = a_col;
}`;

const triFragmentSource = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 fragColor;
void main() { fragColor = v_col; }`;

// ---- 矩阵工具（列主序 Float32Array(16)）----

function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

/** 正交投影矩阵。halfH = dist * tan(FOV_Y/2)。 */
function orthographic(aspect: number, dist: number): Mat4 {
  const halfH = dist * Math.tan(FOV_Y / 2);
  const halfW = halfH * aspect;
  const out = new Float32Array(16);
  out[0] = 1 / halfW;
  out[5] = 1 / halfH;
  out[10] = -2 / (FAR - NEAR);
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = -(FAR + NEAR) / (FAR - NEAR);
  out[15] = 1;
  return out;
}

function lookAt(eye: V3, center: V3, up: V3): Mat4 {
  const f = norm3(sub3(center, eye));
  const s = norm3(cross3(f, up));
  const u = cross3(s, f);
  const out = new Float32Array(16);
  out[0] = s.x; out[4] = s.y; out[8] = s.z;
  out[1] = u.x; out[5] = u.y; out[9] = u.z;
  out[2] = -f.x; out[6] = -f.y; out[10] = -f.z;
  out[12] = -(s.x * eye.x + s.y * eye.y + s.z * eye.z);
  out[13] = -(u.x * eye.x + u.y * eye.y + u.z * eye.z);
  out[14] = f.x * eye.x + f.y * eye.y + f.z * eye.z;
  out[15] = 1;
  return out;
}

function sub3(a: V3, b: V3): V3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function add3(a: V3, b: V3): V3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale3(a: V3, s: number): V3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dist3(a: V3, b: V3): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
function mid3(a: V3, b: V3): V3 { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }; }

function norm3(v: V3): V3 {
  const l = Math.hypot(v.x, v.y, v.z);
  if (l < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function dot3(a: V3, b: V3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }

function cross3(a: V3, b: V3): V3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
