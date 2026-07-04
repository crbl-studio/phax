import type {
  Brush,
  Bucket,
  ImageInsertion,
  Instruction,
  Motion,
  Point,
  Stroke,
} from "$lib/drinfo";
import { rgboToStr, strToRgb, getDistance, u32ToPercentage } from "$lib/util";
import { drawImage } from "./draw";

const U32_MAX = 2 ** 32 - 1;

const generateShape = (brush: Brush): OffscreenCanvas => {
  const canvas = new OffscreenCanvas(brush.width, brush.width);
  const context = canvas.getContext("2d")!;
  const color = strToRgb(brush.color);
  const full = rgboToStr(color.r, color.g, color.b, U32_MAX);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = brush.width;
  if (brush.brushShape.shape === "circle") {
    const radius = brush.width / 2;
    if (u32ToPercentage(brush.hardness) === 100) {
      context.fillStyle = full;
    } else {
      const grad = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
      grad.addColorStop(brush.hardness / U32_MAX, full);
      grad.addColorStop(1, rgboToStr(color.r, color.g, color.b, 0));
      context.fillStyle = grad;
    }
    context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillRect(0, 0, brush.width, brush.width);
  }
  const imageData = context.getImageData(0, 0, brush.width, brush.width);
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = color.r;
    imageData.data[i + 1] = color.g;
    imageData.data[i + 2] = color.b;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
};

const getPointOnSegment = (a: Point, b: Point, distance: number): Point => {
  const l = getDistance(a, b);
  const u = [(b.x - a.x) / l, (b.y - a.y) / l];
  return {
    x: a.x + distance * u[0],
    y: a.y + distance * u[1],
  };
};

export type StrokeResumeState = {
  lastDrawDistance: number;
  segmentIndex: number;
  segmentStartDistance: number;
  pointCount: number;
};

export const resumeStroke = (
  stroke: Stroke,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  state: StrokeResumeState,
): StrokeResumeState => {
  if (!context) {
    console.warn("No context for draw.");
    return state;
  }
  if (stroke.points.length === 0) return state;

  context.globalCompositeOperation = "source-over";
  context.imageSmoothingEnabled = false;

  const brushImage = generateShape(stroke.brush);
  const spacing = Math.max((stroke.brush.repeat * stroke.brush.width) / U32_MAX, 1);

  if (state.pointCount === 0) {
    context.drawImage(
      brushImage,
      stroke.points[0].x - stroke.brush.width / 2,
      stroke.points[0].y - stroke.brush.width / 2,
    );
  }

  let nextDrawDistance = state.lastDrawDistance + spacing;
  let segStart = state.segmentStartDistance;
  let segmentIndex = state.segmentIndex;

  for (let i = segmentIndex; i < stroke.points.length - 1; i++) {
    const segLen = Math.max(getDistance(stroke.points[i], stroke.points[i + 1]), 1);
    const segEnd = segStart + segLen;

    while (nextDrawDistance <= segEnd) {
      const position = getPointOnSegment(
        stroke.points[i],
        stroke.points[i + 1],
        nextDrawDistance - segStart,
      );
      context.drawImage(
        brushImage,
        position.x - stroke.brush.width / 2,
        position.y - stroke.brush.width / 2,
      );
      nextDrawDistance += spacing;
    }

    segStart = segEnd;
    segmentIndex = i + 1;
  }

  return {
    lastDrawDistance: nextDrawDistance - spacing,
    segmentIndex,
    segmentStartDistance: segStart,
    pointCount: stroke.points.length,
  };
};

export const applyStrokeCanvas = (
  brush: Brush,
  buffer: OffscreenCanvas,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): void => {
  const opacity = brush.opacity / U32_MAX;
  if (opacity <= 0) return;
  context.save();
  context.globalAlpha = opacity;
  context.globalCompositeOperation = brush.erase ? "destination-out" : "source-over";
  context.imageSmoothingEnabled = false;
  context.drawImage(buffer, 0, 0);
  context.restore();
};

export const stroke = (
  stroke: Stroke,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  const buffer = new OffscreenCanvas(context.canvas.width, context.canvas.height);
  const bufferCtx = buffer.getContext("2d")!;
  resumeStroke(stroke, bufferCtx, {
    lastDrawDistance: 0,
    segmentIndex: 0,
    segmentStartDistance: 0,
    pointCount: 0,
  });
  applyStrokeCanvas(stroke.brush, buffer, context);
};

const traceSelection = (
  motion: Motion,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  context.beginPath();
  context.moveTo(motion.selection[0].x, motion.selection[0].y);
  for (let i = 1; i < motion.selection.length; i++) {
    context.lineTo(motion.selection[i].x, motion.selection[i].y);
  }
  context.closePath();
};

export const motion = (
  motion: Motion,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  if (!context) {
    console.warn("No context for draw.");
    return;
  }
  if (motion.selection.length < 3) return;

  const dx = motion.end.x - motion.selection[0].x;
  const dy = motion.end.y - motion.selection[0].y;
  const scale = motion.scale ?? { x: 1, y: 1 };
  const rotate = motion.rotate ?? 0;

  const tempCanvas = new OffscreenCanvas(context.canvas.width, context.canvas.height);
  const tempContext = tempCanvas.getContext("2d")!;
  traceSelection(motion, tempContext);
  tempContext.clip();
  tempContext.drawImage(context.canvas, 0, 0);

  context.globalCompositeOperation = "destination-out";
  traceSelection(motion, context);
  context.fill();

  context.globalCompositeOperation = "source-over";
  const cx = motion.selection.reduce((sum, p) => sum + p.x, 0) / motion.selection.length;
  const cy = motion.selection.reduce((sum, p) => sum + p.y, 0) / motion.selection.length;
  context.save();
  context.translate(cx + dx, cy + dy);
  context.rotate((rotate * Math.PI * 2) / (2 ** 32 - 1));
  context.drawImage(
    tempCanvas,
    0,
    0,
    tempCanvas.width,
    tempCanvas.height,
    -cx * scale.x,
    -cy * scale.y,
    tempCanvas.width * scale.x,
    tempCanvas.height * scale.y,
  );
  context.restore();
};

export const insertImage = async (
  imageInsertion: ImageInsertion,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  imageCache: Map<string, HTMLImageElement>,
) => {
  let image = imageCache.get(imageInsertion.base64);
  if (!image) {
    image = new Image();
    await new Promise((resolve, reject) => {
      image!.onload = resolve;
      image!.onerror = reject;
      image!.src = imageInsertion.base64;
    });
    imageCache.set(imageInsertion.base64, image);
  }
  drawImage(image, imageInsertion, context);
};

export const bucket = (
  bucket: Bucket,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  const imgd = context.getImageData(bucket.point.x, bucket.point.y, 1, 1);
  const colorToPaint = {
    r: imgd.data[0],
    g: imgd.data[1],
    b: imgd.data[2],
    a: imgd.data[3],
  };

  const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  const fillColor = {
    ...strToRgb(bucket.brush.color),
    a: (bucket.brush.opacity * 255) / (2 ** 32 - 1),
  };

  const colorMatch = (pixelPos: number) => {
    const r = imageData.data[pixelPos];
    const g = imageData.data[pixelPos + 1];
    const b = imageData.data[pixelPos + 2];
    const a = imageData.data[pixelPos + 3];
    const tolerance = (bucket.tolerance * 255) / (2 ** 32 - 1);
    return (
      Math.abs(r - colorToPaint.r) < tolerance &&
      Math.abs(g - colorToPaint.g) < tolerance &&
      Math.abs(b - colorToPaint.b) < tolerance &&
      Math.abs(a - colorToPaint.a) < tolerance
    );
  };

  const colorPixel = (pixelPos: number) => {
    imageData.data[pixelPos] = fillColor.r;
    imageData.data[pixelPos + 1] = fillColor.g;
    imageData.data[pixelPos + 2] = fillColor.b;
    imageData.data[pixelPos + 3] = fillColor.a;
  };

  const pixelStack = [[Math.floor(bucket.point.x), Math.floor(bucket.point.y)]];

  const atTheEnd: number[] = [];
  const pushSurroundingToAtTheEnd = (pixelPos: number) => {
    atTheEnd.push(pixelPos + 4);
    atTheEnd.push(pixelPos - 4);
    atTheEnd.push(pixelPos + context.canvas.width * 4);
    atTheEnd.push(pixelPos - context.canvas.width * 4);
  };

  while (pixelStack.length) {
    const newPos = pixelStack.pop();
    const x = newPos![0];
    let y, pixelPos, reachLeft, reachRight;
    y = newPos![1];

    pixelPos = (y * context.canvas.width + x) * 4;
    while (y-- >= 0 && colorMatch(pixelPos)) {
      pixelPos -= context.canvas.width * 4;
    }
    if (!colorMatch(pixelPos)) {
      pushSurroundingToAtTheEnd(pixelPos);
    }
    pixelPos += context.canvas.width * 4;
    ++y;
    reachLeft = false;
    reachRight = false;
    while (y++ < context.canvas.height - 1 && colorMatch(pixelPos)) {
      colorPixel(pixelPos);

      if (x > 0) {
        if (colorMatch(pixelPos - 4)) {
          if (!reachLeft) {
            pixelStack.push([x - 1, y]);
            reachLeft = true;
          }
        } else {
          if (!colorMatch(pixelPos)) {
            pushSurroundingToAtTheEnd(pixelPos);
          }
          if (reachLeft) {
            reachLeft = false;
          }
        }
      }

      if (x < context.canvas.width - 1) {
        if (colorMatch(pixelPos + 4)) {
          if (!reachRight) {
            pixelStack.push([x + 1, y]);
            reachRight = true;
          }
        } else {
          if (!colorMatch(pixelPos)) {
            pushSurroundingToAtTheEnd(pixelPos);
          }
          if (reachRight) {
            reachRight = false;
          }
        }
      }

      pixelPos += context.canvas.width * 4;
    }
    if (!colorMatch(pixelPos)) {
      pushSurroundingToAtTheEnd(pixelPos);
    }
  }
  for (const pixel of atTheEnd) {
    colorPixel(pixel);
  }
  context.putImageData(imageData, 0, 0);
};

export const applyInstruction = async (
  instruction: Instruction,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  imageCache: Map<string, HTMLImageElement>,
) => {
  if ("points" in instruction) {
    stroke(instruction, context);
  } else if ("selection" in instruction) {
    motion(instruction, context);
  } else if ("point" in instruction && "base64" in instruction) {
    await insertImage(instruction, context, imageCache);
  } else if ("point" in instruction && "brush" in instruction) {
    bucket(instruction, context);
  }
};
