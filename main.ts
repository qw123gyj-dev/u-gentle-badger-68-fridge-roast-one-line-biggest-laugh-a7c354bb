/**
 * Fridge Roast: One Line, Biggest Laugh — deterministic entry picker.
 *
 * Bounty: write one line of at most 200 characters roasting a smart
 * fridge — its app, its firmware updates, its camera, its ice maker,
 * its opinions about your milk. A comedy judge compares entries two
 * at a time and keeps the line that lands hardest, weighing (most
 * important first):
 *
 *   1. The line is a roast of a smart fridge, with the joke aimed at
 *      the fridge itself, its app, its firmware or its ice maker.
 *   2. The punchline lands: the line builds to a turn or a surprise
 *      that gets a laugh on the first read.
 *   3. The joke is specific to smart fridges rather than a generic
 *      kitchen appliance gag that would work on any gadget.
 *   4. The wording is tight: every word earns its place inside the
 *      200 character limit, with no setup the punchline does not need.
 *   5. The angle is fresh: it avoids the obvious cracks about the
 *      fridge ordering groceries or watching you that most writers
 *      reach for first.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt).
 * It then reads the file back and verifies it byte-for-byte against
 * every gate: 1–200 characters, a single line, valid UTF-8, and not
 * only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first one
 * where they differ, and let that decide unless a later one differs
 * by much more." Ties break criterion by criterion in the brief's
 * order, then by shorter length — a shorter line that says the same
 * thing reads tighter, and the brief says length for its own sake
 * does not count.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the fridge's feature (the ice maker,
 *     the camera, the app) without turning it into a roast — no
 *     insult, no blame, no punchline — is capped on funniness.
 *     Naming the appliance is the setup, not the joke.
 *   - Predictable gags are docked hard. The brief names the two
 *     shopworn cracks outright: the fridge ordering groceries and
 *     the fridge watching you. Any line leaning on either loses
 *     funniness points and is capped on freshness, however the
 *     punchline is dressed up.
 *   - The twist must land in the last few words. A punchline buried
 *     in the middle is a line that fizzles; the surprise bonus only
 *     counts when the turn sits inside the final six words.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate roast. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "firmware-forgot-cold",
    text: "My fridge installed a firmware update overnight and now it needs a password, a reboot, and a minute to remember what cold is.",
  },
  {
    id: "ice-maker-hobby",
    text: "The ice maker has been making ice for three days, which is technically true if you count the one cube it produced as a hobby.",
  },
  {
    id: "milk-given-up",
    text: "My smart fridge texted me that the milk expired, then suggested the almond milk, like a man who has given up on himself.",
  },
  {
    id: "camera-no-self-control",
    text: "The fridge camera photographed my leftovers in HD so the app could tell me, in 4K detail, that I have no self-control.",
  },
  {
    id: "door-tells-oven",
    text: "My fridge beeps if the door stays open ten seconds, then pings my phone, then tells the oven. They talk about me.",
  },
  {
    id: "touchscreen-weather",
    text: "The fridge has a touchscreen bigger than my first TV, and its only job is showing me a weather forecast I will never check while holding milk.",
  },
  {
    id: "wifi-peaked-2019",
    text: "My fridge lost Wi-Fi and panicked, which is fair \u2014 without the cloud it is just a cold box that knows it peaked in 2019.",
  },
  {
    id: "reboot-nightlight",
    text: "The fridge rebooted mid-update and forgot it was a fridge, so it spent an hour as a very expensive, very cold nightlight.",
  },
  {
    id: "ice-dispenser-tip",
    text: "I asked the dispenser for ice and it gave me a lecture about my water filter, then one cube, as a tip.",
  },
  {
    id: "expiry-disappointed-parent",
    text: "The fridge scans my groceries and beeps like a disappointed parent every time I open it after midnight.",
  },
  {
    id: "chill-passive-aggressive",
    text: "I told the fridge to chill and it updated its firmware, which is the most passive-aggressive thing an appliance has ever done to me.",
  },
  {
    id: "subscription-landlord",
    text: "My fridge wants a subscription to keep the ice maker \u2018premium\u2019, which is how I learned my kitchen has a landlord.",
  },
  {
    id: "sensor-paywall",
    text: "The fridge diagnosed itself with a faulty sensor, emailed me the report, and charged me $4.99 to read the solution.",
  },
  {
    id: "milk-nutritionist",
    text: "My fridge has opinions about my milk \u2014 it texts me \u20182%?\u2019 every morning like a disappointed nutritionist with a camera.",
  },
  {
    id: "cake-wellness",
    text: "The fridge camera caught me eating cake at 2 a.m. and the app filed it under \u2018wellness\u2019, a word it clearly does not understand.",
  },
  {
    id: "smart-but-no-ice",
    text: "My fridge is so smart it can order groceries, track my diet, and stream music \u2014 and so dumb it cannot make ice.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Fridge-specific features the brief itself names as the good kind
 * of target — the app, the firmware, the camera, the ice maker, the
 * milk — plus the same family (touchscreen, Wi-Fi, water filter,
 * sensor, subscription, door alarm, dispenser). A line scores
 * specificity for each distinct feature it actually uses, not for
 * gesturing at "the kitchen" in the abstract.
 */
const FRIDGE_FEATURES = [
  "fridge",
  "smart fridge",
  "firmware",
  "ice maker",
  "ice dispenser",
  "dispenser",
  "app",
  "camera",
  "touchscreen",
  "wi-fi",
  "wifi",
  "water filter",
  "sensor",
  "subscription",
  "door",
  "milk",
  "groceries",
  "update",
  "reboot",
  "cloud",
];

/** Distinct fridge-specific features present in the line. */
function fridgeFeatures(text: string): string[] {
  const lower = text.toLowerCase();
  // "fridge" alone does not count twice when "smart fridge" also
  // matches: keep the longer phrase and drop the bare word.
  const found = FRIDGE_FEATURES.filter((f) => lower.includes(f));
  if (found.includes("smart fridge") && found.includes("fridge")) {
    return found.filter((f) => f !== "fridge");
  }
  return found;
}

/**
 * Words that aim the joke at the fridge itself — an insult, a
 * judgement, a failure pinned on the appliance. A roast needs a
 * target that takes the hit; a line that only describes the fridge
 * neutrally is a product review, not a roast.
 */
const ROAST_MARKERS = [
  "dumb",
  "stupid",
  "useless",
  "passive-aggressive",
  "disappointed",
  "panicked",
  "forgot",
  "lecture",
  "landlord",
  "no self-control",
  "talk about me",
  "given up",
  "cannot make ice",
  "hobby",
  "as a tip",
  "nightlight",
  "peaked",
  "judge",
  "shame",
  "expensive",
  "charged me",
  "beeps like",
];

/** How many roast markers the line carries. */
function roastMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return ROAST_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * The two shopworn cracks the brief warns against by name: the
 * fridge ordering groceries, and the fridge watching you. A line
 * built on either is predictable by definition, however it is
 * dressed up — most writers reach for these first.
 */
const SHOPWORN_PATTERNS = [
  "order groceries",
  "ordering groceries",
  "order more",
  "caught me eating",
  "watching me",
  "spying on me",
  "watches me",
];

/** True when the line leans on one of the brief's obvious cracks. */
function usesShopwornGag(text: string): boolean {
  return containsAny(text, SHOPWORN_PATTERNS);
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "what cold is",
  "as a hobby",
  "given up",
  "no self-control",
  "talk about me",
  "holding milk",
  "peaked in 2019",
  "nightlight",
  "as a tip",
  "done to me",
  "has a landlord",
  "read the solution",
  "does not understand",
  "cannot make ice",
  "nutritionist",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a price tag on the insult, a personification pushed one step
 * too far. One beat is a joke; two beats is a line that lands
 * twice on the first read.
 */
const COMIC_BEATS = [
  "as a hobby",
  "as a tip",
  "very expensive",
  "peaked in 2019",
  "landlord",
  "nightlight",
  "passive-aggressive",
  "disappointed",
  "no self-control",
  "talk about me",
  "given up",
  "does not understand",
  "what cold is",
  "cannot make ice",
  "holding milk",
  "$4.99",
  "in 4k detail",
  "2 a.m.",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * A line that only names the fridge's feature without turning it
 * into a roast: it points at the ice maker / the camera / the app
 * and stops there, offering no insult, no failure, no punchline.
 * It has a subject and no joke. Such lines are capped on
 * funniness no matter how vivid the feature is.
 */
function onlyNamesFeature(text: string): boolean {
  const hasFeature = fridgeFeatures(text).length > 0;
  const hasTurn =
    roastMarkerCount(text) > 0 ||
    hasAnyTwist(text) ||
    /\b(but|so|which is|like a|then)\b/i.test(text);
  return hasFeature && !hasTurn;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: the line is a roast of a smart fridge. */
  onBrief: number;
  /** C2: the punchline lands, with a turn on the first read. */
  punchline: number;
  /** C3: specific to smart fridges, not a generic gadget gag. */
  specificity: number;
  /** C4: tight wording inside the 200 character limit. */
  tightness: number;
  /** C5: fresh angle, dodging the obvious cracks. */
  freshness: number;
}

/**
 * C1 — On brief. A line earns its points by being, in its own
 * words, a roast of a smart fridge: the fridge named, a target the
 * brief lists (its app, its firmware, its ice maker, its opinions
 * about your milk), and a roast marker that aims the joke at the
 * fridge itself. A line that is not a roast of a smart fridge loses
 * to any roast of a smart fridge, so a line missing the subject or
 * the sting can never win on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (containsAny(c.text, ["fridge", "smart fridge"])) score += 5;
  if (
    containsAny(c.text, [
      "app",
      "firmware",
      "ice maker",
      "ice dispenser",
      "dispenser",
      "camera",
      "milk",
      "update",
    ])
  ) {
    score += 3;
  }
  if (roastMarkerCount(c.text) >= 1) score += 2;
  return Math.min(10, score);
}

/**
 * C2 — Punchline. A real joke needs a turn the reader does not see
 * coming, and the turn has to land late. Full marks need a late
 * twist plus a second comic beat (an absurd escalation, a price
 * tag on the insult). A line whose twist sits early, or which only
 * names the feature without turning it into a roast, is capped at
 * 4: it has a subject, not a joke. A line leaning on one of the
 * brief's shopworn cracks loses 3 points — the "order groceries"
 * and "watching you" reflexes are the opposite of a surprise.
 */
function scorePunchline(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (roastMarkerCount(c.text) >= 2) score += 2;
  if (usesShopwornGag(c.text)) score -= 3;
  if (onlyNamesFeature(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Specificity. Two points per distinct fridge-specific
 * feature, up to the cap, with a base of 2 for naming the fridge
 * at all. A line with no fridge-specific feature — one that would
 * work just as well about a toaster, a phone, or any gadget with
 * an app — is capped at 4: it is a generic appliance gag wearing
 * a fridge costume.
 */
function scoreSpecificity(c: Candidate): number {
  const features = fridgeFeatures(c.text);
  let score = Math.min(10, 2 + features.length * 2);
  if (features.length === 0) score = 2;
  if (features.length === 1 && features[0] === "fridge") score = 4;
  return score;
}

/**
 * C4 — Tightness. The gate allows 200 characters; a line that
 * reads tight is shorter still. Full marks under 130 characters,
 * sliding down to 6 at the 200 cap — length for its own sake does
 * not count, and a line that needs two breaths is a line that
 * loses the room. Every word has to earn its place.
 */
function scoreTightness(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 130) return 10;
  if (len <= 150) return 9;
  if (len <= 170) return 8;
  if (len <= 200) return 6;
  return 0;
}

/**
 * C5 — Freshness. Two points per distinct fresh angle — a
 * subscription landlord, a firmware that forgets what cold is, an
 * ice maker with a hobby, appliances gossiping behind your back —
 * up to the cap. The shopworn cracks cost 4 here as well as on
 * the punchline: ordering groceries and watching you are precisely
 * the obvious angles the brief says to avoid, and a line built on
 * them has no fresh angle at all, however it is framed.
 */
const FRESH_ANGLES = [
  "subscription",
  "landlord",
  "forgot it was a fridge",
  "remember what cold is",
  "as a hobby",
  "talk about me",
  "tells the oven",
  "peaked in 2019",
  "nightlight",
  "passive-aggressive",
  "charged me",
  "as a tip",
  "nutritionist",
  "no self-control",
  "weather forecast",
  "holding milk",
];

function scoreFreshness(c: Candidate): number {
  const lower = c.text.toLowerCase();
  const angles = FRESH_ANGLES.filter((a) => lower.includes(a)).length;
  let score = Math.min(10, 2 + angles * 2);
  if (angles === 0) score = 2;
  if (usesShopwornGag(c.text)) score = Math.max(0, score - 4);
  return score;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    punchline: scorePunchline(c),
    specificity: scoreSpecificity(c),
    tightness: scoreTightness(c),
    freshness: scoreFreshness(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads tighter, and the brief says length
 * for its own sake does not count.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "punchline",
    "specificity",
    "tightness",
    "freshness",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.punchline}  ` +
        `${scores.specificity}  ${scores.tightness}  ${scores.freshness}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} punchline=${winner.scores.punchline} ` +
      `specificity=${winner.scores.specificity} tightness=${winner.scores.tightness} ` +
      `freshness=${winner.scores.freshness}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
