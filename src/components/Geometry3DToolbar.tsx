/**
 * Geometry3DToolbar —— 3D 视图专用工具栏。
 *
 * 参考 GeoGebra 的 3D style bar，提供：
 *   - 投影模式切换（透视/正交）
 *   - 标准视图预设（Home / XY / XZ / YZ）
 *   - 坐标轴 & 平面显示切换（4种状态循环）
 *   - 网格开关
 *   - 旋转动画（播放/暂停 + 速度滑块）
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Home, Grid3X3, RotateCw, Pause, Play } from 'lucide-react';
import type { ProjectionMode, StandardView } from '../kernel/view/WebGL3DRenderer';
import type { TFunction } from '../i18n/LanguageContext';

interface Props {
  projectionMode: ProjectionMode;
  setProjectionMode: (m: ProjectionMode) => void;
  onSetView: (v: StandardView) => void;
  showAxes: boolean;
  setShowAxes: (v: boolean | ((p: boolean) => boolean)) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean | ((p: boolean) => boolean)) => void;
  /** 0 = 隐藏, 1 = 仅坐标轴, 2 = 仅平面, 3 = 坐标轴+平面 */
  axesPlaneMode: number;
  setAxesPlaneMode: (v: number) => void;
  /** XY 坐标平面填充板开关（当前 3D 视图仅显示 XY 平面）。 */
  planeXY: boolean;
  setPlaneXY: (v: boolean) => void;
  /** 旋转动画速度（0 = 停止, 正值 = 顺时针, 负值 = 逆时针）。 */
  rotationSpeed: number;
  setRotationSpeed: (v: number) => void;
  t: TFunction;
}

const AXES_PLANE_KEYS: ('axesPlaneNone' | 'axesOnly' | 'planeOnly' | 'axesAndPlane')[] = [
  'axesPlaneNone', 'axesOnly', 'planeOnly', 'axesAndPlane',
];

export const Geometry3DToolbar: React.FC<Props> = ({
  projectionMode, setProjectionMode,
  onSetView,
  showAxes, setShowAxes, showGrid, setShowGrid,
  axesPlaneMode, setAxesPlaneMode,
  planeXY, setPlaneXY,
  rotationSpeed, setRotationSpeed,
  t,
}) => {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showProjectionMenu, setShowProjectionMenu] = useState(false);
  const [showAxesPlaneMenu, setShowAxesPlaneMenu] = useState(false);
  const [showRotationPanel, setShowRotationPanel] = useState(false);

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const projMenuRef = useRef<HTMLDivElement>(null);
  const axesMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (viewMenuRef.current && !viewMenuRef.current.contains(target)) setShowViewMenu(false);
      if (projMenuRef.current && !projMenuRef.current.contains(target)) setShowProjectionMenu(false);
      if (axesMenuRef.current && !axesMenuRef.current.contains(target)) setShowAxesPlaneMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cycleAxesPlane = useCallback(() => {
    const next = (axesPlaneMode + 1) % 4;
    setAxesPlaneMode(next);
  }, [axesPlaneMode, setAxesPlaneMode]);

  const isAnimating = rotationSpeed !== 0;

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5 pointer-events-auto">
      {/* ── 视图预设 ── */}
      <div ref={viewMenuRef} className="relative">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 shadow border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
          onClick={() => { setShowViewMenu(!showViewMenu); setShowProjectionMenu(false); setShowAxesPlaneMenu(false); }}
          title={t('viewHome')}
        >
          <Home size={18} />
        </button>
        {showViewMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
            <ViewMenuItem label={t('viewHome')} onClick={() => { onSetView('home'); setShowViewMenu(false); }} />
            <ViewMenuItem label={t('viewXY')} onClick={() => { onSetView('xy'); setShowViewMenu(false); }} />
            <ViewMenuItem label={t('viewXZ')} onClick={() => { onSetView('xz'); setShowViewMenu(false); }} />
            <ViewMenuItem label={t('viewYZ')} onClick={() => { onSetView('yz'); setShowViewMenu(false); }} />
          </div>
        )}
      </div>

      {/* ── 投影模式 ── */}
      <div ref={projMenuRef} className="relative">
        <button
          className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 shadow border border-gray-200 transition-colors ${
            projectionMode === 'orthographic' ? 'text-blue-600 border-blue-300' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
          }`}
          onClick={() => { setShowProjectionMenu(!showProjectionMenu); setShowViewMenu(false); setShowAxesPlaneMenu(false); }}
          title={projectionMode === 'perspective' ? t('projectionPerspective') : t('projectionOrthographic')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {projectionMode === 'perspective' ? (
              <>
                <path d="M2 12L12 2l10 10-10 10z" />
                <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" opacity="0.4" />
              </>
            ) : (
              <>
                <rect x="3" y="3" width="18" height="18" rx="1" />
                <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3 3" opacity="0.4" />
                <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 3" opacity="0.4" />
              </>
            )}
          </svg>
        </button>
        {showProjectionMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
            <ViewMenuItem
              label={t('projectionPerspective')}
              active={projectionMode === 'perspective'}
              onClick={() => { setProjectionMode('perspective'); setShowProjectionMenu(false); }}
            />
            <ViewMenuItem
              label={t('projectionOrthographic')}
              active={projectionMode === 'orthographic'}
              onClick={() => { setProjectionMode('orthographic'); setShowProjectionMenu(false); }}
            />
          </div>
        )}
      </div>

      {/* ── 坐标轴 & 平面 ── */}
      <div ref={axesMenuRef} className="relative">
        <button
          className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 shadow border border-gray-200 transition-colors ${
            axesPlaneMode > 0 ? 'text-blue-600 border-blue-300' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
          }`}
          onClick={() => { setShowAxesPlaneMenu(!showAxesPlaneMenu); setShowViewMenu(false); setShowProjectionMenu(false); }}
          title={t(AXES_PLANE_KEYS[axesPlaneMode])}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="20" x2="20" y2="20" />
            <line x1="4" y1="20" x2="4" y2="4" />
            <line x1="4" y1="20" x2="18" y2="8" opacity="0.4" />
            {axesPlaneMode >= 2 && (
              <path d="M4 20L20 20L18 8" fill="currentColor" opacity="0.1" />
            )}
          </svg>
        </button>
        {showAxesPlaneMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]">
            {[0, 1, 2, 3].map(mode => (
              <ViewMenuItem
                key={mode}
                label={t(AXES_PLANE_KEYS[mode])}
                active={axesPlaneMode === mode}
                onClick={() => { setAxesPlaneMode(mode); setShowAxesPlaneMenu(false); }}
              />
            ))}
            <div className="border-t border-gray-100 my-1" />
            {/* 当前 3D 视图仅显示 XY 平面 */}
            <PlaneToggleItem label={t('planeXY')} active={planeXY} onClick={() => setPlaneXY(!planeXY)} />
          </div>
        )}
      </div>

      {/* ── 网格 ── */}
      <button
        className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 shadow border border-gray-200 transition-colors ${
          showGrid ? 'text-blue-600 border-blue-300' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
        }`}
        onClick={() => setShowGrid(!showGrid)}
        title={showGrid ? t('toggleGrid') : t('toggleGrid')}
      >
        <Grid3X3 size={18} />
      </button>

      {/* ── 旋转动画 ── */}
      <div className="relative">
        <button
          className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 shadow border border-gray-200 transition-colors ${
            isAnimating ? 'text-green-600 border-green-300' : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
          }`}
          onClick={() => {
            if (isAnimating) {
              setRotationSpeed(0);
            } else {
              setRotationSpeed(3);
              setShowRotationPanel(true);
            }
          }}
          title={t('rotateView')}
        >
          {isAnimating ? <Pause size={18} /> : <RotateCw size={18} />}
        </button>
        {showRotationPanel && isAnimating && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-36">
            <div className="text-xs text-gray-500 mb-1">{t('rotateSpeed')}</div>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={rotationSpeed}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRotationSpeed(v);
                if (v === 0) setShowRotationPanel(false);
              }}
              className="w-full accent-green-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>-10</span>
              <span>+10</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** 菜单项。 */
const ViewMenuItem: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
    }`}
    onClick={onClick}
  >
    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
    {label}
  </button>
);

/** 坐标平面填充板切换项（带色点指示）。 */
const PlaneToggleItem: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
    onClick={onClick}
  >
    <span className={`w-3 h-3 rounded-sm border ${active ? 'border-blue-500' : 'border-gray-300'}`} style={{ backgroundColor: active ? 'rgba(59,130,246,0.35)' : 'transparent' }} />
    {label}
  </button>
);

export default Geometry3DToolbar;
