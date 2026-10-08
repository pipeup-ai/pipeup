import type { PipeupAddon } from "pipeup";

/**
 * Registers an add-on the way a classic script must: by pushing to `pipeupAddons`, which Pipeup drains when it
 * loads or replaces with `{ push: use }` once it has. Works before or after Pipeup, in any script order.
 * Defines no global.
 */
export function register(addon: PipeupAddon): void {
  const g = globalThis as { pipeupAddons?: { push(a: PipeupAddon): unknown }; Pipeup?: unknown };
  (g.pipeupAddons ||= [] as never).push(addon);
  if (typeof addEventListener === "function")
    addEventListener(
      "load",
      () => {
        if (!g.Pipeup)
          console.error(`pipeup: the "${addon.id}" add-on needs Pipeup on the page too; load pipeup.min.js.`);
      },
      { once: true },
    );
}
