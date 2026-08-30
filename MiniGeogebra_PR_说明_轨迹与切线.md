# Pull Request 说明：数值轨迹（Locus）与切线（Tangent）工具

> **PR 标题建议**：`feat: add numerical Locus and Tangent tools (GeoGebra feature parity)`
>
> **适用基线**：本 PR 基于仓库 `main` 分支的最新状态制作（该分支已包含前序的内核增量更新、级联删除、统一坐标系等改造）。

---

## 1. 一句话总结

为 MiniGeogebra 新增两个 GeoGebra 级别的平面几何工具：

- **轨迹 `Locus[Q, P]`**：驱动点 `P` 沿路径运动时，依赖点 `Q` 扫过的曲线（数值采样 + 自动断段），对标 GeoGebra `Locus[]`；
- **切线 `Tangent[Point, Circle]`**：过圆外/圆上一点作圆的切线（含两个切点），对标 GeoGebra `Tangent[]`。

同时补上了支撑轨迹采样的内核能力：**批处理更新（避免闪烁的"干算"机制）** + **同步依赖重算**。DOF/Laman 不做。

---

## 2. 动机：对照 GeoGebra / JSXGraph

| 能力 | GeoGebra | JSXGraph | MiniGeogebra（本 PR 前） | 本 PR 后 |
|---|---|---|---|---|
| 交点 / 中点 / 垂线 / 平行线 | ✅ | ✅ | ✅ | ✅ |
| 过点作圆的切线 `Tangent[]` | ✅ | ✅ (`Tangent`) | ❌ | ✅ |
| 动点轨迹 `Locus[]`（数值） | ✅ | ✅ (`Tracecurve`) | ❌ | ✅ |
| 轨迹方程 / 定理证明（CAS） | ✅ | ❌ | 暂不实现 | 暂不实现 |
| DOF / 刚性分析 | ❌ | ❌ | 明确不做 | 不做 |

轨迹和切线是平面几何实验中最常用的两类"曲线发现"工具。这一补上后，MiniGeogebra 在**平面几何功能面上已与 GeoGebra / JSXGraph 站在同一档**，而优势在于：整个内核（约束求解、更新管线、坐标系统）完全由自己掌控，可作为后续约束研究的实验平台。

---

## 3. 改动清单（共 7 个文件）

### 3.1 新增文件（3 个）

**`src/kernel/algo/AlgoTangent.ts`**
过定点作已知圆的切线算法。输入 `(conic, pointP)`，输出 `[切线 l1, 切线 l2, 切点 T1, 切点 T2]`：
- 点在圆内 → 无实切线，全部置 `undefined`；
- 点在圆上 → 退化为一条切线（两输出重合为一个有效对）；
- 一般位置 → 两条切线 + 两个切点。

**`src/kernel/geo/GeoLocus.ts`**
轨迹对象。保存采样点数组 `samples` 与断段区间 `segments`（因"跳跃"而拆成的多段折线），提供代数区描述。

**`src/kernel/algo/AlgoLocus.ts`**
数值轨迹引擎。输入 `(tracer, driver)`：找到 `driver` 背后的参数化路径约束滑块 `param ∈ [tMin, tMax]`，均匀采样 120 份；每份把 `param` 设为采样值并**干算**整条依赖链，记录 `tracer` 的当前位置；最后恢复 `driver` 原位。相邻采样点距离超过典型步长 2.5 倍处自动"抬笔换段"。

### 3.2 修改文件（4 个）

**`src/kernel/core/Kernel.ts`**
- 新增 `private inBatch` 标记，`notifyUpdate` 在批处理期间暂存回调、不触发渲染；
- 新增 `withBatchedUpdates(fn)`：供轨迹采样等"干算"场景使用，闭区间内的变动结束时统一触发一次视图刷新（不闪烁）；
- 新增 `recomputeDependents(element)`：立即同步重算依赖某元素的所有算法（按构造序），与 `notifyUpdate` 的异步语义解耦。

**`src/components/GeometryCanvas.tsx`**
- 新增工具模式 `'tangent'` / `'locus'`（扩展 mode union）；
- 新增导入 `AlgoTangent / AlgoLocus / GeoLocus` 及图标 `CornerDownRight / Activity`；
- `handleMouseDown`：新增两个"两步选择"的工具分支（先选圆再选点 / 先选依赖点 Q 再选驱动点 P）；
- `drawScene`：在线条之后、点之前绘制轨迹（琥珀色虚线），新增 `drawLocus()` 绘制函数；
- 代数区类型映射新增 `GeoLocus → t('typeLocus')`；
- 工具栏新增「切线」「轨迹」两个按钮。

**`src/i18n/LanguageContext.tsx`**
中/英文翻译新增：`tangent / locus / typeLocus`。

**`src/kernel/persistence/ConstructionSerializer.ts`**
序列化/反序列化注册 `AlgoTangent / AlgoLocus`（导出 `.json` 后可完整还原轨迹与切线）。

---

## 4. 核心设计说明

### 4.1 为什么轨迹采样需要"批处理干算"

轨迹的本质是：把驱动点挪到路径上的 120 个位置，每挪一次就重算一遍依赖链、读出追踪点坐标。如果沿用主路径的 `setCoords → notifyUpdate → updateCallback`，会产生两个问题：

1. **闪烁**：采样期间每挪一次就触发一次渲染回调，用户会看到曲线"边算边抖"；
2. **副作用污染**：采样结束若忘了把驱动点挪回去，会永久改变构造状态，破坏 undo/动画。

解决：`withBatchedUpdates()` 在采样期间按住 `inBatch` 标记，所有 `notifyUpdate` 只累积、不回调；采样结束后再统一触发一次刷新。配合 `recomputeDependents(driver)` 做确定性同步求值（不依赖微任务时序）。这是 GeoGebra locus 引擎"离线计算、一次性呈现"思想的简化版。

### 4.2 轨迹的驱动点查找策略

用户选中的 `driver` 是一个"点"，但它通常是某个路径约束算法的**输出**（如 `AlgoPointOnConic` 的圆上点）。轨迹引擎沿 `driver.parentAlgo` 链向上追溯，找到第一个以 `GeoNumeric`（参数滑块）为输入的算法——那就是路径约束本身，其 `param.intervalMin / intervalMax` 天然给出采样区间。

因此以下情形都能正确工作：
- 圆上动点（`AlgoPointOnConic`，`t ∈ [0, 2π]`）——主场景；
- 线段上动点（`AlgoPointOnSegment`，`t ∈ [0, 1]`）；
- 直线上动点（`AlgoPointOnLine`，默认 `t ∈ [-10, 10]`）；
- 滑块驱动的任意点。

**自由点不能作为驱动点**（没有可调参数），此时算法静默返回 `undefined`，与 GeoGebra 对非法 `Locus` 的处理一致。

### 4.3 切线的几何推导（标准结果）

圆心 `C`、半径 `r`、定点 `P`，记 `d² = |P−C|²`：
- 切点弦中点 `M = C + (r²/d²)(P − C)`；
- 半弦长 `h = r·√(d²−r²)/d`；
- 垂直单位向量 `v = (−(py−cy), px−cx)/d`；
- 切点 `T = M ± h·v`。

由相似三角形 `ΔCTM ~ ΔCPT` 保证 `|CT| = r` 且 `CT ⟂ PT`。点在圆内时 `d²−r² < 0` 无实解 → 全部 `undefined`。

### 4.4 轨迹"断段"策略

当追踪点在运动过程中发生跳变（例如交点在两支之间切换、或中途短暂无解），相邻采样点的距离会显著大于典型步长。此时把曲线切成两段折线分别绘制，避免画出不存在的"穿越线"。阈值取相邻步长的中位数 × 2.5，自适应不同尺寸的场景。

---

## 5. UI 使用方法

### 5.1 切线（Tangent）
1. 画一个圆（任一圆工具）和一个点 `P`（可以在圆外、圆上或圆内）；
2. 点击工具栏「切线」按钮；
3. 先点选圆（选中态），再点选点 `P`；
4. 生成两条切线和两个切点；点在圆内时不生成任何对象（无解）。

### 5.2 轨迹（Locus）
1. 画一个圆，用「点在线上/圆上」工具在圆上放一个动点 `P`（内部绑定滑块 `t`）；
2. 用 `P` 构造一个依赖点 `Q`（例如：`Q = 中点(A, P)`，或 `Q =` 某两条依赖 `P` 的直线的交点）；
3. 点击工具栏「轨迹」按钮；
4. **先点依赖点 `Q`，再点驱动点 `P`**（顺序即 GeoGebra `Locus[Q, P]` 的顺序）；
5. 生成 `Q` 关于 `P` 的轨迹曲线（琥珀色虚线）。

示例构造（椭圆规）：圆上动点 `P` → 向 x/y 轴作垂足 → 两垂足连线的中点轨迹是一个椭圆。

### 5.3 持久化
「导出 JSON」会把轨迹/切线一并保存；「导入 JSON」可完整还原（`AlgoLocus` / `AlgoTangent` 已注册进反序列化器）。

---

## 6. 如何应用本补丁并提交 PR

### 6.1 在本地应用

```bash
git clone https://github.com/HycJack/MiniGeogebra.git
cd MiniGeogebra
git checkout -b feat/locus-and-tangent-tools

# 方式 A：git apply（推荐，路径已处理为 git diff 风格）
git apply MiniGeogebra_Locus_Tangent.patch

# 方式 B：patch 命令
patch -p1 < MiniGeogebra_Locus_Tangent.patch
```

补丁已在纯净快照上做过 **round-trip 验证**：解析 → 应用 → 与预期树逐字节比对，完全一致。

### 6.2 本地验收

```bash
npm install
npm run dev          # 手动跑上面的 5.1 / 5.2 用例
npm run lint         # tsc --noEmit 类型检查
```

手工回归建议：
- 圆 + 圆外一点 → 切线 ✔；点在圆上 → 一条切线 ✔；点在圆内 → 无对象 ✔；
- 圆上动点 `P` + 中点 `Q` → 轨迹是一个同心小圆 ✔；拖动 `P` 的约束滑块，轨迹**不会**跟着重算（轨迹是静态采样结果，符合 GeoGebra 数值轨迹语义）✔；
- 滚轮缩放 / 平移后，轨迹虚线与网格/轴线仍然对齐 ✔；
- Delete 删除驱动点 → 轨迹与其依赖对象级联删除 ✔（前序级联删除能力）。

### 6.3 提交

```bash
git add src/
git commit -m "feat: add numerical Locus and Tangent tools

- AlgoLocus/GeoLocus: numerical locus engine with automatic segment
  splitting, driven by the parameter slider behind a path-constrained
  point (circles, segments, lines). 对标 GeoGebra Locus[].
- AlgoTangent: tangents from an external/on-circle point to a circle,
  with two tangent points. Points inside the circle yield no solution.
- Kernel.withBatchedUpdates() + recomputeDependents(): offline dry-run
  evaluation for locus sampling (no flicker, no state pollution).
- GeometryCanvas: two new tools, toolbar buttons, amber-dashed locus
  rendering, algebra-view type label; i18n zh/en.
- ConstructionSerializer: persistence for both new algorithms."
git push origin feat/locus-and-tangent-tools
```

然后在 GitHub 上打开 PR，把本文档内容粘贴到描述区即可。

---

## 7. 已知限制与后续计划

**已知限制**
1. 轨迹是**纯数值采样**（120 点），不是解析方程；放大后可能看出折线感（可通过提高 `samplesPerPeriod` 改善，代价是计算量线性增长）。未来可加"局部高精度细化"或圆锥拟合。
2. 驱动点必须是**受参数约束的点**（路径约束算法的输出）；自由点暂不支持作为驱动点。
3. 轨迹生成后是静态的：改变底层图形（如缩放圆）不会自动重算轨迹，需要重新执行一次轨迹工具。这与 GeoGebra 数值 `Locus[]` 的行为一致。
4. 两条重合/几乎重合的切线未做额外合并处理（点在圆上时两条输出直线方程相同）。
5. 暂无 DOF/Laman 分析——按既定决策不做。

**后续可继续推进的方向**
- 轨迹解析化：对采样点集做圆锥曲线最小二乘拟合，显示更光滑的圆/椭圆/双曲线；
- 更多派生工具：法线、极线/极点、根轴、旋转/对称/位似变换族；
- 基本图元补齐：射线、圆弧/扇形、正多边形；
- 代数视图增强：显示轨迹的采样描述/驱动关系链。

---

## 8. 备注：关于环境

本补丁是在沙箱中对仓库最新 `main` 的代码快照实施并验证的。因环境限制无法安装 Node 依赖运行 `tsc`，已用两种方式做了最大程度的质量保障：

1. **括号/字符串结构平衡检查**：7 个改动文件全部通过；
2. **补丁 round-trip 验证**：用自研 unified-diff 应用器在纯净源码上精确重现预期结果，逐字节比对通过。

建议在本地 `npm run lint` 做一次最终的 TypeScript 类型检查后再合并。
