# MiniGeogebra 绘图与动画：Gap Analysis & 实施计划

> 基于源码逐文件验证，非文档推断。每条目标注状态：✅已实现 / 🔶部分实现 / ❌未实现

## 验证摘要

### ✅ 已实现（不规划）

| 类别 | 项目 | 源码位置 | 验证方式 |
|------|------|----------|----------|
| Phase D 工具 | 14 个全部实现 | `handlers.ts:212-881` | 逐 case 分支确认 |
| 动画类型 | OSCILLATING/INCREASING/DECREASING/INCREASING_ONCE | `GeoNumeric.ts:1-9` | enum 定义 |
| doAnimationStep | 4 种类型含反弹/递减/单次停止 | `GeoNumeric.ts:48-87` | switch 分支完整 |
| 类型选择器 | SliderControl 下拉 | `SliderControl.tsx:103-107` | handleTypeChange |
| 全局停止 | stopAllAnimation 重置到初始值 | `AnimationManager.ts:66-77` | 遍历 animatedGeos 重置 |
| 停止按钮 | SidePanel 已集成 | `SidePanel.tsx:114-120` | 调用 stopAllAnimation |
| 速度控制 | 每滑块独立 speed | `GeoNumeric.ts:19` + `SliderControl.tsx:44-50` | animationSpeed 属性 |
| shear/stretch 输入 | prompt 输入因子值 | `handlers.ts:630-664` | window.prompt 调用 |
| 点在曲线上 | 参数点动画通过 GeoNumeric param 机制 | `createElements.ts:57-88` + `SidePanel.tsx:43-50` | param 动画 → Algo 重算 → 点移动 |

**关键发现：点在曲线上动画已实现**——`createParameterPointOnPath` 创建 GeoNumeric param + AlgoPointOn* + GeoPoint。param 动画时 Algo 自动重算，点沿路径移动。SidePanel 检测到动画中的 param 后，用点的名称标注滑块。右键菜单 `GeometryCanvas.tsx:618` 也支持 GeoNumeric 的 play/pause。shear/stretch 工具已通过 `window.prompt` 支持因子输入。[Inferred]

### 缺失项

| # | 缺失项 | 状态 | 优先级 | 证据 |
|---|--------|------|--------|------|
| 1 | GeoPoint Animatable | ❌ | 高 | `GeoElement.ts:54` `isAnimatable(): false`，GeoPoint 未覆写 |
| 2 | 随机动画 | ❌ | 中 | `grep -r "random" src/` 仅命中测试文件 |
| 3 | 旋转/缩放输入值模式 | 🔶 | 中 | 拖拽交互已实现（`handlers.ts:559-626`），缺 prompt 输入值路径 |
| 4 | 变换 Algo 独立化 | 🔶 | 中 | `handlers.ts:727-790` 用 buildTransformed 内联，非 AlgoElement |
| 5 | 拟合线/图像/画笔等 | ❌ | 低 | Toolbar/handlers 均无对应 mode |

---

## Phase D2：核心补完（高优先级）

### D2-1：GeoPoint Animatable 支持 ❌

**现状证据**：`GeoElement.ts:54` 定义 `isAnimatable(): false`。`GeoPoint` 未覆写此方法。`GeometryCanvas.tsx:618` 右键菜单代码 `if ((hit instanceof GeoNumeric || hit instanceof GeoPoint) && hit.isAnimatable())` 已正确检查，但 GeoPoint 永远返回 false——约束点无法通过右键直接启动动画。用户只能通过找到 GeoNumeric param 来间接控制。

**目标**：约束点（有 parentAlgo 且 input 含 GeoNumeric 的点）可被右键 play/pause 直接动画，行为与 GeoGebra 一致。

**涉及文件**：
- `src/kernel/geo/GeoPoint.ts` — 覆写 `isAnimatable()`，新增 `doAnimationStep()`
- `src/components/GeometryCanvas.tsx:618` — 无需修改（已检查 isAnimatable）
- `src/kernel/core/AnimationManager.ts` — 无需修改（已接受 GeoElement）

**实现要点**：
1. `GeoPoint.isAnimatable()` → 返回 `this.parentAlgo !== null && this.parentAlgo.getInput().some(i => i instanceof GeoNumeric)`
2. `doAnimationStep(frameRate)` → 找到 parentAlgo 的 GeoNumeric input，委托其 `doAnimationStep(frameRate)`，透传返回值
3. 基类 `setAnimating()` 已自动管理 add/remove from AnimationManager，无需改
4. `AnimationManager.stopAllAnimation()` 重置时调用 `geo.setValue(startValue)`——GeoPoint 无 setValue，需添加代理方法或跳过 [Inferred]

**验收标准**：
- 在圆上创建约束点 → 右键 → 播放 → 点沿圆周运动
- 暂停后值冻结，恢复后继续
- 停止动画后点回到初始位置（需验证 stopAllAnimation 对 GeoPoint 的处理）

**测试策略**：扩展 `__tests__/animation.test.ts`，构造 AlgoPointOnConic + 动画参数点，验证 doAnimationStep 驱动点位置变化。

### D2-2：随机动画 ❌

**现状证据**：`grep -rn "random\|Random" src/` 仅命中 `__tests__/frontend-logic.test.ts:54`（测试无关代码）。`GeoNumeric.ts` 无 `randomAnimation` 属性，`doAnimationStep()` 无随机分支，`SliderControl.tsx` 无 checkbox。

**目标**：GeoNumeric 支持"随机跳值"模式——每帧跳到区间内随机值。

**涉及文件**：
- `src/kernel/geo/GeoNumeric.ts` — 新增 `randomAnimation` 布尔属性 + doAnimationStep 分支
- `src/components/SliderControl.tsx` — 新增 "Random" checkbox
- `src/i18n/LanguageContext.tsx` — 新增翻译 key

**实现要点**：
1. `GeoNumeric` 新增 `public randomAnimation: boolean = false`
2. `doAnimationStep()` 在 switch 之前加：`if (this.randomAnimation) { this.setValue(this.intervalMin + Math.random() * (this.intervalMax - this.intervalMin), false); return true; }`
3. `SliderControl` 在类型选择器旁添加 checkbox，勾选时隐藏动画类型下拉框
4. 随机模式与 4 种动画类型互斥

**验收标准**：
- 勾选 Random → 动画切换为随机跳值
- 取消勾选 → 恢复正常动画类型
- Random 勾选时类型选择器隐藏

**测试策略**：`__tests__/animation.test.ts` 新增用例——验证每步返回值在 [min, max] 范围内，且连续 2 次不保证相同。

### D2-3：旋转/缩放输入值模式 🔶

**现状证据**：`handlers.ts:559-626` rotate/dilate 共用一个 case 分支，3-click 拖拽交互已完整实现：
- **rotate**：click1(对象) → click2(中心) → click3(方向点)，用 `Math.atan2` 计算 click3 相对 click2 的极角作为旋转角
- **dilate**：click1(对象) → click2(中心) → click3(距离点)，用 `Math.hypot` 计算 click3 到中心的距离比作为缩放因子

拖拽交互可用，但与 GeoGebra 的差异是：GeoGebra 的 `MODE_ROTATE_BY_ANGLE` 和 `MODE_DILATE_FROM_POINT` 允许用户直接输入角度值/因子值，无需第三击。对比：shear/stretch 工具（`handlers.ts:630-664`）已用 `window.prompt` 支持因子输入。

**目标**：在现有拖拽交互基础上，增加 prompt 输入路径——click2 确定中心后弹出输入框，用户可输入角度/因子值直接创建变换；取消则回退到现有拖拽模式。

**涉及文件**：
- `src/components/tools/handlers.ts:559-626` — rotate/dilate case 分支
- `src/i18n/LanguageContext.tsx` — 新增 `rotateAnglePrompt` / `dilateFactorPrompt` 翻译 key

**实现要点**：
1. rotate: click2 确定中心后，先尝试 `window.prompt(t('rotateAnglePrompt'), '45')`
   - 用户输入有效数值 → 直接用该角度计算变换结果并 return（无第三击）
   - 用户取消 → 设置 `ts.center` 并 return（进入现有 click3 拖拽模式）
2. dilate: 同理，`window.prompt(t('dilateFactorPrompt'), '1.5')`
3. 保留现有 click3 拖拽交互作为 fallback，不改已有逻辑

**验收标准**：
- 旋转工具：选对象+中心 → 弹出角度输入框 → 输入值创建旋转副本（无第三击）
- 缩放工具：选对象+中心 → 弹出因子输入框 → 输入值创建缩放副本
- 取消输入 → 回退到拖拽模式，行为不变
- shear/stretch 行为不变

**测试策略**：集成测试模拟 prompt 返回取消场景，验证回退到 click3 拖拽交互；验证 prompt 返回有效数值时跳过第三击直接创建变换。

---

## Phase D3：UX 完善（中优先级）

### D3-1：变换算法独立化 🔶

**现状证据**：`handlers.ts:727-790` 中 mirror_line/mirror_point/mirror_circle/translate_vector 使用 `buildTransformed()` 直接创建 GeoElement 副本，不创建 AlgoElement。后果：
- 变换结果无 parentAlgo 依赖追踪 → 拖动原对象时副本不跟随
- 无法参与 undo/redo 级联
- 删除原对象时副本不级联删除

`AlgoTranslate.ts` 和 `AlgoRotate.ts`（含 AlgoDilate/AlgoMirror）已存在但未被 handlers 调用。

**涉及文件**：
- 新建 `src/kernel/algo/AlgoMirrorAtPoint.ts`（point reflection = dilate -1）
- 新建 `src/kernel/algo/AlgoMirrorAtLine.ts`
- 新建 `src/kernel/algo/AlgoMirrorAtCircle.ts`（inversion）
- `src/kernel/algo/AlgoTranslate.ts` 已存在，需检查是否在 handlers 中使用
- `src/kernel/algo/AlgoRotate.ts` — AlgoDilate 已存在，需检查
- `src/kernel/algo/index.ts` — 新增导出
- `src/components/tools/handlers.ts:727-790` — 替换 buildTransformed 为 Algo 调用

**实现要点**：
1. 每个新 Algo 继承 AlgoElement，构造器接收 (kernel, inputGeo, axis/center/vector)
2. compute() 调用 buildTransformed 生成输出并 setOutput
3. handlers 用 `new AlgoXxx(kernel, obj, axis)` 替换 `buildTransformed(kernel, obj, op, arg)`，然后 `kernel.getConstruction().addElement(algo)` + `addAlgoAndNotify(algo)`

**验收标准**：
- 变换后拖动原始对象 → 变换副本跟随更新
- 删除原始对象 → 变换副本级联删除
- undo 可恢复变换操作

**测试策略**：验证新 Algo 的 compute 正确性 + 依赖更新行为。

### D3-2：代数视图约束点播放控制 🔶

**现状证据**：SidePanel 代数视图 `SidePanel.tsx:76-95` 仅显示对象名称和代数描述，约束点无 play 按钮。用户需右键画布或找到 GeoNumeric param 才能控制动画。

**涉及文件**：
- `src/components/SidePanel.tsx:76-95` — 代数视图列表项

**实现要点**：
1. 对每个 `el instanceof GeoPoint && el.parentAlgo` 的对象，检查 parentAlgo.getInput() 是否含 GeoNumeric
2. 若有，在列表项右侧显示 ▶/⏸ 按钮
3. 点击调用 `param.setAnimating(!param.isAnimating())` + AnimationManager 启动/停止

**验收标准**：代数视图中约束点显示播放按钮，点击后点开始动画。

### D3-3：多选与框选交互优化 🔶

**现状证据**：`handlers.ts:100-118` move 工具已支持 Shift+click 多选和框选。但缺少：
- 框选时高亮显示选中框范围
- 多选后批量变换（当前 only single-select 能触发 label 编辑）

**涉及文件**：`src/components/GeometryCanvas.tsx` — 框选渲染

**实现要点**：框选时绘制半透明蓝色矩形覆盖选中区域。

---

## Phase D4：低频功能（低优先级）

### D4-1：拟合线 (MODE_FITLINE) ❌

**涉及文件**：新建 `src/kernel/algo/AlgoFitLine.ts` + handlers.ts case + Toolbar 按钮

**实现要点**：最小二乘拟合 y = ax + b。选中 ≥2 个自由点 → 创建拟合直线。Algo 继承 AlgoElement，input 为点数组，compute() 执行线性回归后创建 GeoLine。

### D4-2：插入图像 (MODE_IMAGE) ❌

**涉及文件**：新建 `src/kernel/geo/GeoImage.ts` + handlers.ts case + Toolbar 按钮 + 画布渲染

**实现要点**：文件选择器 → 读取为 data URL → 创建 GeoImage(x, y, scale) → 画布以世界坐标绘制 `<img>` 或 canvas drawImage。需支持缩放/平移/旋转。

### D4-3：画笔 (MODE_PEN) ❌

**涉及文件**：handlers.ts case + Toolbar 按钮 + 画布渲染

**实现要点**：mousedown 开始采集点集 → mousemove 追加顶点 → mouseup 生成 GeoPolyLine。采集过程需防抖（采样间隔 ≥ 2px 屏幕距离）。

### D4-4：自由画形状/函数 (MODE_FREEHAND_*) ❌

**实现要点**：
- Shape: 画笔采集点集 → 最近邻搜索生成最小面积闭合曲线
- Function: 采集点集 → 多项式拟合（numpy.polynomial 或手写最小二乘）

### D4-5：附着/脱离 (MODE_ATTACH_DETACH) ❌

**实现要点**：
- 附着：选中自由点 + 点击路径 → 在路径上找到最近点 → 创建参数点（保留原位置对应的参数值）
- 脱离：选中参数点 → 删除 AlgoPointOn* → 保留点在原位置为自由点

---

## 实施顺序

1. **D2-1 GeoPoint Animatable** — 最高优先级，直接影响动画体验
2. **D2-2 随机动画** — 低实现成本，高用户感知
3. **D2-3 旋转/缩放输入值** — 需改 handlers 逻辑，中等复杂度
4. **D3-1 变换 Algo 独立化** — 影响正确性（依赖追踪），但工作量较大
5. **D3-2 代数视图播放控制** — UI 增强
6. **D3-3 框选高亮** — 纯 UI
7. **D4 各工具** — 按需实现，优先级最低

## 整体验收标准

1. **D2 完成**：约束点可右键播放动画；滑块可随机跳值；旋转/缩放支持输入值模式
2. **D3 完成**：变换操作创建 AlgoElement（依赖可追踪）；代数视图可控制约束点动画；框选有高亮
3. **D4 完成**：5 个低频工具可用，无回归
4. 所有新测试通过 `npx vitest run`
5. 无 TypeScript 编译错误 `npx tsc --noEmit`
6. 无回归：现有 18 个测试文件全部通过
