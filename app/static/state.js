
export const state = {
  currentSensor: localStorage.getItem("selectedSensor") || "all",
  darkMode: false,
  scrollYBeforeUpdate: 0,
  isAutoRestoring: false,
  globalData: null,
  pinned: JSON.parse(localStorage.getItem('pinnedSensors') || '[]'),
};

export function saveSensor(sensor) {
  state.currentSensor = sensor;
  localStorage.setItem("selectedSensor", sensor);
}

export function saveDarkMode(val) {
  state.darkMode = val;
}

export function togglePin(sensor) {
  const i = state.pinned.indexOf(sensor);
  i === -1 ? state.pinned.push(sensor) : state.pinned.splice(i, 1);
  localStorage.setItem('pinnedSensors', JSON.stringify(state.pinned));
}

export function saveSensorView(sensor, view) {
  localStorage.setItem(`viewMode-${sensor}`, view);
}
export function getSensorView(sensor) {
  return localStorage.getItem(`viewMode-${sensor}`) || "combined";
}
export function saveAxisFilter(sensor, axis) {
  localStorage.setItem(`axisFilter-${sensor}`, axis);
}
export function getAxisFilter(sensor) {
  return localStorage.getItem(`axisFilter-${sensor}`) || "all";
}
