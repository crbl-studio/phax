import type { Brush, Point } from "$lib/drinfo";
import { type Cursor, ToolType } from "$lib/types";

const renderSelectionCursor = (
  cursorContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ratio: number,
  point: Point,
  username: string | null,
) => {
  cursorContext.lineWidth = 4 * ratio;
  cursorContext.strokeStyle = "#ffffff";

  cursorContext.beginPath();
  cursorContext.moveTo(point.x - 11 * ratio, point.y);
  cursorContext.lineTo(point.x + 11 * ratio, point.y);
  cursorContext.stroke();

  cursorContext.beginPath();
  cursorContext.moveTo(point.x, point.y - 11 * ratio);
  cursorContext.lineTo(point.x, point.y + 11 * ratio);
  cursorContext.stroke();

  cursorContext.lineWidth = 2 * ratio;
  cursorContext.strokeStyle = "#000000";

  cursorContext.beginPath();
  cursorContext.moveTo(point.x - 10 * ratio, point.y);
  cursorContext.lineTo(point.x + 10 * ratio, point.y);
  cursorContext.stroke();

  cursorContext.beginPath();
  cursorContext.moveTo(point.x, point.y - 10 * ratio);
  cursorContext.lineTo(point.x, point.y + 10 * ratio);
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
  if (brush.width * ratio < 20 && brush.brushShape.shape === "circle") {
    cursorContext.lineWidth = 4 * ratio;
    cursorContext.strokeStyle = "#ffffff";

    cursorContext.beginPath();
    cursorContext.moveTo(point.x - 12 * ratio - brush.width / 2, point.y);
    cursorContext.lineTo(point.x - 3 * ratio - brush.width / 2, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y - 12 * ratio - brush.width / 2);
    cursorContext.lineTo(point.x, point.y - 3 * ratio - brush.width / 2);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x + 12 * ratio + brush.width / 2, point.y);
    cursorContext.lineTo(point.x + 3 * ratio + brush.width / 2, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y + 12 * ratio + brush.width / 2);
    cursorContext.lineTo(point.x, point.y + 3 * ratio + brush.width / 2);
    cursorContext.stroke();

    cursorContext.lineWidth = 2 * ratio;
    cursorContext.strokeStyle = "#000000";

    cursorContext.beginPath();
    cursorContext.moveTo(point.x - 11 * ratio - brush.width / 2, point.y);
    cursorContext.lineTo(point.x - 4 * ratio - brush.width / 2, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y - 11 * ratio - brush.width / 2);
    cursorContext.lineTo(point.x, point.y - 4 * ratio - brush.width / 2);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x + 11 * ratio + brush.width / 2, point.y);
    cursorContext.lineTo(point.x + 4 * ratio + brush.width / 2, point.y);
    cursorContext.stroke();

    cursorContext.beginPath();
    cursorContext.moveTo(point.x, point.y + 11 * ratio + brush.width / 2);
    cursorContext.lineTo(point.x, point.y + 4 * ratio + brush.width / 2);
    cursorContext.stroke();
  }
  const drawCursor = () => {
    if (brush.brushShape.shape === "circle") {
      cursorContext.lineWidth = 1 * ratio;
      cursorContext.beginPath();
      cursorContext.arc(point.x, point.y, brush.width / 2, 0, 2 * Math.PI);
      cursorContext.stroke();
    } else if (brush.brushShape.shape === "square") {
      cursorContext.lineWidth = 1 * ratio;
      cursorContext.beginPath();
      cursorContext.strokeRect(
        point.x - brush.width / 2,
        point.y - brush.width / 2,
        brush.width,
        brush.width,
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
      brush.brushShape.shape === "square" ? brush.width / 2 + 10 : Math.max(brush.width / 2, 15);
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
  ratio: number,
  cursor: Cursor | null,
  username: string | null,
) => {
  if (cursor?.tool?.type === ToolType.Stroke || cursor?.tool?.type === ToolType.Eraser) {
    renderStrokeCursor(cursorContext, ratio, cursor.point, cursor.tool.brush, username);
  } else if (cursor) {
    renderSelectionCursor(cursorContext, ratio, cursor.point, username);
  }
};

export const renderSelection = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: Point[],
  close: boolean,
  ratio: number,
  username: string | null,
) => {
  context.lineWidth = 1;
  context.strokeStyle = "#000000";
  context.setLineDash([6 / ratio, 6 / ratio]);

  if (points.length === 0) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    context.lineTo(points[i].x, points[i].y);
  }
  if (close) context.closePath();
  context.stroke();

  context.setLineDash([]);

  if (username) {
    renderUsername(context, { x: points[0].x, y: points[0].y - 4 }, username);
  }
};
