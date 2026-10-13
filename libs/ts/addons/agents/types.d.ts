import type { PipeupAddon } from "pipeup";

/**
 * The agents add-on: shows the replies an AI agent wrote into the replies file next to the page, is the page's side of
 * the live link started by `pipeup watch`, and offers a prompt to hand an agent. It sends nothing before the person
 * switches the link on.
 */
export default function createAddon(): PipeupAddon;
