const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const retryBtn = document.getElementById("retry");

function setStatus(state, message) {
  statusEl.dataset.state = state;
  statusText.textContent = message;
}

async function checkBackend() {
  setStatus("loading", "Comprobando conexión con el backend…");
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setStatus("ok", `Backend conectado (${data.status})`);
  } catch (error) {
    setStatus("error", "No se pudo conectar con el backend");
    console.error(error);
  }
}

retryBtn.addEventListener("click", checkBackend);
checkBackend();
