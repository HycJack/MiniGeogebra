# AGENTS.md — MiniGeoGebra 项目设计与架构指南

本文件面向在本仓库中工作的 AI 代理与开发者，说明项目的整体设计、分层架构、核心机制与开发约定。改动代码前请先阅读对应小节，遵循既有模式。

## 项目概览

MiniGeoGebra 是一个仿 GeoGebra 的交互式动态几何绘图系统（2D + 3D），纯前端实现，无后端服务。技术栈：

| 技术 | 用途 |
|-----|------|
| React 19 + TypeScript 5.8 | UI 框架 |
| Vite 6 | 构建与开发服务器（dev 端口 3000） |
| Tailwind CSS 4 | 样式 |
| Vitest 5 | 单元测试 |
| Canvas2D / WebGL2 | 渲染后端 |
| Lucide React / Motion | 图标与 UI 动效 |

## 常用命令

```bash
npm run dev      # 启动开发服务器（端口 3000，host 0.0.0.0）
npm run build    # 生产构建（输出到 dist/）
npm run lint     # TypeScript 类型检查（tsc --noEmit），本项目唯一的 lint 手段
npm test         # 运行全部 Vitest 测试
npm run test:watch
```

注意：`npm run lint` 只是类型检查，没有 ESLint。提交前至少保证 `npm run lint` 和 `npm test` 通过。

## 目录结构

```
src/
├── App.tsx                     # 入口：LanguageProvider 包裹 GeometryCanvas
├── main.tsx
├── components/                 # UI 层（React 组件）
│   ├── GeometryCanvas.tsx      # 2D 视图编排核心（画布、工具状态、undo/redo、命令分发）
│   ├── Geometry3DView.tsx      # 3D 视图编排核心（WebGL 渲染 + 3D 工具）
│   ├── Toolbar / ToolButton / SidePanel / AlgebraInputBar  # 工具栏与代数输入
│   ├── CanvasOverlay / HoverTooltip / ContextMenu / ToolHintBar / SliderControl
│   ├── CanvasValueInput / ConstructionNavBar                # 画布内数值输入浮层 / 构造步骤导航条
│   ├── TraceLayer / labels.ts  # 轨迹层（trace 残影）/ 标签锚点（绘制与命中共用）
│   ├── NavigationCube / Geometry3DToolbar                   # 3D 辅助控件
│   ├── drawHelpers.ts          # 2D 绘制函数（各类 GeoElement 的绘制实现）
│   ├── tools/                  # 交互层
│   │   ├── types.ts            # ToolMode 等工具状态类型（约 60 种工具模式）
│   │   ├── handlers.ts         # 各工具的点击/拖拽处理状态机
│   │   ├── hitTests.ts         # 命中检测（点选、框选、路径拾取）
│   │   └── createElements.ts   # 由工具交互创建内核元素的工厂
│   └── view/keyboardShortcuts.ts
├── hooks/
│   └── useRenderLoop.ts        # RAF 渲染节流：一帧最多绘制一次
├── i18n/
│   └── LanguageContext.tsx     # 中/英双语（t() 函数）
└── kernel/                     # 核心计算引擎（不依赖 React）
    ├── core/                   # Kernel、Construction、AnimationManager、坐标系统、吸附、Options（rounding/角度单位/点捕捉）
    ├── geo/                    # GeoElement 及其所有子类（点/线/圆/圆锥曲线/函数/曲面…，约 29 个文件）
    ├── algebra/                # 表达式解析、方程识别、求导、多项式、数值算法
    ├── algo/                   # AlgoElement 及全部构造算法（约 60 个文件）
    ├── view/                   # 渲染后端（IRenderer 抽象 + Canvas/SVG/WebGL 实现）+ 拾取
    └── persistence/            # ConstructionSerializer（JSON 序列化/反序列化）
docs/                           # 设计文档（与 GeoGebra 的对齐分析、2D/3D 方案等）
src/__tests__/                  # Vitest 测试（按 phase 与主题分组）
```

## 架构总览

```
┌─────────────────────────── UI 层 (React) ───────────────────────────┐
│  GeometryCanvas (2D) / Geometry3DView (3D)                          │
│  Toolbar · AlgebraInputBar · tools/(handlers, hitTests, …)          │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │ notifyUpdate / 回调               │ 读元素状态
┌──────────────▼──────────── Kernel 内核 ─────────▼───────────────────┐
│  Construction（代数依赖 DAG）   AnimationManager（滑块动画）          │
│  geo/ GeoElement*（几何对象）   algo/ AlgoElement*（构造算法）        │
│  algebra/（表达式解析·方程识别·求导） persistence/（序列化）          │
└──────────────┬──────────────────────────────────────────────────────┘
               │ IRenderer 命令流（设备无关绘制指令）
┌──────────────▼──────────────────── 渲染后端 ────────────────────────┐
│  2D: createRenderer() 优先 WebGL2(WebGLRendererFallback) → Canvas2D │
│      回退；SvgRenderer 仅用于导出                                    │
│  3D: WebGL3DRenderer (WebGL2) + RayPicker（射线拾取）               │
└─────────────────────────────────────────────────────────────────────┘
```

关键设计原则：

1. **内核与 UI 解耦**：`kernel/` 目录不 import React，可以脱离组件树直接实例化和测试（`src/__tests__` 中的测试大多直接构造 `Kernel`）。
2. **内核与渲染解耦**：视图层只调用 `IRenderer` 接口（`kernel/view/IRenderer.ts`），不直接操作 Canvas2D/WebGL API，因此同一份几何状态可以在不同后端绘制。
3. **仿 GeoGebra 的三层抽象**：`GeoElement`（几何对象，存状态）× `AlgoElement`（构造算法，无状态计算 + 依赖声明）× `Construction`（依赖图与调度），与 GeoGebra 的 kernel 架构一一对应。

## 核心机制详解

### 1. 依赖图与更新管线（最重要的机制）

- `Construction`（`kernel/core/Construction.ts`）持有全部元素，按 `constIndex`（构造序号）排列，维护**显式正向依赖图** `element → 依赖它的算法集合`。
- `AlgoElement`（`kernel/algo/AlgoElement.ts`）是所有构造算法的基类：子类实现 `setInputOutput()`（声明输入输出）与 `compute()`（重算几何量）。基类 `update()` 统一处理：
  - **undefined 传播**：任一输入未定义（如平行线无交点），所有输出置 undefined 并停止传播；
  - **重入保护**：`compute()` 内部再次触发自身更新时直接忽略，避免无限递归。
- `Kernel.notifyUpdate(element)`（`kernel/core/Kernel.ts`）的更新策略是**微任务级批处理 + 增量重算**：
  - 只有"独立"元素（自由点、数值参数）的变动才进入 `pendingUpdates`，同一事件循环 tick 内合并为一次 flush；
  - flush 时通过正向依赖图收集受影响算法，按 `constIndex` 拓扑序重算——**不做全场重算**；
  - `withBatchedUpdates(fn)` 供算法内部"干算"使用（如轨迹采样时反复挪动驱动点），批内不触发视图回调；
  - `flushNow()` 供拖动等需要"本帧立即重算"的场景同步冲刷；
  - `notifyViewChanged()` 只刷新视图、不做内核重算（动画循环等已自行重算过的调用方使用）。
- 依赖环防护：`Construction.isDependentOn` 用 `visited` 集合剪枝，依赖图出现环时立即终止而非栈溢出（对应 GeoGebra 的 cycle 检测），有 `dependency-cycle.test.ts` 回归。
- 删除元素时 `Construction.collectDeletionCascade` 先收集级联删除集合（供 undo 快照），`deleteElementWithDependents` 再按 `constIndex` 逆序实际删除。

### 2. 几何对象层（geo/）

`GeoElement` 基类提供：标签、可见性、颜色/线型等样式、`isDefined()`、`isIndependent()`、`parentAlgo` 反向指针、`update()`（向下游传播）。子类按几何语义划分：

- 基础：`GeoPoint`、`GeoLine`、`GeoSegment`、`GeoRay`、`GeoVector`、`GeoPolygon`、`GeoPolyLine`、`GeoNumeric`（滑块数值）
- 曲线/圆锥曲线：`GeoConic`（圆/椭圆/双曲线/抛物线统一表示，`conicSolve.ts` 负责方程求解）、`GeoArc`、`GeoConicPart`、`GeoCurve`（参数曲线）、`GeoFunction`（y=f(x)）、`GeoInequality`（不等式区域）、`GeoLocus`（轨迹）
- 其他：`GeoText`（锚定文本）、`GeoList`（列表/集合）、`GeoSurface`（参数曲面）
- 3D：`GeoPoint3D`、`GeoLine3D`、`GeoPlane3D`、`GeoCircle3D`、`GeoQuadric3D`（球/柱/锥）、`GeoConic3D`、`GeoPolyline3D`，统一用 `Coords4`（齐次坐标）与 `GeoVec3D`；`quadricSection.ts` 负责平面×二次曲面的解析截面

### 3. 代数输入（algebra/）

用户在代数输入栏输入的表达式由 `EquationRecognizer.ts` 识别并映射为构造命令，链路是：

`ExpressionParser.ts`（词法/语法 → `ExpressionNode` AST）→ `ExpressionEvaluator.ts`（含变量作用域求值）→ `EquationRecognizer.ts`（识别方程/函数/圆锥曲线/命令）。

`EquationRecognizer` 是一个约 1700 行的大 switch，覆盖约 90+ 命令，典型分组：

- 基础构造：`Point` `Line` `Segment` `Ray` `Circle` `Midpoint` `Intersection` `Polygon` `Vector` `Text`…
- 度量/判定：`Distance` `Slope` `Angle` `DirectedAngle` `Area` `AreCollinear` `AreParallel` `ArePerpendicular` `AreConcyclic` `AreCongruent` `IsTangent` `PointIn` `IsInRegion`…
- 函数/微积分：`Derivative` `Root` `Extremum` `Integral` `FitPoly` `TaylorSeries` `Polynomial` `Curvature` `OsculatingCircle` `Tangent`…
- 圆锥曲线属性：`Focus` `Vertex` `Asymptote` `Directrix` `Axes` `Eccentricity` `Parameter` `Radius` `Polar`…
- 三角形中心：`Centroid` `Incenter` `Orthocenter` `Incircle` `Circumcircle`
- 变换：`Rotate` `Dilate` `Mirror`（及 3D 版本 `Translate3D` `Rotate3D` `Mirror3D`）
- 参数曲线/区域：`Curve` `PointOn` `PointIn` `RandomPointIn` `Surface`
- 3D 构造：`Point3D` `Line3D` `Plane3D` `Sphere3D` `Cylinder3D` `Cone3D` `Prism3D` `Pyramid3D` `Volume3D` `Angle3D` `IntersectLinePlane` 等

完整命令清单与实现状态见 `docs/未实现清单.md` 与 `docs/已实现功能与GeoGebra逐项比对.md`；交互惯例/操作习惯的对齐状态见 `docs/UX差距清单.md`。

辅助模块：`Differentiator.ts`（符号求导，支撑 `Derivative` 命令与切线）、`Polynomial.ts`（多项式插值）、`Numerics.ts`（根查找、数值积分等）。

新增代数命令的惯例：在 `EquationRecognizer` 中注册解析分支，算法本体放在 `algo/` 新文件，并经 `kernel/algo/index.ts` 导出。

### 4. 渲染层（kernel/view/）

- `IRenderer.ts`：设备无关渲染接口（setter 式样式 + 方法式路径命令，风格贴近 Canvas2D）。文本通过 `TextItem` 队列，由 WebGL 后端的 overlay 2D canvas 绘制。
- 后端实现：
  - **2D 主路径**：`WebGLRendererFallback.ts` 中的 `createRenderer(canvas, preferWebGL)` 工厂——优先尝试 WebGL2 批量绘制（一帧一次提交 GPU），不可用时自动回退 `CanvasRenderer`（2D Canvas）；调用方通过 `IRenderer` 访问，切换完全透明。
  - `SvgRenderer`：仅用于 SVG 导出。
  - **3D**：`WebGL3DRenderer.ts`（WebGL2 3D 场景，约 1000 行，含透视投影、标准视图、投影模式），由 `Geometry3DView.tsx` 直接实例化。
- 2D 绘制逻辑在 `components/drawHelpers.ts`（每种 GeoElement 一个 draw 函数），由 `GeometryCanvas` 的渲染循环调用；3D 场景组装在 `Geometry3DView.tsx`（把各类 Geo*3D 转为 `Scene3D` 中的 `Line3/Fill3/Point3`）。
- 拾取：2D 命中检测在 `components/tools/hitTests.ts`；3D 用 `view/RayPicker.ts`（射线与平面/线段/包围盒求交，`BoundingBoxHelper.ts` 辅助框选）。
- 渲染节流：`hooks/useRenderLoop.ts` 把 kernel 回调、pointermove、hover 等高频触发收敛到 requestAnimationFrame，一帧最多绘制一次。

### 5. 交互与工具层（components/tools/）

- `ToolMode`（types.ts）枚举所有工具（约 60 种，含基础构造、变换 shear/stretch、动作工具、视图工具等）；`handlers.ts` 实现每个工具的"点击 n 次 → 生成元素"状态机（含预览、吸附、数值输入步骤）。
- 吸附逻辑在 `kernel/core/Snap.ts`（网格步长自适应缩放、吸附到已有点）。
- `GeometryCanvas` 用 `useState` 持有 `Kernel` 实例（`useState(() => new Kernel())`，内核不参与 React 响应式更新；UI 只在需要时通过 `setRenderRev` 强制刷新）。
- 键盘快捷键纯逻辑在 `view/keyboardShortcuts.ts`（`resolveViewKey` 折算缩放/平移/重置，`formatHover` 生成 hover 提示），便于单测。

### 6. 撤销/重做

在 `GeometryCanvas.tsx` 内实现（命令模式 + 快照）：Command 类型有 `add / delete / move / style / numeric / rename`；`move` 类命令通过 `captureState()` 快照所有自由点坐标与数值参数值来回滚。注意：**undo/redo 逻辑目前住在组件里**（`src/hooks/useUndoRedo.ts` 已删除），改动时保持 Command 类型可序列化的语义。

### 7. 动画

`kernel/core/AnimationManager.ts` 管理所有可动画元素（主要是 `GeoNumeric` 滑块）：按 `Animatable` 接口推进数值、限制帧率（2–30fps）、循环/往返模式，每次 tick 通过内核增量重算依赖链后 `notifyViewChanged()` 只刷新视图。约束点（路径点/曲线上点）通过驱动参数滑块实现动画。

### 8. 持久化

`kernel/persistence/ConstructionSerializer.ts` 把构造序列化为 JSON（元素 + 算法 + 依赖关系），支持 `downloadJSON` 导出与反序列化重建（重建时先建 Geo 再建 Algo，最后 `updateAllAlgorithms()` 全场整理一次）。派生函数/数值用表达式重建（expression-based reconstruction）。新增 Algo 时**必须**在 serializer 的 `createAlgo` switch 中注册对应类型，否则保存/加载会丢对象；`serializer-roundtrip.test.ts` 是回归防线。

## 3D 视图说明

- `Geometry3DView.tsx`（约 1200 行）是 3D 模式的编排组件：复用同一个 `Kernel`，把构造中的 2D/3D 元素投影到 WebGL 场景；带独立 3D 工具栏（`Geometry3DToolbar`）、导航方块（`NavigationCube`）、视角切换与投影模式（平行/透视）。
- 3D 构造算法集中在 `algo/Algo3D.ts`（点/线/面基础）、`Algo3DAdvanced.ts`（三点圆、变换、截面）、`AlgoPolyhedron3D.ts`（球柱锥棱柱棱锥、体积、二面角）、`AlgoConic3D.ts`（3D 椭圆/双曲线）、`AlgoPolyhedronNet.ts`（展开图）、`AlgoTransformGeo3D.ts`、`AlgoDependentSurface.ts`。
- 2D/3D 对齐差距与计划见 `docs/未实现清单.md`（C 类为 3D 缺口）。

## 测试

- 框架：Vitest，测试文件在 `src/__tests__/`，直接实例化 `Kernel` 做内核级测试，不依赖 DOM 渲染。当前约 30 个测试文件、430+ 用例。
- 命名分两类：
  - **phase 系列**（对应与 GeoGebra 对齐的迭代阶段）：`phase1-parity`、`phase2-commands`、`phase3-objects`、`phase3-algos`、`phase4-3d`、`phase4-picking`、`phase5-3d`、`phase5-advanced3d`、`phase6-3d`、`phase6-conic3d`、`phase6-net3d`
  - **主题系列**（按功能域）：`tangent`、`conic-geometry`、`locus` 相关、`serializer-roundtrip`、`dependency-cycle`、`geogebra-parity-fixes`、`bugfix-regression`、`algebra-commands`、`algebra-commands-regression`、`function-sampling`、`point-on-*`、`animation`、`animation-manager`、`frontend-logic` 等
- `helpers.ts` 提供公共构造辅助。
- 修改内核行为（尤其是更新管线、undefined 传播、依赖图）时，先跑 `npm test` 确认没有破坏既有回归。

## 开发约定（新增功能时的检查清单）

新增一种构造（工具或代数命令）通常需要：

1. 若需要新几何语义 → 在 `geo/` 新建 `GeoXxx`（继承 `GeoElement`，实现 `getClassName`、绘制所需的几何访问器）。
2. 在 `algo/` 新建 `AlgoXxx`（继承 `AlgoElement`，实现 `setInputOutput()` + `compute()`），并在 `kernel/algo/index.ts` 导出。
3. 在 `EquationRecognizer.ts` 注册命令解析（若可作为代数输入创建）。
4. 渲染：2D 在 `drawHelpers.ts` 加 draw 函数并在 `GeometryCanvas` 渲染循环接线；3D 在 `Geometry3DView.tsx` 场景组装处接线。
5. 命中检测：`tools/hitTests.ts` 加拾取逻辑；交互工具在 `tools/handlers.ts` + `ToolMode` + `Toolbar` 注册。
6. 持久化：在 `ConstructionSerializer` 的 `createAlgo` switch 注册类型。
7. 文案：经 `i18n/LanguageContext` 的 `t()`，不要硬编码中文/英文字符串。
8. 补充测试到 `src/__tests__/`。

代码风格：TypeScript 严格模式、2 空格缩进；现有代码注释以中文为主，讲解"为什么"而非"是什么"——新增注释请保持一致。

## 相关文档

- `docs/已实现功能与GeoGebra逐项比对.md`：**已实现功能与 GeoGebra 官方源码的逐项比对快照**（80 项，✅/🟡/⚠️ 三级判定，2026-09-17；第七节为 2026-10-02 追加的交互层快照）
- `docs/未实现清单.md`：**未实现与待修复清单**（A 类正确性修复 / B 类 2D 缺口 / C 类 3D 缺口 / D 类明确不做），后续实现的 backlog
- `docs/UX差距清单.md`：**交互惯例与元能力差距清单**（2026-10-01 两轮 UX 对齐的完成记录 + E 类剩余 backlog：操作习惯/属性系统/构造管理/对象类型四层）
- `docs/2D-alignment-{requirements,design}.md`：2D 功能与 GeoGebra 对齐的需求与设计基线
- `docs/2D-drawing-animation-{design,plan}.md`：2D 绘制动画方案（plan 中部分条目已实现，见文档内状态标注）
- `docs/3D-grid-axes-design.md`：3D 网格与坐标轴设计（已实现，与代码现状一致）
