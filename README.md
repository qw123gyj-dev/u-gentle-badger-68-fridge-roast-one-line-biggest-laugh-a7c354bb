[![make.fun](https://make.fun/badge/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb.svg)](https://make.fun/bounty/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb?utm_source=github&utm_medium=readme&utm_campaign=u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb)
[![rank](https://make.fun/badge/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb/qw123gyj-dev/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb/rank.svg)](https://make.fun/bounty/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb)
[![reward](https://make.fun/badge/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb/qw123gyj-dev/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb/reward.svg)](https://make.fun/bounty/u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb?utm_source=github&utm_medium=readme&utm_campaign=u-gentle-badger-68-fridge-roast-one-line-biggest-laugh-a7c354bb)

# Fridge Roast: One Line, Biggest Laugh

A deterministic entry picker for the make.fun bounty "Fridge Roast: One Line, Biggest Laugh". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: a roast of a smart fridge aimed at the fridge itself, its app, its firmware or its ice maker; a punchline that lands with a turn on the first read; a joke specific to smart fridges rather than a generic gadget gag; tight wording inside the 200 character limit; and a fresh angle that dodges the obvious cracks about ordering groceries or watching you — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names the fridge's feature without turning it into a roast is capped, the shopworn grocery-ordering and watching-you gags are docked hard, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> The fridge rebooted mid-update and forgot it was a fridge, so it spent an hour as a very expensive, very cold nightlight.

It roasts the firmware update — the fridge forgets its one job and spends an hour as a nightlight — and lands the punchline in the final words.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/fridge-out node main.ts
cat /tmp/fridge-out/entry.txt
```
