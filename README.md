# DEAD SIGNAL
A browser horror FPS where the map is lying to you. Three.js is bundled in `vendor/`, so there is no CDN and no build step. Open `index.html` directly, or host the folder on GitHub Pages.

## Controls
- **PC:** WASD to move, mouse to look (click to lock the pointer), left click to shoot, R to reload, F for the flashlight, E to use, Shift to run, Esc to pause.
- **Phone (landscape):** left thumb joystick to move, drag the right side to look, and buttons for FIRE, LIGHT, USE, RELOAD and RUN. Tap II to pause.

## Tests
`NODE_PATH=<playwright-core>/node_modules node tests/run.cjs` runs headless Chrome with SwiftShader. Screenshots are saved to `shots/`.
