/**
 * 画布键盘快捷键的纯逻辑层。
 *
 * 设计：resolveViewKey 把"按键 + 当前视图 + 画布尺寸"折算成对视图的最小变更描述，
 * 不直接操作 React state，便于单元测试覆盖每一种 key 分支。
 *
 * 与 GeoGebra 对齐的语义：
 *   +/-/=     以画布中心为焦点缩放（因子 1.2 / 1/1.2）
 *   -         同 zoom，负号形式
 *   0         重置到居中默认视图（保留调用方的 scale 决定权）
 *   Arrow*    以屏幕像素为单位平移（默认 40 px）
 *
 * 其他按键一律返回 kind:'none'，由上层键盘监听自行处理（例如 Escape/Delete/Enter
 * 已被 move / 选中删除等上层逻辑消费）。
 */

import type { CoordinateSystem } from '../../kernel/core/CoordinateSystem';

export type KeyActionKind = 'zoom' | 'pan' | 'reset' | 'none';

export interface KeyResult {
  kind: KeyActionKind;
  /** 缩放因子（仅 kind==='zoom' 时有效） */
  factor?: number;
  /** 屏幕像素位移（仅 kind==='pan' 时有效；正向右、正向下） */
  dx?: number;
  dy?: number;
}

export const DEFAULT_ZOOM_FACTOR = 1.2;
export const DEFAULT_PAN_STEP = 40;

/**
 * 解析一个按键：给定当前 coord 与 canvas 逻辑尺寸，返回期望的视图变化。
 * coord/size 在 zoom 分支目前不会用到，但为将来按焦点位置缩放保留参数。
 */
export function resolveViewKey(
  key: string,
  _coord?: CoordinateSystem,
  _size?: { width: number; height: number },
): KeyResult {
  switch (key) {
    case '+':
    case '=':
      return { kind: 'zoom', factor: DEFAULT_ZOOM_FACTOR };
    case '-':
    case '_':
      return { kind: 'zoom', factor: 1 / DEFAULT_ZOOM_FACTOR };
    case '0':
      return { kind: 'reset' };
    case 'ArrowLeft':
      return { kind: 'pan', dx: -DEFAULT_PAN_STEP, dy: 0 };
    case 'ArrowRight':
      return { kind: 'pan', dx: DEFAULT_PAN_STEP, dy: 0 };
    case 'ArrowUp':
      return { kind: 'pan', dx: 0, dy: -DEFAULT_PAN_STEP };
    case 'ArrowDown':
      return { kind: 'pan', dx: 0, dy: DEFAULT_PAN_STEP };
    default:
      return { kind: 'none' };
  }
}

/**
 * 生成 hover 提示文本（GeoGebra 风格）：
 *   - y 为 NaN：显示 "undefined"
 *   - 有 label：`<label>(x) = y`
 *   - 无 label：`y = <y>`
 * x/y 固定 3 位小数，避免出现浮点尾数噪音。
 */
export function formatHover(label: string | undefined, x: number, y: number): string {
  const xStr = Number.isFinite(x) ? x.toFixed(3) : 'NaN';
  const yStr = Number.isFinite(y) ? y.toFixed(3) : 'undefined';
  if (!label) return `y = ${yStr}`;
  return `${label}(${xStr}) = ${yStr}`;
}
