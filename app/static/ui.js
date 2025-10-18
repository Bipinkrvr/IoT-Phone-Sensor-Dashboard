
import { state, saveSensor, togglePin } from "./state.js";
import { debounce, iconFor, getTrendArrow } from "./utils.js";

export function updateLiveData(latest, previous = {}) {
  const liveDiv = document.getElementById("live-data");
  const timeDiv = document.getElementById("live-timestamp");
  if (timeDiv) timeDiv.innerText = `🕒 ${new Date().toLocaleString()}`;

  const frag = document.createDocumentFragment();
  Object.keys(latest).forEach(key => {
    const v = parseFloat(latest[key]);
    if (key !== "timestamp" && !key.includes(" ") && !isNaN(v)) {
      const prev = parseFloat(previous?.[key] ?? v);
      const trend = getTrendArrow(v, prev);
      const color = trend === "⬆️" ? "green" : trend === "⬇️" ? "red" : "gray";
      const card = document.createElement("div");
      card.className = "trend-card";
      card.innerHTML = `
        <div class="trend-label">${iconFor(key)} ${key}</div>
        <div class="trend-value" style="color:${color}">
          ${trend} ${v.toFixed(2)}
        </div>
      `;
      frag.appendChild(card);
    }
  });

  liveDiv.innerHTML = "";
  liveDiv.appendChild(frag);
  liveDiv.classList.add("flicker");
  setTimeout(() => liveDiv.classList.remove("flicker"), 300);
}

export function renderTable(latest) {
  const tbody = document.getElementById("sensor-table");
  const frag = document.createDocumentFragment();
  Object.keys(latest).forEach(key => {
    const value = parseFloat(latest[key]);
    if (key !== "timestamp" && !key.includes(" ") && !isNaN(value)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-icon">${iconFor(key)}</td>
        <td class="col-name">${key}</td>
        <td class="col-value">${latest[key]}</td>
      `;
      frag.appendChild(tr);
    }
  });
  tbody.innerHTML = "";
  tbody.appendChild(frag);
}

export function setupSensorDropdown(sensorList) {
  const dropdown = document.getElementById("sensor-dropdown");
  dropdown.innerHTML = `<option value="all">All Graphs</option>` +
    sensorList.map(s => `<option value="${s}">${s}</option>`).join("");
  dropdown.value = state.currentSensor;
  dropdown.onchange = e => {
    saveSensor(e.target.value);
    const ev = new CustomEvent("sensor-change");
    window.dispatchEvent(ev);
  };
}

export function setupSearch() {
  const search = document.getElementById("search-input");
  const handler = debounce(val => {
    document.querySelectorAll("#sensor-table tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(val) ? "" : "none";
    });
  }, 150);
  search.oninput = e => handler(e.target.value.toLowerCase());
}

export function renderPinnedSensors() {
  const pinnedDiv = document.getElementById('pinned-section');
  const pinned = state.pinned;
  if (!pinned.length) {
    pinnedDiv.innerHTML = "";
    return;
  }
  pinnedDiv.innerHTML = "<h3>⭐ Pinned Sensors</h3>";
  pinned.forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = `📟 ${s} ✖`;
    btn.onclick = () => {
      togglePin(s);
      const ev = new CustomEvent("pin-change");
      window.dispatchEvent(ev);
    };
    pinnedDiv.appendChild(btn);
  });
}
