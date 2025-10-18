
export const SENSOR_ICONS = {
  Accelerometer: "🧭",
  Gyroscope: "🌀",
  Magnetometer: "🧲",
  Gravity: "🌍",
  Linear: "📈",
  Rotation: "🔁",
  GameRotation: "🎮",
  GeoRotation: "🧭",
  Orientation: "🧭",
  Light: "💡",
  Proximity: "📡",
  Step: "🚶",
  default: "📟"
};

export function iconFor(key) {
  const base = key.split("_")[0];
  return SENSOR_ICONS[base] || SENSOR_ICONS.default;
}

export function getTrendArrow(newVal, oldVal) {
  if (newVal > oldVal) return "⬆️";
  if (newVal < oldVal) return "⬇️";
  return "➡️";
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function showLoader(show) {
  document.getElementById('loader')?.setAttribute('hidden', show ? false : true);
}
export function toast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => el.hidden = true, ms);
}

export function preserveScrollStart(state) {
  if (!state.isAutoRestoring) {
    state.scrollYBeforeUpdate = window.scrollY;
  }
}
export function preserveScrollEnd(state) {
  state.isAutoRestoring = true;
  requestAnimationFrame(() => {
    window.scrollTo(0, state.scrollYBeforeUpdate);
    setTimeout(() => {
      window.scrollTo(0, state.scrollYBeforeUpdate);
      state.isAutoRestoring = false;
    }, 200);
  });
}

export function isValidSensor(sensorData) {
  if (!sensorData) return false;
  return Object.values(sensorData).some(
    arr => Array.isArray(arr) && arr.length > 0 && !arr.every(v => v === 0)
  );
}

export function exportCSV(data) {
  if (!data || !data.sensors) {
    toast("No data available for export.");
    return;
  }
  const rows = [];
  const headers = ['time'];
  const sensors = Object.keys(data.sensors);
  sensors.forEach(s => Object.keys(data.sensors[s]).forEach(ax => {
    headers.push(`${s}_${ax}`);
  }));
  rows.push(headers.join(','));
  data.time.forEach((t, idx) => {
    const row = [t];
    sensors.forEach(s => Object.keys(data.sensors[s]).forEach(ax => {
      row.push(data.sensors[s][ax][idx] ?? '');
    }));
    rows.push(row.join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `sensor-data-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
