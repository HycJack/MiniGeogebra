import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, Pause, ChevronDown, ChevronRight, FileJson, FilePlus2,
  ImageDown, VectorSquare, Magnet, Axis3D, Grid3X3, Box,
  Undo2, Redo2, Globe,
} from 'lucide-react';
import ToolButton from './ToolButton';
import { ToolMode } from './tools/types';
import type { Language, TFunction, TranslationKey } from '../i18n/LanguageContext';

import modeMove from '../assets/icons/mode_move.svg';
import modeSelect from '../assets/icons/mode_select.svg';
import modePoint from '../assets/icons/mode_point.svg';
import modePointOnObject from '../assets/icons/mode_pointonobject.svg';
import modeMidpoint from '../assets/icons/mode_midpoint.svg';
import modeIntersect from '../assets/icons/mode_intersect.svg';
import modeJoin from '../assets/icons/mode_join.svg';
import modeSegment from '../assets/icons/mode_segment.svg';
import modeSegmentFixed from '../assets/icons/mode_segmentfixed.svg';
import modeRay from '../assets/icons/mode_ray.svg';
import modeVector from '../assets/icons/mode_vector.svg';
import modeVectorFromPoint from '../assets/icons/mode_vectorfrompoint.svg';
import modePolyline from '../assets/icons/mode_polyline.svg';
import modeOrthogonal from '../assets/icons/mode_perpendicularline.svg';
import modeParallel from '../assets/icons/mode_parallelline.svg';
import modeLineBisector from '../assets/icons/mode_perpendicularbisector.svg';
import modeAngularBisector from '../assets/icons/mode_anglebisector.svg';
import modeTangents from '../assets/icons/mode_tangents.svg';
import modeLocus from '../assets/icons/mode_locus.svg';
import modePolygon from '../assets/icons/mode_polygon.svg';
import modeRegularPolygon from '../assets/icons/mode_regularpolygon.svg';
import modeCircle2 from '../assets/icons/mode_circle2.svg';
import modeCirclePointRadius from '../assets/icons/mode_circlepointradius.svg';
import modeCompass from '../assets/icons/mode_compass.svg';
import modeCircle3 from '../assets/icons/mode_circle3.svg';
import modeSemicircle from '../assets/icons/mode_semicircle.svg';
import modeCircularArc from '../assets/icons/mode_circulararc.svg';
import modeCircumcircularArc from '../assets/icons/mode_circumcirculararc.svg';
import modeCircularSector from '../assets/icons/mode_circularsector.svg';
import modeCircumcircularSector from '../assets/icons/mode_circumcircularsector.svg';
import modeEllipse from '../assets/icons/mode_ellipse.svg';
import modeHyperbola from '../assets/icons/mode_hyperbola.svg';
import modeParabola from '../assets/icons/mode_parabola.svg';
import modeConic5 from '../assets/icons/mode_conic5.svg';
import modeAngle from '../assets/icons/mode_angle.svg';
import modeAngleFixed from '../assets/icons/mode_anglefixed.svg';
import modeDistance from '../assets/icons/mode_distance.svg';
import modeArea from '../assets/icons/mode_area.svg';
import modeSlope from '../assets/icons/mode_slope.svg';
import modeSlider from '../assets/icons/mode_slider.svg';
import modeText from '../assets/icons/mode_text.svg';
import modeButton from '../assets/icons/mode_button.svg';
import modeCheckbox from '../assets/icons/mode_checkbox.svg';
import modeReflectAboutLine from '../assets/icons/mode_reflectaboutline.svg';
import modeReflectAboutPoint from '../assets/icons/mode_reflectaboutpoint.svg';
import modeReflectAboutCircle from '../assets/icons/mode_reflectaboutcircle.svg';
import modeRotateAroundPoint from '../assets/icons/mode_rotatearoundpoint.svg';
import modeTranslateByVector from '../assets/icons/mode_translatebyvector.svg';
import modeDilateFromPoint from '../assets/icons/mode_dilatefrompoint.svg';
import modeShear from '../assets/icons/mode_shear.svg';
import modeStretch from '../assets/icons/mode_stretch.svg';
import modeShowHideObject from '../assets/icons/mode_showhideobject.svg';
import modeShowHideLabel from '../assets/icons/mode_showhidelabel.svg';
import modeDelete from '../assets/icons/mode_delete.svg';
import modeMoveGraphics from '../assets/icons/mode_movegraphicsview.svg';
import modeZoomIn from '../assets/icons/mode_zoomin.svg';
import modeZoomOut from '../assets/icons/mode_zoomout.svg';

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
  language: Language;
  setLanguage: (lang: Language) => void;
  undo: () => void;
  redo: () => void;
  undoCount: number;
  redoCount: number;
}

type ToolGroup = {
  id: string;
  title: TranslationKey;
  icon: React.ReactNode;
  activeModes: ToolMode[];
  subgroups: {
    label: TranslationKey;
    items: { mode: ToolMode; label: TranslationKey; icon: React.ReactNode }[];
  }[];
};

const svgIcon = (src: string, size = 18) => (
  <img src={src} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />
);

const Toolbar: React.FC<ToolbarProps> = ({
  mode, setMode, showAxes, setShowAxes, showGrid, setShowGrid,
  editingLabel, handleLabelChange, handleLabelSubmit, selectedElementsLength,
  radius, setRadius,
  handleExport, handleExportPNG, handleExportSVG, fileInputRef, handleImportPick,
  snapEnabled, setSnapEnabled, toggleAnimation, isAnimating,
  view, setView, t, language, setLanguage, undo, redo, undoCount, redoCount,
}) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const insideMenu = Boolean(target?.closest('[data-toolbar-menu]'));
      if (!toolbarRef.current?.contains(event.target as Node) && !insideMenu) setOpenGroup(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const chooseTool = (next: ToolMode) => {
    setMode(next);
    setOpenGroup(null);
  };

  const groups: ToolGroup[] = [
    {
      id: 'move', title: 'basicTools', icon: svgIcon(modeSelect, 20), activeModes: ['select', 'move'],
      subgroups: [{ label: 'basicTools', items: [
        { mode: 'select', label: 'select', icon: svgIcon(modeSelect) },
        { mode: 'move', label: 'move', icon: svgIcon(modeMove) },
      ] }],
    },
    {
      id: 'points', title: 'pointTools', icon: svgIcon(modePoint, 20), activeModes: ['point', 'point_on_object', 'midpoint', 'intersect'],
      subgroups: [{ label: 'pointTools', items: [
        { mode: 'point', label: 'point', icon: svgIcon(modePoint) },
        { mode: 'point_on_object', label: 'pointOnObject', icon: svgIcon(modePointOnObject) },
        { mode: 'midpoint', label: 'midpoint', icon: svgIcon(modeMidpoint) },
        { mode: 'intersect', label: 'intersect', icon: svgIcon(modeIntersect) },
      ] }],
    },
    {
      id: 'lines', title: 'lineTools', icon: svgIcon(modeJoin, 20), activeModes: ['segment', 'segment_fixed', 'line', 'ray', 'vector', 'vector_from_point', 'polyline'],
      subgroups: [
        { label: 'straightObjects', items: [
          { mode: 'segment', label: 'segment', icon: svgIcon(modeSegment) },
          { mode: 'segment_fixed', label: 'segmentFixed', icon: svgIcon(modeSegmentFixed) },
          { mode: 'line', label: 'line', icon: svgIcon(modeJoin) },
          { mode: 'ray', label: 'ray', icon: svgIcon(modeRay) },
        ] },
        { label: 'vectorTools', items: [
          { mode: 'vector', label: 'vector', icon: svgIcon(modeVector) },
          { mode: 'vector_from_point', label: 'vectorFromPoint', icon: svgIcon(modeVectorFromPoint) },
          { mode: 'polyline', label: 'polyline', icon: svgIcon(modePolyline) },
        ] },
      ],
    },
    {
      id: 'special-lines', title: 'specialLineTools', icon: svgIcon(modeOrthogonal, 20), activeModes: ['parallel', 'orthogonal', 'perpendicular_bisector', 'angle_bisector', 'tangent', 'locus'],
      subgroups: [
        { label: 'specialLineTools', items: [
          { mode: 'parallel', label: 'parallel', icon: svgIcon(modeParallel) },
          { mode: 'orthogonal', label: 'orthogonal', icon: svgIcon(modeOrthogonal) },
          { mode: 'perpendicular_bisector', label: 'perpendicularBisector', icon: svgIcon(modeLineBisector) },
          { mode: 'angle_bisector', label: 'angleBisector', icon: svgIcon(modeAngularBisector) },
          { mode: 'tangent', label: 'tangent', icon: svgIcon(modeTangents) },
        ] },
        { label: 'curvesAndLoci', items: [{ mode: 'locus', label: 'locus', icon: svgIcon(modeLocus) }] },
      ],
    },
    {
      id: 'polygons', title: 'polygonTools', icon: svgIcon(modePolygon, 20), activeModes: ['polygon', 'regular_polygon'],
      subgroups: [{ label: 'polygonTools', items: [
        { mode: 'polygon', label: 'polygon', icon: svgIcon(modePolygon) },
        { mode: 'regular_polygon', label: 'regularPolygon', icon: svgIcon(modeRegularPolygon) },
      ] }],
    },
    {
      id: 'circles', title: 'circleTools', icon: svgIcon(modeCircle2, 20), activeModes: ['circle', 'circle_center_point', 'circle3', 'compass', 'arc', 'semicircle', 'sector', 'circumcircular_arc'],
      subgroups: [
        { label: 'circleTools', items: [
          { mode: 'circle_center_point', label: 'circleCenterPoint', icon: svgIcon(modeCircle2) },
          { mode: 'circle', label: 'circleRadius', icon: svgIcon(modeCirclePointRadius) },
          { mode: 'compass', label: 'compass', icon: svgIcon(modeCompass) },
          { mode: 'circle3', label: 'circle3Points', icon: svgIcon(modeCircle3) },
        ] },
        { label: 'arcTools', items: [
          { mode: 'arc', label: 'arc', icon: svgIcon(modeCircularArc) },
          { mode: 'semicircle', label: 'semicircle', icon: svgIcon(modeSemicircle) },
          { mode: 'sector', label: 'sector', icon: svgIcon(modeCircularSector) },
          { mode: 'circumcircular_arc', label: 'circumcircularArc', icon: svgIcon(modeCircumcircularArc) },
          { mode: 'circumcircular_sector', label: 'circumcircularSector', icon: svgIcon(modeCircumcircularSector) },
        ] },
      ],
    },
    {
      id: 'conics', title: 'conicTools', icon: svgIcon(modeEllipse, 20), activeModes: ['ellipse', 'hyperbola', 'parabola', 'conic5'],
      subgroups: [{ label: 'advancedConics', items: [
        { mode: 'ellipse', label: 'ellipse', icon: svgIcon(modeEllipse) },
        { mode: 'hyperbola', label: 'hyperbola', icon: svgIcon(modeHyperbola) },
        { mode: 'parabola', label: 'parabola', icon: svgIcon(modeParabola) },
        { mode: 'conic5', label: 'conic5Points', icon: svgIcon(modeConic5) },
      ] }],
    },
    {
      id: 'measure', title: 'measureTools', icon: svgIcon(modeAngle, 20), activeModes: ['angle', 'angle_fixed', 'distance', 'area', 'slope'],
      subgroups: [{ label: 'measurement', items: [
        { mode: 'angle', label: 'angle', icon: svgIcon(modeAngle) },
        { mode: 'angle_fixed', label: 'angleFixed', icon: svgIcon(modeAngleFixed) },
        { mode: 'distance', label: 'distance', icon: svgIcon(modeDistance) },
        { mode: 'area', label: 'area', icon: svgIcon(modeArea) },
        { mode: 'slope', label: 'slope', icon: svgIcon(modeSlope) },
      ] }],
    },
    {
      id: 'transforms', title: 'transformTools', icon: svgIcon(modeReflectAboutLine, 20), activeModes: ['mirror_line', 'mirror_point', 'mirror_circle', 'rotate', 'translate_vector', 'dilate', 'shear', 'stretch'],
      subgroups: [
        { label: 'reflectionTools', items: [
          { mode: 'mirror_line', label: 'mirrorLine', icon: svgIcon(modeReflectAboutLine) },
          { mode: 'mirror_point', label: 'mirrorPoint', icon: svgIcon(modeReflectAboutPoint) },
          { mode: 'mirror_circle', label: 'mirrorCircle', icon: svgIcon(modeReflectAboutCircle) },
        ] },
        { label: 'rigidTransforms', items: [
          { mode: 'rotate', label: 'rotate', icon: svgIcon(modeRotateAroundPoint) },
          { mode: 'translate_vector', label: 'translateByVector', icon: svgIcon(modeTranslateByVector) },
          { mode: 'dilate', label: 'dilate', icon: svgIcon(modeDilateFromPoint) },
        ] },
        { label: 'affineTransforms', items: [
          { mode: 'shear', label: 'shear', icon: svgIcon(modeShear) },
          { mode: 'stretch', label: 'stretch', icon: svgIcon(modeStretch) },
        ] },
      ],
    },
    {
      id: 'insert', title: 'insertTools', icon: svgIcon(modeText, 20), activeModes: ['text', 'slider', 'button', 'checkbox'],
      subgroups: [{ label: 'insertTools', items: [
        { mode: 'text', label: 'insertText', icon: svgIcon(modeText) },
        { mode: 'slider', label: 'insertSlider', icon: svgIcon(modeSlider) },
        { mode: 'button', label: 'insertButton', icon: svgIcon(modeButton) },
        { mode: 'checkbox', label: 'insertCheckbox', icon: svgIcon(modeCheckbox) },
      ] }],
    },
    {
      id: 'properties', title: 'objectProperties', icon: svgIcon(modeShowHideObject, 20), activeModes: ['show_hide', 'show_hide_label', 'delete'],
      subgroups: [{ label: 'propertiesTools', items: [
        { mode: 'show_hide', label: 'showHideObject', icon: svgIcon(modeShowHideObject) },
        { mode: 'show_hide_label', label: 'showHideLabel', icon: svgIcon(modeShowHideLabel) },
        { mode: 'delete', label: 'deleteObject', icon: svgIcon(modeDelete) },
      ] }],
    },
  ];

  return (
    <div ref={toolbarRef} className="h-12 bg-white border-b border-gray-200 px-2 flex items-center gap-1 overflow-x-auto shrink-0 z-30 shadow-sm">
      {groups.map(group => (
        <ToolGroupButton key={group.id} group={group} t={t} isOpen={openGroup === group.id}
          onOpenChange={isOpen => setOpenGroup(isOpen ? group.id : null)} mode={mode} onSelect={chooseTool} />
      ))}

      <ToolbarDivider />
      <ToolButton icon={<Axis3D size={20} />} label={t('toggleAxes')} active={showAxes} onClick={() => setShowAxes(!showAxes)} />
      <ToolButton icon={<Grid3X3 size={20} />} label={t('toggleGrid')} active={showGrid} onClick={() => setShowGrid(!showGrid)} />
      <ToolButton icon={<Box size={20} />} label={view === '3d' ? t('view2D') : t('view3D')} active={view === '3d'} onClick={() => setView(view === '3d' ? '2d' : '3d')} />

      <ToolbarDivider />
      <ToolbarIcon title={t('panView')} active={mode === 'pan'} onClick={() => setMode('pan')}>{svgIcon(modeMoveGraphics, 18)}</ToolbarIcon>
      <ToolbarIcon title={t('zoomIn')} active={mode === 'zoom_in'} onClick={() => setMode('zoom_in')}>{svgIcon(modeZoomIn, 18)}</ToolbarIcon>
      <ToolbarIcon title={t('zoomOut')} active={mode === 'zoom_out'} onClick={() => setMode('zoom_out')}>{svgIcon(modeZoomOut, 18)}</ToolbarIcon>
      <ToolbarIcon title={t('snap')} active={snapEnabled} onClick={() => setSnapEnabled(!snapEnabled)}><Magnet size={18} /></ToolbarIcon>

      <ToolbarDivider />
      <ToolbarIcon title={t('undo')} onClick={undo} disabled={undoCount === 0}><Undo2 size={18} /></ToolbarIcon>
      <ToolbarIcon title={t('redo')} onClick={redo} disabled={redoCount === 0}><Redo2 size={18} /></ToolbarIcon>

      <ToolbarDivider />
      <ToolbarIcon title={t('exportJSON')} onClick={handleExport}><FileJson size={18} /></ToolbarIcon>
      <ToolbarIcon title={t('importJSON')} onClick={() => fileInputRef.current?.click()}><FilePlus2 size={18} /></ToolbarIcon>
      <ToolbarIcon title={t('exportPNG')} onClick={handleExportPNG}><ImageDown size={18} /></ToolbarIcon>
      <ToolbarIcon title={t('exportSVG')} onClick={handleExportSVG}><VectorSquare size={18} /></ToolbarIcon>
      <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportPick} />

      <ToolbarDivider />
      <div className="flex items-center gap-1 bg-gray-100 px-2 h-8 rounded-md shrink-0">
        <Globe size={14} className="text-gray-500" />
        <select value={language} onChange={e => setLanguage(e.target.value as Language)} className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer">
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </div>

      <ToolbarDivider />
      <button className={`h-8 px-1.5 rounded-md flex items-center transition-colors shrink-0 ${isAnimating ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}
        onClick={toggleAnimation} title={isAnimating ? t('pause') : t('play')}>
        {isAnimating ? <Pause size={18} /> : <Play size={18} />}
      </button>

      <div className="flex-1" />
      {mode === 'circle' && (
        <div className="flex items-center gap-1 px-2 border border-gray-200 rounded-md bg-gray-50 h-8 shrink-0">
          <span className="text-xs font-medium text-gray-500">R=</span>
          <input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))}
            className="w-14 px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" min="1" />
        </div>
      )}
      {selectedElementsLength === 1 && (
        <div className="flex items-center gap-1 px-2 border border-gray-200 rounded-md bg-gray-50 h-8 shrink-0">
          <span className="text-xs font-medium text-gray-500">{t('label')}:</span>
          <input type="text" value={editingLabel} onChange={handleLabelChange} onBlur={handleLabelSubmit}
            onKeyDown={e => { if (e.key === 'Enter') handleLabelSubmit(); }} placeholder="A"
            className="w-20 px-2 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" />
        </div>
      )}
    </div>
  );
};

const ToolbarDivider: React.FC = () => <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />;

const ToolbarIcon: React.FC<{ title: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({
  title, active = false, onClick, disabled = false, children,
}) => (
  <button className={`h-8 px-1.5 rounded-md flex items-center justify-center transition-colors ${
    disabled ? 'text-gray-300 cursor-default' : active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`} onClick={onClick} title={title} disabled={disabled}>{children}</button>
);

const ToolGroupButton: React.FC<{
  group: ToolGroup; t: TFunction; isOpen: boolean; onOpenChange: (open: boolean) => void;
  mode: ToolMode; onSelect: (mode: ToolMode) => void;
}> = ({ group, t, isOpen, onOpenChange, mode, onSelect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [anchorLeft, setAnchorLeft] = useState(0);
  const [anchorTop, setAnchorTop] = useState(52);
  const [anchorBottom, setAnchorBottom] = useState(0);
  const [upward, setUpward] = useState(false);

  useEffect(() => {
    if (isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setUpward(rect.bottom + 300 > window.innerHeight);
      setAnchorLeft(rect.left);
      setAnchorTop(rect.bottom + 4);
      setAnchorBottom(window.innerHeight - rect.top + 4);
    }
  }, [isOpen]);

  const activeItem = group.subgroups.flatMap(subgroup => subgroup.items).find(item => item.mode === mode);

  return (
    <div ref={ref} className="relative shrink-0">
      <button className={`h-8 px-1.5 rounded-md flex items-center gap-0.5 transition-colors ${
        group.activeModes.includes(mode) || isOpen ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`} onClick={() => onOpenChange(!isOpen)} title={t(group.title)}>
        {activeItem?.icon ?? group.icon}
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {isOpen && createPortal(
        <div data-toolbar-menu className="fixed z-[1000] min-w-[210px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-[min(340px,calc(100vh-60px))] overflow-y-auto"
          style={upward ? { left: anchorLeft, bottom: anchorBottom } : { left: anchorLeft, top: anchorTop }}>
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t(group.title)}</div>
          {group.subgroups.map((subgroup, index) => (
            <React.Fragment key={subgroup.label}>
              {index > 0 && <div className="mx-2 my-1 h-px bg-gray-100" />}
              {group.subgroups.length > 1 && <div className="px-3 py-1 text-[11px] font-medium text-gray-400">{t(subgroup.label)}</div>}
              {subgroup.items.map(item => (
                <button key={item.mode} className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  mode === item.mode ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`} onClick={() => onSelect(item.mode)}>
                  {item.icon}
                  <span>{t(item.label)}</span>
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>, document.body)}
    </div>
  );
};

export default Toolbar;
