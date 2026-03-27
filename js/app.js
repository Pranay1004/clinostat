/*
 * ClinoSim Pro — Microgravity Digital Twin
 * app.js — Main Application (Non-module, CDN-compatible)
 * License: Proprietary + Apache 2.0 Open Source (Dual)
 *
 * This file self-initializes and manages:
 * - Physics simulation loop (configurable Hz)
 * - Three.js 3D visualization
 * - Chart.js live plotting
 * - UI event binding
 * - CSV data logging
 */
'use strict';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
const G0 = 9.80665;
const TWO_PI = 2 * Math.PI;
const PHI = (1 + Math.sqrt(5)) / 2; // Golden ratio
const DEG = 180 / Math.PI;

const QUALITY = { EXCELLENT: 0.001, GOOD: 0.01, FAIR: 0.05 };
const COLORS = {
    CYAN: '#00D4FF', BLUE: '#0066FF', GREEN: '#00FF88',
    AMBER: '#FFB300', RED: '#FF3B3B', WHITE: '#FFFFFF'
};
const MATERIAL_DENSITY = {
    'Aluminum 6061': 2700,
    'Steel 304':     7900,
    'Acrylic (PMMA)':1180,
    'PLA':           1250,
    'Carbon Fiber':  1550,
};
const PAYLOAD_DENSITY = 1400; // typical experiment container (kg/m³)

// ═══════════════════════════════════════════════════════════════════════
// QUATERNION (inline for non-module)
// ═══════════════════════════════════════════════════════════════════════
class Quat {
    constructor(w=1, x=0, y=0, z=0) { this.w=w; this.x=x; this.y=y; this.z=z; }

    static fromAxisAngle(ax, ay, az, angle) {
        const h = angle / 2, s = Math.sin(h);
        return new Quat(Math.cos(h), ax*s, ay*s, az*s);
    }

    mul(q) {
        return new Quat(
            this.w*q.w - this.x*q.x - this.y*q.y - this.z*q.z,
            this.w*q.x + this.x*q.w + this.y*q.z - this.z*q.y,
            this.w*q.y - this.x*q.z + this.y*q.w + this.z*q.x,
            this.w*q.z + this.x*q.y - this.y*q.x + this.z*q.w
        );
    }

    conj() { return new Quat(this.w, -this.x, -this.y, -this.z); }

    norm() {
        const m = Math.sqrt(this.w*this.w + this.x*this.x + this.y*this.y + this.z*this.z);
        if (m < 1e-10) return new Quat();
        return new Quat(this.w/m, this.x/m, this.y/m, this.z/m);
    }

    rotVec(v) {
        const qx=this.x, qy=this.y, qz=this.z, qw=this.w;
        const tx = 2*(qy*v[2]-qz*v[1]), ty = 2*(qz*v[0]-qx*v[2]), tz = 2*(qx*v[1]-qy*v[0]);
        return [v[0]+qw*tx+(qy*tz-qz*ty), v[1]+qw*ty+(qz*tx-qx*tz), v[2]+qw*tz+(qx*ty-qy*tx)];
    }

    integrate(wx, wy, wz, dt) {
        const h = dt/2;
        const oq = new Quat(0, wx, wy, wz);
        const d = oq.mul(this);
        return new Quat(this.w+h*d.w, this.x+h*d.x, this.y+h*d.y, this.z+h*d.z).norm();
    }

    toEuler() {
        const sr = 2*(this.w*this.x+this.y*this.z), cr = 1-2*(this.x*this.x+this.y*this.y);
        const sp = 2*(this.w*this.y-this.z*this.x);
        const sy = 2*(this.w*this.z+this.x*this.y), cy = 1-2*(this.y*this.y+this.z*this.z);
        return {
            roll: Math.atan2(sr, cr),
            pitch: Math.abs(sp)>=1 ? Math.sign(sp)*Math.PI/2 : Math.asin(sp),
            yaw: Math.atan2(sy, cy)
        };
    }

    toThreeQuat() {
        return new THREE.Quaternion(this.x, this.y, this.z, this.w);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// BIOLOGICAL PRESETS
// ═══════════════════════════════════════════════════════════════════════
const BIO_PRESETS = {
    'Human Osteocyte':    { r: 7.5e-6, rho_p: 1080, rho_f: 1007, mu: 0.001 },
    'E. coli':            { r: 0.5e-6, rho_p: 1100, rho_f: 1000, mu: 0.001 },
    'HeLa Cell':          { r: 10e-6,  rho_p: 1070, rho_f: 1007, mu: 0.001 },
    'Red Blood Cell':     { r: 3.5e-6, rho_p: 1100, rho_f: 1025, mu: 0.0012 },
    'Yeast':              { r: 3e-6,   rho_p: 1110, rho_f: 1010, mu: 0.001 },
    'Arabidopsis Seed':   { r: 150e-6, rho_p: 1200, rho_f: 1000, mu: 0.001 },
    'Protein Crystal':    { r: 50e-6,  rho_p: 1240, rho_f: 1050, mu: 0.0015 },
};

// ═══════════════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════════
const STATE = {
    mode: '2D',           // '1D' | '2D' | '3D'
    rotMode: 'CONSTANT',  // 'CONSTANT' | 'RANDOM_WALK' | 'OPTIMIZED'
    running: false,
    time: 0,

    // Motor state
    rpmSet: [5.0, 8.09, 3.0],
    rpmActual: [0, 0, 0],
    dirs: [1, -1, 1],
    omega: [0, 0, 0],
    rampRate: 2.0,        // RPM/s

    // Physics
    orientation: new Quat(),
    gVec: [0, 0, -G0],
    gRes: G0,
    gResPercent: 100,

    // Residual integrator
    sumGx: 0, sumGy: 0, sumGz: 0,
    totalTime: 0,
    sampleCount: 0,

    // Geometry (mm)
    frame1Radius: 100, frame1Tube: 8,
    frame2Radius: 175, frame2Tube: 10,
    payloadShape: 'cylinder', payloadDiameter: 60, payloadHeight: 50,

    // Data logging
    logging: false,
    logData: [],
    logRate: 10,         // Hz
    lastLogTime: 0,

    // Random walk
    rwTimer: 0,
    rwInterval: 15,

    // Auto golden ratio
    autoGolden: true,

    // Physics dt
    physDt: 0.002,       // 2ms = 500Hz (good balance of accuracy/perf)
    physAccum: 0,

    // Connection
    connMode: 'SIMULATION',  // 'SIMULATION' | 'HARDWARE' | 'HYBRID'

    // Point probe
    probeActive: false,
    probeX: 0, probeY: 0, probeZ: 0,
};

// ═══════════════════════════════════════════════════════════════════════
// THREE.JS SCENE
// ═══════════════════════════════════════════════════════════════════════
let scene, camera, renderer, controls;
let outerFrame, innerFrame, payloadMesh, gravityArrow, axisLines;
let gridHelper, axesHelper;

function initThree() {
    const container = document.getElementById('viewport-container');
    const w = container.clientWidth, h = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060A10);
    scene.fog = new THREE.FogExp2(0x060A10, 0.003);

    camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 100);
    camera.position.set(0.4, 0.3, 0.5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.1;
    controls.maxDistance = 5;
    controls.target.set(0, 0, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0x334455, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    dirLight.position.set(2, 3, 2);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x00D4FF, 0.3, 3);
    pointLight.position.set(0, 0.5, 0);
    scene.add(pointLight);

    // Grid
    gridHelper = new THREE.GridHelper(2, 20, 0x112233, 0x0A1522);
    gridHelper.position.y = -0.25;
    scene.add(gridHelper);

    // Axes
    axesHelper = new THREE.AxesHelper(0.3);
    scene.add(axesHelper);

    buildClinostat();
    buildGravityArrow();

    // Resize
    window.addEventListener('resize', () => {
        const w2 = container.clientWidth, h2 = container.clientHeight;
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
    });
}

function buildClinostat() {
    // Clear old
    if (outerFrame) { scene.remove(outerFrame); outerFrame.traverse(c => { if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); }
    if (innerFrame) { scene.remove(innerFrame); innerFrame.traverse(c => { if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); }
    if (payloadMesh) { scene.remove(payloadMesh); payloadMesh.geometry.dispose(); payloadMesh.material.dispose(); }

    const r1 = STATE.frame1Radius / 1000; // mm → m
    const t1 = STATE.frame1Tube / 1000;
    const r2 = STATE.frame2Radius / 1000;
    const t2 = STATE.frame2Tube / 1000;
    const pr = STATE.payloadDiameter / 2000;
    const ph = STATE.payloadHeight / 1000;

    // Inner frame — torus rotating about X-axis
    const innerGeo = new THREE.TorusGeometry(r1, t1, 16, 64);
    const innerMat = new THREE.MeshPhongMaterial({
        color: 0xFFFFFF, emissive: 0x222222, specular: 0x00D4FF,
        shininess: 80, transparent: true, opacity: 0.9
    });
    innerFrame = new THREE.Mesh(innerGeo, innerMat);
    innerFrame.rotation.x = Math.PI / 2; // Orient torus so it rotates about X conceptually
    scene.add(innerFrame);

    // Inner axis line
    const innerAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-r1-0.03, 0, 0), new THREE.Vector3(r1+0.03, 0, 0)
    ]);
    const innerAxisLine = new THREE.Line(innerAxisGeo, new THREE.LineBasicMaterial({ color: 0x00D4FF, opacity: 0.4, transparent: true }));
    innerFrame.add(innerAxisLine);

    // Outer frame — torus rotating about Y-axis
    if (STATE.mode !== '1D') {
        const outerGeo = new THREE.TorusGeometry(r2, t2, 16, 64);
        const outerMat = new THREE.MeshPhongMaterial({
            color: 0x0066FF, emissive: 0x001133, specular: 0x00D4FF,
            shininess: 60, transparent: true, opacity: 0.7
        });
        outerFrame = new THREE.Mesh(outerGeo, outerMat);
        scene.add(outerFrame);

        // Outer axis line
        const outerAxisGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -r2-0.03, 0), new THREE.Vector3(0, r2+0.03, 0)
        ]);
        const outerAxisLine = new THREE.Line(outerAxisGeo, new THREE.LineBasicMaterial({ color: 0x00FF88, opacity: 0.4, transparent: true }));
        outerFrame.add(outerAxisLine);
    }

    // Payload chamber
    let payGeo;
    if (STATE.payloadShape === 'sphere') {
        payGeo = new THREE.SphereGeometry(pr, 32, 16);
    } else if (STATE.payloadShape === 'box') {
        payGeo = new THREE.BoxGeometry(pr*2, ph, pr*2);
    } else {
        payGeo = new THREE.CylinderGeometry(pr, pr, ph, 32);
    }
    const payMat = new THREE.MeshPhongMaterial({
        color: 0xFFB300, emissive: 0x332200,
        transparent: true, opacity: 0.35,
        side: THREE.DoubleSide
    });
    payloadMesh = new THREE.Mesh(payGeo, payMat);
    scene.add(payloadMesh);

    // Center marker
    const centerGeo = new THREE.SphereGeometry(0.003, 8, 8);
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xFF3333 });
    const centerDot = new THREE.Mesh(centerGeo, centerMat);
    payloadMesh.add(centerDot);

    updateMassInertia();
}

function buildGravityArrow() {
    if (gravityArrow) scene.remove(gravityArrow);
    const dir = new THREE.Vector3(0, 0, -1);
    gravityArrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), 0.15, 0xFF3333, 0.02, 0.015);
    scene.add(gravityArrow);
}

function updateGravityArrow() {
    const g = STATE.gVec;
    const mag = Math.sqrt(g[0]*g[0] + g[1]*g[1] + g[2]*g[2]);
    if (mag < 1e-10) return;

    const dir = new THREE.Vector3(g[0]/mag, g[2]/mag, -g[1]/mag); // Swap Y/Z for Three.js (Y-up)
    gravityArrow.setDirection(dir);
    gravityArrow.setLength(0.15, 0.02, 0.015);

    // Color by quality
    const frac = STATE.gRes / G0;
    let color;
    if (frac < QUALITY.EXCELLENT) color = 0x00FF88;
    else if (frac < QUALITY.GOOD) color = 0x00D4FF;
    else if (frac < QUALITY.FAIR) color = 0xFFB300;
    else color = 0xFF3B3B;
    gravityArrow.setColor(color);
}

// Camera presets
function setCameraView(view) {
    const d = 0.5;
    switch(view) {
        case 'front': camera.position.set(0, 0, d); break;
        case 'side':  camera.position.set(d, 0, 0); break;
        case 'top':   camera.position.set(0, d, 0); break;
        case 'iso':   camera.position.set(0.4, 0.3, 0.5); break;
    }
    controls.target.set(0, 0, 0);
    controls.update();
}

// ═══════════════════════════════════════════════════════════════════════
// CHART.JS LIVE PLOTS
// ═══════════════════════════════════════════════════════════════════════
let chartGRes, chartRPM, chartPower, chartGVec, chartGMag;
const MAX_PLOT_POINTS = 200;

function createChart(canvasId, config) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, config);
}

function initCharts() {
    const commonOpts = {
        responsive: true, maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: true, position: 'top', labels: { color: '#8899AA', font: { size: 9, family: 'Share Tech Mono' }, boxWidth: 10, padding: 6 } } },
        scales: {
            x: { display: true, grid: { color: 'rgba(0,212,255,0.05)' }, ticks: { color: '#556677', font: { size: 8 }, maxTicksLimit: 6 } },
            y: { display: true, grid: { color: 'rgba(0,212,255,0.05)' }, ticks: { color: '#556677', font: { size: 8 } } }
        }
    };

    // g-Residual
    chartGRes = createChart('chart-gres', {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'g-Residual %',
                data: [],
                borderColor: COLORS.CYAN,
                backgroundColor: 'rgba(0,212,255,0.1)',
                fill: true,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: { ...commonOpts, scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, min: 0, suggestedMax: 100 } } }
    });

    // RPM
    chartRPM = createChart('chart-rpm', {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'A1 Sp', data: [], borderColor: 'rgba(0,212,255,0.4)', borderWidth: 1, borderDash: [4,2], pointRadius: 0, tension: 0.1 },
                { label: 'A1 Act', data: [], borderColor: COLORS.CYAN, borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                { label: 'A2 Sp', data: [], borderColor: 'rgba(0,255,136,0.4)', borderWidth: 1, borderDash: [4,2], pointRadius: 0, tension: 0.1 },
                { label: 'A2 Act', data: [], borderColor: COLORS.GREEN, borderWidth: 1.5, pointRadius: 0, tension: 0.1 }
            ]
        },
        options: { ...commonOpts, scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, min: 0 } } }
    });

    // Power
    chartPower = createChart('chart-power', {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Power',
                data: [],
                borderColor: COLORS.AMBER,
                backgroundColor: 'rgba(255,179,0,0.1)',
                fill: true,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: { ...commonOpts, scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, min: 0, beginAtZero: true } } }
    });

    // Gravity Vector components
    chartGVec = createChart('chart-gvec', {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'gx', data: [], borderColor: '#FF6666', borderWidth: 1.2, pointRadius: 0, tension: 0.1 },
                { label: 'gy', data: [], borderColor: '#66FF66', borderWidth: 1.2, pointRadius: 0, tension: 0.1 },
                { label: 'gz', data: [], borderColor: '#6666FF', borderWidth: 1.2, pointRadius: 0, tension: 0.1 }
            ]
        },
        options: { ...commonOpts }
    });

    // g Magnitude
    chartGMag = createChart('chart-gmag', {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '|g|',
                data: [],
                borderColor: COLORS.WHITE,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1
            }]
        },
        options: { ...commonOpts }
    });
}

function pushChartData(chart, label, ...values) {
    if (!chart) return;
    chart.data.labels.push(label);
    values.forEach((v, i) => {
        if (chart.data.datasets[i]) chart.data.datasets[i].data.push(v);
    });
    // Trim
    while (chart.data.labels.length > MAX_PLOT_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(ds => ds.data.shift());
    }
    chart.update('none'); // no animation
}

// ═══════════════════════════════════════════════════════════════════════
// PHYSICS ENGINE
// ═══════════════════════════════════════════════════════════════════════
function physicsStep(dt) {
    STATE.time += dt;

    // Ramp actual RPMs toward setpoints
    for (let i = 0; i < 3; i++) {
        const target = STATE.rpmSet[i] * STATE.dirs[i];
        const current = STATE.rpmActual[i];
        const diff = target - current;
        const maxChange = STATE.rampRate * dt;
        STATE.rpmActual[i] = Math.abs(diff) <= maxChange ? target : current + Math.sign(diff) * maxChange;
    }

    // Convert to rad/s
    STATE.omega[0] = STATE.rpmActual[0] * TWO_PI / 60;
    STATE.omega[1] = STATE.mode !== '1D' ? STATE.rpmActual[1] * TWO_PI / 60 : 0;
    STATE.omega[2] = STATE.mode === '3D' ? STATE.rpmActual[2] * TWO_PI / 60 : 0;

    // Integrate orientation
    STATE.orientation = STATE.orientation.integrate(STATE.omega[0], STATE.omega[1], STATE.omega[2], dt);

    // Compute gravity in sample frame
    const gLab = [0, 0, -G0];
    STATE.gVec = STATE.orientation.conj().rotVec(gLab);

    // Update residual integrator
    STATE.sumGx += STATE.gVec[0] * dt;
    STATE.sumGy += STATE.gVec[1] * dt;
    STATE.sumGz += STATE.gVec[2] * dt;
    STATE.totalTime += dt;
    STATE.sampleCount++;

    if (STATE.totalTime > 1e-6) {
        const ax = STATE.sumGx / STATE.totalTime;
        const ay = STATE.sumGy / STATE.totalTime;
        const az = STATE.sumGz / STATE.totalTime;
        STATE.gRes = Math.sqrt(ax*ax + ay*ay + az*az);
    }
    STATE.gResPercent = (STATE.gRes / G0) * 100;

    // Random walk mode
    if (STATE.rotMode === 'RANDOM_WALK' && STATE.running) {
        STATE.rwTimer += dt;
        if (STATE.rwTimer >= STATE.rwInterval) {
            STATE.rwTimer = 0;
            const maxRPM = 10;
            const n = STATE.mode === '3D' ? 3 : STATE.mode === '2D' ? 2 : 1;
            for (let i = 0; i < n; i++) {
                STATE.rpmSet[i] = Math.random() * maxRPM + 0.5;
                STATE.dirs[i] = Math.random() > 0.5 ? 1 : -1;
            }
            syncUIFromState();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════════════════════════════════
let lastFrameTime = 0;
let plotUpdateCounter = 0;
const PLOT_INTERVAL = 5; // Update plots every N frames

function animate(timestamp) {
    requestAnimationFrame(animate);

    const dtFrame = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0.016;
    lastFrameTime = timestamp;

    // Physics (fixed timestep, accumulate)
    if (STATE.running) {
        STATE.physAccum += Math.min(dtFrame, 0.05); // Cap at 50ms
        while (STATE.physAccum >= STATE.physDt) {
            physicsStep(STATE.physDt);
            STATE.physAccum -= STATE.physDt;
        }
    }

    // Update 3D scene
    if (innerFrame) {
        // Build per-axis quaternions for visual rotation
        const q = STATE.orientation.toThreeQuat();
        innerFrame.quaternion.copy(q);
        if (outerFrame) outerFrame.quaternion.copy(q);
        if (payloadMesh) payloadMesh.quaternion.copy(q);
    }

    updateGravityArrow();
    controls.update();
    renderer.render(scene, camera);

    // Update UI readouts
    updateReadouts();

    // Update plots (throttled)
    plotUpdateCounter++;
    if (plotUpdateCounter >= PLOT_INTERVAL && STATE.running) {
        plotUpdateCounter = 0;
        const t = STATE.time.toFixed(1);
        pushChartData(chartGRes, t, STATE.gResPercent);
        pushChartData(chartRPM, t,
            Math.abs(STATE.rpmSet[0]), Math.abs(STATE.rpmActual[0]),
            Math.abs(STATE.rpmSet[1]), Math.abs(STATE.rpmActual[1])
        );
        // Simulated power (P = I²R proxy: proportional to RPM²)
        const power = STATE.rpmActual.reduce((s, r) => s + Math.abs(r) * 0.15, 0);
        pushChartData(chartPower, t, power);
        pushChartData(chartGVec, t, STATE.gVec[0], STATE.gVec[1], STATE.gVec[2]);
        const gMag = Math.sqrt(STATE.gVec[0]**2 + STATE.gVec[1]**2 + STATE.gVec[2]**2);
        pushChartData(chartGMag, t, gMag);
    }

    // Data logging
    if (STATE.logging && STATE.running) {
        const elapsed = STATE.time - STATE.lastLogTime;
        if (elapsed >= 1.0 / STATE.logRate) {
            STATE.lastLogTime = STATE.time;
            logDataPoint();
        }
    }

    // Session timer
    if (STATE.running) {
        updateSessionTimer();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// UI UPDATES
// ═══════════════════════════════════════════════════════════════════════
function updateReadouts() {
    const $ = id => document.getElementById(id);

    // g-Residual
    $('readout-gres').textContent = STATE.gResPercent.toFixed(2);
    $('readout-gres-abs').textContent = STATE.gRes.toFixed(4);

    // Quality badge
    const badge = $('quality-badge');
    const frac = STATE.gRes / G0;
    let q, qc;
    if (STATE.sampleCount < 100) { q = 'NO DATA'; qc = ''; }
    else if (frac < QUALITY.EXCELLENT) { q = 'EXCELLENT'; qc = 'excellent'; }
    else if (frac < QUALITY.GOOD) { q = 'GOOD'; qc = 'good'; }
    else if (frac < QUALITY.FAIR) { q = 'FAIR'; qc = 'fair'; }
    else { q = 'POOR'; qc = 'poor'; }
    badge.textContent = q;
    badge.className = 'quality-badge ' + qc;

    // RPMs
    $('readout-rpm1').textContent = Math.abs(STATE.rpmActual[0]).toFixed(2);
    $('readout-rpm2').textContent = Math.abs(STATE.rpmActual[1]).toFixed(2);
    $('rpm1-display').textContent = Math.abs(STATE.rpmActual[0]).toFixed(2);
    $('rpm2-display').textContent = Math.abs(STATE.rpmActual[1]).toFixed(2);

    // Gravity vector
    $('readout-gx').textContent = STATE.gVec[0].toFixed(3);
    $('readout-gy').textContent = STATE.gVec[1].toFixed(3);
    $('readout-gz').textContent = STATE.gVec[2].toFixed(3);

    // Centrifugal (at payload edge)
    const payR = STATE.payloadDiameter / 2000;
    const omegaMax = Math.max(Math.abs(STATE.omega[0]), Math.abs(STATE.omega[1]), Math.abs(STATE.omega[2]));
    const aCent = omegaMax * omegaMax * payR;
    $('readout-centrifugal').textContent = aCent.toFixed(4);

    // Euler angles
    const eul = STATE.orientation.toEuler();
    $('readout-euler').textContent = `R:${(eul.roll*DEG).toFixed(0)}° P:${(eul.pitch*DEG).toFixed(0)}° Y:${(eul.yaw*DEG).toFixed(0)}°`;

    $('readout-elapsed').textContent = STATE.time.toFixed(1) + ' s';
    $('readout-samples').textContent = STATE.sampleCount.toLocaleString();

    // Sim time display
    $('sim-time-label').textContent = `t = ${STATE.time.toFixed(2)} s`;

    // Viewport info
    $('viewport-info').textContent = `g⃗ = [${STATE.gVec[0].toFixed(2)}, ${STATE.gVec[1].toFixed(2)}, ${STATE.gVec[2].toFixed(2)}] m/s² | g_res = ${STATE.gResPercent.toFixed(3)}%`;
}

function updateSessionTimer() {
    const t = STATE.time;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    document.getElementById('session-timer').textContent =
        `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function syncUIFromState() {
    const $ = id => document.getElementById(id);
    $('rpm1-slider').value = STATE.rpmSet[0];
    $('rpm1-input').value = STATE.rpmSet[0].toFixed(1);
    $('rpm2-slider').value = STATE.rpmSet[1];
    $('rpm2-input').value = STATE.rpmSet[1].toFixed(2);
}

function updateMassInertia() {
    const r1 = STATE.frame1Radius / 1000;  // mm → m
    const tr1 = STATE.frame1Tube / 2000;   // tube radius (Tube-Ø/2) mm → m
    const r2 = STATE.frame2Radius / 1000;
    const tr2 = STATE.frame2Tube / 2000;

    // Material density from selector
    const matEl = document.getElementById('frame1-material');
    const density = matEl ? (MATERIAL_DENSITY[matEl.value] || 2700) : 2700;

    // Torus volume: V = 2π² · R · r²   (r = tube radius)
    const v1 = 2 * Math.PI * Math.PI * r1 * tr1 * tr1;
    const v2 = 2 * Math.PI * Math.PI * r2 * tr2 * tr2;
    const m1 = density * v1;
    const m2 = density * v2;

    // Payload mass (shape-dependent volume)
    const pr = STATE.payloadDiameter / 2000;  // payload radius (m)
    const ph = STATE.payloadHeight / 1000;    // payload height (m)
    let mPay = 0;
    if (STATE.payloadShape === 'sphere') {
        mPay = PAYLOAD_DENSITY * (4/3) * Math.PI * pr * pr * pr;
    } else if (STATE.payloadShape === 'box') {
        mPay = PAYLOAD_DENSITY * (pr * 2) * ph * (pr * 2); // square cross-section
    } else { // cylinder
        mPay = PAYLOAD_DENSITY * Math.PI * pr * pr * ph;
    }

    const totalMass = m1 + m2 + mPay;

    // Moment of inertia: I = m·R² (ring approx for tori)
    // Payload: at centre, I = 2/5·m·r² sphere; 1/2·m·r² cylinder/box (dominant axis)
    const I1 = m1 * r1 * r1;
    const I2 = m2 * r2 * r2;
    let Ipay = 0;
    if (STATE.payloadShape === 'sphere') {
        Ipay = 0.4 * mPay * pr * pr;
    } else {
        Ipay = 0.5 * mPay * pr * pr;
    }
    const totalI = I1 + I2 + Ipay;

    document.getElementById('total-mass').textContent = totalMass.toFixed(3);
    document.getElementById('total-inertia').textContent = totalI.toFixed(5);
}

// ═══════════════════════════════════════════════════════════════════════
// CONNECTION PANEL — live status
// ═══════════════════════════════════════════════════════════════════════
function updateConnectionPanel() {
    const setDot = (id, state) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = 'status-dot ' + state;
    };

    // Physics Engine: ok when running, warn when idle but initialised
    setDot('dot-physics', STATE.running ? 'ok' : 'warn');
    document.getElementById('label-physics').textContent =
        STATE.running ? 'Physics Engine (Active)' : 'Physics Engine (Idle)';

    // 3D Renderer: ok once renderer exists and has rendered a frame
    const rendered = renderer && renderer.info.render.frame > 0;
    setDot('dot-renderer', rendered ? 'ok' : 'warn');
    document.getElementById('label-renderer').textContent =
        rendered ? '3D Renderer (Running)' : '3D Renderer (Init)';

    // Data Logger: ok when actively logging
    setDot('dot-logger', STATE.logging ? 'ok' : 'warn');
    document.getElementById('label-logger').textContent =
        STATE.logging ? `Data Logger (${STATE.logData.length} rows)` : 'Data Logger (Idle)';

    // Motor HW: always warn in browser; label changes by mode
    if (STATE.connMode === 'HARDWARE' || STATE.connMode === 'HYBRID') {
        setDot('dot-motor', 'warn');
        document.getElementById('label-motor').textContent = 'Motor HW (Serial N/A in Browser)';
    } else {
        setDot('dot-motor', 'warn');
        document.getElementById('label-motor').textContent = 'Motor HW (Simulated)';
    }
}

// ═══════════════════════════════════════════════════════════════════════
// POINT PROBE — g-field at arbitrary point in payload frame
// ═══════════════════════════════════════════════════════════════════════
function calcPointProbe() {
    const xm = STATE.probeX / 1000;  // mm → m
    const ym = STATE.probeY / 1000;
    const zm = STATE.probeZ / 1000;

    // Gravity is uniform (rigid body): same g⃗ everywhere in the body frame
    const gx = STATE.gVec[0];
    const gy = STATE.gVec[1];
    const gz = STATE.gVec[2];
    const gMag = Math.sqrt(gx*gx + gy*gy + gz*gz);

    // Centrifugal acceleration at this point:
    // Point position in lab frame = R_body * r_body
    const rLab = STATE.orientation.rotVec([xm, ym, zm]);
    // ω vector in lab frame
    const wx = STATE.omega[0], wy = STATE.omega[1], wz = STATE.omega[2];
    // a_centrifugal = -ω × (ω × r) = ω²·r - (ω·r)ω  (outward from rotation axis)
    const omDotR = wx*rLab[0] + wy*rLab[1] + wz*rLab[2];
    const omSq = wx*wx + wy*wy + wz*wz;
    const acx = omSq*rLab[0] - omDotR*wx;
    const acy = omSq*rLab[1] - omDotR*wy;
    const acz = omSq*rLab[2] - omDotR*wz;
    const aCentMag = Math.sqrt(acx*acx + acy*acy + acz*acz);

    // Total effective g at probe point
    const totx = gx + acx, toty = gy + acy, totz = gz + acz;
    const totMag = Math.sqrt(totx*totx + toty*toty + totz*totz);

    const res = document.getElementById('probe-results');
    if (!res) return;
    res.style.display = 'block';
    res.innerHTML =
        `<span style="color:var(--electric-cyan)">— Probe @ (${STATE.probeX}, ${STATE.probeY}, ${STATE.probeZ}) mm —</span><br>` +
        `g⃗&nbsp;&nbsp;&nbsp; [${gx.toFixed(3)}, ${gy.toFixed(3)}, ${gz.toFixed(3)}] m/s²<br>` +
        `|g|&nbsp;&nbsp; ${gMag.toFixed(4)} m/s²<br>` +
        `a_cf&nbsp; [${acx.toFixed(3)}, ${acy.toFixed(3)}, ${acz.toFixed(3)}] m/s²<br>` +
        `|a_cf| ${aCentMag.toFixed(4)} m/s²<br>` +
        `<span style="color:var(--success-green)">|g_tot| ${totMag.toFixed(4)} m/s²</span>`;
}

// ═══════════════════════════════════════════════════════════════════════
// DATA LOGGING
// ═══════════════════════════════════════════════════════════════════════
function logDataPoint() {
    STATE.logData.push({
        timestamp_ms: Math.round(STATE.time * 1000),
        mode: STATE.mode,
        rpm1_set: STATE.rpmSet[0],
        rpm1_act: Math.abs(STATE.rpmActual[0]),
        rpm2_set: STATE.rpmSet[1],
        rpm2_act: Math.abs(STATE.rpmActual[1]),
        gx: STATE.gVec[0],
        gy: STATE.gVec[1],
        gz: STATE.gVec[2],
        g_res_pct: STATE.gResPercent,
        g_res_ms2: STATE.gRes,
    });
    document.getElementById('log-rows').textContent = STATE.logData.length;
}

function exportCSV() {
    if (STATE.logData.length === 0) { showToast('No data to export', 'warning'); return; }
    const name = document.getElementById('session-name').value || 'ClinoSimPro_Export';
    const headers = Object.keys(STATE.logData[0]);
    let csv = '# ClinoSim Pro Data Export\n';
    csv += `# Session: ${name}\n`;
    csv += `# Date: ${new Date().toISOString()}\n`;
    csv += `# Mode: ${STATE.mode} ${STATE.rotMode}\n`;
    csv += '# Units: time=ms, RPM=rev/min, g=m/s², g_res_pct=%\n';
    csv += headers.join(',') + '\n';
    STATE.logData.forEach(row => {
        csv += headers.map(h => {
            const v = row[h];
            return typeof v === 'number' ? v.toFixed(6) : v;
        }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_${STATE.mode}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${STATE.logData.length} rows`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════
// STOKES ANALYSIS
// ═══════════════════════════════════════════════════════════════════════
function updateStokesAnalysis() {
    const sel = document.getElementById('stokes-sample').value;
    if (!sel || !BIO_PRESETS[sel]) {
        document.getElementById('stokes-results').textContent = 'Select a sample type to analyze...';
        return;
    }
    const s = BIO_PRESETS[sel];
    const gRes = STATE.gRes;

    // v_s = (2·r²·(ρ_p - ρ_f)·g) / (9·μ)
    const vs = (2 * s.r * s.r * (s.rho_p - s.rho_f) * gRes) / (9 * s.mu);
    const vsEarth = (2 * s.r * s.r * (s.rho_p - s.rho_f) * G0) / (9 * s.mu);
    const omegaMin = vsEarth > 0 ? 5 * (2 * G0) / (Math.PI * vsEarth) : 0;
    const rpmMin = omegaMin * 60 / TWO_PI;
    const reduction = vsEarth > 0 ? ((1 - vs / vsEarth) * 100).toFixed(1) : 'N/A';

    document.getElementById('stokes-results').innerHTML = `
        <b style="color:${COLORS.CYAN}">${sel}</b><br>
        Cell radius: ${(s.r * 1e6).toFixed(1)} μm<br>
        Density (cell): ${s.rho_p} kg/m³<br>
        Density (medium): ${s.rho_f} kg/m³<br>
        Viscosity: ${(s.mu * 1000).toFixed(1)} mPa·s<br>
        <span style="color:${COLORS.AMBER}">─ At Earth g ─</span><br>
        v_settling: ${(vsEarth * 1e6).toFixed(3)} μm/s<br>
        <span style="color:${COLORS.GREEN}">─ At current g_res ─</span><br>
        v_settling: ${(vs * 1e6).toFixed(6)} μm/s<br>
        Sedimentation reduction: <b style="color:${COLORS.GREEN}">${reduction}%</b><br>
        Min RPM for nullification: ${rpmMin.toFixed(1)} RPM
    `;
}

// ═══════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════
// EVENT BINDING
// ═══════════════════════════════════════════════════════════════════════
function bindEvents() {
    const $ = id => document.getElementById(id);

    // ─── Mode Tabs ───
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('locked')) {
                showToast('3D Clinostat — Coming in Phase 2', 'info');
                return;
            }
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            STATE.mode = tab.dataset.mode;

            // Show/hide axis 2/3
            $('motor-axis-2').classList.toggle('hidden', STATE.mode === '1D');
            $('motor-axis-3').classList.toggle('hidden', STATE.mode !== '3D');

            // Rebuild 3D model
            buildClinostat();
            resetSimulation();
            showToast(`Switched to ${STATE.mode} Clinostat mode`, 'info');
        });
    });

    // ─── RPM Sliders ───
    $('rpm1-slider').addEventListener('input', e => {
        STATE.rpmSet[0] = parseFloat(e.target.value);
        $('rpm1-input').value = STATE.rpmSet[0].toFixed(1);
        if (STATE.autoGolden && STATE.mode === '2D') {
            STATE.rpmSet[1] = STATE.rpmSet[0] * PHI;
            $('rpm2-slider').value = STATE.rpmSet[1];
            $('rpm2-input').value = STATE.rpmSet[1].toFixed(2);
        }
    });
    $('rpm1-input').addEventListener('change', e => {
        STATE.rpmSet[0] = parseFloat(e.target.value) || 0;
        $('rpm1-slider').value = STATE.rpmSet[0];
        if (STATE.autoGolden && STATE.mode === '2D') {
            STATE.rpmSet[1] = STATE.rpmSet[0] * PHI;
            $('rpm2-slider').value = STATE.rpmSet[1];
            $('rpm2-input').value = STATE.rpmSet[1].toFixed(2);
        }
    });

    $('rpm2-slider').addEventListener('input', e => {
        STATE.rpmSet[1] = parseFloat(e.target.value);
        $('rpm2-input').value = STATE.rpmSet[1].toFixed(2);
    });
    $('rpm2-input').addEventListener('change', e => {
        STATE.rpmSet[1] = parseFloat(e.target.value) || 0;
        $('rpm2-slider').value = STATE.rpmSet[1];
    });

    $('rpm3-slider')?.addEventListener('input', e => {
        STATE.rpmSet[2] = parseFloat(e.target.value);
        $('rpm3-input').value = STATE.rpmSet[2].toFixed(1);
    });

    // Auto golden ratio
    $('auto-golden').addEventListener('change', e => {
        STATE.autoGolden = e.target.checked;
        if (STATE.autoGolden) {
            STATE.rpmSet[1] = STATE.rpmSet[0] * PHI;
            $('rpm2-slider').value = STATE.rpmSet[1];
            $('rpm2-input').value = STATE.rpmSet[1].toFixed(2);
        }
    });

    // ─── Direction Toggles ───
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const axis = parseInt(btn.dataset.axis) - 1;
            STATE.dirs[axis] = parseInt(btn.dataset.dir);
            // Update UI
            btn.parentElement.querySelectorAll('.direction-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ─── Control Buttons ───
    $('btn-start').addEventListener('click', () => {
        STATE.running = true;
        showToast('Simulation started', 'success');
    });
    $('btn-stop').addEventListener('click', () => {
        STATE.running = false;
        showToast('Simulation paused', 'info');
    });
    $('btn-reset').addEventListener('click', resetSimulation);
    $('btn-estop').addEventListener('click', () => {
        STATE.running = false;
        STATE.rpmSet = [0, 0, 0];
        STATE.rpmActual = [0, 0, 0];
        STATE.omega = [0, 0, 0];
        syncUIFromState();
        showToast('⚠ EMERGENCY STOP — All axes halted', 'error');
    });

    // ─── Rotation Mode ───
    document.querySelectorAll('input[name="rotation-mode"]').forEach(radio => {
        radio.addEventListener('change', e => {
            STATE.rotMode = e.target.value;
            showToast(`Rotation mode: ${STATE.rotMode}`, 'info');
        });
    });

    // ─── Geometry Editor ───
    ['frame1-radius', 'frame1-tube', 'frame2-radius', 'frame2-tube', 'payload-shape', 'payload-diameter', 'payload-height'].forEach(id => {
        $(id)?.addEventListener('change', () => {
            STATE.frame1Radius = parseFloat($('frame1-radius').value);
            STATE.frame1Tube = parseFloat($('frame1-tube').value);
            STATE.frame2Radius = parseFloat($('frame2-radius').value);
            STATE.frame2Tube = parseFloat($('frame2-tube').value);
            STATE.payloadShape = $('payload-shape').value;
            STATE.payloadDiameter = parseFloat($('payload-diameter').value);
            STATE.payloadHeight = parseFloat($('payload-height').value);

            // Collision check
            const clearance = STATE.frame2Radius - STATE.frame1Radius - STATE.frame1Tube - STATE.frame2Tube;
            const indicator = $('collision-indicator');
            if (clearance < 10) {
                indicator.className = 'collision-indicator collision';
                indicator.innerHTML = '<span class="status-dot error"></span> ⚠ Collision — Clearance: ' + clearance.toFixed(0) + 'mm';
            } else {
                indicator.className = 'collision-indicator ok';
                indicator.innerHTML = '<span class="status-dot ok"></span> No Collision — Clearance: ' + clearance.toFixed(0) + 'mm';
            }

            buildClinostat();
        });
    });

    // ─── Viewport Camera Presets ───
    document.querySelectorAll('.viewport-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.viewport-btn[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setCameraView(btn.dataset.view);
        });
    });

    // ─── Bottom Tabs ───
    document.querySelectorAll('.bottom-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.bottom-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const content = document.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
            if (content) content.classList.add('active');
        });
    });

    // ─── Data Logging ───
    $('btn-log-start').addEventListener('click', () => {
        STATE.logging = true;
        STATE.lastLogTime = STATE.time;
        $('btn-log-start').disabled = true;
        $('btn-log-stop').disabled = false;
        showToast('Data logging started', 'success');
    });
    $('btn-log-stop').addEventListener('click', () => {
        STATE.logging = false;
        $('btn-log-start').disabled = false;
        $('btn-log-stop').disabled = true;
        showToast(`Logging stopped — ${STATE.logData.length} rows`, 'info');
    });
    $('btn-export-csv').addEventListener('click', exportCSV);

    // ─── Stokes ───
    $('stokes-sample').addEventListener('change', updateStokesAnalysis);
}

function resetSimulation() {
    STATE.running = false;
    STATE.time = 0;
    STATE.orientation = new Quat();
    STATE.rpmActual = [0, 0, 0];
    STATE.omega = [0, 0, 0];
    STATE.gVec = [0, 0, -G0];
    STATE.gRes = G0;
    STATE.gResPercent = 100;
    STATE.sumGx = 0;
    STATE.sumGy = 0;
    STATE.sumGz = 0;
    STATE.totalTime = 0;
    STATE.sampleCount = 0;
    STATE.physAccum = 0;
    STATE.rwTimer = 0;

    // Clear charts
    [chartGRes, chartRPM, chartPower, chartGVec, chartGMag].forEach(c => {
        if (!c) return;
        c.data.labels = [];
        c.data.datasets.forEach(ds => ds.data = []);
        c.update('none');
    });

    showToast('Simulation reset', 'info');
}

// ═══════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initThree();
    initCharts();
    bindEvents();
    requestAnimationFrame(animate);

    showToast('ClinoSim Pro initialized — Simulation Mode', 'success');
    console.log('%c ClinoSim Pro v1.0 ', 'background: #0066FF; color: white; font-size: 14px; padding: 4px 8px; border-radius: 4px;');
    console.log('Microgravity Digital Twin — PS4 Mission Ground Simulation');
});
