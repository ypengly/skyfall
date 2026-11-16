# SKYFALL: THE LAST DESCENT — Game Design

## Pillars
1. **Genuine falling.** You steer a body with momentum, drag and lift, not a camera on rails.
2. **Scale and beauty.** A 14 km descent through a living, changing world.
3. **Meaningful risk.** Speed buys time but costs control; fog, storms and canyons punish recklessness.

## The world
Distance along the path `d` (0 → 14,000 m) maps to altitude `7000 → 0 m` (average slope 0.5). A corridor (half-width 430 m,
narrowing to 230/260/170 m in the canyon stages and widening to 1,430 m at the end) snakes along the path; mountain walls rise up to 1,900 m beside it.
The valley floor lies 700 m below the path at the start (a long free-fall buffer), 330 m through the middle and rises to meet the path at the landing meadow.
A river follows the floor from stage 3 (frozen in snowy stages); waterfalls ribbon down the walls.

## Flight model
| State | Terminal / equilibrium | Notes |
|---|---|---|
| Free Fall | ~58 m/s down (≈210 km/h) | arms spread, light drift forward |
| Dive (W) | ~72 m/s down, ~76 m/s forward (≈375 km/h) | hardest to steer, camera pulls back, FOV widens |
| Glide (SPACE) | ~17 m/s sink, ~50 m/s forward (≈3:1) | best control, long reach |
| Air Brake (S) | ~23 m/s sink, ~7 m/s forward | stable; required for soft landings |

Coefficients blend over ~0.5 s. A/D turns heading; the velocity vector is bent toward heading, the body banks and the camera rolls slightly.
Shift boosts (more thrust, less drag) from a regenerating boost bar. Landing is safe below 28 m/s vertical and 58 m/s horizontal in stage 10.

## Stages
| # | Name | Environment | Time of day | Weather | Hazards |
|---|---|---|---|---|---|
| 1 | Mountain Awakening | First Mountain | sunrise–morning | clear, light snow | spires, boulders, updrafts, eagles |
| 2 | Above the Clouds | First Mountain | morning–late morning | overcast, cloud sea | turbulence, more spires |
| 3 | Waterfall Paradise | Waterfall Paradise | midday | mist | 9 waterfalls, rainbows, birds |
| 4 | The Green Valley | Green Valley | afternoon–sunset | thick fog | fogged spires, forests |
| 5 | The Narrow Canyon | Dark Canyon | golden hour–twilight | wind | gaps, tunnels, falling rocks, cave |
| 6 | Storm Above the Mountains | Dark Canyon | twilight–night | heavy storm | lightning telegraphs, turbulence |
| 7 | Frozen Kingdom | Snow Kingdom | night | snowstorm | snow cells, ice cave, frozen rivers |
| 8 | The Dark Descent | Dark Canyon | deep night | fog, flurries | gaps, tunnels, falling rocks, cave |
| 9 | The Last Mountain | Snow Kingdom | pre-dawn | blizzard + storm | narrow canyon, gusts |
| 10 | Paradise Below | Final Paradise | sunrise | clear, dawn mist | landing meadow, flocks, waterfalls |

Day/night is driven by progress (sunrise → … → sunrise) so the story beats line up; in Exploration/Endless it flows with real time.

## Systems
* **Collision:** analytic against heightfield, tapered spires, boulders, hollow cave tubes (inside = safe, rock = crash), cone-trees; soft hits for birds, falling rocks and lightning.
* **Checkpoints:** 9 amber rings at stage ends (must be flown through), 38 cyan guide rings, challenge gates, landing beacon.
* **Scoring:** distance, rings, near misses (<15 m), avoided obstacles; penalties for hits and crashes. Rating S/A/B/C from time, crashes, hits and near misses.
* **Weather:** rain, storm (lightning, thunder with distance delay), snow, fog, wind, cloud cover; blended smoothly per stage; lens droplets, whiteout inside clouds.
* **Audio:** wind (pitch/volume with speed), rain, snow wind, waterfall (distance + stereo pan), river, leaves, bird songs, eagle calls, thunder, rockfall, cave reverb, generative ambient music with speed-reactive brightness.
* **Performance:** two-ring terrain LOD, instanced forests, particle caps, quality presets, adaptive scaling, shadows only on High/Ultra.

## Modes
Adventure, Endless Fall (periodic world that teleports seamlessly every 14 km, winds +12% per loop), Time Trial, Exploration, Challenge (Needle Threader, Speed Demon, Storm Runner, Close Shave, Feather Landing).

## Validation performed
The flight model and terrain were tested headlessly: a scripted pilot completes the whole descent in ~4.5–5.7 minutes with ≥250 m of clearance
in the mid-game and a safe landing (~20–23 m/s), and Endless-mode wrapping is verified to shift exactly 7,000 m.
