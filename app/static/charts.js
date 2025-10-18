
import {
  state,
  togglePin,
  saveSensorView,
  getSensorView,
  saveAxisFilter,
  getAxisFilter,
} from "./state.js";

import {
  iconFor,
  isValidSensor,
} from "./utils.js";

/* -------------------- Helpers -------------------- */

function shouldRender(sensor, sensorData) {
  const lower = (sensor || "").toLowerCase();
  if (lower.includes("light") || lower.includes("step")) return true;
  return isValidSensor(sensorData);
}

function getVisiblePlotDiv(sensor) {
  const combined = document.getElementById(`plot-${sensor}-XYZ`);
  if (combined && combined.style.display !== "none") return combined;
  const visibles = Array.from(document.querySelectorAll(`.plot-${sensor}`))
    .filter((d) => d.style.display !== "none");
  return visibles[0] || null;
}

function fullscreenVisible(sensor) {
  const div = getVisiblePlotDiv(sensor);
  if (div && div.requestFullscreen) div.requestFullscreen();
}

function downloadVisiblePNG(sensor) {
  const div = getVisiblePlotDiv(sensor);
  if (!div) return;
  Plotly.downloadImage(div, {
    format: "png",
    height: 800,
    width: 1200,
    filename: `${sensor}-${div.id}`,
  });
}

/* -------------------- Public API -------------------- */

export function plotSensor(sensor, data) {
  const sensorData = data.sensors[sensor];
  if (!shouldRender(sensor, sensorData)) {
    const oldDiv = document.getElementById(`container-${sensor}`);
    if (oldDiv) oldDiv.remove();
    return;
  }

  const container = ensureSensorContainer(sensor);
  createSensorToggle(sensor, container, data);

  const savedView = getSensorView(sensor);
  const savedAxis = getAxisFilter(sensor);

  if (savedView === "separate") {
    showSeparateGraphs(sensor, data);
  } else {
    showCombinedGraph(sensor, data);
  }

  applyAxisFilter(sensor, savedAxis);
}

export function showCombinedGraph(sensor, data) {
  const container = document.getElementById(`container-${sensor}`);
  const divId = `plot-${sensor}-XYZ`;
  let div = document.getElementById(divId);

  if (!div) {
    div = document.createElement("div");
    div.id = divId;
    div.className = `plot-${sensor}`;
    container.appendChild(div);
  }

  const axes = Object.keys(data.sensors[sensor]);
  const traces = axes.map((axis) => ({
    x: data.time,
    y: data.sensors[sensor][axis],
    mode: "lines",
    name: axis.toUpperCase(),
    type: "scatter"
  }));

  const layout = {
    margin: { t: 30, l: 40, r: 20, b: 40 },
    autosize: true,
    height: 350,
    paper_bgcolor: state.darkMode ? "#222" : "#fff",
    plot_bgcolor: state.darkMode ? "#222" : "#fff",
  };

  Plotly.react(div, traces, layout, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToAdd: ["toImage"],
  });

  document.querySelectorAll(`.plot-${sensor}`).forEach((d) => (d.style.display = "none"));
  div.style.display = "block";
}

export function showSeparateGraphs(sensor, data) {
  const container = document.getElementById(`container-${sensor}`);

  const combined = document.getElementById(`plot-${sensor}-XYZ`);
  if (combined) combined.style.display = "none";

  const axes = Object.keys(data.sensors[sensor]);
  axes.forEach((axis) => {
    const id = `plot-${sensor}-${axis}`;
    let div = document.getElementById(id);

    if (!div) {
      div = document.createElement("div");
      div.id = id;
      div.className = `plot-${sensor}`;
      div.dataset.axis = axis.toUpperCase();
      container.appendChild(div);
    }

    const trace = {
      x: data.time,
      y: data.sensors[sensor][axis],
      type: "scatter",
      mode: "lines",
      name: axis.toUpperCase(),
    };

    const layout = {
      title: { text: `${sensor} ${axis}`, font: { size: 16 } },
      margin: { t: 30, l: 40, r: 20, b: 40 },
      autosize: true,
      paper_bgcolor: state.darkMode ? "#222" : "#fff",
      plot_bgcolor: state.darkMode ? "#222" : "#fff",
      height: 350,
    };

    Plotly.react(div, [trace], layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToAdd: ["toImage"],
    });

    div.style.display = "block";
  });
}

export function applyAxisFilter(sensor, axis) {
  const combined = document.getElementById(`plot-${sensor}-XYZ`);
  if (combined) combined.style.display = "none";

  document.querySelectorAll(`.plot-${sensor}`).forEach((div) => {
    div.style.display = "none";
  });

  if (axis === "all") {
    const savedView = getSensorView(sensor);
    if (savedView === "separate") {
      document.querySelectorAll(`.plot-${sensor}`).forEach((div) => {
        if (div.id !== `plot-${sensor}-XYZ`) div.style.display = "block";
      });
    } else if (combined) {
      combined.style.display = "block";
    }
  } else {
    const axisDiv = document.querySelector(`.plot-${sensor}[data-axis="${axis}"]`);
    if (axisDiv) axisDiv.style.display = "block";
  }
}

/* -------------------- Internals -------------------- */

function ensureSensorContainer(sensor) {
  let container = document.getElementById(`container-${sensor}`);
  if (!container) {
    container = document.createElement("div");
    container.className = "graph-container";
    container.id = `container-${sensor}`;

    const title = document.createElement("h3");
    title.innerHTML = `${iconFor(sensor)} ${sensor} 
      <button aria-label="Pin sensor" data-pin="${sensor}">
        ${state.pinned.includes(sensor) ? "Unpin" : "⭐ Pin"}
      </button>`;
    container.appendChild(title);

    document.getElementById("graphs").appendChild(container);

    title.querySelector("button[data-pin]").onclick = () => {
      togglePin(sensor);
      const ev = new CustomEvent("pin-change");
      window.dispatchEvent(ev);
    };
  }
  return container;
}

/**
 * ⬇️ ***This is the only function I changed*** ⬇️
 * Buttons now render **inside** the graph container, right under the <h3>.
 */
function createSensorToggle(sensor, container, data) {
  // Remove any old controls from this container (avoid duplicates)
  const oldControls = container.querySelector(".sensor-controls");
  if (oldControls) oldControls.remove();

  const toggleDiv = document.createElement("div");
  toggleDiv.className = "toggle-group";
  toggleDiv.style.minHeight = "40px";

  const btnCombined = document.createElement("button");
  btnCombined.innerText = "Show XYZ (Combined)";
  btnCombined.className = "toggle-btn";
  btnCombined.onclick = () => {
    showCombinedGraph(sensor, data);
    saveSensorView(sensor, "combined");
    dropdown.value = "all";
    saveAxisFilter(sensor, "all");
    applyAxisFilter(sensor, "all");
  };

  const btnSeparate = document.createElement("button");
  btnSeparate.innerText = "Show X Y Z (Separate)";
  btnSeparate.className = "toggle-btn";
  btnSeparate.onclick = () => {
    showSeparateGraphs(sensor, data);
    saveSensorView(sensor, "separate");
    dropdown.value = "all";
    saveAxisFilter(sensor, "all");
    applyAxisFilter(sensor, "all");
  };

  const dropdown = document.createElement("select");
  dropdown.className = "dropdown-select";
  dropdown.innerHTML = `
    <option value="all">All</option>
    <option value="X">X</option>
    <option value="Y">Y</option>
    <option value="Z">Z</option>
    <option value="W">W</option>
    <option value="E">E</option>
  `;
  dropdown.value = getAxisFilter(sensor);
  dropdown.onchange = (e) => {
    const val = e.target.value;
    saveAxisFilter(sensor, val);
    applyAxisFilter(sensor, val);
  };

  const btnFullscreen = document.createElement("button");
  btnFullscreen.innerText = "⛶ Fullscreen";
  btnFullscreen.className = "toggle-btn";
  btnFullscreen.onclick = () => fullscreenVisible(sensor);

  const btnPNG = document.createElement("button");
  btnPNG.innerText = "⬇️ PNG";
  btnPNG.className = "toggle-btn";
  btnPNG.onclick = () => downloadVisiblePNG(sensor);

  toggleDiv.appendChild(btnCombined);
  toggleDiv.appendChild(btnSeparate);
  toggleDiv.appendChild(dropdown);
  toggleDiv.appendChild(btnFullscreen);
  toggleDiv.appendChild(btnPNG);

  const controlsWrapper = document.createElement("div");
  controlsWrapper.className = "sensor-controls";
  controlsWrapper.style.display = "flex";
  controlsWrapper.style.flexWrap = "wrap";
  controlsWrapper.style.gap = "10px";
  controlsWrapper.style.alignItems = "center";
  controlsWrapper.style.margin = "10px 0";

  controlsWrapper.appendChild(toggleDiv);

  // 👉 Insert **inside** the container, right after the <h3> title
  const titleEl = container.querySelector("h3");
  if (titleEl) {
    titleEl.insertAdjacentElement("afterend", controlsWrapper);
  } else {
    container.prepend(controlsWrapper);
  }
}
