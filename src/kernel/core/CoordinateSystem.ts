/**
 * CoordinateSystem — 统一的世界坐标 ↔ 屏幕坐标仿射变换（GeoGebra / JSXGraph 式设计）
 *
 * 不可变值对象。每次 zoom / pan / resize 都返回一个新实例，方便放入 React state，
 * 且保证“缩放/平移只改变换、不改几何数据”的单一真理源语义。
 *
 * 约定：
 *   - 屏幕坐标：以 canvas 左上角为原点 (0,0)，向右 x 增大，向下 y 增大（逻辑像素）。
 *   - 世界坐标：x 向右为正，y 向下为正，默认画布中心为世界原点。与改造前的 transform
 *     { x: width/2, y: height/2, scale: 1 } 语义完全等价，保证缩放/平移行为不回归。
 */
export class CoordinateSystem {
  readonly width: number;      // 画布逻辑宽度（已除以 DPR）
  readonly height: number;     // 画布逻辑高度
  readonly xZero: number;      // 世界原点 x=0 对应的屏幕 x
  readonly yZero: number;      // 世界原点 y=0 对应的屏幕 y
  readonly xScale: number;     // 每单位世界长度 = 多少屏幕像素（横向）
  readonly yScale: number;     // 每单位世界长度 = 多少屏幕像素（纵向；通常与 xScale 相等，保持等比）

  constructor(
    width: number,
    height: number,
    xZero: number,
    yZero: number,
    xScale: number,
    yScale: number
  ) {
    this.width = width;
    this.height = height;
    this.xZero = xZero;
    this.yZero = yZero;
    this.xScale = xScale;
    this.yScale = yScale;
  }

  /** 以画布中心为世界原点、等比缩放初始化 */
  static centered(width: number, height: number, scale = 1): CoordinateSystem {
    return new CoordinateSystem(width, height, width / 2, height / 2, scale, scale);
  }

  /** 世界 x → 屏幕 x */
  worldToScreenX(worldX: number): number {
    return this.xZero + worldX * this.xScale;
  }

  /** 世界 y → 屏幕 y（几何内部约定世界 y 向上为正；屏幕向下为正，故镜像） */
  worldToScreenY(worldY: number): number {
    return this.yZero + worldY * this.yScale;
  }

  /** 屏幕 x → 世界 x（约定：世界 y 与屏幕 y 同向，向下为正；与改造前 transform 语义一致） */
  screenToWorldX(screenX: number): number {
    return (screenX - this.xZero) / this.xScale;
  }

  /** 屏幕 y → 世界 y */
  screenToWorldY(screenY: number): number {
    return (screenY - this.yZero) / this.yScale;
  }

  /** 批量：世界 → 屏幕 */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return { x: this.worldToScreenX(worldX), y: this.worldToScreenY(worldY) };
  }

  /** 批量：屏幕 → 世界 */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: this.screenToWorldX(screenX), y: this.screenToWorldY(screenY) };
  }

  /**
   * 以屏幕点 (screenX, screenY) 为焦点缩放。
   * 该点在缩放前后世界坐标不变。
   */
  zoom(factor: number, screenX?: number, screenY?: number): CoordinateSystem {
    let newScale = this.xScale * factor;
    if (!Number.isFinite(newScale) || newScale <= 0) return this;

    const sx = screenX ?? this.width / 2;
    const sy = screenY ?? this.height / 2;
    const wx = this.screenToWorldX(sx);
    const wy = this.screenToWorldY(sy);
    return new CoordinateSystem(
      this.width,
      this.height,
      sx - wx * newScale,
      sy - wy * newScale,
      newScale,
      newScale
    );
  }

  /** 屏幕向量平移（dx, dy 为屏幕像素位移） */
  panBy(dxScreen: number, dyScreen: number): CoordinateSystem {
    if (dxScreen === 0 && dyScreen === 0) return this;
    return new CoordinateSystem(
      this.width,
      this.height,
      this.xZero + dxScreen,
      this.yZero + dyScreen,
      this.xScale,
      this.yScale
    );
  }

  /** 改变画布尺寸（保持可见世界范围不变） */
  setSize(width: number, height: number): CoordinateSystem {
    if (width === this.width && height === this.height) return this;
    return new CoordinateSystem(
      width,
      height,
      this.xZero + (width - this.width) / 2,
      this.yZero + (height - this.height) / 2,
      this.xScale,
      this.yScale
    );
  }

  /** 当前可见区域的世界坐标范围 */
  visibleWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const tl = this.screenToWorld(0, 0);                   // 左上（y 最大）
    const br = this.screenToWorld(this.width, this.height); // 右下（y 最小）
    return {
      minX: Math.min(tl.x, br.x),
      maxX: Math.max(tl.x, br.x),
      minY: Math.min(tl.y, br.y),
      maxY: Math.max(tl.y, br.y),
    };
  }

  /** 网格主刻度对应的世界长度（按当前缩放自适应） */
  gridStepWorld(): number {
    const pxPerUnit = this.xScale;
    if (pxPerUnit >= 200) return 0.1;
    if (pxPerUnit >= 100) return 0.25;
    if (pxPerUnit >= 50) return 0.5;
    if (pxPerUnit >= 20) return 1;
    if (pxPerUnit >= 10) return 2;
    if (pxPerUnit >= 5) return 5;
    if (pxPerUnit >= 2) return 10;
    return 20;
  }
}
