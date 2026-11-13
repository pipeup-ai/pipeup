// Editorial order: an exact visual anchor, a slide comment, then touch discovery.
// File names are immutable content hashes. Pin coordinates are percentages of the whole image.
export const scenes = [
  {
    "id": "field-report",
    "kind": "Field report",
    "title": "Review a document",
    "question": "Where would you pin a suggestion about the October water level?",
    "alt": "Field report with a pen-and-ink elevation of the timber footbridge and its October high-water line.",
    "pins": [
      {
        "label": "Timber deck",
        "x": 49,
        "y": 50
      },
      {
        "label": "High-water mark",
        "x": 81,
        "y": 63.3
      }
    ],
    "file": "381b48944fb16dbb777acd75230273bca113236183b6c5176ea484d308827ae3.svg"
  },
  {
    "id": "slide-deck",
    "kind": "Slide deck",
    "title": "Review a slide",
    "question": "Can you tell which part of the slide the comment belongs to?",
    "alt": "Slide two of three, “Raise the deck before spring”, beside its open comment box.",
    "pins": [
      {
        "label": "Deck proposal",
        "x": 50.5,
        "y": 28.5
      },
      {
        "label": "Comment box",
        "x": 80.2,
        "y": 27.6
      }
    ],
    "file": "9435e3ce1e9d490e22d37c340f102f8f8ee4fc05038397bb16e439841462fadc.jpg"
  },
  {
    "id": "phone",
    "kind": "Phone",
    "title": "Review on a phone",
    "question": "Where would you tap to start a comment while reading?",
    "alt": "Mobile field report with the “Autumn at the footbridge” heading and a comment button in the lower right.",
    "pins": [
      {
        "label": "Report heading",
        "x": 67,
        "y": 18.5
      },
      {
        "label": "Comment button",
        "x": 94,
        "y": 97.4
      }
    ],
    "file": "7332021e788f9c3172f9d390b144f0578dd3d4a359367a100bd156d985bc7b76.jpg"
  }
];
