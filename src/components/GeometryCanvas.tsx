import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { AlgoLineTwoPoints } from '../kernel/algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoCircleCenterPoint } from '../kernel/algo/AlgoCircleCenterPoint';
import { AlgoCircleThreePoints } from '../kernel/algo/AlgoCircleThreePoints';
import { AlgoCircleCenter } from '../kernel/algo/AlgoCircleCenter';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { AlgoParallelLine } from '../kernel/algo/AlgoParallelLine';
import { AlgoOrthogonalLine } from '../kernel/algo/AlgoOrthogonalLine';
import { AlgoPerpendicularBisector } from '../kernel/algo/AlgoPerpendicularBisector';
import { AlgoAngleBisector } from '../kernel/algo/AlgoAngleBisector';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';

import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoPointOnLine } from '../kernel/algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../kernel/algo/AlgoPointOnSegment';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { SliderControl } from './SliderControl';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  MousePointer2, CircleDot, Minus, TrendingUp, Circle, 
  CircleDashed, Target, X, Crosshair, Equal, Baseline, 
  SplitSquareVertical, Scissors, Hexagon, Undo2, Redo2, 
  Play, Pause, ZoomIn, ZoomOut, Home, Globe, Menu, ChevronDown,
  Grid3X3, Axis3D, ChevronUp, Type, Sliders, ToggleLeft, CheckSquare, Plus
} from 'lucide-react';

interface StateSnapshot {
  coords: Map<string, {x: number, y: number, z: number}>;
  numerics: Map<string, number>;
}

type Command = 
  | { type: 'add', elements: ConstructionElement[] }
  | { type: 'move', oldState: StateSnapshot, newState: StateSnapshot };

interface UIElement {
  id: string;
  type: 'text' | 'slider' | 'button' | 'checkbox';
  x: number;
  y: number;
  label?: string;
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  checked?: boolean;
}

const captureState = (kernel: Kernel): StateSnapshot => {
  const coords = new Map();
  const numerics = new Map();
  kernel.getConstruction().getElements().forEach(el => {
    if (el instanceof GeoPoint && el.isIndependent()) {
      coords.set(el.id, { x: el.getX(), y: el.getY(), z: el.getZ() });
    } else if (el instanceof GeoNumeric) {
      numerics.set(el.id, el.getValue());
    }
  });
  return { coords, numerics };
};

export const GeometryCanvas: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kernel] = useState(() => new Kernel());
  const [mode, setMode] = useState<'move' | 'point' | 'line' | 'segment' | 'midpoint' | 'circle' | 'circle_center_point' | 'circle3' | 'intersect' | 'parallel' | 'orthogonal' | 'perpendicular_bisector' | 'angle_bisector' | 'polygon' | 'text' | 'slider' | 'button' | 'checkbox'>('move');
  const [polygonPoints, setPolygonPoints] = useState<GeoPoint[]>([]);
  const [radius, setRadius] = useState<number>(50);
  const [selectedElements, setSelectedElements] = useState<GeoElement[]>([]);
  const [editingLabel, setEditingLabel] = useState<string>('');

  useEffect(() => {
    // 删除多边形绘制过程中创建的点
    const pointsToDelete = [...polygonPoints];
    if (pointsToDelete.length > 0) {
      pointsToDelete.forEach(point => {
        kernel.getConstruction().removeElement(point);
      });
      kernel.getConstruction().updateAllAlgorithms();
      setRefresh(r => r + 1);
    }
    
    setSelectedElements([]);
    setPolygonPoints([]);
  }, [mode]);

  useEffect(() => {
    if (selectedElements.length === 1) {
      setEditingLabel(selectedElements[0].label);
    } else {
      setEditingLabel('');
    }
  }, [selectedElements]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingLabel(e.target.value);
  };

  const handleLabelSubmit = () => {
    if (selectedElements.length === 1) {
      if (editingLabel.trim() !== '') {
        selectedElements[0].label = editingLabel.trim();
        setRefresh(r => r + 1);
      } else {
        setEditingLabel(selectedElements[0].label);
      }
    }
  };

  const [draggedElement, setDraggedElement] = useState<GeoElement | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<GeoPoint | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [initialTransformSet, setInitialTransformSet] = useState(false);
  
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showCircleMenu, setShowCircleMenu] = useState(false);
  const circleMenuRef = useRef<HTMLButtonElement>(null);
  const [circleMenuPosition, setCircleMenuPosition] = useState({ top: 0, left: 0 });
  
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const insertMenuRef = useRef<HTMLButtonElement>(null);
  const [insertMenuPosition, setInsertMenuPosition] = useState({ top: 0, left: 0 });
  
  const [uiElements, setUIElements] = useState<UIElement[]>([]);
  const [editingUIElement, setEditingUIElement] = useState<string | null>(null);
  const [draggingUIElement, setDraggingUIElement] = useState<string | null>(null);

  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [dragStartState, setDragStartState] = useState<StateSnapshot | null>(null);

  const addCommand = (cmd: Command) => {
    undoStack.current.push(cmd);
    redoStack.current = [];
    setRefresh(r => r + 1);
  };

  const isAnimating = kernel.getAnimationManager().isRunning();

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        setCanvasSize({
          width: width * dpr,
          height: height * dpr
        });
        
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
        
        if (!initialTransformSet) {
          setTransform({
            x: width / 2,
            y: height / 2,
            scale: 1
          });
          setInitialTransformSet(true);
        }
        
        setRefresh(r => r + 1);
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, [initialTransformSet]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.circle-menu-container')) {
        setShowCircleMenu(false);
      }
    };

    if (showCircleMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCircleMenu]);

  useEffect(() => {
    if (showCircleMenu && circleMenuRef.current) {
      const rect = circleMenuRef.current.getBoundingClientRect();
      setCircleMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [showCircleMenu]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.insert-menu-container')) {
        setShowInsertMenu(false);
      }
    };

    if (showInsertMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInsertMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          
          // 删除多边形绘制过程中创建的点
          if (polygonPoints.length > 0) {
            polygonPoints.forEach(point => {
              kernel.getConstruction().removeElement(point);
            });
            kernel.getConstruction().updateAllAlgorithms();
          }
          
          setMode('move');
          setSelectedElements([]);
          setPolygonPoints([]);
          setRefresh(r => r + 1);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElements.length > 0 && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          selectedElements.forEach(el => {
            kernel.getConstruction().removeElement(el);
          });
          kernel.getConstruction().updateAllAlgorithms();
          setSelectedElements([]);
          setRefresh(r => r + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements, kernel, polygonPoints]);

  useEffect(() => {
    if (showInsertMenu && insertMenuRef.current) {
      const rect = insertMenuRef.current.getBoundingClientRect();
      setInsertMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [showInsertMenu]);

  useEffect(() => {
    // Initial setup for demo
    const construction = kernel.getConstruction();
    
    // Create some initial objects if empty
    if (construction.getElements().length === 0) {
      const p1 = new GeoPoint(kernel, new GeoVec3D(100, 100, 1));
      p1.label = "A";
      const p2 = new GeoPoint(kernel, new GeoVec3D(300, 100, 1));
      p2.label = "B";
      const p3 = new GeoPoint(kernel, new GeoVec3D(200, 300, 1));
      p3.label = "C";

      construction.addElement(p1);
      construction.addElement(p2);
      construction.addElement(p3);

      const segmentAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
      const segment = segmentAlgo.getOutput();
      segment.label = kernel.getConstruction().getNextLineLabel();
      construction.addElement(segmentAlgo);
      construction.addElement(segment);

      const poly = new GeoPolygon(kernel, [p1, p2, p3]);
      poly.label = kernel.getConstruction().getNextPolygonLabel();
      construction.addElement(poly);

      const mid = new AlgoMidpoint(kernel, p1, p3);
      construction.addElement(mid);
      construction.addElement(mid.getOutput());
      mid.update(); // Ensure computed

      // Animation Demo Setup
      const num = new GeoNumeric(kernel, 0);
      num.label = "t";
      num.setAnimating(true);
      construction.addElement(num);

      const center = new GeoPoint(kernel, new GeoVec3D(500, 300, 1));
      center.label = "Center";
      construction.addElement(center);

      const circle = new AlgoCirclePointRadius(kernel, center, 100);
      construction.addElement(circle);
      construction.addElement(circle.getOutput());
      circle.update();

      const pointOnCircle = new AlgoPointOnConic(kernel, circle.getOutput(), num);
      construction.addElement(pointOnCircle);
      construction.addElement(pointOnCircle.getOutput());
      pointOnCircle.update();
    }

    kernel.setUpdateCallback(() => {
      setRefresh(r => r + 1);
    });
  }, [kernel]);

  const toggleAnimation = () => {
    const am = kernel.getAnimationManager();
    if (am.isRunning()) {
      am.stopAnimation();
    } else {
      am.startAnimation();
    }
    setRefresh(r => r + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Draw grid
    drawGrid(ctx, canvas.width / dpr, canvas.height / dpr, transform, showGrid, showAxes);

    // Draw elements
    const elements = kernel.getConstruction().getElements();
    
    // Draw polygons first (fill)
    elements.forEach(el => {
      if (el instanceof GeoPolygon) {
        drawPolygon(ctx, el, selectedElements.includes(el), transform.scale);
      }
    });

    // Draw conics (circles)
    elements.forEach(el => {
      if (el instanceof GeoConic) {
        drawConic(ctx, el, selectedElements.includes(el), transform.scale);
      }
    });

    // Draw lines and segments
    elements.forEach(el => {
      if (el instanceof GeoSegment) {
        drawSegment(ctx, el, selectedElements.includes(el), transform.scale);
      } else if (el instanceof GeoLine && !(el instanceof GeoSegment)) {
        drawLine(ctx, el, selectedElements.includes(el), transform);
      }
    });

    // Draw polygon being created
    if (mode === 'polygon' && polygonPoints.length > 0) {
        ctx.strokeStyle = '#9ca3af'; // gray-400
        ctx.lineWidth = 1 / transform.scale;
        ctx.setLineDash([5 / transform.scale, 5 / transform.scale]);
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].getX(), polygonPoints[0].getY());
        for (let i = 1; i < polygonPoints.length; i++) {
            ctx.lineTo(polygonPoints[i].getX(), polygonPoints[i].getY());
        }
        // Draw line to mouse
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw Previews
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.setLineDash([5 / transform.scale, 5 / transform.scale]);
    ctx.lineWidth = 1 / transform.scale;
    
    const targetX = hoveredPoint ? hoveredPoint.getX() : mousePos.x;
    const targetY = hoveredPoint ? hoveredPoint.getY() : mousePos.y;

    if (mode === 'segment' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        const p1 = selectedElements[0] as GeoPoint;
        ctx.beginPath();
        ctx.moveTo(p1.getX(), p1.getY());
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
    } else if (mode === 'line' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        const p1 = selectedElements[0] as GeoPoint;
        // Draw line through p1 and target
        const dx = targetX - p1.getX();
        const dy = targetY - p1.getY();
        if (Math.hypot(dx, dy) > 1 / transform.scale) {
            // Extend to screen bounds
            const slope = dy / dx;
            // Simple drawing: just a long segment for preview
            ctx.beginPath();
            ctx.moveTo(p1.getX() - 10000 * dx, p1.getY() - 10000 * dy);
            ctx.lineTo(p1.getX() + 10000 * dx, p1.getY() + 10000 * dy);
            ctx.stroke();
        }
    } else if (mode === 'circle') {
        // Preview circle with radius
        ctx.beginPath();
        ctx.arc(targetX, targetY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (mode === 'circle_center_point' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        // Preview circle with center at selected point and radius to target
        const center = selectedElements[0] as GeoPoint;
        const r = Math.hypot(targetX - center.getX(), targetY - center.getY());
        ctx.beginPath();
        ctx.arc(center.getX(), center.getY(), r, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (mode === 'circle3' && selectedElements.length === 2) {
        // Preview circle through two points and mouse position
        const [p1, p2] = selectedElements as GeoPoint[];
        const p3 = { x: targetX, y: targetY };
        
        // Calculate circumcenter from three points
        const ax = p1.getX(), ay = p1.getY();
        const bx = p2.getX(), by = p2.getY();
        const cx = p3.x, cy = p3.y;
        
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) > 1e-10) {
            const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
            const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
            const r = Math.hypot(ux - ax, uy - ay);
            
            // Draw preview circle
            ctx.beginPath();
            ctx.arc(ux, uy, r, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw preview center point
            ctx.beginPath();
            ctx.arc(ux, uy, 3 / transform.scale, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.fill();
        }
    } else if ((mode === 'parallel' || mode === 'orthogonal') && selectedElements.length === 1 && selectedElements[0] instanceof GeoLine) {
         // Preview line through mouse
         const l = selectedElements[0] as GeoLine;
         let a = l.a, b = l.b;
         if (mode === 'orthogonal') {
             const temp = a; a = -b; b = temp;
         }
         // Line through mouse(mx, my) with normal (a, b)
         // a(x - mx) + b(y - my) = 0 => ax + by = a*mx + b*my
         const c = -(a * targetX + b * targetY);
         
         const startX = -transform.x / transform.scale;
         const endX = ((canvas.width / dpr) - transform.x) / transform.scale;
         const startY = -transform.y / transform.scale;
         const endY = ((canvas.height / dpr) - transform.y) / transform.scale;

         // Draw this line
         if (Math.abs(b) > 1e-6) {
            const y1 = (-c - a * startX) / b;
            const y2 = (-c - a * endX) / b;
            ctx.beginPath();
            ctx.moveTo(startX, y1);
            ctx.lineTo(endX, y2);
            ctx.stroke();
         } else {
            const x = -c / a;
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
         }
    } else if (mode === 'perpendicular_bisector' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        // Preview perpendicular bisector through midpoint
        const p1 = selectedElements[0] as GeoPoint;
        const mx = (p1.getX() + targetX) / 2;
        const my = (p1.getY() + targetY) / 2;
        
        // Vector from p1 to target
        const a = targetX - p1.getX();
        const b = targetY - p1.getY();
        
        // Line through M with normal (a, b)
        const c = -(a * mx + b * my);
        
        const startX = -transform.x / transform.scale;
        const endX = ((canvas.width / dpr) - transform.x) / transform.scale;
        const startY = -transform.y / transform.scale;
        const endY = ((canvas.height / dpr) - transform.y) / transform.scale;

        if (Math.abs(b) > 1e-6) {
            const y1 = (-c - a * startX) / b;
            const y2 = (-c - a * endX) / b;
            ctx.beginPath();
            ctx.moveTo(startX, y1);
            ctx.lineTo(endX, y2);
            ctx.stroke();
        } else {
            const x = -c / a;
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        
        // Draw midpoint preview
        ctx.beginPath();
        ctx.arc(mx, my, 3 / transform.scale, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.fill();
    } else if (mode === 'angle_bisector' && selectedElements.length >= 1 && selectedElements.length < 3) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
            // Need two more points - just show line from first point to mouse
            const p1 = selectedElements[0] as GeoPoint;
            ctx.beginPath();
            ctx.moveTo(p1.getX(), p1.getY());
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
        } else if (selectedElements.length === 2 && selectedElements[0] instanceof GeoPoint && selectedElements[1] instanceof GeoPoint) {
            // Have A and B, preview angle bisector with C at mouse position
            const [A, B] = selectedElements as GeoPoint[];
            const C = { x: targetX, y: targetY };
            
            const bx = B.getX();
            const by = B.getY();
            
            // Vector BA
            const bax = A.getX() - bx;
            const bay = A.getY() - by;
            const lenBA = Math.hypot(bax, bay);
            
            // Vector BC
            const bcx = C.x - bx;
            const bcy = C.y - by;
            const lenBC = Math.hypot(bcx, bcy);
            
            if (lenBA > 1e-9 && lenBC > 1e-9) {
                // Normalized vectors
                const uX = bax / lenBA;
                const uY = bay / lenBA;
                const vX = bcx / lenBC;
                const vY = bcy / lenBC;
                
                // Bisector direction vector w = u + v
                const wX = uX + vX;
                const wY = uY + vY;
                
                let nx, ny;
                
                if (Math.hypot(wX, wY) < 1e-9) {
                    nx = uX;
                    ny = uY;
                } else {
                    nx = -wY;
                    ny = wX;
                }
                
                const c = -(nx * bx + ny * by);
                
                const startX = -transform.x / transform.scale;
                const endX = ((canvas.width / dpr) - transform.x) / transform.scale;
                const startY = -transform.y / transform.scale;
                const endY = ((canvas.height / dpr) - transform.y) / transform.scale;
                
                if (Math.abs(ny) > 1e-6) {
                    const y1 = (-c - nx * startX) / ny;
                    const y2 = (-c - nx * endX) / ny;
                    ctx.beginPath();
                    ctx.moveTo(startX, y1);
                    ctx.lineTo(endX, y2);
                    ctx.stroke();
                } else {
                    const x = -c / nx;
                    ctx.beginPath();
                    ctx.moveTo(x, startY);
                    ctx.lineTo(x, endY);
                    ctx.stroke();
                }
            }
        }
    }
    
    ctx.restore();

    // Draw points last
    elements.forEach(el => {
      if (el instanceof GeoPoint) {
        drawPoint(ctx, el, selectedElements.includes(el), transform.scale);
      }
    });

    ctx.restore(); // Restore the global transform

  }, [kernel, refresh, selectedElements, mousePos, mode, polygonPoints, radius, hoveredPoint, transform, showGrid, showAxes]);

  const drawConic = (ctx: CanvasRenderingContext2D, c: GeoConic, selected: boolean, scale: number) => {
    if (!c.isDefined()) return;
    // Only circles for now
    const center = c.getCenter();
    const r = c.getRadius();
    if (r <= 0) return;
    
    if (selected) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r + 4 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 6 / scale;
      ctx.stroke();
    }
    
    ctx.strokeStyle = selected ? '#3b82f6' : '#000';
    ctx.lineWidth = (selected ? 3 : 1) / scale;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, 2 * Math.PI);
    ctx.stroke();
    
    if (selected) {
      const label = c.label || c.id;
      ctx.font = `bold ${14 / scale}px sans-serif`;
      ctx.fillStyle = '#1e40af';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, center.x + r + 10 / scale, center.y);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, transform: {x: number, y: number, scale: number}, showGrid: boolean, showAxes: boolean) => {
    const startX = -transform.x / transform.scale;
    const endX = (w - transform.x) / transform.scale;
    const startY = -transform.y / transform.scale;
    const endY = (h - transform.y) / transform.scale;
    
    // Calculate a nice step size
    const targetStepScreen = 50;
    const targetStepWorld = targetStepScreen / transform.scale;
    const magnitude = Math.pow(10, Math.floor(Math.log10(targetStepWorld)));
    const residual = targetStepWorld / magnitude;
    
    let step = magnitude;
    if (residual > 5) step = 10 * magnitude;
    else if (residual > 2) step = 5 * magnitude;
    else if (residual > 1) step = 2 * magnitude;
    
    const firstX = Math.floor(startX / step) * step;
    const firstY = Math.floor(startY / step) * step;
    
    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1 / transform.scale;
      
      for (let x = firstX; x <= endX; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = firstY; y <= endY; y += step) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }
    
    // Draw axes
    if (showAxes) {
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2 / transform.scale;
      if (0 >= startX && 0 <= endX) {
        ctx.beginPath();
        ctx.moveTo(0, startY);
        ctx.lineTo(0, endY);
        ctx.stroke();
      }
      if (0 >= startY && 0 <= endY) {
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(endX, 0);
        ctx.stroke();
      }

      // Draw numbers
      ctx.fillStyle = '#6b7280';
      ctx.font = `${10 / transform.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      for (let x = firstX; x <= endX; x += step) {
        if (Math.abs(x) > 1e-10) {
          ctx.fillText(parseFloat(x.toPrecision(4)).toString(), x, 4 / transform.scale);
        }
      }
      
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = firstY; y <= endY; y += step) {
        if (Math.abs(y) > 1e-10) {
          ctx.fillText(parseFloat(y.toPrecision(4)).toString(), -4 / transform.scale, y);
        }
      }
      
      // Origin
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', -4 / transform.scale, 4 / transform.scale);
    }
  };

  const drawPoint = (ctx: CanvasRenderingContext2D, p: GeoPoint, selected: boolean, scale: number) => {
    if (!p.isDefined()) return;
    const x = p.getX();
    const y = p.getY();
    
    const baseRadius = selected ? 8 : 6;
    const pointRadius = baseRadius / scale;
    
    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, (baseRadius + 4) / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x, y, (baseRadius + 8) / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
    }
    
    ctx.beginPath();
    ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
    
    if (p.isIndependent()) {
      ctx.fillStyle = selected ? '#1e40af' : '#1d4ed8';
    } else {
      ctx.fillStyle = selected ? '#374151' : '#6b7280';
    }
    ctx.fill();
    
    ctx.strokeStyle = selected ? '#1e3a8a' : '#374151';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
    
    const label = p.label || p.id;
    ctx.font = `bold ${14 / scale}px sans-serif`;
    
    const labelOffsetX = 15;
    const labelOffsetY = -15;
    const labelX = x + labelOffsetX;
    const labelY = y + labelOffsetY;
    
    ctx.fillStyle = selected ? '#1e40af' : '#1f2937';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, labelX, labelY);
  };

  const drawLine = (ctx: CanvasRenderingContext2D, l: GeoLine, selected: boolean, transform: {x: number, y: number, scale: number}) => {
    if (!l.isDefined()) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    
    const startX = -transform.x / transform.scale;
    const endX = (w - transform.x) / transform.scale;
    const startY = -transform.y / transform.scale;
    const endY = (h - transform.y) / transform.scale;

    ctx.strokeStyle = selected ? '#3b82f6' : '#000';
    ctx.lineWidth = (selected ? 3 : 1) / transform.scale;
    ctx.beginPath();

    if (Math.abs(l.b) > 1e-6) {
      const y1 = (-l.c - l.a * startX) / l.b;
      const y2 = (-l.c - l.a * endX) / l.b;
      ctx.moveTo(startX, y1);
      ctx.lineTo(endX, y2);
    } else {
      const x = -l.c / l.a;
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    ctx.stroke();
  };

  const drawSegment = (ctx: CanvasRenderingContext2D, s: GeoSegment, selected: boolean, scale: number) => {
    if (!s.isDefined()) return;
    ctx.strokeStyle = selected ? '#3b82f6' : '#000';
    ctx.lineWidth = (selected ? 3 : 2) / scale;
    ctx.beginPath();
    ctx.moveTo(s.startPoint.getX(), s.startPoint.getY());
    ctx.lineTo(s.endPoint.getX(), s.endPoint.getY());
    ctx.stroke();
  };

  const drawPolygon = (ctx: CanvasRenderingContext2D, poly: GeoPolygon, selected: boolean, scale: number) => {
    if (!poly.isDefined()) return;
    if (poly.vertices.length < 3) return;
    ctx.fillStyle = selected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.2)'; // blue-500 with opacity
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = (selected ? 2 : 1) / scale;
    ctx.beginPath();
    ctx.moveTo(poly.vertices[0].getX(), poly.vertices[0].getY());
    for (let i = 1; i < poly.vertices.length; i++) {
      ctx.lineTo(poly.vertices[i].getX(), poly.vertices[i].getY());
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const getMousePos = (e: React.MouseEvent | React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
      screenX,
      screenY,
      x: (screenX - transform.x) / transform.scale,
      y: (screenY - transform.y) / transform.scale
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e);
    
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setLastPanPos({ x: screenX, y: screenY });
      return;
    }
    
    const elementsBefore = kernel.getConstruction().getElements().length;
    const currentDragStartState = captureState(kernel);
    setDragStartState(currentDragStartState);
    
    setLastMousePos({ x, y });
    const elements = kernel.getConstruction().getElements();
    
    // Find clicked point
    // Reverse order to pick top-most
    const clickedPoint = elements.slice().reverse().find(el => 
      el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / transform.scale
    ) as GeoPoint | undefined;

    if (mode === 'move') {
      if (clickedPoint) {
        setDraggedElement(clickedPoint);
        setSelectedElements([clickedPoint]);
      } else {
        // Check for other elements
        const clickedObj = elements.slice().reverse().find(el => {
            if (el instanceof GeoSegment) {
                return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5 / transform.scale);
            } else if (el instanceof GeoLine) {
                const len = Math.hypot(el.a, el.b);
                if (len === 0) return false;
                const d = Math.abs(el.a * x + el.b * y + el.c) / len;
                return d < 5 / transform.scale;
            } else if (el instanceof GeoConic) {
                const r = el.getRadius();
                const center = el.getCenter();
                const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
                return d < 5 / transform.scale;
            } else if (el instanceof GeoPolygon) {
                return (el as any).isInRegionXY(x, y);
            }
            return false;
        }) as GeoElement | undefined;

        if (clickedObj) {
            setDraggedElement(clickedObj);
            setSelectedElements([clickedObj]);
        } else {
            setSelectedElements([]);
        }
      }
    } else if (mode === 'point') {
      const clickedObj = elements.slice().reverse().find(el => {
          if (el instanceof GeoSegment) {
              return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5 / transform.scale);
          } else if (el instanceof GeoLine) {
              const len = Math.hypot(el.a, el.b);
              if (len === 0) return false;
              const d = Math.abs(el.a * x + el.b * y + el.c) / len;
              return d < 5 / transform.scale;
          } else if (el instanceof GeoConic) {
              const r = el.getRadius();
              const center = el.getCenter();
              const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
              return d < 5 / transform.scale;
          }
          return false;
      });

      if (clickedObj) {
          const param = new GeoNumeric(kernel, 0);
          param.label = `t_${elements.filter(e => e instanceof GeoNumeric).length + 1}`;
          param.setAnimating(true); // Allow it to be animated
          
          let algo;
          if (clickedObj instanceof GeoSegment) {
              param.intervalMin = 0;
              param.intervalMax = 1;
              algo = new AlgoPointOnSegment(kernel, clickedObj, param);
          } else if (clickedObj instanceof GeoLine) {
              param.intervalMin = -10; // Arbitrary range for line
              param.intervalMax = 10;
              algo = new AlgoPointOnLine(kernel, clickedObj, param);
          } else if (clickedObj instanceof GeoConic) {
              param.intervalMin = 0;
              param.intervalMax = 2 * Math.PI;
              algo = new AlgoPointOnConic(kernel, clickedObj, param);
          }
          
          kernel.getConstruction().addElement(param);
          if (algo) {
              algo.updateParameter(x, y);
              algo.compute();
              const p = algo.getOutput();
              p.label = kernel.getConstruction().getNextPointLabel();
              kernel.getConstruction().addElement(algo);
              kernel.getConstruction().addElement(p);
              kernel.notifyUpdate(p);
          }
      } else {
          const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
          p.label = kernel.getConstruction().getNextPointLabel();
          kernel.getConstruction().addElement(p);
          kernel.notifyUpdate(p); // Trigger refresh
      }
    } else if (mode === 'segment') {
      if (clickedPoint) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
          const p1 = selectedElements[0] as GeoPoint;
          const p2 = clickedPoint;
          if (p1 !== p2) {
             const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
             kernel.getConstruction().addElement(segAlgo);
             kernel.getConstruction().addElement(segAlgo.getOutput());
             setSelectedElements([]);
             kernel.notifyUpdate(segAlgo);
          }
        } else {
          setSelectedElements([clickedPoint]);
        }
      } else {
          // Create new point if clicked on empty space
          const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
          p.label = kernel.getConstruction().getNextPointLabel();
          kernel.getConstruction().addElement(p);
          kernel.notifyUpdate(p);
          
          if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
              const p1 = selectedElements[0] as GeoPoint;
              const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p);
              kernel.getConstruction().addElement(segAlgo);
              kernel.getConstruction().addElement(segAlgo.getOutput());
              setSelectedElements([]);
              kernel.notifyUpdate(segAlgo);
          } else {
              setSelectedElements([p]);
          }
      }
    } else if (mode === 'midpoint') {
        if (clickedPoint) {
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const p1 = selectedElements[0] as GeoPoint;
                const p2 = clickedPoint;
                const mid = new AlgoMidpoint(kernel, p1, p2);
                kernel.getConstruction().addElement(mid);
                kernel.getConstruction().addElement(mid.getOutput());
                mid.update();
                setSelectedElements([]);
                kernel.notifyUpdate(mid);
            } else {
                setSelectedElements([clickedPoint]);
            }
        }
    } else if (mode === 'line') {
        if (clickedPoint) {
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const p1 = selectedElements[0] as GeoPoint;
                const p2 = clickedPoint;
                if (p1 !== p2) {
                    const line = new AlgoLineTwoPoints(kernel, p1, p2);
                    kernel.getConstruction().addElement(line);
                    kernel.getConstruction().addElement(line.getOutput());
                    line.update();
                    setSelectedElements([]);
                    kernel.notifyUpdate(line);
                }
            } else {
                setSelectedElements([clickedPoint]);
            }
        } else {
             // Create new point
             const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
             p.label = kernel.getConstruction().getNextPointLabel();
             kernel.getConstruction().addElement(p);
             kernel.notifyUpdate(p);
             
             if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                 const p1 = selectedElements[0] as GeoPoint;
                 const line = new AlgoLineTwoPoints(kernel, p1, p);
                 kernel.getConstruction().addElement(line);
                 kernel.getConstruction().addElement(line.getOutput());
                 line.update();
                 setSelectedElements([]);
                 kernel.notifyUpdate(line);
             } else {
                 setSelectedElements([p]);
             }
        }
    } else if (mode === 'circle') {
        // Center + Radius
        if (clickedPoint) {
            const circle = new AlgoCirclePointRadius(kernel, clickedPoint, radius);
            kernel.getConstruction().addElement(circle);
            kernel.getConstruction().addElement(circle.getOutput());
            circle.update();
            kernel.notifyUpdate(circle);
        } else {
            const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
            p.label = kernel.getConstruction().getNextPointLabel();
            kernel.getConstruction().addElement(p);
            kernel.notifyUpdate(p);
            
            const circle = new AlgoCirclePointRadius(kernel, p, radius);
            kernel.getConstruction().addElement(circle);
            kernel.getConstruction().addElement(circle.getOutput());
            circle.update();
            kernel.notifyUpdate(circle);
        }
    } else if (mode === 'circle_center_point') {
        // Center + Point on Circle
        if (clickedPoint) {
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const center = selectedElements[0] as GeoPoint;
                const pointOnCircle = clickedPoint;
                if (center !== pointOnCircle) {
                    const circle = new AlgoCircleCenterPoint(kernel, center, pointOnCircle);
                    kernel.getConstruction().addElement(circle);
                    kernel.getConstruction().addElement(circle.getOutput());
                    circle.update();
                    setSelectedElements([]);
                    kernel.notifyUpdate(circle);
                }
            } else {
                setSelectedElements([clickedPoint]);
            }
        } else {
            // Create new point
            const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
            p.label = kernel.getConstruction().getNextPointLabel();
            kernel.getConstruction().addElement(p);
            kernel.notifyUpdate(p);
            
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const center = selectedElements[0] as GeoPoint;
                const circle = new AlgoCircleCenterPoint(kernel, center, p);
                kernel.getConstruction().addElement(circle);
                kernel.getConstruction().addElement(circle.getOutput());
                circle.update();
                setSelectedElements([]);
                kernel.notifyUpdate(circle);
            } else {
                setSelectedElements([p]);
            }
        }
    } else if (mode === 'circle3') {
        if (clickedPoint) {
            const currentSelected = [...selectedElements, clickedPoint];
            if (currentSelected.length === 3) {
                const [p1, p2, p3] = currentSelected as GeoPoint[];
                const circle = new AlgoCircleThreePoints(kernel, p1, p2, p3);
                kernel.getConstruction().addElement(circle);
                kernel.getConstruction().addElement(circle.getOutput());
                circle.update();
                
                // Create center point using algorithm
                const centerAlgo = new AlgoCircleCenter(kernel, circle.getOutput());
                kernel.getConstruction().addElement(centerAlgo);
                kernel.getConstruction().addElement(centerAlgo.getOutput());
                centerAlgo.update();
                
                setSelectedElements([]);
                kernel.notifyUpdate(circle);
            } else {
                setSelectedElements(currentSelected);
            }
        } else {
             const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
             p.label = kernel.getConstruction().getNextPointLabel();
             kernel.getConstruction().addElement(p);
             kernel.notifyUpdate(p);
             
             const currentSelected = [...selectedElements, p];
             if (currentSelected.length === 3) {
                const [p1, p2, p3] = currentSelected as GeoPoint[];
                const circle = new AlgoCircleThreePoints(kernel, p1, p2, p3);
                kernel.getConstruction().addElement(circle);
                kernel.getConstruction().addElement(circle.getOutput());
                circle.update();
                
                // Create center point using algorithm
                const centerAlgo = new AlgoCircleCenter(kernel, circle.getOutput());
                kernel.getConstruction().addElement(centerAlgo);
                kernel.getConstruction().addElement(centerAlgo.getOutput());
                centerAlgo.update();
                
                setSelectedElements([]);
                kernel.notifyUpdate(circle);
            } else {
                setSelectedElements(currentSelected);
            }
        }
    } else if (mode === 'intersect') {
        // Find clicked object (Line or Conic)
        // We need to hit test lines and conics
        const clickedObj = elements.slice().reverse().find(el => {
            if (el instanceof GeoSegment) {
                return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5);
            } else if (el instanceof GeoLine) {
                // Distance to line
                const d = Math.abs(el.a * x + el.b * y + el.c) / Math.hypot(el.a, el.b);
                return d < 5;
            } else if (el instanceof GeoConic) {
                // Distance to circle edge
                const r = el.getRadius();
                const center = el.getCenter();
                const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
                return d < 5;
            }
            return false;
        }) as GeoElement | undefined;

        if (clickedObj) {
            if (selectedElements.length === 1) {
                const obj1 = selectedElements[0];
                const obj2 = clickedObj;
                if (obj1 !== obj2) {
                    const intersect = new AlgoIntersect(kernel, obj1, obj2);
                    kernel.getConstruction().addElement(intersect);
                    intersect.getOutputPoints().forEach(p => kernel.getConstruction().addElement(p));
                    intersect.update();
                    setSelectedElements([]);
                    kernel.notifyUpdate(intersect);
                }
            } else {
                setSelectedElements([clickedObj]);
            }
        }
    } else if (mode === 'parallel' || mode === 'orthogonal') {
        // Select Point and Line
        const clickedObj = elements.slice().reverse().find(el => {
            if (el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10) return true;
            if (el instanceof GeoSegment) {
                 return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5);
            } else if (el instanceof GeoLine) {
                 const d = Math.abs(el.a * x + el.b * y + el.c) / Math.hypot(el.a, el.b);
                 return d < 5;
            }
            return false;
        }) as GeoElement | undefined;

        if (clickedObj) {
            const currentSelected = [...selectedElements, clickedObj];
            // Check if we have one point and one line
            const point = currentSelected.find(e => e instanceof GeoPoint) as GeoPoint | undefined;
            const line = currentSelected.find(e => e instanceof GeoLine) as GeoLine | undefined;

            if (point && line) {
                if (mode === 'parallel') {
                    const algo = new AlgoParallelLine(kernel, point, line);
                    kernel.getConstruction().addElement(algo);
                    kernel.getConstruction().addElement(algo.getOutput());
                    algo.update();
                    kernel.notifyUpdate(algo);
                } else {
                    const algo = new AlgoOrthogonalLine(kernel, point, line);
                    kernel.getConstruction().addElement(algo);
                    kernel.getConstruction().addElement(algo.getOutput());
                    algo.update();
                    kernel.notifyUpdate(algo);
                }
                setSelectedElements([]);
            } else {
                setSelectedElements(currentSelected);
            }
        }
    } else if (mode === 'perpendicular_bisector') {
        // Select two points or one segment
        // First check for points
        if (clickedPoint) {
            const currentSelected = [...selectedElements, clickedPoint];
            if (currentSelected.length === 2 && currentSelected[0] instanceof GeoPoint && currentSelected[1] instanceof GeoPoint) {
                const [p1, p2] = currentSelected as GeoPoint[];
                const algo = new AlgoPerpendicularBisector(kernel, p1, p2);
                kernel.getConstruction().addElement(algo);
                kernel.getConstruction().addElement(algo.getOutput());
                algo.update();
                kernel.notifyUpdate(algo);
                setSelectedElements([]);
            } else {
                setSelectedElements(currentSelected);
            }
        } else {
             // Check for segment
             const clickedSegment = elements.slice().reverse().find(el => 
                el instanceof GeoSegment && (el as any).isOnPath({ getX: () => x, getY: () => y }, 5)
             ) as GeoSegment | undefined;
             
             if (clickedSegment) {
                 const algo = new AlgoPerpendicularBisector(kernel, clickedSegment.startPoint, clickedSegment.endPoint);
                 kernel.getConstruction().addElement(algo);
                 kernel.getConstruction().addElement(algo.getOutput());
                 algo.update();
                 kernel.notifyUpdate(algo);
                 setSelectedElements([]);
             }
        }
    } else if (mode === 'angle_bisector') {
        // Select 3 points
        if (clickedPoint) {
            const currentSelected = [...selectedElements, clickedPoint];
            if (currentSelected.length === 3) {
                const [A, B, C] = currentSelected as GeoPoint[];
                const algo = new AlgoAngleBisector(kernel, A, B, C);
                kernel.getConstruction().addElement(algo);
                kernel.getConstruction().addElement(algo.getOutput());
                algo.update();
                kernel.notifyUpdate(algo);
                setSelectedElements([]);
            } else {
                setSelectedElements(currentSelected);
            }
        }
    } else if (mode === 'polygon') {
        if (clickedPoint) {
            // If clicked start point, close polygon
            if (polygonPoints.length > 2 && clickedPoint === polygonPoints[0]) {
                const poly = new GeoPolygon(kernel, [...polygonPoints]);
                poly.label = kernel.getConstruction().getNextPolygonLabel();
                kernel.getConstruction().addElement(poly);
                
                // Also add segments
                for (let i = 0; i < polygonPoints.length; i++) {
                    const p1 = polygonPoints[i];
                    const p2 = polygonPoints[(i + 1) % polygonPoints.length];
                    // Check if segment exists? For now just create new ones or reuse logic
                    const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
                    kernel.getConstruction().addElement(segAlgo);
                    kernel.getConstruction().addElement(segAlgo.getOutput());
                }
                
                kernel.notifyUpdate(poly);
                setPolygonPoints([]);
                setSelectedElements([]);
            } else {
                // Add point to polygon
                setPolygonPoints([...polygonPoints, clickedPoint]);
                setSelectedElements([...selectedElements, clickedPoint]);
            }
        } else {
            // Create new point
             const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
             p.label = kernel.getConstruction().getNextPointLabel();
             kernel.getConstruction().addElement(p);
             kernel.notifyUpdate(p);
             
             setPolygonPoints([...polygonPoints, p]);
             setSelectedElements([...selectedElements, p]);
        }
    } else if (mode === 'text' || mode === 'slider' || mode === 'button' || mode === 'checkbox') {
      const id = `ui_${Date.now()}`;
      const newUIElement: UIElement = {
        id,
        type: mode,
        x,
        y,
        label: mode === 'text' ? 'Text' : mode === 'slider' ? 'Slider' : mode === 'button' ? 'Button' : 'Checkbox',
        value: mode === 'slider' ? 50 : undefined,
        min: mode === 'slider' ? 0 : undefined,
        max: mode === 'slider' ? 100 : undefined,
        step: mode === 'slider' ? 1 : undefined,
        checked: mode === 'checkbox' ? false : undefined
      };
      setUIElements([...uiElements, newUIElement]);
      setEditingUIElement(id);
    }

    const elementsAfter = kernel.getConstruction().getElements();
    if (elementsAfter.length > elementsBefore) {
      const addedElements = elementsAfter.slice(elementsBefore);
      addCommand({ type: 'add', elements: addedElements });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e);
    setMousePos({ x, y });

    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + (screenX - lastPanPos.x),
        y: prev.y + (screenY - lastPanPos.y)
      }));
      setLastPanPos({ x: screenX, y: screenY });
      return;
    }

    if (draggingUIElement) {
      setUIElements(prev => prev.map(el => 
        el.id === draggingUIElement ? { ...el, x, y } : el
      ));
      return;
    }

    // Check for hover
    const elements = kernel.getConstruction().getElements();
    const hovered = elements.slice().reverse().find(el => 
      el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / transform.scale
    ) as GeoPoint | undefined;
    setHoveredPoint(hovered || null);

    if (draggedElement) {
      if (draggedElement instanceof GeoPoint && draggedElement.isIndependent()) {
        draggedElement.setCoords(x, y);
      } else if (draggedElement instanceof GeoPoint && draggedElement.parentAlgo) {
          const algo = draggedElement.parentAlgo;
          if ((algo as any).updateParameter) {
              (algo as any).updateParameter(x, y);
              algo.update();
          }
      } else if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic || draggedElement instanceof GeoSegment || draggedElement instanceof GeoLine) {
          const dx = x - lastMousePos.x;
          const dy = y - lastMousePos.y;
          
          if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic) {
              (draggedElement as any).translate(new GeoVec3D(dx, dy, 0));
          } else {
              // For lines and segments, move their parent points
              if (draggedElement.parentAlgo) {
                  draggedElement.parentAlgo.getInput().forEach(el => {
                      if (el instanceof GeoPoint && el.isIndependent()) {
                          el.setCoords(el.getX() + dx, el.getY() + dy);
                      }
                  });
                  draggedElement.parentAlgo.update();
              }
          }
          setLastMousePos({ x, y });
      }
      // Update dependencies
      kernel.getConstruction().updateAllAlgorithms();
      setRefresh(r => r + 1);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    if (draggingUIElement) {
      setDraggingUIElement(null);
      return;
    }
    
    if (draggedElement && dragStartState) {
      const newState = captureState(kernel);
      let moved = false;
      newState.coords.forEach((newC, id) => {
        const oldC = dragStartState.coords.get(id);
        if (oldC && (oldC.x !== newC.x || oldC.y !== newC.y || oldC.z !== newC.z)) moved = true;
      });
      newState.numerics.forEach((newV, id) => {
        const oldV = dragStartState.numerics.get(id);
        if (oldV !== undefined && oldV !== newV) moved = true;
      });

      if (moved) {
        addCommand({ type: 'move', oldState: dragStartState, newState });
      }
    }
    
    setDraggedElement(null);
    setDragStartState(null);
  };

  const restoreState = (state: StateSnapshot) => {
    state.coords.forEach((coords, id) => {
      const el = kernel.getConstruction().getElementById(id);
      if (el instanceof GeoPoint) {
        el.setCoords(coords.x, coords.y, coords.z);
      }
    });
    state.numerics.forEach((val, id) => {
      const el = kernel.getConstruction().getElementById(id);
      if (el instanceof GeoNumeric) {
        el.setValue(val);
      }
    });
    kernel.getConstruction().updateAllAlgorithms();
  };

  const undo = () => {
    if (undoStack.current.length === 0) return;
    const cmd = undoStack.current.pop()!;
    redoStack.current.push(cmd);

    if (cmd.type === 'add') {
      const elements = [...cmd.elements].reverse();
      elements.forEach(el => kernel.getConstruction().removeElement(el));
      
      setSelectedElements(prev => prev.filter(e => !elements.includes(e as any)));
      setPolygonPoints(prev => prev.filter(e => !elements.includes(e as any)));
      
      kernel.getConstruction().updateAllAlgorithms();
    } else if (cmd.type === 'move') {
      restoreState(cmd.oldState);
    }
    setRefresh(r => r + 1);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const cmd = redoStack.current.pop()!;
    undoStack.current.push(cmd);

    if (cmd.type === 'add') {
      cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
      kernel.getConstruction().updateAllAlgorithms();
    } else if (cmd.type === 'move') {
      restoreState(cmd.newState);
    }
    setRefresh(r => r + 1);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const x = (mouseX - transform.x) / transform.scale;
    const y = (mouseY - transform.y) / transform.scale;
    
    const zoomFactor = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const scaleChange = direction > 0 ? zoomFactor : 1 / zoomFactor;
    
    setTransform(prev => {
      const newScale = prev.scale * scaleChange;
      if (newScale < 0.1 || newScale > 10) return prev;
      
      return {
        scale: newScale,
        x: mouseX - x * newScale,
        y: mouseY - y * newScale
      };
    });
  }, [transform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const zoom = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = rect.width / 2;
    const screenY = rect.height / 2;
    
    setTransform(prev => {
      const newScale = prev.scale * factor;
      if (newScale < 0.1 || newScale > 10) return prev;
      
      const x = (screenX - prev.x) / prev.scale;
      const y = (screenY - prev.y) / prev.scale;
      
      return {
        scale: newScale,
        x: screenX - x * newScale,
        y: screenY - y * newScale
      };
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            G
          </div>
          <h1 className="text-xl font-semibold text-gray-800 tracking-tight">{t('title')}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={undo}
            disabled={undoStack.current.length === 0}
            title={t('undo')}
          >
            <Undo2 size={20} />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={redo}
            disabled={redoStack.current.length === 0}
            title={t('redo')}
          >
            <Redo2 size={20} />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          
          <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md">
            <Globe size={16} />
            <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            >
                <option value="zh">中文</option>
                <option value="en">English</option>
            </select>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-gray-200 px-2 flex items-center gap-1 overflow-x-auto shrink-0 z-30 shadow-sm">
        <ToolButton icon={<MousePointer2 size={22} />} label={t('move')} active={mode === 'move'} onClick={() => setMode('move')} />
        
        <ToolButton icon={<Circle size={22} fill="currentColor" />} label={t('point')} active={mode === 'point'} onClick={() => setMode('point')} />
        
        <ToolButton icon={<Minus size={22} />} label={t('segment')} active={mode === 'segment'} onClick={() => setMode('segment')} />
        <ToolButton icon={<TrendingUp size={22} />} label={t('line')} active={mode === 'line'} onClick={() => setMode('line')} />
        
        <div className="relative z-[100] circle-menu-container">
          <button
            ref={circleMenuRef}
            className={`p-2 rounded-lg flex items-center justify-center gap-1 min-w-[3rem] transition-all ${
              (mode === 'circle' || mode === 'circle_center_point' || mode === 'circle3')
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowCircleMenu(!showCircleMenu)}
            title={t('circleTools')}
          >
            <CircleDot size={22} />
            {showCircleMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showCircleMenu && (
            <div 
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[180px]"
              style={{
                top: `${circleMenuPosition.top}px`,
                left: `${circleMenuPosition.left}px`
              }}>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'circle' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  setMode('circle');
                  setShowCircleMenu(false);
                }}
              >
                <Circle size={18} />
                <span>{t('circleRadius')}</span>
              </button>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'circle_center_point' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  setMode('circle_center_point');
                  setShowCircleMenu(false);
                }}
              >
                <CircleDashed size={18} />
                <span>{t('circleCenterPoint')}</span>
              </button>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'circle3' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  setMode('circle3');
                  setShowCircleMenu(false);
                }}
              >
                <Target size={18} />
                <span>{t('circle3Points')}</span>
              </button>
            </div>
          )}
        </div>
        
        {mode === 'circle' && (
          <div className="flex items-center gap-1 px-2 border border-gray-200 rounded-md bg-gray-50">
            <span className="text-xs font-medium text-gray-500">R=</span>
            <input 
              type="number" 
              value={radius} 
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-12 px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              min="1"
            />
          </div>
        )}
        {/* <div className="w-px h-8 bg-gray-200 mx-1"></div> */}
        
        <ToolButton icon={<Hexagon size={22} />} label={t('polygon')} active={mode === 'polygon'} onClick={() => setMode('polygon')} />
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <ToolButton icon={<X size={22} />} label={t('intersect')} active={mode === 'intersect'} onClick={() => setMode('intersect')} />
        <ToolButton icon={<Crosshair size={22} />} label={t('midpoint')} active={mode === 'midpoint'} onClick={() => setMode('midpoint')} />
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <ToolButton icon={<Equal size={22} />} label={t('parallel')} active={mode === 'parallel'} onClick={() => setMode('parallel')} />
        <ToolButton icon={<Baseline size={22} />} label={t('orthogonal')} active={mode === 'orthogonal'} onClick={() => setMode('orthogonal')} />
        <ToolButton icon={<SplitSquareVertical size={22} />} label={t('perpendicularBisector')} active={mode === 'perpendicular_bisector'} onClick={() => setMode('perpendicular_bisector')} />
        <ToolButton icon={<Scissors size={22} />} label={t('angleBisector')} active={mode === 'angle_bisector'} onClick={() => setMode('angle_bisector')} />
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-medium text-gray-600">{t('label')}:</span>
          <input
            type="text"
            value={editingLabel}
            onChange={handleLabelChange}
            onBlur={handleLabelSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSubmit(); }}
            disabled={selectedElements.length !== 1}
            placeholder={selectedElements.length === 1 ? '' : 'Select one object'}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        <div className="flex items-center gap-1">
          <button
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[3rem] transition-all ${
              showAxes 
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowAxes(!showAxes)}
            title={t('toggleAxes')}
          >
            <Axis3D size={22} />
          </button>
          <button
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[3rem] transition-all ${
              showGrid 
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowGrid(!showGrid)}
            title={t('toggleGrid')}
          >
            <Grid3X3 size={22} />
          </button>
        </div>
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <div className="relative z-[100] insert-menu-container">
          <button
            ref={insertMenuRef}
            className={`p-2 rounded-lg flex items-center justify-center gap-1 min-w-[3rem] transition-all ${
              showInsertMenu
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowInsertMenu(!showInsertMenu)}
            title={t('insertTools')}
          >
            <Plus size={22} />
            {showInsertMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showInsertMenu && (
            <div 
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[180px]"
              style={{
                top: `${insertMenuPosition.top}px`,
                left: `${insertMenuPosition.left}px`
              }}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('text');
                  setShowInsertMenu(false);
                }}
              >
                <Type size={18} />
                <span>{t('insertText')}</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('slider');
                  setShowInsertMenu(false);
                }}
              >
                <Sliders size={18} />
                <span>{t('insertSlider')}</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('button');
                  setShowInsertMenu(false);
                }}
              >
                <ToggleLeft size={18} />
                <span>{t('insertButton')}</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('checkbox');
                  setShowInsertMenu(false);
                }}
              >
                <CheckSquare size={18} />
                <span>{t('insertCheckbox')}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1"></div>
        <button 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${isAnimating ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={toggleAnimation}
        >
            {isAnimating ? <Pause size={18} /> : <Play size={18} />}
            <span className="text-sm">{isAnimating ? t('pause') : t('play')}</span>
        </button>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar - Algebra View */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Menu size={18} />
              {t('algebraView')}
            </h3>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
              {kernel.getConstruction().getElements().length} {t('objects')}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {kernel.getConstruction().getElements().map(el => {
                let typeName = el.getClassName();
                if (typeName === 'GeoPoint') typeName = t('typePoint');
                else if (typeName === 'GeoLine') typeName = t('typeLine');
                else if (typeName === 'GeoSegment') typeName = t('typeSegment');
                else if (typeName === 'GeoConic') typeName = t('typeCircle');
                else if (typeName === 'GeoPolygon') typeName = t('typePolygon');
                else if (typeName === 'GeoNumeric') typeName = t('typeNumeric');

                return (
                    <div key={el.id} className="group flex flex-col p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                          <span className="font-semibold text-gray-800">{el.getNameDescription()}</span>
                        </div>
                        <div className="text-sm text-gray-500 ml-5 font-mono mt-0.5">
                            {el instanceof GeoPoint ? `(${el.getX().toFixed(2)}, ${el.getY().toFixed(2)})` : typeName}
                        </div>
                    </div>
                );
            })}
            {kernel.getConstruction().getElements().length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-10 p-4">
                {t('emptyState')}
              </div>
            )}
          </div>

          {/* Animations & Controls */}
          {kernel.getConstruction().getElements().filter(el => el instanceof GeoNumeric && el.isAnimatable()).length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 flex flex-col max-h-64">
              <div className="p-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700 text-sm">{t('animationsAndControls')}</h3>
              </div>
              <div className="p-2 overflow-y-auto space-y-2">
                  {kernel.getConstruction().getElements()
                      .filter(el => el instanceof GeoNumeric && el.isAnimatable())
                      .map(el => (
                          <SliderControl key={el.id} numeric={el as GeoNumeric} kernel={kernel} />
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-white z-0" ref={containerRef}>
          <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className={`absolute top-0 left-0 ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              style={{ touchAction: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={handleContextMenu}
          />
          
          {/* UI Elements */}
          {uiElements.map(element => {
            const screenX = element.x * transform.scale + transform.x;
            const screenY = element.y * transform.scale + transform.y;
            
            const handleUIDragStart = (e: React.MouseEvent) => {
              e.stopPropagation();
              setDraggingUIElement(element.id);
            };
            
            if (element.type === 'text') {
              return (
                <div
                  key={element.id}
                  className="absolute"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {editingUIElement === element.id ? (
                    <input
                      type="text"
                      defaultValue={element.label}
                      autoFocus
                      onBlur={(e) => {
                        const updated = uiElements.map(el => 
                          el.id === element.id ? { ...el, label: e.target.value } : el
                        );
                        setUIElements(updated);
                        setEditingUIElement(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const updated = uiElements.map(el => 
                            el.id === element.id ? { ...el, label: (e.target as HTMLInputElement).value } : el
                          );
                          setUIElements(updated);
                          setEditingUIElement(null);
                        }
                      }}
                      className="px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none"
                    />
                  ) : (
                    <div 
                      className="px-3 py-2 bg-white border border-gray-300 rounded shadow-sm cursor-move hover:border-blue-400"
                      onDoubleClick={() => setEditingUIElement(element.id)}
                      onMouseDown={handleUIDragStart}
                    >
                      {element.label}
                    </div>
                  )}
                </div>
              );
            } else if (element.type === 'slider') {
              return (
                <div
                  key={element.id}
                  className="absolute bg-white border border-gray-300 rounded-lg shadow-sm p-3 cursor-move"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseDown={handleUIDragStart}
                >
                  <div className="text-sm font-medium mb-2">{element.label}</div>
                  <input
                    type="range"
                    min={element.min}
                    max={element.max}
                    step={element.step}
                    value={element.value}
                    onChange={(e) => {
                      e.stopPropagation();
                      const updated = uiElements.map(el => 
                        el.id === element.id ? { ...el, value: Number(e.target.value) } : el
                      );
                      setUIElements(updated);
                    }}
                    className="w-32"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <div className="text-xs text-gray-600 mt-1 text-center">{element.value}</div>
                </div>
              );
            } else if (element.type === 'button') {
              return (
                <button
                  key={element.id}
                  className="absolute px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors cursor-move"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseDown={handleUIDragStart}
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Button "${element.label}" clicked!`);
                  }}
                >
                  {element.label}
                </button>
              );
            } else if (element.type === 'checkbox') {
              return (
                <label
                  key={element.id}
                  className="absolute flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 cursor-move hover:border-blue-400"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseDown={handleUIDragStart}
                >
                  <input
                    type="checkbox"
                    checked={element.checked}
                    onChange={(e) => {
                      e.stopPropagation();
                      const updated = uiElements.map(el => 
                        el.id === element.id ? { ...el, checked: e.target.checked } : el
                      );
                      setUIElements(updated);
                    }}
                    className="w-4 h-4"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm">{element.label}</span>
                </label>
              );
            }
            return null;
          })}
          
          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white">
              <button 
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100"
                  onClick={() => zoom(1.2)}
                  title={t('zoomIn')}
              >
                  <ZoomIn size={20} />
              </button>
              <button 
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100"
                  onClick={() => zoom(1 / 1.2)}
                  title={t('zoomOut')}
              >
                  <ZoomOut size={20} />
              </button>
              <button 
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                  onClick={() => {
                    const dpr = window.devicePixelRatio || 1;
                    const width = canvasSize.width / dpr;
                    const height = canvasSize.height / dpr;
                    setTransform({ x: width / 2, y: height / 2, scale: 1 });
                  }}
                  title={t('resetView')}
              >
                  <Home size={20} />
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for toolbar buttons
const ToolButton: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  
  React.useEffect(() => {
    if (showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      });
    }
  }, [showTooltip]);
  
  return (
    <div className="relative z-[100]">
      <button
        ref={buttonRef}
        className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[3rem] transition-all ${
          active 
            ? 'bg-blue-100 text-blue-700 shadow-inner' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {icon}
      </button>
      
      {showTooltip && (
        <div 
          className="fixed px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap z-[9999] pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translate(-50%, -100%)'
          }}>
          {label}
          <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};
