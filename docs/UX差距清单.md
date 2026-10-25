# MiniGeoGebra UX 差距清单（交互惯例 × GeoGebra）

> 生成日期：2026-10-01（基于 2026-10-02 代码状态复核）
> 方法：四路并行源码审计——① 本项目 UI 交互层（`src/components/`）；② 本项目内核能力面
> （`src/kernel/`）；③ GeoGebra 官方 2D 交互惯例（`EuclidianController` / `Hits` /
> `GlobalKeyDispatcher` / `ContextMenuGeoElement` / `EuclidianStyleBar` / `LabelType` 等）；
> ④ GeoGebra 命令与工具全集（`Commands.java` 561 条 / `ToolBar.java` 11 组 2D 工具）。
> 参照基准：`/Users/yicaohuang/Downloads/geogebra/source/shared/common/src/main/java/org/geogebra/common/`
> 关联文档：内核数学层面的逐项比对见 [`已实现功能与GeoGebra逐项比对.md`](./已实现功能与GeoGebra逐项比对.md)，
> 正确性/缺失功能 backlog 见 [`未实现清单.md`](./未实现清单.md)。

**结论**：数学内核不是短板；差距集中在三层——**操作习惯层**（交互惯例）、**元能力层**
（GeoElement 属性系统）、**命令面/互操作层**。2026-10-01 已按优先级完成两轮修复
（下表"已完成"），剩余差距作为本清单 backlog 继续跟踪。

---

## 一、已完成（2026-10-01，两轮，全部有回归测试）

### 第一轮（优先级 3/4/5/6/7/10，回归 `ux-parity-round1.test.ts` 26 用例）

| # | 项 | 实现要点 | 主要文件 |
|---|-----|---------|---------|
| 3 | 去 prompt 化 | `CanvasValueInput` 画布内输入浮层替换 8 处 `window.prompt`（圆半径/正多边形边数/rotate/dilate/shear/stretch 系数/定长线段/定角/右键重命名）；工具经 `ctx.requestValue` 挂"继续构造"闭包，异步新建元素自动差分入 undo 栈；Toolbar 死 UI（circle "R=" 框）移除 | `CanvasValueInput.tsx`、`handlers.ts`、`GeometryCanvas.tsx` |
| 4 | 输入栏升级 | 命令补全下拉（命令表 + 对象标签，Tab 接受、↑↓ 选择、Esc 关闭）+ ↑↓ 历史回溯；语法糖 `√` `π` `°` `\|x\|` `sin²(x)` `²` `³`（`preprocessInput` 预处理 + parser 三角幂重组） | `AlgebraInputBar.tsx`、`ExpressionParser.ts`、`EquationRecognizer.ts`（`COMMAND_NAMES`/`commandSignature` 导出） |
| 5 | 命令面补齐 | 24 条文本命令接上既有 Algo：ParallelLine、OrthogonalLine/PerpendicularLine、PerpendicularBisector/LineBisector、AngleBisector/AngularBisector、Ellipse、Hyperbola、Parabola、Conic、Semicircle、Arc、CircularSector、CircumcircularArc/Sector、Compass（点/线段两种半径）、RegularPolygon、Invert、Area、Length（线段/多边形/点）、Perimeter、Reflect（镜点/镜线/反演圆）；新 `AlgoPerimeter` | `EquationRecognizer.ts`、`AlgoPerimeter.ts` |
| 6 | 标签系统对齐 | 官方 `LabelType` 字符表：点 A–Z（**跳过 X/Y**）→ `_n` 下标循环、线 f,g,h…、向量 u,v,w…、圆锥 c,d,e…、数值 a,b,c…、角度希腊字母 α,β…（无 π）、多边形 poly1、函数 f,g,h,p,q,r,s,t；`labelOffset` 标签可拖（绘制/命中共用 `labels.ts` 锚点，拖动入 style undo）；线段/射线/直线/向量/折线/多边形/圆锥/弧默认标签渲染；Ctrl+G/H 显隐对象、Ctrl+Shift+G/H 显隐标签；SidePanel 代数列表 eye 切换（隐藏对象可找回） | `Construction.ts`、`GeoElement.ts`、`labels.ts`、`drawHelpers.ts`、`hitTests.ts` |
| 7 | Options 三件套 | `ViewOptions`：rounding（默认 2 位小数，去尾零）/ 角度单位（度·弧度，角度量代数描述跟随）/ 点捕捉三态（automatic=创建时贴网格、snap_grid=始终贴、off）；格式化接入全部代数描述与坐标轴刻度；随存档落盘；Toolbar 设置弹层 | `kernel/core/Options.ts`、`GeoElement.fmt`、`drawGrid`、`Snap` 接线、`Toolbar.tsx` |
| 10 | 序列化修复 + GeoBoolean | 自由 GeoArc/GeoConicPart（v3 前保存即丢）按圆几何落盘；新 `GeoBoolean` 入内核（值/关联对象显隐联动/序列化/undo），checkbox 工具两阶段（插入 → 点击对象建立联动 → 空白结束）；JSON **v3 → v4** | `ConstructionSerializer.ts`、`GeoBoolean.ts`、`CanvasOverlay.tsx` |

### 第二轮（优先级 1/2/8/9，回归 `ux-parity-round2.test.ts` 14 用例）

| # | 项 | 实现要点 | 主要文件 |
|---|-----|---------|---------|
| 1 | Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y | undo/redo 命令栈本已存在（add/delete/move/style/numeric/boolean/rename 七类命令），补键盘绑定（输入框聚焦跳过） | `GeometryCanvas.tsx` |
| 2 | Move 空白语义 | 空白拖拽 = **平移视图**（位移 < 4px 的"点击"清选区）；Alt+拖拽 / Select 工具 = 框选；Ctrl+空白清选区；右键/中键/Shift 平移保留 | `GeometryCanvas.tsx`、`handlers.ts`（altKey 通道） |
| 8 | 元能力三样 + 右键扩容 | `isFixed`（拖动全路径拦截，删除/样式照常）、`trace`（`TraceLayer`：位置签名 → 屏幕 stamp，每对象上限 150，视口变化/删除自动清理，独立透明画布层）、`layer` 0–9（渲染稳定排序 + `hitOrder` 命中高层优先）；右键菜单 6→10 项（固定/轨迹/上移一层/下移一层/复制对象——复制限自由点/数值）；三者入样式快照/undo/序列化 | `GeoElement.ts`、`TraceLayer.ts`、`hitTests.ts`、`ConstructionSerializer.ts` |
| 9 | zoom-to-fit + 构造导航 | `getElementBounds`（有限对象包围盒；直线/函数不参与取景）+ Maximize 按钮；`ConstructionNavBar`：首/上一步/下一步/末步/播放（0.9s）/暂停/关闭——导航为渲染层过滤（`constIndex ≤ step` 才显示/可命中），不动真实 visible，undo 安全 | `BoundingBoxHelper.ts`、`ConstructionNavBar.tsx` |

---

## 二、剩余差距（backlog，按层分组）

### E1. 操作习惯（交互惯例）

| # | 差距 | GeoGebra 参照 | 备注 |
|---|------|---------------|------|
| E1-1 | 双击对象无行为 | 双击 = 打开重定义/代数就地编辑；双击滑块 = 属性面板（`EuclidianController.handleDoubleClick`） | 依赖内核 redefine（E3-1），可先做"双击滑块开属性" |
| E1-2 | 无循环选择 | 重叠对象重复点击换选（MoveMode NONE 分支）、web 端 Tab 焦点遍历 | 命中已有图层排序，缺"再次点击取次优命中" |
| E1-3 | 多选后不能整体拖动 | `MoveMode.MULTIPLE_OBJECTS` 整体平移 | 拖拽目前只支持单 draggedElement |
| E1-4 | 拖动无 Shift 水平/垂直约束 | 移动时 Shift 锁定轴向 | handlers 拖动分支读修饰键即可 |
| E1-5 | 方向键不能微移选中对象 | 方向键移对象（Shift=0.1×、Ctrl=10×、Alt=100× 步长），无选中才平移视图 | 现在方向键只平移视图 |
| E1-6 | hover 提示仅函数曲线 | 所有对象 hover 高亮 + 定义 tooltip + 光标形态（手型/缩放） | `EuclidianCursor` 枚举 |
| E1-7 | 右键拖动后仍弹菜单 | 右键拖动超过阈值抑制 contextmenu | `handleContextMenu` 判定位移即可 |
| E1-8 | 无 Alt+滚轮缩放加速、缩放无平滑动画 | Alt+滚轮步长 ×1.5；`CoordSystemAnimation` 缓动 | 缓动可用 rAF 插值 |
| E1-9 | 无触摸/pointer 事件 | 官方 web 触摸优先（未命中 3 倍热区重试、双指缩放/平移） | React mouse 事件 → Pointer Events 改造 |
| E1-10 | 3D 视图仍有 prompt | cylinder/cone/prism 的半径/角度/高度输入 | 复用 `CanvasValueInput`（3D 视图坐标换算） |
| E1-11 | labelMode 'mouse' 不生效 | 标签 hover 才显示的模式 | 需要全局 hover 状态接线 |

### E2. 属性系统与样式 UI

| # | 差距 | GeoGebra 参照 | 备注 |
|---|------|---------------|------|
| E2-1 | 无样式条 StyleBar | 选中对象快速改样式；无选中改视图（网格/轴/捕捉），全部自动入 undo | 需 E2-3 的属性面先行 |
| E2-2 | 无属性对话框 | 9 tab：Basic/Text/Slider/Color/Style/Position/Advanced/Algebra/Scripting | 现状为 SidePanel 单页属性 |
| E2-3 | 样式维度缺失 | 点大小/点样式（圆/十字/方/菱形）、填充透明度 alpha、线装饰（箭头/端点）、文本字号/斜体 | 逐项加字段 + 渲染 + 序列化 |
| E2-4 | caption 缺失 | 动态标题（显示为 Name/Name+Value/Value/Caption 四种 labelMode） | labelMode 字段已有 |
| E2-5 | conditionToShow / 动态颜色缺失 | Advanced tab 的显示条件表达式、颜色函数绑定 | 依赖表达式绑定机制 |
| E2-6 | auxiliary / breakpoint / 脚本 | 辅助对象分组、构造协议断点、OnUpdate/OnClick | 脚本在 D 类豁免内 |
| E2-7 | rounding 无"有效数字"模式 | 官方可选 0–15 位小数或 3/5/10/15 位有效数字 | `formatNumber` 只支持小数位 |
| E2-8 | 角度单位不影响 angle_fixed 输入解释 | 输入按当前 angleUnit 解释 | 工具提示文案已写死"度" |

### E3. 构造管理与命令面

| # | 差距 | GeoGebra 参照 | 备注 |
|---|------|---------------|------|
| E3-1 | 无内核级 redefine | 双击/输入栏重定义任意对象（`AlgebraProcessor.processReplace`） | 现仅自由数值/自由点原位更新；A1-6 循环检测随此实现 |
| E3-2 | 无构造协议表视图 | ConstructionProtocol 列 Name/Definition/Description/Caption/Value | 导航条已做（渲染层过滤），表格视图未做 |
| E3-3 | 代数/逻辑/列表命令族缺失 | `Solve/Expand/Factor/Simplify/NSolve`、`If/IsInteger/Defined`、`Sequence/Element/Zip/Sort` 等 27 条列表命令 | GeoList v1 已有，是自然延伸 |
| E3-4 | 微积分补充 | `NDerivative/NIntegral/IntegralBetween/Limit/SolveODE/TurningPoint/RemovableDiscontinuity` | 数值方法已有底子 |
| E3-5 | 向量/矩阵 12 条全缺 | `UnitVector/OrthogonalVector/Determinant/Transpose/…` | 无矩阵对象，单独立项 |
| E3-6 | 角平分线两直线版本 | `AngularBisector(l1, l2)` | 现仅三点版 |

### E4. 对象类型与互操作

| # | 差距 | GeoGebra 参照 | 备注 |
|---|------|---------------|------|
| E4-1 | GeoImage 图片工具 | 两点/角点锚定 + 绝对屏幕定位 | B11 一部分 |
| E4-2 | GeoInputBox 输入框对象 | 绑定数值/文本，代数区联动编辑 | 依赖 E3-1 redefine |
| E4-3 | button 无脚本 | 官方 button 核心价值是 OnClick 脚本（D 类豁免）；无脚本前保持现状 | — |
| E4-4 | 矩阵/复数/n 元函数 | `GeoFunctionNVar`、复数点、矩阵对象 | 单独立项 |
| E4-5 | .ggb 导入不能 | zip + XML 解析 + 命令映射子集 | **读比写优先**（教师手里全是 .ggb）；导出维持 JSON |
| E4-6 | GeoBoolean 无 UI 位置序列化 | 复选框屏幕位置 | UIElement 仍是 React state；随"UI 元素序列化"一并考虑 |

### 缺失工具（官方默认工具栏有、Mini 无）

Attach/Detach（依附/分离点）、Roots/Extremum 点工具、FitLine、极线/共轭直径、RigidPolygon、VectorPolygon、CreateList、**Relation**（关系判断弹窗）、FunctionInspector、**Pen 画笔**（官方笔迹是真几何对象 GeoLocusStroke）、FreehandShape（手绘识别）、**CopyVisualStyle 格式刷**、复数点、zoom 工具的矩形局部放大。

---

## 三、优先级建议（第三批起）

1. **E1-7 + E1-3 + E1-4**（右键拖动抑制菜单、多选整体拖动、Shift 约束）——小改动，日常手感提升明显；
2. **E1-1 + E3-1**（双击重定义 + 内核 redefine）——GeoGebra 的核心交互闭环，工程量中等；
3. **E1-9 Pointer Events 改造**——触摸/平板可用性的前提；
4. **E2-1 样式条**（先做"选中对象"半边，视图半边已有 Options 弹层）——带动 E2-3 的样式维度逐项落地；
5. **E3-3 列表/逻辑命令族**——GeoList 已有，接线成本低于内核功能；
6. **E4-5 .ggb 导入**——互操作最大单点，建议独立立项。

> 维护约定：完成本清单任一条后，把该行标记 ✅ 并注明轮次与回归测试，与
> [`未实现清单.md`](./未实现清单.md) 的"修复进度"块同步累计。
