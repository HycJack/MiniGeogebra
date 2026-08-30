import { useEffect, useRef, useCallback, DependencyList } from 'react';

/**
 * RAF 驱动的绘制循环 hook（对标 GeoGebra/JSXGraph 的渲染节流思想）。
 *
 * 作用：把高频触发源（kernel notifyUpdate、pointermove、hover）收敛到
 * requestAnimationFrame，保证“一帧最多绘制一次”，避免 pointermove 连续
 * setState 导致的多重重绘与掉帧。
 *
 * @param draw 不含副作用的纯绘制回调（每帧至多执行一次）
 * @param deps 依赖数组——任一变化都会调度下一帧绘制
 */
export function useRenderLoop(draw: () => void, deps: DependencyList) {
  const drawRef = useRef(draw);
  const depsRef = useRef(deps);
  const frameRef = useRef<number | null>(null);

  drawRef.current = draw;
  depsRef.current = deps;

  const schedule = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      drawRef.current();
    });
  }, []);

  // 依赖变化 → 调度一帧
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    schedule();
  }, deps);

  // 卸载时取消未完成的帧
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    },
    []
  );

  return { schedule };
}
