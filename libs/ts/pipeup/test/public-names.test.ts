import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MANGLED, PUBLIC_NAMES } from "../scripts/mangle.mjs";

/** The types an add-on is written against: every property name in them is public and must survive mangling. */
const API_TYPES = [
  "PipeupAddon",
  "AddonHost",
  "AddonDocument",
  "AddonInfo",
  "NetworkUse",
  "MenuItem",
  "ItemHandle",
  "PanelOptions",
  "PanelHandle",
  "Status",
  "UiSnapshot",
  "ComposerTool",
  "ComposerHandle",
  "Dictation",
];

function apiNames(): Set<string> {
  const program = ts.createProgram(["src/index.ts"], {
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  });
  const checker = program.getTypeChecker();
  const entry = checker.getSymbolAtLocation(program.getSourceFile("src/index.ts")!)!;
  const exported = new Map(checker.getExportsOfModule(entry).map((s) => [s.name, s]));
  const names = new Set<string>();
  for (const type of API_TYPES) {
    const sym = exported.get(type);
    expect(sym, `${type} is exported from the package`).toBeDefined();
    const resolved = sym!.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym!) : sym!;
    for (const decl of resolved.declarations ?? []) {
      if (!ts.isInterfaceDeclaration(decl)) continue;
      for (const m of decl.members) if (m.name && ts.isIdentifier(m.name)) names.add(m.name.text);
    }
  }
  expect(names.size).toBeGreaterThan(50);
  return names;
}

describe("the add-on API's names", () => {
  it("never match the mangled internal names", () => {
    expect(PUBLIC_NAMES.filter((n) => MANGLED.test(n))).toEqual([]);
  });

  it("are all listed in PUBLIC_NAMES, so a new key can't be mangled by accident", () => {
    const listed = new Set(PUBLIC_NAMES);
    expect([...apiNames()].filter((n) => !listed.has(n)).sort()).toEqual([]);
    expect([...apiNames()].filter((n) => MANGLED.test(n))).toEqual([]);
  });
});
