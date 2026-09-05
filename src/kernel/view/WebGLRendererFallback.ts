import { CanvasRenderer } from './CanvasRenderer';
import { IRenderer, TextItem } from './IRenderer';

/**
 * createRenderer —— 设备无关的渲染后端工厂。
 * 优先尝试 WebGL2；不可用时自动降级为 CanvasRenderingContext2D，
 * 调用方通过 IRenderer 访问，切换完全透明。
 *
 * 注意：canvas 的 context 模式以第一次 getContext 为准，因此必须先请求
 * 'webgl2'，失败后再回退 '2d'（顺序颠倒会导致 webgl2 恒为 null）。
 */
export function createRenderer(canvas: HTMLCanvasElement, preferWebGL = true): IRenderer {
  if (preferWebGL && typeof WebGL2RenderingContext !== 'undefined') {
    try {
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      }) as WebGL2RenderingContext | null;
      if (gl) {
        return new WebGLRendererFallback(gl);
      }
    } catch (e) {
      // WebGL2 init failed, fall through to Canvas2D
    }
  }

  const mainCtx = canvas.getContext('2d');
  if (!mainCtx) throw new Error('Canvas 2D context not available');
  return new CanvasRenderer(mainCtx);
}

/** 2D 仿射变换矩阵（列优先，9 分量）。 */
type Mat3 = [number, number, number, number, number, number, number, number, number];

interface SavedState {
  mv: Mat3;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineDash: number[];
  font: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;
}

interface GLState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;  // 持久 VBO（与 VAO 绑定）
  ebo: WebGLBuffer;  // 持久 EBO（与 VAO 绑定）
  uniMatrix: GLint;
  uniVp: GLint;
}

interface LineEntry {
  p0: { x: number; y: number }; p1: { x: number; y: number };
  color: string;
  width: number;
  dash?: number[];
}

interface FillEntry { points: { x: number; y: number }[]; color: string; }

interface ArcEntry { cx: number; cy: number; r: number; sa: number; ea: number; ccw: boolean; }

/** RGBA 颜色（分量 0~1）。 */
type RGBA = [number, number, number, number];

/**
 * WebGL2 渲染后端（批量绘制）。
 * 所有画笔样式在绘制前收集，一帧内一次提交 GPU。
 * 顶点布局固定为 6 个 float：vec2 pos + vec4 col（stride 24）。
 */
export class WebGLRendererFallback implements IRenderer {
  private glState: GLState;

  private mv: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private stateStack: SavedState[] = [];

  private paths: { x: number; y: number }[] = [];   // beginPath→lineTo 累积（用于 fill）
  private arcs: ArcEntry[] = [];                    // arc() 累积（stroke/fill 均摊成线段/扇形）
  private lines: LineEntry[] = [];                  // stroke() 队列：实线/虚线/线宽
  private fills: FillEntry[] = [];                  // fill() 队列
  private pathClosed = false;                       // closePath() 已闭合当前子路径

  private _strokeStyle = '#000000';
  private _fillStyle = '#000000';
  private _lineWidth = 1;
  private _lineDash: number[] = [];
  private _font = '12px sans-serif';
  private _textBaseline: CanvasTextBaseline = 'alphabetic';
  private _textAlign: CanvasTextAlign = 'start';
  private textQueue: TextItem[] = [];
  private viewportW = 0;
  private viewportH = 0;

  private textCtx: CanvasRenderingContext2D | null = null;

  constructor(gl: WebGL2RenderingContext) {
    // 离屏文本上下文（仅供 measureText / 后续文本合成使用）。
    let tex: HTMLCanvasElement | OffscreenCanvas | null = null;
    try { tex = document.createElement('canvas'); } catch {} // eslint-disable-line no-restricted-globals
    if (!tex && typeof OffscreenCanvas !== 'undefined') {
      try { tex = new OffscreenCanvas(1, 1); } catch {}
    }
    if (tex) {
      (tex as any).width = 1; (tex as any).height = 1;
      this.textCtx = (tex as any).getContext('2d') as CanvasRenderingContext2D;
    }
    this.glState = this.initWebGL(gl);
  }

  private initWebGL(gl: WebGL2RenderingContext): GLState {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertexSource); gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error(`VS compile: ${gl.getShaderInfoLog(vs)}`);
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragmentSource); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(`FS compile: ${gl.getShaderInfoLog(fs)}`);
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program link: ${gl.getProgramInfoLog(program)}`);
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // 每顶点 6 个 float：vec2 pos (偏移 0) + vec4 col (偏移 8) = 步长 24
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    const ebo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bindVertexArray(null);

    const state: GLState = {
      gl,
      program,
      vao,
      vbo,
      ebo,
      uniMatrix: gl.getUniformLocation(program, 'u_matrix') as GLint,
      uniVp: gl.getUniformLocation(program, 'u_vp') as GLint,
    };
    return state;
  }

  /** 解析 #RGB / #RRGGBB / rgba() / rgb() 为 [r,g,b,a]（0~1）。不支持则回退黑色。 */
  private parseColor(css: string): RGBA {
    const c = css.trim();
    const hex = c.match(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
    if (hex) {
      let s = hex[1];
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      return [
        parseInt(s.slice(0, 2), 16) / 255,
        parseInt(s.slice(2, 4), 16) / 255,
        parseInt(s.slice(4, 6), 16) / 255,
        1,
      ];
    }
    const rgba = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (rgba) {
      const to01 = (v: string, isPct = false): number => {
        const n = parseFloat(v);
        return isPct || v.endsWith('%') ? n / 100 : Math.min(1, n / 255);
      };
      return [
        to01(rgba[1]),
        to01(rgba[2]),
        to01(rgba[3]),
        rgba[4] !== undefined ? (rgba[4].endsWith('%') ? parseFloat(rgba[4]) / 100 : parseFloat(rgba[4])) : 1,
      ];
    }
    return [0, 0, 0, 1];
  }

  /** 矩阵乘法。 */
  private matMul(a: Mat3, b: Mat3): Mat3 {
    const r: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 3; c++) {
      for (let row = 0; row < 3; row++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += a[row * 3 + k] * b[k * 3 + c];
        r[row * 3 + c] = s;
      }
    }
    return r;
  }
  private pushT(x: number, y: number): void { this.mv = this.matMul(this.mv, [1, 0, x, 0, 1, y, 0, 0, 1]); }
  private pushS(sx: number, sy: number): void { this.mv = this.matMul(this.mv, [sx, 0, 0, 0, sy, 0, 0, 0, 1]); }

  private doSave(): void {
    this.stateStack.push({
      mv: [...this.mv] as Mat3,
      strokeStyle: this._strokeStyle,
      fillStyle: this._fillStyle,
      lineWidth: this._lineWidth,
      lineDash: [...this._lineDash],
      font: this._font,
      textBaseline: this._textBaseline,
      textAlign: this._textAlign,
    });
  }
  private doRestore(): void {
    if (this.stateStack.length === 0) return;
    const state = this.stateStack.pop()!;
    this.mv = state.mv;
    this._strokeStyle = state.strokeStyle;
    this._fillStyle = state.fillStyle;
    this._lineWidth = state.lineWidth;
    this._lineDash = [...state.lineDash];
    this._font = state.font;
    this._textBaseline = state.textBaseline;
    this._textAlign = state.textAlign;
  }

  /** 将虚线分解为若干小线段。 */
  private decomposeDash(a: { x: number; y: number }, b: { x: number; y: number }, dash: number[]): { p0: { x: number; y: number }; p1: { x: number; y: number } }[] {
    const out: { p0: { x: number; y: number }; p1: { x: number; y: number } }[] = [];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) return out;
    const tDirX = dx / len, tDirY = dy / len;
    const cycle = dash.reduce((x, y) => x + y, 0) || 1;
    let t = 0, on = true;
    while (t < len) {
      const seg = dash[Math.floor((t % cycle) / cycle * dash.length)] || 1;
      t += seg;
      if (on) {
        const s = Math.max(t - seg, 0), e = Math.min(t, len);
        if (e - s > 1e-9) {
          out.push({
            p0: { x: a.x + s * tDirX, y: a.y + s * tDirY },
            p1: { x: a.x + e * tDirX, y: a.y + e * tDirY },
          });
        }
      }
      on = !on;
    }
    return out;
  }

  /** 弧：stroke → 折线段；fill → 扇形。 */
  private arcLines(a: ArcEntry): { p0: { x: number; y: number }; p1: { x: number; y: number } }[] {
    if (a.r <= 1e-9 || Math.abs(a.ea - a.sa) < 1e-6) return [];
    const r = a.r;
    const dA = Math.abs(a.ea - a.sa);
    const segs = Math.max(8, Math.ceil(dA * r / 0.3));
    const dir = a.ccw ? -1 : 1;
    const out: { p0: { x: number; y: number }; p1: { x: number; y: number } }[] = [];
    for (let i = 0; i < segs; i++) {
      const a1 = a.sa + dir * dA * (i / segs);
      const a2 = a.sa + dir * dA * ((i + 1) / segs);
      out.push({
        p0: { x: a.cx + r * Math.cos(a1), y: a.cy + r * Math.sin(a1) },
        p1: { x: a.cx + r * Math.cos(a2), y: a.cy + r * Math.sin(a2) },
      });
    }
    return out;
  }
  private arcFanPoints(a: ArcEntry): { x: number; y: number }[] {
    if (a.r <= 1e-9 || Math.abs(a.ea - a.sa) < 1e-6) return [];
    const pts: { x: number; y: number }[] = [{ x: a.cx, y: a.cy }];
    const r = a.r;
    const dA = Math.abs(a.ea - a.sa);
    const segs = Math.max(24, Math.ceil(dA * r / 0.15));
    const dir = a.ccw ? -1 : 1;
    for (let i = 1; i <= segs; i++) {
      const ang = a.sa + dir * dA * (i / segs);
      pts.push({ x: a.cx + r * Math.cos(ang), y: a.cy + r * Math.sin(ang) });
    }
    return pts;
  }

  /** 合并全部填充项 → 单个索引面片（中心-扇形三角剖分）。顶点 6 float：pos+rgba。 */
  private fillGeometry(): { pos: Float32Array; idx: Uint32Array; cnt: number } {
    let totalPts = 0;
    for (const f of this.fills) totalPts += f.points.length;
    const pos = new Float32Array(totalPts * 6);
    const idxArr: number[] = [];
    let base = 0;
    let j = 0;
    for (const f of this.fills) {
      const col = this.parseColor(f.color);
      for (const p of f.points) {
        pos[j++] = p.x; pos[j++] = p.y; pos[j++] = col[0]; pos[j++] = col[1]; pos[j++] = col[2]; pos[j++] = col[3];
      }
      if (f.points.length >= 3) {
        // 扇形三角剖分：每个三角形 (base, base+i, base+i+1)，共 n-2 个。
        for (let i = 1; i < f.points.length - 1; i++) idxArr.push(base, base + i, base + i + 1);
      } else if (f.points.length === 2) {
        // 两点→退化成以第0点为顶的三角形
        idxArr.push(base, base + 1, base);
      }
      base += f.points.length;
    }
    return { pos, idx: new Uint32Array(idxArr), cnt: idxArr.length };
  }

  /**
   * 全部线段统一为四边形粗线带渲染（每段 2 个三角形 × 6 顶点 × 6 float）。
   * 细线（宽 ≤1）不再走 GL_LINES：1px 线落在整数像素边界只有 50% 覆盖，
   * 颜色会发灰；四边形带在 MSAA 下覆盖完整、颜色饱和。
   */
  private lineGeometry(): { pos: Float32Array; n: number } {
    // 第一遍精确计数：虚线按 decomposeDash 分段数计，退化段（零长）跳过。
    let cnt = 0;
    for (const l of this.lines) {
      const parts = l.dash ? this.decomposeDash(l.p0, l.p1, l.dash) : [{ p0: l.p0, p1: l.p1 }];
      for (const p of parts) {
        if (Math.hypot(p.p1.x - p.p0.x, p.p1.y - p.p0.y) < 1e-12) continue;
        cnt += 6;
      }
    }
    const v = new Float32Array(cnt * 6);
    let k = 0;
    for (const l of this.lines) {
      const parts = l.dash ? this.decomposeDash(l.p0, l.p1, l.dash) : [{ p0: l.p0, p1: l.p1 }];
      const col = this.parseColor(l.color);
      for (const p of parts) {
        const dx = p.p1.x - p.p0.x, dy = p.p1.y - p.p0.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-12) continue;
        const nx = -dy / len, ny = dx / len;
        // 设备空间垂直方向比例：mv 为行主序，mv[0]=m00, mv[1]=m10, mv[3]=m01, mv[4]=m11。
        const dnX = this.mv[0] * nx + this.mv[3] * ny;
        const dnY = this.mv[1] * nx + this.mv[4] * ny;
        const pScale = Math.hypot(dnX, dnY) || 1;
        const devW = l.width * pScale;
        let hw = l.width / 2;
        let nudge = 0;
        // 细线（设备宽 <2px）在条带跨整数像素边界时只被覆盖一半，颜色发灰。
        // 展开到至少 1 设备像素，并把条带中心对齐到半像素栅格。
        if (devW < 2) {
          if (devW < 1) hw += (1 - devW) / (2 * pScale);
          const cxD = p.p0.x * this.mv[0] + p.p0.y * this.mv[3] + this.mv[2];
          const cyD = p.p0.x * this.mv[1] + p.p0.y * this.mv[4] + this.mv[5];
          const c = (cxD * dnX + cyD * dnY) / pScale;
          nudge = (Math.floor(c) + 0.5 - c) / pScale;
        }
        const x0 = p.p0.x - nx * hw + nx * nudge, y0 = p.p0.y - ny * hw + ny * nudge;
        const x1 = p.p0.x + nx * hw + nx * nudge, y1 = p.p0.y + ny * hw + ny * nudge;
        const x2 = p.p1.x + nx * hw + nx * nudge, y2 = p.p1.y + ny * hw + ny * nudge;
        const x3 = p.p1.x - nx * hw + nx * nudge, y3 = p.p1.y - ny * hw + ny * nudge;
        // 两个三角形 (0,1,2) 与 (0,2,3) 拼成完整四边形。
        v[k++] = x0; v[k++] = y0; v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
        v[k++] = x1; v[k++] = y1; v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
        v[k++] = x2; v[k++] = y2; v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
        v[k++] = x0; v[k++] = y0; v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
        v[k++] = x2; v[k++] = y2; v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
        v[k++] = x3; v[k++] = y3; v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2]; v[k++] = col[3];
      }
    }
    return { pos: v, n: cnt };
  }

  /** 统一提交本帧几何。文本合成暂不接入（后续通过 overlay canvas / 纹理方案补齐）。 */
  private submit(): void {
    if (!this.lines.length && !this.fills.length && !this.paths.length && !this.arcs.length) {
      this.paths = []; this.arcs = []; this.lines = []; this.fills = []; this.textQueue = [];
      return;
    }

    const gl = this.glState.gl;
    const tw = gl.canvas.width, th = gl.canvas.height;

    gl.viewport(0, 0, tw, th);
    gl.useProgram(this.glState.program);
    gl.bindVertexArray(this.glState.vao);
    // mv 以行主序存储，而 uniformMatrix3fv(transpose=false) 要求列主序，上传前转置。
    // 否则平移量会落入 mat3 的第 3 列（w 分量），在顶点着色器中被丢弃，导致整个视图偏移。
    const cm = this.mv;
    gl.uniformMatrix3fv(this.glState.uniMatrix, false, new Float32Array([
      cm[0], cm[3], cm[6],
      cm[1], cm[4], cm[7],
      cm[2], cm[5], cm[8],
    ]));
    gl.uniform2f(this.glState.uniVp, tw, th);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // 预乘 alpha 管线：片元着色器输出 rgb*a，缓冲为预乘格式（与 premultipliedAlpha:true 一致）。
    // 若用直通 alpha + SRC_ALPHA 混合，半透明形状的缓冲 alpha 会被二次相乘，
    // 浏览器合成到页面时 rgb 又被当作预乘值，导致半透明填充整体发白/消失。
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const fg = this.fillGeometry();
    if (fg.pos.length > 0) {
      const { vbo, ebo } = this.glState;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, fg.pos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, fg.idx, gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, fg.cnt, gl.UNSIGNED_INT, 0);
    }

    const lines = this.lineGeometry();
    if (lines.n > 0) {
      const { vbo } = this.glState;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, lines.pos, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, lines.n);
    }

    this.paths = []; this.arcs = []; this.lines = []; this.fills = [];
  }

  viewportSize(w: number, h: number): void {
    const gl = this.glState.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    if (canvas.width !== this.viewportW || canvas.height !== this.viewportH) {
      // 修改 canvas.width/height 会重置 WebGL 上下文状态：
      // program / VAO / VBO 全部失效，必须基于当前上下文重建。
      // 注意：canvas 尺寸也可能在组件层（React 写 width/height 属性）被改掉，
      // 因此以 renderer 最后见过的尺寸为准判断是否需要重建。
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
      this.glState = this.initWebGL(gl);
      this.viewportW = w; this.viewportH = h;
    }
    gl.viewport(0, 0, w, h);
  }

  get strokeStyle(): string { return this._strokeStyle; }
  set strokeStyle(v: string) { this._strokeStyle = v; }
  get fillStyle(): string { return this._fillStyle; }
  set fillStyle(v: string) { this._fillStyle = v; }
  get lineWidth(): number { return this._lineWidth; }
  set lineWidth(v: number) { this._lineWidth = v; }
  get lineDash(): number[] { return this._lineDash.slice(); }
  set lineDash(v: number[]) { this._lineDash = Array.isArray(v) ? v.slice() : []; }
  setLineDash(dash: number[]): void { this.lineDash = dash; }
  get font(): string { return this._font; }
  set font(v: string) { this._font = v; }
  get textBaseline(): CanvasTextBaseline { return this._textBaseline; }
  set textBaseline(v: CanvasTextBaseline) { this._textBaseline = v; }
  get textAlign(): CanvasTextAlign { return this._textAlign; }
  set textAlign(v: CanvasTextAlign) { this._textAlign = v; }

  fillText(text: string, x: number, y: number): void {
    this.textQueue.push({ text, x, y, font: this._font, fillStyle: this._fillStyle, textBaseline: this._textBaseline, textAlign: this._textAlign, });
  }
  measureText(text: string): { width: number } {
    if (this.textCtx) {
      this.textCtx.font = this._font;
      return { width: this.textCtx.measureText(text).width };
    }
    return { width: 0 };
  }

  save(): void { this.doSave(); }
  restore(): void { this.doRestore(); }
  clearRect(x: number, y: number, w: number, h: number): void {
    const gl = this.glState.gl;
    const ch = gl.canvas.height;
    gl.viewport(0, 0, gl.canvas.width, ch);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, ch - (y + h), w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }
  scale(sx: number, sy: number): void { this.pushS(sx, sy); }
  translate(tx: number, ty: number): void { this.pushT(tx, ty); }

  beginPath(): void { this.paths = []; this.arcs = []; this.pathClosed = false; }
  moveTo(x: number, y: number): void {
    // closePath 后 moveTo 开启新子路径（canvas 语义）。
    if (this.pathClosed) { this.paths = []; this.pathClosed = false; }
    this.paths.push({ x, y });
  }
  lineTo(x: number, y: number): void { if (this.paths.length > 0) this.paths.push({ x, y }); }
  closePath(): void { if (this.paths.length > 0) this.pathClosed = true; }
  arc(cx: number, cy: number, r: number, sa: number, ea: number, ccw?: boolean): void {
    this.arcs.push({ cx, cy, r, sa, ea, ccw: !!ccw });
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, sa: number, ea: number, ccw?: boolean): void {
    this.arcs.push({ cx, cy, r: Math.max(rx, ry), sa, ea, ccw: !!ccw });
  }
  stroke(): void {
    const color = this._strokeStyle, width = this._lineWidth, dash = this._lineDash.length ? [...this._lineDash] : undefined;
    for (let i = 1; i < this.paths.length; i++) {
      this.lines.push({ p0: this.paths[i - 1], p1: this.paths[i], color, width, dash });
    }
    if (this.pathClosed && this.paths.length >= 2) {
      this.lines.push({ p0: this.paths[this.paths.length - 1], p1: this.paths[0], color, width, dash });
    }
    for (const a of this.arcs) {
      for (const s of this.arcLines(a)) this.lines.push({ p0: s.p0, p1: s.p1, color, width });
    }
  }
  fill(): void {
    if (this.paths.length >= 3) this.fills.push({ points: [...this.paths], color: this._fillStyle });
    else if (this.paths.length === 2) this.fills.push({ points: [...this.paths, this.paths[0]], color: this._fillStyle });
    for (const a of this.arcs) {
      const pts = this.arcFanPoints(a);
      if (pts.length >= 3) this.fills.push({ points: pts, color: this._fillStyle });
    }
  }
  frameCommit(): void { this.submit(); }

  /** 返回并清空文本队列，由外部 Canvas2D overlay 绘制。 */
  flushTextQueue(): TextItem[] {
    const items = this.textQueue;
    this.textQueue = [];
    return items;
  }
}

/** 顶点着色器（WebGL2 / OpenGL ES 3.0）。 */
const vertexSource = `#version 300 es
  precision mediump float;
  in vec2 a_pos;
  in vec4 a_col;
  uniform mat3 u_matrix;
  uniform vec2 u_vp;
  out vec4 v_col;
  void main() {
    vec3 pos = u_matrix * vec3(a_pos, 1.0);
    gl_Position = vec4(pos.x / u_vp.x * 2.0 - 1.0, -(pos.y / u_vp.y * 2.0 - 1.0), 0.0, 1.0);
    v_col = a_col;
  }`;

/** 片段着色器（纯色，alpha 直通）。 */
const fragmentSource = `#version 300 es
  precision mediump float;
  in vec4 v_col;
  out vec4 fragColor;
  void main() { fragColor = vec4(v_col.rgb * v_col.a, v_col.a); }`;
