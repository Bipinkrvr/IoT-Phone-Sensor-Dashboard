import subprocess
import csv
import json
import time
import os
from datetime import datetime
from typing import List, Dict, Optional
from collections import deque, defaultdict

from flask import Flask, Response, jsonify, send_file, make_response

# ------------- CONFIG -------------
CSV_PATH = os.path.expanduser("~/redmiedge/data/sensor_log.csv")
WINDOW = 150 # how many samples to keep & stream
INTERVAL = 0.5 # seconds between pushes
WRITE_CSV = True # keep csv history
WRITE_BATCH_SIZE = 20 # How many rows to buffer before writing to disk <<< NEW
HOST = "0.0.0.0"
PORT = 5000
# ----------------------------------

os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

SPECS = {
    "Accelerometer": { "candidates": ["accelerometer"], "axes": ["X", "Y", "Z"] },
    "Gyroscope": { "candidates": ["gyroscope"], "axes": ["X", "Y", "Z"] },
    "Magnetometer": { "candidates": ["magnetometer"], "axes": ["X", "Y", "Z"] },
    "Gravity": { "candidates": ["gravity"], "axes": ["X", "Y", "Z"] },
    "Linear": { "candidates": ["linear acceleration"], "axes": ["X", "Y", "Z"] },
    "Rotation": { "candidates": ["rotation vector"], "axes": ["X", "Y", "Z", "W", "E"] },
    "GameRotation": { "candidates": ["game rotation vector"], "axes": ["X", "Y", "Z", "W"] },
    "GeoRotation": { "candidates": ["geomagnetic rotation vector",
                                       "geomagnetic rotation"], "axes": ["X", "Y", "Z", "W"] },
    "Orientation": { "candidates": ["orientation"], "axes": ["Azimuth", "Pitch", "Roll"] },
    "Light": { "candidates": ["light", "alsps"], "axes": ["Lux"] },
    "Proximity": { "candidates": ["proximity", "alsps"], "axes": ["Distance"] },
    "Step": { "candidates": ["step counter"], "axes": ["Count"] },
}
IMPORTANT_SENSORS = set(SPECS.keys())

COLUMN_NAMES = ["timestamp"]
for group, spec in SPECS.items():
    for ax in spec["axes"]:
        COLUMN_NAMES.append(f"{group}_{ax}")

if WRITE_CSV:
    with open(CSV_PATH, "w", newline="") as f:
        csv.writer(f).writerow(COLUMN_NAMES)

# Buffer for streaming (fast, in-memory)
buffer = deque(maxlen=WINDOW)
# Buffer for batch-writing to CSV (to avoid I/O contention)
csv_write_buffer = [] # <<< NEW


# <<< NEW: Function to flush the CSV buffer to disk
def flush_csv_buffer():
    """Writes any remaining rows in the csv_write_buffer to the file."""
    if WRITE_CSV and csv_write_buffer:
        print(f"[logger] Flushing {len(csv_write_buffer)} remaining rows to CSV...")
        try:
            with open(CSV_PATH, "a", newline="") as f:
                csv.writer(f).writerows(csv_write_buffer)
            csv_write_buffer.clear()
            print("[logger] ...Flush complete.")
        except Exception as e:
            print(f"[logger] Error flushing CSV buffer: {e}")
    else:
        print("[logger] No CSV data to flush.")


def list_device_sensors() -> List[str]:
    try:
        out = subprocess.check_output(["termux-sensor", "-l"], text=True)
        try:
            j = json.loads(out)
            if isinstance(j, dict) and "sensors" in j and isinstance(j["sensors"], list):
                return j["sensors"]
        except Exception:
            pass
        sensors = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            name = line.split(":", 1)[0].strip() if ":" in line else line
            sensors.append(name)
        return sensors
    except Exception as e:
        print(f"[logger] Could not list sensors: {e}")
        return []

def match_sensor(sensor_list: List[str], candidates: List[str]) -> Optional[str]:
    for term in candidates:
        for s in sensor_list:
            if term.lower() in s.lower():
                return s
    return None

def build_mapping(sensor_list: List[str]) -> Dict[str, Optional[str]]:
    m = {}
    for group, spec in SPECS.items():
        m[group] = match_sensor(sensor_list, spec["candidates"])
    return m

def fetch_values(sensor_names: List[str]) -> Dict[str, Dict]:
    if not sensor_names:
        return {}
    try:
        result = subprocess.check_output(
            ["termux-sensor", "-s", ",".join(sensor_names), "-n", "1"],
            text=True
        )
        return json.loads(result)
    except Exception as e:
        print(f"[logger] termux-sensor call failed: {e}")
        return {}

def pad(vals, n):
    vals = list(vals)[:n]
    while len(vals) < n:
        vals.append(0)
    return vals

def normalize(col: str):
    if "_" in col:
        sensor, axis = col.split("_", 1)
    else:
        sensor, axis = col, "X"

    if sensor.startswith("Linear"):
        sensor = "Linear"
    elif sensor.startswith("Rotation"):
        sensor = "Rotation"
    elif sensor.startswith("GameRotation"):
        sensor = "GameRotation"
    elif sensor.startswith("GeoRotation"):
        sensor = "GeoRotation"
    elif sensor.startswith("Accelerometer"):
        sensor = "Accelerometer"
    elif sensor.startswith("Gyroscope"):
        sensor = "Gyroscope"
    elif sensor.startswith("Magnetometer"):
        sensor = "Magnetometer"
    elif sensor.startswith("Gravity"):
        sensor = "Gravity"
    elif sensor.startswith("Orientation"):
        sensor = "Orientation"
    elif sensor.startswith("Light"):
        sensor = "Light"
    elif sensor.startswith("Proximity"):
        sensor = "Proximity"
    elif sensor.startswith("Step"):
        sensor = "Step"

    return sensor, axis.upper()

def build_payload_from_buffer():
    if not buffer:
        return {"time": [], "sensors": {}, "latest_row": {}, "previous_row": {}}

    rows = list(buffer)
    time_stamps = [r["timestamp"] for r in rows]
    sensors = defaultdict(lambda: defaultdict(list))

    for r in rows:
        for k, v in r.items():
            if k == "timestamp":
                continue
            sensor, axis = normalize(k)
            if sensor not in IMPORTANT_SENSORS:
                continue
            try:
                val = float(v)
            except:
                val = 0.0
            sensors[sensor][axis].append(val)

    latest = rows[-1]
    prev = rows[-2] if len(rows) > 1 else {}

    latest_f = {}
    for k, v in latest.items():
        if k == "timestamp":
            latest_f[k] = v
            continue
        sensor, _ = normalize(k)
        if sensor in IMPORTANT_SENSORS:
            latest_f[k] = v

    prev_f = {}
    if prev:
        for k, v in prev.items():
            if k == "timestamp":
                prev_f[k] = v
                continue
            sensor, _ = normalize(k)
            if sensor in IMPORTANT_SENSORS:
                prev_f[k] = v

    return {
        "time": time_stamps,
        "sensors": sensors,
        "latest_row": latest_f,
        "previous_row": prev_f
    }

def sampler_loop():
    device_sensors = list_device_sensors()
    if not device_sensors:
        print("[logger] No sensors detected. Exiting.")
        return

    mapping = build_mapping(device_sensors)
    print("[logger] === Sensor Mapping (canonical → device) ===")
    for k, v in mapping.items():
        print(f" {k:<14} -> {v if v else 'NOT FOUND'}")

    actual_call_list = sorted({s for s in mapping.values() if s})
    if not actual_call_list:
        print("[logger] None of the important sensors were found. Exiting.")
        return

    while True:
        try:
            data = fetch_values(actual_call_list)
            if not data:
                time.sleep(INTERVAL)
                continue

            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            csv_row = [ts]
            row_dict = {"timestamp": ts}

            for group, spec in SPECS.items():
                dev_name = mapping.get(group)
                vals = []
                if dev_name and dev_name in data:
                    vals = data[dev_name].get("values", [])
                if group == "Proximity" and not dev_name:
                    light_dev = mapping.get("Light")
                    if light_dev and light_dev in data:
                        lvals = data[light_dev].get("values", [])
                        vals = [lvals[1]] if len(lvals) > 1 else [0]

                vals = pad(vals, len(spec["axes"]))
                for ax, value in zip(spec["axes"], vals):
                    key = f"{group}_{ax}"
                    row_dict[key] = value
                    csv_row.append(value)

            # Add to the streaming buffer (always)
            buffer.append(row_dict)

            # Add to the CSV buffer (if enabled)
            if WRITE_CSV:
                csv_write_buffer.append(csv_row) # <<< CHANGED
                
                # Check if the buffer is full and needs to be flushed
                if len(csv_write_buffer) >= WRITE_BATCH_SIZE: # <<< NEW
                    flush_csv_buffer() # <<< NEW

            time.sleep(INTERVAL)

        except Exception as e:
            print(f"[logger] Error: {e}")
            time.sleep(INTERVAL)

# ----------------- Flask (SSE) -----------------

app = Flask(__name__)

def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp

@app.route("/sensor-stream")
def sensor_stream():
    def gen():
        yield f"retry: {int(INTERVAL * 1000)}\n\n"
        while True:
            payload = build_payload_from_buffer()
            yield f"data: {json.dumps(payload)}\n\n"
            time.sleep(INTERVAL)
    resp = Response(gen(), mimetype="text/event-stream")
    return add_cors(resp)

@app.route("/sensor-data")
def sensor_data():
    resp = make_response(jsonify(build_payload_from_buffer()))
    return add_cors(resp)

@app.route("/export")
def export_csv():
    # Flush any remaining buffer before exporting
    flush_csv_buffer() # <<< NEW
    
    if not WRITE_CSV or not os.path.exists(CSV_PATH):
        resp = make_response(jsonify({"error": "CSV not available"}), 404)
        return add_cors(resp)
    return send_file(CSV_PATH, as_attachment=True)

def run():
    import threading
    t = threading.Thread(target=sampler_loop, daemon=True)
    t.start()
    print(f"[logger] SSE server at http://{HOST}:{PORT}/sensor-stream")
    
    # <<< CHANGED: Wrap app.run in try/finally to catch Ctrl+C
    try:
        app.run(host=HOST, port=PORT, threaded=True)
    except KeyboardInterrupt:
        print("\n[logger] Shutdown requested...")
    finally:
        # This is CRITICAL: ensures the last batch is saved when you stop the server
        print("[logger] Cleaning up...")
        flush_csv_buffer()

if __name__ == "__main__":
    run()
