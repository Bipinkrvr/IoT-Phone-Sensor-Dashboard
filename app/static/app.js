
import {
  state,
  saveDarkMode,
  saveSensor,
} from "./state.js";

import {
  showLoader,
  toast,
  preserveScrollStart,
  preserveScrollEnd,
  exportCSV,
} from "./utils.js";

import {
  updateLiveData,
  renderTable,
  setupSensorDropdown,
  setupSearch,
  renderPinnedSensors,
} from "./ui.js";

import { plotSensor } from "./charts.js";

/* -------------------- SSE-driven app.js -------------------- */

let firstLoad = true;
let renderedSensors = new Set();
let lastModeSignature = "";

function modeSignature() {
  return state.currentSensor + "|" + state.pinned.join(",");
}

function renderGraphsIfNeeded(data) {
  const modeSig = modeSignature();
  const graphsDiv = document.getElementById("graphs");
  const sensors = Object.keys(data.sensors);

  let toRender = [];
  if (state.currentSensor === "all") {
    toRender = sensors;
  } else if (sensors.includes(state.currentSensor)) {
    toRender = [state.currentSensor];
  } else {
    toRender = sensors;
    saveSensor("all");
  }

  if (modeSig === lastModeSignature && renderedSensors.size) {
    toRender.forEach(sensor => plotSensor(sensor, data));
    return;
  }

  lastModeSignature = modeSig;
  graphsDiv.innerHTML = "";
  renderedSensors.clear();

  const ordered = [
    ...state.pinned.filter((s) => toRender.includes(s)),
    ...toRender.filter((s) => !state.pinned.includes(s)),
  ];

  ordered.forEach(sensor => {
    plotSensor(sensor, data);
    renderedSensors.add(sensor);
  });
}

function renderInitial(data) {
  state.globalData = data;

  updateLiveData(data.latest_row, data.previous_row || {});
  renderTable(data.latest_row);
  setupSensorDropdown(Object.keys(data.sensors));
  setupSearch();
  renderPinnedSensors();

  renderGraphsIfNeeded(data);
}

function updateLive(data) {
  state.globalData = data;

  updateLiveData(data.latest_row, data.previous_row || {});
  renderTable(data.latest_row);
  renderPinnedSensors();

  renderGraphsIfNeeded(data);
}

function startSSE() {
  showLoader(true);

  if (!window.EventSource) {
    toast("SSE not supported by this browser.");
    return;
  }

  const es = new EventSource("/sensor-stream");

  es.onmessage = (evt) => {
    try {
      preserveScrollStart(state);
      const data = JSON.parse(evt.data);

      if (firstLoad) {
        renderInitial(data);
        showLoader(false);
        firstLoad = false;
      } else {
        updateLive(data);
      }
    } catch (e) {
      console.error("SSE parse error:", e);
    } finally {
      preserveScrollEnd(state);
    }
  };

  es.onerror = (e) => {
    console.error("SSE error", e);
    toast("Connection lost. Reconnecting in 3s...");
    showLoader(true);
    es.close();
    setTimeout(startSSE, 3000);
  };

  window.addEventListener("sensor-change", () => {
    lastModeSignature = "";
    if (state.globalData) renderInitial(state.globalData);
  });
  window.addEventListener("pin-change", () => {
    lastModeSignature = "";
    if (state.globalData) renderInitial(state.globalData);
  });
}

/* -------------------- UI events -------------------- */

document.getElementById("dark-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  saveDarkMode(document.body.classList.contains("dark"));
  lastModeSignature = "";
  if (state.globalData) renderInitial(state.globalData);
});

document.getElementById("export-csv").addEventListener("click", () => {
  exportCSV(state.globalData);
});

window.addEventListener("scroll", () => {
  if (!state.isAutoRestoring) {
    state.scrollYBeforeUpdate = window.scrollY;
  }
});

/* -------------------- GO -------------------- */
startSSE();
