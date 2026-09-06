/**
 * 画布下方的工具引导文字条（GeoGebra 状态栏习惯）。
 *
 * TOOL_HINTS 把每个 ToolMode 映射到一个 i18n key，供：
 *   - 组件内部渲染状态栏文字；
 *   - 单元测试断言每个 ToolMode 都有对应 key，且 key 在 LanguageContext 中存在。
 *
 * 多步工具采用与该工具实际"第一步"一致的引导语，而非把整段流程塞进一行。
 */
import React from 'react';
import { Info } from 'lucide-react';
import type { ToolMode } from './tools/types';
import type { TranslationKey } from '../i18n/LanguageContext';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * ToolMode → TranslationKey。文本由 LanguageContext 提供，组件本身不硬编码
 * 显示文案，避免"裸 key"回归。
 */
export const TOOL_HINTS: Record<ToolMode, TranslationKey> = {
  // 基础工具
  select: 'select',
  move: 'move',
  // 点
  point: 'point',
  point_on_object: 'pointOnObject',
  // 直线型
  line: 'line',
  segment: 'segment',
  segment_fixed: 'segmentFixed',
  ray: 'ray',
  vector: 'vector',
  vector_from_point: 'vectorFromPoint',
  polyline: 'polyline',
  midpoint: 'midpoint',
  // 圆与弧
  circle: 'circleRadius',
  circle_center_point: 'circleCenterPoint',
  circle3: 'circle3Points',
  arc: 'arc',
  semicircle: 'toolHintSemicircle',
  sector: 'toolHintSector',
  circumcircular_arc: 'circumcircularArc',
  circumcircular_sector: 'circumcircularSector',
  compass: 'compass',
  // 特殊线
  intersect: 'intersect',
  parallel: 'parallel',
  orthogonal: 'orthogonal',
  perpendicular_bisector: 'perpendicularBisector',
  angle_bisector: 'angleBisector',
  // 多边形
  polygon: 'polygon',
  regular_polygon: 'regularPolygon',
  // 度量
  distance: 'distance',
  angle: 'angle',
  angle_fixed: 'angleFixed',
  area: 'area',
  slope: 'slope',
  tangent: 'tangent',
  locus: 'locus',
  // 变换
  rotate: 'toolHintRotate',
  dilate: 'toolHintDilate',
  mirror: 'toolHintMirror',
  mirror_line: 'mirrorLine',
  mirror_point: 'mirrorPoint',
  mirror_circle: 'mirrorCircle',
  translate_vector: 'translateByVector',
  shear: 'toolHintShear',
  stretch: 'toolHintStretch',
  // 视图 & 属性
  pan: 'toolHintPan',
  zoom_in: 'toolHintZoomIn',
  zoom_out: 'toolHintZoomOut',
  show_hide: 'toolHintShowHide',
  show_hide_label: 'toolHintShowHideLabel',
  delete: 'toolHintDelete',
  // 插入工具
  text: 'toolHintText',
  slider: 'toolHintSlider',
  button: 'toolHintButton',
  checkbox: 'toolHintCheckbox',
  // 圆锥曲线
  ellipse: 'ellipse',
  hyperbola: 'hyperbola',
  parabola: 'parabola',
  conic5: 'conic5Points',
};

export const ToolHintBar: React.FC<{ mode: ToolMode }> = ({ mode }) => {
  const { t } = useLanguage();
  const key = TOOL_HINTS[mode];
  if (!key) return null;
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[3] flex items-center gap-2 px-3 py-1.5 bg-gray-100 border-t border-gray-200 text-gray-600 text-xs select-none pointer-events-none"
      aria-live="polite"
    >
      <Info size={14} className="text-gray-400 shrink-0" />
      <span className="truncate">{t(key)}</span>
    </div>
  );
};
