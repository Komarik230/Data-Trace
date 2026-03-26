from flask import Flask, render_template, jsonify, request
import uuid
import math
import random
import sqlite3
from datetime import datetime
from pathlib import Path

app = Flask(__name__)
DB_PATH = "data.db"


# =========================
# Database
# =========================

EXPECTED_COLUMNS = {
    "session_id",
    "duration_sec",
    "path_length",
    "avg_speed",
    "speed_variance",
    "click_count",
    "scroll_depth",
    "hover_diversity",
    "coverage_ratio",
    "pause_count",
    "avg_pause_duration_ms",
    "center_bias",
    "direction_entropy",
    "model_type",
    "created_at",
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_sessions_table(conn):
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        duration_sec REAL,
        path_length REAL,
        avg_speed REAL,
        speed_variance REAL,
        click_count INTEGER,
        scroll_depth REAL,
        hover_diversity INTEGER,
        coverage_ratio REAL,
        pause_count INTEGER,
        avg_pause_duration_ms REAL,
        center_bias REAL,
        direction_entropy REAL,
        model_type TEXT,
        created_at TEXT
    )
    """)
    conn.commit()


def get_existing_columns(conn, table_name):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table_name})")
    rows = cur.fetchall()
    return {row["name"] for row in rows}


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='sessions'
    """)
    exists = cur.fetchone()

    if not exists:
        create_sessions_table(conn)
        conn.close()
        return

    existing_columns = get_existing_columns(conn, "sessions")

    if existing_columns != EXPECTED_COLUMNS:
        cur.execute("DROP TABLE IF EXISTS sessions")
        conn.commit()
        create_sessions_table(conn)

    conn.close()


init_db()


def insert_session_features(session_id, features):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    INSERT OR REPLACE INTO sessions (
        session_id,
        duration_sec,
        path_length,
        avg_speed,
        speed_variance,
        click_count,
        scroll_depth,
        hover_diversity,
        coverage_ratio,
        pause_count,
        avg_pause_duration_ms,
        center_bias,
        direction_entropy,
        model_type,
        created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        session_id,
        features["duration_sec"],
        features["path_length"],
        features["avg_speed"],
        features["speed_variance"],
        features["click_count"],
        features["scroll_depth"],
        features["hover_diversity"],
        features["coverage_ratio"],
        features["pause_count"],
        features["avg_pause_duration_ms"],
        features["center_bias"],
        features["direction_entropy"],
        features["model_type"],
        datetime.utcnow().isoformat()
    ))

    conn.commit()
    conn.close()


def get_all_column_values(column_name):
    allowed = {
        "duration_sec",
        "path_length",
        "avg_speed",
        "speed_variance",
        "click_count",
        "scroll_depth",
        "hover_diversity",
        "coverage_ratio",
        "pause_count",
        "avg_pause_duration_ms",
        "center_bias",
        "direction_entropy",
    }

    if column_name not in allowed:
        return []

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"SELECT {column_name} FROM sessions WHERE {column_name} IS NOT NULL")
    rows = [row[0] for row in cur.fetchall()]
    conn.close()
    return rows


def get_total_sessions_count():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sessions")
    count = cur.fetchone()[0]
    conn.close()
    return count


def percentile_rank(value, values):
    if not values:
        return 50

    less_or_equal = sum(1 for v in values if v <= value)
    return int(round((less_or_equal / len(values)) * 100))


# =========================
# Feature computation
# =========================

def compute_path_length(mouse_events):
    if len(mouse_events) < 2:
        return 0.0

    total = 0.0
    for i in range(1, len(mouse_events)):
        x1, y1 = mouse_events[i - 1]["x"], mouse_events[i - 1]["y"]
        x2, y2 = mouse_events[i]["x"], mouse_events[i]["y"]
        total += math.dist((x1, y1), (x2, y2))
    return total


def compute_avg_speed(mouse_events):
    if len(mouse_events) < 2:
        return 0.0

    total_distance = 0.0
    total_time_ms = 0.0

    for i in range(1, len(mouse_events)):
        prev_ev = mouse_events[i - 1]
        curr_ev = mouse_events[i]

        dt = curr_ev["t"] - prev_ev["t"]
        if dt <= 0:
            continue

        dist = math.dist((prev_ev["x"], prev_ev["y"]), (curr_ev["x"], curr_ev["y"]))
        total_distance += dist
        total_time_ms += dt

    if total_time_ms <= 0:
        return 0.0

    return total_distance / total_time_ms


def compute_speed_variance(mouse_events):
    if len(mouse_events) < 3:
        return 0.0

    speeds = []
    for i in range(1, len(mouse_events)):
        prev_ev = mouse_events[i - 1]
        curr_ev = mouse_events[i]
        dt = curr_ev["t"] - prev_ev["t"]

        if dt <= 0:
            continue

        dist = math.dist((prev_ev["x"], prev_ev["y"]), (curr_ev["x"], curr_ev["y"]))
        speeds.append(dist / dt)

    if len(speeds) < 2:
        return 0.0

    mean_speed = sum(speeds) / len(speeds)
    variance = sum((s - mean_speed) ** 2 for s in speeds) / len(speeds)
    return variance


def compute_scroll_depth(scroll_events):
    if not scroll_events:
        return 0.0
    return max(ev.get("scroll_top", 0) for ev in scroll_events)


def compute_hover_diversity(hover_events):
    zones = {ev.get("zone") for ev in hover_events if ev.get("zone")}
    return len(zones)


def compute_pause_stats(pause_events):
    if not pause_events:
        return 0, 0.0

    count = len(pause_events)
    avg_pause = sum(ev.get("idle_ms", 0) for ev in pause_events) / count
    return count, avg_pause


def compute_coverage_ratio(mouse_events, viewport_w, viewport_h, cell_size=80):
    if not mouse_events or viewport_w <= 0 or viewport_h <= 0:
        return 0.0

    cols = max(1, math.ceil(viewport_w / cell_size))
    rows = max(1, math.ceil(viewport_h / cell_size))
    total_cells = cols * rows

    visited = set()
    for ev in mouse_events:
        col = min(cols - 1, max(0, int(ev["x"] // cell_size)))
        row = min(rows - 1, max(0, int(ev["y"] // cell_size)))
        visited.add((col, row))

    if total_cells <= 0:
        return 0.0

    return len(visited) / total_cells


def compute_center_bias(mouse_events, viewport_w, viewport_h):
    if not mouse_events or viewport_w <= 0 or viewport_h <= 0:
        return 0.0

    cx = viewport_w / 2
    cy = viewport_h / 2
    max_dist = math.dist((0, 0), (cx, cy))

    if max_dist == 0:
        return 0.0

    avg_dist = sum(math.dist((ev["x"], ev["y"]), (cx, cy)) for ev in mouse_events) / len(mouse_events)
    center_score = 1.0 - min(1.0, avg_dist / max_dist)
    return center_score


def compute_direction_entropy(mouse_events):
    if len(mouse_events) < 3:
        return 0.0

    bins = [0] * 8

    for i in range(1, len(mouse_events)):
        dx = mouse_events[i]["x"] - mouse_events[i - 1]["x"]
        dy = mouse_events[i]["y"] - mouse_events[i - 1]["y"]

        if dx == 0 and dy == 0:
            continue

        angle = math.atan2(dy, dx)
        normalized = (angle + math.pi) / (2 * math.pi)
        bin_idx = min(7, int(normalized * 8))
        bins[bin_idx] += 1

    total = sum(bins)
    if total == 0:
        return 0.0

    entropy = 0.0
    for count in bins:
        if count == 0:
            continue
        p = count / total
        entropy -= p * math.log2(p)

    return entropy


def classify_behavior_model(features):
    path_length = features["path_length"]
    pause_count = features["pause_count"]
    speed_variance = features["speed_variance"]
    click_count = features["click_count"]
    coverage_ratio = features["coverage_ratio"]
    center_bias = features["center_bias"]
    scroll_depth = features["scroll_depth"]

    if pause_count >= 4 and speed_variance < 0.0018:
        return "constellation"
    if click_count >= 8 and speed_variance >= 0.0025:
        return "glitch"
    if coverage_ratio >= 0.45 and scroll_depth >= 350:
        return "flowfield"
    if center_bias >= 0.58 and path_length < 5000:
        return "halo"
    return "particle"


def build_palette(features, model_type):
    palettes = {
        "constellation": {
            "background": "#06080f",
            "warm": "#f6c177",
            "cool": "#89b4fa",
            "accent": "#cba6f7",
            "soft": "#94e2d5",
        },
        "glitch": {
            "background": "#07070c",
            "warm": "#ffb86c",
            "cool": "#8be9fd",
            "accent": "#ff79c6",
            "soft": "#bd93f9",
        },
        "flowfield": {
            "background": "#061018",
            "warm": "#f9c74f",
            "cool": "#4cc9f0",
            "accent": "#90e0ef",
            "soft": "#ade8f4",
        },
        "halo": {
            "background": "#090b12",
            "warm": "#ffd6a5",
            "cool": "#a0c4ff",
            "accent": "#bdb2ff",
            "soft": "#caffbf",
        },
        "particle": {
            "background": "#07090f",
            "warm": "#f6c177",
            "cool": "#7aa2f7",
            "accent": "#c4b5fd",
            "soft": "#9ccfd8",
        },
    }

    palette = palettes.get(model_type, palettes["particle"]).copy()

    if features["speed_variance"] > 0.004:
        palette["accent"] = "#ff5ea8"

    if features["pause_count"] >= 5:
        palette["soft"] = "#b8f2e6"

    return palette


def build_interpretation(features, model_type):
    if model_type == "constellation":
        return "A contemplative trace with clustered pauses and stable movement. Like stars forming patterns in the night sky, your interaction created constellations of meaning."
    if model_type == "glitch":
        return "A volatile trace with sharp decisions and unstable motion. Your cursor danced with electric energy, creating glitches in the fabric of the interface."
    if model_type == "flowfield":
        return "An exploratory trace spread widely across the interactive field. Like water finding its path, you explored every corner with fluid curiosity."
    if model_type == "halo":
        return "A concentrated trace orbiting around a stable visual center. Your attention circled like a halo, focused yet dynamic."
    return "A balanced particle trace shaped by rhythm, motion, and attention. Your interaction created a harmonious dance between exploration and focus."


def compute_features(trace):
    mouse = trace.get("mouse", [])
    clicks = trace.get("clicks", [])
    scroll = trace.get("scroll", [])
    hovers = trace.get("hovers", [])
    pauses = trace.get("pauses", [])
    meta = trace.get("meta", {})

    duration_ms = meta.get("duration_ms", 0)
    viewport_w = meta.get("viewport_w", 0)
    viewport_h = meta.get("viewport_h", 0)

    path_length = compute_path_length(mouse)
    avg_speed = compute_avg_speed(mouse)
    speed_variance = compute_speed_variance(mouse)
    scroll_depth = compute_scroll_depth(scroll)
    hover_diversity = compute_hover_diversity(hovers)
    pause_count, avg_pause_duration = compute_pause_stats(pauses)
    coverage_ratio = compute_coverage_ratio(mouse, viewport_w, viewport_h)
    center_bias = compute_center_bias(mouse, viewport_w, viewport_h)
    direction_entropy = compute_direction_entropy(mouse)

    features = {
        "duration_ms": duration_ms,
        "duration_sec": round(duration_ms / 1000, 2),
        "mouse_event_count": len(mouse),
        "click_count": len(clicks),
        "scroll_event_count": len(scroll),
        "hover_event_count": len(hovers),
        "hover_diversity": hover_diversity,
        "pause_count": pause_count,
        "avg_pause_duration_ms": round(avg_pause_duration, 2),
        "path_length": round(path_length, 2),
        "avg_speed": round(avg_speed, 4),
        "speed_variance": round(speed_variance, 6),
        "scroll_depth": round(scroll_depth, 2),
        "coverage_ratio": round(coverage_ratio, 4),
        "center_bias": round(center_bias, 4),
        "direction_entropy": round(direction_entropy, 4),
        "viewport_w": viewport_w,
        "viewport_h": viewport_h,
    }

    model_type = classify_behavior_model(features)
    features["model_type"] = model_type

    return features


def build_percentiles(features):
    return {
        "motion": percentile_rank(features["path_length"], get_all_column_values("path_length")),
        "exploration": percentile_rank(features["coverage_ratio"], get_all_column_values("coverage_ratio")),
        "rhythm": percentile_rank(features["speed_variance"], get_all_column_values("speed_variance")),
        "decisions": percentile_rank(features["click_count"], get_all_column_values("click_count")),
        "contemplation": percentile_rank(features["pause_count"], get_all_column_values("pause_count")),
    }


# =========================
# Routes
# =========================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/start-session", methods=["POST"])
def start_session():
    session_id = str(uuid.uuid4())
    return jsonify({
        "session_id": session_id,
        "started_at": datetime.utcnow().isoformat()
    })


@app.route("/api/submit-trace", methods=["POST"])
def submit_trace():
    data = request.get_json(force=True)

    session_id = data.get("session_id")
    trace = data.get("trace")

    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    if not trace:
        return jsonify({"error": "Missing trace"}), 400

    features = compute_features(trace)
    palette = build_palette(features, features["model_type"])
    interpretation = build_interpretation(features, features["model_type"])
    seed = random.randint(100000, 999999)

    insert_session_features(session_id, features)
    percentiles = build_percentiles(features)
    total_sessions = get_total_sessions_count()

    return jsonify({
        "status": "ok",
        "session_id": session_id,
        "features": features,
        "percentiles": percentiles,
        "seed": seed,
        "palette": palette,
        "interpretation": interpretation,
        "dataset_size": total_sessions,
        "events_received": {
            "mouse": len(trace.get("mouse", [])),
            "clicks": len(trace.get("clicks", [])),
            "scroll": len(trace.get("scroll", [])),
            "hovers": len(trace.get("hovers", [])),
            "pauses": len(trace.get("pauses", [])),
        }
    })


if __name__ == "__main__":
    app.run()