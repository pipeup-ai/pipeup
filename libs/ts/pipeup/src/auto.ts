import { drainQueue } from "./ui/addons";
import { autoMount } from "./ui/mount";

import { VERSION } from "./core";

export * from "./index";

// Node (e.g. the size check) has no document; browsers mount pages that ask for it.
if (typeof document !== "undefined") {
  const other = (globalThis as { Pipeup?: { VERSION?: string } }).Pipeup;
  if (other?.VERSION)
    console.warn(
      `pipeup: Pipeup is on this page twice (${other.VERSION} and ${VERSION}); the first one is used. Remove one script.`,
    );
  else {
    drainQueue();
    autoMount();
  }
}
