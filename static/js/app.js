// =========================
// Game Definitions
// =========================

const GAMES = [
    {
        id: "reaction",
        name: "Reaction Grid",
        icon: "⚡",
        description: "Click the glowing squares as fast as you can!",
        duration: 15000,
        instructions: "Click each square that lights up. Faster clicks = higher score!",
        createGame: (p, container, onScore, onComplete) => new ReactionGame(p, container, onScore, onComplete)
    },
    {
        id: "flow",
        name: "Flow Path",
        icon: "🌀",
        description: "Follow the winding path with your mouse",
        duration: 15000,
        instructions: "Keep your cursor inside the glowing path. Stay on track for max score!",
        createGame: (p, container, onScore, onComplete) => new FlowGame(p, container, onScore, onComplete)
    },
    {
        id: "pulse",
        name: "Pulse Keeper",
        icon: "💓",
        description: "Click in rhythm with the pulsing heart",
        duration: 15000,
        instructions: "Click exactly when the heart pulses. Perfect timing gives bonus points!",
        createGame: (p, container, onScore, onComplete) => new PulseGame(p, container, onScore, onComplete)
    },
    {
        id: "memory",
        name: "Memory Trace",
        icon: "🧠",
        description: "Remember and repeat the pattern",
        duration: 20000,
        instructions: "Watch the sequence, then repeat it by clicking the buttons in order.",
        createGame: (p, container, onScore, onComplete) => new MemoryGame(p, container, onScore, onComplete)
    },
    {
        id: "balance",
        name: "Balance Orb",
        icon: "⚖️",
        description: "Keep the orb centered",
        duration: 15000,
        instructions: "Move your mouse to keep the orb inside the center ring.",
        createGame: (p, container, onScore, onComplete) => new BalanceGame(p, container, onScore, onComplete)
    },
    {
        id: "chaos",
        name: "Chaos Trigger",
        icon: "💥",
        description: "Click the chaotic targets",
        duration: 15000,
        instructions: "Click as many moving targets as you can!",
        createGame: (p, container, onScore, onComplete) => new ChaosGame(p, container, onScore, onComplete)
    },
    {
        id: "zen",
        name: "Zen Scroll",
        icon: "🧘",
        description: "Scroll at a steady pace",
        duration: 15000,
        instructions: "Scroll smoothly to follow the moving line. Consistency is key!",
        createGame: (p, container, onScore, onComplete) => new ZenGame(p, container, onScore, onComplete)
    }
];

// =========================
// Game 1: Reaction Grid
// =========================

class ReactionGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.gridSize = 4;
        this.cells = [];
        this.activeCell = null;
        this.lastReaction = 0;
        this.reactionTimes = [];

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        const cellW = this.p.width / this.gridSize;
        const cellH = this.p.height / this.gridSize;

        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                this.cells.push({
                    x: j * cellW,
                    y: i * cellH,
                    w: cellW,
                    h: cellH,
                    active: false,
                    row: i,
                    col: j
                });
            }
        }

        this.p.mousePressed = () => this.handleClick();
        this.start();
    }

    start() {
        this.active = true;
        this.scheduleNext();
    }

    scheduleNext() {
        if (!this.active) return;
        setTimeout(() => this.activateRandomCell(), 300 + Math.random() * 500);
    }

    activateRandomCell() {
        if (!this.active) return;

        if (this.activeCell) {
            this.activeCell.active = false;
        }

        const available = this.cells.filter(c => !c.active);
        if (available.length > 0) {
            this.activeCell = available[Math.floor(Math.random() * available.length)];
            this.activeCell.active = true;
            this.lastReaction = Date.now();
        }

        setTimeout(() => {
            if (this.activeCell && this.activeCell.active) {
                this.activeCell.active = false;
                this.activeCell = null;
                this.scheduleNext();
            }
        }, 800);
    }

    handleClick() {
        if (!this.active) return;

        const mx = this.p.mouseX;
        const my = this.p.mouseY;

        if (this.activeCell &&
            mx >= this.activeCell.x && mx <= this.activeCell.x + this.activeCell.w &&
            my >= this.activeCell.y && my <= this.activeCell.y + this.activeCell.h) {

            const reactionTime = Date.now() - this.lastReaction;
            this.reactionTimes.push(reactionTime);

            let points = Math.max(0, Math.floor(100 - reactionTime / 10));
            points = Math.min(100, points);
            this.score += points;

            this.onScore(this.score);

            this.activeCell.active = false;
            this.activeCell = null;
            this.scheduleNext();
        }
    }

    draw() {
        if (!this.active) return;

        this.p.background(7, 9, 15);

        for (let cell of this.cells) {
            if (cell.active) {
                this.p.fill(255, 100, 100, 200);
                this.p.shadowBlur = 20;
                this.p.shadowColor = [255, 100, 100];
            } else {
                this.p.fill(30, 40, 60, 80);
                this.p.shadowBlur = 0;
            }
            this.p.stroke(100, 150, 200, 50);
            this.p.strokeWeight(1);
            this.p.rect(cell.x, cell.y, cell.w, cell.h);
        }

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${this.score}`, this.p.width / 2, 20);

        this.p.textSize(14);
        this.p.fill(150);
        this.p.text("Click the glowing squares!", this.p.width / 2, this.p.height - 20);
    }

    cleanup() {
        this.active = false;
        this.p.mousePressed = null;
    }
}

// =========================
// Game 2: Flow Path
// =========================

class FlowGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.pathPoints = [];
        this.totalPoints = 0;
        this.onPathCount = 0;

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        // Create winding path
        for (let t = 0; t <= 1; t += 0.02) {
            const x = 50 + this.p.width * t;
            const y = 50 + 150 * this.p.sin(t * this.p.PI * 3);
            this.pathPoints.push({ x, y });
        }

        this.totalPoints = this.pathPoints.length;

        this.p.mouseMoved = () => this.checkPosition();
        this.start();
    }

    start() {
        this.active = true;
        this.startTime = Date.now();
    }

    checkPosition() {
        if (!this.active) return;

        const mx = this.p.mouseX;
        const my = this.p.mouseY;

        // Find closest point on path
        let minDist = Infinity;
        for (let point of this.pathPoints) {
            const dist = this.p.dist(mx, my, point.x, point.y);
            if (dist < minDist) minDist = dist;
        }

        if (minDist < 20) {
            this.onPathCount++;
            const newScore = Math.floor((this.onPathCount / this.totalPoints) * 1000);
            if (newScore > this.score) {
                this.score = newScore;
                this.onScore(this.score);
            }
        }
    }

    draw() {
        if (!this.active) return;

        this.p.background(7, 9, 15);

        // Draw path
        this.p.noFill();
        this.p.stroke(100, 200, 150, 150);
        this.p.strokeWeight(4);
        this.p.beginShape();
        for (let point of this.pathPoints) {
            this.p.vertex(point.x, point.y);
        }
        this.p.endShape();

        this.p.stroke(200, 255, 200, 200);
        this.p.strokeWeight(2);
        this.p.beginShape();
        for (let point of this.pathPoints) {
            this.p.vertex(point.x, point.y);
        }
        this.p.endShape();

        // Draw mouse cursor indicator
        this.p.noStroke();
        this.p.fill(255, 200, 100, 100);
        this.p.circle(this.p.mouseX, this.p.mouseY, 15);

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${this.score}`, this.p.width / 2, 20);

        this.p.textSize(14);
        this.p.fill(150);
        this.p.text("Stay on the glowing path!", this.p.width / 2, this.p.height - 20);
    }

    cleanup() {
        this.active = false;
        this.p.mouseMoved = null;
    }
}

// =========================
// Game 3: Pulse Keeper
// =========================

class PulseGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.pulseSize = 0;
        this.pulsePhase = 0;
        this.lastPulse = 0;
        this.perfectHits = 0;

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        this.p.mousePressed = () => this.handleClick();
        this.start();
    }

    start() {
        this.active = true;
        this.startTime = Date.now();
    }

    handleClick() {
        if (!this.active) return;

        const currentPulse = this.pulseSize;
        const targetPulse = 1.0;
        const error = Math.abs(currentPulse - targetPulse);

        let points = 0;
        if (error < 0.1) {
            points = 100;
            this.perfectHits++;
        } else if (error < 0.2) {
            points = 50;
        } else if (error < 0.3) {
            points = 25;
        }

        this.score += points;
        this.onScore(this.score);
    }

    draw() {
        if (!this.active) return;

        this.p.background(7, 9, 15);

        const centerX = this.p.width / 2;
        const centerY = this.p.height / 2;

        // Pulse animation
        this.pulsePhase += 0.03;
        this.pulseSize = 0.5 + Math.sin(this.pulsePhase) * 0.5;

        // Draw rings
        for (let i = 0; i < 3; i++) {
            const ringSize = 80 + i * 50;
            this.p.noFill();
            this.p.stroke(100, 150, 200, 50 - i * 15);
            this.p.strokeWeight(2);
            this.p.circle(centerX, centerY, ringSize);
        }

        // Draw pulse
        const pulseRadius = 60 + this.pulseSize * 40;
        this.p.noFill();
        this.p.stroke(255, 100, 150, 200);
        this.p.strokeWeight(3);
        this.p.circle(centerX, centerY, pulseRadius);

        // Draw target zone
        this.p.noFill();
        this.p.stroke(100, 255, 150, 100);
        this.p.strokeWeight(2);
        this.p.circle(centerX, centerY, 100);

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${this.score}`, this.p.width / 2, 20);

        this.p.textSize(14);
        this.p.fill(150);
        this.p.text("Click when the pulse is inside the green ring!", this.p.width / 2, this.p.height - 20);
    }

    cleanup() {
        this.active = false;
        this.p.mousePressed = null;
    }
}

// =========================
// Game 4: Memory Trace
// =========================

class MemoryGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.sequence = [];
        this.playerInput = [];
        this.showingSequence = true;
        this.sequenceIndex = 0;
        this.buttons = [];

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        // Create buttons
        const colors = [
            { color: [255, 100, 100], name: "red", x: 150, y: 150 },
            { color: [100, 255, 100], name: "green", x: 450, y: 150 },
            { color: [100, 100, 255], name: "blue", x: 150, y: 250 },
            { color: [255, 255, 100], name: "yellow", x: 450, y: 250 }
        ];

        colors.forEach((c, i) => {
            this.buttons.push({
                ...c,
                width: 80,
                height: 80,
                active: false
            });
        });

        this.p.mousePressed = () => this.handleClick();
        this.generateSequence();
        this.start();
    }

    generateSequence() {
        for (let i = 0; i < 5; i++) {
            this.sequence.push(Math.floor(Math.random() * 4));
        }
    }

    start() {
        this.active = true;
        this.showSequence();
    }

    showSequence() {
        this.showingSequence = true;
        let i = 0;

        const showNext = () => {
            if (i >= this.sequence.length) {
                setTimeout(() => {
                    this.showingSequence = false;
                }, 500);
                return;
            }

            const btnIndex = this.sequence[i];
            this.buttons[btnIndex].active = true;
            setTimeout(() => {
                this.buttons[btnIndex].active = false;
                i++;
                setTimeout(showNext, 400);
            }, 300);
        };

        showNext();
    }

    handleClick() {
        if (!this.active || this.showingSequence) return;

        const mx = this.p.mouseX;
        const my = this.p.mouseY;

        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            if (mx >= btn.x && mx <= btn.x + btn.width &&
                my >= btn.y && my <= btn.y + btn.height) {

                this.playerInput.push(i);
                btn.active = true;
                setTimeout(() => { btn.active = false; }, 200);

                // Check if correct
                const expected = this.sequence[this.playerInput.length - 1];
                if (i === expected) {
                    this.score += 20;
                    this.onScore(this.score);
                } else {
                    this.score = Math.max(0, this.score - 10);
                    this.onScore(this.score);
                }

                // Check if sequence complete
                if (this.playerInput.length === this.sequence.length) {
                    this.active = false;
                    setTimeout(() => this.onComplete(), 1000);
                }

                break;
            }
        }
    }

    draw() {
        if (!this.active && this.playerInput.length === this.sequence.length) return;

        this.p.background(7, 9, 15);

        for (let btn of this.buttons) {
            if (btn.active) {
                this.p.fill(btn.color[0], btn.color[1], btn.color[2], 255);
                this.p.shadowBlur = 20;
            } else {
                this.p.fill(btn.color[0], btn.color[1], btn.color[2], 100);
                this.p.shadowBlur = 0;
            }
            this.p.rect(btn.x, btn.y, btn.width, btn.height, 12);
        }

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${this.score}`, this.p.width / 2, 20);

        if (this.showingSequence) {
            this.p.textSize(18);
            this.p.fill(200, 200, 100);
            this.p.text("Watch the sequence...", this.p.width / 2, this.p.height - 30);
        } else {
            this.p.textSize(14);
            this.p.fill(150);
            this.p.text("Repeat the pattern by clicking the colored squares!", this.p.width / 2, this.p.height - 20);
        }
    }

    cleanup() {
        this.active = false;
        this.p.mousePressed = null;
    }
}

// =========================
// Game 5: Balance Orb
// =========================

class BalanceGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.orbX = 0;
        this.orbY = 0;
        this.targetX = 0;
        this.targetY = 0;

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        this.targetX = this.p.width / 2;
        this.targetY = this.p.height / 2;

        this.p.mouseMoved = () => this.updateOrb();
        this.start();
    }

    start() {
        this.active = true;
        this.startTime = Date.now();
    }

    updateOrb() {
        if (!this.active) return;

        this.orbX = this.p.mouseX;
        this.orbY = this.p.mouseY;

        const distance = this.p.dist(this.orbX, this.orbY, this.targetX, this.targetY);
        const maxDist = 150;

        if (distance < 30) {
            this.score += 2;
        } else if (distance < 60) {
            this.score += 1;
        } else {
            this.score = Math.max(0, this.score - 0.5);
        }

        this.score = Math.min(1000, this.score);
        this.onScore(Math.floor(this.score));
    }

    draw() {
        if (!this.active) return;

        this.p.background(7, 9, 15);

        const centerX = this.p.width / 2;
        const centerY = this.p.height / 2;

        // Draw target rings
        for (let i = 0; i < 4; i++) {
            const radius = 30 + i * 15;
            this.p.noFill();
            this.p.stroke(100, 200, 150, 100 - i * 20);
            this.p.strokeWeight(2);
            this.p.circle(centerX, centerY, radius * 2);
        }

        // Draw orb
        const distance = this.p.dist(this.orbX, this.orbY, centerX, centerY);
        const intensity = Math.max(0, 1 - distance / 150);

        this.p.noStroke();
        this.p.fill(100, 200, 255, 150 + intensity * 100);
        this.p.circle(this.orbX, this.orbY, 30);

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${Math.floor(this.score)}`, this.p.width / 2, 20);

        this.p.textSize(14);
        this.p.fill(150);
        this.p.text("Keep the orb inside the center ring!", this.p.width / 2, this.p.height - 20);
    }

    cleanup() {
        this.active = false;
        this.p.mouseMoved = null;
    }
}

// =========================
// Game 6: Chaos Trigger
// =========================

class ChaosGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.targets = [];

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        this.p.mousePressed = () => this.handleClick();
        this.start();
    }

    start() {
        this.active = true;
        this.spawnTimer = setInterval(() => this.spawnTarget(), 500);
    }

    spawnTarget() {
        if (!this.active) return;

        this.targets.push({
            x: Math.random() * (this.p.width - 60) + 30,
            y: Math.random() * (this.p.height - 60) + 30,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            size: 40,
            life: 200
        });
    }

    handleClick() {
        if (!this.active) return;

        const mx = this.p.mouseX;
        const my = this.p.mouseY;

        for (let i = 0; i < this.targets.length; i++) {
            const t = this.targets[i];
            const dist = this.p.dist(mx, my, t.x, t.y);

            if (dist < t.size / 2) {
                this.targets.splice(i, 1);
                this.score += 10;
                this.onScore(this.score);
                break;
            }
        }
    }

    draw() {
        if (!this.active) return;

        this.p.background(7, 9, 15);

        // Update and draw targets
        for (let i = 0; i < this.targets.length; i++) {
            const t = this.targets[i];
            t.x += t.vx;
            t.y += t.vy;
            t.life--;

            // Bounce off walls
            if (t.x < t.size/2 || t.x > this.p.width - t.size/2) t.vx *= -1;
            if (t.y < t.size/2 || t.y > this.p.height - t.size/2) t.vy *= -1;

            if (t.life <= 0) {
                this.targets.splice(i, 1);
                i--;
                continue;
            }

            const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
            this.p.fill(255, 100, 100, 150);
            this.p.noStroke();
            this.p.circle(t.x, t.y, t.size * pulse);
        }

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${this.score}`, this.p.width / 2, 20);

        this.p.textSize(14);
        this.p.fill(150);
        this.p.text("Click the moving targets!", this.p.width / 2, this.p.height - 20);
    }

    cleanup() {
        this.active = false;
        if (this.spawnTimer) clearInterval(this.spawnTimer);
        this.p.mousePressed = null;
    }
}

// =========================
// Game 7: Zen Scroll
// =========================

class ZenGame {
    constructor(p, container, onScore, onComplete) {
        this.p = p;
        this.container = container;
        this.onScore = onScore;
        this.onComplete = onComplete;
        this.score = 0;
        this.active = false;
        this.scrollY = 0;
        this.targetY = 0;
        this.lastScrollTime = 0;

        this.setup();
    }

    setup() {
        this.container.innerHTML = '';
        const canvas = this.p.createCanvas(600, 400);
        canvas.parent(this.container);

        this.targetY = this.p.height / 2;

        window.addEventListener('wheel', (e) => this.handleScroll(e), { passive: false });
        this.start();
    }

    start() {
        this.active = true;
        this.startTime = Date.now();
    }

    handleScroll(e) {
        if (!this.active) return;

        e.preventDefault();

        const now = Date.now();
        const delta = e.deltaY;

        this.scrollY += delta;
        this.scrollY = Math.max(0, Math.min(this.p.height, this.scrollY));

        const distance = Math.abs(this.scrollY - this.targetY);
        const idealDistance = Math.sin(now * 0.002) * 100 + 150;

        if (distance < 30) {
            this.score += 5;
        } else if (distance < 80) {
            this.score += 2;
        } else {
            this.score = Math.max(0, this.score - 1);
        }

        this.score = Math.min(1000, this.score);
        this.onScore(Math.floor(this.score));

        this.lastScrollTime = now;
    }

    draw() {
        if (!this.active) return;

        this.p.background(7, 9, 15);

        const now = Date.now();
        this.targetY = this.p.height / 2 + Math.sin(now * 0.002) * 80;

        // Draw target zone
        this.p.noFill();
        this.p.stroke(100, 200, 150, 100);
        this.p.strokeWeight(3);
        this.p.line(0, this.targetY, this.p.width, this.targetY);

        // Draw scroll indicator
        this.p.fill(100, 200, 150, 100);
        this.p.noStroke();
        this.p.circle(50, this.scrollY, 15);

        this.p.fill(255);
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.TOP);
        this.p.text(`Score: ${Math.floor(this.score)}`, this.p.width / 2, 20);

        this.p.textSize(14);
        this.p.fill(150);
        this.p.text("Scroll to follow the moving line!", this.p.width / 2, this.p.height - 20);
    }

    cleanup() {
        this.active = false;
        window.removeEventListener('wheel', this.handleScroll);
    }
}

// =========================
// Main Application
// =========================

let currentGameIndex = 0;
let gameScores = [];
let gameInstance = null;
let currentGameContainer = null;
let gameTimer = null;

const screens = {
    intro: document.getElementById("screen-intro"),
    instructions: document.getElementById("screen-instructions"),
    gameArena: document.getElementById("screen-game-arena"),
    gameComplete: document.getElementById("screen-game-complete"),
    generating: document.getElementById("screen-generating"),
    result: document.getElementById("screen-result"),
};

const beginBtn = document.getElementById("begin-btn");
const backBtn = document.getElementById("back-btn");
const startGamesBtn = document.getElementById("start-games-btn");
const skipGameBtn = document.getElementById("skip-game-btn");
const nextGameBtn = document.getElementById("next-game-btn");
const restartBtn = document.getElementById("restart-btn");
const saveArtworkBtn = document.getElementById("save-artwork-btn");

const gameCounter = document.getElementById("game-counter");
const gameProgressFill = document.getElementById("game-progress-fill");
const currentScoreEl = document.getElementById("current-score");
const gameInstructionText = document.getElementById("game-instruction-text");
const gameCanvasContainer = document.getElementById("game-canvas-container");
const completeGameName = document.getElementById("complete-game-name");
const completeGameScore = document.getElementById("complete-game-score");
const completeGameFeedback = document.getElementById("complete-game-feedback");
const portraitTitle = document.getElementById("portrait-title");
const portraitInterpretation = document.getElementById("portrait-interpretation");
const archetypeName = document.getElementById("archetype-name");
const gameScoresGrid = document.getElementById("game-scores-grid");
const behavioralInsights = document.getElementById("behavioral-insights");
const generatingMessage = document.getElementById("generating-message");
const submitStatusText = document.getElementById("submit-status-text");
const portraitCanvasWrap = document.getElementById("portrait-canvas-wrap");

let portraitSketchInstance = null;
let appFeatures = null;
let appSeed = null;
let appPalette = null;
let appPercentiles = null;
let appInterpretation = null;

function showScreen(screenKey) {
    Object.values(screens).forEach(screen => screen.classList.remove("active"));
    screens[screenKey].classList.add("active");
}

function updateGameProgress() {
    const progress = (currentGameIndex / GAMES.length) * 100;
    gameProgressFill.style.width = `${progress}%`;
    gameCounter.textContent = `Game ${currentGameIndex + 1}/${GAMES.length}`;
}

function startGame() {
    if (gameInstance) {
        gameInstance.cleanup();
        gameInstance = null;
    }

    const game = GAMES[currentGameIndex];
    gameInstructionText.textContent = game.instructions;
    currentScoreEl.textContent = `Score: 0`;

    gameScores[currentGameIndex] = { id: game.id, name: game.name, score: 0 };

    const p5Instance = new p5((p) => {
        p.setup = () => {
            gameInstance = game.createGame(p, gameCanvasContainer, (score) => {
                currentScoreEl.textContent = `Score: ${score}`;
                gameScores[currentGameIndex].score = score;
            }, () => {
                clearTimeout(gameTimer);
                showGameComplete();
            });
        };

        p.draw = () => {
            if (gameInstance && gameInstance.draw) {
                gameInstance.draw();
            }
        };
    });

    gameTimer = setTimeout(() => {
        if (gameInstance) {
            gameInstance.cleanup();
            showGameComplete();
        }
    }, game.duration);
}

function showGameComplete() {
    if (gameInstance) {
        gameInstance.cleanup();
        gameInstance = null;
    }

    const game = GAMES[currentGameIndex];
    const score = gameScores[currentGameIndex].score;

    completeGameName.textContent = `${game.icon} ${game.name}`;
    completeGameScore.textContent = `Your score: ${score}`;

    let feedback = "";
    if (score > 800) feedback = "Outstanding! You're a natural! ✨";
    else if (score > 500) feedback = "Great job! Very impressive! 🌟";
    else if (score > 300) feedback = "Good effort! Keep going! 👍";
    else feedback = "Keep practicing! You'll get better! 💪";

    completeGameFeedback.textContent = feedback;

    showScreen("gameComplete");
}

function nextGame() {
    currentGameIndex++;

    if (currentGameIndex >= GAMES.length) {
        generateArtwork();
    } else {
        showScreen("gameArena");
        startGame();
    }
}

async function generateArtwork() {
    showScreen("generating");

    // Calculate overall behavioral profile from game scores
    const profile = {
        reaction: gameScores[0]?.score || 0,
        flow: gameScores[1]?.score || 0,
        pulse: gameScores[2]?.score || 0,
        memory: gameScores[3]?.score || 0,
        balance: gameScores[4]?.score || 0,
        chaos: gameScores[5]?.score || 0,
        zen: gameScores[6]?.score || 0
    };

    // Generate features based on game performance
    const features = {
        duration_sec: 30,
        path_length: profile.chaos * 5 + profile.reaction * 2,
        avg_speed: (profile.reaction + profile.chaos) / 100,
        speed_variance: profile.chaos / 500 + profile.pulse / 1000,
        click_count: Math.floor(profile.reaction / 50 + profile.chaos / 30),
        scroll_depth: profile.zen * 2,
        hover_diversity: Math.floor(profile.memory / 100 + 3),
        coverage_ratio: profile.flow / 1000,
        pause_count: Math.floor(profile.balance / 100 + 2),
        avg_pause_duration_ms: profile.zen * 2 + profile.balance,
        center_bias: profile.balance / 1000,
        direction_entropy: profile.chaos / 500 + profile.reaction / 500,
        model_type: determineArchetype(profile)
    };

    features.path_length = Math.min(18000, features.path_length);
    features.avg_speed = Math.min(0.05, features.avg_speed);
    features.speed_variance = Math.min(0.02, features.speed_variance);
    features.scroll_depth = Math.min(1800, features.scroll_depth);
    features.coverage_ratio = Math.min(1, features.coverage_ratio);
    features.center_bias = Math.min(1, features.center_bias);
    features.direction_entropy = Math.min(3, features.direction_entropy);

    const palette = buildPalette(features, features.model_type);
    const interpretation = buildInterpretation(features, features.model_type);
    const seed = Math.floor(Math.random() * 900000) + 100000;

    appFeatures = features;
    appSeed = seed;
    appPalette = palette;
    appInterpretation = interpretation;

    renderGameScores();
    renderBehavioralInsights(profile);

    portraitTitle.textContent = modelTitle(features.model_type);
    portraitInterpretation.textContent = interpretation;
    archetypeName.textContent = modelTitle(features.model_type);

    setTimeout(() => {
        showScreen("result");
        renderPortrait();
    }, 800);
}

function determineArchetype(profile) {
    const maxScore = Math.max(...Object.values(profile));

    if (profile.reaction === maxScore && profile.reaction > 600) return "glitch";
    if (profile.flow === maxScore && profile.flow > 600) return "flowfield";
    if (profile.pulse === maxScore && profile.pulse > 600) return "particle";
    if (profile.memory === maxScore && profile.memory > 600) return "constellation";
    if (profile.balance === maxScore && profile.balance > 600) return "halo";
    if (profile.chaos === maxScore && profile.chaos > 600) return "glitch";
    if (profile.zen === maxScore && profile.zen > 600) return "flowfield";

    return "particle";
}

function modelTitle(modelType) {
    const map = {
        particle: "Particle Field",
        constellation: "Constellation Archive",
        glitch: "Glitch Signal",
        flowfield: "Flow Field",
        halo: "Halo Orbit",
    };
    return map[modelType] || "Behavioral Portrait";
}

function buildPalette(features, modelType) {
    const palettes = {
        constellation: { background: "#06080f", warm: "#f6c177", cool: "#89b4fa", accent: "#cba6f7", soft: "#94e2d5" },
        glitch: { background: "#07070c", warm: "#ffb86c", cool: "#8be9fd", accent: "#ff79c6", soft: "#bd93f9" },
        flowfield: { background: "#061018", warm: "#f9c74f", cool: "#4cc9f0", accent: "#90e0ef", soft: "#ade8f4" },
        halo: { background: "#090b12", warm: "#ffd6a5", cool: "#a0c4ff", accent: "#bdb2ff", soft: "#caffbf" },
        particle: { background: "#07090f", warm: "#f6c177", cool: "#7aa2f7", accent: "#c4b5fd", soft: "#9ccfd8" },
    };

    return palettes[modelType] || palettes.particle;
}

function buildInterpretation(features, modelType) {
    const interpretations = {
        constellation: "A contemplative trace shaped by memory and precision. Your pattern recognition created constellations of meaning.",
        glitch: "A volatile trace driven by speed and chaos. Your quick reactions created glitches in the fabric of the interface.",
        flowfield: "An exploratory trace flowing with grace and consistency. Your smooth movements created fluid pathways.",
        halo: "A focused trace orbiting around balance. Your steady control created a halo of concentrated energy.",
        particle: "A balanced trace blending all aspects of interaction. Your diverse gameplay created a harmonious particle field."
    };

    return interpretations[modelType] || interpretations.particle;
}

function renderGameScores() {
    const scoresHtml = gameScores.map(game => `
        <div class="metric-row">
            <span class="metric-label">${game.icon} ${game.name}</span>
            <strong class="metric-value">${game.score}</strong>
        </div>
    `).join("");

    gameScoresGrid.innerHTML = scoresHtml;
}

function renderBehavioralInsights(profile) {
    const insights = [];

    if (profile.reaction > 600) insights.push("⚡ Lightning-fast reflexes");
    if (profile.flow > 600) insights.push("🌀 Smooth and fluid movement");
    if (profile.pulse > 600) insights.push("💓 Perfect rhythm sensitivity");
    if (profile.memory > 600) insights.push("🧠 Excellent pattern recognition");
    if (profile.balance > 600) insights.push("⚖️ Exceptional control and balance");
    if (profile.chaos > 600) insights.push("💥 Thrives in chaotic situations");
    if (profile.zen > 600) insights.push("🧘 Meditative and patient");

    if (insights.length === 0) insights.push("🌱 Balanced across all dimensions");

    behavioralInsights.innerHTML = `
        <p class="eyebrow">Your strengths</p>
        ${insights.map(i => `<div class="insight-item">${i}</div>`).join("")}
    `;
}

function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function portraitConfigFromFeatures(features) {
    const modelType = features.model_type || "particle";

    const base = {
        particleCount: Math.floor(80 + features.path_length / 200),
        clickBursts: Math.floor(features.click_count),
        pauseNodes: Math.floor(features.pause_count),
        turbulence: features.speed_variance * 100,
        drift: features.scroll_depth / 1500,
        spread: 80 + features.coverage_ratio * 200,
        centerPull: features.center_bias * 0.02,
        trailAlpha: 26,
        starCount: 100,
    };

    if (modelType === "constellation") {
        base.particleCount = Math.floor(base.particleCount * 0.7);
        base.pauseNodes += 3;
        base.turbulence *= 0.5;
        base.starCount = 160;
    } else if (modelType === "glitch") {
        base.particleCount = Math.floor(base.particleCount * 1.2);
        base.clickBursts += 4;
        base.turbulence *= 1.5;
        base.trailAlpha = 38;
    } else if (modelType === "flowfield") {
        base.spread *= 1.2;
        base.drift *= 1.3;
        base.centerPull *= 0.6;
        base.starCount = 80;
    } else if (modelType === "halo") {
        base.particleCount = Math.floor(base.particleCount * 0.8);
        base.spread *= 0.85;
        base.centerPull *= 1.4;
        base.turbulence *= 0.7;
    }

    return base;
}

function buildSceneState(p, width, height, features, seed, palette) {
    const cfg = portraitConfigFromFeatures(features);
    const bg = hexToRgb(palette.background);
    const warm = hexToRgb(palette.warm);
    const cool = hexToRgb(palette.cool);
    const accent = hexToRgb(palette.accent);
    const soft = hexToRgb(palette.soft);

    p.randomSeed(seed);
    p.noiseSeed(seed);

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
            radius: p.random(20, 55),
        });
    }

    for (let i = 0; i < Math.max(3, cfg.clickBursts); i++) {
        const angle = p.random(p.TWO_PI);
        const radius = p.random(20, cfg.spread * 1.05);
        bursts.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            radius: p.random(35, 120),
            phase: p.random(0, 10),
        });
    }

    for (let i = 0; i < cfg.particleCount; i++) {
        const angle = p.random(p.TWO_PI);
        const radius = p.random(10, cfg.spread);
        const mix = p.random();
        const color = {
            r: p.lerp(mix < 0.45 ? cool.r : warm.r, mix < 0.45 ? accent.r : soft.r, p.random(0.15, 0.85)),
            g: p.lerp(mix < 0.45 ? cool.g : warm.g, mix < 0.45 ? accent.g : soft.g, p.random(0.15, 0.85)),
            b: p.lerp(mix < 0.45 ? cool.b : warm.b, mix < 0.45 ? accent.b : soft.b, p.random(0.15, 0.85))
        };

        let vx = p.random(-0.8, 0.8);
        let vy = p.random(-0.8, 0.8);

        if (features.model_type === "flowfield") {
            vx = p.random(-0.4, 0.4);
            vy = p.random(-0.9, 0.9);
        } else if (features.model_type === "halo") {
            vx = -Math.sin(angle) * p.random(0.3, 0.85);
            vy = Math.cos(angle) * p.random(0.2, 0.65);
        }

        particles.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            vx, vy,
            size: p.random(1.5, 4.8),
            alpha: p.random(60, 180),
            color,
        });
    }

    return { cfg, bg, warm, cool, accent, soft, nodes, bursts, particles, cx, cy };
}

function stepAndDrawScene(p, scene, frameNumber, width, height, features, isStatic = false) {
    const { cfg, bg, warm, cool, accent, soft, nodes, bursts, particles, cx, cy } = scene;
    const modelType = features.model_type || "particle";

    if (!isStatic) {
        p.background(bg.r, bg.g, bg.b, cfg.trailAlpha);
    } else {
        p.background(bg.r, bg.g, bg.b);
    }

    nodes.forEach((n, index) => {
        const pulse = Math.sin(frameNumber * 0.03 + index) * 5;
        p.noStroke();
        p.fill(soft.r, soft.g, soft.b, modelType === "constellation" ? 12 : 16);
        p.circle(n.x, n.y, n.radius * 2.4 + pulse);
        p.fill(accent.r, accent.g, accent.b, 24);
        p.circle(n.x, n.y, n.radius * 1.2 + pulse * 0.3);
    });

    bursts.forEach((b, i) => {
        p.noFill();
        p.strokeWeight(modelType === "glitch" ? 1.2 : 0.8);
        p.stroke(warm.r, warm.g, warm.b, 16);
        p.circle(b.x, b.y, b.radius + Math.sin(frameNumber * 0.03 + b.phase + i) * 10);
        p.stroke(cool.r, cool.g, cool.b, 12);
        p.circle(b.x, b.y, b.radius * 0.6 + Math.cos(frameNumber * 0.04 + b.phase + i) * 8);
    });

    particles.forEach((pt, index) => {
        if (modelType === "halo") {
            const dx = pt.x - cx;
            const dy = pt.y - cy;
            pt.vx += (-dy) * 0.0009;
            pt.vy += (dx) * 0.0009;
        } else {
            const dx = cx - pt.x;
            const dy = cy - pt.y;
            pt.vx += dx * cfg.centerPull;
            pt.vy += dy * cfg.centerPull;
        }

        const noiseAngle = p.noise(pt.x * 0.003, pt.y * 0.003, frameNumber * 0.004) * p.TWO_PI * 2;
        pt.vx += Math.cos(noiseAngle) * 0.02 * cfg.turbulence;
        pt.vy += Math.sin(noiseAngle) * 0.02 * cfg.turbulence;

        pt.vy += cfg.drift * 0.003;

        if (modelType === "glitch" && index % 15 === 0) {
            pt.x += Math.sin(frameNumber * 0.16 + index) * 1.5;
        }

        pt.vx *= modelType === "constellation" ? 0.989 : 0.985;
        pt.vy *= modelType === "constellation" ? 0.989 : 0.985;

        const prevX = pt.x;
        const prevY = pt.y;

        pt.x += pt.vx;
        pt.y += pt.vy;

        p.stroke(pt.color.r, pt.color.g, pt.color.b, pt.alpha * (modelType === "constellation" ? 0.4 : 0.32));
        p.strokeWeight(pt.size * (modelType === "glitch" ? 0.6 : 0.52));
        p.line(prevX, prevY, pt.x, pt.y);

        p.noStroke();
        p.fill(pt.color.r, pt.color.g, pt.color.b, pt.alpha);
        p.circle(pt.x, pt.y, pt.size);

        if (pt.x < -60 || pt.x > width + 60 || pt.y < -60 || pt.y > height + 60) {
            pt.x = cx + p.random(-cfg.spread * 0.5, cfg.spread * 0.5);
            pt.y = cy + p.random(-cfg.spread * 0.5, cfg.spread * 0.5);
            pt.vx = p.random(-0.6, 0.6);
            pt.vy = p.random(-0.6, 0.6);
        }
    });

    p.noFill();
    p.stroke(255, 255, 255, 10);
    p.strokeWeight(0.8);
    p.ellipse(cx, cy, cfg.spread * 1.6, cfg.spread * 1.15);
    p.ellipse(cx, cy, cfg.spread * 0.95, cfg.spread * 0.72);

    for (let i = 0; i < cfg.starCount; i++) {
        const gx = p.random(width);
        const gy = p.random(height);
        p.stroke(255, 255, 255, modelType === "constellation" ? 10 : 8);
        p.point(gx, gy);
    }
}

function createPortraitSketch(features, seed, palette) {
    const containerWidth = portraitCanvasWrap.clientWidth || 800;
    const containerHeight = portraitCanvasWrap.clientHeight || 560;

    return new p5((p) => {
        let scene = null;

        p.setup = () => {
            p.createCanvas(containerWidth, containerHeight);
            p.pixelDensity(2);
            scene = buildSceneState(p, p.width, p.height, features, seed, palette);
        };

        p.draw = () => {
            if (!scene) return;
            stepAndDrawScene(p, scene, p.frameCount, p.width, p.height, features, false);
        };

        p.windowResized = () => {
            p.resizeCanvas(containerWidth, containerHeight);
            scene = buildSceneState(p, p.width, p.height, features, seed, palette);
        };
    }, portraitCanvasWrap);
}

function renderPortrait() {
    if (!appFeatures || !appSeed || !appPalette) return;

    if (portraitSketchInstance) {
        portraitSketchInstance.remove();
        portraitSketchInstance = null;
    }

    portraitCanvasWrap.innerHTML = "";
    portraitSketchInstance = createPortraitSketch(appFeatures, appSeed, appPalette);
}

function saveArtwork() {
    if (portraitSketchInstance) {
        portraitSketchInstance.saveCanvas(`data-trace-${Date.now()}`, "png");
    }
}

// Event Listeners
beginBtn.addEventListener("click", () => showScreen("instructions"));
backBtn.addEventListener("click", () => showScreen("intro"));
startGamesBtn.addEventListener("click", () => {
    currentGameIndex = 0;
    gameScores = [];
    updateGameProgress();
    showScreen("gameArena");
    startGame();
});
skipGameBtn.addEventListener("click", () => showGameComplete());
nextGameBtn.addEventListener("click", () => nextGame());
restartBtn.addEventListener("click", () => {
    showScreen("intro");
    if (portraitSketchInstance) {
        portraitSketchInstance.remove();
        portraitSketchInstance = null;
    }
});
saveArtworkBtn.addEventListener("click", saveArtwork);