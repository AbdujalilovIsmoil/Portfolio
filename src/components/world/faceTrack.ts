import { useSyncExternalStore } from "react";

/**
 * Head tracking from the webcam: MediaPipe Face Landmarker (self-hosted in public/mediapipe) reads
 * the user's head pose, and the character turns its head the same way. Loaded only when switched on.
 */
export type FaceStatus = "off" | "loading" | "searching" | "tracking" | "denied" | "error";

export const faceTrack = {
  status: "off" as FaceStatus,
  /** radians; + = looking to their left / up / tilting left (from the user's point of view) */
  yaw: 0,
  pitch: 0,
  roll: 0,
  video: null as HTMLVideoElement | null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setStatus = (s: FaceStatus) => {
  if (faceTrack.status === s) return;
  faceTrack.status = s;
  emit();
};

let stream: MediaStream | null = null;
let raf = 0;
let running = false;
let quietInstalled = false;

if (typeof window !== "undefined") (window as unknown as { __face?: typeof faceTrack }).__face = faceTrack;

export async function startFaceTracking() {
  if (running) return;
  running = true;
  setStatus("loading");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
  } catch {
    running = false;
    setStatus("denied");
    return;
  }
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    faceTrack.video = video;
    // MediaPipe's wasm prints its start-up INFO lines through console.error; keep the console clean
    if (!quietInstalled) {
      quietInstalled = true;
      const orig = console.error.bind(console);
      console.error = (...a: unknown[]) => {
        if (typeof a[0] === "string" && /^(INFO:|W\d{4}|I\d{4})|XNNPACK|TensorFlow Lite/.test(a[0])) return;
        orig(...a);
      };
    }
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
    const lm = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFacialTransformationMatrixes: false,
    });
    if (!running) {
      lm.close();
      return;
    }
    setStatus("searching");
    const calib = { yaw: 0, pitch: 0, roll: 0, n: 0 };
    let last = -1;
    const tick = () => {
      if (!running) {
        lm.close();
        return;
      }
      raf = requestAnimationFrame(tick);
      if (video.readyState < 2 || video.currentTime === last) return;
      last = video.currentTime;
      const res = lm.detectForVideo(video, performance.now());
      const L = res.faceLandmarks?.[0];
      if (!L) {
        setStatus("searching");
        // ease back to straight ahead
        faceTrack.yaw *= 0.9;
        faceTrack.pitch *= 0.9;
        faceTrack.roll *= 0.9;
        return;
      }
      setStatus("tracking");
      // From the landmarks of the (unmirrored) camera image: the user's left is on the image's right.
      // nose 1, cheeks 234 (their right) / 454 (their left), outer eye corners 33 / 263, forehead 10, chin 152
      const nose = L[1], cr = L[234], cl = L[454], er = L[33], el = L[263], top = L[10], chin = L[152];
      const width = Math.hypot(cl.x - cr.x, cl.y - cr.y) || 1;
      const height = Math.hypot(chin.x - top.x, chin.y - top.y) || 1;
      const rawYaw = ((nose.x - (cl.x + cr.x) / 2) / width) * 2.6; // + = turned to their left
      const rawPitch = (((top.y + chin.y) / 2 - nose.y) / height) * 3.2; // + = looking up
      const rawRoll = Math.atan2(el.y - er.y, el.x - er.x); // + = tilted to their left
      // the first second of tracking defines "straight ahead"
      if (calib.n < 20) {
        calib.yaw += rawYaw;
        calib.pitch += rawPitch;
        calib.roll += rawRoll;
        calib.n++;
        return;
      }
      const yaw = rawYaw - calib.yaw / calib.n;
      const pitch = rawPitch - calib.pitch / calib.n;
      const roll = rawRoll - calib.roll / calib.n;
      const k = 0.35; // smoothing
      faceTrack.yaw += (yaw - faceTrack.yaw) * k;
      faceTrack.pitch += (pitch - faceTrack.pitch) * k;
      faceTrack.roll += (roll - faceTrack.roll) * k;
    };
    tick();
  } catch (e) {
    console.warn("face tracking failed", e);
    stopFaceTracking();
    setStatus("error");
  }
}

export function stopFaceTracking() {
  running = false;
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  faceTrack.video = null;
  faceTrack.yaw = faceTrack.pitch = faceTrack.roll = 0;
  setStatus("off");
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useFaceStatus() {
  return useSyncExternalStore(subscribe, () => faceTrack.status, () => "off" as FaceStatus);
}
