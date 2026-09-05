# MiniGeogebra 2D Alignment: Technical Design

## Overview

This document specifies the technical design for Phase 2D-1: Expression Engine + Algebra Input. It is the highest priority milestone because it unlocks the core GeoGebra paradigm: type an equation, see the graph, drag a slider, watch it move.

## Architecture

```
AlgebraInputBar (React)
       |
       | input text
       v
EquationRecognizer
       |
       | classified equation
       v
ExpressionParser
       |
       | ExpressionNode (AST)
       v
Construction (kernel)
       |
       v
AlgoDependentFunction / AlgoDependentNumeric
       |
       v
GeoFunction / GeoNumeric
       |
       v
CanvasRenderer (draws curve)
```

## Module Design

### Tokenizer

Converts an input string into a stream of tokens. Handles:

- Numbers: `123`, `1.5`, `.5`, `1e-7`
- Identifiers: `x`, `y`, `a`, `sin`, `f`
- Operators: `+`, `-`, `*`, `/`, `^`
- Delimiters: `(`, `)`, `,`, `=`
- Implicit multiplication: `2x` becomes `2 * x`, `3(x+1)` becomes `3 * (x+1)`

Token types: `Number`, `Identifier`, `Operator`, `LeftParen`, `RightParen`, `Comma`, `Equals`, `EOF`.

### ExpressionParser (Recursive Descent)

Grammar (precedence low to high):

```
expression  := term (('+' | '-') term)*
term        := factor (('*' | '/') factor)*
factor      := unary
unary       := ('-' | '+')? power
power       := atom ('^' factor)?
atom        := number | identifier | functionCall | '(' expression ')'
functionCall:= identifier '(' expression (',' expression)* ')'
```

Implicit multiplication is handled in `term`: if the next token is a `Number`, `Identifier`, or `LeftParen` without an explicit operator, insert a `MUL` operation.

### ExpressionNode

```typescript
type ExpressionValue =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'call'; name: string; args: ExpressionValue[] }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: ExpressionValue; right: ExpressionValue }
  | { kind: 'unary'; op: '-'; operand: ExpressionValue };
```

### ExpressionEvaluator

```typescript
type Scope = Map<string, number>;

function evaluate(node: ExpressionValue, scope: Scope): number;
```

- `number` -> return literal value
- `variable` -> look up in scope, return `NaN` if missing
- `call` -> dispatch to `BuiltinFunctions`, apply recursively
- `binary` -> apply operator recursively
- `unary` -> negate operand

Special cases:

- Division by zero returns `NaN` (not `Infinity`) to simplify rendering
- `0^0` returns `1` (matching most calculators)
- `log` is natural log; `log10` is base-10 log

### EquationRecognizer

Given a raw input string, classify it:

| Pattern | Classification | Action |
|---|---|---|
| `label = number` | `numeric-definition` | Create `GeoNumeric` with slider |
| `f(x) = expr` | `function-definition` | Create `AlgoDependentFunction` |
| `y = expr` | `function-implicit-name` | Create unnamed function |
| bare expression (contains `x`) | `function-expression` | Create unnamed function |
| bare number | `numeric-literal` | Create `GeoNumeric` |

Parsing order: try `function-definition` first (most specific), then `numeric-definition`, then `function-expression`.

### AlgoDependentFunction

```typescript
class AlgoDependentFunction extends AlgoElement {
  private expression: ExpressionValue;
  private variableName: string;    // "x"
  private output: GeoFunction;

  constructor(cons: Construction, input: string, label: string);
  compute(): void;   // called when any dependency changes
}
```

In `setInputOutput()`:

1. Extract all variable names from the AST (excluding the function variable)
2. Look up each variable in the `Construction`
3. Add each as an input dependency
4. Set `GeoFunction` as the output

In `compute()`:

1. Build a `Scope` from the current values of all numeric dependencies
2. Set the scope on the output `GeoFunction`
3. Mark the function as changed

### GeoFunction

```typescript
class GeoFunction extends GeoElement {
  private expression: ExpressionValue;
  private variableName: string;
  private scope: Scope;
  private samples: Array<{x: number; y: number}>;

  evaluateAt(x: number): number;
  updateSamples(minX: number, maxX: number, pixelWidth: number): void;
  getSamples(): ReadonlyArray<SamplePoint>;
  toExpressionString(): string;
}
```

Sampling strategy:

- Base resolution: one sample per 2 pixels of viewport width
- Skip `NaN` values (creates gaps for asymptotes / domain restrictions)
- Cache samples; invalidate only when viewport x-range changes or expression dependencies change

### Rendering

`CanvasRenderer.drawGeoFunction(geo: GeoFunction)`:

1. Get viewport x-range from `CoordinateSystem`
2. Call `geo.updateSamples(minX, maxX, canvasWidthInPixels)`
3. Map each sample point to screen coordinates
4. Break the path at `NaN` gaps
5. Draw polyline with the object's style (color, line width, dash)

### Algebra Input Bar UI

```tsx
function AlgebraInputBar({ construction, onObjectCreated }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const result = EquationRecognizer.parse(input, construction);
    if (result.error) {
      setError(result.error);
    } else {
      onObjectCreated(result.geo);
      setInput('');
      setError(null);
    }
  }
}
```

The input bar is placed at the top of the existing `SidePanel`. Below it, the object list shows all construction elements with their labels and expression text.

### Persistence

`ConstructionSerializer` additions:

```xml
<expression label="f" type="function">
  x^2 + 3x - 1
</expression>
<expression label="a" type="numeric">
  3
</expression>
```

On load: re-parse the expression text and reconstruct the `AlgoDependentFunction`.

## Dependency Graph

The existing `Construction` already maintains a DAG of `AlgoElement` dependencies. `AlgoDependentFunction` plugs into the same system:

```
GeoNumeric(a)  ----->  AlgoDependentFunction(f)  ----->  GeoFunction(f)
                             |
                       scope contains { a: 3 }
```

When `a` changes:

1. `Construction.update()` walks the DAG in topological order
2. `AlgoDependentFunction.compute()` runs
3. Scope is rebuilt with `{ a: newValue }`
4. `GeoFunction` marks itself dirty
5. `CanvasRenderer` re-renders the curve

## Edge Cases

| Case | Handling |
|---|---|
| `f(x) = 1/(x-2)` | Vertical asymptote at x=2; `NaN` gap in samples |
| `f(x) = sqrt(x)` | Undefined for x < 0; NaN gap |
| `a = 1/0` | Error: "Division by zero" shown in input bar |
| `f(x) = f(x) + 1` | Circular dependency error |
| `f(x) = a*x` with `a` undefined | NaN everywhere; curve not drawn |
| Very large numbers (`1e308`) | `NaN` or `Infinity` filtered in sampling |
| Empty input | No-op, clear error |
| Input `= 5` (no label) | Error: "Missing label" |

## Performance Considerations

1. Sample caching: only re-sample when the viewport range or expression value changes
2. Throttling: slider drag events are batched to `requestAnimationFrame`
3. AST reuse: `AlgoDependentFunction` stores the parsed AST; `compute()` only rebuilds the scope
4. No unnecessary React re-renders: `GeoFunction` updates are pushed via the kernel event system, not React state
