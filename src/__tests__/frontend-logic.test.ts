/**
 * 前端交互纯逻辑单测：
 *   - resolveViewKey：键盘缩放 / 平移 / 重置的映射
 *   - formatHover：hover 提示文本格式化（NaN → undefined）
 *   - TOOL_HINTS：所有 ToolMode 都有对应 key，且 key 在 LanguageContext 中存在
 */
import { describe, it, expect } from 'vitest';
import { resolveViewKey, formatHover, DEFAULT_ZOOM_FACTOR } from '../components/view/keyboardShortcuts';
import { TOOL_HINTS } from '../components/ToolHintBar';
import { translations } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/LanguageContext';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import type { ToolMode } from '../components/tools/types';

describe('resolveViewKey', () => {
  const coord = CoordinateSystem.centered(800, 600, 50);
  const size = { width: 800, height: 600 };

  it('maps "+" and "=" to zoom-in factor 1.2', () => {
    expect(resolveViewKey('+', coord, size)).toEqual({ kind: 'zoom', factor: 1.2 });
    expect(resolveViewKey('=', coord, size)).toEqual({ kind: 'zoom', factor: 1.2 });
  });

  it('maps "-" and "_" to zoom-out factor 1/1.2', () => {
    expect(resolveViewKey('-', coord, size)).toEqual({ kind: 'zoom', factor: 1 / DEFAULT_ZOOM_FACTOR });
    expect(resolveViewKey('_', coord, size)).toEqual({ kind: 'zoom', factor: 1 / DEFAULT_ZOOM_FACTOR });
  });

  it('maps "0" to reset view', () => {
    expect(resolveViewKey('0', coord, size)).toEqual({ kind: 'reset' });
  });

  it.each([
    ['ArrowLeft', -1, 0],
    ['ArrowRight', 1, 0],
    ['ArrowUp', 0, -1],
    ['ArrowDown', 0, 1],
  ])('arrow key %s pans with the expected sign and non-zero magnitude', (key, expectedDxSign, expectedDySign) => {
    const res = resolveViewKey(key, coord, size);
    expect(res.kind).toBe('pan');
    expect(res.dx).toBeDefined();
    expect(res.dy).toBeDefined();
    expect(Math.abs(res.dx!) + Math.abs(res.dy!)).toBeGreaterThan(0);
    if (expectedDxSign !== 0) expect(Math.sign(res.dx!)).toBe(expectedDxSign);
    if (expectedDySign !== 0) expect(Math.sign(res.dy!)).toBe(expectedDySign);
  });

  it('returns none for keys owned by upper-layer tool logic (Escape, Delete, Enter)', () => {
    expect(resolveViewKey('Escape', coord, size).kind).toBe('none');
    expect(resolveViewKey('Delete', coord, size).kind).toBe('none');
    expect(resolveViewKey('Enter', coord, size).kind).toBe('none');
  });

  it('returns none for random letters and modifiers', () => {
    expect(resolveViewKey('a', coord, size).kind).toBe('none');
    expect(resolveViewKey(' ', coord, size).kind).toBe('none');
    expect(resolveViewKey('Control', coord, size).kind).toBe('none');
  });

  it('pan result preserves xScale / yScale and shifts xZero/yZero by the pixel delta', () => {
    const before = CoordinateSystem.centered(800, 600, 50);
    const res = resolveViewKey('ArrowRight', before, { width: 800, height: 600 });
    expect(res.kind).toBe('pan');
    const after = before.panBy(res.dx!, res.dy!);
    expect(after.xScale).toBe(before.xScale);
    expect(after.yScale).toBe(before.yScale);
    expect(after.xZero - before.xZero).toBeCloseTo(res.dx!);
    expect(after.yZero - before.yZero).toBeCloseTo(res.dy!);
  });
});

describe('formatHover', () => {
  it('renders f(x) = y format when label is provided and y is finite', () => {
    expect(formatHover('f', 2.5, -1.25)).toBe('f(2.500) = -1.250');
  });

  it('renders "undefined" when y is NaN', () => {
    expect(formatHover('f', 1, NaN)).toBe('f(1.000) = undefined');
  });

  it('falls back to "y = value" form when label is empty', () => {
    expect(formatHover('', 3.14159, 7)).toBe('y = 7.000');
  });

  it('renders "undefined" for NaN y even without a label', () => {
    expect(formatHover('', 0, NaN)).toBe('y = undefined');
  });
});

describe('TOOL_HINTS', () => {
  // 显式枚举所有 ToolMode 字面量，保证新增 mode 时此断言立刻失败
  const ALL_MODES: ToolMode[] = [
    'select', 'move', 'point', 'point_on_object', 'line', 'segment', 'segment_fixed',
    'midpoint', 'intersect', 'parallel', 'orthogonal', 'perpendicular_bisector', 'angle_bisector',
    'circle', 'circle_center_point', 'circle3', 'arc', 'semicircle', 'sector',
    'circumcircular_arc', 'circumcircular_sector', 'ray', 'regular_polygon', 'polygon', 'vector',
    'polyline', 'vector_from_point', 'distance', 'angle', 'angle_fixed', 'area', 'slope',
    'tangent', 'locus', 'rotate', 'dilate', 'mirror', 'mirror_line', 'mirror_point',
    'mirror_circle', 'translate_vector', 'shear', 'stretch', 'text', 'slider', 'button',
    'checkbox', 'ellipse', 'hyperbola', 'parabola', 'conic5', 'compass', 'pan', 'zoom_in',
    'zoom_out', 'show_hide', 'show_hide_label', 'delete',
  ];

  it('covers every ToolMode with a TranslationKey', () => {
    for (const m of ALL_MODES) {
      expect(TOOL_HINTS).toHaveProperty(m);
      expect(typeof TOOL_HINTS[m as keyof typeof TOOL_HINTS]).toBe('string');
    }
  });

  it('has no keys mapping to undefined', () => {
    for (const m of ALL_MODES) {
      expect(TOOL_HINTS[m as keyof typeof TOOL_HINTS]).toBeDefined();
    }
  });

  it('every mapped key exists in the zh dictionary', () => {
    for (const m of ALL_MODES) {
      const key = TOOL_HINTS[m as keyof typeof TOOL_HINTS];
      expect(translations.zh).toHaveProperty(key);
    }
  });

  it('every mapped key exists in the en dictionary', () => {
    for (const m of ALL_MODES) {
      const key = TOOL_HINTS[m as keyof typeof TOOL_HINTS];
      expect(translations.en).toHaveProperty(key);
    }
  });

  it('every mapped key resolves to a non-empty string in both languages', () => {
    for (const m of ALL_MODES) {
      const key = TOOL_HINTS[m as keyof typeof TOOL_HINTS];
      expect(typeof (translations.zh as Record<string, string>)[key]).toBe('string');
      expect((translations.zh as Record<string, string>)[key].length).toBeGreaterThan(0);
      expect(typeof (translations.en as Record<string, string>)[key]).toBe('string');
      expect((translations.en as Record<string, string>)[key].length).toBeGreaterThan(0);
    }
  });

  it('maps multi-step tools to their own dedicated hint keys (not the tool name itself)', () => {
    // 这些 mode 的第一步语义与工具名不同，必须映射到专属 hint key
    expect(TOOL_HINTS.rotate).toBe('toolHintRotate');
    expect(TOOL_HINTS.dilate).toBe('toolHintDilate');
    expect(TOOL_HINTS.mirror).toBe('toolHintMirror');
    expect(TOOL_HINTS.shear).toBe('toolHintShear');
    expect(TOOL_HINTS.stretch).toBe('toolHintStretch');
  });

  it('type-level: TOOL_HINTS is a complete Record<ToolMode, TranslationKey>', () => {
    // 借助类型断言确保 Record<ToolMode, TranslationKey> 完整覆盖
    const exhaustive: Record<ToolMode, TranslationKey> = TOOL_HINTS;
    expect(Object.keys(exhaustive)).toHaveLength(ALL_MODES.length);
  });
});
