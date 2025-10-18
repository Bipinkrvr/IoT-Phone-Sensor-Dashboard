
# ~/redmiedge/app/routes.py
import os
import requests
from flask import Blueprint, Response, jsonify, stream_with_context, redirect

bp = Blueprint("routes", __name__)

# Where your phone/Termux logger_sse.py is running
# Change via: PHONE_HOST=http://<phone-ip>:5000 python dashboard.py
PHONE_HOST = os.environ.get("PHONE_HOST", "http://127.0.0.1:5000")
TIMEOUT = 10 # seconds


@bp.route("/sensor-stream")
def sensor_stream():
    """
    Properly proxy the phone's SSE stream.
    IMPORTANT: we forward raw bytes (iter_content) to preserve SSE framing (\n\n).
    """
    @stream_with_context
    def generate():
        try:
            with requests.get(f"{PHONE_HOST}/sensor-stream",
                              stream=True, timeout=TIMEOUT) as r:
                r.raise_for_status()
                # Forward the stream exactly as we get it
                for chunk in r.iter_content(chunk_size=None):
                    if chunk:
                        yield chunk
        except Exception as e:
            # Send an SSE error event so the client can react/reconnect
            yield f"event: error\ndata: {str(e)}\n\n".encode()

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        },
    )


@bp.route("/sensor-data")
def sensor_data():
    """Simple passthrough for snapshot JSON (handy for CSV export or debugging)."""
    try:
        r = requests.get(f"{PHONE_HOST}/sensor-data", timeout=TIMEOUT)
        r.raise_for_status()
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@bp.route("/export")
def export_csv():
    """
    If your phone exposes /export (logger WRITE_CSV=True), you can either:
    - redirect there, or
    - proxy the file (more code). Redirect keeps it simple.
    """
    return redirect(f"{PHONE_HOST}/export", code=302)


@bp.route("/health")
def health():
    """Tiny helper to see if this proxy is alive."""
    return jsonify({"status": "ok", "phone_host": PHONE_HOST})
