import { derivedRoom, ladder, type Ladder } from "@pipeup/kit";
import { Mesh, type MeshDoc } from "./mesh";

export { Mesh, type MeshDoc, type MeshPeer } from "./mesh";

/**
 * A document-sync mesh for agents and tests: no WebRTC, no UI. `document` is a `PipeupDocument` from `pipeup/core`
 * (or anything with `ops`, `onChange` and `merge(ops, source)`); a channel to a peer is just a function that
 * sends a string, with incoming strings passed to `mesh.receive(peerId, data)`.
 */
export async function createMesh(
  document: {
    id: string;
    ops: MeshDoc["ops"];
    onChange: MeshDoc["onChange"];
    merge(ops: readonly unknown[], source: string): Promise<number>;
  },
  secret: Uint8Array<ArrayBuffer>,
): Promise<Mesh> {
  const l: Ladder = ladder(document.id, await derivedRoom(document.id, secret));
  const mesh = new Mesh(
    {
      ops: () => document.ops(),
      onChange: (fn) => document.onChange(fn),
      merge: (ops) => document.merge(ops, "live"),
    },
    l,
  );
  mesh.start();
  return mesh;
}

/** Joins two meshes in memory (frames are delivered asynchronously, in order). Returns the function that parts them. */
export async function loopback(a: Mesh, b: Mesh, ids: [string, string] = ["a", "b"]): Promise<() => void> {
  let open = true;
  const to = (m: Mesh, from: string) => (data: string) =>
    void (open && queueMicrotask(() => void m.receive(from, data)));
  await Promise.all([a.add(ids[1], to(b, ids[0])), b.add(ids[0], to(a, ids[1]))]);
  return () => {
    open = false;
    a.drop(ids[1]);
    b.drop(ids[0]);
  };
}
