import type { AddonHost } from "pipeup";
import { codeOf, keyFromCode, makePortable, type CodeProblem } from "./code";

const PROBLEMS: Record<CodeProblem, string> = {
  shape: "That doesn't look like a recovery code. It starts with PU1 and is about 60 characters long.",
  mistake: "The code has a mistake in it. Check it against where you kept it, character by character.",
};

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

/**
 * The dialog for what a reviewer can do with their identity: make it portable or back it up (see the code, copy it,
 * save it as a file), use one they backed up, and share a way to be reached. Plain words say what each does.
 */
export function openIdentity(host: AddonHost): void {
  const me = host.identity;
  const doc = host.document;
  const portable = me.portable;
  const hasComments = doc.threads().some((t) => [t.root, ...t.root.replies].some((c) => c.author === doc.me));
  const title = h("h2", { class: "dlg-t" });
  const body = h("div", { class: "dlg-b" });
  const message = h("p", { class: "dlg-m", role: "status" });
  const buttons = h("div", { class: "dlg-a" });
  let dialog = { close() {} };
  const close = (reload = false) => {
    dialog.close();
    if (reload) location.reload();
  };
  const button = (label: string, run: () => unknown, primary = false) => {
    const b = h("button", { class: primary ? "dlg-btn primary" : "dlg-btn", type: "button" }, label);
    b.addEventListener("click", () => void run());
    return b;
  };
  const para = (...text: string[]) => text.map((t) => h("p", {}, t));
  const say = (text: string) => (message.textContent = text);

  /** Shows the recovery code, with ways to keep it. */
  const showCode = (code: string, fresh: boolean) => {
    title.textContent = fresh ? "Your portable identity" : "Back up my identity";
    const shown = h("code", { class: "dlg-c" }, code);
    shown.tabIndex = 0;
    body.replaceChildren(
      ...para(
        "This code is you. Keep it somewhere safe, like a password manager. Anyone who has it can write as you, and Pipeup never sends it anywhere. Without it, a cleared browser starts you over as someone new.",
      ),
      shown,
    );
    const save = () => {
      const url = URL.createObjectURL(new Blob([`${code}\n`], { type: "text/plain" }));
      const a = h("a", { href: url, download: "pipeup-identity.pipeup-id" });
      body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("Saved. Keep the file somewhere safe.");
    };
    buttons.replaceChildren(
      button("Copy code", () =>
        navigator.clipboard.writeText(code).then(
          () => say("Copied."),
          () => say("Your browser blocked copying; select the code and copy it by hand."),
        ),
      ),
      button("Save as a file", save),
      button(fresh ? "Done, and use it now" : "Done", () => close(fresh), true),
    );
    if (fresh)
      say("It is kept in this browser now. Reload to use it; your earlier comments stay as they are.");
  };

  const backupView = () => {
    say("");
    if (portable) {
      title.textContent = "Back up my identity";
      body.replaceChildren(...para("One moment…"));
      void me
        .seed()
        .then((seed) => (seed ? showCode(codeOf(seed), false) : say("This identity can't be backed up.")));
    } else {
      title.textContent = "Make my identity portable";
      body.replaceChildren(
        ...para(
          "Your identity stays in this browser, and can't be taken out of it. To use it on another browser or computer, Pipeup makes you a new one that you can back up with a recovery code.",
          hasComments
            ? "Comments you wrote before stay as they are, and show as written by an earlier you."
            : "You haven't written comments here yet, so nothing is left behind.",
        ),
      );
      buttons.replaceChildren(
        button("Not now", () => close()),
        button(
          "Make it portable",
          async () => {
            try {
              const made = await makePortable();
              await me.use(made.key);
              showCode(made.code, true);
            } catch {
              say("Something went wrong. Nothing was changed.");
            }
          },
          true,
        ),
      );
    }
  };
  const restoreView = () => {
    say("");
    title.textContent = "Use my identity";
    const field = h("textarea", {
      class: "dlg-f",
      rows: "3",
      "aria-label": "Recovery code",
      spellcheck: "false",
    });
    const file = h("input", {
      type: "file",
      accept: ".pipeup-id,text/plain",
      "aria-label": "Choose a recovery file",
    });
    file.addEventListener("change", async () => {
      const text = await file.files?.[0]?.text();
      if (text) field.value = text.trim();
    });
    body.replaceChildren(
      ...para(
        "Paste the recovery code you backed up, or choose its file. This replaces the identity in this browser.",
      ),
      field,
      file,
    );
    buttons.replaceChildren(
      button("Cancel", () => close()),
      button(
        "Use this identity",
        async () => {
          const found = await keyFromCode(field.value);
          if ("problem" in found) return say(PROBLEMS[found.problem]);
          await me.use(found.key);
          say("");
          title.textContent = "Done";
          body.replaceChildren(
            ...para(
              "Your identity is back. Comments you wrote on this page before stay as they are, and show as written by an earlier you.",
            ),
          );
          buttons.replaceChildren(button("Reload", () => close(true), true));
        },
        true,
      ),
    );
    field.focus({ preventScroll: true });
  };
  // First, what to do.
  title.textContent = "My identity";
  body.replaceChildren(
    ...para(
      portable
        ? "Your identity is portable: you have a recovery code for it."
        : "Your identity stays in this browser, so a cleared browser, or another computer, starts you over as someone new.",
    ),
  );
  // A way to reach them, shared on purpose.
  const shared = doc.contacts().get(doc.me) ?? "";
  const reach = h("input", {
    class: "dlg-f",
    type: "text",
    maxlength: "120",
    "aria-label": "Email or GitHub name",
    spellcheck: "false",
    placeholder: "you@example.org or gh:yourname",
  });
  reach.value = shared;
  const share = button("Share", async () => {
    const ok = await me.share(reach.value);
    if (ok) stop.hidden = false;
    say(
      ok
        ? "Shared with everyone who has this page's comments."
        : "That isn't an email address or a GitHub name (gh:yourname).",
    );
  });
  const stop = button("Stop sharing", async () => {
    await me.unshare();
    reach.value = "";
    stop.hidden = true;
    say("Stopped. People who see this page's comments from now on won't see it.");
  });
  stop.hidden = !shared;
  body.append(
    h("h3", { class: "dlg-h" }, "Let people reach you"),
    ...para(
      "If you share an email address or a GitHub name, people who mention you can offer to let you know. Everyone who has this page's comments can see it.",
    ),
    reach,
    h("div", { class: "dlg-a" }, stop, share),
  );
  buttons.replaceChildren(
    button("Close", () => close()),
    button("Use a recovery code", restoreView),
    button(portable ? "Back up my identity" : "Make it portable", backupView, true),
  );
  const content = h("div", {}, title, body, message, buttons);
  dialog = host.openDialog(content, "Your identity");
}
