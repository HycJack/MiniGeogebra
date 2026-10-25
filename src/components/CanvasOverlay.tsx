import React from 'react';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { Kernel } from '../kernel/core/Kernel';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoBoolean } from '../kernel/geo/GeoBoolean';

export interface UIElement {
  id: string;
  type: 'text' | 'slider' | 'button' | 'checkbox' | 'inputbox';
  x: number;
  y: number;
  label?: string;
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  checked?: boolean;
  /** checkbox 绑定的内核 GeoBoolean 标签（勾选状态入内核/undo/序列化） */
  booleanLabel?: string;
  /** slider 绑定的内核 GeoNumeric 标签 */
  numericLabel?: string;
  /** 按钮点击时执行的脚本命令列表（SetValue/StartAnimation 等最小脚本） */
  script?: string[];
  /** inputbox 绑定的内核 GeoNumeric 标签（输入即改值） */
  inputTarget?: string;
}

interface CanvasOverlayProps {
  uiElements: UIElement[];
  setUIElements: React.Dispatch<React.SetStateAction<UIElement[]>>;
  editingUIElement: string | null;
  setEditingUIElement: React.Dispatch<React.SetStateAction<string | null>>;
  draggingUIElement: string | null;
  setDraggingUIElement: React.Dispatch<React.SetStateAction<string | null>>;
  coord: CoordinateSystem;
  kernel?: Kernel;
  /** 复选框勾选回调：由 GeometryCanvas 写内核 GeoBoolean 并记 undo。 */
  onBooleanToggle?: (element: UIElement, next: boolean) => void;
}

const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
  uiElements, setUIElements, editingUIElement, setEditingUIElement,
  draggingUIElement, setDraggingUIElement, coord, kernel, onBooleanToggle
}) => {
  return (
    <>
      {uiElements.map(element => {
        const screenX = element.x * coord.xScale + coord.xZero;
        const screenY = coord.yZero - element.y * coord.yScale;

        /** 最小脚本执行器（对标官方脚本子集）：SetValue(target, value) / StartAnimation(target)。
 *  逐条解析执行，未知命令静默跳过（与官方宽松语义一致）。 */
function runMiniScript(kernel: Kernel, script: readonly string[]): void {
  for (const line of script) {
    const m = /^(\w+)\s*\((.*)\)$/.exec(line.trim());
    if (!m) continue;
    const [, cmd, argText] = m;
    const args = argText.split(',').map(a => a.trim()).filter(a => a.length > 0);
    if (cmd === 'SetValue' && args.length === 2) {
      const [label, valueText] = args;
      const target = kernel.getConstruction().getElements().find(
        el => (el as { label?: string }).label === label);
      const value = Number(valueText.replace(/^["']|["']$/g, ''));
      if (target instanceof GeoNumeric && Number.isFinite(value)) {
        target.setValue(value);
        kernel.notifyUpdate(target);
      } else if (target instanceof GeoBoolean) {
        target.setValue(valueText.replace(/^["']|["']$/g, '') === 'true');
        kernel.notifyUpdate(target);
      }
    } else if (cmd === 'StartAnimation' && args.length === 1) {
      const target = kernel.getConstruction().getElements().find(
        el => (el as { label?: string }).label === args[0]);
      const am = kernel.getAnimationManager();
      if (target && 'setAnimating' in target) {
        (target as unknown as { setAnimating(v: boolean): void }).setAnimating(true);
        am.startAnimation();
      } else {
        // 无参/未知目标：全部播放
        am.startAnimation();
      }
    }
  }
}

/** 滑块显示值：绑定内核数值时读其当前值（动画/重定义后保持同步），否则用 UI 状态。 */
  const sliderLiveValue = (el: UIElement): number => {
    if (el.numericLabel && kernel) {
      const numeric = kernel.getConstruction().getElements()
        .find(n => n instanceof GeoNumeric && (n as GeoNumeric).label === el.numericLabel) as GeoNumeric | undefined;
      if (numeric && Number.isFinite(numeric.getValue())) return numeric.getValue();
    }
    return el.value ?? 0;
  };

  const handleUIDragStart = (e: React.MouseEvent) => {
          e.stopPropagation();
          setDraggingUIElement(element.id);
        };

        if (element.type === 'text') {
          return (
            <div
              key={element.id}
              className="absolute"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {editingUIElement === element.id ? (
                <input
                  type="text"
                  defaultValue={element.label}
                  autoFocus
                  onBlur={(e) => {
                    const updated = uiElements.map(el =>
                      el.id === element.id ? { ...el, label: e.target.value } : el
                    );
                    setUIElements(updated);
                    setEditingUIElement(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const updated = uiElements.map(el =>
                        el.id === element.id ? { ...el, label: (e.target as HTMLInputElement).value } : el
                      );
                      setUIElements(updated);
                      setEditingUIElement(null);
                    }
                  }}
                  className="px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none"
                />
              ) : (
                <div
                  className="px-3 py-2 bg-white border border-gray-300 rounded shadow-sm cursor-move hover:border-blue-400"
                  onDoubleClick={() => setEditingUIElement(element.id)}
                  onMouseDown={handleUIDragStart}
                >
                  {element.label}
                </div>
              )}
            </div>
          );
        } else if (element.type === 'slider') {
          return (
            <div
              key={element.id}
              className="absolute bg-white border border-gray-300 rounded-lg shadow-sm p-3 cursor-move"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseDown={handleUIDragStart}
            >
              <div className="text-sm font-medium mb-2">{element.label}</div>
              <input
                type="range"
                min={element.min}
                max={element.max}
                step={element.step}
                value={sliderLiveValue(element)}
                onChange={(e) => {
                  e.stopPropagation();
                  const val = Number(e.target.value);
                  const updated = uiElements.map(el =>
                    el.id === element.id ? { ...el, value: val } : el
                  );
                  setUIElements(updated);
                  // 联动内核：滑块绑定的 GeoNumeric 同步改值，依赖对象实时重算
                  if (element.numericLabel && kernel) {
                    const numeric = kernel.getConstruction().getElements()
                      .find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === element.numericLabel) as GeoNumeric | undefined;
                    if (numeric) {
                      numeric.setValue(val);
                      kernel.notifyUpdate(numeric);
                    }
                  }
                }}
                className="w-32"
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="text-xs text-gray-600 mt-1 text-center">{sliderLiveValue(element)}</div>
            </div>
          );
        } else if (element.type === 'button') {
          return (
            <button
              key={element.id}
              className="absolute px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors cursor-move"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseDown={handleUIDragStart}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // 最小脚本编辑（过渡方案）：每行一条 SetValue/StartAnimation
                const current = (element.script ?? []).join('\n');
                const input = window.prompt('SetValue(a, 3) / StartAnimation(a) — one per line:', current);
                if (input !== null) {
                  const script = input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                  setUIElements(prev => prev.map(el => el.id === element.id ? { ...el, script } : el));
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                // 按钮脚本：SetValue/StartAnimation（对标官方按钮脚本，最小子集）
                if (element.script?.length && kernel) runMiniScript(kernel, element.script);
              }}
            >
              {element.label}
            </button>
          );
        } else if (element.type === 'inputbox') {
          const liveValue = element.numericLabel && kernel
            ? (() => {
                const numeric = kernel.getConstruction().getElements()
                  .find(n => n instanceof GeoNumeric && (n as GeoNumeric).label === element.numericLabel) as GeoNumeric | undefined;
                return numeric?.getValue();
              })()
            : undefined;
          return (
            <div
              key={element.id}
              className="absolute bg-white border border-gray-300 rounded-lg shadow-sm p-2 cursor-move"
              style={{ left: `${screenX}px`, top: `${screenY}px`, transform: 'translate(-50%, -50%)' }}
              onMouseDown={handleUIDragStart}
            >
              <input
                type="text"
                defaultValue={liveValue ?? element.value ?? ''}
                className="w-28 px-2 py-1 text-sm border rounded font-mono"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (element.numericLabel && kernel && Number.isFinite(v)) {
                      const numeric = kernel.getConstruction().getElements()
                        .find(n => n instanceof GeoNumeric && (n as GeoNumeric).label === element.numericLabel) as GeoNumeric | undefined;
                      if (numeric) { numeric.setValue(v); kernel.notifyUpdate(numeric); }
                    }
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
          );
        } else if (element.type === 'checkbox') {
          // 勾选状态以内核 GeoBoolean 为准（React state 仅作兜底显示）
          const kernelBool = element.booleanLabel && kernel
            ? kernel.getConstruction().getElements()
                .find(el => el instanceof GeoBoolean && (el as GeoBoolean).label === element.booleanLabel) as GeoBoolean | undefined
            : undefined;
          const checked = kernelBool ? kernelBool.getValue() : (element.checked ?? false);
          return (
            <label
              key={element.id}
              className="absolute flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 cursor-move hover:border-blue-400"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseDown={handleUIDragStart}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  e.stopPropagation();
                  if (onBooleanToggle) {
                    // 走内核路径：GeoBoolean.setValue 联动关联对象显隐 + undo 入栈
                    onBooleanToggle(element, e.target.checked);
                  } else {
                    const updated = uiElements.map(el =>
                      el.id === element.id ? { ...el, checked: e.target.checked } : el
                    );
                    setUIElements(updated);
                  }
                }}
                className="w-4 h-4"
                onMouseDown={(e) => e.stopPropagation()}
              />
              <span className="text-sm">{element.label}</span>
            </label>
          );
        }
        return null;
      })}
    </>
  );
};

export default CanvasOverlay;
