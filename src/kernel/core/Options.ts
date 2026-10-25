/**
 * 视图级选项（对标 GeoGebra Options 菜单的三件套）：
 *   - rounding       数值显示小数位（默认 2，对标官方 SHORT 预设）
 *   - angleUnit      角度显示单位（内核一律弧度，仅影响显示与角度输入的解释）
 *   - pointCapturing 点捕捉模式（automatic=创建时贴网格 / snap_grid=始终贴网格 / off）
 *
 * 存放在 Kernel 上（内核不依赖 React），UI 通过 updateOptions 修改并自行刷新视图；
 * 序列化随 ConstructionJSON 落盘（v4 起）。
 */

export type AngleUnit = 'degree' | 'radian';

/** 对标 GeoGebra EuclidianStyleConstants 的 pointCapturing：OFF / ON_GRID / AUTOMATIC。 */
export type PointCapturingMode = 'off' | 'automatic' | 'snap_grid';

export class ViewOptions {
  rounding = 2;
  angleUnit: AngleUnit = 'degree';
  pointCapturing: PointCapturingMode = 'automatic';

  /** UI 修改选项后调用；刷新由调用方负责（如 GeometryCanvas 的 setRenderRev）。 */
  set(patch: Partial<{ rounding: number; angleUnit: AngleUnit; pointCapturing: PointCapturingMode }>): void {
    if (patch.rounding !== undefined) this.rounding = patch.rounding;
    if (patch.angleUnit !== undefined) this.angleUnit = patch.angleUnit;
    if (patch.pointCapturing !== undefined) this.pointCapturing = patch.pointCapturing;
  }
}

/**
 * 按选项格式化数值显示（对标 GeoGebra 的 Rounding 语义）。
 * 小数位去除尾零；NaN/Infinity 给出可读文本而非 "NaN"。
 */
export function formatNumber(value: number, options: Pick<ViewOptions, 'rounding'>): string {
  if (Number.isNaN(value)) return 'undefined';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (value === 0) return '0';
  const decimals = Math.max(0, Math.min(15, Math.round(options.rounding)));
  let text = value.toFixed(decimals);
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  if (text === '-0') text = '0';
  return text;
}

/** 角度值按当前单位显示：度带 ° 后缀；弧度为纯数值（对标 GeoGebra 显示习惯）。 */
export function formatAngle(valueRadians: number, options: Pick<ViewOptions, 'rounding' | 'angleUnit'>): string {
  if (options.angleUnit === 'degree') {
    return `${formatNumber(valueRadians * 180 / Math.PI, options)}°`;
  }
  return formatNumber(valueRadians, options);
}
