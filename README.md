# SKYFALL: THE LAST DESCENT

A complete 3D free-fall adventure for the desktop browser. You start on a summit at 7,000 m, jump into the sky and
descend through ten stages — snow peaks, clouds, waterfalls, valleys, canyons, a lightning storm, a frozen kingdom,
a dark descent, a last mountain and a golden paradise — across a full dynamic day/night cycle, until you land.

Everything is procedural: terrain, water, sky, clouds, wildlife, avatar, **and audio** (Web Audio). No external assets are required.

## Run it

Requirements: Node.js 18+ and a modern desktop browser with WebGL2 (Chrome, Edge, Firefox, Safari).

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

Optional type check: `npm run typecheck`.

## Controls

| Key | Action |
|---|---|
| **SPACE** | Jump from the ledge · then toggle glide |
| **W** | Dive (fastest fall) |
| **S** | Air brake (slow, stable; use it to land) |
| **A / D** | Steer left / right |
| **SHIFT** | Boost (drains the boost bar) |
| **C** | Camera: chase / first-person / wide |
| **Mouse** | Click the game to capture the mouse; move to steer |
| **ESC / P** | Pause |
| Gamepad | Left stick steer/dive/brake · A jump/glide · RB/RT boost · Y camera · Start pause |

## How to play

* Glide (SPACE) to stay near the glowing guide rings; free fall and dive to lose height quickly. Total descent: 7,000 m over 14 km.
* Fly through the **amber checkpoint rings** at the end of each stage. Crash and you restart from the last one you banked.
* Spires, boulders, cave walls, trees, canyon walls and the ground are lethal. Birds, falling rocks and lightning only hurt (speed loss, score loss).
* Updraft columns lift you, wind tunnels shove you sideways, storm and snow cells buffet you.
* In stage 10 you can land anywhere; touch down below **28 m/s** vertical speed (air brake!). The golden beacon marks the meadow beside the river.

### Modes
Adventure · Endless Fall (looping canyon, winds strengthen each lap, best depth saved) · Time Trial · Exploration (no crashes; weather and time of day controls in the pause menu) · Challenge (5 hand-made objective routes).

## Architecture

```
src/
  components/{ui,hud,menus,loading}   React + Tailwind UI (menus, HUD, settings, results)
  game/
    core/         Game (orchestrator), GameLoop, GameState
    player/       PlayerPhysics (aerodynamic model), PlayerController, PlayerAnimation, PlayerCamera, Player
    world/        MountainGenerator (analytic world), Terrain (2-ring mesh), River, Waterfall, Forest, Clouds, Wildlife, World
    environment/  DayNightCycle, SkyDome, LightingSystem, FogSystem, WeatherSystem, WindSystem, Precipitation, ScreenEffects
    levels/       LevelManager + Level01..Level10 + ChallengeDefs
    gameplay/     ObstacleManager, CollisionSystem, CheckpointSystem, ProgressManager, ScoringSystem
    audio/        AudioManager (buses, music, SFX), EnvironmentAudio (adaptive layers)
    systems/      AssetManager, PerformanceManager, InputManager, SaveManager
  stores/         Zustand UI store      hooks/  utils/  types/
```

Key design points (details in `GAME_DESIGN.md`):

* **One analytic world.** `MountainGenerator.heightAt(x,z)` defines the whole world. Terrain mesh, collision, rivers, waterfalls, obstacles, checkpoints and trees all derive from it, so they always agree.
* **Physics.** Quadratic drag (`a = cd·|v|·v`) gives terminal velocities; lift (`cl·|v|²`) perpendicular to the airflow converts height into forward speed while gliding. Coefficients blend smoothly between Free Fall (~210 km/h), Dive (~375 km/h), Glide (≈3:1 glide ratio) and Air Brake (~85 km/h).
* **Rendering.** Plain Three.js. Two nested terrain meshes follow the player; instanced forests; custom shaders for sky, water, waterfalls and flapping birds; camera-relative particle fields for rain/snow/leaves/speed lines.
* **Graphics presets** Low/Medium/High/Ultra, plus optional adaptive scaling that lowers quality if FPS stays under ~38.
* **Saving.** Checkpoints (Adventure), best results, completed challenges and settings are stored in `localStorage`.

## Notes / deliberate deviations from the brief

* The brief *recommended* React Three Fiber and Rapier. This project uses vanilla Three.js with a hand-written aerodynamic model instead:
  a falling body with lift/drag needs no rigid-body engine, and collision is analytic (cylinders, spheres, tunnels, heightfield), which is cheaper and more predictable. React is used for all menus/HUD; Zustand holds UI state.
* The avatar is a procedural low-poly wingsuit jumper (no model files). Texture compression is not applicable because there are no image textures.
* Tuning constants live at the top of `PlayerPhysics.ts` (AERO table), `MountainGenerator.ts` and the `Level*.ts` files.

## Customising

* Add or retune a stage: edit `src/game/levels/LevelNN.ts` (weather, biome, obstacle counts, wildlife, hours of day).
* Add a challenge: append to `src/game/levels/ChallengeDefs.ts`.
* Drop your own audio/models into `public/` and load them from `AssetManager` if you want to replace the procedural content.
