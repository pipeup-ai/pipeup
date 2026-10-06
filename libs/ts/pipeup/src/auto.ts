import { autoMount } from "./ui/mount";

export * from "./index";

// Node (e.g. the size check) has no document; browsers mount pages that ask for it.
if (typeof document !== "undefined") autoMount();
