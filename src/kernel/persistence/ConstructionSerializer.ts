import { Kernel } from '../core/Kernel';
import { ConstructionElement } from '../core/ConstructionElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';
import { AlgoElement } from '../algo/AlgoElement';
import { AlgoLineTwoPoints } from '../algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../algo/AlgoSegmentTwoPoints';
import { AlgoMidpoint } from '../algo/AlgoMidpoint';
import { AlgoCirclePointRadius } from '../algo/AlgoCirclePointRadius';
import { AlgoCircleCenterPoint } from '../algo/AlgoCircleCenterPoint';
import { AlgoCircleThreePoints } from '../algo/AlgoCircleThreePoints';
import { AlgoCircleCenter } from '../algo/AlgoCircleCenter';
import { AlgoIntersect } from '../algo/AlgoIntersect';
import { AlgoParallelLine } from '../algo/AlgoParallelLine';
import { AlgoOrthogonalLine } from '../algo/AlgoOrthogonalLine';
import { AlgoPerpendicularBisector } from '../algo/AlgoPerpendicularBisector';
import { AlgoAngleBisector } from '../algo/AlgoAngleBisector';
import { AlgoPointOnLine } from '../algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../algo/AlgoPointOnSegment';
import { AlgoPointOnConic } from '../algo/AlgoPointOnConic';
import { AlgoTranslate } from '../algo/AlgoTranslate';
import { AlgoDistance } from '../algo/AlgoDistance';
import { AlgoAngle } from '../algo/AlgoAngle';
import { AlgoArea } from '../algo/AlgoArea';
import { AlgoTangent } from '../algo/AlgoTangent';
import { AlgoLocus } from '../algo/AlgoLocus';
import { AlgoVector } from '../algo/AlgoVector';
import { AlgoPolyLine } from '../algo/AlgoPolyLine';
import { AlgoSemicircle } from '../algo/AlgoSemicircle';
import { AlgoCircularSector } from '../algo/AlgoCircularSector';
import { AlgoCircumcircularArc } from '../algo/AlgoCircumcircularArc';
import { AlgoSlope } from '../algo/AlgoSlope';
import { AlgoEllipse } from '../algo/AlgoEllipse';
import { AlgoHyperbola } from '../algo/AlgoHyperbola';
import { AlgoParabola } from '../algo/AlgoParabola';
import { AlgoConicFivePoints } from '../algo/AlgoConicFivePoints';
import { AlgoCompass } from '../algo/AlgoCompass';
import { CoordinateSystem } from '../core/CoordinateSystem';

/**
 * 构造的序列化 / 反序列化（持久化、导入导出）。
 *
 * 设计要点（对标 GeoGebra .ggb / JSXGraph JessieCode 的“重放语义”）：
 *   - 只保存“自由元素”（独立点、滑块）+ “算法链”；派生几何对象由算法重算得到，不占存储；
 *   - 用 constIndex 作为引用键，反序列化时按 constIndex 升序重建，保证依赖拓扑序不变；
 *   - view（坐标系状态）一并保存，打开文件时还原现场。
 */

interface SerializedElement {
  type: string;
  constIndex: number;
  label: string;
  coords?: [number, number, number];      // GeoPoint
  value?: number;                          // GeoNumeric
  intervalMin?: number;
  intervalMax?: number;
  animationSpeed?: number;
  animationIncrement?: number;
  style?: Record<string, unknown>;        // P2-1: 对象的样式属性
}

interface SerializedAlgorithm {
  type: string;
  constIndex: number;
  inputs: number[];           // 输入元素的 constIndex
  outputLabels: string[];     // 输出几何对象的 label（恢复用户自定义命名）
}

export interface ConstructionJSON {
  version: number;
  generator: string;
  view?: {
    xZero: number;
    yZero: number;
    xScale: number;
    yScale: number;
    width: number;
    height: number;
  };
  independentElements: SerializedElement[];
  algorithms: SerializedAlgorithm[];
}

const GENERATOR = 'MiniGeogebra';
const VERSION = 1;

/** 工厂：按类型重建算法实例（正常构造，input 已存在于 map 中） */
function createAlgo(kernel: Kernel, type: string, inputs: GeoElement[]): AlgoElement {
  const asPoint = (n: number) => inputs[n] as import('../geo/GeoPoint').GeoPoint;
  const asConic = (n: number) => inputs[n] as import('../geo/GeoConic').GeoConic;
  const asLine = (n: number) => inputs[n] as import('../geo/GeoLine').GeoLine;
  const asSegment = (n: number) => inputs[n] as import('../geo/GeoSegment').GeoSegment;

  switch (type) {
    case 'AlgoLineTwoPoints':        return new AlgoLineTwoPoints(kernel, asPoint(0), asPoint(1));
    case 'AlgoSegmentTwoPoints':     return new AlgoSegmentTwoPoints(kernel, asPoint(0), asPoint(1));
    case 'AlgoMidpoint':             return new AlgoMidpoint(kernel, asPoint(0), asPoint(1));
    case 'AlgoCirclePointRadius':    return new AlgoCirclePointRadius(kernel, asPoint(0), (inputs[1] as any)?.value ?? 50);
    case 'AlgoCircleCenterPoint':    return new AlgoCircleCenterPoint(kernel, asPoint(0), asPoint(1));
    case 'AlgoCircleThreePoints':    return new AlgoCircleThreePoints(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoCircleCenter':         return new AlgoCircleCenter(kernel, asConic(0));
    case 'AlgoIntersect':            return new AlgoIntersect(kernel, inputs[0], inputs[1]);
    case 'AlgoParallelLine':         return new AlgoParallelLine(kernel, asPoint(0), asLine(1));
    case 'AlgoOrthogonalLine':       return new AlgoOrthogonalLine(kernel, asPoint(0), asLine(1));
    case 'AlgoPerpendicularBisector':return new AlgoPerpendicularBisector(kernel, asPoint(0), asPoint(1));
    case 'AlgoAngleBisector':        return new AlgoAngleBisector(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoPointOnLine':          return new AlgoPointOnLine(kernel, asLine(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnSegment':       return new AlgoPointOnSegment(kernel, asSegment(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnConic':         return new AlgoPointOnConic(kernel, asConic(0), inputs[1] as GeoNumeric);
    case 'AlgoTranslate':            return new AlgoTranslate(kernel, inputs[0], inputs[1] as import('../geo/GeoVector').GeoVector);
    case 'AlgoDistance':             return new AlgoDistance(kernel, inputs[0], inputs[1]);
    case 'AlgoAngle':                return new AlgoAngle(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoArea':                 return new AlgoArea(kernel, inputs[0]);
    case 'AlgoTangent':              return new AlgoTangent(kernel, asConic(0), asPoint(1));
    case 'AlgoLocus':                return new AlgoLocus(kernel, inputs[1] as import('../geo/GeoPoint').GeoPoint, inputs[0] as import('../geo/GeoPoint').GeoPoint);
    case 'AlgoVector':              return new AlgoVector(kernel, asPoint(0), asPoint(1));
    case 'AlgoSemicircle':          return new AlgoSemicircle(kernel, asPoint(0), asPoint(1));
    case 'AlgoPolyLine':            return new AlgoPolyLine(kernel, inputs as import('../geo/GeoPoint').GeoPoint[]);
    case 'AlgoCircularSector':      return new AlgoCircularSector(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoCircumcircularArc':   return new AlgoCircumcircularArc(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoSlope':               return new AlgoSlope(kernel, asLine(0));
    case 'AlgoEllipse':             return new AlgoEllipse(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoHyperbola':           return new AlgoHyperbola(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoParabola':            return new AlgoParabola(kernel, asPoint(0), asLine(1));
    case 'AlgoConicFivePoints':     return new AlgoConicFivePoints(kernel, inputs as import('../geo/GeoPoint').GeoPoint[]);
    case 'AlgoCompass':             return new AlgoCompass(kernel, asPoint(0), asPoint(1), asPoint(2));
    default:
      throw new Error(`[ConstructionSerializer] unknown algorithm type: ${type}`);
  }
}

/** 序列化为 JSON 字符串 */
export function serialize(kernel: Kernel, coord?: CoordinateSystem): string {
  const construction = kernel.getConstruction();
  const elements = construction.getElements();

  const independentElements: SerializedElement[] = elements
    .filter((el): el is GeoElement => el instanceof GeoElement && el.isIndependent())
    .map(el => {
      if (el instanceof GeoPoint) {
        return {
          type: 'GeoPoint',
          constIndex: el.constIndex,
          label: el.label,
          coords: [el.getX(), el.getY(), el.getZ()] as [number, number, number],
          style: {
            strokeColor: el.strokeColor,
            strokeWidth: el.strokeWidth,
            strokeDash: el.strokeDash ? [...el.strokeDash] : [],
            fillColor: el.fillColor,
            labelVisible: el.labelVisible,
            labelMode: el.labelMode,
          },
        };
      }
      if (el instanceof GeoNumeric) {
        return {
          type: 'GeoNumeric',
          constIndex: el.constIndex,
          label: el.label,
          value: el.getValue(),
          intervalMin: el.intervalMin,
          intervalMax: el.intervalMax,
          animationSpeed: el.animationSpeed,
          animationIncrement: el.animationIncrement,
          style: {
            strokeColor: el.strokeColor,
            strokeWidth: el.strokeWidth,
            strokeDash: el.strokeDash ? [...el.strokeDash] : [],
            fillColor: el.fillColor,
            labelVisible: el.labelVisible,
            labelMode: el.labelMode,
          },
        };
      }
      // 其他独立元素（如自由向量/多边形）按需扩展
      return {
        type: el.getClassName(),
        constIndex: el.constIndex,
        label: el.label,
        style: {
          strokeColor: el.strokeColor,
          strokeWidth: el.strokeWidth,
          strokeDash: el.strokeDash ? [...el.strokeDash] : [],
          fillColor: el.fillColor,
          labelVisible: el.labelVisible,
          labelMode: el.labelMode,
        },
      };
    });

  const algorithms: SerializedAlgorithm[] = construction.getElements()
    .filter((el): el is AlgoElement => el instanceof AlgoElement)
    .sort((a, b) => a.constIndex - b.constIndex)
    .map(algo => ({
      type: algo.getClassName(),
      constIndex: algo.constIndex,
      inputs: algo.getInput().map(i => i.constIndex),
      outputLabels: algo.getGeoElements().map(o => o.label),
    }));

  const data: ConstructionJSON = {
    version: VERSION,
    generator: GENERATOR,
    independentElements,
    algorithms,
  };

  if (coord) {
    data.view = {
      xZero: coord.xZero,
      yZero: coord.yZero,
      xScale: coord.xScale,
      yScale: coord.yScale,
      width: coord.width,
      height: coord.height,
    };
  }

  return JSON.stringify(data, null, 2);
}

/** 从 JSON 字符串重建构造，并返回重建后的坐标系（若有） */
export function deserialize(kernel: Kernel, json: string): { coord?: CoordinateSystem } {
  const data = JSON.parse(json) as ConstructionJSON;
  const construction = kernel.getConstruction();
  construction.clear();

  if (data.version !== VERSION) {
    console.warn(`[ConstructionSerializer] version mismatch: expected ${VERSION}, got ${data.version}`);
  }

  const index = new Map<number, GeoElement>();

  // 1) 重建自由元素（按 constIndex 升序，保证后续算法引用时目标已存在）
  for (const el of [...data.independentElements].sort((a, b) => a.constIndex - b.constIndex)) {
    let instance: GeoElement;
    if (el.type === 'GeoPoint') {
      const c = el.coords ?? [0, 0, 1];
      instance = new GeoPoint(kernel, new GeoVec3D(c[0], c[1], c[2]));
    } else if (el.type === 'GeoNumeric') {
      instance = new GeoNumeric(kernel, el.value ?? 0);
      const num = instance as GeoNumeric;
      num.intervalMin = el.intervalMin ?? 0;
      num.intervalMax = el.intervalMax ?? 2 * Math.PI;
      num.animationSpeed = el.animationSpeed ?? 1;
      num.animationIncrement = el.animationIncrement ?? 0.01;
    } else {
      throw new Error(`[ConstructionSerializer] unsupported independent element type: ${el.type}`);
    }
    instance.label = el.label;
    // P2-1: 恢复对象的样式属性
    if (el.style) {
      if ('strokeColor' in el.style) instance.strokeColor = el.style.strokeColor as string | null;
      if ('strokeWidth' in el.style) instance.strokeWidth = el.style.strokeWidth as number | null;
      if ('strokeDash' in el.style && Array.isArray(el.style.strokeDash)) {
        instance.strokeDash = [...(el.style.strokeDash as number[])];
      } else if (!('strokeDash' in el.style)) {
        instance.strokeDash = null;
      }
      if ('fillColor' in el.style) instance.fillColor = el.style.fillColor as string | null;
      if ('labelVisible' in el.style) instance.labelVisible = el.style.labelVisible as boolean;
      if ('labelMode' in el.style) instance.labelMode = el.style.labelMode as 'always' | 'mouse' | 'never';
    }
    construction.addElement(instance);
    index.set(el.constIndex, instance);
  }

  // 2) 重建算法链（按 constIndex 升序 = 原构造拓扑序）
  for (const a of [...data.algorithms].sort((a, b) => a.constIndex - b.constIndex)) {
    const inputs = a.inputs.map(ci => index.get(ci)).filter((x): x is GeoElement => x !== undefined);
    if (inputs.length !== a.inputs.length) {
      console.warn(`[ConstructionSerializer] algo ${a.type} missing inputs, skipping`);
      continue;
    }
    const algo = createAlgo(kernel, a.type, inputs);
    construction.addElement(algo);
    // 恢复输出对象的 label（用户自定义命名）
    const outputs = algo.getGeoElements();
    a.outputLabels.forEach((lbl, i) => {
      if (outputs[i]) outputs[i].label = lbl;
    });
  }

  // 3) 全场重算，让所有派生对象到位
  construction.updateAllAlgorithms();

  // 4) 恢复视图
  let coord: CoordinateSystem | undefined;
  if (data.view) {
    const v = data.view;
    coord = new CoordinateSystem(v.width, v.height, v.xZero, v.yZero, v.xScale, v.yScale);
  }

  return { coord };
}

/** 触发浏览器下载 JSON 文件 */
export function downloadJSON(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
