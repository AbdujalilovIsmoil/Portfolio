import { Color3, Texture, VideoTexture, type Node } from "@babylonjs/core";
import type { DoorSystem } from "./Doors";
import { ROOM_HX } from "./Room";
import { addSeat, seatOf } from "./Seats";
import { box, group, lit, plane, type Ctx } from "./core";

/** The TV stands against the living room's west wall; the sofa faces it from the middle of the room. */
const TV = { x: -ROOM_HX + 0.32, z: 2.6 };
const SOFA = { x: -2.9, z: 2.6 };

/**
 * The living room's TV: a low cabinet with a big flat screen facing the sofa. Sit on the sofa and
 * a film plays (Big Buck Bunny, © Blender Foundation, CC BY 3.0); stand up and it pauses.
 */
export function buildTvCorner(ctx: Ctx, parent: Node, doors: DoorSystem) {
  const root = group(ctx, { parent, pos: [TV.x, 0, TV.z], rot: [0, Math.PI / 2, 0] }); // screen faces +x, into the room
  const wood = lit(ctx, { color: "#4a3020", rough: 0.55 });
  const black = lit(ctx, { color: "#0b0d12", rough: 0.25, metal: 0.4 });
  box(ctx, 2.0, 0.5, 0.45, { parent: root, pos: [0, 0.25, 0], cast: true, mat: wood });
  for (const x of [-0.5, 0.5]) box(ctx, 0.9, 0.38, 0.02, { parent: root, pos: [x, 0.25, 0.23], mat: lit(ctx, { color: "#5a3b25", rough: 0.45 }) });
  box(ctx, 0.35, 0.04, 0.25, { parent: root, pos: [0, 0.52, -0.02], mat: black }); // stand foot
  box(ctx, 0.06, 0.2, 0.05, { parent: root, pos: [0, 0.62, -0.05], mat: black });
  box(ctx, 1.75, 1.0, 0.05, { parent: root, pos: [0, 1.22, -0.05], cast: true, mat: black });
  // the picture: dark until someone sits on the sofa
  const screen = lit(ctx, { color: "#000000", rough: 0.15 });
  screen.emissiveColor = new Color3(0.02, 0.02, 0.03);
  const pic = plane(ctx, 1.66, 0.92, { parent: root, pos: [0, 1.22, -0.022], rot: [0, Math.PI, 0], mat: screen });
  pic.isPickable = false;
  ctx.colliders.push({ x: TV.x, z: TV.z, hx: 0.3, hz: 1.05 });

  let video: VideoTexture | null = null;
  const play = () => {
    if (!video) {
      video = new VideoTexture("film", "/video/film.mp4", ctx.scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, { autoPlay: false, loop: true, muted: false, autoUpdateTexture: true });
      video.uScale = -1; // the plane is seen from behind its default side
      video.uOffset = 1;
    }
    screen.emissiveTexture = video;
    screen.emissiveColor = new Color3(1, 1, 1);
    video.video.volume = 0.6;
    void video.video.play().catch(() => {});
  };
  const stop = () => {
    video?.video.pause();
    screen.emissiveTexture = null;
    screen.emissiveColor = new Color3(0.02, 0.02, 0.03);
  };
  ctx.scene.onDisposeObservable.addOnce(() => {
    video?.video.pause();
    video?.dispose();
  });
  // two places on the sofa, both facing the TV (+x)
  for (const dz of [-0.45, 0.45]) addSeat(ctx, doors, { x: SOFA.x + 0.08, z: SOFA.z + dz, yaw: -Math.PI / 2, y: 0, onSit: play, onStand: stop });
  // the reading armchair in the corner
  addSeat(ctx, doors, seatOf(-2.2, -3.6, 0.35, 0));
  return root;
}
