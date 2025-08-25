Drone Flying Simulation
=======================

An interactive, browser-based simulator that models a simple drone mission using HTML, CSS, and JavaScript. Users can configure mission parameters (location, route length, altitude, speed, payload, battery, weather) and then simulate power usage and mission outcome in real time. Built to satisfy Assignment 7.1 requirements.

Features (Rubric Mapping)
-------------------------
- **30%+ JavaScript (Reusable Functions & Objects):** Core logic in `script.js` uses classes (`Drone`, `Environment`, `Mission`) and helper functions for battery drain, progress, and drawing. No duplicated code—shared helpers are reused.
- **Dynamic UI:** Live telemetry updates each second (battery, distance, progress bar), animated route visualization using `<canvas>`.
- **Object Manipulation:** Mission/environment/drone are objects passed into pure functions and simulation loops.
- **Good UX:** Clean layout, responsive grid, clear labels, accessible color contrast, and helpful outcome tips.
- **Works in Multiple Browsers:** Vanilla JS + Canvas → tested patterns for Chrome and Firefox (should also work in Edge/Safari).
- **Standalone Website:** Simply open `index.html`—no build tools required.
- **Coding Standards:** Indentation, comments, and separation of concerns (`index.html`, `style.css`, `script.js`).

Project Structure
-----------------
- `index.html` – UI layout, form, telemetry, visualization canvas.
- `style.css` – Responsive, accessible styling.
- `script.js` – Simulation logic, objects, rendering, and event handlers.
- `readme.txt` – This file.

How to Run Locally
------------------
1. Download the folder or clone the repo.
2. Open `index.html` in your browser (Chrome or Firefox recommended).
3. Enter mission parameters, click **Simulate** for a quick prediction or **Start** for the live simulation.
4. Use **Pause** and **Reset** as needed.

How to Deploy on GitHub
-----------------------
1. Create a **public** GitHub repository (e.g., `drone-flying-simulation`).
2. Add/commit all files (`index.html`, `style.css`, `script.js`, `readme.txt`), then push to GitHub.
3. Enable **GitHub Pages** (Settings → Pages → Source: `main` branch `/root`). Copy the site URL.
   - Alternatively, use a “GitHub HTML previewer” (e.g., RawGithack) if Pages isn’t available.
4. Take a **screenshot** of the repo showing your commit(s) and include it in your assignment submission (per rubric).

Usability Testing Checklist
---------------------------
- Ask 2–3 friends/family to try:
  - Change wind to **headwind** vs **tailwind** — see battery impact.
  - Increase **payload** and **speed** — watch power usage and completion status.
  - Lower **battery health** and **initial battery** — verify the mission may abort early.
- Confirm it looks good in **two different browsers**.
- Note any confusion points and adjust labels or defaults.

How the Simulation Works (High-Level)
-------------------------------------
- Approximate power model combines:
  - Baseline hover power + speed^3 aerodynamic term
  - Payload penalty
  - Wind effect (headwind highest, tailwind can help)
  - Altitude + temperature modifiers
- Battery drain is derived from power (W) converted to Wh/s and mapped to % based on usable battery energy and health.
- Live loop: updates once per second, advancing distance, reducing battery, and updating UI + canvas.

Credits
-------
- Designed and built by **Hosheyah Yisrael** for Assignment 7.1 – Final Project & Presentation (2025).
