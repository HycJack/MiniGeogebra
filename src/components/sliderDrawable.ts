/**
 * 画布滑条（对标官方 DrawSlider / EuclidianController.moveSlider）：
 * 滑条是画布上的真实 drawable——轨道线 + 圆形滑块 + `a = 值` 标签，
 * 位置为屏幕绝对坐标（不随视图平移缩放移动）。
 *
 * 交互语义（官方 EuclidianController）：
 *   - 滑块（blob）命中 → 拖动改变值（投影到轨道 + increment 吸附）；
 *   - 轨道命中（滑块之外）→ Move 工具拖动改变滑条位置；其他工具点击 = 值跳转；
 *   - 命中即选中该数值对象。
 *
 * 本模块不依赖 DOM/React：几何、命中、取值都是纯函数，便于单测。
 */

import { GeoNumeric } from '../kernel/geo/GeoNumeric';

/** 滑条屏幕几何（全部为视口像素坐标；垂直轨道向上延伸，对标官方 sy − w）。 */
export interface SliderGeom {
    /** 轨道起点（sliderX/sliderY）。 */
    sx: number;
    sy: number;
    /** 轨道终点。 */
    ex: number;
    ey: number;
    /** 滑块（blob）中心。 */
    kx: number;
    ky: number;
    horizontal: boolean;
    /** 轨道长度（px）。 */
    width: number;
}

export function sliderGeomScreen(num: GeoNumeric): SliderGeom {
    const horizontal = num.sliderHorizontal;
    const sx = num.sliderX;
    const sy = num.sliderY;
    const w = Math.max(20, num.sliderWidthPx);
    const ex = horizontal ? sx + w : sx;
    const ey = horizontal ? sy : sy - w;
    const t = num.paramOfValue();
    return { sx, sy, ex, ey, kx: sx + (ex - sx) * t, ky: sy + (ey - sy) * t, horizontal, width: w };
}

/** 点到线段距离（命中轨道用）。 */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 命中判定（官方 DrawSlider.hitPoint / hitSlider / hitSliderNotBlob）。 */
export function sliderHitAt(
    num: GeoNumeric,
    mx: number,
    my: number,
    threshold = 4,
): 'knob' | 'track' | null {
    const g = sliderGeomScreen(num);
    // 滑块：r = threshold + max(diameter, blobSize)
    const rKnob = threshold + Math.max(2 * num.sliderBlobSize + 1, num.sliderBlobSize);
    if (Math.hypot(mx - g.kx, my - g.ky) <= rKnob) return 'knob';
    // 轨道带：r = threshold + max(thickness=10, blob)/2
    const rTrack = threshold + 5;
    if (distToSegment(mx, my, g.sx, g.sy, g.ex, g.ey) <= rTrack) {
        // hitSliderNotBlob：轨道命中但滑块之外
        const r2 = threshold * 2 + num.sliderBlobSize;
        const outsideBlob = Math.abs(mx - g.kx) > r2 || Math.abs(my - g.ky) > r2;
        return outsideBlob ? 'track' : 'knob';
    }
    return null;
}

/** 鼠标位置投影到轨道 → 值（含 [0,1] 钳制与 increment 吸附；官方 moveNumeric）。 */
export function sliderValueAtMouse(num: GeoNumeric, mx: number, my: number): number {
    const g = sliderGeomScreen(num);
    const raw = g.horizontal
        ? (mx - g.sx) / g.width
        : (g.sy - my) / g.width;
    return num.valueAtParam(raw);
}

/** 值 → 滑块屏幕坐标（渲染/拖拽预览共用）。 */
export function sliderKnobScreen(num: GeoNumeric): { x: number; y: number } {
    const g = sliderGeomScreen(num);
    return { x: g.kx, y: g.ky };
}
