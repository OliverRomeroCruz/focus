/**
 * FOCUS GOAT — Popup Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  const masterToggle = document.getElementById("masterToggle");
  const statusPanel = document.getElementById("statusPanel");
  const statusTitle = document.getElementById("statusTitle");
  const popupCountdown = document.getElementById("popupCountdown");
  const statusDesc = document.getElementById("statusDesc");
  const btnStopSession = document.getElementById("btnStopSession");
  const btnBlockCurrent = document.getElementById("btnBlockCurrent");
  const blockCurrentText = document.getElementById("blockCurrentText");
  const btnOpenOptions = document.getElementById("btnOpenOptions");
  const timerButtons = document.querySelectorAll(".btn-timer");
  const customMinsInput = document.getElementById("customMins");
  const btnCustomStart = document.getElementById("btnCustomStart");

  let remainingMs = 0;
  let countdownInterval = null;
  let currentTabDomain = "";

  // 1. Obtener la pestaña activa actual para el botón "Bloquear este sitio"
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) {
      const parsed = new URL(activeTab.url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        currentTabDomain = parsed.hostname.replace(/^www\./, "");
        blockCurrentText.textContent = `Bloquear ${currentTabDomain}`;
      } else {
        btnBlockCurrent.style.display = "none";
      }
    }
  } catch (e) {
    btnBlockCurrent.style.display = "none";
  }

  // 2. Cargar estado del master toggle
  const storageData = await chrome.storage.local.get(["enabled"]);
  masterToggle.checked = storageData.enabled !== false;

  masterToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({ action: "toggleMaster" }, () => {
      syncUI();
    });
  });

  // 3. Formateo de tiempo
  function formatTime(ms) {
    if (ms <= 0) return "00:00:00";
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
      hours.toString().padStart(2, "0"),
      mins.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0")
    ].join(":");
  }

  // 4. Sincronizar estado con background
  function syncUI() {
    chrome.runtime.sendMessage({ action: "getStatus" }, (status) => {
      if (!status) return;

      if (!masterToggle.checked || !status.isActive) {
        statusPanel.classList.remove("is-active");
        statusTitle.textContent = masterToggle.checked ? "ENFOQUE INACTIVO" : "ESCUDO DESACTIVADO";
        popupCountdown.textContent = "00:00:00";
        statusDesc.textContent = masterToggle.checked 
          ? "Inicia una sesión de estudio para blindar tu concentración." 
          : "La protección de sitios está pausada globalmente.";
        btnStopSession.classList.add("hidden");
        remainingMs = 0;
        return;
      }

      statusPanel.classList.add("is-active");
      remainingMs = status.remainingMs;
      popupCountdown.textContent = formatTime(remainingMs);
      btnStopSession.classList.remove("hidden");

      if (status.reason === "routine") {
        statusTitle.textContent = "RUTINA SEMANAL ACTIVA";
        statusDesc.textContent = `Horario: ${status.routineName || "Estudio"}`;
      } else {
        statusTitle.textContent = "SESIÓN DE ESTUDIO ACTIVA";
        statusDesc.textContent = "Sitios distractores bloqueados.";
      }
    });
  }

  syncUI();

  // Tic de cuenta atrás
  countdownInterval = setInterval(() => {
    if (remainingMs > 1000) {
      remainingMs -= 1000;
      popupCountdown.textContent = formatTime(remainingMs);
    } else if (remainingMs > 0) {
      syncUI();
    }
  }, 1000);

  // 5. Iniciar sesiones rápidas
  timerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.dataset.mins, 10);
      chrome.runtime.sendMessage({ action: "startSession", minutes: mins }, () => {
        masterToggle.checked = true;
        syncUI();
      });
    });
  });

  // Temporizador personalizado
  btnCustomStart.addEventListener("click", () => {
    const mins = parseInt(customMinsInput.value, 10);
    if (mins && mins > 0) {
      chrome.runtime.sendMessage({ action: "startSession", minutes: mins }, () => {
        masterToggle.checked = true;
        syncUI();
      });
    }
  });

  // 6. Detener sesión actual
  btnStopSession.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopSession" }, () => {
      syncUI();
    });
  });

  // 7. Bloquear sitio actual
  btnBlockCurrent.addEventListener("click", () => {
    if (!currentTabDomain) return;

    chrome.runtime.sendMessage({ action: "addCurrentSite", domain: currentTabDomain }, (res) => {
      if (res && res.success) {
        blockCurrentText.textContent = `¡${currentTabDomain} bloqueado!`;
        btnBlockCurrent.style.borderColor = "var(--color-ink)";
        btnBlockCurrent.style.color = "var(--color-ink)";
      } else {
        blockCurrentText.textContent = res ? res.message : "Ya bloqueado";
      }
    });
  });

  // 8. Abrir panel de opciones completo
  btnOpenOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
