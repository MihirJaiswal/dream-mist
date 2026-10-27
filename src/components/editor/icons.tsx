import type { Target, Tool } from "@/game/editor/constants";
import { CloudSun, DoorOpen, Eraser, Eyedropper, FlagBanner, type Icon, MapPin, PaintBrush, PaintBucket, Plant, Prohibit, SelectionPlus, Square, Stack, TreeEvergreen, Users } from "@phosphor-icons/react";

/** Icon of each painting tool */
export const toolIcons: Record<Tool, Icon> = {
  brush: PaintBrush,
  erase: Eraser,
  rect: Square,
  fill: PaintBucket,
  pick: Eyedropper,
  select: SelectionPlus,
};

/** Icon of each editing target */
export const targetIcons: Record<Target, Icon> = {
  ground: Stack,
  decor: TreeEvergreen,
  above: CloudSun,
  solid: Prohibit,
  zone: Plant,
  story: FlagBanner,
  door: DoorOpen,
  npc: Users,
  spawn: MapPin,
};
