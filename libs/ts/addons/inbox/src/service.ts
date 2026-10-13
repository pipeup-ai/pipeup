import { findWork } from "./crypto";

/** The inbox service: where notes are left (`<base>/i/<inbox>`), under the contract the mailbox server speaks (pm2). */
export class Service {
  constructor(
    readonly base: string,
    private readonly signal: AbortSignal,
  ) {}

  private url(inbox: string, tail = ""): string {
    return `${this.base.replace(/\/+$/, "")}/i/${inbox}${tail}`;
  }

  private async call(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    return fetch(url, {
      method,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      mode: "cors",
      signal: this.signal,
      headers: { ...(body === undefined ? {} : { "content-type": "text/plain;charset=UTF-8" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** Publishes this person's public encryption key, proved by their signature. */
  async putKey(inbox: string, ed: string, pub: string, sig: string): Promise<boolean> {
    return (await this.call("PUT", this.url(inbox, "/key"), { ed, pub, sig })).ok;
  }

  /** A person's public encryption key, or null when they have no inbox here. */
  async getKey(inbox: string): Promise<string | null> {
    const r = await this.call("GET", this.url(inbox, "/key"));
    return r.ok ? ((await r.json()) as { pub: string }).pub : null;
  }

  /** Leaves a sealed note, with the proof of work the service asks for (found again if it asks for more). */
  async leave(inbox: string, ct: string): Promise<boolean> {
    let bits = 14;
    for (let tries = 0; tries < 2; tries++) {
      const r = await this.call("POST", this.url(inbox), { ct, work: await findWork(inbox, ct, bits) });
      if (r.ok) return true;
      const asked =
        r.status === 403 ? ((await r.json().catch(() => ({}))) as { bits?: number }).bits : undefined;
      if (!asked || asked <= bits || asked > 24) return false;
      bits = asked;
    }
    return false;
  }

  /** The notes left since `since` (a cursor), and the next cursor. */
  async list(inbox: string, since: string): Promise<{ notes: { id: string; ct: string }[]; next: string }> {
    const r = await this.call("GET", `${this.url(inbox)}${since ? `?since=${since}` : ""}`);
    if (r.status === 404) return { notes: [], next: since };
    if (!r.ok) throw new Error("the inbox service didn't answer");
    return (await r.json()) as { notes: { id: string; ct: string }[]; next: string };
  }

  /** Takes a note away (only its owner can, by signing). */
  async remove(inbox: string, note: string, ed: string, sig: string): Promise<boolean> {
    return (
      await this.call("DELETE", this.url(inbox, `/${note}`), undefined, {
        "x-pipeup-key": ed,
        "x-pipeup-sig": sig,
      })
    ).ok;
  }
}
