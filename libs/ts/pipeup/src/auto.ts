import { VERSION } from "./core";
import { drainQueue, firstCore } from "./ui/addons";
import { autoMount } from "./ui/mount";

export * from "./index";

// Node (e.g. the size check) has no document; browsers mount pages that ask for it.
if (typeof document !== "undefined") {
  if (firstCore)
    console.warn(
      `pipeup: Pipeup is on this page twice (${firstCore.VERSION} and ${VERSION}); the first one is used. Remove one script.`,
    );
  else {
    drainQueue();
    autoMount();
  }
}
