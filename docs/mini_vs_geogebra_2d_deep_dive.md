# MiniGeogebra vs GeoGebra 2D — 算法·约束·交互 深度对比

> 本文是 [`mini_vs_geogebra_2d_diff.md`](./mini_vs_geogebra_2d_diff.md) 的**代码级深挖补充**。
> 原文档做了宏观架构对比（约 17k vs 356k 行），本文聚焦三个维度的**具体实现差异**：
> 算法（8 个具体构造）、约束/依赖机制（5 个机制）、交互实现（8 个机制）。
> 所有结论基于实际代码阅读（`grep` + `read`），引用格式为 `文件路径:类名.方法名`。
> 推断性结论标注 **Inferred**。
>
> 分析日期：2026-09-06

---

## 0. 方法说明

- MiniGeogebra 路径：`/Users/yicaohuang/Downloads/geogebra-like/MiniGeogebra`
- GeoGebra 路径：`/Users/yicaohuang/Downloads/geogebra`（主内核 `source/shared/common/src/main/java/org/geogebra/common/`）
- GeoGebra 的命中检测/拖拽在 GUI 层（`source/web/`、`source/desktop/`），内核只提供元素级判定方法（`isOnPath`、`isPointerChangeable`），GUI 遍历元素做命中——这跟 MiniGeogebra 把命中逻辑放在 `hitTests.ts` 是同类设计，只是分层不同。

---

## 第一部分：构造算法对比

### 1.1 交点（Intersection）

#### MiniGeogebra：`src/kernel/algo/AlgoIntersect.ts`

```
line-line:  det = a1*b2 - a2*b1,  Cramer 解 x,y
line-conic: 代入 y = -(ax+c)/b 或 x = -c/a 到 A x²+Bxy+C y²+Dx+Ey+F=0，解一元二次
conic-conic: 只处理圆——两圆方程相减得 radical axis（直线），再用 line-conic
```

- 预分配 output GeoPoint（line-line 1 个，line/conic 2 个），未定义时 `setUndefined()`
- 线段判定用 `getClassName() === 'GeoSegment' && !isOnPath(p)`——硬编码类名字符串比较（**脆弱**）
- **通用圆锥曲线交点（quartic，4 解）未实现**

#### GeoGebra：`AlgoIntersectLines.java` + `AlgoDispatcher.java`

```
line-line:  GeoVec3D.cross(g, h, S) — 齐次坐标叉积
            然后 isIntersectionPointIncident(S, MIN_PRECISION) 验证点在两条线上
line-conic: AlgoIntersectLineConic（独立类，解析解）
conic-conic: AlgoIntersectConics（完整 quartic 求解，4 解）
```

- 齐次坐标（3 维向量）统一处理平行线、重合线、线段
- 交点后**额外验证** `isIntersectionPointIncident`——对线段尤其重要（交点可能落在延长线上）
- 支持**符号参数**（`SymbolicParametersAlgo`）——可用于几何证明（Recios 方法）
- `AlgoIntersection.java` 实际是**列表集合交集**（找两个 list 的公共元素），不是几何交点——真正的几何交点通过 `AlgoDispatcher` 按类型组合分发

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 线-线求解 | Cramer 行列式 | 齐次坐标叉积 |
| 线段判定 | `getClassName() === 'GeoSegment'` | `isIntersectionPointIncident()` |
| 圆锥-圆锥 | 只处理圆（radical axis） | 完整 quartic（4 解） |
| 分发机制 | if-else | AlgoDispatcher（类型组合分派） |
| 符号参数 | ❌ | ✅（几何证明支持） |

**取舍评价**：MiniGeogebra 的 Cramer 法对线-线足够，但齐次坐标叉积更优雅（平行线 det→0 自然处理）。圆锥-圆锥只处理圆是**明确的功能缺口**——椭圆-椭圆交点（4 解）完全无法计算。线段判定用字符串比较是技术债，应改为 `instanceof` 或 `isSegment()`。

---

### 1.2 点在曲线上（Point on Path）

#### MiniGeogebra：`src/kernel/algo/AlgoPointOnConic.ts` / `src/kernel/algo/AlgoPointOnLine.ts` / `src/kernel/algo/AlgoPointOnFunction.ts`

```
param 语义：conic → 极角 θ (0..2π)；line/segment → t (0..1)；function → x 值
updateParameter(x, y)：从鼠标位置反算 param
  - conic: 锚点(中心/顶点)→鼠标的极角
  - line: 投影到直线的 t
  - function: 采样折线上找最近点
compute()：用 param 直接算坐标
  - conic: rayIntersections(θ, center) → 最近根 → 坐标
  - line: (1-t)*P0 + t*P1
  - function: 采样值直接读
```

- 参数范围隐式，无统一规范化
- 点在路径上靠**坐标匹配**保证（compute 自洽）
- 拖动时 `updateParameter` 从鼠标位置反算，与 compute 一致

#### GeoGebra：`AlgoPointOnPath.java` + `PathNormalizer.java`

```
param 语义：统一用 PathParameter，规范化到 [0, 1]
  PathNormalizer.toParentPathParameter(tn, min, max):
    - 有限区间 [min,max]: linear 映射
    - 无限区间 (-∞,+∞): infFunction(2*tn - 1)  →  z/(1-|z|)
    - 半无限区间: infFunction 单边映射
compute():
  pp.setT(toParentPathParameter(param.getValue(), minParam, maxParam))
  path.pathChanged(P)      // 路径"推送"坐标给点
  P.updateCoords()         // 点更新自身坐标
```

- **统一参数规范化**：`PathNormalizer` 处理有限/无限/半无限区间，`infFunction = z/(1-|z|)` 映射 (-1,1)↔(-∞,+∞)
- 点通过 `path.pathChanged(P)` 接收坐标——路径是坐标的**权威来源**
- 有符号参数支持（`getPolynomials`、`getExactCoordinates`）——可证明"点在直线上"

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 参数语义 | 类型专属（θ / t / x） | 统一 [0,1] 规范化 |
| 无限区间 | 无（conic 总是 0..2π） | `infFunction` 映射 |
| 坐标更新方向 | 点主动算坐标 | 路径推送坐标给点 |
| 符号参数 | ❌ | ✅（几何证明） |
| 拖动反算 | 类型专属 updateParameter | PathNormalizer 反向映射 |

**取舍评价**：GeoGebra 的统一参数规范化是显著优势——直线、抛物线等无限路径用 `infFunction` 优雅映射，MiniGeogebra 对这些路径的参数化是隐式的、类型专属的。MiniGeogebra 的"点主动算坐标"更直观，但拖动画布时可能产生参数跳变（如从 conic 的 θ=π-ε 跳到 θ=π+ε）。**Inferred**：MiniGeogebra 的 locus 采样依赖 `param.getValue()`/`setValue()`，如果能用 PathNormalizer 式统一参数，轨迹算法会更简洁。

---

### 1.3 圆锥曲线（Conic Sections）

#### MiniGeogebra：`src/kernel/geo/GeoConic.ts`

```
模型: A x² + B xy + C y² + D x + E y + F = 0（6 系数）
分类: disc = B²-4AC → ellipse(hyperbola), =0 → parabola, <0 → circle
核心原语: rayIntersections(θ, h, k) — 射线代入二次方程解 t
pointAtAngle(θ): 锚点(中心/顶点) + 最近正根
samplePoints(n): 射线扫描(圆/椭圆/双曲线) / 参数化(抛物线)
```

- 中心/顶点解析公式（标准二次曲线理论）
- `rayIntersections` 是**解析解**，不是采样近似
- 抛物线只有一半方向命中（`y²=4x` 仅 cosθ>0）——正确标记未定义
- 采样按极角排序，确保连续

#### GeoGebra：`GeoConicND.java`（4325 行）

```
模型: 同样的 6 系数 + 3x3 矩阵表示 (matrix[0..5])
分类: type 字段 → CONIC_CIRCLE, CONIC_ELLIPSE, CONIC_HYPERBOLA, CONIC_PARABOLA,
      CONIC_DOUBLE_LINE, CONIC_LINE, CONIC_INTERSECTING_LINES, CONIC_PARALLEL_LINES
特征: eigenvecX/eigenvecY + GAffineTransform（特征向量坐标系变换）
参数: getMinParameter()/getMaxParameter() 按类型:
      circle/ellipse → [0, π]; hyperbola/parabola/line → [-∞, +∞]
pathChanged(coords, pp): 矩阵乘法算梯度 f1 = M * coords
```

- **矩阵表示**：用 3x3 矩阵做代数运算（相乘、求逆、特征分解）
- **特征向量变换**：`eigenvecX/Y` + `GAffineTransform` 把曲线转到主轴坐标系
- **8 种类型**：含退化（双线、相交线、平行线）——MiniGeogebra 只分 5 种
- 参数范围按类型不同（circle/ellipse 是 0..π，不是 0..2π）

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 系数表示 | 6 系数数组 | 6 系数 + 3x3 矩阵 |
| 类型数量 | 5 种（circle/ellipse/hyperbola/parabola/degenerate） | 8 种（+double_line/line/intersecting/parallel） |
| 坐标系变换 | 无（直接在世界坐标算） | 特征向量变换 |
| 取点方法 | rayIntersections（射线求交） | 矩阵乘法 + 参数化 |
| 参数范围 | 统一 0..2π | 按类型（circle: 0..π） |

**取舍评价**：MiniGeogebra 的 `rayIntersections` 是简洁的解析解，适合教学演示。GeoGebra 的矩阵表示支持代数运算（如两圆锥曲线相乘得更高次曲线），特征向量变换支持旋转坐标系下的分析。MiniGeogebra 缺少退化圆锥曲线处理——当 5 点共线时应该报退化，而不是静默失败。**Inferred**：MiniGeogebra 的圆锥曲线模型在"非退化"假设下是正确的，但边界情况（退化、旋转抛物线）处理不完善。

---

### 1.4 轨迹（Locus）

#### MiniGeogebra：`src/kernel/algo/AlgoLocus.ts`

```
输入: driver（受参数约束的动点）, tracer（依赖 driver 的派生点）
过程:
  1. 沿 driver.parentAlgo 链向上找参数源（GeoNumeric 滑块）
  2. 在 [tMin, tMax] 上均匀采样 120 份
  3. 每份: param.setValue(t) → algo.compute() → recomputeDependents(driver) → 记录 tracer
  4. 恢复 driver 原位
  5. 跳跃检测: 中位数步长 × 2.5 阈值 → 分段
输出: GeoLocus（samples[] + segments[]）
```

- 全程 `withBatchedUpdates` 批处理，避免闪烁
- 跳跃检测用**中位数步长**（稳健，不受异常值影响）
- driver 必须是"圆上点/线段上点/直线上点"等受参数约束的点

#### GeoGebra：`GeoLocusND.java`（476 行）+ `AlgoLocusSliderND.java`

```
MAX_PATH_RUNS = 10  — 限制路径追踪轮数
存储: myPointList (ArrayList<MyPoint>)
定位: closestPointIndex / closestPointParameter（最近点追踪）
抽象方法: setChangingPoint, getChangingPointParameter, changingPointDistance
```

- 路径追踪有**轮数限制**（防止无限循环）
- 支持"最近点"查询（用于点定位）
- 抽象类模式，子类实现具体的轨迹算法

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 采样数 | 120 均匀 | 不固定（由算法决定） |
| 跳跃检测 | 中位数步长 × 2.5 | MAX_PATH_RUNS 轮数限制 |
| 最近点定位 | ❌ | ✅（closestPointIndex） |
| 参数源 | parentAlgo 链追溯 | 直接参数滑块 |

**取舍评价**：MiniGeogebra 的中位数跳跃检测比 GeoGebra 的轮数限制更智能——能自动处理轨迹中的不连续（如渐近线附近）。但缺少最近点定位功能，无法回答"轨迹上离此点最近的参数是什么"。

---

### 1.5 切线（Tangent）

#### MiniGeogebra：`src/kernel/algo/AlgoTangent.ts`

```
极线法（对所有圆锥曲线同一个公式）：
  1. isConicDegenerate() → 退化（空集/单点/一对直线）则全部 undefined
  2. |F(P)| ≈ 0 → P 在曲线上，对偶线 dualLine(P) 即切线，输出单条
  3. 否则 dualLine(P) 是切点弦：与圆锥求交得切点 T1, T2
  4. 对每个切点再算一次 dualLine(T) 得切线
  求交无实根 → 无实切线（圆内点 / 双曲线两支之间 / 抛物线开口内侧）
对偶线公式：A x² + B x y + C y² + D x + E y + F = 0，
  点 (u,v) 的对偶线 ax + by + c = 0，
    a = A·u + (B/2)·v + D/2
    b = (B/2)·u + C·v + E/2
    c = (D/2)·u + (E/2)·v + F
纯函数原语在 src/kernel/geo/conicSolve.ts，与 AlgoIntersect 共用。
```

- 切线 = 曲线上点的对偶线；切点 = 外点极线与曲线的交点，两步共用同一个公式
- 输出 2 条切线 + 2 个切点（点在曲线上时退化为 1 对，第二对保持 undefined）
- 圆/椭圆/双曲线/抛物线均支持，含 B≠0 的旋转情形
- 无需判定「点在曲线内还是外」：无实切线自然表现为求交无实根

#### GeoGebra：`AlgoTangentLineND.java`（207 行）

```
抽象类，子类按圆锥曲线类型实现:
  通用方法: diameter approach
    1. 找直径线（过中心，垂直于切线方向）
    2. 直径线与圆锥曲线相交 → 切点
    3. 过切点作切线
  抛物线: updateTangentParabola()（特殊处理）
  checkUndefined(): c.isDegenerate() → 退化无切线
```

- **直径法**：几何构造，适用于所有非退化圆锥曲线
- 抽象类模式，易于扩展
- `getTangentPoint()` 返回切线与切点的对应关系

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 适用范围 | 所有圆锥曲线 | 所有圆锥曲线 |
| 方法 | 极线法（对偶线求交，纯代数） | 几何构造（直径法） |
| 抽象化 | 具体类 + 共享纯函数模块 | 抽象类 + 子类 |
| 类型分支 | 无（统一公式） | 有（抛物线另走 updateTangentParabola） |
| 退化处理 | isConicDegenerate() → undefined | isDegenerate() → undefined |
| 内外判定 | 不判定（无实根自然表现） | 显式 checkUndefined() |

**取舍评价**：两者对适用范围的覆盖已等价。MiniGeogebra 选极线法是因为它把所有圆锥类型
收斂到同一个公式，省掉了 GeoGebra 那套「按类型分派 + 抛物线特殊分支」的开销；
代价是几何直觉不如直径法直观（直径法可以直接看到切点是怎么被构造出来的）。
旧版 MiniGeogebra 确实只有圆切线（`B=0 且 A=C` 之外的圆锥直接 return），那是本节原先的缺口。

---

### 1.6 函数采样（Function Sampling）

#### MiniGeogebra：`src/kernel/geo/GeoFunction.ts`（`updateSamples` 方法）

```
策略: 均匀基采样 → 弦中点偏差递归细分 → 渐近线断点
1. 基采样: pixelWidth/2 点, 下限 64, 上限 1200
2. 自适应细分: 弦中点 vs 真实中点偏差 > viewHeight*0.02 → 递归二分, 最多 4 层, 全局 4096
3. 渐近线断点: 相邻值异号且峰值 > viewHeight*4 → 插 NaN
4. 无截断: 只把 NaN/Inf 写成 NaN, x^10 在 x=4 得 1048576 原样保留
```

- 纯数值，无符号表示
- 自适应细分基于**弦中点偏差**——几何直观，比固定步长好
- 渐近线检测基于**符号变化 + 峰值**——比 GeoGebra 的视觉化器更精确

#### GeoGebra：`GeoFunction.java`（2954 行）+ 外部视觉化器

```
表示: Function fun（Giac CAS）— 有符号表示
采样: 不在 GeoFunction 内，由独立的 visualizer 处理
  - FunctionVisualizer / surfaceEvaluables
  - 采样密度由视图层决定
```

- 底层是 Giac CAS——函数有符号表达式，可做符号微分/积分/求根
- 采样策略在 visualizer 层，不在 GeoFunction
- 支持 `isBooleanFunction`、`includesFreehandOrDataFunction` 等特殊类型

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 表示 | 数值采样 | Giac CAS 符号表达式 |
| 采样策略 | 弦中点偏差递归细分（自研） | 外部 visualizer |
| 渐近线处理 | 符号变化+峰值检测（自研） | visualizer 层处理 |
| 符号操作 | ❌ | ✅（微分/积分/求根） |
| 采样预算 | 4096 点上限 | 由视图决定 |

**取舍评价**：MiniGeogebra 的自适应采样策略是**显著优势**——弦中点偏差递归细分比固定步长更精确，渐近线检测比 GeoGebra visualizer 的固定阈值更智能。**Inferred**：这可能是因为 GeoGebra 的 CAS 表示可以直接求导，不需要自适应采样来保证质量。但 MiniGeogebra 的纯数值方案在可视化质量上可能更好。

---

### 1.7 数值分析（Numerics）

#### MiniGeogebra：`src/kernel/algebra/Numerics.ts`

```
bisect: 二分法
findRoots: 采样扫符号变化 + 二分细化
findExtrema: 导函数符号变化 → 二分 → 按两侧值判 max/min/cusp
integrate: 512 点网格扫连续有限区间 → 每段自适应辛普森
          |16·S(h/2) - S(h)| ≤ 15·tol 接受, 否则半容差递归, 深度 30
奇点处理: 先扫描分段, 绝不跨越 NaN/Inf
```

- 纯函数，不接触 kernel
- 奇点处理关键：先扫描分段（不是在中点恰好碰到 NaN 才切分）
- `1/(x-1)` 在 [0,2] 上给出主值 0；`|1/(x-1)|` 给出两侧之和

#### GeoGebra

```
基于 Giac CAS:
  - 符号求根: Solve()
  - 符号积分: Integrate()
  - 符号微分: Derivative()
  - 数值积分: 自适应四阶法
```

- 符号 + 数值双重支持
- 通过 CAS 接口统一调用
- 更强大但更重（Giac 是外部依赖）

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 实现 | 自研纯函数 | Giac CAS |
| 符号求解 | ❌ | ✅ |
| 数值积分 | 自适应辛普森 | 自适应四阶 |
| 奇点处理 | 预扫描分段 | CAS 处理 |
| 依赖 | 无 | Giac（外部） |

**取舍评价**：MiniGeogebra 的数值积分（自适应辛普森 + 奇点预扫描）质量高，适合教学演示。符号求解是明确缺口——但引入 Giac 成本高（外部 Java 库），不建议直接对齐。

---

### 1.8 度量（Measurement）

#### MiniGeogebra：`src/kernel/algo/AlgoDistance.ts` / `src/kernel/algo/AlgoAngle.ts` / `src/kernel/algo/AlgoArea.ts` / `src/kernel/algo/AlgoSlope.ts`

```
Distance: |P1-P2| 欧氏距离
Angle: 两条线之间的角度（有向/无向需确认）
Area: 多边形鞋带公式
Slope: 直线 a·x+b·y+c=0 → 斜率 = -a/b
```

- 简单直接，标准公式

#### GeoGebra

```
Distance: 同（AlgoDistance.java）
Angle: 支持有向/无向、多种度量（角度/弧度/度分秒）
Area: 多边形面积 + 区域面积
Slope: 同
```

- 更丰富的度量类型
- 角度度量支持多种单位

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 角度单位 | 单一（需确认） | 角度/弧度/度分秒 |
| 区域面积 | ❌ | ✅ |
| 有向/无向 | 需确认 | 明确支持 |

---

### 算法维度总结表

| 算法 | 等价程度 | MiniGeogebra 优势 | MiniGeogebra 缺口 |
|---|---|---|---|
| 线-线交点 | ✅ 等价 | — | 线段判定用字符串比较 |
| 线-圆锥交点 | ✅ 等价 | — | — |
| 圆锥-圆锥交点 | ❌ 缺失 | — | 只处理圆，缺 quartic |
| 点在曲线上 | 🟡 部分 | rayIntersections 解析解 | 无统一参数规范化 |
| 圆锥曲线模型 | 🟡 部分 | 简洁 6 系数 | 缺矩阵表示、退化类型 |
| 轨迹 | ✅ 等价 | 中位数跳跃检测 | 缺最近点定位 |
| 切线 | ✅ 等价 | 极线法统一公式，无类型分支 | — |
| 函数采样 | ✅ 等价+ | 自适应采样+渐近线检测 | 无符号表示 |
| 数值积分 | 🟡 部分 | 奇点预扫描分段 | 无符号求解 |
| 度量 | 🟡 部分 | — | 缺角度单位、区域面积 |

---

## 第二部分：约束与依赖机制对比

### 2.1 依赖图与更新传播

#### MiniGeogebra：`src/kernel/core/Construction.ts` + `src/kernel/core/Kernel.ts`

```
Construction:
  forwardDeps: Map<ConstructionElement, Set<AlgoElement>>  — 显式正向依赖图
  getForwardDependentAlgorithms(el): BFS 查询增量影响范围 O(受影响边数)
  isDependentOn(algo, target): 递归 — ⚠️ 无环检测，循环会栈溢出
  deleteElementWithDependents(target): 级联删除（constIndex 逆序）
  collectDeletionCascade(target): 收集级联集合（不实际删除，供 undo 快照）

Kernel:
  notifyUpdate(el): 独立元素 → pendingUpdates Set → Promise.resolve().then(flush)
  flushPendingUpdates(): 收集所有依赖 pending 元素的算法 → constIndex 拓扑序 → update()
  flushNow(): 同步版（拖动场景，不能等微任务）
  withBatchedUpdates(fn): 批处理（轨迹采样等干算场景）
  recomputeDependents(el): 同步重算依赖链（正向图快速路径）
```

- **增量更新**：只重算受影响的算法，不是全场
- **微任务批处理**：同一 tick 内多次 notifyUpdate 合并为一次 flush
- **无循环检测**：`isDependentOn` 递归无 visited Set

#### GeoGebra：`Construction.java`（3541 行）+ `GeoElement.java`

```
Construction.updateConstruction(randomize):
  1. 遍历所有独立元素 → ce.update()（自由点）
  2. 随机化（可选）
  3. 遍历所有算法 → algo.initForNearToRelationship() → algo.update()
     - initForNearToRelationship: 让交点保持在保存位置（不跳到另一个解）
     - 特殊处理: AlgoLocusEquation.resetFingerprint, SetRandomValue

GeoElement.updateCascade(dragging):  // 拖拽时的级联更新
  1. kernel.notifyBatchUpdate()
  2. update(dragging)           — 更新自身
  3. updateDependentObjects()   — 更新依赖者
  4. kernel.notifyEndBatchUpdate()

GeoElement.update(dragging):
  updateGeo(mayUpdateCas, dragging)
  maybeUpdateSpecialPoints()
  kernel.notifyUpdate(this)
```

- **全量重算**：`updateConstruction` 遍历所有独立元素 + 所有算法
- **级联更新**：拖拽时用 `updateCascade`，不是全量
- **`initForNearToRelationship`**：关键机制——交点不会在重算时跳到另一个解（保持连续性）
- 特殊处理：轨迹方程、随机值、CAS 单元格

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 初始化更新 | `updateAllAlgorithms()`（全场） | `updateConstruction()`（全场） |
| 拖动更新 | `flushNow()` + 正向图增量 | `updateCascade()` 级联 |
| 更新策略 | 增量（正向图 + 微任务） | 全量（初始化）+ 级联（拖动） |
| 循环检测 | ❌ 无（递归栈溢出） | ✅ 有（ConstructionElementCycle） |
| 交点连续性 | ❌ 无 | ✅ `initForNearToRelationship` |
| 拓扑排序 | constIndex 升序 | algoList 顺序 + initNearTo |
| 批处理 | 微任务级（Promise.then） | notifyBatchUpdate/endBatchUpdate |

**取舍评价**：MiniGeogebra 的增量更新在**小改动场景**（拖动一个点）比 GeoGebra 的全量重算更快。但 GeoGebra 的 `initForNearToRelationship` 是**关键机制**——MiniGeogebra 的交点在依赖重算时可能跳到另一个解（如两圆相交，重算后交点可能跳到对称点）。**Inferred**：MiniGeogebra 缺少这个机制，可能导致交点"跳动"——这是用户体验问题，应优先修复。

---

### 2.2 自由点 vs 依赖点

#### MiniGeogebra：`src/kernel/core/ConstructionElement.ts` + `src/kernel/geo/GeoElement.ts`

```
isIndependent(): parentAlgo == null
  — 无父算法即为独立（自由）
notifyUpdate(el): 只处理独立元素
  — 依赖元素由父算法的 compute() 更新
setCoords(x, y, z): 直接设置坐标
```

- 简单的二元区分：独立（自由）vs 依赖（派生）
- 自由点可以拖动，依赖点不能

#### GeoGebra：`GeoElement.java`

```
isIndependent(): algoParent == null && !correspondingCasCell.hasVariablesOrCommands()
  — 无父算法 且 无 CAS 单元格依赖
isPointerChangeable(): !isLocked() && isIndependent()
  — 未被锁定 且 独立 → 可拖动
isChangeable(): !isProtected(UPDATE) && isIndependent()
  — 未被保护 且 独立 → 可变更
```

- 三元区分：独立、可拖动、可变更
- 考虑 CAS 单元格依赖（函数 `f(x) = a*x` 中的 `a` 是独立的）
- 考虑锁定/保护状态

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 独立判定 | `parentAlgo == null` | 无父算法 且 无 CAS 依赖 |
| 可拖动判定 | ❌（在 handlers.ts 隐式判断） | `!isLocked() && isIndependent()` |
| 可变更判定 | ❌ | `!isProtected() && isIndependent()` |
| 锁定/保护 | ❌ | ✅ |

**取舍评价**：MiniGeogebra 的判定更简单，但缺少锁定/保护概念。GeoGebra 的三元区分（独立/可拖动/可变更）更精确——一个元素可能独立但被锁定（不能拖动），或独立但被保护（不能通过 CAS 修改）。**Inferred**：MiniGeogebra 在拖拽判定中通过 ToolMode + `isIndependent()` 隐式判断，逻辑分散在 handlers.ts 中，不如 GeoGebra 的显式方法清晰。

---

### 2.3 点在对象上的参数化约束

#### MiniGeogebra：`src/kernel/algo/AlgoPointOnConic.ts` / `src/kernel/algo/AlgoPointOnLine.ts` / `src/kernel/algo/AlgoPointOnFunction.ts` / `src/kernel/algo/AlgoPointOnSegment.ts`

```
AlgoPointOnConic.param: 极角 θ (0..2π)
AlgoPointOnLine.param: t (0..1)
AlgoPointOnFunction.param: x 值
AlgoPointOnSegment.param: t (0..1)

updateParameter(x, y): 从鼠标位置反算 param
  conic: atan2(y-k, x-h) → θ
  line: 投影到直线的 t
  function: 采样折线最近点 → x

compute(): 用 param 算坐标（路径推送式或点主动算）
```

- 参数类型专属，无统一接口
- 拖动时 updateParameter 与 compute 自洽

#### GeoGebra：`source/shared/common/src/main/java/org/geogebra/common/kernel/algos/AlgoPointOnPath.java` + `source/shared/common/src/main/java/org/geogebra/common/kernel/PathNormalizer.java`

```
AlgoPointOnPath: 统一 PathParameter
  param ∈ [0, 1] → PathNormalizer.toParentPathParameter(tn, min, max)
  有限区间: linear 映射
  无限区间: infFunction(2*tn - 1) → z/(1-|z|)

Path.pathChanged(P): 路径推送坐标给点
  conic: 矩阵乘法算 f1 = M * coords
  line: 直接参数化
  function: 调用 fun.valueAt(x)
```

- 统一参数规范化（[0,1] → 实际范围）
- 路径是坐标的权威来源（推送式）
- `infFunction` 处理无限区间（直线、抛物线）

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 参数范围 | 类型专属（θ/t/x） | 统一 [0,1] |
| 无限区间 | 无 | infFunction 映射 |
| 坐标更新 | 点主动算 | 路径推送 |
| 反算接口 | 类型专属 updateParameter | PathNormalizer 反向 |

**取舍评价**：GeoGebra 的统一参数是**架构优势**——所有路径共享同一个参数语义，拖拽/动画/轨迹都能统一处理。MiniGeogebra 的类型专属参数导致每个路径类型都要实现自己的 updateParameter，增加维护成本。

---

### 2.4 吸附（Snapping）

#### MiniGeogebra：`src/kernel/core/Snap.ts`

```
calculateGridStep(scale): 目标网格间隔 ~50px → 世界坐标步长
  候选: 10^n × {1, 2, 5}
applySnap(x, y, radius, snapToGrid, snapToPoint, points, gridStep):
  1. 网格吸附: 最近网格点，距离 < radius
  2. 点到点吸附: 遍历所有点，最近点，距离 < radius
  返回: {x, y, type: 'grid'|'point', point?}
```

- 两种吸附：网格 + 点到点
- 阈值：10 像素（SNAP_POINT_RADIUS）
- 简单直接，无状态

#### GeoGebra：`SnapController.java`（159 行）+ GUI 层

```
SnapController（视图平移吸附）:
  State: MAY_SNAP → SNAPPED_VERTICAL/SNAPPED_HORIZONTAL → FREE
  阈值: MOVE_VIEW_THRESHOLD=50, DISTANCE_THRESHOLD=40, INITIAL_DISTANCE_THRESHOLD=5
  角度: ANGLE_OPENING=50°（水平/垂直方向判定）
  用途: 触摸平移时锁定水平/垂直方向

点到点吸附: 在 GUI 层实现，不在内核
```

- SnapController 是**视图平移**的吸附（不是点到网格/点到点）
- 点到点吸附在 GUI 层（具体实现在 web/desktop 代码中）
- 状态机设计：方向锁定 + 阈值判定

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 吸附类型 | 网格 + 点到点 | 视图平移（方向锁定） |
| 实现层 | 内核（Snap.ts） | GUI（SnapController + 点吸附在 GUI） |
| 状态 | 无状态（每次重新计算） | 状态机（MAY_SNAP/SNAPPED/FREE） |
| 阈值 | 固定 10px | 多级阈值（5/40/50px） |

**取舍评价**：MiniGeogebra 的吸附是**功能完备**的（网格+点），GeoGebra 的内核 SnapController 是**视图平移**专用。两者解决不同问题。MiniGeogebra 缺少"线/多边形吸附"（requirements 文档列为 Low 优先级）。**Inferred**：MiniGeogebra 的无状态吸附在缩放变化时可能产生不一致（步长随 scale 变化），但实现简洁。

---

### 2.5 属性系统

#### MiniGeogebra：`src/kernel/geo/GeoElement.ts`

```
直接字段:
  strokeColor: string
  strokeWidth: number
  strokeDash: number[] | null
  fillColor: string | null
  labelVisible: boolean
  labelMode: number
  visible: boolean
```

- 字段直接暴露，类型安全
- 修改直接生效（无需通知）

#### GeoGebra：`GProperty.java` + 属性接口

```
GProperty 枚举: 所有可配置属性（颜色、线宽、标签模式、可见性、层级等）
GeoElementProperties 接口: 运行时属性访问
  getProperty(GProperty) / setProperty(GProperty, value)
```

- 枚举驱动，运行时可访问
- 支持属性变化通知
- 更灵活但更重

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 定义方式 | 直接字段 | GProperty 枚举 + 接口 |
| 运行时访问 | 直接读写 | getProperty/setProperty |
| 类型安全 | ✅ TS 类型 | ❌ 运行时 |
| 变化通知 | ❌（手动） | ✅ 自动 |
| 扩展性 | 加字段 | 加枚举值 |

**取舍评价**：MiniGeogebra 的直接字段方案更简洁、类型安全，适合 React 的声明式编程。GeoGebra 的属性系统更灵活（运行时访问），但维护成本高。**Inferred**：MiniGeogebra 不需要运行时属性访问（属性修改通过 React 组件直接触发），保持直接字段方案是合理取舍。

---

### 2.6 undefined/未定义传播

#### MiniGeogebra：`src/kernel/algo/AlgoElement.ts`

```
update() 管线:
  1. 检查 input 是否全部 defined
  2. 若有 input undefined → 所有 output setUndefined() → 返回
  3. compute()
  4. 通知 output 变化
```

- 确定性传播：input 未定义 → output 全部未定义
- 恢复：input 重新定义 → compute() → output 重新定义

#### GeoGebra：`source/shared/common/src/main/java/org/geogebra/common/kernel/geos/GeoElement.java`

```
setUndefined(): 抽象方法，各子类实现
  更复杂: 处理 CAS 单元格、特殊点、标签等
update(dragging):
  updateGeo() + maybeUpdateSpecialPoints() + kernel.notifyUpdate()
```

- 更复杂的 undefined 处理
- 考虑 CAS 单元格同步
- 特殊点（根、极值）的管理

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 传播策略 | input undefined → output 全 undefined | 子类各自实现 |
| 恢复 | compute() 自动恢复 | 需手动/级联 |
| CAS 同步 | ❌ | ✅ |
| 特殊点管理 | ❌ | ✅（SpecialPointsManager） |

---

### 约束/依赖维度总结表

| 机制 | 等价程度 | MiniGeogebra 优势 | MiniGeogebra 缺口 |
|---|---|---|---|
| 更新传播 | 🟡 不同策略 | 增量更快 | 缺 initForNearToRelationship（交点跳动） |
| 自由/依赖 | 🟡 简化 | 简洁 | 缺锁定/保护/CAS 依赖 |
| 参数化约束 | 🟡 简化 | rayIntersections 解析解 | 缺统一参数规范化 |
| 吸附 | 🟡 不同方向 | 网格+点到点完备 | 缺线/多边形吸附 |
| 属性系统 | 🟡 不同设计 | 类型安全+简洁 | 缺运行时访问 |
| undefined 传播 | ✅ 等价 | 确定性 | 缺 CAS/特殊点管理 |

---

## 第三部分：交互实现对比

### 3.1 工具分发/命令调度

#### MiniGeogebra：`tools/types.ts` + `src/components/tools/handlers.ts`

```
ToolMode: 58 种模式枚举（point/line/segment/circle/intersect/parallel/...）
ToolContext: 注入式上下文
  kernel, construction, coord, elements, selectedElements, mode, mousePos, hoveredPoint,
  setMode, setSelectedElements, setRenderRev, setCoord, addCommand, captureState, undo, redo,
  setBoxSelecting, setBoxStartScreen, setBoxEndScreen, setDraggedElement, toolState
PointerHandler: (ctx, point, screen) => ToolResult | void
```

- 枚举 + 统一处理器，扁平设计
- 状态在 React（ToolContext 注入）
- 工具只负责"创建/变换几何对象"，不负责视图状态

#### GeoGebra：`AlgoDispatcher.java` + `GeoElementSetup`

```
AlgoDispatcher: 命令分发器
  dispatchCommand(commandName, params)
  按类型组合分发到具体算法
GeoElementSetup: 工具行为定义
  工具子类: GeoButton, GeoInputBox, GeoSlider...
EuclidianConstants.MODE_*: 模式常量
```

- 命令模式，可扩展
- 支持宏、条件构造
- 工具定义在 GeoElementSetup

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 分发方式 | 枚举 + 统一处理器 | AlgoDispatcher 命令模式 |
| 工具定义 | ToolMode + handlers.ts | GeoElementSetup 子类 |
| 状态管理 | React（ToolContext 注入） | Kernel + App |
| 扩展方式 | 加枚举 + handler 函数 | 加工具子类 |
| 宏支持 | ❌ | ✅ |

**取舍评价**：MiniGeogebra 的扁平设计适合 React 的声明式编程，工具处理逻辑集中在 handlers.ts。GeoGebra 的命令模式更可扩展（支持宏、条件构造），但复杂度更高。**Inferred**：MiniGeogebra 不需要宏支持（教学场景），扁平设计是合理取舍。

---

### 3.2 命中检测（Hit Testing）

#### MiniGeogebra：`src/components/tools/hitTests.ts`（218 行）

```
阈值: 5/scale（世界坐标，scale = 像素/单位）
优先级: 点优先（10/scale）→ 线段/直线/圆/多边形（5/scale）

hitScreenPoint: 遍历逆序，距离 < 10/scale
hitScreenObject:
  点: 距离 < 10/scale
  线段/射线/折线: isOnPath({getX,getY}, 5/scale)
  直线: |a*x+b*y+c|/√(a²+b²) < 5/scale
  圆/圆锥: |dist-center - radius| < 5/scale
  函数: isPointOnFunction（采样折线最近点 < 5/scale）
  多边形: isInRegionXY（点在多边形内）
  向量: 投影到线段 < 5/scale
  弧/圆锥部分: |dist-center - radius| < 5/scale
```

- 硬编码阈值（5/scale）
- 函数命中走**采样折线**（非解析最近点）
- 逆序遍历（顶层优先）
- 返回元素（不带参数信息）

#### GeoGebra：元素级方法 + GUI 遍历

```
元素级方法（GeoElement 子类）:
  GeoPoint.isAt(P, eps)
  GeoLine.isOnFullLine(P, eps) / isOnPath(P, eps)
  GeoConic.isOnPath(P, eps)
  GeoPolygon.isOnPath(P, eps)
  GeoFunction.isOnPath(P, eps)

GUI 层:
  遍历所有元素 → 调用 isOnPath/isAt → 返回顶层命中元素
  考虑: 可见性、层级、锁定状态
```

- 元素级判定方法（每个元素知道如何判断"点在我身上"）
- GUI 层负责遍历和优先级
- 考虑更多状态（可见性、层级、锁定）

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 实现位置 | hitTests.ts（集中） | 元素级方法 + GUI 遍历（分散） |
| 阈值 | 硬编码 5/scale | 可配置（GUI 层） |
| 函数命中 | 采样折线最近点 | 元素级 isOnPath |
| 状态考虑 | ❌ | ✅（可见性/层级/锁定） |
| 返回信息 | 元素 | 元素（GUI 层处理优先级） |

**取舍评价**：MiniGeogebra 的集中式命中检测更易于调试（所有逻辑在一个文件），但硬编码阈值不灵活。GeoGebra 的元素级方法更可扩展（新元素只需实现 isOnPath），但逻辑分散。**Inferred**：MiniGeogebra 的函数命中走采样折线（非解析）是精度损失——在高分辨率下可能误判。

---

### 3.3 拖拽移动（Dragging）

#### MiniGeogebra：`src/components/tools/handlers.ts`

```
move 工具:
  mousedown:
    1. 命中检测（点优先 → 其他对象）
    2. 点: 选中 + 准备拖拽
    3. 其他对象: 框选
    4. 无命中: 框选
  mousemove:
    1. 拖拽点: 更新坐标 → kernel.notifyUpdate
    2. 框选: 更新 boxEndScreen
  mouseup:
    1. 拖拽: 记录 undo
    2. 框选: 选中文本框内元素
```

- 拖拽逻辑集中在 handlers.ts
- 区分"点对象"vs"移动点"vs"创建"
- 通过 ToolMode 控制行为

#### GeoGebra：`GeoElement.updateCascade()` + GUI 层

```
GeoElement.isPointerChangeable(): !isLocked() && isIndependent()
GeoElement.updateCascade(dragging):
  notifyBatchUpdate → update(dragging) → updateDependentObjects → notifyEndBatchUpdate
GUI 层:
  拖拽开始: 设置 dragging 状态
  拖拽中: 更新坐标 → updateCascade(true)
  拖拽结束: 恢复状态 + 记录 undo
```

- 内核提供 `updateCascade` 级联更新
- GUI 层负责拖拽事件处理
- 考虑锁定/保护状态

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 拖拽逻辑 | handlers.ts（集中） | GUI 层 + updateCascade（分散） |
| 更新方式 | notifyUpdate → 微任务 flush | updateCascade → 同步级联 |
| 锁定检查 | ❌ | ✅（isPointerChangeable） |
| 约束感知 | 隐式（点主动算） | 显式（路径推送） |

**取舍评价**：MiniGeogebra 的拖拽逻辑集中，易于修改。GeoGebra 的 updateCascade 更成熟（考虑锁定/保护/依赖链），但逻辑分散。**Inferred**：MiniGeogebra 缺少 `initForNearToRelationship`，拖拽可能导致交点跳动——这是 GeoGebra 的关键机制。

---

### 3.4 多选/框选（Selection）

#### MiniGeogebra：`ToolContext.selectedElements` + `handlers.ts` + `src/components/ContextMenu.tsx`

```
ToolContext:
  selectedElements: GeoElement[]  — React state
  setSelectedElements: Dispatch<SetStateAction<GeoElement[]>>
  setBoxSelecting / setBoxStartScreen / setBoxEndScreen

handlers.ts:
  move 工具框选: mousedown → mousemove → mouseup
  框选内元素: 遍历 elements → 判断是否在框内 → 选中
  shift-click: 追加选择

ContextMenu.tsx:
  右键菜单: 删除、重命名、显示/隐藏、样式、轨迹开/关
```

- React state 管理选择
- 框选在 handlers.ts
- 上下文菜单在 ContextMenu.tsx

#### GeoGebra：`SelectionManager.java`（内核层）

```
SelectionManager:
  selectedElements: List<GeoElement>
  selectObject / deselectObject / selectAll / deselectAll
  支持: shift-click、rubber band、多选
ContextMenu:
  复杂菜单系统: 删除、重命名、属性、样式、轨迹、约束、导出...
```

- 内核层管理选择（不是 React state）
- 更复杂的选择策略
- 更丰富的上下文菜单

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 选择管理 | React state | 内核 SelectionManager |
| 框选 | handlers.ts | GUI 层 rubber band |
| 上下文菜单 | ContextMenu.tsx（基础） | 复杂菜单系统 |
| 多选策略 | shift-click + 框选 | shift-click + rubber band + 内核管理 |

**取舍评价**：MiniGeogebra 的 React state 方案更简洁，适合前端应用。GeoGebra 的内核管理更成熟（支持宏状态、构造步骤）。**Inferred**：MiniGeogebra 不需要宏/构造步骤，React state 方案是合理取舍。

---

### 3.5 视图控制（Pan/Zoom）

#### MiniGeogebra：`src/kernel/core/CoordinateSystem.ts` + `handlers.ts`

```
CoordinateSystem（不可变值对象，150 行）:
  zoom(factor, centerX, centerY): 返回新实例
  panBy(dx, dy): 返回新实例
  worldToScreenX/Y, screenToWorldX/Y
  gridStepWorld(): 自适应网格步长

handlers.ts:
  pan 工具: mousedown → mousemove → 更新 coord
  zoom_in/out: 按钮点击 → zoom(0.5/2.0)
```

- 不可变坐标系统（每次返回新实例）
- 即时缩放/平移（无动画）
- 网格步长自适应

#### GeoGebra：视图管理器 + 缩放动画

```
GeoViewManager / ZoomManager / PanManager:
  平移缩放实现
  缩放动画（smooth zoom）
  键盘缩放
  触摸屏 pinch
SnapController: 触摸平移方向锁定
```

- 动画缩放（smooth）
- 键盘/触摸支持
- 方向锁定（SnapController）

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 坐标系统 | 不可变值对象 | 可变类 |
| 缩放动画 | ❌（即时） | ✅（smooth） |
| 键盘缩放 | ❌ | ✅ |
| 触摸 pinch | ❌ | ✅ |
| 方向锁定 | ❌ | ✅（SnapController） |

**取舍评价**：MiniGeogebra 的不可变坐标系统更纯函数式，适合 React state。GeoGebra 的动画/触摸支持更成熟。**Inferred**：MiniGeogebra 缺少缩放动画和触摸支持——教学演示场景可能不需要，但移动端使用时会受限。

---

### 3.6 键盘快捷键（Keyboard）

#### MiniGeogebra：`src/components/view/keyboardShortcuts.ts`

```
基础快捷键:
  V: 选择工具
  P: 点工具
  L: 线工具
  C: 圆工具
  Delete: 删除选中
  Ctrl+Z/Y: 撤销/重做
```

- 快捷键列表在 keyboardShortcuts.ts
- 简单绑定

#### GeoGebra

```
完整快捷键系统:
  工具切换（V/P/L/C/...）
  视图操作（Ctrl+=/-/0: 放大/缩小/重置）
  对象操作（Delete/Alt+Delete: 删除/彻底删除）
  选择操作（Ctrl+A: 全选）
  上下文敏感（取决于当前工具/选择）
```

- 更完整的快捷键列表
- 上下文敏感（工具/选择状态影响行为）

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 快捷键数量 | 基础 | 完整 |
| 上下文敏感 | ❌ | ✅ |
| 视图操作 | ❌ | ✅（Ctrl+=/-/0） |

---

### 3.7 鼠标事件状态机（Mouse Event State Machine）

#### MiniGeogebra：`src/components/GeometryCanvas.tsx` + `src/components/tools/handlers.ts`

```
GeometryCanvas.tsx:
  onMouseDown/Move/Up → 分发到 src/components/tools/handlers.ts

handlers.ts:
  按 ToolMode 解释事件
  select/move: 选中、拖拽、框选
  point: 创建点
  line: 点击创建线（2 次点击）
  circle: 点击中心+半径
  ...
  pan: 拖拽平移
  zoom_in/out: 点击缩放
```

- 事件路由在 GeometryCanvas.tsx
- 状态解释在 handlers.ts
- ToolMode 决定行为

#### GeoGebra：GUI 层 + Kernel 状态

```
GUI 层:
  鼠标事件 → 状态机 → 工具行为
  状态: idle / dragging / box_selecting / ...
Kernel 层:
  工具状态、选择状态、构造步骤
```

- 状态机更复杂（idle/dragging/box_selecting/...）
- Kernel 层维护工具状态

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 状态机 | 隐式（ToolMode + handlers） | 显式（状态枚举） |
| 事件路由 | GeometryCanvas → handlers | GUI → 状态机 |
| 状态管理 | React state | Kernel + GUI |

---

### 3.8 撤销/重做（Undo/Redo）

#### MiniGeogebra：`src/hooks/useUndoRedo.ts`

```
React hook, 命令模式:
  addCommand(cmd): 入栈
  undo(): 弹出 → cmd.execute('undo')
  redo(): 弹出 → cmd.execute('redo')
命令类型:
  AddElement / DeleteElement / MoveElement / StyleChange / NumericChange / Rename
```

- 元素级粒度
- React hook 管理
- 命令模式

#### GeoGebra：`Kernel.undo()`/`redo()` + `UndoManager`

```
Kernel:
  undo() / redo() / storeUndoInfo()
UndoManager:
  undoList / redoList
  支持: 构造步骤、宏状态、脚本状态
```

- 完整状态（含宏、脚本、构造步骤）
- 内核层管理
- 更细粒度

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 管理位置 | React hook | Kernel + UndoManager |
| 粒度 | 元素级 | 完整状态（含宏/脚本/步骤） |
| 宏状态 | ❌ | ✅ |
| 构造步骤 | ❌ | ✅ |

**取舍评价**：MiniGeogebra 的命令模式简洁，适合 Web 应用。GeoGebra 的完整状态管理更成熟。**Inferred**：MiniGeogebra 不需要宏/脚本/构造步骤，元素级粒度是合理取舍。

---

### 3.9 Hover/提示（Hover/Tooltip）

#### MiniGeogebra：`src/components/HoverTooltip.tsx` + `src/components/ToolHintBar.tsx`

```
HoverTooltip:
  悬停时显示对象信息（坐标、表达式等）
ToolHintBar:
  工具提示（当前工具的用法说明）
```

- 独立组件
- 显示对象信息 + 工具用法

#### GeoGebra

```
Hover:
  悬停检测 → 显示提示
  更丰富的信息（表达式、属性等）
```

- 更丰富的提示信息
- 与属性系统集成

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 提示内容 | 坐标/表达式 | 坐标/表达式/属性/... |
| 集成度 | 独立组件 | 与属性系统集成 |

---

### 3.10 坐标输入/代数输入（Input）

#### MiniGeogebra：`src/components/AlgebraInputBar.tsx` + `src/kernel/algebra/EquationRecognizer.ts` + `src/kernel/algebra/ExpressionParser.ts`

```
输入格式:
  a = 3 → GeoNumeric
  f(x) = x^2 + 3x - 1 → GeoFunction
  y = 2x + 1 → GeoFunction（无名）
  2x + 3 → GeoFunction（无名）
  Point(2, 3) → 命令
  Line(A, B) → 命令
错误处理: inline error 显示
```

- 基于 EquationRecognizer + ExpressionParser
- 命令 + 表达式识别
- inline error

#### GeoGebra：`source/shared/common/src/main/java/org/geogebra/common/kernel/commands/AlgebraProcessor.java`（3956 行）

```
完整输入系统:
  表达式解析（Giac CAS）
  命令执行（700+ 命令）
  自动补全
  列表/矩阵/条件/函数定义
  脚本支持
```

- 完整 CAS 支持
- 700+ 命令
- 自动补全

#### 差异

| 项 | MiniGeogebra | GeoGebra |
|---|---|---|
| 解析器 | 自研递归下降（165 行） | Giac CAS |
| 命令数 | ~20 个 | 700+ |
| 自动补全 | ❌ | ✅ |
| 脚本支持 | ❌ | ✅ |

**取舍评价**：MiniGeogebra 的输入系统覆盖基础需求（表达式+少量命令），但不支持自动补全和脚本。GeoGebra 的完整系统依赖 Giac CAS。

---

### 交互维度总结表

| 机制 | 等价程度 | MiniGeogebra 优势 | MiniGeogebra 缺口 |
|---|---|---|---|
| 工具分发 | 🟡 不同设计 | 扁平+React | 缺宏/条件构造 |
| 命中检测 | 🟡 不同实现 | 集中式+易调试 | 硬编码阈值、函数命中走采样 |
| 拖拽 | 🟡 不同实现 | 集中式+易修改 | 缺锁定检查、initForNearTo |
| 多选/框选 | 🟡 不同设计 | React state | 缺内核选择管理 |
| 视图控制 | 🟡 不同设计 | 不可变+纯函数 | 缺动画/触摸/键盘缩放 |
| 键盘快捷键 | 🟡 简化 | 简洁 | 缺上下文敏感 |
| 事件状态机 | 🟡 不同设计 | ToolMode 驱动 | 缺显式状态机 |
| 撤销/重做 | 🟡 不同粒度 | 元素级+命令模式 | 缺宏/脚本/步骤状态 |
| Hover/提示 | ✅ 等价 | — | — |
| 代数输入 | ❌ 简化 | 简洁 | 缺 CAS/自动补全/脚本 |

---

## 综合总结

### MiniGeogebra 的差异化优势

| 优势 | 说明 |
|---|---|
| **增量更新** | 正向依赖图 + 微任务批处理，小改动场景比 GeoGebra 全量重算更快 |
| **自适应函数采样** | 弦中点偏差递归细分 + 渐近线断点，比 GeoGebra visualizer 的固定阈值更精确 |
| **数值积分奇点处理** | 预扫描分段，`1/(x-1)` 在 [0,2] 上给出主值 0（GeoGebra CAS 也能做但更重） |
| **不可变坐标系统** | 纯函数式，适合 React state 管理 |
| **3D 渲染（WebGL）** | 60k 行，GeoGebra 2D 项目不含 |
| **SVG 渲染后端** | 可导出 SVG |
| **简洁性** | 17k vs 356k 行，更易理解和维护 |

### MiniGeogebra 的明确缺口（按影响排序）

| 缺口 | 影响 | 建议优先级 |
|---|---|---|
| **圆锥-圆锥交点（quartic）** | 椭圆-椭圆/双曲线交点无法计算 | P0 |
| ~~**椭圆/双曲线/抛物线切线**~~ | ✅ 已修复：`AlgoTangent` 改用极线法，统一公式覆盖所有圆锥类型（新增 `conicSolve.ts` 纯函数模块，切线回归测试 24 例） | ~~P0~~ |
| **initForNearToRelationship** | 拖拽可能导致交点跳动 | P0 |
| ~~**循环依赖检测**~~ | ✅ 已修复：`isDependentOn` 加 visited 剪枝，环上不再栈溢出（依赖环回归测试 7 例） | ~~P0~~ |
| **统一参数规范化** | 点在路径上的参数类型专属，维护成本高 | P1 |
| **矩阵表示 + 退化圆锥曲线** | 5 点共线等退化情况静默失败 | P1 |
| **锁定/保护状态** | 无法阻止用户修改受保护元素 | P1 |
| **完整属性系统** | 缺运行时属性访问 | P1 |
| **缩放动画 + 触摸支持** | 移动端体验受限 | P2 |
| **CAS 集成** | 无法做符号计算 | P2（成本高） |
| **宏/脚本/构造步骤** | 高级功能缺失 | P2（非教学核心） |

### 不建议对齐（MiniGeogebra 的合理取舍）

| 取舍 | 理由 |
|---|---|
| 全量重算 | 增量更新更快，保持 |
| 可变坐标系统 | 不可变值对象更纯函数式，适合 React |
| Java2D 渲染接口 | Canvas2D 风格更现代 |
| XML 序列化 | JSON 更适合 Web |
| 内核选择管理 | React state 更简洁 |
| 命令模式工具分发 | 扁平枚举+处理器更适合 React |
| 完整状态撤销 | 元素级粒度足够教学场景 |

---

## 附录：关键代码引用

### MiniGeogebra

| 文件 | 关键内容 |
|---|---|
| `src/kernel/core/Kernel.ts` | 增量更新、微任务批处理、flushNow、withBatchedUpdates |
| `src/kernel/core/Construction.ts` | forwardDeps 正向图、getForwardDependentAlgorithms、isDependentOn（visited 剪枝防环）、deleteElementWithDependents |
| `src/kernel/algo/AlgoIntersect.ts` | 交点算法（Cramer/radical axis），直线-圆锥求交委托 conicSolve |
| `src/kernel/geo/conicSolve.ts` | 圆锥纯函数原语：solveQuadratic、conicValue、isConicDegenerate、dualLine、intersectLineWithConic |
| `src/kernel/geo/GeoConic.ts` | rayIntersections、pointAtAngle、samplePoints、getConicType |
| `src/kernel/algo/AlgoLocus.ts` | 轨迹采样（120 份、中位数跳跃检测） |
| `src/kernel/algo/AlgoTangent.ts` | 过定点圆锥切线（极线法：对偶线求交得切点） |
| `src/kernel/geo/GeoFunction.ts` | updateSamples（自适应采样） |
| `src/kernel/algebra/Numerics.ts` | bisect/findRoots/findExtrema/integrate |
| `src/kernel/core/Snap.ts` | 网格+点到点吸附 |
| `src/components/tools/hitTests.ts` | 命中检测（硬编码阈值） |
| `src/components/tools/handlers.ts` | 拖拽、框选、工具处理 |

### GeoGebra

| 文件 | 关键内容 |
|---|---|
| `Construction.java` | updateConstruction（全量重算）、initForNearToRelationship |
| `GeoElement.java` | isIndependent、isPointerChangeable、updateCascade、updateDependentObjects |
| `AlgoIntersectLines.java` | 齐次坐标叉积 + isIntersectionPointIncident |
| `AlgoPointOnPath.java` | PathParameter + PathNormalizer |
| `PathNormalizer.java` | infFunction 映射无限区间 |
| `GeoConicND.java` | 矩阵表示、特征向量变换、8 种类型 |
| `AlgoTangentLineND.java` | 直径法（抽象类） |
| `GeoLocusND.java` | MAX_PATH_RUNS、closestPointIndex |
| `GeoFunction.java` | Giac CAS 函数表示 |
| `SnapController.java` | 视图平移方向锁定（状态机） |
| `AlgoDispatcher.java` | 命令分发 |
| `SelectionManager.java` | 内核选择管理 |
| `GProperty.java` | 属性枚举系统 |
