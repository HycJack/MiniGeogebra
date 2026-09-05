import React from 'react';
import { Kernel } from '../kernel/core/Kernel';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { SliderControl } from './SliderControl';
import { Menu, Sliders, Square } from 'lucide-react';
import type { TFunction } from '../i18n/LanguageContext';

interface SidePanelProps {
  kernel: Kernel;
  panelTab: 'algebra' | 'properties';
  setPanelTab: (t: 'algebra' | 'properties') => void;
  selectedElements: GeoElement[];
  coord: CoordinateSystem;
  recordStyleChange: (el: GeoElement, changes: Record<string, unknown>) => void;
  notifyNumericChange: (numeric: GeoNumeric, oldValue: number, newValue: number) => void;
  renderRev: number;
  t: TFunction;
}

const SidePanel: React.FC<SidePanelProps> = ({
  kernel, panelTab, setPanelTab, selectedElements, coord,
  recordStyleChange, notifyNumericChange, renderRev, t
}) => {
  // renderRev 只用于让约束点参数在动画循环中随构造刷新重新计算。
  void renderRev;
  const animationElements = kernel.getConstruction().getElements().flatMap(el => {
    if (el instanceof GeoNumeric && el.isAnimating()) {
      return [{ point: null, numeric: el }];
    }
    if (el instanceof GeoPoint && el.parentAlgo) {
      const numeric = el.parentAlgo.getInput().find(input => input instanceof GeoNumeric) as GeoNumeric | undefined;
      if (numeric && numeric.isAnimating()) return [{ point: el, numeric }];
    }
    return [];
  });

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
      <div className="flex items-stretch border-b border-gray-200 bg-gray-50">
        <button
          className={`px-3 py-2 text-sm font-medium flex-1 flex items-center justify-center gap-2 ${
            panelTab === 'algebra' ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setPanelTab('algebra')}>
          <Menu size={14} />
          <span>代数视图</span>
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium flex-1 flex items-center justify-center gap-2 ${
            panelTab === 'properties' ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setPanelTab('properties')}>
          <Sliders size={14} />
          <span>属性</span>
        </button>
      </div>

      {panelTab === 'algebra' && (
        <>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {kernel.getConstruction().getElements().map(el => {
              let typeName = el.getClassName();
              if (typeName === 'GeoPoint') typeName = t('typePoint');
              else if (typeName === 'GeoLine') typeName = t('typeLine');
              else if (typeName === 'GeoSegment') typeName = t('typeSegment');
              else if (typeName === 'GeoConic') typeName = t('typeCircle');
              else if (typeName === 'GeoPolygon') typeName = t('typePolygon');
              else if (typeName === 'GeoNumeric') typeName = t('typeNumeric');
              else if (typeName === 'GeoLocus') typeName = t('typeLocus');

              return (
                <div key={el.id} className="group flex flex-col p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                    <span className="font-semibold text-gray-800">{el.getNameDescription()}</span>
                  </div>
                  <div className="text-sm text-gray-500 ml-5 font-mono mt-0.5">
                    {'getAlgebraDescription' in el ? el.getAlgebraDescription() : typeName}
                  </div>
                </div>
              );
            })}
            {kernel.getConstruction().getElements().length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-10 p-4">
                {t('emptyState')}
              </div>
            )}
          </div>

          {animationElements.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 flex flex-col max-h-64">
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700 text-sm">{t('animationsAndControls')}</h3>
                  <button
                    type="button"
                    onClick={() => kernel.getAnimationManager().stopAllAnimation()}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                    title={t('stopAnimation')}
                  >
                    <Square size={14} />
                  </button>
                </div>
              </div>
              <div className="p-2 overflow-y-auto space-y-2">
                {animationElements.map(({ point, numeric }) => (
                  <SliderControl
                    key={numeric.id}
                    numeric={numeric}
                    kernel={kernel}
                    label={point?.getNameDescription()}
                    onNumericChange={notifyNumericChange}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {panelTab === 'properties' && (
        <div className="flex-1 overflow-y-auto p-3">
          {selectedElements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Menu size={32} className="mb-3 opacity-50" />
              <span className="text-sm">请先在画布上选择一个对象查看/编辑属性</span>
            </div>
          ) : selectedElements.length === 1 ? (
            (() => {
              const el = selectedElements[0];
              const needsFill = el instanceof GeoPolygon || el instanceof GeoConic;
              return (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-base font-semibold text-gray-800">{el.getNameDescription()}</span>
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-mono">{el.getClassName()}</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">轮廓颜色</label>
                    <div className="flex gap-2 items-center">
                      <input type="color"
                        value={el.strokeColor ?? '#000000'}
                        onChange={(e) => recordStyleChange(el, { strokeColor: e.target.value })}
                        className="w-9 h-9 rounded cursor-pointer border-0 p-0 overflow-hidden"
                      />
                      <input type="text"
                        value={el.strokeColor ?? '#000000'}
                        onChange={(e) => recordStyleChange(el, { strokeColor: e.target.value })}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">线宽</label>
                    <input type="number" min="0" step="0.5" max="50"
                      value={el.strokeWidth ?? el.defaultLineWidth}
                      onChange={(e) => recordStyleChange(el, { strokeWidth: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">线型</label>
                    <button
                      onClick={() => recordStyleChange(el, { strokeDash: el.strokeDash ? null : [5 / coord.xScale, 5 / coord.xScale] })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 flex justify-between items-center">
                      <span>{el.strokeDash && el.strokeDash.length ? '虚线' : '实线'}</span>
                      {el.strokeDash && el.strokeDash.length ? (
                        <span className="text-gray-500 font-mono">{String(el.strokeDash[0]).slice(0,3)} , {String(el.strokeDash[1]).slice(0,3)}</span>
                      ) : null}
                    </button>
                  </div>

                  {needsFill && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-600 block">填充颜色</label>
                      <div className="flex gap-2 items-center">
                        <input type="color"
                          value={el.fillColor ?? 'rgba(59, 130, 246, 0.2)'}
                          onChange={(e) => recordStyleChange(el, { fillColor: e.target.value })}
                          className="w-9 h-9 rounded cursor-pointer border-0 p-0 overflow-hidden"
                        />
                        <input type="text"
                          value={el.fillColor ?? 'rgba(59, 130, 246, 0.2)'}
                          onChange={(e) => recordStyleChange(el, { fillColor: e.target.value })}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">显示标签</label>
                    <input type="checkbox"
                      checked={el.labelVisible}
                      onChange={(e) => recordStyleChange(el, { labelVisible: e.target.checked })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">标签显示时机</label>
                    <select
                      value={el.labelMode}
                      onChange={(e) => recordStyleChange(el, { labelMode: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="always">总是显示</option>
                      <option value="mouse">鼠标悬停或选中时</option>
                      <option value="never">从不显示</option>
                    </select>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-700">
                <span className="text-blue-600">{selectedElements.length}</span> 个对象被选中
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">统一轮廓颜色:</span>
                  <input type="color" value="#000000"
                    onChange={(e) => {
                      selectedElements.forEach((el) => recordStyleChange(el, { strokeColor: e.target.value }));
                    }}
                    className="w-7 h-7 rounded cursor-pointer border-0 p-0 overflow-hidden"
                  />
                </div>
                <button
                  onClick={() => {
                    selectedElements.forEach((el) => recordStyleChange(el, { strokeDash: null }));
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 hover:bg-gray-100">
                  全部设为实线
                </button>
                <div className="pt-2 text-xs text-gray-500">
                  多选时只能编辑共享样式；单个对象时还可编辑填充、标签等完整属性。
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SidePanel;
