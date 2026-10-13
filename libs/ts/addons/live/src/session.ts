import { randomBytes, toB64u, verifySigned, type Ladder } from "@pipeup/kit";
import type { Mesh } from "./mesh";
import { Beacon, MAX_FRAME, cleanPresence, type Presence } from "./presence";
import { meet, type Meeting } from "./signal";

/** Someone connected and proven (their hello verified): everything on their channel is theirs. */
export interface Person {
  /** Their session: one per tab, new each time they go live. */
  session: string;
  /** Their reviewer public key. */
  key: string;
  pres: Presence;
}

export interface Lost {
  /** Who they said they were when they tried to meet: a claim, used only to name them in words. */
  claim: string;
  at: number;
}

export interface Env {
  me: string;
  ladder: Ladder;
  mesh: Mesh;
  relays: readonly string[];
  signal: AbortSignal;
  /** `host.sign("hello", data)`. */
  sign(data: string): Promise<string>;
  onChange(): void;
  onJoin(p: Person): void;
  onLeave(p: Person): void;
}

export interface Session {
  readonly people: ReadonlyMap<string, Person>;
  readonly lost: ReadonlyMap<string, Lost>;
  readonly beacon: Beacon;
  readonly meeting: Meeting;
  close(): void;
}

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }];
const MAX_PEERS = 7;
const CONNECT_MS = 30_000;
const GATHER_MS = 5000;
const RESEND_MS = 8000;
const RETRY_MS = 60_000;
const ANNOUNCE_S = 20;

/** The DTLS fingerprint a session description names, normalised: what a hello is bound to. */
export const fingerprintOf = (sdp: string | undefined): string =>
  /^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/m.exec(sdp ?? "")?.[1]?.toUpperCase() ?? "";

/** What a hello signs: the room, the session and the connection's own fingerprint (add-ons design §9.2). */
export const helloData = (topic: string, session: string, fingerprint: string): string =>
  `${topic}:${session}:${fingerprint}`;

/**
 * Checks a hello from a channel: signed by the author it names for this very connection, so a peer can't claim
 * someone else's key, replay a hello from another connection or sit between two peers.
 */
export async function checkHello(
  m: unknown,
  topic: string,
  session: string,
  remoteFingerprint: string,
): Promise<string | null> {
  const h = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
  if (h.t !== "hello" || typeof h.author !== "string" || typeof h.sig !== "string") return null;
  if (h.session !== session || !remoteFingerprint || h.fingerprint !== remoteFingerprint) return null;
  return (await verifySigned(h.author, "live/hello", helloData(topic, session, remoteFingerprint), h.sig))
    ? h.author
    : null;
}

interface Conn {
  s: string;
  pc: RTCPeerConnection;
  ch: RTCDataChannel;
  claim: string;
  person?: Person;
  /** Frames are handled one at a time, in order. */
  queue: Promise<void>;
  timer: ReturnType<typeof setTimeout>;
  resend?: ReturnType<typeof setInterval>;
  answer?: object;
  answered?: boolean;
}

const gathered = (pc: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(resolve, GATHER_MS);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState !== "complete") return;
      clearTimeout(t);
      resolve();
    };
  });

/**
 * Joins the room: meets other people through the relays, connects to each with a WebRTC data channel (full mesh, up
 * to 8 people, no TURN), proves who they are with a signed hello, and hands each proven peer to the mesh.
 */
export async function join(env: Env): Promise<Session> {
  const session = toB64u(randomBytes(6));
  const topic = await env.ladder.addr("live");
  const conns = new Map<string, Conn>();
  const people = new Map<string, Person>();
  const lost = new Map<string, Lost>();
  const banned = new Set<string>();
  const replied = new Map<string, number>();

  const meeting = await meet(env.relays, env.ladder, env.signal, (m) => void onSignal(m));
  const post = (m: object) => void meeting.post(m).catch(() => {});
  const announce = () => {
    post({ t: "here", s: session, a: env.me });
  };

  const send = (frame: string) => {
    for (const c of conns.values()) if (c.person && c.ch.readyState === "open") c.ch.send(frame);
  };
  const beacon = new Beacon(send);

  function end(c: Conn, why: "lost" | "left" | "bad"): void {
    if (conns.get(c.s) !== c) return;
    conns.delete(c.s);
    clearTimeout(c.timer);
    clearInterval(c.resend);
    c.pc.onconnectionstatechange = c.ch.onclose = c.ch.onmessage = null;
    c.pc.close();
    if (why === "bad") banned.add(c.s);
    if (c.person) {
      people.delete(c.s);
      env.mesh.drop(c.s);
      env.onLeave(c.person);
    } else if (why === "lost") lost.set(c.s, { claim: c.claim, at: Date.now() });
    env.onChange();
  }

  function create(s: string, claim: unknown): Conn {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const ch = pc.createDataChannel("pipeup", { negotiated: true, id: 0 });
    const c: Conn = {
      s,
      pc,
      ch,
      claim: typeof claim === "string" ? claim : "",
      queue: Promise.resolve(),
      timer: setTimeout(() => end(c, "lost"), CONNECT_MS),
    };
    conns.set(s, c);
    ch.onopen = () => void hello(c);
    ch.onmessage = (e) => (c.queue = c.queue.then(() => frame(c, e.data)));
    ch.onclose = () => end(c, "left");
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed")
        end(c, c.person ? "left" : "lost");
    };
    return c;
  }

  async function hello(c: Conn): Promise<void> {
    const fingerprint = fingerprintOf(c.pc.localDescription?.sdp);
    const sig = await env.sign(helloData(topic, session, fingerprint));
    if (c.ch.readyState === "open")
      c.ch.send(JSON.stringify({ t: "hello", author: env.me, session, fingerprint, sig }));
  }

  async function frame(c: Conn, data: unknown): Promise<void> {
    if (typeof data !== "string" || data.length > MAX_FRAME || conns.get(c.s) !== c) return;
    let m: Record<string, unknown> | null = null;
    try {
      m = JSON.parse(data) as Record<string, unknown>;
    } catch {
      /* not JSON: dropped below */
    }
    if (!c.person) {
      // The first thing a peer sends must be a hello that checks out; otherwise it is dropped for good.
      const key = await checkHello(m, topic, c.s, fingerprintOf(c.pc.remoteDescription?.sdp));
      if (!key || key === env.me || [...people.values()].some((p) => p.key === key)) return end(c, "bad");
      clearTimeout(c.timer);
      clearInterval(c.resend);
      c.person = { session: c.s, key, pres: {} };
      people.set(c.s, c.person);
      lost.delete(c.s);
      await env.mesh.add(c.s, (d) => c.ch.readyState === "open" && c.ch.send(d));
      c.ch.send(beacon.frame());
      env.onJoin(c.person);
      return env.onChange();
    }
    if (!m) return;
    if (m.t === "p") {
      const p = cleanPresence(m);
      if (p) {
        c.person.pres = p;
        env.onChange();
      }
    } else await env.mesh.receive(c.s, data);
  }

  async function dial(s: string, claim: unknown): Promise<void> {
    const c = create(s, claim);
    try {
      await c.pc.setLocalDescription(await c.pc.createOffer());
      await gathered(c.pc);
      const offer = { t: "offer", s: session, to: s, a: env.me, sdp: c.pc.localDescription!.sdp };
      post(offer);
      c.resend = setInterval(() => post(offer), RESEND_MS);
    } catch {
      end(c, "lost");
    }
  }

  async function reply(s: string, m: Record<string, unknown>): Promise<void> {
    const old = conns.get(s);
    if (old) return old.answer ? post(old.answer) : undefined;
    if (conns.size >= MAX_PEERS || banned.has(s) || typeof m.sdp !== "string") return;
    const c = create(s, m.a);
    try {
      await c.pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
      await c.pc.setLocalDescription(await c.pc.createAnswer());
      await gathered(c.pc);
      c.answer = { t: "answer", s: session, to: s, sdp: c.pc.localDescription!.sdp };
      post(c.answer);
    } catch {
      end(c, "lost");
    }
  }

  async function onSignal(m: Record<string, unknown>): Promise<void> {
    const s = m.s;
    if (typeof s !== "string" || !/^[A-Za-z0-9_-]{8}$/.test(s) || s === session) return;
    if (m.t === "here") {
      const l = lost.get(s);
      if (conns.has(s) || banned.has(s) || conns.size >= MAX_PEERS) return;
      if (l && Date.now() - l.at < RETRY_MS) return;
      // The lower session offers. A higher one answers by announcing itself, so the lower one finds it.
      if (session < s) await dial(s, m.a);
      else if (Date.now() - (replied.get(s) ?? 0) > 3000) {
        replied.set(s, Date.now());
        announce();
      }
    } else if (m.to === session && m.t === "offer") await reply(s, m);
    else if (m.to === session && m.t === "answer") {
      const c = conns.get(s);
      if (!c || c.answered || c.pc.signalingState !== "have-local-offer" || typeof m.sdp !== "string") return;
      c.answered = true;
      clearInterval(c.resend);
      await c.pc.setRemoteDescription({ type: "answer", sdp: m.sdp }).catch(() => end(c, "lost"));
    }
  }

  // Announce when a relay opens and every 20 s, so anyone who joins finds us inside the relays' 30 s window.
  let seenOpen = 0;
  let ticks = 0;
  const clock = setInterval(() => {
    const open = meeting.open();
    if (open && (open > seenOpen || ++ticks >= ANNOUNCE_S)) {
      announce();
      ticks = 0;
    }
    seenOpen = open;
  }, 1000);

  const close = () => {
    clearInterval(clock);
    beacon.stop();
    for (const c of [...conns.values()]) end(c, "left");
    meeting.close();
  };
  env.signal.addEventListener("abort", close, { once: true });
  return { people, lost, beacon, meeting, close };
}
