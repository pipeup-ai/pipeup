/**
 * Everyone is an animal in a colour ("Red Fox") until they add a name. Both come from the reviewer's public key, so
 * one identity is the same animal in the same colour on every page and every device that holds it. The UI draws each animal
 * (ui/animals.ts); this module only names them, so core code such as copy for AI can say who wrote what.
 */
export const ANIMALS = ["Otter", "Fox", "Owl", "Bear", "Rabbit"] as const;

export type Animal = (typeof ANIMALS)[number];

/** The colour each animal comes in, so 50 reviewers can be told apart before they add names. */
export const COLOURS = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Teal",
  "Blue",
  "Purple",
  "Pink",
  "Brown",
  "Grey",
] as const;

/** FNV-1a over a reviewer's key, then mixed, so every animal and colour comes up evenly. */
function mix(author: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < author.length; i++) x = Math.imul(x ^ author.charCodeAt(i), 0x01000193);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Which animal (an index into ANIMALS) a reviewer is. */
export const animalOf = (author: string): number => mix(author) % ANIMALS.length;

/** Which colour (an index into COLOURS) their animal is: from another part of the same hash. */
export const colourOf = (author: string): number => Math.floor(mix(author) / ANIMALS.length) % COLOURS.length;

/** A reviewer's animal in its colour, such as "Red Fox". */
export const animalName = (author: string): string =>
  `${COLOURS[colourOf(author)]} ${ANIMALS[animalOf(author)]}`;

/** What to call a comment's writer: their name, or their animal until they add one. */
export const nameOf = (c: { author: string; name: string }): string => c.name || animalName(c.author);
