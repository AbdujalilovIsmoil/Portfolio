import type { DoorSystem } from "./Doors";
import type { Ctx } from "./core";

/**
 * Seats you can sit on: walk up, press E and the character turns round and sits down; any
 * movement key (or E again) stands back up. `yaw` is the way the sitter faces (0 = +z).
 * (x, z) is where the hips go; y the floor under the seat.
 */
export interface SeatSpec {
  x: number;
  z: number;
  yaw: number;
  y: number;
  /** called on sitting down / standing up (e.g. to start and stop the TV) */
  onSit?: () => void;
  onStand?: () => void;
}

export function addSeat(ctx: Ctx, doors: DoorSystem, s: SeatSpec) {
  const seat = { x: s.x, z: s.z, yaw: s.yaw, y: s.y, onStand: () => s.onStand?.() };
  doors.addToggle({
    // the prompt shows when you stand in front of the seat
    x: s.x + Math.sin(s.yaw) * 0.55,
    z: s.z + Math.cos(s.yaw) * 0.55,
    label: (on) => (on ? "Stand up" : "Sit down"),
    isOn: () => ctx.seat === seat,
    onPress: () => {
      if (ctx.seat === seat) {
        ctx.seat = null;
        seat.onStand();
      } else {
        ctx.seat = seat;
        s.onSit?.();
      }
    },
  });
}

/** A seat for a piece of furniture at (x, z) turned by `rotY` whose front faces local +z. */
export function seatOf(x: number, z: number, rotY: number, y: number, back = 0.08): SeatSpec {
  return { x: x - Math.sin(rotY) * back, z: z - Math.cos(rotY) * back, yaw: rotY, y };
}
