# MiniGeogebra 2D Alignment — Status

对照 [`2D-alignment-requirements.md`](./2D-alignment-requirements.md) 的四个 Phase。
本文件记录**已落地并通过测试**的部分，以及**明确遗留**的部分。
测试入口：`npx vitest run`（内核/算法为纯函数单测，无 DOM 依赖）。

---

## 1. 本轮新增/改动的内核能力

| 模块 | 文件 | 内容 | 测试 |
|---|---|---|---|
| 曲线自适应采样 | `src/kernel/geo/GeoFunction.ts` | 均匀基采样 → 弦中点偏差递归细分 → 渐近线断点；仅对真正无定义的值写 NaN，不再对有限值做任意截断 | `function-sampling.test.ts` (13) |
| 通用圆锥曲线取点 | `src/kernel/geo/GeoConic.ts`, `src/kernel/algo/AlgoPointOnConic.ts` | 抽出 `rayIntersections()` 射线求交原语，新增 `pointAtAngle()`；`AlgoPointOnConic` 由「按半径极坐标」改为解析求交，覆盖圆/椭圆/双曲线/抛物线 | `point-on-conic.test.ts` (12) |
| 数值分析原语 | `src/kernel/algebra/Numerics.ts` | `bisect` / `findRoots` / `findExtrema` / `integrate`（自适应辛普森 + 有限区间扫描分段） | `numerics.test.ts` (24) |
| 符号微分 | `src/kernel/algebra/Differentiator.ts` | 递归 AST 微分：常数、加减、乘积、商、幂（指数为常数时退化为 `b*a^(b-1)*d(a)`）、三角/对数/指数/绝对值/复合函数；附 `expressionToString` 把 AST 渲染回可重新解析的文本 | `derivative.test.ts` (15) |
| 代数命令扩展 | `src/kernel/algebra/EquationRecognizer.ts` | 新增 `Intersection` / `Midpoint` / `Circle(A,r)` / `Circle(A,B,C)` / `PointOnLine` / `Distance` / `Slope` / `Vector(u,v)` / `Derivative` / `Root` / `Extremum` / `Integral`；参数切分改为只切顶层逗号；`A = (1, 2)` 坐标元组定义式已可达 | `algebra-commands.test.ts` (29) |
| 导函数 | `src/kernel/algo/AlgoDerivative.ts` | 对 `AlgoDependentFunction` 求导并生成新的 `GeoFunction`；滑块驱动时通过 `setScope` 传导到导函数 | 见 `algebra-commands.test.ts` |

### 1.1 采样策略细节

`GeoFunction.updateSamples(minX, maxX, pixelWidth, viewBounds?)`：

1. **均匀基采样** —— `pixelWidth / 2` 个点，下限 64、上限 1200。
2. **自适应细分** —— 对相邻两点，若弦中点与真实中点偏差 `> viewHeight * 0.02` 则递归二分，最多 4 层，全局预算 4096 点。
3. **渐近线断点** —— 相邻采样值异号且峰值 `> viewHeight * 4` 时插入 NaN 断点，避免把垂直渐近线两端连成假竖线。
4. **无截断** —— 只把「无定义」（NaN/Inf）写成 NaN。`x^10` 在 x=4 得 1048576 会原样保留，交给画布裁剪。

`viewHeight` 来自 `viewBounds`（可视区 y 范围），缺省时回退 `DEFAULT_VIEW_HEIGHT = 20`。
**已接通**：`drawHelpers.drawFunction()` 现在把 `DrawBounds`（已含 `minY/maxY`）作为 `viewBounds` 传入，
渲染路径不再使用默认视高。采样缓存键含 `viewHeight`，纵向平移因视高不变而不会误失效，放大/缩小则正常重采样。

### 1.2 圆锥曲线取点细节

旧实现 `AlgoPointOnConic` 用 `center + radius * (cos t, sin t)`，**只对有半径的圆成立**。
椭圆/双曲线/抛物线会被算到曲线外的错误位置，而 `isOnPath()` 判定却悄悄失败——用户看到的是「点在物体上」工具造出的悬浮点。

新实现：

- `rayIntersections(theta, h, k)` —— 把射线 `(h + t·cosθ, k + t·sinθ)` 代入
  `A x² + B xy + C y² + D x + E y + F = 0`，解一元二次，返回所有 `t > 1e-6` 的实根。
- `pointAtAngle(theta)` —— 锚点按类型选（抛物线用顶点，其余用中心），取最近根；射线未命中返回 `null`。
- `AlgoPointOnConic.compute()` —— 用 `pointAtAngle` 取点；未命中时 `setUndefined()`，
  而不是把点放到错误位置。
- `updateParameter(x, y)` —— 取「锚点 → 鼠标」方向的极角作为参数，与 compute 自洽。

抛物线只有一半方向命中（`y² = 4x` 仅 `cos θ > 0` 时），另一半正确标记为未定义。

### 1.3 数值原语细节

`Numerics.ts` 全部是纯函数，不接触 kernel / 几何对象，便于命令层复用。

- **约定**：被求函数返回 `NaN` 表示该点无定义；算法在无定义处**停止或分段**，绝不跨越。
  因此 `1/(x-2)` 不会被两个分支连成一个假根。
- `findRoots` —— 采样扫符号变化 + 二分细化。
- `findExtrema` —— 用**导函数**的符号变化定位候选，二分精化，再按两侧函数值判 `max`/`min`/`cusp`。
- `integrate` —— 先用 512 点网格扫出函数值**连续有限**的所有子区间（端点与内部奇点统一处理），
  再对每段跑自适应辛普森；`|16·S(h/2) − S(h)| ≤ 15·tol` 接受，否则半容差递归，深度上限 30。

> 奇点处理的关键设计：不是「只在递归中点恰好碰到 NaN 时才切分」（那样奇点必须正好落在某个中点上才生效），
> 而是先扫描分段。`1/(x-1)` 在 `[0,2]` 上给出主值 0；`|1/(x-1)|` 给出两侧之和。

---

## 2. 与 Phase 要求的对应关系

### Phase 2D-2: Function Visualization + Interaction

| 要求 | 状态 |
|---|---|
| R1 自适应采样 | ✅ `GeoFunction.updateSamples` |
| R2 曲线上的点 | ✅ `AlgoPointOnFunction`（前序提交） |
| R3 数值求根 | ✅ 原语已就绪（`findRoots` / `bisect`） |
| R6 `Root(f)` / `Extremum(f)` | ✅ 原语已就绪 |
| R7 `Derivative(f)` | ✅ 原语层面：`findExtrema` 依赖符号导函数 |
| R8 `Integral(f, a, b)` | ✅ 原语已就绪（自适应辛普森） |
| R4 函数样式 / R5 hover 提示 | 见前端部分 |

### Phase 2D-3: Missing Construction Tools

| 要求 | 状态 |
|---|---|
| R6 Point on object（圆/椭圆/双曲线/抛物线） | ✅ 本轮修复（此前只有圆正确） |
| R1–R5 变换工具 | ✅ 前序提交（rotate / dilate / mirror / shear / stretch） |

---

## 3. 明确遗留（按优先级）

1. **`[-10, 10]` 硬编码搜索范围** —— `Root` / `Extremum` 需要可见窗口才能像 GeoGebra
   那样「在视区内搜索」。`parseAlgebraInput` 目前拿不到坐标系，所以提取了命名常量
   `DEFAULT_SEARCH_RANGE = 20`（之前是散落各处的 `-10/10` 字面量），范围可用显式参数覆盖：
   `Root(f, a, b)` 全区间、`Root(f, x0)` 以 x0 为中心的 ±1。正解仍是把可视区注入识别器。
2. **`Text(...)` 命令未实现** —— 内核没有 `GeoText` 元素，因此本轮未接入（而不是静默桩接）。
   实现需同时补元素类与 `GeometryCanvas` 的绘制分支。
3. **`getConicType()` 永不返回 `'degenerate'`** —— 类型声明里有该分支但没有判定逻辑；
   退化圆锥曲线（点、两直线）会按椭圆/双曲线处理。
4. **旋转抛物线的顶点回退为 (0,0)** —— `GeoConic.getVertex()` 对 `B ≠ 0` 的抛物线返回原点，
   采样与取点共用该回退，因此行为至少是自洽的；要做对需要完整的二次曲线分类与旋转变换。
5. **`AlgoSlope` 硬编码标签 `'m'`** —— 连续两次 `Slope(...)` 会得到两个同名的 `m`；
   `AlgoDistance` 原来硬编码用线段序列 `l1…`（已在识别器层覆盖为数字序列 `t1…`），
   同类问题应下沉到算法本身修正。
6. **`Definition` 不支持「标签 = 命令」混合式** —— `l1 = Line(A, B)` 这类 GeoGebra 常见写法
   目前被当成算术表达式，报 `Unknown function "Line"`。支持它需要在定义分支里先尝试命令解析。
7. **`hitScreenObject` 的 scale/eps 契约错配** —— `handlers.ts` 把 `OBJ_EPS / coord.xScale`
   （世界坐标单位）传给了把它当像素尺度用的命中函数，缩放后命中半径成倍偏移。
8. **函数上取点的驱动滑块无标签** —— `handlers.ts` 的 point_on_object 分支构造
   `new GeoNumeric(kernel, x)` 后未赋 `getNextNumericLabel()`，滑块在代数视图里无名。
9. **v1 格式存档无 `outputIndices`** —— 无法重建「派生对象→派生对象」链（如 A、B → M=Midpoint(A,B) → N=Midpoint(A,M)）。
10. **`AlgoDependentFunction` 兜底分支缺失** —— `variableName !== 'x'` 的依赖函数会落到
    `createAlgo`，而后者没有 `AlgoDependentFunction` 分支，导入时报 unknown algorithm type。

---

## 4. 测试清单

| 文件 | 用例数 | 覆盖 |
|---|---|---|
| `function-sampling.test.ts` | 13 | 端点保持、NaN 仅出现在无定义处、高曲率细分、线性函数不过度细分、渐近线断点、普通零点不误断、无截断、缓存失效、视高驱动、零宽区间、采样密度与预算上限 |
| `point-on-conic.test.ts` | 12 | 圆/椭圆/双曲线/抛物线解析取点、旋转圆锥曲线、`samplePoints` 重构回归、非圆圆锥曲线（原 bug）、抛物线全方向扫描、未命中→未定义、参数归一化、点击投影 |
| `numerics.test.ts` | 24 | 二分法、多根、无定义处不造假根、采样点上的根、退化区间、密根、抛物线顶点、三次曲线极大极小、尖点、单调函数无极值、不可导处跳过、去重、多项式/超越函数积分、反向积分号翻转、退化区间、端点无定义收缩、内部奇点主值、奇点两侧求和、非有限端点、细分次数 |
| `derivative.test.ts` | 15 | 常数、幂法则（含 x=0 处退化式）、多项式、乘积法则、商法则、异变量当常数、中心差分交叉验证、三角/对数/指数/根号/绝对值、链式法则、多参函数导数为零、`expressionToString` 往返等价与括号优先级 |
| `algebra-commands.test.ts` | 29 | `Midpoint` / `Distance` / `Slope` / `Vector(分量)` / `Vector(两点)` / `Intersection`（含平行线报错）/ `Circle(A,r)`（含表达式半径与非法半径）/ `Circle(A,B,C)` / `PointOnLine` / `Derivative`（含滑块传导与自由函数）/ `Root`（无区间/区间/起点/无根/滑块）/ `Extremum`（两点与单调）/ `Integral`（定积分/反向/无定义区间）/ 未知函数报错 / 参数个数 / 数字参数解析 |
| `algebra-commands-regression.test.ts` | 18 | 基本点线圆命令、错误路径、内联坐标元组（原 KNOWN BUG）、坐标元组定义式（原 KNOWN BUG） |
| `point-on-function.test.ts` | 11 | 函数上取点、参数同步、`isPointOnFunction` 命中/未命中 |
| `serializer-roundtrip.test.ts` | 16 | v2 序列化往返，含表达式重建与派生链（中点/平行线/垂线） |
| `frontend-logic.test.ts` | 17 | 键盘缩放/平移映射、工具指引文案、上下文菜单行为 |

其余：`algebra.test.ts` (8)、`phase3-algos.test.ts` (36)、`conic-geometry.test.ts` (19)、`shear-stretch.test.ts` (7)、`animation.test.ts` (4)、`point-on-path.test.ts` (3)、`animation-manager.test.ts` (1)。

全套合计：`npx vitest run` → **16 个文件 / 237 项测试全绿**。
运行：`npx vitest run`。类型检查：`npx tsc --noEmit`（零错误）。
