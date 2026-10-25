/**
 * 画布内数值/文本输入浮层（替代 window.prompt，对标 GeoGebra 的就地输入框）。
 *
 * 由 GeometryCanvas 的 valueRequest 状态驱动：
 *   - Enter 提交（数字非法时保持打开），Esc 取消（onSubmit(null)）；
 *   - 出现在最后一次鼠标点击的屏幕位置附近，带视口边缘防溢出。
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from '../i18n/LanguageContext';

export interface ValueRequest {
  kind: 'number' | 'text';
  title: string;
  defaultValue: string;
  screenX: number;
  screenY: number;
  onSubmit: (raw: string | null) => void;
}

interface Props {
  request: ValueRequest;
  /** 提交/取消后由父组件关闭浮层。 */
  onClose: () => void;
  /** 画布容器：其内的 pointerdown 不在此取消（由画布的"取消并消费本次点击"
   *  守卫处理），否则外点取消先跑、守卫读到 null 成为死代码，
   *  单步工具会在同一次点击里立刻重新弹框。 */
  ignorePointerDownRef?: React.RefObject<HTMLElement | null>;
  t: TFunction;
}

const CanvasValueInput: React.FC<Props> = ({ request, onClose, ignorePointerDownRef, t }) => {
  const [value, setValue] = useState(request.defaultValue);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  // 点浮层外部（工具栏/侧栏/画布外的任何地方）= 取消输入，对标 GeoGebra 失焦关闭（评审 U15）。
  // wrapper 自身的 onMouseDown 会 stopPropagation，浮层内点击不会触到这里。
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        if (ignorePointerDownRef?.current?.contains(target)) return; // 交给画布守卫消费
        request.onSubmit(null);
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [request, onClose, ignorePointerDownRef]);

  const submit = () => {
    const trimmed = value.trim();
    if (request.kind === 'number') {
      // 空串 Number('') === 0 会通过 isFinite —— 必须显式拒绝（评审 U2：
      // rotate 收到 0 会原地克隆对象、shear/stretch 收到 0 是奇异变换）
      const n = Number(trimmed);
      if (trimmed === '' || !Number.isFinite(n)) { setInvalid(true); return; }
    }
    request.onSubmit(trimmed);
    onClose();
  };

  const cancel = () => {
    request.onSubmit(null);
    onClose();
  };

  // 视口边缘防溢出：靠右/靠下时向内收
  const left = Math.min(request.screenX + 12, window.innerWidth - 240);
  const top = Math.min(request.screenY + 12, window.innerHeight - 80);

  return createPortal(
    <div
      ref={wrapperRef}
      className="fixed z-[1100] w-52 bg-white border border-gray-300 rounded-lg shadow-lg p-2"
      style={{ left, top }}
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <div className="text-xs text-gray-500 mb-1 truncate" title={request.title}>{request.title}</div>
      <input
        ref={inputRef}
        // 统一用 text：type="number" 会拦掉 `1e5`、`-`、`.` 等合法中间态，
        // 校验交给 submit 里的 Number()（评审 M3）
        type="text"
        inputMode={request.kind === 'number' ? 'decimal' : undefined}
        value={value}
        autoFocus
        onChange={e => { setValue(e.target.value); setInvalid(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className={`w-full px-2 py-1.5 text-sm border rounded font-mono focus:outline-none focus:ring-2 ${
          invalid ? 'border-red-400 ring-red-200' : 'border-gray-300 focus:ring-blue-500'
        }`}
      />
      {invalid && <div className="text-[11px] text-red-600 mt-1">{t('valueInvalid')}</div>}
      <div className="flex justify-end gap-1 mt-2">
        <button type="button" onClick={cancel}
          className="px-2 py-1 text-xs rounded text-gray-600 hover:bg-gray-100">{t('btnCancel')}</button>
        <button type="button" onClick={submit}
          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">{t('btnOk')}</button>
      </div>
    </div>,
    document.body,
  );
};

export default CanvasValueInput;
