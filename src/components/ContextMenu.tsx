/**
 * 画布上的右键菜单（GeoGebra 习惯）。
 * 组件固定定位在鼠标点击处，深色底配白字与 lucide 图标；点击其他区域或按
 * Escape 关闭。onMouseDown 阻止冒泡，避免误触发画布选择/框选。
 */
import React, { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** 显示为分隔线（此条目不承载 onClick） */
  separator?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface Props {
  state: ContextMenuState | null;
  onClose: () => void;
}

export const ContextMenu: React.FC<Props> = ({ state, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  // 视口裁剪：如果菜单在右/下溢出，把 x/y 往内夹
  useEffect(() => {
    if (!state || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const margin = 8;
    let nx = state.x;
    let ny = state.y;
    if (nx + rect.width + margin > window.innerWidth) nx = Math.max(margin, window.innerWidth - rect.width - margin);
    if (ny + rect.height + margin > window.innerHeight) ny = Math.max(margin, window.innerHeight - rect.height - margin);
    if (nx !== state.x || ny !== state.y) {
      ref.current.style.left = `${nx}px`;
      ref.current.style.top = `${ny}px`;
    }
  }, [state]);

  // Escape / 点击外部关闭
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    // 用 capture 保证先于 canvas 的 keydown 处理被消费
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [state, onClose]);

  if (!state) return null;

  const handleClickOutside = (e: React.MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60]" onMouseDown={handleClickOutside} style={{ pointerEvents: 'auto' }}>
      <div
        ref={ref}
        className="absolute bg-white shadow-xl rounded-md border border-gray-200 py-1 min-w-[180px] text-sm text-gray-800"
        style={{ left: state.x, top: state.y }}
        onMouseDown={e => e.stopPropagation()}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
        role="menu"
      >
        {state.items.map((item, i) =>
          item.separator ? (
            <div key={`sep-${i}`} className="my-1 h-px bg-gray-200" />
          ) : (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-1.5 w-full text-left hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:outline-none"
              onClick={e => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              {item.icon ? <item.icon size={14} className="shrink-0 text-gray-500" /> : <span className="w-[14px] shrink-0" />}
              <span>{item.label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
};
