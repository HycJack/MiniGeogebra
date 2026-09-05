/**
 * P1-2: 设备无关的渲染后端抽象接口。
 * 几何视图只调用本接口，不直接操作 Canvas2D / WebGL API。
 * 参考 GeoGebra 分层架构：规格化内核 → 渲染后端接口 → 具体后端（Canvas/WebGL）。
 *
 * 设计选择：属性与方法混合 —— 样式字段沿用 Canvas2D 的"setter 式"风格（便于视图层直写），
 * 路径/动作/生命周期用方法，保持命令流清晰。
 */

/** 批量化文本队列项（WebGL 后端通过 overlay Canvas2D 渲染）。 */
export interface TextItem {
  text: string;
  x: number;
  y: number;
  font: string;
  fillStyle: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;
}

export interface IRenderer {
  // ---- 画布状态 / 变换 ----
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  scale(sx: number, sy: number): void;
  translate(tx: number, ty: number): void;

  // ---- 画笔/填充（原生样式的属性）----
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineDash: number[];
  font: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;

  // ---- 路径 ----
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  ellipse?(cx: number, cy: number, rx: number, ry: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;

  // ---- 动作 ----
  stroke(): void;
  fill(): void;

  // ---- 文本 ----
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  /** 返回并清空本帧累积的文本队列（Canvas2D 后端直接绘制，返回空数组）。 */
  flushTextQueue(): TextItem[];

  // ---- 生命周期 / 视口 ----
  setLineDash(dash: number[]): void;
  viewportSize(w: number, h: number): void;
  frameCommit(): void;
}
