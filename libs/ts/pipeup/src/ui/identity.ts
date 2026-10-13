import type { CodeProblem } from "../crypto/portable";
import { h } from "./dom";

export interface IdentityDeps {
  /** This identity was made portable: it has a recovery code. */
  portable: boolean;
  /** The recovery code of a portable identity. */
  code(): Promise<string | null>;
  /** Makes a new portable identity, keeps it, and returns its recovery code. */
  make(): Promise<string>;
  /** Keeps the identity a code stands for, or says what is wrong with the code. */
  use(code: string): Promise<CodeProblem | null>;
  copy(text: string): Promise<void>;
  /** Starts over with the identity now kept (the page reloads). */
  reload(): void;
  /** Whether the comments on this page were written by the current identity (so a change is felt). */
  hasComments: boolean;
}

const PROBLEMS: Record<CodeProblem, string> = {
  shape: "That doesn't look like a recovery code. It starts with PU1 and is about 60 characters long.",
  mistake: "The code has a mistake in it. Check it against where you kept it, character by character.",
};

/**
 * A small dialog over the page for what a reviewer can do with their identity: make it portable or back it up (see the
 * code, copy it, save it as a file), or use one they backed up. Plain words say what each does.
 */
export function openIdentity(layer: HTMLElement, deps: IdentityDeps): void {
  layer.querySelector(".dlg")?.remove();
  const box = h("div", { class: "dlg", role: "dialog", "aria-label": "Your identity" });
  const title = h("h2", { class: "dlg-t" });
  const body = h("div", { class: "dlg-b" });
  const message = h("p", { class: "dlg-m", role: "status" });
  const buttons = h("div", { class: "dlg-a" });
  box.append(title, body, message, buttons);
  let closed = false;
  const close = (reload = false) => {
    if (closed) return;
    closed = true;
    box.classList.remove("show");
    box.inert = true;
    window.setTimeout(() => box.remove(), 260);
    if (reload) deps.reload();
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
      layer.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("Saved. Keep the file somewhere safe.");
    };
    buttons.replaceChildren(
      button("Copy code", () =>
        deps.copy(code).then(
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
    if (deps.portable) {
      title.textContent = "Back up my identity";
      body.replaceChildren(...para("One moment…"));
      void deps
        .code()
        .then((code) => (code ? showCode(code, false) : say("This identity can't be backed up.")));
    } else {
      title.textContent = "Make my identity portable";
      body.replaceChildren(
        ...para(
          "Your identity stays in this browser, and can't be taken out of it. To use it on another browser or computer, Pipeup makes you a new one that you can back up with a recovery code.",
          deps.hasComments
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
              showCode(await deps.make(), true);
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
          const problem = await deps.use(field.value);
          if (problem) return say(PROBLEMS[problem]);
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
  };
  // First, what to do.
  title.textContent = "My identity";
  body.replaceChildren(
    ...para(
      deps.portable
        ? "Your identity is portable: you have a recovery code for it."
        : "Your identity stays in this browser, so a cleared browser, or another computer, starts you over as someone new.",
    ),
  );
  buttons.replaceChildren(
    button("Close", () => close()),
    button("Use a recovery code", restoreView),
    button(deps.portable ? "Back up my identity" : "Make it portable", backupView, true),
  );
  box.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  layer.append(box);
  void box.offsetWidth;
  box.classList.add("show");
  (box.querySelector("textarea, button.primary, button") as HTMLElement | null)?.focus({
    preventScroll: true,
  });
}
