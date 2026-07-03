import type { Point } from "./drinfo";
import type { CameraState } from "./state.svelte";

export const getRealX = (element: HTMLElement, e: MouseEvent) => {
  const rect = element.getBoundingClientRect();
  return (e.clientX - rect.left) * window.devicePixelRatio;
};

export const getRealY = (element: HTMLElement, e: MouseEvent) => {
  const rect = element.getBoundingClientRect();
  return (e.clientY - rect.top) * window.devicePixelRatio;
};

export const rgbToStr = (r: number, g: number, b: number): `#${string}` => {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const strToRgb = (str: `#${string}`): { r: number; g: number; b: number } => {
  if (str.length != 4 && str.length != 7) {
    throw new Error("Invalid color string.");
  }
  return {
    r: parseInt(str.slice(1, 3), 16),
    g: parseInt(str.slice(3, 5), 16),
    b: parseInt(str.slice(5, 7), 16),
  };
};

export const rgboToStr = (r: number, g: number, b: number, opacity: number) => {
  return `rgba(${r} ${g} ${b} / ${(opacity * 100) / (2 ** 32 - 1)}%)`;
};

export const getDistance = (a: Point, b: Point): number =>
  Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

export const u32ToPercentage = (u32: number) => Math.round((u32 * 100) / (2 ** 32 - 1));
export const percentageToU32 = (percentage: number) =>
  Math.round((percentage * (2 ** 32 - 1)) / 100);

export const translateSelection = (
  selection: Point[],
  end: Point,
  scale: Point = { x: 1, y: 1 },
  rotate: number = 0,
) => {
  const cx = selection.reduce((sum, p) => sum + p.x, 0) / selection.length;
  const cy = selection.reduce((sum, p) => sum + p.y, 0) / selection.length;
  const dx = end.x - selection[0].x;
  const dy = end.y - selection[0].y;
  const angle = (rotate * Math.PI * 2) / (2 ** 32 - 1);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return selection.map((p) => {
    const rx = (p.x - cx) * scale.x;
    const ry = (p.y - cy) * scale.y;
    return {
      x: rx * cos - ry * sin + cx + dx,
      y: rx * sin + ry * cos + cy + dy,
    };
  });
};

export const translatePointR2C = (point: Point, camera: CameraState) => {
  return {
    x: ((point.x - camera.position.x) / camera.zoom) * 100,
    y: ((point.y - camera.position.y) / camera.zoom) * 100,
  };
};

export const translatePointC2R = (point: Point, camera: CameraState) => {
  return {
    x: (point.x * camera.zoom) / 100 + camera.position.x,
    y: (point.y * camera.zoom) / 100 + camera.position.y,
  };
};

export const floorPoint = (point: Point) => {
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
  };
};
