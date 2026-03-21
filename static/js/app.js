const screens = {
    intro: document.getElementById("screen-intro"),
    instructions: document.getElementById("screen-instructions"),
    recording: document.getElementById("screen-recording"),
    generating: document.getElementById("screen-generating"),
    result: document.getElementById("screen-result"),
};

const beginBtn = document.getElementById("begin-btn");
const backBtn = document.getElementById("back-btn");
const startRecordingBtn = document.getElementById("start-recording-btn");
const recordingBackBtn = document.getElementById("recording-back-btn");
const finishTracingBtn = document.getElementById("finish-tracing-btn");
const restartBtn = document.getElementById("restart-btn");
const saveArtworkBtn = document.getElementById("save-artwork-btn");
const savePosterBtn = document.getElementById("save-poster-btn");

const sessionIdLabel = document.getElementById("session-id-label");
const timeLeftLabel = document.getElementById("time-left-label");
const submitStatusText = document.getElementById("submit-status-text");
const metricsGrid = document.getElementById("metrics-grid");
const portraitCanvasWrap = document.getElementById("portrait-canvas-wrap");

const traceScrollArea = document.getElementById("trace-scroll-area");
const zones = document.querySelectorAll(".zone");

const RECORDING_DURATION_SEC = 30;
const MIN_REQUIRED_DURATION_SEC = 15;
const MOUSE_SAMPLE_MS = 40;
const PAUSE_THRESHOLD_MS = 900;
const PAUSE_MOVE_THRESHOLD_PX = 8;

let portraitSketchInstance = null;
let portraitReady = false;

let appState = {
    sessionId: null,
    startedAt: null,
    recordingStartedAtMs: null,
    recordingActive: false,
    recordingTimer: null,
    pauseInterval: null,
    lastMouseSampleAt: 0,
    lastMousePos: null,
    lastMovementAt: null,
    pauseOpen: false,
    currentHoveredZone: null,
    features: null,
    seed: null,
    palette: null,
    percentiles: null,
    trace: {
        mouse: [],
        clicks: [],
        scroll: [],
        hovers: [],
        pauses: [],
    },
};

function showScreen(screenKey) {
    Object.values(screens).forEach((screen) => {
        screen.classList.remove("active");
    });
    screens[screenKey].classList.add("active");
}

function resetTrace() {
    appState.trace = {
        mouse: [],
        clicks: [],
        scroll: [],
        hovers: [],
        pauses: [],
    };
    appState.features = null;
    appState.seed = null;
    appState.palette = null;
    appState.percentiles = null;
    appState.lastMouseSampleAt = 0;
    appState.lastMousePos = null;
    appState.lastMovementAt = null;
    appState.pauseOpen = false;
    appState.currentHoveredZone = null;
    traceScrollArea.scrollTop = 0;
    portraitReady = false;

    if (portraitSketchInstance) {
        portraitSketchInstance.remove();
        portraitSketchInstance = null;
    }

    portraitCanvasWrap.innerHTML = "";
    metricsGrid.innerHTML = "<p>Waiting for data...</p>";

    const comparisonBlock = document.getElementById("comparison-block");
    if (comparisonBlock) {
        comparisonBlock.innerHTML = '<p class="eyebrow">Comparison</p>';
    }
}

function renderFeatures(features) {
    const rows = [
        ["Duration", `${features.duration_sec} s`],
        ["Path length", `${Math.round(features.path_length)}`],
        ["Average speed", `${features.avg_speed}`],
        ["Speed variance", `${features.speed_variance}`],
        ["Clicks", `${features.click_count}`],
        ["Scroll depth", `${features.scroll_depth}px`],
        ["Hover diversity", `${features.hover_diversity}`],
        ["Coverage ratio", `${features.coverage_ratio}`],
        ["Pause count", `${features.pause_count}`],
        ["Average pause", `${Math.round(features.avg_pause_duration_ms)} ms`],
        ["Center bias", `${features.center_bias}`],
    ];

    metricsGrid.innerHTML = rows
        .map(
            ([label, value]) => `
                <div class="metric-row">
                    <span class="metric-label">${label}</span>
                    <strong class="metric-value">${value}</strong>
                </div>
            `
        )
        .join("");
}

function renderComparison(percentiles) {
    const labels = {
        motion: "Motion intensity",
        exploration: "Exploration",
        rhythm: "Rhythm",
        decisions: "Decision density",
        contemplation: "Contemplation",
    };

    const block = document.getElementById("comparison-block");
    if (!block) return;

    block.innerHTML = '<p class="eyebrow">Comparison</p>' +
        Object.entries(percentiles)
            .map(
                ([key, value]) => `
                    <div class="metric-row">
                        <span class="metric-label">${labels[key] || key}</span>
                        <strong class="metric-value">${value}%</strong>
                    </div>
                `
            )
            .join("");
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return outMin + t * (outMax - outMin);
}

function buildPortraitInterpretation(features) {
    const motion = features.path_length > 6000 ? "expansive" : "contained";
    const rhythm = features.speed_variance > 0.002 ? "volatile" : "steady";
    const contemplation = features.pause_count >= 3 ? "contemplative" : "immediate";
    return `${motion}, ${rhythm}, and ${contemplation}`;
}

function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
}

function portraitConfigFromFeatures(features) {
    return {
        particleCount: Math.floor(clamp(mapRange(features.path_length, 500, 18000, 120, 520), 120, 560)),
        clickBursts: clamp(features.click_count, 0, 24),
        pauseNodes: clamp(features.pause_count, 0, 12),
        turbulence: clamp(mapRange(features.speed_variance, 0, 0.02, 0.15, 2.2), 0.15, 2.5),
        drift: clamp(mapRange(features.scroll_depth, 0, 1600, 0.05, 1.4), 0.05, 1.6),
        spread: clamp(mapRange(features.coverage_ratio, 0.05, 1.0, 90, 260), 90, 280),
        centerPull: clamp(mapRange(features.center_bias, 0, 1, 0.001, 0.02), 0.001, 0.024),
    };
}

function drawPortraitFrame(p, width, height, features, seed, palette, frameNumber = 160) {
    const cfg = portraitConfigFromFeatures(features);

    const bg = hexToRgb(palette.background);
    const warm = hexToRgb(palette.warm);
    const cool = hexToRgb(palette.cool);
    const accent = hexToRgb(palette.accent);
    const soft = hexToRgb(palette.soft);

    function lerpColorObj(a, b, t) {
        return {
            r: p.lerp(a.r, b.r, t),
            g: p.lerp(a.g, b.g, t),
            b: p.lerp(a.b, b.b, t),
        };
    }

    p.push();
    p.randomSeed(seed);
    p.noiseSeed(seed);
    p.background(bg.r, bg.g, bg.b);

    const cx = width / 2;
    const cy = height / 2;

    const nodes = [];
    const bursts = [];
    const particles = [];

    for (let i = 0; i < Math.max(2, cfg.pauseNodes); i++) {
        const angle = p.random(p.TWO_PI);
        const radius = p.random(cfg.spread * 0.2, cfg.spread * 0.9);
        nodes.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius * p.random(0.6, 1.2),
            radius: p.random(20, 54),
        });
    }

    for (let i = 0; i < Math.max(3, cfg.clickBursts); i++) {
        const angle = p.random(p.TWO_PI);
        const radius = p.random(30, cfg.spread);
        bursts.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            radius: p.random(40, 120),
        });
    }

    for (let i = 0; i < cfg.particleCount; i++) {
        const angle = p.random(p.TWO_PI);
        const radius = p.random(10, cfg.spread);
        const colMix = p.random();

        particles.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            vx: p.random(-0.8, 0.8),
            vy: p.random(-0.8, 0.8),
            size: p.random(1.5, 4.8) + mapRange(features.avg_pause_duration_ms, 0, 2500, 0, 2.2),
            alpha: p.random(60, 190),
            color: lerpColorObj(
                colMix < 0.5 ? cool : warm,
                colMix < 0.5 ? accent : soft,
                p.random(0.15, 0.85)
            ),
        });
    }

    for (let step = 0; step < frameNumber; step++) {
        p.noStroke();
        p.fill(bg.r, bg.g, bg.b, 26);
        p.rect(0, 0, width, height);

        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            p.noStroke();
            p.fill(soft.r, soft.g, soft.b, 18);
            p.circle(n.x, n.y, n.radius * 2.8);

            p.fill(accent.r, accent.g, accent.b, 30);
            p.circle(n.x, n.y, n.radius * 1.4);
        }

        for (let i = 0; i < bursts.length; i++) {
            const b = bursts[i];
            p.noFill();
            p.stroke(warm.r, warm.g, warm.b, 18);
            p.strokeWeight(1);
            p.circle(b.x, b.y, b.radius + Math.sin(step * 0.03 + i) * 12);

            p.stroke(cool.r, cool.g, cool.b, 14);
            p.circle(b.x, b.y, b.radius * 0.55 + Math.cos(step * 0.04 + i) * 10);
        }

        for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];

            const dx = cx - pt.x;
            const dy = cy - pt.y;
            pt.vx += dx * cfg.centerPull;
            pt.vy += dy * cfg.centerPull;

            const noiseAngle = p.noise(pt.x * 0.003, pt.y * 0.003, step * 0.004) * p.TWO_PI * 2.0;
            pt.vx += Math.cos(noiseAngle) * 0.02 * cfg.turbulence;
            pt.vy += Math.sin(noiseAngle) * 0.02 * cfg.turbulence;

            pt.vy += cfg.drift * 0.003;

            pt.vx *= 0.985;
            pt.vy *= 0.985;

            const prevX = pt.x;
            const prevY = pt.y;

            pt.x += pt.vx;
            pt.y += pt.vy;

            p.stroke(pt.color.r, pt.color.g, pt.color.b, pt.alpha * 0.33);
            p.strokeWeight(pt.size * 0.55);
            p.line(prevX, prevY, pt.x, pt.y);

            p.noStroke();
            p.fill(pt.color.r, pt.color.g, pt.color.b, pt.alpha);
            p.circle(pt.x, pt.y, pt.size);

            if (pt.x < -40 || pt.x > width + 40 || pt.y < -40 || pt.y > height + 40) {
                pt.x = cx + p.random(-cfg.spread * 0.5, cfg.spread * 0.5);
                pt.y = cy + p.random(-cfg.spread * 0.5, cfg.spread * 0.5);
                pt.vx = p.random(-0.6, 0.6);
                pt.vy = p.random(-0.6, 0.6);
            }
        }
    }

    p.noFill();
    p.stroke(255, 255, 255, 12);
    p.strokeWeight(1);
    p.ellipse(cx, cy, cfg.spread * 1.6, cfg.spread * 1.15);
    p.ellipse(cx, cy, cfg.spread * 0.95, cfg.spread * 0.72);

    for (let i = 0; i < 120; i++) {
        const gx = p.random(width);
        const gy = p.random(height);
        p.stroke(255, 255, 255, 10);
        p.point(gx, gy);
    }

    p.pop();
}

function createPortraitSketch(features, seed, palette) {
    const containerWidth = portraitCanvasWrap.clientWidth || 800;
    const containerHeight = portraitCanvasWrap.clientHeight || 560;

    const cfg = portraitConfigFromFeatures(features);

    return new p5((p) => {
        const particles = [];
        const bursts = [];
        const nodes = [];

        const bg = hexToRgb(palette.background);
        const warm = hexToRgb(palette.warm);
        const cool = hexToRgb(palette.cool);
        const accent = hexToRgb(palette.accent);
        const soft = hexToRgb(palette.soft);

        function lerpColorObj(a, b, t) {
            return {
                r: p.lerp(a.r, b.r, t),
                g: p.lerp(a.g, b.g, t),
                b: p.lerp(a.b, b.b, t),
            };
        }

        function buildNodes() {
            const cx = p.width / 2;
            const cy = p.height / 2;

            for (let i = 0; i < Math.max(2, cfg.pauseNodes); i++) {
                const angle = p.random(p.TWO_PI);
                const radius = p.random(cfg.spread * 0.2, cfg.spread * 0.9);
                nodes.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius * p.random(0.6, 1.2),
                    radius: p.random(20, 54),
                });
            }
        }

        function buildBursts() {
            const cx = p.width / 2;
            const cy = p.height / 2;
            for (let i = 0; i < Math.max(3, cfg.clickBursts); i++) {
                const angle = p.random(p.TWO_PI);
                const radius = p.random(30, cfg.spread);
                bursts.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius,
                    radius: p.random(40, 120),
                });
            }
        }

        function buildParticles() {
            const cx = p.width / 2;
            const cy = p.height / 2;

            for (let i = 0; i < cfg.particleCount; i++) {
                const angle = p.random(p.TWO_PI);
                const radius = p.random(10, cfg.spread);
                const colMix = p.random();

                particles.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius,
                    vx: p.random(-0.8, 0.8),
                    vy: p.random(-0.8, 0.8),
                    size: p.random(1.5, 4.8) + mapRange(features.avg_pause_duration_ms, 0, 2500, 0, 2.2),
                    alpha: p.random(60, 190),
                    color: lerpColorObj(
                        colMix < 0.5 ? cool : warm,
                        colMix < 0.5 ? accent : soft,
                        p.random(0.15, 0.85)
                    ),
                });
            }
        }

        p.setup = () => {
            p.createCanvas(containerWidth, containerHeight);
            p.pixelDensity(2);
            p.randomSeed(seed);
            p.noiseSeed(seed);

            buildNodes();
            buildBursts();
            buildParticles();

            portraitReady = true;
        };

        p.draw = () => {
            p.background(bg.r, bg.g, bg.b, 26);

            const cx = p.width / 2;
            const cy = p.height / 2;

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                p.noStroke();
                p.fill(soft.r, soft.g, soft.b, 18);
                p.circle(n.x, n.y, n.radius * 2.8);

                p.fill(accent.r, accent.g, accent.b, 30);
                p.circle(n.x, n.y, n.radius * 1.4);
            }

            for (let i = 0; i < bursts.length; i++) {
                const b = bursts[i];
                p.noFill();
                p.stroke(warm.r, warm.g, warm.b, 18);
                p.strokeWeight(1);
                p.circle(b.x, b.y, b.radius + Math.sin(p.frameCount * 0.03 + i) * 12);

                p.stroke(cool.r, cool.g, cool.b, 14);
                p.circle(b.x, b.y, b.radius * 0.55 + Math.cos(p.frameCount * 0.04 + i) * 10);
            }

            for (let i = 0; i < particles.length; i++) {
                const pt = particles[i];

                const dx = cx - pt.x;
                const dy = cy - pt.y;
                pt.vx += dx * cfg.centerPull;
                pt.vy += dy * cfg.centerPull;

                const noiseAngle = p.noise(pt.x * 0.003, pt.y * 0.003, p.frameCount * 0.004) * p.TWO_PI * 2.0;
                pt.vx += Math.cos(noiseAngle) * 0.02 * cfg.turbulence;
                pt.vy += Math.sin(noiseAngle) * 0.02 * cfg.turbulence;

                pt.vy += cfg.drift * 0.003;

                pt.vx *= 0.985;
                pt.vy *= 0.985;

                const prevX = pt.x;
                const prevY = pt.y;

                pt.x += pt.vx;
                pt.y += pt.vy;

                p.stroke(pt.color.r, pt.color.g, pt.color.b, pt.alpha * 0.33);
                p.strokeWeight(pt.size * 0.55);
                p.line(prevX, prevY, pt.x, pt.y);

                p.noStroke();
                p.fill(pt.color.r, pt.color.g, pt.color.b, pt.alpha);
                p.circle(pt.x, pt.y, pt.size);

                if (pt.x < -40 || pt.x > p.width + 40 || pt.y < -40 || pt.y > p.height + 40) {
                    pt.x = cx + p.random(-cfg.spread * 0.5, cfg.spread * 0.5);
                    pt.y = cy + p.random(-cfg.spread * 0.5, cfg.spread * 0.5);
                    pt.vx = p.random(-0.6, 0.6);
                    pt.vy = p.random(-0.6, 0.6);
                }
            }

            p.noFill();
            p.stroke(255, 255, 255, 12);
            p.strokeWeight(1);
            p.ellipse(cx, cy, cfg.spread * 1.6, cfg.spread * 1.15);
            p.ellipse(cx, cy, cfg.spread * 0.95, cfg.spread * 0.72);

            for (let i = 0; i < 120; i++) {
                const gx = p.random(p.width);
                const gy = p.random(p.height);
                p.stroke(255, 255, 255, 10);
                p.point(gx, gy);
            }
        };
    }, portraitCanvasWrap);
}

function renderPortrait() {
    if (!appState.features || !appState.seed || !appState.palette) return;

    if (portraitSketchInstance) {
        portraitSketchInstance.remove();
        portraitSketchInstance = null;
    }

    portraitCanvasWrap.innerHTML = "";
    portraitSketchInstance = createPortraitSketch(appState.features, appState.seed, appState.palette);
}

async function startSession() {
    const response = await fetch("/api/start-session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        throw new Error("Failed to start session");
    }

    const data = await response.json();
    appState.sessionId = data.session_id;
    appState.startedAt = data.started_at || null;
    sessionIdLabel.textContent = appState.sessionId;
}

function nowOffsetMs() {
    if (!appState.recordingStartedAtMs) return 0;
    return Date.now() - appState.recordingStartedAtMs;
}

function showFinishAvailability() {
    const elapsedSec = nowOffsetMs() / 1000;
    finishTracingBtn.disabled = elapsedSec < MIN_REQUIRED_DURATION_SEC;
}

function startRecording() {
    resetTrace();

    appState.recordingActive = true;
    appState.recordingStartedAtMs = Date.now();
    appState.lastMovementAt = Date.now();
    timeLeftLabel.textContent = RECORDING_DURATION_SEC.toString();
    finishTracingBtn.disabled = true;

    appState.recordingTimer = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - appState.recordingStartedAtMs) / 1000);
        const remaining = Math.max(0, RECORDING_DURATION_SEC - elapsedSec);
        timeLeftLabel.textContent = remaining.toString();
        showFinishAvailability();

        if (remaining <= 0) {
            stopRecordingAndSubmit();
        }
    }, 250);

    appState.pauseInterval = setInterval(() => {
        if (!appState.recordingActive || !appState.lastMovementAt) return;

        const idleMs = Date.now() - appState.lastMovementAt;

        if (idleMs >= PAUSE_THRESHOLD_MS && !appState.pauseOpen && appState.lastMousePos) {
            appState.pauseOpen = true;
            appState.trace.pauses.push({
                x: appState.lastMousePos.x,
                y: appState.lastMousePos.y,
                t: nowOffsetMs(),
                idle_ms: idleMs,
            });
        }

        if (idleMs < PAUSE_THRESHOLD_MS) {
            appState.pauseOpen = false;
        }
    }, 200);
}

function stopRecording() {
    appState.recordingActive = false;

    if (appState.recordingTimer) {
        clearInterval(appState.recordingTimer);
        appState.recordingTimer = null;
    }

    if (appState.pauseInterval) {
        clearInterval(appState.pauseInterval);
        appState.pauseInterval = null;
    }

    if (appState.currentHoveredZone) {
        appState.trace.hovers.push({
            zone: appState.currentHoveredZone,
            event: "leave",
            t: nowOffsetMs(),
        });
        appState.currentHoveredZone = null;
    }
}

async function stopRecordingAndSubmit() {
    if (!appState.recordingActive) return;

    stopRecording();
    showScreen("generating");
    submitStatusText.textContent = "Submitting interaction trace...";

    const payload = {
        session_id: appState.sessionId,
        trace: {
            ...appState.trace,
            meta: {
                duration_ms: nowOffsetMs(),
                viewport_w: window.innerWidth,
                viewport_h: window.innerHeight,
                recording_duration_target_sec: RECORDING_DURATION_SEC,
            },
        },
    };

    try {
        const response = await fetch("/api/submit-trace", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error("Failed to submit trace");
        }

        const data = await response.json();
        appState.features = data.features;
        appState.seed = data.seed;
        appState.palette = data.palette;
        appState.percentiles = data.percentiles || null;

        submitStatusText.textContent = `Trace saved. ${buildPortraitInterpretation(appState.features)} behavior detected.`;

        renderFeatures(appState.features);
        if (appState.percentiles) {
            renderComparison(appState.percentiles);
        }

        setTimeout(() => {
            showScreen("result");
            renderPortrait();
        }, 1000);
    } catch (error) {
        console.error(error);
        submitStatusText.textContent = "Error while submitting trace.";
        alert("Could not submit trace.");
    }
}

function recordMouseMove(event) {
    if (!appState.recordingActive) return;

    const now = Date.now();
    const x = event.clientX;
    const y = event.clientY;

    let movedEnough = true;
    if (appState.lastMousePos) {
        const dx = x - appState.lastMousePos.x;
        const dy = y - appState.lastMousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        movedEnough = dist >= PAUSE_MOVE_THRESHOLD_PX;
    }

    if (movedEnough) {
        appState.lastMovementAt = now;
        appState.pauseOpen = false;
    }

    if (now - appState.lastMouseSampleAt >= MOUSE_SAMPLE_MS) {
        appState.trace.mouse.push({
            x,
            y,
            t: nowOffsetMs(),
        });

        appState.lastMouseSampleAt = now;
        appState.lastMousePos = { x, y };
    } else {
        appState.lastMousePos = { x, y };
    }
}

function recordClick(event) {
    if (!appState.recordingActive) return;

    const zoneElement = event.target.closest(".zone");
    const zone = zoneElement ? zoneElement.dataset.zone : null;

    appState.trace.clicks.push({
        x: event.clientX,
        y: event.clientY,
        t: nowOffsetMs(),
        zone,
    });
}

function recordScroll() {
    if (!appState.recordingActive) return;

    appState.trace.scroll.push({
        scroll_top: traceScrollArea.scrollTop,
        t: nowOffsetMs(),
    });
}

function recordHoverEnter(zoneName) {
    if (!appState.recordingActive) return;

    appState.currentHoveredZone = zoneName;
    appState.trace.hovers.push({
        zone: zoneName,
        event: "enter",
        t: nowOffsetMs(),
    });
}

function recordHoverLeave(zoneName) {
    if (!appState.recordingActive) return;

    appState.trace.hovers.push({
        zone: zoneName,
        event: "leave",
        t: nowOffsetMs(),
    });

    if (appState.currentHoveredZone === zoneName) {
        appState.currentHoveredZone = null;
    }
}

function saveArtwork() {
    if (!portraitSketchInstance || !portraitReady) {
        alert("Artwork is not ready yet.");
        return;
    }

    portraitSketchInstance.saveCanvas(`data-trace-${appState.sessionId || "session"}`, "png");
}

function savePoster() {
    if (!appState.features || !appState.seed || !appState.palette) {
        alert("Poster data is not ready yet.");
        return;
    }

    const helperId = "poster-helper-canvas";
    let helperWrap = document.getElementById(helperId);

    if (helperWrap) {
        helperWrap.remove();
    }

    helperWrap = document.createElement("div");
    helperWrap.id = helperId;
    helperWrap.className = "poster-helper-canvas";
    document.body.appendChild(helperWrap);

    const posterWidth = 2480;
    const posterHeight = 3508;
    const artX = 220;
    const artY = 560;
    const artW = 2040;
    const artH = 1760;

    new p5((p) => {
        p.setup = () => {
            p.createCanvas(posterWidth, posterHeight);
            p.pixelDensity(2);
            p.noLoop();

            const bg = hexToRgb(appState.palette.background);
            const accent = hexToRgb(appState.palette.accent);
            const soft = hexToRgb(appState.palette.soft);

            p.background(bg.r, bg.g, bg.b);

            p.noStroke();
            p.fill(255, 255, 255, 10);
            p.rect(80, 80, posterWidth - 160, posterHeight - 160, 40);

            p.push();
            p.translate(artX, artY);
            drawPortraitFrame(p, artW, artH, appState.features, appState.seed, appState.palette, 180);
            p.pop();

            p.noFill();
            p.stroke(255, 255, 255, 22);
            p.strokeWeight(3);
            p.rect(artX, artY, artW, artH, 28);

            p.noStroke();
            p.fill(245);
            p.textAlign(p.LEFT, p.TOP);

            p.textSize(42);
            p.text("DATA TRACE", 220, 150);

            p.fill(255);
            p.textSize(108);
            p.text("Behavioral Portrait", 220, 220);

            p.fill(210);
            p.textSize(38);
            p.text(
                "A generative poster built from cursor movement, clicks, pauses, and scrolling behavior.",
                220,
                360,
                1700,
                140
            );

            p.fill(accent.r, accent.g, accent.b);
            p.textSize(34);
            p.text(`Session ID: ${appState.sessionId}`, 220, 2440);

            p.fill(255);
            p.textSize(52);
            p.text("Metrics", 220, 2550);

            const metricRows = [
                ["Duration", `${appState.features.duration_sec} s`],
                ["Path length", `${Math.round(appState.features.path_length)}`],
                ["Clicks", `${appState.features.click_count}`],
                ["Scroll depth", `${appState.features.scroll_depth}px`],
                ["Pause count", `${appState.features.pause_count}`],
                ["Coverage ratio", `${appState.features.coverage_ratio}`],
            ];

            let metricY = 2640;
            p.textSize(34);
            for (const [label, value] of metricRows) {
                p.fill(180);
                p.text(label, 220, metricY);
                p.fill(255);
                p.text(value, 860, metricY);
                metricY += 72;
            }

            if (appState.percentiles) {
                p.fill(255);
                p.textSize(52);
                p.text("Comparison", 1360, 2550);

                const compRows = [
                    ["Motion intensity", `${appState.percentiles.motion}%`],
                    ["Exploration", `${appState.percentiles.exploration}%`],
                    ["Rhythm", `${appState.percentiles.rhythm}%`],
                    ["Decision density", `${appState.percentiles.decisions}%`],
                    ["Contemplation", `${appState.percentiles.contemplation}%`],
                ];

                let compY = 2640;
                p.textSize(34);
                for (const [label, value] of compRows) {
                    p.fill(180);
                    p.text(label, 1360, compY);
                    p.fill(soft.r, soft.g, soft.b);
                    p.text(value, 1960, compY);
                    compY += 72;
                }
            }

            p.stroke(255, 255, 255, 18);
            p.line(220, 3340, 2260, 3340);

            p.noStroke();
            p.fill(160);
            p.textSize(28);
            p.text(
                `Generated from invisible interface data · ${buildPortraitInterpretation(appState.features)}`,
                220,
                3370
            );

            p.saveCanvas(`data-trace-poster-${appState.sessionId || "session"}`, "png");
            p.remove();
            helperWrap.remove();
        };
    }, helperWrap);
}

beginBtn.addEventListener("click", () => {
    showScreen("instructions");
});

backBtn.addEventListener("click", () => {
    showScreen("intro");
});

startRecordingBtn.addEventListener("click", async () => {
    try {
        await startSession();
        showScreen("recording");
        startRecording();
    } catch (error) {
        console.error(error);
        alert("Could not start session.");
    }
});

recordingBackBtn.addEventListener("click", () => {
    stopRecording();
    showScreen("instructions");
});

finishTracingBtn.addEventListener("click", async () => {
    await stopRecordingAndSubmit();
});

restartBtn.addEventListener("click", () => {
    showScreen("intro");
});

saveArtworkBtn.addEventListener("click", saveArtwork);
savePosterBtn.addEventListener("click", savePoster);

document.addEventListener("mousemove", recordMouseMove);
document.addEventListener("click", recordClick);
traceScrollArea.addEventListener("scroll", recordScroll);

zones.forEach((zone) => {
    zone.addEventListener("mouseenter", () => {
        recordHoverEnter(zone.dataset.zone);
    });

    zone.addEventListener("mouseleave", () => {
        recordHoverLeave(zone.dataset.zone);
    });
});

window.addEventListener("resize", () => {
    if (screens.result.classList.contains("active") && appState.features && appState.seed && appState.palette) {
        renderPortrait();
    }
});