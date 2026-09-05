import React, { useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import type { TFunction } from '../i18n/LanguageContext';

interface AlgebraInputBarProps {
  kernel: Kernel;
  onElementsCreated: (elements: ConstructionElement[]) => void;
  t: TFunction;
}

const AlgebraInputBar: React.FC<AlgebraInputBarProps> = ({ kernel, onElementsCreated, t }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    try {
      const elements = parseAlgebraInput(kernel, value);
      onElementsCreated(elements);
      setValue('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidExpression'));
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t('algebraInputPlaceholder')}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={submit}
          className="p-2 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title={t('addObject')}
        >
          <CornerDownLeft size={16} />
        </button>
      </div>
      {error && <div className="mt-2 px-1 text-xs text-red-600">{error}</div>}
    </div>
  );
};

export default AlgebraInputBar;
