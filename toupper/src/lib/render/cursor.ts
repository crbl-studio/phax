import type { Brush, Point } from "$lib/drinfo";
import type { CameraState } from "$lib/state.svelte";
import { type Cursor, ToolType } from "$lib/types";
import { translatePointC2R } from "$lib/util";

const renderSelectionCursor = (
  cursorContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  point: Point,
  username: string | null,
) => {
  cursorContext.lineWidth = 4;
  cursorContext.strokeStyle = "#ffffff";

  cursorContext.beginPath();
  cursorContext.moveTo(point.x - 11, point.y);
  cursorContext.lineTo(point.x + 11, point.y);
  cursorContext.stroke();

  cursorContext.beginPath();
  cursorContext.moveTo(point.x, point.y - 11);
  cursorContext.lineTo(point.x, point.y + 11);
  cursorContext.stroke();

  cursorContext.lineWidth = 2;
  cursorContext.strokeStyle = "#000000";

  cursorContext.beginPath();
  cursorContext.moveTo(point.x - 10, point.y);
  cursorContext.lineTo(point.x + 10, point.y);
  cursorContext.stroke();

  cursorContext.beginPath();
  cursorContext.moveTo(point.x, point.y - 10);
  cursorContext.lineTo(point.x, point.y + 10);
  cursorContext.stroke();

  if (username !== null) {
    renderUsername(cursorContext, { x: point.x + 5, y: point.y + 5 }, username);
  }
};

const renderStrokeCursor = (
  cursorContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ratio: number,
  point: Point | undefined,
  brush: Brush,
  username: string | null,
) => {
  if (!point) {
    return;
  }
  cursorContext.setLineDash([]);
  const brushDisplayRadius = (brush.width / 2) * ratio;
  if (brush.width * ratio < 20 && brush.brushShape.shape === "circle") {
    cursorContext.lineWidth = 4;
    cursorContext.strokeStyle = "#ffffff";

    cursorContext.beginPath();
    cursorContext.moveTo(point.x - 12 - brushDisplayRadius, point.y);
    cursorContext.lineTo(point.x - 3 - brushDisplayRadius, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y - 12 - brushDisplayRadius);
    cursorContext.lineTo(point.x, point.y - 3 - brushDisplayRadius);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x + 12 + brushDisplayRadius, point.y);
    cursorContext.lineTo(point.x + 3 + brushDisplayRadius, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y + 12 + brushDisplayRadius);
    cursorContext.lineTo(point.x, point.y + 3 + brushDisplayRadius);
    cursorContext.stroke();

    cursorContext.lineWidth = 2;
    cursorContext.strokeStyle = "#000000";

    cursorContext.beginPath();
    cursorContext.moveTo(point.x - 11 - brushDisplayRadius, point.y);
    cursorContext.lineTo(point.x - 4 - brushDisplayRadius, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y - 11 - brushDisplayRadius);
    cursorContext.lineTo(point.x, point.y - 4 - brushDisplayRadius);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x + 11 + brushDisplayRadius, point.y);
    cursorContext.lineTo(point.x + 4 + brushDisplayRadius, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y + 11 + brushDisplayRadius);
    cursorContext.lineTo(point.x, point.y + 4 + brushDisplayRadius);
    cursorContext.stroke();
  }
  const drawCursor = () => {
    if (brush.brushShape.shape === "circle") {
      cursorContext.lineWidth = 1;
      cursorContext.beginPath();
      cursorContext.arc(point.x, point.y, brushDisplayRadius, 0, 2 * Math.PI);
      cursorContext.stroke();
    } else if (brush.brushShape.shape === "square") {
      cursorContext.lineWidth = 1;
      cursorContext.beginPath();
      cursorContext.strokeRect(
        point.x - brushDisplayRadius,
        point.y - brushDisplayRadius,
        brushDisplayRadius * 2,
        brushDisplayRadius * 2,
      );
      cursorContext.stroke();
    }
  };
  cursorContext.setLineDash([]);
  cursorContext.strokeStyle = "#000000";
  drawCursor();
  cursorContext.setLineDash([5, 5]);
  cursorContext.strokeStyle = "#ffffff";
  drawCursor();
  if (username !== null) {
    const offset =
      brush.brushShape.shape === "square" ? brushDisplayRadius + 10 : Math.max(brush.width / 2, 15);
    renderUsername(cursorContext, { x: point.x + offset, y: point.y + offset }, username);
  }
  cursorContext.setLineDash([]);
};

const renderUsername = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  point: Point,
  username: string,
) => {
  context.font = "20px Arial";
  context.fillStyle = "#000000";
  context.fillText(username, point.x, point.y);
};

export const renderTool = (
  cursorContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  zoom: number,
  cursor: Cursor | null,
  username: string | null,
) => {
  const ratio = zoom / 100;
  if (cursor?.tool?.type === ToolType.Stroke || cursor?.tool?.type === ToolType.Eraser) {
    renderStrokeCursor(cursorContext, ratio, cursor.point, cursor.tool.brush, username);
  } else if (cursor) {
    renderSelectionCursor(cursorContext, cursor.point, username);
  }
};

export const renderSelection = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: Point[],
  close: boolean,
  camera: CameraState,
  username: string | null,
) => {
  const transaltedPoints = points.map((p) => translatePointC2R(p, camera));
  context.lineWidth = 1;
  const draw = () => {
    if (transaltedPoints.length === 0) return;
    context.beginPath();
    context.moveTo(transaltedPoints[0].x, transaltedPoints[0].y);
    for (let i = 1; i < transaltedPoints.length; i++) {
      context.lineTo(transaltedPoints[i].x, transaltedPoints[i].y);
    }
    if (close) context.closePath();
    context.stroke();
  };
  context.strokeStyle = "#000000";
  context.setLineDash([]);
  draw();
  context.strokeStyle = "#ffffff";
  context.setLineDash([6, 6]);
  draw();
  context.setLineDash([]);

  if (username) {
    renderUsername(context, { x: transaltedPoints[0].x, y: transaltedPoints[0].y - 4 }, username);
  }
};
