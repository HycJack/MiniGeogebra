import { CanvasRenderer } from './CanvasRenderer';
import { IRenderer } from './IRenderer';

/**
 * createRenderer —— 设备无关的渲染后端工厂。
 * 优先尝试 WebGL2；不可用时自动降级为 CanvasRenderingContext2D，
 * 调用方通过 IRenderer 访问，切换完全透明。
 */
export function createRenderer(canvas: HTMLCanvasElement, preferWebGL = true): IRenderer {
  const mainCtx = canvas.getContext('2d');
  if (!mainCtx) throw new Error('Canvas 2D context not available');

  if (preferWebGL && typeof WebGL2RenderingContext !== 'undefined') {
    try {
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false }) as WebGL2RenderingContext | null;
      if (gl) {
        return new WebGLRendererFallback(gl, mainCtx);
      }
    } catch {
      // WebGL2 初始化失败，回退到 Canvas2D
    }
  }

  console.log(
    '[MiniGeogebra] Renderer:',
    preferWebGL ? 'Canvas2D (WebGL2 不可用)' : 'Canvas2D'
  );
  return new CanvasRenderer(mainCtx);
}

/** 2D 仿射变换矩阵（列优先，9 分量）。 */
type Mat3 = [number, number, number, number, number, number, number, number, number];

interface SavedState { mv: Mat3; }

interface GLState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  locPos: GLint;
  locCol: GLint;
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

/** WebGL2 渲染后端（批量绘制）。所有画笔样式在绘制前收集，一帧内一次提交 GPU。 */
export class WebGLRendererFallback implements IRenderer {
  private glState?: GLState;

  // 备用 2D 上下文：当 WebGL 上下文不可用时，本帧全部队列回放到 CanvasRenderer 上。
  private backup?: CanvasRenderer;

  private mv: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private stateStack: SavedState[] = [];

  private paths: { x: number; y: number }[] = [];   // beginPath→lineTo 累积（用于 fill）
  private arcs: ArcEntry[] = [];                    // arc() 累积（stroke/fill 均摊成线段/扇形）
  private lines: LineEntry[] = [];                  // stroke() 队列：实线/虚线/线宽
  private fills: FillEntry[] = [];                  // fill() 队列

  private _strokeStyle = '#000000';
  private _fillStyle = '#000000';
  private _lineWidth = 1;
  private _lineDash: number[] = [];
  private _font = '12px sans-serif';
  private _textBaseline: CanvasTextBaseline = 'alphabetic';
  private _textAlign: CanvasTextAlign = 'start';
  private textQueue: { text: string; x: number; y: number }[] = [];

  private textCtx: CanvasRenderingContext2D | null = null;

  constructor(gl: WebGL2RenderingContext, private mainCtx: CanvasRenderingContext2D) {
    // 离屏文本上下文：先在主流式 canvas 上尝试，再回退到 offscreen。
    let tex: HTMLCanvasElement | OffscreenCanvas | null = null;
    try { tex = document.createElement('canvas'); } catch {} // eslint-disable-line no-restricted-globals
    if (!tex && typeof OffscreenCanvas !== 'undefined') {
      try { tex = new OffscreenCanvas(1, 1); } catch {}
    }
    if (tex) {
      (tex as any).width = 1; (tex as any).height = 1;
      this.textCtx = (tex as any).getContext('2d') as CanvasRenderingContext2D;
    } else {
      this.textCtx = mainCtx; // 退化：直接画到主流板上（仅影响无 WebGL 路径）
    }
    this.backup = new CanvasRenderer(mainCtx);
    this.initWebGL(gl);
  }

  private initWebGL(gl: WebGL2RenderingContext): void {
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
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // 每顶点 5 个 float：vec2 pos (偏移 0) + vec3 col (偏移 8) = 步长 20
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    this.glState = {
      gl,
      program,
      vao,
      locPos: 0,
      locCol: 1,
      uniMatrix: gl.getUniformLocation(program, 'u_matrix') as GLint,
      uniVp: gl.getUniformLocation(program, 'u_vp') as GLint,
    };
    this.viewportSize(gl.canvas.width || 800, gl.canvas.height || 600);
  }

  /** 解析 #RGB 为 [r,g,b]（0~1）。 */
  private parseColor(hex: string): [number, number, number] {
    const m = hex.match(/^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
    if (m) return [
      parseInt(m[1], 16) / 255,
      parseInt(m[2], 16) / 255,
      parseInt(m[3], 16) / 255,
    ];
    return [0, 0, 0];
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

  private doSave(): void { this.stateStack.push({ mv: [...this.mv] as Mat3 }); }
  private doRestore(): void {
    if (this.stateStack.length === 0) return;
    this.mv = this.stateStack.pop()!.mv;
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

  /** 合并全部填充项 → 单个索引面片（中心-扇形三角剖分）。 */
  private fillGeometry(): { pos: Float32Array; idx: Uint32Array; cnt: number } {
    let totalPts = 0;
    for (const f of this.fills) totalPts += f.points.length;
    const pos = new Float32Array(totalPts * 5);
    const idxArr: number[] = [];
    let base = 0;
    let j = 0;
    for (const f of this.fills) {
      const col = this.parseColor(f.color);
      for (const p of f.points) {
        pos[j++] = p.x; pos[j++] = p.y; pos[j++] = col[0]; pos[j++] = col[1]; pos[j++] = col[2];
      }
      if (f.points.length >= 3) {
        idxArr.push(base);
        for (let i = 1; i < f.points.length - 1; i++) idxArr.push(base + i, base + i + 1);
      } else if (f.points.length === 2) {
        // 两点→退化成以第0点为顶的三角形
        idxArr.push(base, base + 1, base);
      }
      base += f.points.length;
    }
    return { pos, idx: new Uint32Array(idxArr), cnt: idxArr.length };
  }

  private thinLines(): Float32Array {
    let cnt = 0;
    for (const l of this.lines) {
      if ((l.dash?.length ?? 0) === 0 && l.width <= 1.001) cnt += 2;
    }
    const v = new Float32Array(cnt * 4);
    let k = 0;
    for (const l of this.lines) {
      if ((l.dash?.length ?? 0) === 0 && l.width <= 1.001) {
        v[k++] = l.p0.x; v[k++] = l.p0.y; v[k++] = l.p1.x; v[k++] = l.p1.y;
      }
    }
    return v;
  }
  private thickLines(): { pos: Float32Array; n: number } {
    let cnt = 0;
    for (const l of this.lines) {
      if ((l.dash?.length ?? 0) > 0 || l.width > 1.001) cnt += 4;
    }
    const v = new Float32Array(cnt * 5);
    let k = 0;
    for (const l of this.lines) {
      if ((l.dash?.length ?? 0) > 0 || l.width > 1.001) {
        const parts = l.dash ? this.decomposeDash(l.p0, l.p1, l.dash) : [{ p0: l.p0, p1: l.p1 }];
        const col = this.parseColor(l.color);
        for (const p of parts) {
          const dx = p.p1.x - p.p0.x, dy = p.p1.y - p.p0.y;
          const len = Math.hypot(dx, dy);
          const nx = -dy / len, ny = dx / len;
          const hw = l.width / 2;
          v[k++] = p.p0.x - nx * hw; v[k++] = p.p0.y - ny * hw;
          v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2];
          v[k++] = p.p0.x + nx * hw; v[k++] = p.p0.y + ny * hw;
          v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2];
          v[k++] = p.p1.x + nx * hw; v[k++] = p.p1.y + ny * hw;
          v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2];
          v[k++] = p.p1.x - nx * hw; v[k++] = p.p1.y - ny * hw;
          v[k++] = col[0]; v[k++] = col[1]; v[k++] = col[2];
        }
      }
    }
    return { pos: v, n: cnt };
  }
  /** 统一提交本帧：几何（GPU/2D）+ 文本。 */
  private submit(): void {
    if (!this.lines.length && !this.fills.length && !this.paths.length && !this.arcs.length && !this.textQueue.length) {
      this.paths = []; this.arcs = []; this.lines = []; this.fills = []; this.textQueue = [];
      return;
    }

    if (!this.glState) {
      this.submit2D(this.mainCtx);
      this.paths = []; this.arcs = []; this.lines = []; this.fills = []; this.textQueue = [];
      return;
    }

    const gl = this.glState.gl;
    const tw = this.mainCtx.canvas.width, th = this.mainCtx.canvas.height;
    this.mainCtx.clearRect(0, 0, tw, th);

    gl.viewport(0, 0, tw, th);
    gl.useProgram(this.glState.program);
    gl.bindVertexArray(this.glState.vao);
    gl.uniformMatrix3fv(this.glState.uniMatrix, false, new Float32Array(this.mv));
    gl.uniform2f(this.glState.uniVp, tw, th);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const fg = this.fillGeometry();
    if (fg.pos.length > 0) {
      const buf = gl.createBuffer()!, ebo = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, fg.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, fg.idx, gl.STATIC_DRAW);
      gl.drawElements(gl.TRIANGLES, fg.cnt, gl.UNSIGNED_INT, 0);
      gl.deleteBuffer(buf); gl.deleteBuffer(ebo);
    }

    const thin = this.thinLines();
    if (thin.length > 0) {
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, thin, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.LINES, 0, thin.length / 2);
      gl.deleteBuffer(buf);
    }
    const thick = this.thickLines();
    if (thick.n > 0) {
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, thick.pos, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, thick.n);
      gl.deleteBuffer(buf);
    }

    // 文本：离屏 rasterize 后合成到主流板
    const octx = this.textCtx;
    if (octx) {
      const oc = octx.canvas;
      if (oc.width !== tw || oc.height !== th) { (oc as any).width = tw; (oc as any).height = th; }
      octx.clearRect(0, 0, tw, th);
      octx.font = this._font;
      octx.textBaseline = this._textBaseline;
      octx.textAlign = this._textAlign;
      octx.fillStyle = this._fillStyle;
      octx.translate(this.mv[6], this.mv[7]);
      octx.scale(this.mv[0], this.mv[4]);
      for (const t of this.textQueue) {
        octx.fillText(t.text, t.x, t.y);
      }
      octx.scale(1 / Math.max(this.mv[0], 1e-9), 1 / Math.max(this.mv[4], 1e-9));
      octx.translate(-this.mv[6], -this.mv[7]);
      this.mainCtx.drawImage(octx.canvas, 0, 0);
    }
    this.paths = []; this.arcs = []; this.lines = []; this.fills = []; this.textQueue = [];
  }
  private submit2D(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.mv[6], this.mv[7]);
    ctx.scale(this.mv[0], this.mv[4]);
    // 填充
    for (const f of this.fills) {
      ctx.fillStyle = f.color; ctx.beginPath();
      if (f.points.length >= 3) {
        ctx.moveTo(f.points[0].x, f.points[0].y);
        for (let i = 1; i < f.points.length; i++) ctx.lineTo(f.points[i].x, f.points[i].y);
        ctx.closePath();
      } else if (f.points.length === 2) {
        ctx.moveTo(f.points[0].x, f.points[0].y); ctx.lineTo(f.points[1].x, f.points[1].y); ctx.closePath();
      }
      ctx.fill();
    }
    // 线条（含虚线、线宽）
    for (const l of this.lines) {
      ctx.strokeStyle = l.color;
      if (l.width !== 1) ctx.lineWidth = l.width;
      ctx.setLineDash(l.dash ?? []);
      ctx.beginPath();
      const parts = l.dash ? this.decomposeDash(l.p0, l.p1, l.dash) : [{ p0: l.p0, p1: l.p1 }];
      ctx.moveTo(parts[0].p0.x, parts[0].p0.y);
      for (let i = 1; i < parts.length; i++) ctx.lineTo(parts[i].p0.x, parts[i].p0.y);
      ctx.lineTo(parts[parts.length - 1].p1.x, parts[parts.length - 1].p1.y);
      ctx.stroke();
    }
    // 文本
    ctx.font = this._font; ctx.textBaseline = this._textBaseline; ctx.textAlign = this._textAlign;
    ctx.fillStyle = this._fillStyle;
    for (const t of this.textQueue) ctx.fillText(t.text, t.x, t.y);
    ctx.scale(1 / Math.max(this.mv[0], 1e-9), 1 / Math.max(this.mv[4], 1e-9));
    ctx.translate(-this.mv[6], -this.mv[7]);
    ctx.restore();
  }

  viewportSize(w: number, h: number): void {
    if (this.mainCtx.canvas.width !== w || this.mainCtx.canvas.height !== h) {
      this.mainCtx.canvas.width = w; this.mainCtx.canvas.height = h;
    }
    if (this.glState) {
      this.glState.gl.uniform2f(this.glState.uniVp, w, h);
    }
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
    this.textQueue.push({ text, x, y });
  }
  measureText(text: string): { width: number } {
    if (this.textCtx) {
      this.textCtx.font = this._font;
      this.textCtx.save();
      this.textCtx.translate(this.mv[6], this.mv[7]);
      this.textCtx.scale(this.mv[0], this.mv[4]);
      const w = this.textCtx.measureText(text).width;
      this.textCtx.scale(1 / Math.max(this.mv[0], 1e-9), 1 / Math.max(this.mv[4], 1e-9));
      this.textCtx.translate(-this.mv[6], -this.mv[7]);
      this.textCtx.restore();
      return { width: w };
    }
    return { width: 0 };
  }

  save(): void { this.doSave(); }
  restore(): void { this.doRestore(); }
  clearRect(x: number, y: number, w: number, h: number): void {
    if (this.glState) {
      const gl = this.glState.gl;
      gl.viewport(0, 0, this.mainCtx.canvas.width, this.mainCtx.canvas.height);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, (this.mainCtx.canvas.height - h) - y, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
    } else {
      this.mainCtx.clearRect(x, y, w, h);
    }
  }
  scale(sx: number, sy: number): void { this.pushS(sx, sy); }
  translate(tx: number, ty: number): void { this.pushT(tx, ty); }

  beginPath(): void { this.paths = []; }
  moveTo(x: number, y: number): void { this.paths.push({ x, y }); }
  lineTo(x: number, y: number): void { if (this.paths.length > 0) this.paths.push({ x, y }); }
  closePath(): void {}
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
}

/** 顶点着色器（WebGL2 / OpenGL ES 3.0）。 */
const vertexSource = `#version 300 es
  precision mediump float;
  in vec2 a_pos;
  in vec3 a_col;
  uniform mat3 u_matrix;
  uniform vec2 u_vp;
  out vec3 v_col;
  void main() {
    vec2 pos = u_matrix * vec3(a_pos, 1.0);
    gl_Position = vec4(pos.x / u_vp.x * 2.0 - 1.0, -(pos.y / u_vp.y * 2.0 - 1.0), 0.0, 1.0);
    v_col = a_col;
  }`;

/** 片段着色器（纯色，无宽度渐变；线宽由四边形几何保证）。 */
const fragmentSource = `#version 300 es
  precision mediump float;
  in vec3 v_col;
  out vec4 fragColor;
  void main() { fragColor = vec4(v_col, 1.0); }`;
