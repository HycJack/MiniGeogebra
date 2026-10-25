import { ConstructionElement } from '../core/ConstructionElement';
import { IKernel, Path, Region, Transformable, PathMover } from '../core/Interfaces';
import { GeoVec3D } from '../core/GeoVec3D';
import { formatNumber } from '../core/Options';
import type { GeoPoint } from './GeoPoint';
import type { GeoLine } from './GeoLine';
import type { GeoNumeric } from './GeoNumeric';
import { evaluate } from '../algebra/ExpressionEvaluator';
import type { AlgoElement } from '../algo/AlgoElement';

/**
 * 几何对象基类。本次改造强化了描述体系（对标 GeoGebra 代数区 / JSXGraph 信息面板）：
 *   - getAlgebraDescription()    ：对象的“代数长相”（如直线 y = 2x + 1、圆 (x-1)²+(y+2)² = 9）；
 *   - getDefinitionDescription() ：构造定义（如 “A = Point(2, 3)”、“l = Line(A, B)”）；
 *   - getCommandDescription()    ：命令形式（委托给 parentAlgo）。
 * 默认实现：若对象由算法派生，则定义描述委托给 parentAlgo；自由对象标注为“自由”。
 * 各子类负责覆写 getAlgebraDescription 给出可读的解析表达式。
 */
export abstract class GeoElement extends ConstructionElement
  implements Path, Region, Transformable {

  protected isDefined_ = true;
  public label = '';
  protected coords: GeoVec3D;
  public parentAlgo: AlgoElement | null = null;
  protected animating: boolean = false;

  // ---- P2-1: 对象样式属性（对标 GeoGebra）----
  public strokeColor: string | null = null;     // null → 使用类型默认色
  public strokeWidth: number | null = null;     // null → 使用类型默认线宽
  public strokeDash: number[] | null = null;    // null → 实线；非空为 Canvas2D setLineDash 数组
  public fillColor: string | null = null;       // null → 不填充（对可填充对象）
  public labelVisible = true;                   // 是否显示标签
  public labelMode: 'always' | 'mouse' | 'never' = 'always';
  public visible = true;                        // 对象级可见性（隐藏对象仍参与构造）
  // 标签相对默认锚点的偏移（**屏幕像素**，拖动标签时由视图层写入；
  // +x 向右、+y 向下），随样式一并序列化。
  public labelOffsetX = 0;
  public labelOffsetY = 0;
  // ---- 元能力三样（对标 GeoGebra Basic/Advanced 属性）----
  /** 固定：不可拖动（仍可删除/改样式），右键菜单与序列化均可用。 */
  public isFixed = false;
  /** 轨迹：对象移动时在画布上留下踪迹（视图层 TraceLayer 消费）。 */
  public trace = false;
  /** 图层 0–9：渲染与命中按层排序（高层在上、优先命中）。 */
  public layer = 0;

  // 各子类型可覆写的默认样式（绘制层 fallback 用）
  public get defaultStrokeColor(): string { return '#000000'; }
  public get defaultLineWidth(): number { return 1; }

  constructor(kernel: IKernel, coords: GeoVec3D) {
    super(kernel);
    this.coords = coords;
  }

  // ConstructionElement
  getMinConstructionIndex(): number { return this.constIndex; }
  getMaxConstructionIndex(): number { return this.constIndex; }
  isIndependent(): boolean { return this.parentAlgo === null; }
  isGeoElement(): boolean { return true; }
  isAlgoElement(): boolean { return false; }
  getGeoElements(): GeoElement[] { return [this]; }

  /** 派生对象的默认填充色 */
  public get defaultFillColor(): string | null { return null; }

  isAnimatable(): boolean { return false; }
  isAnimating(): boolean { return this.animating; }

  setAnimating(flag: boolean) {
    const oldValue = this.animating;
    this.animating = flag && this.isAnimatable();
    if (oldValue !== this.animating) {
      const am = this.kernel.getAnimationManager();
      if (this.animating) am.addAnimatedGeo(this);
      else am.removeAnimatedGeo(this);
    }
  }

  /** 按当前 rounding 选项格式化数值（对标 GeoGebra Options→Rounding，默认 2 位小数）。 */
  protected fmt(v: number): string {
    return formatNumber(v, this.kernel.getOptions());
  }

  getNameDescription(): string { return this.label || `GeoElement_${this.id}`; }

  /** 命令形式：优先委托给构造该对象的算法 */
  getCommandDescription(): string {
    return this.parentAlgo ? this.parentAlgo.getCommandDescription() : '';
  }

  /** 构造定义：派生对象显示 “标签 = Algorithm(输入)”；自由对象显示 “标签（自由）” */
  getDefinitionDescription(): string {
    if (this.parentAlgo) {
      return `${this.label} = ${this.parentAlgo.getCommandDescription()}`;
    }
    return `${this.label}（自由点）`;
  }

  /** 代数描述：由各子类给出可读的解析式（点坐标、直线方程、圆方程…） */
  getAlgebraDescription(): string {
    return this.getClassName();
  }

  getXML(): string {
    return `<element id="${this.id}" label="${this.label}" type="${this.getClassName()}">
      ${this.coords.getXML()}
    </element>`;
  }
  getI2G(mode: number): string { return `// I2G for ${this.id}`; }

  update() {
    this.kernel.notifyUpdate(this);
  }

  setCoords(x: number, y: number, z: number = 1) {
    this.coords.set(x, y, z);
    this.isDefined_ = true;
    this.update();
  }

  getCoords(): GeoVec3D { return this.coords; }

  isDefined(): boolean { return this.isDefined_; }
  setUndefined() { this.isDefined_ = false; this.update(); }
  setDefined() { this.isDefined_ = true; this.update(); }

  // ---- 条件显隐 / 动态颜色（对标 GeoGebra setShowObjectCondition / setObjColor 函数版）----
  /** 显示条件：数值表达式 AST + 数值依赖；求值 ≠ 0 才可见（在用户 visible 开关之上）。
   *  惰性求值（每次绘制/命中时读取依赖当前值），依赖变动经 notifyUpdate 触发重绘。 */
  public visibleCondition: { ast: import('../algebra/ExpressionNode').ExpressionNode; deps: GeoNumeric[] } | null = null;
  /** 动态颜色：r/g/b(/a) 表达式（0~1），绘制时求值覆盖静态颜色。 */
  public dynamicColor: { r: import('../algebra/ExpressionNode').ExpressionNode; g: import('../algebra/ExpressionNode').ExpressionNode; b: import('../algebra/ExpressionNode').ExpressionNode; a?: import('../algebra/ExpressionNode').ExpressionNode; deps: GeoNumeric[] } | null = null;

  isEffectivelyVisible(): boolean {
    if (this.visible === false) return false;
    const cond = this.visibleCondition;
    if (!cond) return true;
    const scope = new Map<string, number>();
    for (const d of cond.deps) scope.set(d.label || '', d.getValue());
    try {
      const v = evaluate(cond.ast, scope);
      return Number.isFinite(v) && v !== 0;
    } catch {
      return true; // 条件求值失败按可见处理，显隐开关仍在用户手里
    }
  }

  /** 动态颜色求值；无条件/出错返回 null（调用方回退静态颜色）。 */
  resolveDynamicColor(): { r: number; g: number; b: number; a: number } | null {
    const dyn = this.dynamicColor;
    if (!dyn) return null;
    const scope = new Map<string, number>();
    for (const d of dyn.deps) scope.set(d.label || '', d.getValue());
    try {
      const ch = (ast: import('../algebra/ExpressionNode').ExpressionNode) => {
        const v = evaluate(ast, scope);
        return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
      };
      const r = ch(dyn.r), g = ch(dyn.g), b = ch(dyn.b);
      if (r === null || g === null || b === null) return null;
      const a = dyn.a ? ch(dyn.a) : null;
      return { r, g, b, a: a ?? 1 };
    } catch {
      return null;
    }
  }

  abstract getClassName(): string;

  // Path
  pointChanged(_PI: GeoPoint): void { this.update(); }
  pathChanged(_PI: GeoPoint): void { this.update(); }
  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const dx = this.coords.x - PI.getCoords().x;
    const dy = this.coords.y - PI.getCoords().y;
    return Math.hypot(dx, dy) < eps;
  }
  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return 1; }
  isClosedPath(): boolean { return false; }
  createPathMover(): PathMover {
    throw new Error('Not implemented');
  }

  // Region
  pointChangedForRegion(_P: GeoPoint): void { this.update(); }
  regionChanged(_P: GeoPoint): void { this.update(); }
  isInRegion(_P: GeoPoint): boolean { return false; }
  isInRegionXY(_x0: number, _y0: number): boolean { return false; }

  // Transformable
  translate(_v: GeoVec3D): void { this.update(); }
  rotate(_angle: number, _center?: GeoPoint): void { this.update(); }
  dilate(_r: number, _center: GeoPoint): void { this.update(); }
  matrixTransform(_a00: number, _a01: number, _a10: number, _a11: number): void { this.update(); }
  mirror(_point?: GeoPoint, _line?: GeoLine): void { this.update(); }
}
