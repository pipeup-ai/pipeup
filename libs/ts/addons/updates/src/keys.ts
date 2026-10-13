import keys from "../../../../../tools/updates-keys.json";

/** The public keys the update list may be signed with (tools/updates-keys.json): the current one, and an offline standby. */
export const KEYS: readonly { id: string; key: string }[] = keys;
