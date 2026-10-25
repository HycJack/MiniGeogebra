import React from 'react';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { Kernel } from '../kernel/core/Kernel';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoBoolean } from '../kernel/geo/GeoBoolean';

export interface UIElement {
  id: string;
  type: 'text' | 'slider' | 'button' | 'checkbox';
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
                value={element.value}
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
              <div className="text-xs text-gray-600 mt-1 text-center">{element.value}</div>
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
              onClick={(e) => {
                e.stopPropagation();
                alert(`Button "${element.label}" clicked!`);
              }}
            >
              {element.label}
            </button>
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
