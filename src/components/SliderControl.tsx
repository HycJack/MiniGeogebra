import React from 'react';
import { GeoNumeric, AnimationType } from '../kernel/geo/GeoNumeric';
import { Kernel } from '../kernel/core/Kernel';
import { useLanguage } from '../i18n/LanguageContext';

interface SliderControlProps {
  numeric: GeoNumeric;
  kernel: Kernel;
  label?: string;
  onNumericChange?: (numeric: GeoNumeric, oldValue: number, newValue: number) => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({ numeric, kernel, label, onNumericChange }) => {
  const { t } = useLanguage();
  const value = numeric.getValue();
  const min = numeric.intervalMin;
  const max = numeric.intervalMax;
  const isAnimating = numeric.isAnimating();
  const speed = numeric.animationSpeed;
  const animationType = numeric.animationType;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const oldValue = numeric.getValue();
    numeric.setValue(val);
    kernel.notifyUpdate(numeric);
    onNumericChange?.(numeric, oldValue, val);
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      numeric.intervalMin = val;
      kernel.notifyUpdate(numeric);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      numeric.intervalMax = val;
      kernel.notifyUpdate(numeric);
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      numeric.animationSpeed = val;
      kernel.notifyUpdate(numeric);
    }
  };

  const toggleAnimation = () => {
    const newState = !isAnimating;
    numeric.setAnimating(newState);
    
    // If we turn on animation for this slider, make sure the global animation manager is running
    if (newState) {
      const am = kernel.getAnimationManager();
      if (!am.isRunning()) {
        am.startAnimation();
      }
    }
    kernel.notifyUpdate(numeric);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    numeric.setAnimationType(Number(e.target.value) as AnimationType);
    kernel.notifyUpdate(numeric);
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200 mb-3 shadow-sm text-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-700">{label || numeric.label || t('parameter')}</span>
        <button
          onClick={toggleAnimation}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            isAnimating ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isAnimating ? `⏸ ${t('pause')}` : `▶ ${t('play')}`}
        </button>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <input
          type="number"
          value={min}
          onChange={handleMinChange}
          className="w-14 px-1 py-1 border rounded text-xs text-center bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 100 || 0.01}
          value={value}
          onChange={handleSliderChange}
          className="flex-1 accent-blue-600"
        />
        <input
          type="number"
          value={max}
          onChange={handleMaxChange}
          className="w-14 px-1 py-1 border rounded text-xs text-center bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      
      <div className="flex items-center justify-start gap-2 mt-3 pt-3 border-t border-gray-100">
        <label className="text-xs text-gray-500">Speed:</label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={speed}
          onChange={handleSpeedChange}
          className="w-14 px-1 py-1 border rounded text-xs text-center bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <label className="ml-auto text-xs text-gray-500">{t('animationType')}:</label>
        <select value={animationType} onChange={handleTypeChange}
          className="w-24 px-1 py-1 border rounded text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value={AnimationType.OSCILLATING}>{t('oscillating')}</option>
          <option value={AnimationType.INCREASING}>{t('increasing')}</option>
          <option value={AnimationType.DECREASING}>{t('decreasing')}</option>
          <option value={AnimationType.INCREASING_ONCE}>{t('increasingOnce')}</option>
        </select>
      </div>
    </div>
  );
};
