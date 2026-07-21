# Ewe Beauty Farming Co — NEXT EDITS (handoff)

> You're a fresh Claude session rooted in this repo (`willfred`). This is the live to-do
> list from Travis (the owner). Also read `WILLFRED_Woofas_Games_BUILD_HANDOFF.md` in his
> Downloads for the full project context. **Ewe Beauty is the headline game** (`farm.html`
> + `farm.js`, save key `ewe_beauty_v1`) — a sheep-farming sim for a few kids who love it.
> The bar: **make it ultra fun — giggling-level fun.** Go hard, batch big, verify boot→play
> with zero errors before every push (open `farm.html#debug`, drive `window.__farm`, capture
> `window.onerror`). Bump `sw.js` CACHE version each push. It auto-deploys to GitHub Pages
> (https://travislegg9-star.github.io/willfred/). NEVER touch any repo outside `willfred`.

## Where things live in `farm.js`
- **State/save:** `defaultSave()`, `F` object, `sheep/dogs/foxes/grass/fluff/alerts` arrays, `F.pens`.
- **Sim:** `update(dt)` — sheep needs/wool/death, breeding, foxes, dog herding, tractor, grass, alerts.
- **Render:** `render()` + `drawSheep/drawDog/drawFox/drawTractor/drawPen/drawGrass/drawTrough/drawShed/drawAlerts`.
- **Depth/angle:** `dscale(y)`, `fieldBounds(y)` (trapezoid), `INSET`.
- **Pens/fences:** `penWalls(p)`, `repelFromPens(e,buf)`, `GATE_W`; input `onDown/onMove`, `nearGate/insidePen`.
- **Economy:** `refillFeed/refillWater/sellWool`, `renderShop`, `buy*`, `woolPrice`, `BREEDS`, `DOGS`.
- **Debug hooks:** `window.__farm` (`start/step/info/give/feed/sell/forceWool/shearAll/spawnFox/pushFox/forceBreed/starve/flockSpread/grassTotal/dbg`).

---

## 🔴 BUGS — fix first

1. **Resources don't deplete → no need to buy food/water (economy is dead).**
   Feed/water bars barely move; sheep basically feed themselves. Root causes: grass grazing
   (`update` grass loop) makes hunger too easy; trough consumption rates (`F.feed -= 0.02*dt`,
   `F.water -= 0.015*dt`) are tiny; the economical/electric power auto-tops resources for free-ish.
   **Fix:** make feed & water **visibly deplete as sheep eat** so the player must **buy refills**.
   Raise consumption, make grass a small supplement (or finite), and make power upgrades cost more
   / top up slower. Target: you actively manage food+water and it costs money = the core loop.

2. **Sheep get stuck in pens (behind the open gate).**
   `repelFromPens` pushes sheep off fence segments; near the gate gap they jam. Rework pen
   containment so sheep pass cleanly through the **open** gate and never wedge on the posts.
   Consider: gate is a real opening (no repulsion within the gap + a lead-in funnel), and give
   sheep a gentle "seek nearest gap" when trapped.

3. **Herding piles all sheep onto ONE point.**
   The dog herd targets the flock centroid and over-compresses — "all my sheep stuck on one sheep."
   Fix: dogs should hold them in a **loose circle/mob**, not a dot. Add **sheep-to-sheep separation**
   (each sheep repels nearby sheep a little) so they spread into a nice round bunch instead of stacking.

---

## 🟠 CONTROLS / UX

4. **Click clash — shearing vs herding.** Tapping to shear a ready sheep also sends Woofa + the
   tractor chasing it. Separate the actions. Options (pick cleanest): a small **control toggle** to
   "select" Woofa/tractor before commanding them, OR only herd on **empty-ground tap** and always
   shear-on-sheep-tap first (already tries this — but the herd still fires near sheep). Make shearing
   a clean direct tap with no herd side-effect.

5. **HUD indicators hidden / hard to see.** The money/wool pills still crowd the ‹ Games button, and
   the feed/water bars are tiny. **Use the empty SKY space up top** for big, clear **food & water
   gauges** and money/wool — make them obvious for kids. (`farm.html` HUD + `style.css`; feed/water
   bars are `#feedBar/#waterBar`.)

6. **Shear only inside a pen.** New loop Travis wants: you **can't shear in the open** — you must
   **herd sheep into a pen** first, then shear them there. Reinforces the round-up gameplay. Add a
   "get them in the pen!" prompt.

---

## 🟡 FEATURES

7. **Movable food & water troughs.** Let the player drag the troughs (like pens) so they can place
   feed/water **inside a pen** (penned sheep currently can't reach them). Same drag/place pattern as pens.

8. **Movable gate / gate on ANY side.** The gate is locked to the pen's front (bottom). Let the player
   choose which side the gate is on (tap a side to move the gate, or a rotate control). Update
   `penWalls`, `nearGate`, and `drawPen` for a gate on any of the 4 sides.

9. **Distinguish sheep by breed AND role — they all look the same.** Ewe vs ram is unclear (horns too
   subtle), and Merino/Golden/Black barely differ. Make each **breed** clearly distinct (wool colour,
   size, sheen — golden shiny, black obvious, merino curlier/cream) and each **role** clear (rams =
   bigger + bold curled horns; ewes = slender no horns; lambs = tiny, already OK). `drawSheep`.

10. **Ram/ewe balance — too many rams.** Buying/breeding skews to rams. Bias new sheep + lambs toward
    **ewes** (e.g. ~70% ewe), keep a few rams. `buySheep` role roll + breeding lamb role roll.

11. **Farmhouse + upgrades.** Add a **farmhouse** building you can **upgrade** (levels → perks, e.g.
    passive income, faster wool, storage). Currently none exists. New building + shop upgrade path.

12. **Upgradeable pens.** Pens should upgrade (bigger, sturdier, maybe auto-feed inside). Add pen
    upgrade UI (tap a pen → upgrade, or shop).

13. **Bigger farm / more space.** Make "Expand the Farm" feel substantial — noticeably bigger paddock,
    more room, more sheep. Consider multiple paddocks/fields later.

14. **SLOW THE PACE DOWN.** Whole game is too fast. Slow needs rising, wool growth, breeding & fox
    frequency so it's a relaxed build-up, not frantic. (But keep resources depleting enough that you
    still must buy food/water — see bug #1. Balance both.)

---

## 🎉 JUICE / FUN (make the kids giggle)

15. **Cool animated START ENTRANCE.** A proper "Welcome to Ewe Beauty Farming Co" intro — animated
    (sheep bouncing in, Woofa running across, title drop, etc.). Currently just a static panel.

16. **Toggle-able TUTORIAL.** An on/off tutorial that instructs at the start — step-by-step: feed,
    water, shear, sell, herd, watch for foxes. A "?" button to replay it.

17. **Funny FOX-TERMINATED animations.** When a dog catches a fox, occasionally (not every time) do a
    **hilarious finisher** — fling the fox off into the sunset / launch it off-screen / spin it away —
    with a flashing **"FOX TERMINATED"** style callout. Make it silly and satisfying.

18. **General ultra-fun polish.** Sounds/feedback, bouncier animations, celebratory effects on sell/
    breed/level-up, happy sheep reactions when fed. Whatever makes it more delightful for kids.

---

## Suggested order
1) Bugs (#1 economy, #2 pen-stuck, #3 herd-clump) — the game isn't fun until these are right.
2) Controls (#4 click clash, #5 HUD, #6 shear-in-pen) + #14 slow pace.
3) Troughs/gate movable (#7, #8) + sheep looks/balance (#9, #10).
4) Start entrance (#15) + fox-terminated (#17) + tutorial (#16) — the fun layer.
5) Farmhouse/pen/space upgrades (#11–#13).

Verify each batch boot→play zero errors, then push (bump `sw.js` CACHE) and confirm live/byte-identical.
