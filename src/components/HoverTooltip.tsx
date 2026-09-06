/**
 * 函数曲线 hover 提示：鼠标在 GeoFunction 附近时显示
 *   f(x) = y  （y 为 NaN 时显示 undefined）
 * 组件不拦截鼠标事件，跟随鼠标位置以 CSS 绝对定位呈现。
 */
import React from 'react';

export interface HoverTooltipData {
  label: string;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  text: string;
}

export const HoverTooltip: React.FC<{ data: HoverTooltipData | null }> = ({ data }) => {
  if (!data) return null;
  return (
    <div
      className="absolute pointer-events-none z-[6] select-none"
      style={{
        left: data.screenX,
        top: data.screenY,
        transform: 'translate(-50%, -140%)',
        background: 'rgba(17, 24, 39, 0.85)',
        color: '#f3f4f6',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
        padding: '3px 8px',
        borderRadius: 4,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      {data.text}
    </div>
  );
};
