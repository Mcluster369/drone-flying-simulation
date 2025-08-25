// Drone Flying Simulation
// Assignment 7.1 – Final Project
// Author: Hosheyah Yisrael
// Notes:
// - 30%+ JavaScript, reusable functions, object manipulation, dynamic UI
// - Vanilla JS only (works in modern Chrome/Firefox/Edge/Safari)
// - Thorough comments and readable code style

(() => {
  'use strict';

  // -----------------------------
  // Domain Models (Objects/Classes)
  // -----------------------------

  /**
   * Drone platform properties (simplified).
   * Values are tuned for a fun/educational sim, not for real flight.
   */
  class Drone {
    constructor({ massKg = 2.4, batteryWh = 160, basePowerW = 120 }) {
      this.massKg = massKg;
      this.batteryWh = batteryWh; // nominal usable energy
      this.basePowerW = basePowerW; // hover-ish baseline
    }

    /**
     * Estimate instantaneous power draw given environmental & mission conditions.
     * @param {number} speedMps - airspeed in m/s
     * @param {number} altitudeM - altitude in meters
     * @param {number} payloadKg - payload weight
     * @param {number} windMps - wind speed m/s
     * @param {'headwind'|'tailwind'|'crosswind'} windDir
     * @param {number} tempC - temperature °C
     * @returns {number} power W
     */
    estimatePower({ speedMps, altitudeM, payloadKg, windMps, windDir, tempC }) {
      // Aerodynamic-ish component: roughly proportional to speed^3 (very simplified)
      const aero = 0.6 * Math.pow(Math.max(speedMps, 0), 3);

      // Payload penalty (heavier requires more thrust)
      const payloadPenalty = 10 * Math.max(payloadKg, 0);

      // Wind effect
      let windPenalty = 0;
      if (windDir === 'headwind') windPenalty = 6 * windMps;
      else if (windDir === 'crosswind') windPenalty = 2 * windMps;
      else if (windDir === 'tailwind') windPenalty = -3 * windMps;

      // Altitude air density effect (thin air -> more power) – mild factor
      const altitudePenalty = altitudeM > 0 ? 0.02 * altitudeM : 0;

      // Temperature effect (cold batteries sag more) – mild factor
      const tempPenalty = tempC < 10 ? (10 - tempC) * 1.5 : 0;

      // Combine with base power
      let power = this.basePowerW + aero + payloadPenalty + windPenalty + altitudePenalty + tempPenalty;

      // Floor
      power = Math.max(power, 50);

      return power;
    }
  }

  /**
   * Environment wrapper for weather and temp.
   */
  class Environment {
    constructor({ windMps = 0, windDir = 'headwind', tempC = 20 }) {
      this.windMps = windMps;
      this.windDir = windDir;
      this.tempC = tempC;
    }
  }

  /**
   * Mission params and simple progression state.
   */
  class Mission {
    constructor({ location, routeKm, altitudeM, speedMps, payloadKg, initialBatteryPct, batteryHealth }) {
      this.location = location;
      this.routeKm = routeKm;
      this.altitudeM = altitudeM;
      this.speedMps = speedMps;
      this.payloadKg = payloadKg;
      this.initialBatteryPct = initialBatteryPct;
      this.batteryHealth = batteryHealth;

      // Progress state
      this.distanceKm = 0;
      this.elapsedSec = 0;
      this.finished = false;
      this.aborted = false;
    }
  }

  // -----------------------------
  // Helpers (Reusable Functions)
  // -----------------------------

  /** Convert km to meters. */
  const kmToM = (km) => km * 1000;
  /** Clamp a value to a range. */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  /** Format number with fixed decimals. */
  const fmt = (n, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '–';

  /**
   * Estimate battery usage per second (Wh/s) => convert to % per second.
   * @param {number} powerW
   * @param {number} batteryWhNominal
   * @param {number} batteryHealth (0.5–1.0)
   */
  function batteryPercentPerSecond(powerW, batteryWhNominal, batteryHealth) {
    const usableWh = batteryWhNominal * clamp(batteryHealth, 0.5, 1.0);
    // powerW (J/s) ~ Wh/s * 3600 => Wh/s = powerW / 3600
    const whPerSec = powerW / 3600;
    const pctPerSec = (whPerSec / usableWh) * 100;
    return pctPerSec;
  }

  /**
   * Given inputs, predict if mission is feasible and provide summary stats.
   * Pure calculation (no animation).
   */
  function simulateOnce({ drone, env, mission }) {
    const totalMeters = kmToM(mission.routeKm);
    const dt = 1; // seconds step
    let batteryPct = clamp(mission.initialBatteryPct, 10, 100);
    let dist = 0;
    let t = 0;

    while (dist < totalMeters && batteryPct > 0) {
      const power = drone.estimatePower({
        speedMps: mission.speedMps,
        altitudeM: mission.altitudeM,
        payloadKg: mission.payloadKg,
        windMps: env.windMps,
        windDir: env.windDir,
        tempC: env.tempC
      });
      const pctDrop = batteryPercentPerSecond(power, drone.batteryWh, mission.batteryHealth);
      batteryPct -= pctDrop;
      batteryPct = Math.max(batteryPct, 0);

      dist += mission.speedMps * dt;
      t += dt;

      // Safety stop: simulation cap
      if (t > 3 * 3600) break; // 3h
    }

    return {
      totalTimeSec: t,
      completed: dist >= totalMeters && batteryPct > 0,
      batteryLeftPct: Math.max(batteryPct, 0),
      distanceKmCovered: dist / 1000
    };
  }

  // -----------------------------
  // UI/Controller
  // -----------------------------

  const els = {
    form: document.getElementById('mission-form'),
    simulateBtn: document.getElementById('simulateBtn'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),

    batteryBar: document.getElementById('batteryBar'),
    batteryText: document.getElementById('batteryText'),
    distanceBar: document.getElementById('distanceBar'),
    distanceText: document.getElementById('distanceText'),
    speedText: document.getElementById('speedText'),
    altitudeText: document.getElementById('altitudeText'),
    outcome: document.getElementById('outcome'),

    canvas: document.getElementById('vizCanvas'),
  };

  const ctx = els.canvas.getContext('2d');

  // Simulation state
  const state = {
    drone: new Drone({ massKg: 2.4, batteryWh: 160, basePowerW: 120 }),
    env: new Environment({ windMps: 3, windDir: 'headwind', tempC: 25 }),
    mission: null,
    timer: null,
    running: false,
    totalMeters: 0,
    dist: 0,
    batteryPct: 100
  };

  function readInputs() {
    const location = document.getElementById('location').value.trim();
    const routeKm = parseFloat(document.getElementById('routeKm').value);
    const altitude = parseFloat(document.getElementById('altitude').value);
    const speed = parseFloat(document.getElementById('speed').value);
    const batteryPct = parseFloat(document.getElementById('batteryPct').value);
    const batteryHealth = parseFloat(document.getElementById('batteryHealth').value);
    const payloadKg = parseFloat(document.getElementById('payloadKg').value);
    const windSpeed = parseFloat(document.getElementById('windSpeed').value);
    const windDir = document.getElementById('windDir').value;
    const tempC = parseFloat(document.getElementById('tempC').value);

    state.env = new Environment({ windMps: windSpeed, windDir, tempC });
    state.mission = new Mission({
      location, routeKm, altitudeM: altitude, speedMps: speed,
      payloadKg, initialBatteryPct: batteryPct, batteryHealth
    });
    state.totalMeters = kmToM(routeKm);
    state.batteryPct = batteryPct;
    state.dist = 0;

    // Update telemetry static fields
    els.speedText.textContent = `${fmt(speed, 1)} m/s`;
    els.altitudeText.textContent = `${fmt(altitude, 0)} m`;
    els.distanceText.textContent = `0 / ${fmt(routeKm,1)} km`;
    els.batteryText.textContent = `${fmt(batteryPct,0)}%`;
    els.batteryBar.style.width = `${clamp(batteryPct,0,100)}%`;

    drawViz(0, state.totalMeters, state.env);
  }

  // Draw a simple route line with wind arrows
  function drawViz(progressMeters, totalMeters, env) {
    const w = els.canvas.width;
    const h = els.canvas.height;
    const ctx = els.canvas.getContext('2d');
    ctx.clearRect(0,0,w,h);

    // Route line
    const pad = 40;
    const x0 = pad;
    const x1 = w - pad;
    const y = h/2;
    ctx.strokeStyle = '#5ea1ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    // Progress dot
    const p = clamp(progressMeters / Math.max(totalMeters, 1), 0, 1);
    const x = x0 + p * (x1 - x0);
    ctx.fillStyle = '#68d391';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI*2);
    ctx.fill();

    // Wind arrows
    ctx.fillStyle = '#9fb0d0';
    const arrowCount = 8;
    for (let i = 0; i < arrowCount; i++) {
      const ax = x0 + (i+0.5) * (x1 - x0) / arrowCount;
      const ay = y - 40;
      drawArrow(ctx, ax, ay, env.windDir);
    }
  }

  function drawArrow(ctx, x, y, dir) {
    ctx.save();
    // Directionality: headwind arrows point against travel (left), tailwind to right
    let angle = 0;
    if (dir === 'headwind') angle = Math.PI; // left
    else if (dir === 'tailwind') angle = 0;  // right
    else if (dir === 'crosswind') angle = Math.PI / 2; // down

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#9fb0d0';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(6, -6);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fillStyle = '#9fb0d0';
    ctx.fill();
    ctx.restore();
  }

  // Outcome message builder
  function outcomeMessage(summary, mission, env) {
    const mins = summary.totalTimeSec / 60;
    const status = summary.completed ? '✅ Mission Completed' : '⚠️ Mission Aborted (Low Battery)';
    const tips = [];

    if (!summary.completed) {
      tips.push('Reduce speed or payload to conserve energy.');
      if (env.windDir === 'headwind' && env.windMps > 2) tips.push('Headwinds are costly—try tailwind or lower wind conditions.');
      if (mission.initialBatteryPct < 80) tips.push('Start with a higher battery percentage for safety.');
      if (mission.batteryHealth < 0.9) tips.push('Old batteries reduce usable energy—consider better packs.');
    } else {
      tips.push('Mission parameters look safe. Consider extending route length or testing different winds.');
    }

    return `
      <div class="outcome-line"><strong>${status}</strong></div>
      <div class="outcome-line">Time: ${fmt(mins,0)} min • Battery Left: ${fmt(summary.batteryLeftPct,0)}% • Distance: ${fmt(summary.distanceKmCovered,1)} km</div>
      <div class="outcome-line">Wind: ${env.windDir} at ${fmt(env.windMps,1)} m/s • Altitude: ${fmt(mission.altitudeM,0)} m • Speed: ${fmt(mission.speedMps,1)} m/s</div>
      <div class="outcome-line"><em>Tips:</em> ${tips.join(' ')}</div>
    `;
  }

  // Wire up buttons
  els.simulateBtn.addEventListener('click', () => {
    readInputs();
    const summary = simulateOnce({ drone: state.drone, env: state.env, mission: state.mission });
    els.outcome.innerHTML = outcomeMessage(summary, state.mission, state.env);
  });

  els.startBtn.addEventListener('click', () => {
    readInputs();
    if (state.running) return;
    runLive();
  });

  els.pauseBtn.addEventListener('click', () => {
    if (state.running) {
      clearInterval(state.timer);
      state.timer = null;
      state.running = false;
    }
  });

  els.resetBtn.addEventListener('click', () => {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    state.running = false;
    els.outcome.innerHTML = '<p>Configure a mission and click <strong>Simulate</strong> to preview energy use. Click <strong>Start</strong> to run a live simulation.</p>';
    readInputs();
  });

  // Live simulation loop (dynamic JS)
  function runLive() {
    state.running = true;
    const dt = 1; // seconds
    const total = state.totalMeters;

    state.timer = setInterval(() => {
      if (!state.running) return;

      const power = state.drone.estimatePower({
        speedMps: state.mission.speedMps,
        altitudeM: state.mission.altitudeM,
        payloadKg: state.mission.payloadKg,
        windMps: state.env.windMps,
        windDir: state.env.windDir,
        tempC: state.env.tempC
      });

      const pctDrop = batteryPercentPerSecond(power, state.drone.batteryWh, state.mission.batteryHealth);
      state.batteryPct -= pctDrop;
      state.batteryPct = Math.max(0, state.batteryPct);

      state.dist += state.mission.speedMps * dt;

      // Update UI
      const pct = clamp(state.batteryPct, 0, 100);
      els.batteryBar.style.width = `${pct}%`;
      els.batteryText.textContent = `${fmt(pct,0)}%`;

      const progressPct = clamp((state.dist / Math.max(total,1))*100, 0, 100);
      els.distanceBar.style.width = `${progressPct}%`;
      els.distanceText.textContent = `${fmt(state.dist/1000,1)} / ${fmt(total/1000,1)} km`;

      drawViz(state.dist, total, state.env);

      // End conditions
      if (state.dist >= total || state.batteryPct <= 0) {
        clearInterval(state.timer);
        state.timer = null;
        state.running = false;

        const summary = {
          totalTimeSec: state.dist / Math.max(state.mission.speedMps, 0.1),
          completed: state.dist >= total && state.batteryPct > 0,
          batteryLeftPct: state.batteryPct,
          distanceKmCovered: state.dist / 1000
        };
        els.outcome.innerHTML = outcomeMessage(summary, state.mission, state.env);
      }
    }, 1000);
  }

  // Initialize defaults
  readInputs();
})();