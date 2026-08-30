import { IRenderer } from './IRenderer';

interface SvgPathItem {
  d: string;
  fill: string | null;
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string | null;
}

interface SvgTextItem {
  x: number;
  y: number;
  text: string;
  anchor: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  size: number;
  color: string;
}

/**
 * P2-4: 基于 IRenderer 的 SVG 渲染后端
 * 把绘图命令收集成 SVG 元素，最后生成可下载的 <svg> 字符串。
 */
export class SvgRenderer implements IRenderer {
  private paths: SvgPathItem[] = [];
  private texts: SvgTextItem[] = [];

  private _stroke = '#000000';
  private _fill = '#000000';
  private _width = 1;
  private _dash: number[] = [];
  private _font = '12px sans-serif';
  private _anchor: CanvasTextAlign = 'left';
  private _baseline: CanvasTextBaseline = 'alphabetic';

  private curD = '';

  save(): void {}
  restore(): void {}
  clearRect(_x: number, _y: number, _w: number, _h: number): void {}
  scale(_sx: number, _sy: number): void {}
  translate(_tx: number, _ty: number): void {}
  viewportSize(_w: number, _h: number): void {}
  frameCommit(): void {}

  get strokeStyle(): string { return this._stroke; }
  set strokeStyle(v: string) { this._stroke = v; }
  get fillStyle(): string { return this._fill; }
  set fillStyle(v: string) { this._fill = v; }
  get lineWidth(): number { return this._width; }
  set lineWidth(v: number) { this._width = v; }
  get lineDash(): number[] { return this._dash; }
  set lineDash(v: number[]) { this._dash = [...v]; }
  get font(): string { return this._font; }
  set font(v: string) { this._font = v; }
  get textBaseline(): CanvasTextBaseline { return this._baseline; }
  set textBaseline(v: CanvasTextBaseline) { this._baseline = v; }
  get textAlign(): CanvasTextAlign { return this._anchor; }
  set textAlign(v: CanvasTextAlign) { this._anchor = v; }

  setLineDash(v: number[]): void { this.lineDash = v; }

  fillText(text: string, x: number, y: number): void {
    const size = this._font ? parseFloat(this._font) : 12;
    this.texts.push({ x, y, text, anchor: this._anchor, baseline: this._baseline, size, color: this._fill });
  }
  measureText(_text: string): { width: number } {
    return { width: 0 };
  }

  beginPath(): void { this.curD = ''; }
  moveTo(x: number, y: number): void { this.curD += `M ${this._fmt(x)} ${this._fmt(y)}`; }
  lineTo(x: number, y: number): void { this.curD += ` L ${this._fmt(x)} ${this._fmt(y)}`; }
  closePath(): void { this.curD += ' Z'; }

  arc(cx: number, cy: number, r: number, sa: number, ea: number, ccw?: boolean): void {
    let da = ea - sa;
    if (ccw) da = da % (2 * Math.PI);
    if (da <= 0) da += 2 * Math.PI;
    const largeArc = da > Math.PI ? 1 : 0;
    const sweep = ccw ? 0 : 1;
    const ex = cx + r * Math.cos(ea);
    const ey = cy + r * Math.sin(ea);
    this.curD += ` A ${this._fmt(r)} ${this._fmt(r)} 0 ${largeArc} ${sweep} ${this._fmt(ex)} ${this._fmt(ey)}`;
  }

  stroke(): void {
    if (!this.curD) return;
    this.paths.push({
      d: this.curD,
      fill: null,
      stroke: this._escapeAttr(this._stroke),
      strokeWidth: this._width,
      strokeDasharray: this._dash.length ? this._dash.join(' ') : null,
    });
    this.curD = '';
  }

  fill(): void {
    if (!this.curD) return;
    this.paths.push({
      d: this.curD,
      fill: this._escapeAttr(this._fill),
      stroke: 'none',
      strokeWidth: this._width,
      strokeDasharray: null,
    });
    this.curD = '';
  }

  toSvgString(bounds: { minX: number; maxX: number; minY: number; maxY: number }): string {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const elements: string[] = [];

    for (const p of this.paths) {
      const attrs = [
        'fill="' + p.fill + '"',
        'stroke="' + p.stroke + '"',
        'stroke-width="' + p.strokeWidth + '"',
        ...(!p.strokeDasharray ? [] : [`stroke-dasharray="${p.strokeDasharray}"`]),
      ].join(' ');
      elements.push(`<path ${attrs} d="${p.d}" />`);
    }

    for (const t of this.texts) {
      const ta = t.anchor === 'center' ? 'middle' : t.anchor === 'right' ? 'end' : 'start';
      const db = t.baseline === 'bottom' ? 'hanging' : t.baseline;
      elements.push(
        `<text x="${this._fmt(t.x)}" y="${this._fmt(t.y)}" ` +
        `text-anchor="${ta}" dominant-baseline="${db}" ` +
        `fill="${t.color}" style="font: ${t.size}px sans-serif">${this._escape(t.text)}</text>`
      );
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" ' +
      `viewBox="${this._fmt(bounds.minX)} ${this._fmt(bounds.minY)} ${this._fmt(width)} ${this._fmt(height)}" ` +
      'width="100%" height="100%" preserveAspectRatio="xMidYMid meet">' +
      elements.join('\n') + '\n</svg>'
    );
  }

  private _fmt(v: number): string {
    return Number.isFinite(v) ? v.toFixed(6) : String(v);
  }

  private _escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private _escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
