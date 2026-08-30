import { IRenderer } from './IRenderer';

/**
 * P1-2: 基于 CanvasRenderingContext2D 的渲染后端实现。
 * 作为 ctx 的属性/方法代理，保持与 IRenderer 约定一致（样式用原生 setter，
 * 路径/动作用方法调用），供调用方无缝切换 WebGL/WebGL 兜底。
 */
export class CanvasRenderer implements IRenderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  // ---- state / transform ----
  save(): void { this.ctx.save(); }
  restore(): void { this.ctx.restore(); }
  clearRect(x: number, y: number, w: number, h: number): void { this.ctx.clearRect(x, y, w, h); }
  scale(sx: number, sy: number): void { this.ctx.scale(sx, sy); }
  translate(tx: number, ty: number): void { this.ctx.translate(tx, ty); }

  // ---- styles (property accessors mirroring native canvas state) ----
  private _strokeStyle = '#000000';
  get strokeStyle(): string { return this._strokeStyle; }
  set strokeStyle(v: string) { this._strokeStyle = v; this.ctx.strokeStyle = v; }
  private _fillStyle = '#000000';
  get fillStyle(): string { return this._fillStyle; }
  set fillStyle(v: string) { this._fillStyle = v; this.ctx.fillStyle = v; }
  private _lineWidth = 1;
  get lineWidth(): number { return this._lineWidth; }
  set lineWidth(v: number) { this._lineWidth = v; this.ctx.lineWidth = v; }
  private _lineDash: number[] = [];
  get lineDash(): number[] { return this._lineDash; }
  set lineDash(v: number[]) { this._lineDash = v.slice(); this.ctx.setLineDash(v); }
  private _font = '12px sans-serif';
  get font(): string { return this._font; }
  set font(v: string) { this._font = v; this.ctx.font = v; }
  private _textBaseline: CanvasTextBaseline = 'alphabetic';
  get textBaseline(): CanvasTextBaseline { return this._textBaseline; }
  set textBaseline(v: CanvasTextBaseline) { this._textBaseline = v; this.ctx.textBaseline = v; }
  private _textAlign: CanvasTextAlign = 'start';
  get textAlign(): CanvasTextAlign { return this._textAlign; }
  set textAlign(v: CanvasTextAlign) { this._textAlign = v; this.ctx.textAlign = v; }

  // ---- path ----
  beginPath(): void { this.ctx.beginPath(); }
  moveTo(x: number, y: number): void { this.ctx.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.ctx.lineTo(x, y); }
  closePath(): void { this.ctx.closePath(); }
  arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.ctx.arc(cx, cy, r, startAngle, endAngle, counterclockwise);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.ctx.ellipse(cx, cy, rx, ry, rotation, startAngle, endAngle, counterclockwise);
  }
  // ---- actions ----
  stroke(): void { this.ctx.stroke(); }
  fill(): void { this.ctx.fill(); }

  // ---- text ----
  fillText(text: string, x: number, y: number): void {
    this.ctx.textBaseline = this._textBaseline;
    this.ctx.textAlign = this._textAlign;
    this.ctx.font = this._font;
    this.ctx.fillStyle = this._fillStyle;
    this.ctx.fillText(text, x, y);
  }
  measureText(text: string): { width: number } { return { width: this.ctx.measureText(text).width }; }

  // ---- lifecycle ----
  setLineDash(dash: number[]): void { this.lineDash = dash; }
  viewportSize(_w: number, _h: number): void {}
  frameCommit(): void {}
}
