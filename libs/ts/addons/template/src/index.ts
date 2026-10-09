import { createAddon } from "./addon";

// A classic script registers by joining Pipeup's queue; Pipeup picks it up whether it loaded before or after.
const g = globalThis as { pipeupAddons?: { push(addon: unknown): unknown } };
(g.pipeupAddons ||= [] as never).push(createAddon());
