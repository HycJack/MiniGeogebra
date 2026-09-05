import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer2, CircleDot, Minus, TrendingUp, Circle, CircleDashed,
  Target, X, Crosshair, Equal, Baseline, SplitSquareVertical, Scissors,
  Hexagon, Play, Pause, ChevronDown, ChevronRight, Type,
  Sliders, ToggleLeft, CheckSquare, Ruler, Triangle, Square,
  CornerDownRight, Activity, RotateCw, ZoomIn, FileJson, FilePlus2,
  ImageDown, VectorSquare, Magnet, Axis3D, Grid3X3, Box,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ToolButton from './ToolButton';
import { ToolMode } from './tools/types';
import type { TFunction, TranslationKey } from '../i18n/LanguageContext';

interface ToolbarProps {
  mode: ToolMode;
  setMode: (m: ToolMode) => void;
  showAxes: boolean;
  setShowAxes: (v: boolean | ((p: boolean) => boolean)) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean | ((p: boolean) => boolean)) => void;
  editingLabel: string;
  handleLabelChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLabelSubmit: () => void;
  selectedElementsLength: number;
  radius: number;
  setRadius: (v: number) => void;
  handleExport: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
  toggleAnimation: () => void;
  isAnimating: boolean;
  view: '2d' | '3d';
  setView: (v: '2d' | '3d') => void;
  t: TFunction;
}

type ToolGroup = {
  id: string;
  title: TranslationKey;
  icon: React.ReactNode;
  activeModes: ToolMode[];
  items: {
    mode: ToolMode;
    label: TranslationKey;
    icon: React.ReactNode;
  }[];
};

function createIcon(Icon: LucideIcon, size = 18) {
  return <Icon size={size} />;
}

const Toolbar: React.FC<ToolbarProps> = ({
  mode, setMode, showAxes, setShowAxes, showGrid, setShowGrid,
  editingLabel, handleLabelChange, handleLabelSubmit, selectedElementsLength,
  radius, setRadius,
  handleExport, handleExportPNG, handleExportSVG, fileInputRef, handleImportPick,
  snapEnabled, setSnapEnabled, toggleAnimation, isAnimating,
  view, setView, t,
}) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openInsert, setOpenInsert] = useState(false);
  const [insertAnchorLeft, setInsertAnchorLeft] = useState(0);
  const [insertAnchorTop, setInsertAnchorTop] = useState(52);
  const insertAnchorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const insideMenu = Boolean(target?.closest('[data-toolbar-menu]'));
      if (!toolbarRef.current?.contains(event.target as Node) && !insideMenu) {
        setOpenGroup(null);
        setOpenInsert(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const chooseTool = (next: ToolMode) => {
    setMode(next);
    setOpenGroup(null);
  };

  const openInsertMenu = () => {
    const rect = insertAnchorRef.current?.getBoundingClientRect();
    if (rect) {
      setInsertAnchorLeft(rect.left);
      setInsertAnchorTop(rect.bottom + 4);
    }
    setOpenInsert(!openInsert);
    setOpenGroup(null);
  };

  const groups: ToolGroup[] = [
    {
      id: 'basic',
      title: 'basicTools',
      icon: createIcon(MousePointer2, 20),
      activeModes: ['move'],
      items: [{ mode: 'move', label: 'move', icon: createIcon(MousePointer2) }],
    },
    {
      id: 'point',
      title: 'pointTools',
      icon: createIcon(Circle, 20),
      activeModes: ['point', 'midpoint', 'intersect'],
      items: [
        { mode: 'point', label: 'point', icon: createIcon(Circle) },
        { mode: 'midpoint', label: 'midpoint', icon: createIcon(Crosshair) },
        { mode: 'intersect', label: 'intersect', icon: createIcon(X) },
      ],
    },
    {
      id: 'line',
      title: 'lineTools',
      icon: createIcon(Minus, 20),
      activeModes: ['segment', 'line', 'ray', 'vector', 'polyline'],
      items: [
        { mode: 'segment', label: 'segment', icon: createIcon(Minus) },
        { mode: 'line', label: 'line', icon: createIcon(TrendingUp) },
        { mode: 'ray', label: 'ray', icon: createIcon(CornerDownRight) },
        { mode: 'vector', label: 'vector', icon: createIcon(CornerDownRight) },
        { mode: 'polyline', label: 'polyline', icon: createIcon(Activity) },
      ],
    },
    {
      id: 'special-lines',
      title: 'specialLineTools',
      icon: createIcon(Equal, 20),
      activeModes: ['parallel', 'orthogonal', 'perpendicular_bisector', 'angle_bisector', 'tangent'],
      items: [
        { mode: 'parallel', label: 'parallel', icon: createIcon(Equal) },
        { mode: 'orthogonal', label: 'orthogonal', icon: createIcon(Baseline) },
        { mode: 'perpendicular_bisector', label: 'perpendicularBisector', icon: createIcon(SplitSquareVertical) },
        { mode: 'angle_bisector', label: 'angleBisector', icon: createIcon(Scissors) },
        { mode: 'tangent', label: 'tangent', icon: createIcon(CornerDownRight) },
      ],
    },
    {
      id: 'polygon',
      title: 'polygonTools',
      icon: createIcon(Hexagon, 20),
      activeModes: ['polygon', 'regular_polygon'],
      items: [
        { mode: 'polygon', label: 'polygon', icon: createIcon(Hexagon) },
        { mode: 'regular_polygon', label: 'regularPolygon', icon: createIcon(Square) },
      ],
    },
    {
      id: 'circle',
      title: 'circleTools',
      icon: createIcon(CircleDot, 20),
      activeModes: ['circle', 'circle_center_point', 'circle3', 'arc', 'semicircle', 'sector', 'circumcircular_arc'],
      items: [
        { mode: 'circle', label: 'circleRadius', icon: createIcon(CircleDot) },
        { mode: 'circle_center_point', label: 'circleCenterPoint', icon: createIcon(CircleDashed) },
        { mode: 'circle3', label: 'circle3Points', icon: createIcon(Target) },
        { mode: 'arc', label: 'arc', icon: createIcon(CircleDashed) },
        { mode: 'semicircle', label: 'semicircle', icon: createIcon(CircleDashed) },
        { mode: 'sector', label: 'sector', icon: createIcon(CircleDashed) },
        { mode: 'circumcircular_arc', label: 'circumcircularArc', icon: createIcon(CircleDashed) },
      ],
    },
    {
      id: 'transform',
      title: 'transformTools',
      icon: createIcon(RotateCw, 20),
      activeModes: ['rotate', 'dilate', 'mirror'],
      items: [
        { mode: 'rotate', label: 'rotate', icon: createIcon(RotateCw) },
        { mode: 'dilate', label: 'dilate', icon: createIcon(ZoomIn) },
        { mode: 'mirror', label: 'mirror', icon: createIcon(SplitSquareVertical) },
      ],
    },
    {
      id: 'measure',
      title: 'measureTools',
      icon: createIcon(Ruler, 20),
      activeModes: ['distance', 'angle', 'area', 'locus', 'slope', 'compass'],
      items: [
        { mode: 'distance', label: 'distance', icon: createIcon(Ruler) },
        { mode: 'angle', label: 'angle', icon: createIcon(Triangle) },
        { mode: 'area', label: 'area', icon: createIcon(Square) },
        { mode: 'locus', label: 'locus', icon: createIcon(Activity) },
        { mode: 'slope', label: 'slope', icon: createIcon(TrendingUp) },
        { mode: 'compass', label: 'compass', icon: createIcon(CircleDashed) },
      ],
    },
    {
      id: 'conics',
      title: 'conicTools',
      icon: createIcon(CircleDashed, 20),
      activeModes: ['ellipse', 'hyperbola', 'parabola', 'conic5'],
      items: [
        { mode: 'ellipse', label: 'ellipse', icon: createIcon(CircleDashed) },
        { mode: 'hyperbola', label: 'hyperbola', icon: createIcon(CircleDashed) },
        { mode: 'parabola', label: 'parabola', icon: createIcon(CircleDashed) },
        { mode: 'conic5', label: 'conic5Points', icon: createIcon(Target) },
      ],
    },
  ];

  return (
    <div
      ref={toolbarRef}
      className="h-12 bg-white border-b border-gray-200 px-2 flex items-center gap-1 overflow-x-auto shrink-0 z-30 shadow-sm"
    >
      {groups.map(group => (
        <ToolGroupButton
          key={group.id}
          group={group}
          t={t}
          isOpen={openGroup === group.id}
          onOpenChange={isOpen => setOpenGroup(isOpen ? group.id : null)}
          mode={mode}
          onSelect={chooseTool}
        />
      ))}

      <ToolbarDivider />

      <div ref={insertAnchorRef} className="relative shrink-0">
        <ToolbarIcon
          title={t('insertTools')}
          active={openInsert}
          onClick={openInsertMenu}
        >
          <Type size={20} />
          {openInsert ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </ToolbarIcon>
        {openInsert && createPortal(
          <div
            data-toolbar-menu
            className="fixed z-[1000] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[176px] max-h-[min(260px,calc(100vh-60px))] overflow-y-auto"
            style={{ top: insertAnchorTop, left: insertAnchorLeft }}
          >
            <MenuItem icon={<Type size={16} />} label={t('insertText')} onClick={() => { setMode('text'); setOpenInsert(false); }} />
            <MenuItem icon={<Sliders size={16} />} label={t('insertSlider')} onClick={() => { setMode('slider'); setOpenInsert(false); }} />
            <MenuItem icon={<ToggleLeft size={16} />} label={t('insertButton')} onClick={() => { setMode('button'); setOpenInsert(false); }} />
            <MenuItem icon={<CheckSquare size={16} />} label={t('insertCheckbox')} onClick={() => { setMode('checkbox'); setOpenInsert(false); }} />
          </div>
        , document.body)}
      </div>

      <ToolbarDivider />

      <ToolButton icon={<Axis3D size={20} />} label={t('toggleAxes')} active={showAxes} onClick={() => setShowAxes(!showAxes)} />
      <ToolButton icon={<Grid3X3 size={20} />} label={t('toggleGrid')} active={showGrid} onClick={() => setShowGrid(!showGrid)} />
      <ToolButton icon={<Box size={20} />} label={view === '3d' ? t('view2D') : t('view3D')} active={view === '3d'} onClick={() => setView(view === '3d' ? '2d' : '3d')} />

      <ToolbarDivider />

      <ToolbarIcon title={t('snap')} active={snapEnabled} onClick={() => setSnapEnabled(!snapEnabled)}>
        <Magnet size={20} />
      </ToolbarIcon>

      <ToolbarDivider />

      <ToolbarIcon title={t('exportJSON')} onClick={handleExport}>
        <FileJson size={20} />
      </ToolbarIcon>
      <ToolbarIcon title={t('importJSON')} onClick={() => fileInputRef.current?.click()}>
        <FilePlus2 size={20} />
      </ToolbarIcon>
      <ToolbarIcon title={t('exportPNG')} onClick={handleExportPNG}>
        <ImageDown size={20} />
      </ToolbarIcon>
      <ToolbarIcon title={t('exportSVG')} onClick={handleExportSVG}>
        <VectorSquare size={20} />
      </ToolbarIcon>
      <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportPick} />

      <ToolbarDivider />

      <button
        className={`h-8 px-1.5 rounded-md flex items-center transition-colors ${
          isAnimating ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
        onClick={toggleAnimation}
        title={isAnimating ? t('pause') : t('play')}
      >
        {isAnimating ? <Pause size={18} /> : <Play size={18} />}
      </button>

      <div className="flex-1" />

      {mode === 'circle' && (
        <div className="flex items-center gap-1 px-2 border border-gray-200 rounded-md bg-gray-50 h-8 shrink-0">
          <span className="text-xs font-medium text-gray-500">R=</span>
          <input
            type="number"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-14 px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
            min="1"
          />
        </div>
      )}

      {selectedElementsLength === 1 && (
        <div className="flex items-center gap-1 px-2 border border-gray-200 rounded-md bg-gray-50 h-8 shrink-0">
          <span className="text-xs font-medium text-gray-500">{t('label')}:</span>
          <input
            type="text"
            value={editingLabel}
            onChange={handleLabelChange}
            onBlur={handleLabelSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSubmit(); }}
            placeholder="A"
            className="w-20 px-2 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

    </div>
  );
};

const ToolbarDivider: React.FC = () => <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />;

const ToolbarIcon: React.FC<{
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, active = false, onClick, children }) => (
  <button
    className={`h-8 px-1.5 rounded-md flex items-center justify-center gap-0.5 transition-colors ${
      active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`}
    onClick={onClick}
    title={title}
  >
    {children}
  </button>
);

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700" onClick={onClick}>
    {icon}
    <span>{label}</span>
  </button>
);

const ToolGroupButton: React.FC<{
  group: ToolGroup;
  t: TFunction;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ToolMode;
  onSelect: (mode: ToolMode) => void;
}> = ({ group, t, isOpen, onOpenChange, mode, onSelect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [anchorLeft, setAnchorLeft] = useState(0);
  const [anchorTop, setAnchorTop] = useState(52);
  const [anchorBottom, setAnchorBottom] = useState(0);
  const [upward, setUpward] = useState(false);

  useEffect(() => {
    if (isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setUpward(rect.bottom + 230 > window.innerHeight);
      setAnchorLeft(rect.left);
      setAnchorTop(rect.bottom + 4);
      setAnchorBottom(window.innerHeight - rect.top + 4);
    }
  }, [isOpen]);

  const activeItem = group.items.find(item => item.mode === mode);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        className={`h-8 px-1.5 rounded-md flex items-center gap-0.5 transition-colors ${
          group.activeModes.includes(mode) || isOpen
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={() => onOpenChange(!isOpen)}
        title={t(group.title)}
      >
        {activeItem?.icon ?? group.icon}
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {isOpen && createPortal(
        <div
          data-toolbar-menu
          className="fixed z-[1000] min-w-[190px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-[min(290px,calc(100vh-60px))] overflow-y-auto"
          style={upward ? { left: anchorLeft, bottom: anchorBottom } : { left: anchorLeft, top: anchorTop }}
        >
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t(group.title)}
          </div>
          {group.items.map(item => (
            <button
              key={item.mode}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                mode === item.mode ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => onSelect(item.mode)}
            >
              {item.icon}
              <span>{t(item.label)}</span>
            </button>
          ))}
        </div>
        , document.body)}
    </div>
  );
};

export default Toolbar;
