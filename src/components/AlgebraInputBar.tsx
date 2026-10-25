import React, { useMemo, useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput, COMMAND_NAMES, commandSignature, type AlgebraViewBounds } from '../kernel/algebra/EquationRecognizer';
import type { TFunction } from '../i18n/LanguageContext';

interface AlgebraInputBarProps {
  kernel: Kernel;
  onElementsCreated: (elements: ConstructionElement[]) => void;
  /** 当前可视区（世界坐标）：Root/Extremum 等命令的"视区内搜索"用。 */
  viewBounds?: AlgebraViewBounds;
  t: TFunction;
}

interface Suggestion {
  kind: 'command' | 'label';
  text: string;
  detail: string;
}

/** 取输入末尾的标识符片段（补全目标）；无则返回 ''。 */
const trailingWord = (input: string): string => {
  const m = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(input);
  return m ? m[1] : '';
};

const MAX_SUGGESTIONS = 8;

const AlgebraInputBar: React.FC<AlgebraInputBarProps> = ({ kernel, onElementsCreated, viewBounds, t }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  // 补全下拉：负数 = 未打开；>=0 为高亮下标
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [highlight, setHighlight] = useState(0);
  const historyIndex = useRef(-1);
  const draftRef = useRef('');
  // 刚被 Tab 接受的候选：刷新候选列表时跳过它，否则每次 Tab 都接受同一个词
  // 形成死循环陷阱（评审 U10）；输入变化（非 Tab 路径）时清空。
  const justAcceptedRef = useRef('');

  const labels = useMemo(() => kernel.getConstruction()
    .getElements()
    .map(el => (el as { label?: string }).label)
    .filter((l): l is string => !!l), [kernel, value]);

  /** 输入变化时刷新补全候选：命令前缀匹配 + 已有对象标签。 */
  const refreshSuggestions = (input: string): Suggestion[] => {
    const word = trailingWord(input);
    if (!word) return [];
    if (word === justAcceptedRef.current) return [];   // 刚接受过 → 不再推荐同一个
    const lower = word.toLowerCase();
    const seen = new Set<string>();
    const result: Suggestion[] = [];
    for (const name of COMMAND_NAMES) {
      if (name.toLowerCase().startsWith(lower) && !seen.has(name)) {
        seen.add(name);
        result.push({ kind: 'command', text: name, detail: commandSignature(name) });
        if (result.length >= MAX_SUGGESTIONS) return result;
      }
    }
    for (const label of labels) {
      if (label.toLowerCase().startsWith(lower) && !seen.has(label)) {
        seen.add(label);
        result.push({ kind: 'label', text: label, detail: t('existingObject') });
        if (result.length >= MAX_SUGGESTIONS) return result;
      }
    }
    return result;
  };

  /** 把高亮候选回填到输入框（只替换末尾标识符片段）。 */
  const acceptSuggestion = (input: string, suggestion: Suggestion): string => {
    const word = trailingWord(input);
    return input.slice(0, input.length - word.length) + suggestion.text;
  };

  const submit = () => {
    try {
      const elements = parseAlgebraInput(kernel, value, viewBounds);
      onElementsCreated(elements);
      if (value.trim()) {
        setHistory(prev => (prev[prev.length - 1] === value ? prev : [...prev, value]));
      }
      historyIndex.current = -1;
      setValue('');
      setError(null);
      setSuggestions(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidExpression'));
    }
  };

  const handleChange = (next: string, fromTab = false) => {
    setValue(next);
    setError(null);
    historyIndex.current = -1;
    if (!fromTab) justAcceptedRef.current = '';
    const nextSuggestions = refreshSuggestions(next);
    setSuggestions(nextSuggestions.length > 0 ? nextSuggestions : null);
    setHighlight(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight(h => (h + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(h => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Tab') {
        // Tab 接受高亮候选；Enter 仍提交（与 GeoGebra web 输入栏一致）
        event.preventDefault();
        justAcceptedRef.current = suggestions[highlight].text;
        handleChange(acceptSuggestion(value, suggestions[highlight]), true);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setSuggestions(null);
        return;
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
      return;
    }
    // ↑/↓ 历史回溯（补全未打开时）
    if (event.key === 'ArrowUp' && history.length > 0) {
      event.preventDefault();
      if (historyIndex.current === -1) {
        draftRef.current = value;
        historyIndex.current = history.length - 1;
      } else if (historyIndex.current > 0) {
        historyIndex.current -= 1;
      }
      setValue(history[historyIndex.current]);
      setSuggestions(null);
      return;
    }
    if (event.key === 'ArrowDown' && historyIndex.current !== -1) {
      event.preventDefault();
      if (historyIndex.current < history.length - 1) {
        historyIndex.current += 1;
        setValue(history[historyIndex.current]);
      } else {
        historyIndex.current = -1;
        setValue(draftRef.current);
      }
      setSuggestions(null);
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white p-2 relative">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={event => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setSuggestions(null)}
          role="combobox"
          aria-expanded={suggestions !== null && suggestions.length > 0}
          aria-controls="algebra-input-suggestions"
          aria-autocomplete="list"
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
      {suggestions && suggestions.length > 0 && (
        <div
          id="algebra-input-suggestions"
          role="listbox"
          className="absolute left-2 right-14 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, index) => (
            <button
              key={`${s.kind}:${s.text}`}
              type="button"
              role="option"
              aria-selected={index === highlight}
              className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
                index === highlight ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
              // onMouseDown 先于 input 的 onBlur，保证点击候选可以回填；
              // onClick 兜底触摸/辅助技术的 click 路径（评审 U11）
              onMouseDown={event => {
                event.preventDefault();
                handleChange(acceptSuggestion(value, s));
              }}
              onClick={() => handleChange(acceptSuggestion(value, s))}
            >
              <span className="font-mono font-medium">{s.text}</span>
              <span className="text-xs text-gray-400 ml-auto">{s.detail}</span>
            </button>
          ))}
          <div className="px-3 py-1 text-[11px] text-gray-400 border-t border-gray-100">
            {t('suggestionHint')}
          </div>
        </div>
      )}
      {error && <div className="mt-2 px-1 text-xs text-red-600">{error}</div>}
    </div>
  );
};

export default AlgebraInputBar;
