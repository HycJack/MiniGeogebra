# MiniGeoGebra 已实现功能 × GeoGebra 官方源码 逐项比对报告

> 比对日期：2026-09-17
> 被比对代码：本仓库 `src/kernel/`（30 个测试文件 / 388 用例全绿状态）
> 参照基准：GeoGebra 官方 Java 源码 `/Users/yicaohuang/Downloads/geogebra/source/shared/common/src/main/java/org/geogebra/common/`
> 方法：五组并行代码审查（圆锥曲线 / 数值与函数曲线 / 内核管线与基础构造 / 3D 内核 / 变换·轨迹·序列化），逐项读取两侧实现比对算法与语义。
> 判定图例：✅ 与 GeoGebra 一致 ｜ 🟡 语义一致但为简化子集 ｜ ⚠️ 与 GeoGebra 有行为偏差（详见 [`未实现清单.md`](./未实现清单.md) A 类）

**汇总：80 项中 ✅ 27、🟡 35、⚠️ 18。** 总体结论：数学公式层面质量很高（圆锥曲线属性族、3D 基础层、曲率/密切圆、剪切/拉伸等与官方逐项等价），偏差集中在**数值稳健性分支**（交点标签防抖、容差模型、奇点处理）与**表示模型子集**（退化圆锥、二次曲面类型、多面体拓扑）。

> **⚠️→✅ 修复更新（2026-09-17 第二轮）**：首轮比对发现的 19 处偏差已修复 13 处并通过
> 回归测试（全套 402 用例，`src/__tests__/geogebra-parity-fixes.test.ts`）：
> 交点标签四层防抖、Are* 容差模型与 Ptolemy 共圆、退化圆锥分类、符号无关区域判定、
> 旋转抛物线顶点、发散积分检测、函数值通道找尖点极值、Durand-Kerner 残差/重根、
> 渐近线连续性二分、变换活输入（含 Rotate/Dilate/Mirror 命令与序列化 roundtrip）、
> PointIn 边界夹回、反演别名错误、AlgoSlope 标签。
> 下表保留首轮判定的原始快照；逐项修复详情见 [`未实现清单.md`](./未实现清单.md) A 类状态列。
>
> **2026-09-18 第四轮追加**：A3-1 解析二次曲面截面（新增 `src/kernel/geo/quadricSection.ts`，
> 隐式二次型 + 平面参数化 + 2D 特征分解，对标 `AlgoIntersectPlaneQuadric` 合同变换；平面∥柱轴的
> 两直线与抛物截面显式置 undefined）与 B5 FitPoly 最小二乘（新增 `src/kernel/algo/AlgoFitPoly.ts`，
> 活依赖 + 序列化 roundtrip）已实现。平面×二次曲面一行从 ⚠️ 升级为 ✅（抛物截面除外，待 C2）。

---

## 一、圆锥曲线族（22 项）

| 项目 | Mini 实现 | GeoGebra 参照 | 判定 | 说明 |
|---|---|---|---|---|
| 系数约定 A x²+Bxy+Cy²+Dx+Ey+F=0 | `GeoConic.ts` / `conicSolve.ts` | `GeoConicND` flat matrix | ✅ | Mini 存 B 直系数、建矩阵时除 2，与官方 {A,C,F,B/2,D/2,E/2} 严格等价，全链路无因子 2 隐患 |
| getConicType 分类 | `GeoConic.ts#135` | `GeoConicND.classifyConic` | 🟡 | disc 符号三分类与官方等价；缺 6 种退化型分类（未实现清单 A2-7） |
| 极线 dualLine | `conicSolve.ts` | `GeoConicND.polarLine` | ✅ | 齐次矩阵乘 M·P 逐项一致 |
| isConicDegenerate | `conicSolve.ts#40` | `classifyConic` 退化分支 | ✅ | 同为 det3≈0 判据，含 BDE/4 交叉项，按 mag³ 缩放容差 |
| 定点切线（极线法） | `AlgoTangent.ts` | `AlgoTangentPointND.compute` | ✅ | 官方注释原文即"intersecting the polar line of P with c"；点在曲线上时官方双输出同线、Mini 单输出，语义等价 |
| 直线×圆锥求交 | `conicSolve.ts#intersectLineWithConic` | `AlgoIntersectLineConic` | 🟡 | 同为代入消元解二次；官方多有限路径裁剪与切点加倍（tangent double point） |
| 圆锥×圆锥（Plücker μ 法） | `conicSolve.ts#intersectConicConic` | `AlgoIntersectConics` | 🟡 | 同解 det(M1+tM2)=0 三次方程 + 退化圆锥分解；缺官方 equalSubmatrixS（两圆根轴）与 intersectSpecial 稳健分支，相切/近同心圆边界弱于官方 |
| 退化圆锥分解 | `conicSolve.ts` | `GeoConicND.getLines` | ✅ | 完全平方分解与官方特征分解数学等价 |
| solveCubicReal | `conicSolve.ts` | `EquationSolver.solveCubicS` | ✅ | Cardano/三角法 + 重根；Mini 额外牛顿精化，a≈0 降次行为已复刻 |
| 五点定圆锥 | `AlgoConicFivePoints.ts` | `AlgoConicFivePoints` | 🟡 | 官方用 Braikenridge–Maclaurin 退化圆锥束，Mini 用 5×6 零空间高斯消元——方法不同，同为过五点的唯一圆锥，结果一致 |
| Focus / Vertex / Asymptote / Directrix / Eccentricity / Polar | `AlgoConicProperties.ts` | `AlgoFocus` / `AlgoVertexConic` / `AlgoAsymptote` / `AlgoDirectrix` / `AlgoEccentricity` / `AlgoPolarLine` | ✅ | 公式逐项一致（含抛物线 e=1、准线距 a/e、p=4f 换算）；差异：圆的第二个焦点官方输出圆心、Mini 留 undefined |
| Ellipse/Hyperbola/Parabola 构造 | `AlgoEllipse/Hyperbola/Parabola.ts` | 同名 Algo | ✅ | 由 a、b² 直接装配一般式（B 项含因子 2 已正确计入），抛物线由焦准线定义平方展开 |
| analyzeConic 标准形分析 | `conicSolve.ts` | `classifyConic` / `classifyParabolicConic` | 🟡 | 特征分解/平移旋转等价，抛物线顶点/焦距推导正确；但 `GeoConic.getVertex` 未接入它（旋转抛物线 bug，见 A2-6） |
| 交点标签置换（线圆锥/锥锥） | `AlgoIntersect.matchToPrevious` | `AlgoIntersectConics.setNearTo` | ⚠️ | 贪心最近匹配对标 near-to-heuristic 核心，但缺 age 权重、互最近确认、近重合冻结、持久 perm（见 A1-1） |
| PointOnConic 参数化 | `AlgoPointOnConic.ts` | `GeoConicND.pointChangedUnlimited` | ⚠️ | Mini 用锚点极角射线求交，参数语义与官方（偏心角/cosh-sinh/pt²）不可互换（见 A2-5） |
| isInRegionXY | `GeoConic.ts#145` | region 语义 | ⚠️ | 判定依赖系数符号（整体乘 −1 翻转），官方按有界性与符号无关（见 A2-8） |

## 二、数值分析与函数/曲线（12 项）

| 项目 | Mini 实现 | GeoGebra 参照 | 判定 | 说明 |
|---|---|---|---|---|
| 多项式求根 | `Polynomial.ts` Durand-Kerner | `EquationSolver.laguerreAll`（Laguerre + Brent 抛光 + 残差验收） | 🟡 | 良态多项式结果等价；缺重根保留模式与残差校验（A2-3） |
| 一般函数求根 | `Numerics.findRoots/bisect` | `AlgoRootNewton`（Brent，1e-8/100 iter） | 🟡 | 采样扫符号+二分 vs Brent；窄于采样步长的成对根会漏 |
| 极值（多项式） | `EquationRecognizer` Extremum 分支 | `AlgoExtremumPolynomial` | ✅ | 同为"导数根 + 符号变化过滤"，偶数重驻点两侧都**有意**不报 |
| 极值（非多项式） | `Numerics.findExtrema` | `AlgoExtremumMulti` + `ExtremumFinder` | ⚠️ | 官方用函数值采样对尖点鲁棒；Mini 依赖 f′ 符号，尖点 f′=NaN 漏报（A2-2） |
| 定积分 | `Numerics.integrate` | `AlgoIntegralDefinite`（Legendre-Gauss 3/5 点对跑） | ⚠️ | 同为"双精度对跑+二分"思想；但 Mini 发散积分静默给有限值且 converged=true（A2-1） |
| 符号微分 | `Differentiator.ts` | `AlgoDerivative` fast 路径 | ✅ | 同为 AST 规则微分，0·ln(a) 零消去等安全处理一致 |
| 函数曲线采样 | `GeoFunction.updateSamples` | `CurveSegmentPlotter`（10px + tan10° + 2^16） | 🟡 | 同思想；Mini 阈值宽松一倍（20°）、预算 4096 小于官方（A 类未列，属质量裕度差异） |
| 渐近线断点 | `GeoFunction.breakAtAsymptotes` | `isContinuous` 连续性二分（MAX_JUMP=5） | ⚠️ | 启发式漏不跨零跳跃（A2-4） |
| 参数曲线 | `GeoCurve.ts` | `GeoCurveCartesianND` | ✅ | 构造期符号求导、解析导数、同一套细分准则，结构对标正确 |
| 曲率（带符号） | `AlgoCurveFamily.ts` | `evaluateCurvature` | ✅ | 函数版与曲线版公式逐字对应，符号约定相同 |
| 密切圆 | `AlgoCurveFamily.ts` | `AlgoOsculatingCircle` + `AlgoCurvatureVector` | ✅ | 圆心构造代数恒等 |
| Derivative 算法壳 | `AlgoDerivative.ts` | `AlgoDerivative`（AlgoCasBase） | 🟡 | 构造期固定 + scope 联动思路正确；官方另有任意阶参数与 CAS 后备 |

## 三、内核管线与基础构造（19 项）

| 项目 | Mini 实现 | GeoGebra 参照 | 判定 | 说明 |
|---|---|---|---|---|
| 增量重算（正向依赖图 + 传递 BFS） | `Kernel.recomputeDependents` | `GeoElement.addToUpdateSets` | ✅ | 官方把算法注册进所有传递依赖 geo 的 update set，Mini flush 时做同样传递 BFS——"算法输出作下游输入"的链不会漏 |
| constIndex 构造序 | `Construction.ts` | `getConstructionIndex` + 按构造索引排序更新 | ✅ | 两侧同以构造序≈拓扑序执行 |
| 级联删除 | `deleteElementWithDependents` | `Construction.removeObject` | ✅ | BFS 收集 + 逆构造序删除，语义对齐 |
| 微任务批处理 | `Kernel.notifyUpdate` | `notifyUpdate` + 同步 `updateCascade` | 🟡 | 官方同步级联、batch 只抑制视图；Mini 重算推迟到微任务 flush——flush 前读依赖对象是陈旧值，且**直接 setCoords 派生对象**的路径需调用方自觉补 recomputeDependents（脆弱约定） |
| withBatchedUpdates | `Kernel.ts` | `notifyBatchUpdate` | 🟡 | 官方批模式算法照算只压视图；Mini 连算法更新也累积——作 Locus 干算合理，但语义不同 |
| 显式 forwardDeps | `Construction.ts` | update sets 维护 | 🟡 | 等价的反向索引实现，无官方的向上预传播 |
| undefined 传播 | `AlgoElement.update()` 集中 guard | 各算法自查 + `output.update()` | 🟡 | 方向一致；Mini 集中提前返回更激进，无法表达"部分输入 undefined 仍产出部分定义输出"（交点类算法依赖此灵活性） |
| 重入保护 | `updating` 标志 | `updatedDependentGeos` 标志 | 🟡 | 都防重入；Mini 吞掉整个重入调用，官方只防重复更新下游 |
| 构造期循环检测 | 仅查询时防死循环 | 建边时抛 `CircularDefinitionException` | ⚠️ | 见 A1-6 |
| 线线交点 | `solveLineLine` | `AlgoIntersectLines` | ✅ | 行列式求交一致；相对容差比官方绝对判据更稳健 |
| 线圆锥交点 | `solveLineConic` | `AlgoIntersectLineConic` | 🟡 | 一致；缺切点加倍与 MIN_PRECISION 有限路径检查 |
| AreCollinear | `AlgoTriangleCenters.ts` | `GeoPoint.collinear`（绝对 1e-5） | ⚠️ | Mini 相对 1e-9 严了约 4 个数量级，拖动时判定结果会不同（A1-4） |
| AreParallel / ArePerpendicular | 同上 | `GeoLine.isParallel/isPerpendicular`（绝对 1e-8） | 🟡 | 判据形式等价，容差模型不同 |
| AreConcyclic | 同上 | `GeoPoint.concyclic`（Ptolemy 三式） | ⚠️ | 四点共线官方返回 true、Mini 返回 false——语义反转（A1-5） |
| AreCongruent | 同上 | `GeoSegment.isCongruent` | 🟡 | 长度比较语义一致；官方支持任意同长对象（弧等） |
| 三角形中心族（Centroid/Incenter/Orthocenter/Incircle/Circumcircle） | `AlgoTriangleCenters.ts` | `AlgoIncircle` 等 | ✅ | 公式与退化处理（周长≈0 → undefined）一致 |
| Locus 轨迹 | `AlgoLocus.ts` | `AlgoLocus` + `PathMoverGeneric` | ⚠️ | Mini 固定 120 均匀采样 + 中位跳跃断段；官方自适应变步长 + 无限/周期路径重映射——急弯截角（B 类待实现） |
| GeoElement 基类 | `GeoElement.ts` | `GeoElement.java` | ✅ | update/isDefined/parentAlgo 同构 |

## 四、3D 内核（26 项）

| 项目 | Mini 实现 | GeoGebra 参照 | 判定 | 说明 |
|---|---|---|---|---|
| Coords4 齐次坐标 | `Coords4.ts` | `matrix/Coords.java` | 🟡 | 核心运算等价；缺 crossProduct4/projectPlane 等完整 API |
| GeoPoint3D | `GeoPoint3D.ts` | `GeoPoint3D.java` | 🟡 | 齐次存储+除 w 一致；缺 path/region 依附点 |
| GeoLine3D（1D 坐标系统一表示） | `GeoLine3D.ts` | `GeoCoordSys1D` | 🟡 | origin+方向+参数限界同构；无 CoordSys 矩阵、线段参数不归一 [0,1] |
| GeoPlane3D | `GeoPlane3D.ts` | `GeoPlane3D.java` | 🟡 | n·p=d 等价于 vz+offset；缺完整 CoordSys（面内作图） |
| 三点成面 / 中点 / 点面距离 | `Algo3D.ts` | `AlgoPlaneThreePoints` / `AlgoMidpoint3D` / `AlgoDistancePointPlane3D` | ✅ | 逐句对应（含"不能直接齐次相加"的仿射平均） |
| 线×面交点 | `Algo3D.ts` | `AlgoIntersectCS1D2D` | 🟡 | 公式一致；缺"线在面内"分支（A3-6） |
| 二次曲面表示 | `GeoQuadric3D.ts` | 10 系数矩阵 + `classifyQuadric`（17+ 类） | ⚠️ | Mini 仅 4 种解析型；斜柱/斜锥不受影响，任意二次曲面完全不支持（C1） |
| 线×二次曲面 | `GeoQuadric3D.intersectLine` | `AlgoIntersectLineQuadric3D` | 🟡 | 解二次得 0–2 交点一致；官方区分切线/渐近线 intersectionType |
| 球 / 无限柱 / 无限锥 / 椭球 | `AlgoPolyhedron3D.ts` | `AlgoSpherePointRadius` 等 | 🟡 | 球✅；柱锥缺有限化（端盖/体积，C3）；椭球缺任意定向 |
| 3D 圆（三点） | `GeoCircle3D.ts` | `AlgoCircle3DPoints` | ✅ | 三点定平面+外心，几何一致 |
| 3D 椭圆/双曲线（焦点定义） | `AlgoConic3D.ts` | `AlgoEllipseHyperbolaFociPoint3D` | ✅ | a、b、中心、正交基逐量等价（2D 算法 + 平面提升同思路） |
| GeoConic3D 表示 | `GeoConic3D.ts` | `GeoConic3D extends GeoConicND` | 🟡 | "中心+正交基+半轴"对椭圆/双曲线与官方矩阵+CoordSys 严格等价；缺抛物线与 conic 矩阵（C2），双曲线参数 \|u\|≤4 截断 |
| 平面×二次曲面截线 | `AlgoConic3D.ts` 采样拟合 | `AlgoIntersectPlaneQuadric` 合同变换精确 conic | ⚠️ | 双曲/抛物截面直接 undefined，锥截面半轴有系统偏差（A3-1，**3D 最大语义缺口**） |
| 多面体表示 | `GeoPolyhedron3D` | `GeoPolyhedron` 面/棱拓扑 | ⚠️ | 无拓扑 → 截面/斜棱柱/凹多面体全受限（A3-4，C4） |
| 棱柱 / 棱锥 / 体积 | `AlgoPolyhedron3D.ts` | `AlgoPolyhedronPointsPrism/Pyramid`、`AlgoVolume` | 🟡 | 体积公式一致；棱柱只沿法向挤、底面限 3 点 |
| 线线角 / 二面角 | `AlgoPolyhedron3D.ts` | `AlgoAngleLines3D` / `AlgoAnglePlanes3D` | 🟡 | \|cos\|→acos 等价；官方带 oriented 变体 |
| 平面×多面体截面 | `Algo3DAdvanced.ts` | `AlgoIntersectPlanePolyhedron` | ⚠️ | 仅凸棱柱/棱锥，非凸截面极角排序会错（A3-2） |
| 3D 变换（平移/Rodrigues 旋转/面镜像） | `Algo3DAdvanced.ts` | `TransformTranslate3D` 等 | ✅ | 公式逐项等价；仅支持点（官方任意 3D 对象） |
| 多面体展开图 Net | `AlgoPolyhedronNet.ts` | `AlgoPolyhedronNet.rotate()` | 🟡 | 同为绕棱刚体旋转摊平；缺展开因子动画与 xOy 平面输出（C8） |
| 参数曲面 | `GeoSurface.ts` | `GeoSurfaceCartesian3D` | ✅ | 表达式求值 + 网格采样对应 |

## 五、变换 · 轨迹 · 区域 · 序列化 · 代数输入（18 项）

| 项目 | Mini 实现 | GeoGebra 参照 | 判定 | 说明 |
|---|---|---|---|---|
| 旋转公式（CCW 为正） | `AlgoRotate.rotatePt` | `AlgoRotatePoint` → `GeoPoint.rotate` | ✅ | [cos,−sin;sin,cos] 同构 |
| 旋转/镜像/缩放的输入依赖 | `setInputOutput`（仅 source） | 活 GeoPoint/GeoLine 输入 | ⚠️ | 参数冻结，移动中心/轴不联动（A1-2） |
| 平移 | `AlgoTranslate.ts` | `AlgoTranslate.java` | 🟡 | 公式与活向量一致；输出标签一律点标签 |
| 缩放 Dilate | `AlgoRotate.ts` | `AlgoDilate.java` | ✅ | C + r(P−C) 与系数代入法语义一致 |
| 直线镜像 | `AlgoRotate.mirrorPt` | `AlgoMirror.computeRegardingMirror` | 🟡 | 反射公式正确；轴冻结为构造期常数 |
| 剪切/拉伸 | `shearStretchMatrix` | `AlgoShearOrStretch.compute`（v5 有 CmdShear/CmdStretch） | ✅ | 矩阵元素与 ±Q 平移顺序**逐项一致**——最精确的复刻之一（此前以为是 Mini 自创，实际官方有对应命令） |
| 圆反演 | `invertPt` | `GeoPointND.mirror(GeoConicND)` | 🟡 | 公式相同；缺非圆 conic 真实反演（A3-5）与中心→无穷远映射 |
| PointIn 区域点 | `AlgoRegion.ts` | `AlgoPointInRegion` | 🟡 | 多边形最近边投影与官方一致；圆锥夹回只对圆正确（A3-3） |
| IsInRegion / RandomPointIn | `AlgoRegion.ts` | `AlgoIsInRegion` / `AlgoRandomPointIn*` | 🟡 | 判定语义一致（Mini 输出 1/0 非 Boolean）；随机点圆盘 √u 均匀正确，多边形官方用三角剖分精确均匀 |
| 二元不等式 | `GeoInequality.ts` + 扫描线渲染 | `DrawInequality` + `IneqTree` | ⚠️ | 单条不等式+虚线边界语义一致；无 AND/OR/NOT 集合运算（B6） |
| Locus（亦见第三节） | `AlgoLocus.ts` | `PathMoverGeneric` | ⚠️ | 同第三节判定 |
| 序列化 | `ConstructionSerializer.ts` JSON v2 | XML/.ggb（`ConsElementXMLHandler`） | ⚠️ | "独立元素+算法链+outputIndices" 与 XML replay 同构；能力差距清单见未实现清单 A4 |
| 命令分发 | `COMMAND_ARITY` + switch | `CommandDispatcher` / `CommandProcessor` | 🟡 | arity 检查对应；缺嵌套参数（A1-8）、本地化报错、重定义 |
| Root/Extremum/Integral/TaylorSeries | `EquationRecognizer.ts` | 同名 Cmd | 🟡 | 命令名与语义对齐；Root/Extremum 输出派生点/列表随 f 更新（A1-3 已完成），Integral 只出数值 |

---

## 六、结论与建议

1. **可放心保留的部分**：圆锥曲线属性族全套公式、3D 基础层（Coords4/直线/平面/中点/距离/交点/变换）、曲率/密切圆、剪切拉伸、三角形中心族——与官方逐项等价。
2. **正确性优先修复**（见未实现清单 A 类 Top）：A1-1 交点标签防抖、A2-1 发散积分、A1-2 变换参数冻结、A2-6 旋转抛物线顶点、A3-1 双曲/抛物截面。这五项是用户最可能实际撞上的。
3. **结构性差距**（短期不修、长期立项）：多面体拓扑（A3-4）与二次曲面类型系统（C1）是 3D 一系列限制的共同根因；"依赖图 + 增量更新"模型与 GeoGebra 一致，但派生对象直接 setCoords 的补偿约定（`recomputeDependents` 由 AnimationManager/Locus 自觉调用）需要在代码规范中固化，避免未来改动绕过。
4. 本报告为快照（2026-09-17 代码状态）；后续每完成未实现清单中一项，应同步更新两份文档。
