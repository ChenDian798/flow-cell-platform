# Flow Cell Platform

An interactive 3D model of the single flow cell platform for electrodeposition, electroanalysis and in-situ Raman. It shows the tubing layout, how the cell is mounted, and the cycle that runs at each of the 16 spots on the working-electrode plate.

This is a conceptual model for discussion. Sizes, flow rates and timings are placeholders, and no flow, mixing or electrochemistry is simulated.

## Option 1: open it in a browser (no installation)

Open **https://flow-cell-platform.vercel.app** in Chrome, Edge, Firefox or Safari.

The page needs WebGL, which any recent desktop browser has. If the 3D panels stay blank, see [Troubleshooting](#troubleshooting).

## Option 2: run it on your own computer

Use this if you want to change the model or work offline.

### 1. Install the tools (once)

- **Node.js 20.9 or newer.** Download the LTS installer from https://nodejs.org and run it with the default options.
- **Git.** Download it from https://git-scm.com/downloads. You can skip Git and download the code as a ZIP instead (see step 2).

To check that Node.js is installed, open a terminal (Command Prompt or PowerShell on Windows, Terminal on macOS) and run:

```bash
node --version
```

It should print `v20.9.0` or higher.

### 2. Get the code

With Git:

```bash
git clone https://github.com/ChenDian798/flow-cell-platform.git
cd flow-cell-platform
```

Without Git: on https://github.com/ChenDian798/flow-cell-platform click **Code → Download ZIP**, unzip it, and open a terminal in the unzipped folder.

### 3. Install and start

```bash
npm ci
npm run dev
```

The first command downloads the dependencies and takes a minute or two; warnings about install scripts can be ignored. The second starts the model. When the terminal shows `Ready`, open **http://localhost:3000** in your browser.

To stop it, press `Ctrl + C` in the terminal. Next time, only `npm run dev` is needed.

## What the page shows

| Panel | Content |
| --- | --- |
| **01 Platform model** | 3D view of the whole platform: reservoirs, pump, manifold, static mixer, the fixed flow cell under the Raman objective, the outlet valve, the potentiostat, and the plate on the motorized stage. The side panel runs the sequence and holds the parameters and design notes. |
| **02 Fluidic connection diagram** | 2D diagram of the same tubing. Lines and valves change colour as each liquid flows. |
| **03 Mounting concept** | 3D view of the frame built from off-the-shelf parts (aluminium extrusion, manual Z stage for focusing, motorized XYZ stage, guided spring tray), with a parts list and search keywords. |
| **04 Cycle at spot** | Timeline of the steps at the current spot, and a log. |

All panels follow one clock, so starting the sequence in panel 01 also moves the plate in panel 03.

### Running the sequence

In the **Operate** tab of panel 01:

- **Run current spot** runs one full cycle: seal → electrodeposition (flow) → rinse → fill UPD → CV / EIS (static) → rinse → drain with air → lower the plate → move to the next spot.
- **Run all remaining spots** runs every spot in turn.
- **60× / 300× / 1200×** sets the playback speed. One spot takes about 28 minutes of real time with the default parameters.
- **Pause** and **Reset** stop or clear the run.

The **Parameters** tab changes the flow rates, stock fractions and step times. Click **Apply parameters** to use them; this resets the run.

### Moving the 3D views

- Left-drag to rotate
- Scroll to zoom
- Right-drag to pan
- The buttons above each view switch between preset angles. **Labels** shows or hides the part names.

## Troubleshooting

- **The 3D panels are blank.** WebGL may be turned off. In Chrome or Edge, open `chrome://settings/system` and turn on **Use graphics acceleration when available**, then restart the browser.
- **`npm` or `node` is not recognized.** Close and reopen the terminal after installing Node.js. If it still fails, restart the computer.
- **Port 3000 is already in use.** Run `npm run dev -- --port 3100` and open http://localhost:3100.
- **`npm ci` fails behind a proxy or firewall.** Try another network, or ask IT to allow access to https://registry.npmjs.org.

## For developers

```bash
npm test           # model logic tests
npm run typecheck  # TypeScript check
npm run build      # production build
```

Next.js 16.4.0 reports a known security advisory. The first `npm run build` may stop at that notice; running it again continues. Upgrading Next.js removes the notice.

The model logic (fluids, cycle steps, clock, plate and spring positions) is in `lib/system.ts`. The 3D scenes are in `components/Scene.tsx` and `components/MountScene.tsx`, and the 2D diagram is in `components/Schematic.tsx`.

Pushing to the `main` branch deploys to https://flow-cell-platform.vercel.app automatically.
