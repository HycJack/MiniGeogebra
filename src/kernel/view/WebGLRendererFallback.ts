import { CanvasRenderer } from './CanvasRenderer';
import { IRenderer } from './IRenderer';

/** 2D 仿射矩阵（列优先，9 分量） */
type Mat3 = [number, number, number, number, number, number, number, number, number];

interface SavedState { color: string; width: number; dash?: number[]; mv: Mat3 }

interface GLState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  locPos: GLint;
  locCol: GLint;
  uniMatrix: GLint;
  uniVp: GLint;
}

interface LineEntry { p0: { x: number; y: number }; p1: { x: number; y: number }; color: string; width?: number; dash?: number[]; }
interface FillEntry { points: { x: number; y: number }[]; color: string; }
interface ArcEntry { cx: number; cy: number; r: number; sa: number; ea: number; ccw: boolean; }

/**
 * P1-2: 基于 WebGL2 的渲染后端（GeoGebra 式 GPU 批量绘制雏形）。
 * WebGL2 不可用时整体会回退为 CanvasRenderer。
 */
export class WebGLRendererFallback implements IRenderer {
  public supportsWebGL = typeof WebGL2RenderingContext !== 'undefined';
  private canvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private textCtx: CanvasRenderingContext2D;
  private fallback?: CanvasRenderer;
  private glState?: GLState;
  private mv: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private paths: { x: number; y: number }[] = [];
  private arcs: ArcEntry[] = [];
  private lines: LineEntry[] = [];
  private fills: FillEntry[] = [];
  private stateStack: SavedState[] = [];
  private styleCache = new Map<string, [number, number, number]>();

  private _strokeStyle = '#000000';
  private _fillStyle = '#000000';
  private _lineWidth = 1;
  private _lineDash: number[] = [];
  private _font = '12px sans-serif';
  private _textBaseline: CanvasTextBaseline = 'alphabetic';
  private _textAlign: CanvasTextAlign = 'start';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.mainCtx = canvas.getContext('2d', { alpha: false })!;
    const t = document.createElement('canvas');
    t.width = canvas.width || 800;
    t.height = canvas.height || 600;
    this.textCtx = t.getContext('2d', { alpha: true })!;
    if (this.supportsWebGL) {
      try {
        this.initWebGL(canvas.width, canvas.height);
      } catch {
        this.supportsWebGL = false;
        this.fallback = new CanvasRenderer(this.mainCtx);
      }
    } else {
      this.fallback = new CanvasRenderer(this.mainCtx);
    }
  }

  private initWebGL(w: number, h: number): void {
    const gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) throw new Error('no webgl2');
    this.glState = {
      gl,
      program: this.compileProgram(gl),
      vao: this.makeVAO(gl),
      locPos: gl.getAttribLocation(this.glState?.program ?? this.compileProgram(gl), 'a_pos'),
      locCol: gl.getAttribLocation(this.glState?.program ?? this.compileProgram(gl), 'a_col'),
      uniMatrix: 0,
      uniVp: 0,
    };
    const p = this.glState.program;
    this.glState.locPos = gl.getAttribLocation(p, 'a_pos');
    this.glState.locCol = gl.getAttribLocation(p, 'a_col');
    this.glState.uniMatrix = gl.getUniformLocation(p, 'u_matrix') as GLint;
    this.glState.uniVp = gl.getUniformLocation(p, 'u_vp') as GLint;
    this.viewportSize(w, h);
  }

  private compileProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, `#version 300 es
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
      }`);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, `#version 300 es
      precision mediump float;
      in vec3 v_col;
      out vec4 fragColor;
      void main() { fragColor = vec4(v_col, 1.0); }`);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
  }

  private makeVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(this.glState!.locPos);
    gl.vertexAttribPointer(this.glState!.locPos, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(this.glState!.locCol);
    gl.vertexAttribPointer(this.glState!.locCol, 3, gl.FLOAT, false, 20, 8);
    return vao;
  }

  viewportSize(w: number, h: number): void {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.textCtx.canvas.width = w; this.textCtx.canvas.height = h;
    }
    if (this.glState) {
      const gl = this.glState.gl;
      gl.uniform2f(this.glState.uniVp, w, h);
    }
  }

  private parseColor(hex: string): [number, number, number] {
    if (this.styleCache.has(hex)) return this.styleCache.get(hex)!;
    let r = 0, g = 0, b = 0;
    const m = hex.match(/^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
    if (m) { r = parseInt(m[1], 16) / 255; g = parseInt(m[2], 16) / 255; b = parseInt(m[3], 16) / 255; }
    this.styleCache.set(hex, [r, g, b]);
    return [r, g, b];
  }

  private transformPoint(p: { x: number; y: number }): { x: number; y: number } {
    return { x: this.mv[0] * p.x + this.mv[3] * p.y + this.mv[6], y: this.mv[1] * p.x + this.mv[4] * p.y + this.mv[7] };
  }

  private matMul(a: Mat3, b: Mat3): Mat3 {
    const r: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 3; c++) for (let r2 = 0; r2 < 3; r2++) for (let k = 0; k < 3; k++) r[r2 * 3 + c] += a[r2 * 3 + k] * b[k * 3 + c];
    return r;
  }
  private pushT(x: number, y: number): void { this.mv = this.matMul(this.mv, [1, 0, x, 0, 1, y, 0, 0, 1]); }
  private pushS(sx: number, sy: number): void { this.mv = this.matMul(this.mv, [sx, 0, 0, 0, sy, 0, 0, 0, 1]); }

  private doSave(): void {
    this.stateStack.push({ color: this._strokeStyle, width: this._lineWidth, dash: this._lineDash, mv: [...this.mv] as Mat3 });
  }
  private doRestore(): void {
    if (this.stateStack.length === 0) return;
    const s = this.stateStack.pop()!;
    this._strokeStyle = s.color;
    this._lineWidth = s.width;
    this._lineDash = s.dash ?? [];
    this.mv = s.mv;
  }

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
        if (e - s > 1e-9) out.push({ p0: { x: a.x + s * tDirX, y: a.y + s * tDirY }, p1: { x: a.x + e * tDirX, y: a.y + e * tDirY } });
      }
      on = !on;
    }
    return out;
  }

  private arcSegments(a: ArcEntry): { p0: { x: number; y: number }; p1: { x: number; y: number } }[] {
    if (a.r <= 1e-9 || Math.abs(a.ea - a.sa) < 1e-6) return [];
    const r = a.r;
    const dA = Math.abs(a.ea - a.sa);
    const segs = Math.max(6, Math.ceil(dA * r / 0.3));
    const dir = a.ccw ? -1 : 1;
    const out: { p0: { x: number; y: number }; p1: { x: number; y: number } }[] = [];
    for (let i = 0; i < segs; i++) {
      const a1 = a.sa + dir * dA * (i / segs);
      const a2 = a.sa + dir * dA * ((i + 1) / segs);
      out.push({ p0: { x: a.cx + r * Math.cos(a1), y: a.cy + r * Math.sin(a1) }, p1: { x: a.cx + r * Math.cos(a2), y: a.cy + r * Math.sin(a2) } });
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

  private flush(): void {
    if (!this.glState && !this.fallback) return;

    const tw = this.textCtx.canvas.width, th = this.textCtx.canvas.height;
    this.textCtx.clearRect(0, 0, tw, th);

    if (this.glState) {
      const gl = this.glState.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.glState.program);
      gl.bindVertexArray(this.glState.vao);
      gl.uniformMatrix3fv(this.glState.uniMatrix, false, new Float32Array(this.mv));
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if (this.lines.length) {
        const verts: number[] = [];
        for (const l of this.lines) {
          const c = this.parseColor(l.color);
          verts.push(l.p0.x, l.p0.y, c[0], c[1], c[2], l.p1.x, l.p1.y, c[0], c[1], c[2]);
        }
        const vb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.LINES, 0, verts.length / 5);
        gl.deleteBuffer(vb);
      }
      if (this.fills.length) {
        const pos: number[] = [];
        const idx: number[] = [];
        for (const f of this.fills) {
          const c = this.parseColor(f.color);
          for (let i = 0; i < f.points.length; i++) {
            pos.push(f.points[i].x, f.points[i].y, c[0], c[1], c[2]);
            idx.push(i);
          }
          for (let i = 1; i < f.points.length - 1; i++) {
            idx.push(0); idx.push(i); idx.push(i + 1);
          }
        }
        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
        const ebo = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
        gl.deleteBuffer(vbo);
        gl.deleteBuffer(ebo);
      }

      this.mainCtx.drawImage(this.textCtx.canvas, 0, 0);
    } else if (this.fallback) {
      this.fallback.clearRect(0, 0, tw, th);
    }

    this.paths = []; this.arcs = []; this.lines = []; this.fills = [];
  }

  save(): void { this.doSave(); }
  restore(): void { this.doRestore(); }
  clearRect(x: number, y: number, w: number, h: number): void { this.mainCtx.clearRect(x, y, w, h); }
  scale(sx: number, sy: number): void { this.pushS(sx, sy); }
  translate(tx: number, ty: number): void { this.pushT(tx, ty); }

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
    const st = this.transformPoint({ x, y });
    this.textCtx.font = this._font;
    this.textCtx.textBaseline = this._textBaseline;
    this.textCtx.textAlign = this._textAlign;
    this.textCtx.fillStyle = this._fillStyle;
    this.textCtx.fillText(text, st.x, st.y);
  }
  measureText(text: string): { width: number } {
    this.textCtx.font = this._font;
    return { width: this.textCtx.measureText(text).width };
  }

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
    const color = this._strokeStyle;
    const width = this._lineWidth;
    const dash = this._lineDash;
    for (let i = 1; i < this.paths.length; i++) {
      const s = this.paths[i - 1], e = this.paths[i];
      const segs = dash.length ? this.decomposeDash(s, e, dash) : [{ p0: s, p1: e }];
      for (const seg of segs) this.lines.push({ p0: seg.p0, p1: seg.p1, color, width, dash });
    }
    for (const a of this.arcs) this.lines.push(...this.arcSegments(a).map(s => ({ p0: s.p0, p1: s.p1, color, width })));
    this.flush();
  }

  fill(): void {
    if (this.paths.length >= 3) {
      this.fills.push({ points: [...this.paths], color: this._fillStyle });
    } else if (this.paths.length === 2) {
      this.fills.push({ points: [...this.paths, this.paths[0]], color: this._fillStyle });
    }
    for (const a of this.arcs) {
      const pts = this.arcFanPoints(a);
      if (pts.length >= 3) this.fills.push({ points: pts, color: this._fillStyle });
    }
    this.flush();
  }

  frameCommit(): void { this.flush(); }
}

/** 优先尝试 WebGL2，失败则回退为 CanvasRenderer */
export function createRenderer(canvas: HTMLCanvasElement, preferWebGL = true): IRenderer {
  if (preferWebGL) {
    try {
      const r = new WebGLRendererFallback(canvas);
      if (r.supportsWebGL) return r;
    } catch { /* fall through */ }
  }
  return new CanvasRenderer(canvas.getContext('2d', { alpha: false })!);
}
