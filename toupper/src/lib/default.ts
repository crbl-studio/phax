import type { Brush } from "$lib/drinfo";
import { percentageToU32 } from "./util";

export const getDefaultBrush = (): Brush => ({
  color: "#000000",
  width: 10,
  hardness: percentageToU32(100),
  brushShape: {
    shape: "circle",
  },
  opacity: percentageToU32(100),
  erase: false,
  repeat: percentageToU32(8),
});

export const getSecondaryDefaultBrush = (): Brush => ({
  ...getDefaultBrush(),
  color: "#ffffff",
});
