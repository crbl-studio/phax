import type { Brush } from "./brush";
import type { Point } from "./point";

export type Stroke = {
  points: Point[];
  brush: Brush;
  selection?: Point[];
};

export type Motion = {
  end: Point;
  selection: Point[];
  scale: Point;
  rotate: number;
};

export type ImageInsertion = {
  base64: string;
  point: Point;
  scale: Point;
  rotate: number;
};

export type Bucket = {
  point: Point;
  brush: Brush;
  tolerance: number;
  selection?: Point[];
};

export type Instruction = Stroke | Motion | ImageInsertion | Bucket;

export type InstructionBox = {
  instruction: Instruction;
  uuid: string;
  applied: boolean;
};
