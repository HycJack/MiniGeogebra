import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'zh' | 'en';

export const translations = {
  zh: {
    title: '迷你几何画板',
    undo: '撤销',
    redo: '重做',
    move: '移动',
    point: '点',
    segment: '线段',
    midpoint: '中点',
    line: '直线',
    circleRadius: '圆 (圆心和半径)',
    circleCenterPoint: '圆 (圆心和圆上一点)',
    circle3Points: '圆 (三点)',
    intersect: '交点',
    parallel: '平行线',
    orthogonal: '垂线',
    perpendicularBisector: '中垂线',
    angleBisector: '角平分线',
    polygon: '多边形',
    clearAll: '清空全部',
    objects: '对象',
    typePoint: '点',
    typeLine: '直线',
    typeSegment: '线段',
    typeCircle: '圆',
    typePolygon: '多边形',
    typeNumeric: '数值',
    parameter: '参数',
    pause: '暂停',
    play: '播放',
    language: '语言',
    animationsAndControls: '动画与控制',
    algebraView: '代数区',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetView: '重置视图',
    emptyState: '使用上方的工具创建对象。',
    label: '标签',
    toggleAxes: '显示/隐藏坐标轴',
    toggleGrid: '显示/隐藏网格',
    circleTools: '圆工具',
    insertTools: '插入工具',
    insertText: '插入文本',
    insertSlider: '插入滑块',
    insertButton: '插入按钮',
    insertCheckbox: '插入复选框'
  },
  en: {
    title: 'Mini GeoGebra',
    undo: 'Undo',
    redo: 'Redo',
    move: 'Move',
    point: 'Point',
    segment: 'Segment',
    midpoint: 'Midpoint',
    line: 'Line',
    circleRadius: 'Circle (Radius)',
    circleCenterPoint: 'Circle (Center, Point)',
    circle3Points: 'Circle (3 Points)',
    intersect: 'Intersect',
    parallel: 'Parallel Line',
    orthogonal: 'Orthogonal Line',
    perpendicularBisector: 'Perpendicular Bisector',
    angleBisector: 'Angle Bisector',
    polygon: 'Polygon',
    clearAll: 'Clear All',
    objects: 'Objects',
    typePoint: 'Point',
    typeLine: 'Line',
    typeSegment: 'Segment',
    typeCircle: 'Circle',
    typePolygon: 'Polygon',
    typeNumeric: 'Numeric',
    parameter: 'Parameter',
    pause: 'Pause',
    play: 'Play',
    language: 'Language',
    animationsAndControls: 'Animations & Controls',
    algebraView: 'Algebra View',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetView: 'Reset View',
    emptyState: 'Use the tools above to create objects.',
    label: 'Label',
    toggleAxes: 'Show/Hide Axes',
    toggleGrid: 'Show/Hide Grid',
    circleTools: 'Circle Tools',
    insertTools: 'Insert Tools',
    insertText: 'Insert Text',
    insertSlider: 'Insert Slider',
    insertButton: 'Insert Button',
    insertCheckbox: 'Insert Checkbox'
  }
};

export type TranslationKey = keyof typeof translations['zh'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: TranslationKey) => {
    return translations[language][key];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
