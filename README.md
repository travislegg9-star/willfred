# 🥏 Woofa Fetch

A tiny phone game where **Woofa** — a black-and-white German pointer × staghound —
*throws* the frisbee, and two kids sprint and hurl themselves after it for the hero
catch. Nail the throw and a kid leaps and snags it. Blow it and they faceplant,
break their bones, and cry about it.

Built as a **PWA** (installs to the home screen, works offline). No accounts,
no backend, no tracking. Everything saves locally on the phone.

> This project is 100% standalone. It has **no connection** to any other repo,
> database, or deployment.

## Play

- **Pull back** anywhere on screen like a slingshot, then **release** — that's Woofa's throw.
- Land it in the glowing **sweet-spot ring** → a kid leaps for the **hero catch**.
- Blow the throw and the kid eats dirt, breaks their bones, and cries. The two kids take turns.
- Perfect catches earn the most **🦴 bones**. Build a **🔥 streak** for bonuses.
- Spend bones in the **🛒 shop**: Spiky Ball, Squishy Ball, and a **Batman cape** for the kids.
- Overshoot on the **Rooftops** level and it's gone — you're stuck with the sad
  tennis ball until you buy a replacement.

Scenes ramp up: Backyard → Park → Beach → Rooftops → Snow, with growing
distance, wind, and heavier balls.

## Run locally

It's fully static — any static server works. From this folder:

```bash
npx serve .
# or
python -m http.server 5173
```

Then open the URL on your phone (same Wi-Fi) or in a browser and resize narrow.

> Open via `http://` (a local server), **not** `file://` — the service worker
> and PWA install need an http(s) origin.

## Deploy (Vercel — free)

No config needed; it's static.

```bash
npm i -g vercel   # once
vercel            # from this folder, follow prompts → preview URL
vercel --prod     # to promote to the public URL
```

Or drag-and-drop the folder into the Vercel dashboard, or connect the GitHub repo.
Share the URL with friends; on iPhone: Share → **Add to Home Screen**.

## Files

| File | What it is |
|------|-----------|
| `index.html` | Shell: canvas + menu/shop overlays |
| `style.css` | HUD, overlays, shop styling |
| `game.js` | The whole game — physics, Woofa, the kids' AI, scenes, shop, save |
| `manifest.webmanifest` | PWA metadata |
| `sw.js` | Service worker (offline cache) |
| `icon.svg` / `icon-maskable.svg` | App icons (Wilford's face) |

## Ideas for later

- Sound effects (a bark on the hero catch is mandatory).
- A shared friends leaderboard — *this* is when a small Supabase table would earn its keep.
- More unlockable balls, capes, and scenes; a photo of the real Woofa on the start screen.
- Real rasterized PNG icons if you want the crispest install badge on older Androids.


## Next version (2026)

Sheep Wrestling and Stick BMX now live in [`app/`](app/) — theatrical career mode, rare finishers, BMX on-screen control toggle. Original vanilla games stay in this folder.
