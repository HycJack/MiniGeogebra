# MiniGeogebra 2D Drawing & Animation: Gap Analysis + Technical Design

## 1. Scope

This document focuses on two things:

1. **Drawing**: filling the gaps between MiniGeogebra's 2D toolset and GeoGebra's `EuclidianConstants` tool catalog.
2. **Animation**: upgrading `GeoNumeric` animation from a simple wrap-around loop to GeoGebra's four animation types, plus point-on-path animation.

The goal is to make the frontend tool interaction feel the same as GeoGebra Classic: click a tool, click/drag on canvas, press Escape to cancel, drag to move, slider to animate.

## 2. Current State

### What MiniGeogebra has

| Category | Tools |
|---|---|
| Move / Select | `move` (single select + drag) |
| Points | `point`, `midpoint`, `intersect` |
| Lines | `segment`, `line`, `ray`, `vector`, `polyline` |
| Special lines | `parallel`, `orthogonal`, `perpendicular_bisector`, `angle_bisector`, `tangent` |
| Polygons | `polygon`, `regular_polygon` |
| Circles | `circle` (center+radius), `circle_center_point`, `circle3` |
| Arcs | `arc`, `semicircle`, `sector`, `circumcircular_arc` |
| Conics | `ellipse`, `hyperbola`, `parabola`, `conic5` |
| Transforms | `rotate`, `dilate`, `mirror` |
| Measure | `distance`, `angle`, `area`, `locus`, `slope`, `compass` |
| Insert | `text`, `slider`, `button`, `checkbox` |
| Animation | `GeoNumeric` loop (increment + wrap) |

### What GeoGebra has that MiniGeogebra lacks (2D-relevant)

| GeoGebra mode | Feature | Priority |
|---|---|---|
| `MODE_SHOW_HIDE_OBJECT` | Show/hide toggle for objects | High |
| `MODE_SHOW_HIDE_LABEL` | Show/hide label toggle | High |
| `MODE_DELETE` | Dedicated delete tool (click object to delete) | High |
| `MODE_MIRROR_AT_POINT` | Reflect across a point | High |
| `MODE_MIRROR_AT_LINE` | Reflect across a line | High |
| `MODE_MIRROR_AT_CIRCLE` | Inversion in a circle | Medium |
| `MODE_TRANSLATE_BY_VECTOR` | Translate by a vector object | High |
| `MODE_ROTATE_BY_ANGLE` | Rotate about a point by an angle | Already has `rotate` but needs angle input |
| `MODE_DILATE_FROM_POINT` | Dilate from a point by a factor | Already has `dilate` but needs factor input |
| `MODE_SHEAR_OR_STRETCH` | Shear / stretch along a line | Medium |
| `MODE_SEGMENT_FIXED` | Fixed-length segment (input length) | Medium |
| `MODE_ANGLE_FIXED` | Fixed-size angle (input degrees) | Medium |
| `MODE_VECTOR_FROM_POINT` | Vector from a point | Medium |
| `MODE_POINT_ON_OBJECT` | Point constrained to a path (line, circle, conic, polygon edge, polyline) | High |
| `MODE_ATTACH_DETACH` | Attach/detach a point to/from a path | Medium |
| `MODE_FITLINE` | Best-fit line through points | Low |
| `MODE_IMAGE` | Insert image (bitmap) | Low |
| `MODE_PEN` | Freehand drawing (pen tool) | Low |
| `MODE_FREEHAND_SHAPE` | Freehand shape recognition | Low |
| `MODE_FREEHAND_FUNCTION` | Freehand function fitting | Low |
| `MODE_ZOOM_IN` / `MODE_ZOOM_OUT` | Zoom tools (click to zoom in/out) | Low |
| `MODE_TRANSLATEVIEW` | Pan view tool (drag to pan) | Low |

### Animation gaps

| GeoGebra feature | MiniGeogebra current | Gap |
|---|---|---|
| `ANIMATION_OSCILLATING` (ping-pong) | Not supported | Missing |
| `ANIMATION_INCREASING` (loop forward) | Closest to current behavior | OK |
| `ANIMATION_DECREASING` (loop backward) | Not supported | Missing |
| `ANIMATION_INCREASING_ONCE` (play once, stop) | Not supported | Missing |
| Point-on-path animation (a point slides along a path) | Not supported | Missing |
| Play/Pause/Stop global controls | Only play/pause | Missing Stop |
| Per-slider animation type selector | Not exposed in UI | Missing |
| Per-slider speed control | Already exists | OK |
| Random animation (jump to random value) | Not supported | Missing |

## 3. Phased Implementation Plan

### Phase D1: Core Missing Tools (highest priority)

**Objective**: Add the most frequently used missing tools so that a user can perform standard constructions without workaround.

| Tool | Mode ID | Steps | Algorithm |
|---|---|---|---|
| Delete object | `delete` | Click object -> cascade delete | `Construction.deleteElementWithDependents()` (already exists) |
| Show/hide object | `show_hide` | Click object -> toggle `visible` flag | Add `visible` boolean to `GeoElement` |
| Show/hide label | `show_hide_label` | Click object -> toggle `labelVisible` | Already has `labelVisible` on `GeoElement` |
| Reflect at point | `mirror_point` | Click object, click point | New `AlgoMirrorAtPoint` |
| Reflect at line | `mirror_line` | Click object, click line | New `AlgoMirrorAtLine` (extend existing `AlgoMirror`) |
| Translate by vector | `translate_vector` | Click object, click vector | New `AlgoTranslateByVector` |
| Vector from point | `vector_from_point` | Click point, click endpoint | Creates `GeoVector` from point A to point B |
| Point on object | `point_on_object` | Click on path -> create constrained point | Extend `AlgoPointOnSegment/Line/Conic` to all path types |
| Fixed segment | `segment_fixed` | Click start point, input length, click direction | Prompt for length, create segment |
| Fixed angle | `angle_fixed` | Click vertex, input degrees, two rays | Prompt for angle |

### Phase D2: Transform Completion

**Objective**: Complete the transform toolset to match GeoGebra.

| Tool | Mode ID | Algorithm |
|---|---|---|
| Reflect at circle (inversion) | `mirror_circle` | New `AlgoMirrorAtCircle` |
| Shear | `shear` | New `AlgoShearOrStretch` (shear=true) |
| Stretch | `stretch` | New `AlgoShearOrStretch` (shear=false) |
| Rotate with angle input | `rotate_angle` | Extend existing `AlgoRotate` to accept a numeric angle |
| Dilate with factor input | `dilate_factor` | Extend existing `AlgoDilate` to accept a numeric factor |

### Phase D3: Animation Upgrade

**Objective**: Match GeoGebra's animation system.

| Feature | Design |
|---|---|
| Animation types | Add `animationType` property to `GeoNumeric`: `'oscillating' | 'increasing' | 'decreasing' | 'increasing_once'` |
| Play once | After reaching max, set `animating = false` and remove from `AnimationManager` |
| Oscillating | Reverse direction when hitting min or max (ping-pong) |
| Decreasing | Step value decreases from max to min, wraps |
| Point-on-path animation | Add `Animatable` to `GeoPoint` when it's constrained to a path. Animate the path parameter t from 0 to 1 |
| Stop button | Global stop: pause all animated objects and reset their animation value to initial |
| Slider UI: type selector | Add a dropdown in `SliderControl`: Oscillating / Increasing / Decreasing / Play Once |
| Slider UI: random toggle | Add a checkbox: "Random" — jumps to random value in range each step |

### Phase D4: UX Polish

**Objective**: Match GeoGebra's interaction patterns.

| Feature | Design |
|---|---|
| Escape key | Cancel current tool (already works) |
| Delete key | Delete selected object with cascade (already works) |
| Multi-select | Shift-click to add to selection |
| Right-click menu | Delete, rename, show/hide, style, trace |
| Zoom tools | Toolbar buttons for zoom in/out/reset |
| Pan tool | Drag empty space to pan (right-click drag already works) |
| Tool cursor feedback | Change cursor to crosshair for drawing tools, default for move |
| Tool preview | Ghost preview of the object being created before second click |

## 4. Technical Design: Animation System

### 4.1 AnimationType enum

```typescript
export enum AnimationType {
  OSCILLATING = 0,
  INCREASING = 1,
  DECREASING = 2,
  INCREASING_ONCE = 3,
}
```

### 4.2 GeoNumeric.doAnimationStep — rewrite

```typescript
doAnimationStep(frameRate: number): boolean {
  const oldValue = this.value;
  const width = this.intervalMax - this.intervalMin;
  if (width <= 0) return false;

  // step per frame = intervalWidth * speed * direction / (10s * frameRate)
  const step = width * this.animationSpeed * this.animationDirection / (10 * frameRate);

  if (isNaN(this.animationValue)) this.animationValue = oldValue;

  switch (this.animationType) {
    case AnimationType.INCREASING:
      this.animationValue += step;
      if (this.animationValue > this.intervalMax) this.animationValue -= width;
      break;
    case AnimationType.DECREASING:
      this.animationValue += step;
      if (this.animationValue < this.intervalMin) this.animationValue += width;
      break;
    case AnimationType.OSCILLATING:
      this.animationValue += step;
      if (this.animationValue >= this.intervalMax) {
        this.animationValue = this.intervalMax;
        this.animationDirection = -1;
      } else if (this.animationValue <= this.intervalMin) {
        this.animationValue = this.intervalMin;
        this.animationDirection = 1;
      }
      break;
    case AnimationType.INCREASING_ONCE:
      this.animationValue += step;
      if (this.animationValue >= this.intervalMax) {
        this.animationValue = this.intervalMax;
        this.setAnimating(false);
      }
      break;
  }

  // quantize
  let param = this.animationValue - this.intervalMin;
  if (this.animationIncrement > 0)
    param = Math.round(param / this.animationIncrement) * this.animationIncrement;
  this.setValue(this.intervalMin + param, false);
  return this.value !== oldValue;
}
```

New fields on `GeoNumeric`:

```typescript
animationType: AnimationType = AnimationType.OSCILLATING;
private animationDirection: 1 | -1 = 1; // DECREASING initializes to -1
```

### 4.3 Point-on-path animation

When a point is constrained to a path (segment, line, circle, conic, polyline), it can be animated along the path:

1. Each path type implements `getPathParameter(p: GeoPoint): number` (returns t in [0, 1])
2. Each path type implements `getPointOnPath(t: number): {x: number, y: number}` (returns coordinates)
3. `GeoPoint` with a path constraint gets `Animatable`: its `doAnimationStep` advances t, then calls `getPointOnPath(t)` to update coordinates
4. The UI shows a play button on any point that has a path constraint (same pattern as sliders)

This is the key feature that makes GeoGebra feel "alive" — you put a point on a circle, click play, and watch the entire dependent construction animate.

### 4.4 AnimationManager — no change needed

The existing `AnimationManager` already handles multiple animated objects and calls `doAnimationStep` on each. We only need to ensure:

1. `GeoPoint` (when constrained) implements `Animatable`
2. `AnimationManager.addAnimatedGeo` accepts `GeoPoint` (currently accepts `GeoElement` which `GeoPoint` extends)
3. The point's path constraint algorithm is in the forward dependency graph so dependent objects update

## 5. Technical Design: Missing Algo Implementations

### 5.1 AlgoMirrorAtPoint

Given object G and point P, produce G' where each point of G is reflected through P:

```
G'.x = 2*P.x - G.x
G'.y = 2*P.y - G.y
```

This is equivalent to `dilate(G, -1, P)`. Implementation: reuse the `buildTransformed` helper with a new transform function.

### 5.2 AlgoMirrorAtLine

Given object G and line L, reflect G across L. For a line with unit direction (dx, dy) through point (px, py):

```
// project the point onto the line, then extend
t = ((x-px)*dx + (y-py)*dy) / (dx*dx + dy*dy)
projX = px + t*dx
projY = py + t*dy
G'.x = 2*projX - x
G'.y = 2*projY - y
```

### 5.3 AlgoTranslateByVector

Given object G and vector v, translate G by v:

```
G'.x = G.x + v.x
G'.y = G.y + v.y
```

### 5.4 AlgoMirrorAtCircle (inversion)

Given point P and circle (center C, radius r), the inverted point P' lies on ray CP such that `|CP| * |CP'| = r^2`:

```
dx = P.x - C.x
dy = P.y - C.y
d = sqrt(dx*dx + dy*dy)
if d = 0: P' is at infinity (undefined)
else:
  scale = r*r / (d*d)
  P'.x = C.x + dx * scale
  P'.y = C.y + dy * scale
```

For lines and circles, inversion produces circles/lines (standard formulas).

### 5.5 AlgoShearOrStretch

Given object G, a line L (direction), and a factor n:

- **Shear**: parallel lines remain parallel but shifted. Matrix relative to line direction:
  ```
  u = direction of L (unit)
  n = normal of L (perpendicular)
  shear matrix M = I + n * u^T * k    (where k = shear factor)
  ```
- **Stretch**: scale along the line direction, perpendicular unchanged:
  ```
  stretch matrix M = u * u^T * k + n * n^T * 1
  ```

Both are implemented as a general affine transform applied to the object.

## 6. Tool Interaction Design (GeoGebra Convention)

### 6.1 Tool click sequences

| Tool | Click 1 | Click 2 | Click 3 | Result |
|---|---|---|---|---|
| `delete` | Any object | - | - | Object + dependents deleted |
| `show_hide` | Any object | - | - | Toggle visible |
| `show_hide_label` | Any object | - | - | Toggle labelVisible |
| `mirror_point` | Object | Point | - | Reflected copy |
| `mirror_line` | Object | Line | - | Reflected copy |
| `translate_vector` | Object | Vector | - | Translated copy |
| `vector_from_point` | Point A | Point B | - | Vector from A to B |
| `point_on_object` | Path (line/circle/conic/polygon) | - | - | Constrained point |
| `segment_fixed` | Point A | - | - | Prompt for length -> create segment |
| `angle_fixed` | Point A (vertex) | Point B | - | Prompt for angle -> create |
| `shear` | Object | Line | - | Prompt for factor -> sheared copy |
| `stretch` | Object | Line | - | Prompt for factor -> stretched copy |

### 6.2 State machine for multi-step tools

The existing `toolState` in `ToolContext` is used to track multi-step tool progress. For example, `mirror_point`:

```
step 0: waiting for object click  → store object in toolState.sourceObject
step 1: waiting for point click   → create AlgoMirrorAtPoint(sourceObject, clickedPoint), clear toolState
```

The same pattern applies to all multi-step tools. On Escape key, clear toolState and return to step 0.

### 6.3 Toolbar organization (GeoGebra Classic layout)

GeoGebra groups tools into flyout menus. We keep the current group structure but add new tools to existing groups:

| Group | Existing | Add |
|---|---|---|
| Basic | move | delete, show_hide, show_hide_label |
| Transform | rotate, dilate, mirror | mirror_point, mirror_line, mirror_circle, translate_vector, vector_from_point, shear, stretch |
| Point | point, midpoint, intersect | point_on_object, attach/detach |
| Line | segment, line, ray, vector, polyline | segment_fixed, vector_from_point |
| Measure | distance, angle, area, locus, slope, compass | angle_fixed |

## 7. Implementation Order

1. **D1 tools**: `delete`, `show_hide`, `show_hide_label` — simplest, immediate UX value
2. **D1 tools**: `mirror_point`, `mirror_line`, `translate_vector`, `vector_from_point` — new Algo + handler
3. **D1 tool**: `point_on_object` — extend hit tests + new handler
4. **D3 animation**: `AnimationType` enum + `GeoNumeric.doAnimationStep` rewrite + slider UI type selector
5. **D3 animation**: Point-on-path animation (path parameter system)
6. **D2 tools**: `mirror_circle`, `shear`, `stretch`
7. **D2 tools**: `segment_fixed`, `angle_fixed` (with input prompts)
8. **D4 UX**: multi-select, right-click menu, zoom tools, tool preview

## 8. Testing

| Test | What it verifies |
|---|---|
| `AlgoMirrorAtPoint` | Point reflected through another point |
| `AlgoMirrorAtLine` | Point reflected across a line |
| `AlgoTranslateByVector` | Point translated by vector |
| `AlgoMirrorAtCircle` | Point inverted in circle |
| `AnimationType` | Each type produces correct step behavior over 100 frames |
| Point-on-path | Point stays on path as t varies |
| Tool handlers | Click sequence creates correct objects |
| Cascade delete | Deleting a point removes all dependents |
