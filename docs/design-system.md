# Evalix design system

Reverse-engineered from [learnwithzero.com](https://learnwithzero.com/) and
[why.zero.university](https://why.zero.university/), then adapted for Evalix.

## Method

1. **Walked both sites** end to end at 1440×900 (why.zero only opens after you draw a zero on its intro
   canvas; the stroke was replayed as pointer events to get past it).
2. **Downloaded the shipped HTML / CSS / JS** of both sites and ran
   [rea](https://github.com/morluto/rea) on them:
   `rea analyze-javascript-application <dir> --json` (rea 6.10.1, run under Node 26).
3. **Used rea's evidence as an index** — its function / endpoint / storage inventory, each with a file:line:column
   source range — to locate and read the code behind each visual behaviour.
4. **Read computed styles and the stylesheet** for exact tokens.

## What rea found

| | learnwithzero.com | why.zero.university |
|---|---|---|
| Parsed | 3 JS files, 118,873 AST nodes, 208 findings | 1 JS file (1.2 MB), 297,533 AST nodes, 549 findings |
| Functions / fingerprints | 1,744 function fingerprints | 3,882 function fingerprints |
| Libraries (from function names) | GSAP core, `ScrollTrigger`, `CustomEase`, `scrollerProxy` (Lenis) | three.js (`WebGLRenderer`, raycast, clearcoat, KTX2/Draco loaders), GSAP |
| Design-relevant functions | `CustomEase.create("zero", …)`, dock `away()`, XP `award()` | `_checkZeroGesture`, `onCircleComplete`, `_attachHoldMode`, `_handleHoldTrigger`, `_updateRulerNavState`, `showScrollIndicator`, `_createAudioToggle`, `_setupHand`, `_setupHumanHand` |
| Storage | `zero-motion-off` (sessionStorage) — user motion switch | `zero:utm` (localStorage) |
| Assets / endpoints | `assets/brands/colors.json` (brand tint per logo chip) | `fancy_hand_2.glb`, `human_hand_1/2.glb`, `tunnel_new_new.glb`, `glass_shards.glb`, atlases `shards-petals-coins.ktx2`, `texts.ktx2`, `frost.webp` |

### Behaviours recovered from the located source

- **Zero gesture** (`_checkZeroGesture`): centroid of the stroke → mean radius → reject if the radius' coefficient of
  variation is too high → require ≥ 2π of swept angle → require the loop to close; then a shader "melt" tween
  (`uMelt` → 1.2 over 3.5 s, `power2.inOut`).
- **Hold mode** (`_attachHoldMode`): pointer-down starts a per-frame progress (default 3 s); releasing within 500 ms
  keeps part of the progress; a looping hold sound and a ripple run while held.
- **Ruler** (`_updateRulerNavState`): a top-centre ruler tracks scroll segments and is clickable for stage navigation.
- **Motion defaults** (learnwithzero): `CustomEase "zero" = (.625,.05,0,1)`, `"zeroOut" = (.16,1,.3,1)`,
  `gsap.defaults({ ease: "zero", duration: .6 })`.
- **XP** (learnwithzero): `award(kind, el, xp, label)` with an XP meter arc (`.xpm__arc`) — both sites gamify.

## Tokens (`client/src/index.css`)

- Paper `#F8F9FB` · wall `#F4F6FA` · surface `#FFF` · ink `#0F0F0F` (72 / 50 / 30 % steps) · line `rgba(15,15,15,.08)` · text `#3F4240`
- Brand green `#1D9E4B` / `#36C267` · yellow `#FFD21E` · blue `#2496ED` · why.zero teal `#1C4839 → #6FAE9C`
- Type: Google Sans Flex 400 (their "Zero Sans"), Instrument Serif (stand-in for the commercial STK Bureau Serif),
  Google Sans Code for labels.
- Radius: keys 16 px (dock 20 px), cards 22 px. Easing: `--ease-zero`, `--ease-zero-out`, `--ease-out`.

## Side-by-side: reference → Evalix

| Reference element | Where | Evalix implementation | Difference |
|---|---|---|---|
| Fogged 3D city behind a centred 400-weight headline | lwz hero | `IsoScene` (CSS-3D campus of practice tracks) under a white fog mask | Built in CSS, not a pre-rendered 3D image |
| Presenter avatar + speaker badge after headlines | lwz every section | `Speaker` (Shristi orb + audio chip) via `Say` | Orb instead of a photo |
| Keycap dock: Start, menu, help | lwz / why.zero | `Dock` + `.key`, `.key--ink` | Same recipe; adds a motion toggle |
| Logo arc on a dark band | lwz "5,000+ companies" | `TopicArc` of interview topics | No fabricated company claims |
| Role carousel with category tabs | lwz "hottest roles" | Track carousel with tabs | Orb art instead of people photos |
| Hand-drawn connector timeline + product shots | lwz "Learn the job by doing it" | `DrawPath` timeline + product windows | Same |
| Profile card with floating tags | lwz "You learn. We match." | Scorecard with floating keycap tags | Same |
| Inline card glyph inside headline | lwz "Built to get you hired." | Same headline with a ✓ card glyph | Same |
| Colour city finale with glowing START | lwz end | `IsoScene vivid` + green START key | CSS city |
| Draw-a-zero gesture gate | why.zero intro | `HoldKey` "Hold to answer" in the hero | Hold, not draw — ties to voice answers |
| XP counter + awards | why.zero HUD (+100 XP per stage), lwz `award()` | `XPPill` + `awardXP` toasts; +20 XP per ruler section | Same idea |
| Calligraphic teal words "College would land You" over mint sky with rays and coins | why.zero stage 1 | `SkyScene` "Practice would land You the offer." | Orb instead of the glTF hand |
| Top scroll ruler with stage navigation (−100 → 0 BZ) | why.zero | `ScrollRuler` (shown from 1024 px) | Same |
| Final stage: isometric company city | why.zero 0 BZ = lwz city | `IsoScene` finale | Both references end here; CSS city |
| Motion-off switch | lwz `zero-motion-off` | Dock menu → "Reduce motion" (`evalix-motion-off`) | Same |

## Not reproduced (and why)

- **3D glTF hands, tunnels and glass shards (why.zero).** These are the site's own 3D assets. Evalix stays
  asset-free and uses its own orb and CSS scenes.
- **Bureau Serif and Zero's custom wordmark.** These are commercial and proprietary. Instrument Serif is the stand-in.
- **Sound design (Howler).** Not added; Evalix's audio is the interview itself.
