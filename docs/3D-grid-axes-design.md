# MiniGeogebra 3D 坐标轴与网格界面设计

参考 GeoGebra（`/Users/yicaohuang/Downloads/geogebra`）的 3D 界面，完善本项目的 3D 视图，
并同步参考其 2D 网格/坐标轴样式。

## 参考的 GeoGebra 设计要点

参考代码位于参考仓库 `source/shared/common/.../geogebra3D/euclidian3D/`：

- `draw/DrawAxis3D.java` —— 坐标轴绘制
  - 轴带**正方向箭头**（`ARROW_TYPE_SIMPLE`）与**刻度 tick**（`Ticks.MAJOR_AND_MINOR` 主次刻度）
  - 刻度间距 = 轴编号距离（`getAxisNumberingDistance`），轴上绘制**刻度数字**与**轴端点标签**
  - 坐标轴颜色约定：X 红 / Y 绿 / Z 蓝
- `draw/DrawPlane3D.java` / `draw/DrawPlaneConstant3D.java` —— 坐标平面
  - 每个平面绘制**半透明填充板（plate）** + **网格线（grid）** + 矩形**外轮廓（outline）**
  - 网格间距自适应（`gridStep`），网格虚线纹理（`LINE_TYPE_DASHED_SHORT`）
  - 平面随视角旋转时网格同步更新；视点与平面平行时只画外轮廓
- 坐标轴/网格是否显示由 3D 样式条（style bar）的「坐标轴 / 网格」开关控制

## 本项目 3D 实现（WebGL3DRenderer.ts / Geometry3DView.tsx）

### 三坐标平面（XY 底部 / XZ / YZ 侧立）

`Scene3D` 新增 `planes: Plane3[]` 配置，每项 `{ axis: 'xy'|'xz'|'yz', grid, plate }`：

- **填充板 plate**：半透明着色
  - XY 平面：灰 `rgba(203,209,218,0.28)`
  - XZ 平面：红调 `rgba(239,68,68,0.14)`
  - YZ 平面：绿调 `rgba(34,197,94,0.14)`
- **网格 grid**：每个平面内绘制
  - 次级网格（主格 5 等分，色 `#f3f4f6`，淡）
  - 主网格（色 `#e5e7eb`）
  - 矩形虚线外轮廓（色 `#cbd5e1`，dash `[5,5]` 像素）
- 渲染顺序（画家算法）：`平面填充板 → 网格线+坐标轴 → 元素填充 → 元素线 → 点`

### 坐标轴（X 红 / Y 绿 / Z 蓝）

- 三轴彩色粗线（`widthPx: 2`），Z 轴高度由 XY 包围盒估算（`zExtent ≈ max(sx,sy)*0.55`）
- **正方向箭头**：在 X/Y/Z 轴正端绘制屏幕空间小三角（`pushArrow`，朝向相机方向求垂直向量）
- **刻度 tick**：沿轴每主网格步长画小刻度线（X/Y 轴双向、Z 轴双向），长度按像素换算世界单位
- **轴刻度数字**：2D overlay（`drawLabels`）沿 X/Y 轴绘制刻度数字（`fmtNum` 格式化浮点尾差）
- 端点标签 X/Y/Z 沿用原有逻辑，位置与颜色保留

### 平面/网格控制（工具栏 Geometry3DToolbar.tsx）

- 保留原 4 态「坐标轴+平面」循环开关（全部隐藏 / 仅坐标轴 / 仅平面 / 坐标轴+平面）
- 新增**三个独立平面填充开关**（`planeXY / planeXZ / planeYZ`），
  在坐标轴&平面菜单内以带色点复选项呈现，可单独开关某平面填充板
- 平面填充仅在 `axesPlaneMode >= 2` 时生效，与全局模式协同

## 2D 网格/坐标轴增强（drawHelpers.ts drawGrid）

- **次级网格**：主格 5 等分细线（色 `#f1f3f4`），主网格保持 `#e5e7eb`
- **坐标轴正方向箭头**：X 轴右端、Y 轴下端绘制三角箭头（GeoGebra 2D 风格）
- 轴刻度数字与原点标注保留

## 变更文件

- `src/kernel/view/WebGL3DRenderer.ts` —— Scene3D/Plane3 类型、三平面构建、轴箭头/刻度/颜色
- `src/components/Geometry3DView.tsx` —— 平面独立开关、轴刻度数字、buildScene 接线
- `src/components/Geometry3DToolbar.tsx` —— 三平面填充开关 UI
- `src/components/drawHelpers.ts` —— 2D 次级网格 + 坐标轴箭头
- `src/i18n/LanguageContext.tsx` —— 新增平面翻译键

## 验证

- `npx tsc --noEmit` 通过
- `npm run build`（vite build）通过