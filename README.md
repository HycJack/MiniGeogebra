<div align="center">

# Mini GeoGebra

**一个基于 React + TypeScript 的交互式平面几何绘图系统**

</div>

## 项目简介

Mini GeoGebra 是一个轻量级的交互式几何绘图工具，采用 GeoGebra 核心架构设计理念，实现了丰富的几何构造功能。用户可以通过直观的图形界面创建、编辑和操作各种几何对象，支持动态几何演示和动画效果。

## 功能特性

### 几何构造工具

| 工具类别 | 功能 |
|---------|------|
| **基本图形** | 点、线段、直线、多边形 |
| **圆工具** | 圆心+半径、圆心+圆上点、三点定圆 |
| **特殊点** | 中点、交点 |
| **特殊线** | 平行线、垂线、中垂线、角平分线 |

### 交互功能

- **拖拽移动** - 自由移动独立几何对象
- **选择编辑** - 点击选择对象，支持标签编辑
- **缩放平移** - 鼠标滚轮缩放，右键拖拽平移
- **撤销/重做** - 完整的操作历史记录
- **键盘快捷键** - ESC 取消操作，Delete 删除选中对象

### 视图控制

- 坐标轴显示/隐藏
- 网格显示/隐藏
- 视图重置
- 缩放控制

### 动画系统

- 支持参数动画
- 动画播放/暂停控制
- 动态几何演示

### 国际化

- 支持中文/英文切换
- 完整的界面翻译

## 技术架构

### 核心架构设计

项目采用类似 GeoGebra 的分层架构：

```
src/
├── components/           # UI 组件层
│   ├── GeometryCanvas.tsx   # 主画布组件
│   └── SliderControl.tsx    # 滑块控制组件
├── kernel/               # 核心计算引擎
│   ├── core/                # 核心类
│   │   ├── Kernel.ts           # 内核管理器
│   │   ├── Construction.ts     # 构造管理
│   │   ├── ConstructionElement.ts
│   │   ├── GeoVec3D.ts         # 3D 向量
│   │   ├── AnimationManager.ts # 动画管理
│   │   └── Interfaces.ts       # 接口定义
│   ├── geo/                 # 几何对象
│   │   ├── GeoElement.ts       # 几何元素基类
│   │   ├── GeoPoint.ts         # 点
│   │   ├── GeoLine.ts          # 直线
│   │   ├── GeoSegment.ts       # 线段
│   │   ├── GeoConic.ts         # 圆锥曲线
│   │   ├── GeoPolygon.ts       # 多边形
│   │   ├── GeoVector.ts        # 向量
│   │   └── GeoNumeric.ts       # 数值参数
│   └── algo/                # 算法构造
│       ├── AlgoElement.ts      # 算法基类
│       ├── AlgoLineTwoPoints.ts
│       ├── AlgoSegmentTwoPoints.ts
│       ├── AlgoMidpoint.ts
│       ├── AlgoIntersect.ts
│       ├── AlgoCircle*.ts
│       └── ...
└── i18n/                 # 国际化
    └── LanguageContext.tsx
```

### 核心类说明

#### Kernel（内核）
系统的核心管理器，负责：
- 管理 Construction（构造）
- 管理 AnimationManager（动画管理器）
- 协调几何更新和视图刷新

#### Construction（构造）
管理所有几何元素和算法：
- 维护元素列表
- 处理元素添加/删除
- 更新依赖算法
- 自动生成标签

#### GeoElement（几何元素）
所有几何对象的抽象基类：
- 点、线、圆、多边形等
- 支持依赖关系追踪
- 实现路径和区域接口

#### AlgoElement（算法元素）
几何构造算法的基类：
- 定义输入输出关系
- 实现计算逻辑
- 自动更新依赖对象

### 技术栈

| 技术 | 版本 | 用途 |
|-----|------|------|
| React | 19.0 | UI 框架 |
| TypeScript | 5.8 | 类型安全 |
| Vite | 6.2 | 构建工具 |
| Tailwind CSS | 4.1 | 样式框架 |
| Lucide React | 0.546 | 图标库 |
| Motion | 12.23 | 动画库 |

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 可用脚本

| 命令 | 说明 |
|-----|------|
| `npm run dev` | 启动开发服务器 (端口 3000) |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产版本 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run clean` | 清理构建目录 |

## 使用指南

### 基本操作

1. **创建点** - 选择点工具，点击画布
2. **创建线段** - 选择线段工具，依次点击两个点
3. **创建圆** - 选择圆工具，设置圆心和半径
4. **移动对象** - 选择移动工具，拖拽对象
5. **删除对象** - 选中对象后按 Delete 键

### 几何构造示例

**创建三角形中点连线：**
1. 使用点工具创建三个点 A、B、C
2. 使用线段工具连接形成三角形
3. 使用中点工具创建各边中点
4. 连接中点形成中位线

**创建动态圆：**
1. 创建一个数值参数（滑块）
2. 创建圆心点
3. 使用圆（圆心+半径）工具
4. 播放动画观察圆的动态变化

## 项目特点

### 依赖追踪系统

采用有向无环图（DAG）管理几何依赖关系：
- 移动独立点自动更新依赖对象
- 算法按拓扑顺序更新
- 避免循环依赖

### 命令模式

实现完整的撤销/重做功能：
- 记录元素添加操作
- 记录状态变更操作
- 支持操作回滚

### 响应式设计

- 自适应窗口大小
- 高 DPI 屏幕支持
- 流畅的缩放体验

## 许可证

Apache-2.0 License

## 致谢

本项目架构设计参考了 [GeoGebra](https://www.geogebra.org/) 的核心设计理念。
