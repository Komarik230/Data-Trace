from flask import Flask, render_template, jsonify, request
import uuid
import math
import random
import sqlite3
from datetime import datetime

app = Flask(__name__)
DB_PATH = "data.db"


# ---------- DB ----------

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        duration REAL,
        path_length REAL,
        avg_speed REAL,
        speed_variance REAL,
        click_count INTEGER,
        scroll_depth REAL,
        hover_diversity INTEGER,
        coverage_ratio REAL,
        pause_count INTEGER,
        avg_pause REAL,
        center_bias REAL,
        created_at TEXT
    )
    """)

    conn.commit()
    conn.close()


init_db()


def insert_features(session_id, f):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        session_id,
        f["duration_sec"],
        f["path_length"],
        f["avg_speed"],
        f["speed_variance"],
        f["click_count"],
        f["scroll_depth"],
        f["hover_diversity"],
        f["coverage_ratio"],
        f["pause_count"],
        f["avg_pause_duration_ms"],
        f["center_bias"],
        datetime.utcnow().isoformat()
    ))

    conn.commit()
    conn.close()


def get_all_values(column):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(f"SELECT {column} FROM sessions")
    rows = [r[0] for r in cur.fetchall() if r[0] is not None]

    conn.close()
    return rows


def percentile(value, values):
    if not values:
        return 50

    less = sum(1 for v in values if v < value)
    return int((less / len(values)) * 100)


# ---------- FEATURES (как было) ----------

def compute_path_length(mouse):
    total = 0
    for i in range(1, len(mouse)):
        total += math.dist(
            (mouse[i-1]["x"], mouse[i-1]["y"]),
            (mouse[i]["x"], mouse[i]["y"])
        )
    return total


def compute_features(trace):
    mouse = trace.get("mouse", [])
    clicks = trace.get("clicks", [])
    scroll = trace.get("scroll", [])
    hovers = trace.get("hovers", [])
    pauses = trace.get("pauses", [])
    meta = trace.get("meta", {})

    duration_ms = meta.get("duration_ms", 0)

    features = {
        "duration_sec": round(duration_ms / 1000, 2),
        "path_length": compute_path_length(mouse),
        "avg_speed": len(mouse) / max(1, duration_ms),
        "speed_variance": len(pauses) * 0.001,
        "click_count": len(clicks),
        "scroll_depth": max([s["scroll_top"] for s in scroll], default=0),
        "hover_diversity": len(set(h["zone"] for h in hovers)),
        "coverage_ratio": min(1.0, len(mouse) / 500),
        "pause_count": len(pauses),
        "avg_pause_duration_ms": sum(p.get("idle_ms", 0) for p in pauses) / max(1, len(pauses)),
        "center_bias": random.random(),
    }

    return features


def build_palette():
    return {
        "background": "#07090f",
        "warm": "#f6c177",
        "cool": "#7aa2f7",
        "accent": "#c4b5fd",
        "soft": "#9ccfd8",
    }


# ---------- ROUTES ----------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/start-session", methods=["POST"])
def start_session():
    return jsonify({"session_id": str(uuid.uuid4())})


@app.route("/api/submit-trace", methods=["POST"])
def submit_trace():
    data = request.get_json()
    session_id = data["session_id"]
    trace = data["trace"]

    features = compute_features(trace)
    insert_features(session_id, features)

    # percentiles
    percentiles = {
        "motion": percentile(features["path_length"], get_all_values("path_length")),
        "exploration": percentile(features["coverage_ratio"], get_all_values("coverage_ratio")),
        "rhythm": percentile(features["speed_variance"], get_all_values("speed_variance")),
        "decisions": percentile(features["click_count"], get_all_values("click_count")),
        "contemplation": percentile(features["pause_count"], get_all_values("pause_count")),
    }

    return jsonify({
        "features": features,
        "percentiles": percentiles,
        "seed": random.randint(1, 999999),
        "palette": build_palette()
    })


if __name__ == "__main__":
    app.run(debug=True)