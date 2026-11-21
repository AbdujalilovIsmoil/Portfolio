import { Mesh, SubMesh, VertexBuffer, VertexData, type AbstractMesh, type AssetContainer, type Node } from "@babylonjs/core";

/**
 * Levels of detail made at load time, so the model files stay as they are.
 *
 * Vertex clustering: every vertex inside the same cube of `cell` (in the mesh's own units) becomes
 * one — the first one found there, with its own normal, UV and colour — and triangles that collapse
 * (or repeat) go. Coarse, but it never tears the surface, works on any mesh (trunks, branches,
 * leaves; seams and two-sided duplicates and all, where an edge-collapse simplifier gets stuck),
 * and at the distances these are seen from it looks the same. Each sub-mesh (a part with its own
 * material) is clustered on its own, so parts never borrow each other's texture coordinates.
 */
export function clusterLOD(source: Mesh, cell: number, name: string): Mesh | null {
  const pos = source.getVerticesData(VertexBuffer.PositionKind);
  const idx = source.getIndices();
  if (!pos || !idx) return null;
  const kinds = [VertexBuffer.NormalKind, VertexBuffer.UVKind, VertexBuffer.ColorKind].filter((k) => source.isVerticesDataPresent(k));
  const src = kinds.map((k) => ({ kind: k, data: source.getVerticesData(k)!, size: source.getVertexBuffer(k)!.getSize() }));
  const inv = 1 / cell;
  const out: number[] = []; // original index of each kept vertex
  const tris: number[] = [];
  const parts: { material: number; start: number; count: number }[] = [];
  const ranges = source.subMeshes?.length ? source.subMeshes.map((sm) => ({ material: sm.materialIndex, start: sm.indexStart, count: sm.indexCount })) : [{ material: 0, start: 0, count: idx.length }];
  for (const range of ranges) {
    const cells = new Map<number, number>();
    const rep = (v: number) => {
      const x = Math.floor(pos[v * 3] * inv), y = Math.floor(pos[v * 3 + 1] * inv), z = Math.floor(pos[v * 3 + 2] * inv);
      // (cells are within ±2^9 of the origin for any sensible `cell`: pack them into one number)
      const key = ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
      let r = cells.get(key);
      if (r === undefined) {
        r = out.length;
        out.push(v);
        cells.set(key, r);
      }
      return r;
    };
    const start = tris.length;
    const seen = new Set<string>();
    for (let t = range.start; t < range.start + range.count; t += 3) {
      const a = rep(idx[t]), b = rep(idx[t + 1]), c = rep(idx[t + 2]);
      if (a === b || b === c || a === c) continue;
      // the same triangle twice (same way round) only once; its mirror image is kept (two-sided leaves)
      const lo = Math.min(a, b, c);
      const key = lo === a ? `${a},${b},${c}` : lo === b ? `${b},${c},${a}` : `${c},${a},${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tris.push(a, b, c);
    }
    if (tris.length > start) parts.push({ material: range.material, start, count: tris.length - start });
  }
  if (!tris.length) return null;
  const vd = new VertexData();
  const P = new Float32Array(out.length * 3);
  out.forEach((v, i) => {
    P[i * 3] = pos[v * 3];
    P[i * 3 + 1] = pos[v * 3 + 1];
    P[i * 3 + 2] = pos[v * 3 + 2];
  });
  vd.positions = P;
  for (const s of src) {
    const arr = new Float32Array(out.length * s.size);
    out.forEach((v, i) => {
      for (let k = 0; k < s.size; k++) arr[i * s.size + k] = s.data[v * s.size + k];
    });
    if (s.kind === VertexBuffer.NormalKind) vd.normals = arr;
    else if (s.kind === VertexBuffer.UVKind) vd.uvs = arr;
    else if (s.kind === VertexBuffer.ColorKind) vd.colors = arr;
  }
  vd.indices = tris;
  const m = new Mesh(name, source.getScene());
  vd.applyToMesh(m, false);
  m.subMeshes = [];
  for (const p of parts) new SubMesh(p.material, 0, out.length, p.start, p.count, m);
  m.material = source.material;
  m.useVertexColors = source.useVertexColors;
  m.hasVertexAlpha = source.hasVertexAlpha;
  m.receiveShadows = source.receiveShadows;
  m.isPickable = false;
  return m;
}

/** How many triangles a mesh has (for the tests and the stats). */
export const triangleCount = (m: AbstractMesh) => (m.getTotalIndices?.() ?? 0) / 3;

/**
 * A model as ONE mesh — its parts as sub-meshes, each keeping its material — with two coarser
 * levels swapped in by distance (`cells`: the clustering cube as a fraction of the model's size;
 * `distances` in metres). Copies are made with placeCopy: each copy is one instance (not one per
 * part), culled on its own, picking its own level. The model itself stays hidden.
 */
export function lodModel(container: AssetContainer, parent: Node, name: string, cells: [number, number], distances: [number, number]) {
  const parts = container.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
  parts.forEach((m) => m.computeWorldMatrix(true));
  const model = parts.length > 1 ? Mesh.MergeMeshes(parts, false, true, undefined, true, true)! : parts[0].clone(name)!;
  model.name = name;
  model.parent = parent;
  model.isPickable = false;
  model.receiveShadows = true;
  model.isVisible = false;
  const ext = model.getBoundingInfo().boundingBox.extendSize;
  const size = 2 * Math.max(ext.x, ext.y, ext.z);
  cells.forEach((c, k) => {
    const lod = clusterLOD(model, size * c, `${name}_LOD${k + 1}`);
    if (lod) model.addLODLevel(distances[k], lod);
  });
  return model;
}

/**
 * A copy of a lodModel standing on (x, z), turned by `yaw`, scaled so its largest side is `size`
 * (its base on the ground, its middle over the spot) — and frozen there.
 */
export function placeCopy(model: Mesh, x: number, z: number, size: number, yaw: number) {
  const { minimum: lo, maximum: hi } = model.getBoundingInfo().boundingBox;
  // (the largest side of its box once turned, as it stands — how models have always been sized here)
  const ex = (hi.x - lo.x) / 2, ey = (hi.y - lo.y) / 2, ez = (hi.z - lo.z) / 2;
  const c0 = Math.abs(Math.cos(yaw)), s0 = Math.abs(Math.sin(yaw));
  const s = size / (2 * Math.max(c0 * ex + s0 * ez, ey, s0 * ex + c0 * ez));
  // the model's footprint middle, scaled and turned like the copy (a +y turn: x' = x cos + z sin, z' = −x sin + z cos)
  const cx = ((lo.x + hi.x) / 2) * s, cz = ((lo.z + hi.z) / 2) * s;
  const c = model.createInstance(model.name);
  c.parent = model.parent;
  c.position.set(x - (cx * Math.cos(yaw) + cz * Math.sin(yaw)), -lo.y * s, z - (-cx * Math.sin(yaw) + cz * Math.cos(yaw)));
  c.rotation.set(0, yaw, 0);
  c.scaling.setAll(s);
  c.isVisible = true;
  c.isPickable = false;
  c.freezeWorldMatrix();
  return c;
}
