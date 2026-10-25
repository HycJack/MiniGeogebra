/**
 * 构造步骤导航条（对标 GeoGebra Navigation Bar，浮在画布左下角）：
 *   ⏮ 首步 · ◀ 上一步 · 步数显示 · ▶ 下一步 · ⏭ 末步 · ▶/⏸ 自动播放 · ✕ 关闭
 *
 * 导航只影响画布显示与命中（constIndex ≤ 当前步的对象才可见/可选），
 * 不改对象的真实 visible，撤销/样式均不受影响。
 */

import React from 'react';
import { SkipBack, ChevronLeft, ChevronRight, SkipForward, Play, Pause, X } from 'lucide-react';
import type { TFunction } from '../i18n/LanguageContext';

interface Props {
  step: number;
  total: number;
  playing: boolean;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
  onClose: () => void;
  t: TFunction;
}

const Btn: React.FC<{ title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({
  title, onClick, disabled, children,
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
      disabled ? 'text-gray-300 cursor-default' : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600'
    }`}
  >
    {children}
  </button>
);

const ConstructionNavBar: React.FC<Props> = ({ step, total, playing, onStep, onTogglePlay, onClose, t }) => {
  const atEnd = step >= total;
  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-0.5 bg-white/95 border border-gray-200 rounded-full shadow-lg px-2 py-1">
      <Btn title={t('navFirst')} disabled={step <= 0} onClick={() => onStep(0)}><SkipBack size={14} /></Btn>
      <Btn title={t('navPrev')} disabled={step <= 0} onClick={() => onStep(step - 1)}><ChevronLeft size={16} /></Btn>
      <span className="text-xs font-mono text-gray-500 px-1 select-none tabular-nums">
        {step} / {total}
      </span>
      <Btn title={t('navNext')} disabled={atEnd} onClick={() => onStep(step + 1)}><ChevronRight size={16} /></Btn>
      <Btn title={t('navLast')} disabled={atEnd} onClick={() => onStep(total)}><SkipForward size={14} /></Btn>
      <span className="w-px h-4 bg-gray-200 mx-0.5" />
      <Btn title={playing ? t('pause') : t('navPlay')} disabled={atEnd && !playing} onClick={onTogglePlay}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </Btn>
      <Btn title={t('navClose')} onClick={onClose}><X size={14} /></Btn>
    </div>
  );
};

export default ConstructionNavBar;
