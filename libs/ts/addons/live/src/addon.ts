import type { AddonHost, PipeupAddon, PanelHandle } from "pipeup";
import { derivedRoom, fromB64u, ladder, pageSecret, settings, sha256, utf8 } from "@pipeup/kit";
import { Cursors, STYLES, core, track } from "./cursors";
import { h } from "./dom";
import { Mesh } from "./mesh";
import { join, type Person, type Session } from "./session";
import { relayList } from "./signal";

const SAYS =
  "When you go live, you connect directly to other people viewing this page. They see your network address; the meeting-point services see your network address and when you connect, never your comments.";

const BROADCAST = [
  "M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8",
];
const POINTER = ["M5 3l14 7-6 2-2 6z"];
const PEOPLE = [
  "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14a5 5 0 0 1 3.5 5",
];

/** The key that decides who meets: the share key when the page is shared (so both reach the same people), else derived. */
async function roomFor(docId: string, secret: Uint8Array<ArrayBuffer>, share: string | null) {
  const frag = share?.split("#")[1];
  const key = frag?.startsWith("pm1.") ? frag.slice(4).split(".")[0] : frag;
  if (!key) return derivedRoom(docId, secret);
  // A 32-byte base64url key is the key; any other spelling (PrivateBin's) is hashed to 32 bytes.
  return /^[A-Za-z0-9_-]{43}$/.test(key) ? fromB64u(key) : sha256(utf8(`pipeup/v1/share-key:${key}`));
}

export function createAddon(): PipeupAddon {
  return {
    id: "live",
    api: 1,
    version: "0.4.1",
    needs: ["menu", "notify", "status", "overlay", "here", "panel", "styles", "sign"],
    network: {
      when: "after-consent",
      to: [
        "nostr relays (the page may name them)",
        "stun.l.google.com",
        "stun.cloudflare.com",
        "other people live on this page",
      ],
      says: SAYS,
    },
    async setup(host) {
      const html = document.documentElement;
      const secret = pageSecret(host.document.id);
      if (!secret) return host.off("needs a document identity");
      if (typeof RTCPeerConnection === "undefined" || typeof WebSocket === "undefined")
        return host.off("this browser can't make direct connections");
      return run(host, secret, html);
    },
  };
}

async function run(host: AddonHost, secret: Uint8Array<ArrayBuffer>, html: HTMLElement) {
  const docId = host.document.id;
  const share = html.getAttribute("data-pipeup-share");
  const lad = ladder(docId, await roomFor(docId, secret, share));
  const relays = relayList(html.getAttribute("data-pipeup-live-relays"));
  const auto = html.getAttribute("data-pipeup-live") === "auto";
  const st = await settings("live", { memory: host.ephemeral });
  const rec = (await st.get<{ on?: boolean; seen?: boolean }>(docId)) ?? {};
  // `seen`: this reviewer was told, in a panel, who sees their address. Nothing connects before that.
  let seen = !!rec.seen;
  let want = rec.on ?? auto;
  let cursorsOn = (await st.get<boolean>("cursors")) ?? true;
  let session: Session | null = null;
  let ac: AbortController | null = null;
  let ui = {
    shown: false,
    view: undefined as Record<string, string> | undefined,
    writing: null as string | null,
  };
  let shownStatus = "";
  let people: PanelHandle | null = null;
  let renderPeople = () => {};
  const offs: (() => void)[] = [host.addStyles(STYLES)];
  const names = new Map<string, string>();
  const nameOf = (key: string): string => {
    let n = names.get(key);
    if (n === undefined) {
      n = "";
      for (const o of host.document.ops()) if (o.body.author === key && o.body.name) n = o.body.name;
      names.set(key, (n ||= core().animalName?.(key) ?? "Someone"));
    }
    return n;
  };
  offs.push(host.document.onChange(() => names.clear()));
  const cursors = new Cursors(host, nameOf);
  const save = () => st.set(docId, { on: want, seen });
  const others = () => [...(session?.people.values() ?? [])];
  const withN = (none = "") => {
    const n = others().length;
    return n ? `Live with ${n} other${n === 1 ? "" : "s"}` : none;
  };
  const lostText = (claim: string) =>
    `Can't reach ${claim ? nameOf(claim) : "someone"} directly${html.hasAttribute("data-pipeup-share") ? " — comments still arrive through the shared copy" : ""}`;

  const goLive = host.addMenuItem({
    id: "live",
    icon: BROADCAST,
    label: () => {
      return session ? withN("Live") : "Go live";
    },
    hint: () => (session ? "Turn off to disconnect." : SAYS),
    checked: () => !!session,
    select: () => {
      if (!seen) return consent();
      want = !want;
      void save();
      sync();
    },
  });
  host.addMenuItem({
    id: "cursors",
    icon: POINTER,
    label: () => "Show live cursors",
    hint: () => "Off: you neither send nor see cursors.",
    checked: () => cursorsOn,
    select: () => {
      cursorsOn = !cursorsOn;
      void st.set("cursors", cursorsOn);
      if (!cursorsOn) session?.beacon.set({ pointer: null, selection: null });
    },
  });
  const peopleRow = host.addMenuItem({
    id: "people",
    icon: PEOPLE,
    label: () => `People here (${others().length})`,
    hint: () => "Who is live here.",
    select: () => openPeople(),
  });

  function consent(): void {
    const button = (text: string, onclick: () => void) =>
      h("button", { type: "button", className: "live-go", textContent: text, onclick });
    const node = h(
      "div",
      {},
      h("p", { textContent: SAYS }),
      ...(st.lasting ? [] : [h("p", { textContent: "This browser won't remember this choice." })]),
      h(
        "div",
        { className: "live-row" },
        button("Go live", () => {
          seen = want = true;
          void save();
          panel.close();
          sync();
        }),
        button("Not now", () => panel.close()),
      ),
    );
    const panel = host.openPanel(node, { label: "Go live" });
  }

  function status(): void {
    if (!session) {
      shownStatus = "";
      return host.setStatus(null);
    }
    const list = others();
    const parts = [list.length ? withN() : "Live · nobody else here with this version of the page"];
    for (const p of list)
      if (p.pres.typing != null)
        parts.push(`${nameOf(p.key)} is ${p.pres.typing === "" ? "writing a comment" : "replying"}…`);
    for (const l of session.lost.values()) parts.push(lostText(l.claim));
    const next = {
      text: parts.join(" · "),
      people: list.map((p) => ({ key: p.key, name: nameOf(p.key), view: p.pres.view })),
    };
    // Presence arrives many times a second; the menu is touched only when what it shows changed.
    const key = JSON.stringify(next);
    if (key === shownStatus) return;
    shownStatus = key;
    host.setStatus(next);
    goLive.update();
    peopleRow.update();
    renderPeople();
  }

  function openPeople(): void {
    people?.close();
    const node = h("div");
    renderPeople = () => {
      const list = others();
      const names = list.map((p) => nameOf(p.key));
      node.replaceChildren(
        ...(list.length ? [] : [h("p", { textContent: "Nobody else is live here." })]),
        ...list.map((p, i) =>
          h(
            "div",
            { className: "live-p" },
            host.avatar(p.key, names[i]!),
            h(
              "div",
              { className: "live-n", textContent: names[i] },
              // Two people with one name are told apart by a short piece of their key.
              ...(names.indexOf(names[i]!) !== i || names.lastIndexOf(names[i]!) !== i
                ? [h("small", { textContent: `key ${p.key.slice(0, 6)}` })]
                : []),
            ),
            h("button", {
              type: "button",
              className: "live-go",
              textContent: "Go to where they are",
              onclick: () => void follow(p),
            }),
          ),
        ),
        ...[...(session?.lost.values() ?? [])].map((l) => h("p", { textContent: `${lostText(l.claim)}.` })),
      );
    };
    renderPeople();
    people = host.openPanel(node, {
      label: "People here",
      onClose: () => {
        people = null;
        renderPeople = () => {};
      },
    });
  }

  async function follow(p: Person): Promise<void> {
    people?.close();
    if (p.pres.view) await host.go(p.pres.view);
    cursors.pointOf(p)?.el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function start(): void {
    ac = new AbortController();
    const signal = ac.signal;
    const mesh = new Mesh(
      {
        ops: () => host.document.ops(),
        onChange: (fn) => host.document.onChange(fn),
        merge: (ops) => host.merge(ops),
      },
      lad,
    );
    let told = false;
    mesh.onNewer = (n) => {
      if (told) return;
      told = true;
      host.notify(
        `${n} comment${n === 1 ? " comes" : "s come"} from a newer version of Pipeup; this page can't show them yet.`,
      );
    };
    mesh.start();
    void join({
      me: host.document.me,
      ladder: lad,
      mesh,
      relays,
      signal,
      sign: (data) => host.sign("hello", data),
      onChange: status,
      onJoin: (p) => host.announce(`${nameOf(p.key)} joined`),
      onLeave: (p) => host.announce(`${nameOf(p.key)} left`),
    }).then(
      (s) => {
        if (signal.aborted) return s.close();
        session = s;
        s.beacon.set({ view: ui.view, typing: ui.writing });
        const off = track(host, s.beacon, () => cursorsOn && ui.shown);
        signal.addEventListener("abort", () => (off(), mesh.stop(), (session = null)), { once: true });
        goLive.update();
        status();
      },
      (e) => host.notify(`Couldn't go live: ${e instanceof Error ? e.message : "unknown"}`),
    );
  }

  function stop(): void {
    ac?.abort();
    ac = null;
    session = null;
    status();
    goLive.update();
  }

  function sync(): void {
    if (want && seen && !ac) start();
    else if (!(want && seen) && ac) stop();
    goLive.update();
  }

  offs.push(
    host.onUi((u) => {
      ui = { shown: u.shown, view: u.view, writing: u.writing };
      session?.beacon.set({ view: u.view, typing: u.writing });
      if (!u.shown || !cursorsOn) session?.beacon.set({ pointer: null, selection: null });
    }),
    host.onFrame(() => cursors.frame(others(), ui.shown && cursorsOn)),
  );
  sync();
  return () => {
    stop();
    for (const off of offs) off();
  };
}
