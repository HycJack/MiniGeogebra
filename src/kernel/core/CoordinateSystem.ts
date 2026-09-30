/**
 * CoordinateSystem — 统一的世界坐标 ↔ 屏幕坐标仿射变换（GeoGebra / JSXGraph 式设计）
 *
 * 不可变值对象。每次 zoom / pan / resize 都返回一个新实例，方便放入 React state，
 * 且保证“缩放/平移只改变换、不改几何数据”的单一真理源语义。
 *
 * 约定：
 *   - 屏幕坐标：以 canvas 左上角为原点 (0,0)，向右 x 增大，向下 y 增大（逻辑像素）。
 *   - 世界坐标：x 向右为正，y 向上为正（GeoGebra 语义），默认画布中心为世界原点。
 *     世界 → 屏幕的 y 映射取负（worldToScreenY），几何数据全部是数学方向的 y-up。
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

  /** 世界 y → 屏幕 y（世界 y 向上为正；屏幕向下为正，故取负） */
  worldToScreenY(worldY: number): number {
    return this.yZero - worldY * this.yScale;
  }

  /** 屏幕 x → 世界 x */
  screenToWorldX(screenX: number): number {
    return (screenX - this.xZero) / this.xScale;
  }

  /** 屏幕 y → 世界 y（与 worldToScreenY 互逆） */
  screenToWorldY(screenY: number): number {
    return (this.yZero - screenY) / this.yScale;
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
    // 焦点世界点缩放后仍映射到同一屏幕点：y 方向映射取负，xZero/yZero 解出来带符号
    return new CoordinateSystem(
      this.width,
      this.height,
      sx - wx * newScale,
      sy + wy * newScale,
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

  /** 当前可见区域的世界坐标范围（y-up：上边界大于下边界） */
  visibleWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: Math.min(this.screenToWorldX(0), this.screenToWorldX(this.width)),
      maxX: Math.max(this.screenToWorldX(0), this.screenToWorldX(this.width)),
      minY: this.screenToWorldY(this.height),
      maxY: this.screenToWorldY(0),
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
