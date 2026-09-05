# MiniGeogebra 2D Feature Alignment: Requirements & Design

## 1. Goal

Align MiniGeogebra's 2D capabilities with GeoGebra's core 2D workflow: algebra input drives geometry, geometry drives algebra, and both update in real time. This document defines the scope, phased milestones, and technical design for the next several iterations.

## 2. Current State vs GeoGebra (2D)

| Capability | MiniGeogebra | GeoGebra (reference) | Gap |
|---|---|---|---|
| Expression parser | None | `GParser` + `FunctionParser` (879 lines) | Critical |
| Algebra input bar | None | `AlgebraProcessor` (3,956 lines) | Critical |
| Function objects (y = f(x)) | None | `GeoFunction` (2,954 lines) | Critical |
| Expression evaluation tree | None | `ExpressionNode` (3,777 lines) | Critical |
| Implicit curves | None | `GeoImplicit` + polynomial solver | High |
| Text objects | None | `GeoText` + LaTeX rendering | High |
| Transform tools (dilate/mirror/shear/stretch) | Rotate, translate only | Full set | Medium |
| Bounding box manipulation | Click + drag only | Resize, rotate, skew handles | Medium |
| Multi-selection | Single object | Shift-click, rubber band | Medium |
| Right-click context menu | None | Full object/view menu | Medium |
| Style bar (color, line, fill, point size) | Minimal side panel | Per-object style bar | Medium |
| Grid snapping modes | Free + basic snap | Grid, point, line, polygon snap | Low |
| Coordinate axes customization | Show/hide | Custom ticks, labels, step, arrow | Low |
| Zoom/pan precision | Basic | Animated zoom, keyboard zoom, pinch | Low |

## 3. Non-Goals (for this phase)

- 3D geometry kernel alignment
- CAS / symbolic computation (Giac integration)
- Statistics and probability tools
- Spreadsheet view
- Scripting / JavaScript API
- GeoGebra file import/export (`.ggb`)

## 4. Phased Milestones

### Phase 2D-1: Expression Engine + Algebra Input (highest priority)

**Objective**: Allow users to type `f(x) = x^2 + 3x - 1`, `y = 2x + 1`, `a = 3` in an input bar and see the corresponding graph/geometry appear.

**Requirements**:

1. R1: Tokenizer + recursive descent parser for arithmetic expressions
   - Numbers, identifiers, `+ - * / ^ ( )`, unary minus
   - Function calls: `sin cos tan sqrt abs exp ln log floor ceil round min max`
   - Variables: `x`, `y`, user-defined labels (e.g. `a`, `b`)
   - Implicit multiplication: `2x`, `3(x+1)`, `xy`
2. R2: AST → `ExpressionNode` tree with `evaluate(vars)` method
3. R3: Equation recognizer
   - `y = expr(x)` → `GeoFunction` (explicit function of x)
   - `f(x) = expr(x)` → named function
   - `label = number` → `GeoNumeric` (slider-able)
   - `expr_x, expr_y` (parametric or coordinate) → future
4. R4: New `GeoFunction` object — wraps an expression, samples N points across the visible x-range, renders as a polyline
5. R5: Algebra input bar UI — text input at the top of the sidebar with inline error display
6. R6: Dependency integration — if `f(x) = a*x`, and `a` is a slider, moving `a` re-evaluates `f`
7. R7: Persistence — serialize expression text and parsed AST in `ConstructionSerializer`
8. R8: Tests — parser unit tests, evaluation tests, dependency propagation tests

**GeoGebra source references**:

| Component | GeoGebra path | Relevance |
|---|---|---|
| Parser | `kernel/parser/FunctionParser.java` | Tokenizer + parser structure |
| AST | `kernel/arithmetic/ExpressionNode.java` | Binary tree with operation + left + right |
| Operations | `plugin/Operation.java` | Enum of all supported ops |
| Function wrapper | `kernel/geos/GeoFunction.java` | How a function stores + evaluates expression |
| Algebra processor | `kernel/commands/AlgebraProcessor.java` | How input string → construction object |
| Dependent function | `kernel/algos/AlgoDependentFunction.java` | Dependency tracking for expressions |

### Phase 2D-2: Function Visualization + Interaction

**Objective**: Make plotted functions feel like GeoGebra — hover to see value, click to select, style, integrate with snap.

**Requirements**:

1. R1: Adaptive sampling — sample more densely near curvature changes
2. R2: Point-on-function — click on a curve to create a constrained point
3. R3: Intersection of function and line/circle/function — numerical root finding (bisection / Newton)
4. R4: Function style — color, line weight, line style (solid/dashed/dotted)
5. R5: Hover tooltip — show `f(x) = value` at cursor
6. R6: Extremum / root commands — `Root(f)`, `Extremum(f)` in input bar
7. R7: Derivative — `Derivative(f)` creates f'(x) as a new function
8. R8: Integral — `Integral(f, a, b)` shades area and shows value

**GeoGebra source references**:

| Component | GeoGebra path | Relevance |
|---|---|---|
| Derivative | `kernel/arithmetic/Derivative.java` | Symbolic differentiation rules |
| Root finding | `kernel/roots/RootFinder*.java` | Bisection + Newton |
| Extremum | `kernel/algos/AlgoFunctionMinMax.java` | Golden section search |
| Integral | `kernel/algos/AlgoSumIntegral*.java` | Adaptive quadrature |

### Phase 2D-3: Missing Construction Tools

**Objective**: Fill gaps in geometric constructions to match GeoGebra's 2D toolset.

**Requirements**:

1. R1: `GeoDilate` — dilate about a point by a factor
2. R2: `GeoMirror` — reflect across a line / point / circle
3. R3: `GeoInvert` — circular inversion
4. R4: `GeoShear` — shear transform
5. R5: `GeoStretch` — stretch along a direction
6. R6: Point on object (line, segment, circle, conic, polygon, function)
7. R7: Angle between line and line, line and conic
8. R8: Locus of point on path with respect to moving point

### Phase 2D-4: UI / UX Alignment

**Objective**: Match GeoGebra's interaction polish.

**Requirements**:

1. R1: Bounding box with resize/rotate/skew handles for lines, circles, polygons, text
2. R2: Multi-select (shift-click, rubber band)
3. R3: Right-click context menu (delete, rename, show/hide, style, trace on/off)
4. R4: Style bar — per-object color, opacity, line style, point size, label visibility
5. R5: Text object — click to place, edit content, optional LaTeX (render as SVG)
6. R6: Axis configuration dialog — tick step, label, arrow, axis visibility
7. R7: Animated zoom (smooth), keyboard shortcuts for zoom/pan
8. R8: Algebra view — list of all objects, click to highlight, double-click to edit expression

## 5. Technical Design

### 5.1 Expression Engine Architecture

```
Input string "f(x) = x^2 + 3x - 1"
      |
      v
+------------------------------+
|  EquationRecognizer          |
|  (src/kernel/algebra/)       |
+---------------+--------------+
                |
                v
+------------------------------+
|  ExpressionParser            |
|  Recursive descent -> AST    |
+---------------+--------------+
                |
                v
+------------------------------+
|  ExpressionNode (AST)        |
|  evaluate(vars): number      |
|  getVariables(): string[]    |
+---------------+--------------+
                |
                v
+------------------------------+
|  AlgoDependentFunction       |
|  output: GeoFunction         |
+------------------------------+
```

### 5.2 New Kernel Modules

```
src/kernel/algebra/
  Tokenizer.ts
  ExpressionNode.ts
  ExpressionParser.ts
  ExpressionEvaluator.ts
  EquationRecognizer.ts
  BuiltinFunctions.ts
  index.ts

src/kernel/algo/
  AlgoDependentFunction.ts
  AlgoDependentNumeric.ts
  AlgoDerivative.ts
  AlgoRoots.ts
  AlgoExtremum.ts

src/kernel/geo/
  GeoFunction.ts
```

### 5.3 GeoFunction Design

```typescript
class GeoFunction extends GeoElement {
  private expr: ExpressionNode;
  private label: string;
  private varName: string;           // "x"
  private cachedSamples: {x: number, y: number}[];
  private sampleRange: [number, number];

  evaluate(x: number): number;
  update();                          // re-sample if dependencies changed
  getSamples(minX: number, maxX: number, viewport: CoordinateSystem): SamplePoint[];
  getExpressionText(): string;       // "x^2 + 3x - 1"
}
```

### 5.4 Algebra Input Bar UI

Input bar at the top of the sidebar. Accepted forms:

| Input | Result |
|---|---|
| `a = 3` | Creates a numeric slider named `a` |
| `f(x) = x^2 + 3x - 1` | Creates a function named `f` |
| `y = 2x + 1` | Creates an unnamed function |
| `2x + 3` | Creates an unnamed function |
| Invalid expression | Inline error message below the input |

### 5.5 Dependency Propagation

When a `GeoNumeric` (e.g. slider `a`) changes:

1. `Construction` marks `a` as dirty
2. All dependent algorithms recompute in topological order
3. `AlgoDependentFunction` re-evaluates its AST with the new value
4. `GeoFunction.update()` re-samples the visible range
5. Renderer redraws

### 5.6 Derivative Design

Phase 2D-2 uses central difference:

```
f'(x) = (f(x + h) - f(x - h)) / (2h),  h = 1e-7
```

Phase 2D-3+ implements symbolic differentiation on the AST. Rules: constant to 0, variable to 1, sum/difference term-wise, product rule, quotient rule, power rule with constant exponent, and chain rule for built-in functions.

### 5.7 Testing Strategy

| Layer | What to test | Framework |
|---|---|---|
| Tokenizer | Token stream for valid and invalid input | Vitest |
| Parser | AST structure for known expressions | Vitest |
| Evaluator | `evaluate()` with known variable values | Vitest |
| EquationRecognizer | Correct classification | Vitest |
| AlgoDependentFunction | Dependency propagation on slider change | Vitest |
| GeoFunction | Sampling correctness, asymptotes | Vitest |
| Derivative | Numeric accuracy, symbolic AST correctness | Vitest |
| UI | Input accepts valid, rejects invalid | Manual + Vitest |

## 6. Implementation Order

1. `Tokenizer.ts` + `ExpressionNode.ts` + `ExpressionParser.ts` + tests
2. `ExpressionEvaluator.ts` + tests
3. `GeoFunction.ts` (kernel side only)
4. `AlgoDependentFunction.ts` + dependency integration + tests
5. `EquationRecognizer.ts` + tests
6. `CanvasRenderer.ts` — draw `GeoFunction` as polyline
7. Algebra input bar UI component
8. Integration test: slider changes propagate to function curve
9. `AlgoDerivative.ts` (numeric) + `Root` / `Extremum` commands
10. Phase 2D-2 polish: hover tooltip, point-on-function, intersection

## 7. Risk Assessment

| Risk | Mitigation |
|---|---|
| Parser bugs (precedence, edge cases) | Comprehensive test suite, start simple, extend |
| Performance: re-sample on every slider tick | Cache samples, throttle to animation frame |
| Expression with undefined value (e.g. 1/0) | Return `NaN`, skip sample points, show "undefined" |
| Circular dependency (f depends on f) | Detect cycle in `Construction.update()`, throw error |
| Scope creep: trying to match all 700+ GeoGebra commands | Strictly scope to Phase 2D-1/2 features only |
