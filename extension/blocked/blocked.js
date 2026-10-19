/**
 * FOCUS GOAT — Lógica de pantalla de bloqueo
 */

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get("target") || "";
  
  // Elementos del DOM
  const blockedTargetEl = document.getElementById("blockedTarget");
  const quoteTextEl = document.getElementById("quoteText");
  const btnRefreshQuote = document.getElementById("btnRefreshQuote");
  const timerDisplayEl = document.getElementById("timerDisplay");
  const timerModeEl = document.getElementById("timerMode");
  const sessionContextEl = document.getElementById("sessionContext");
  const btnStudy = document.getElementById("btnStudy");
  const btnUnlockEmergency = document.getElementById("btnUnlockEmergency");
  const emergencyModal = document.getElementById("emergencyModal");
  const btnCancelEmergency = document.getElementById("btnCancelEmergency");
  const btnConfirmEmergency = document.getElementById("btnConfirmEmergency");
  const emergencySecondsEl = document.getElementById("emergencySeconds");

  // Mostrar el dominio bloqueado
  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      blockedTargetEl.textContent = `⛔ ${parsed.hostname}`;
    } catch (e) {
      blockedTargetEl.textContent = "⛔ SITIO DISTRACTOR";
    }
  }

  // Cargar frases motivadoras
  let quotes = [];
  const stored = await chrome.storage.local.get(["quotes"]);
  if (stored.quotes && stored.quotes.length) {
    quotes = stored.quotes;
  } else {
    quotes = [
      "El dolor de la disciplina pesa gramos; el del arrepentimiento, toneladas.",
      "¿De verdad vas a tirar tu progreso por 5 minutos de dopamina barata?",
      "Los mediocres se distraen. Los GOATs construyen su legado.",
      "Cierra esta pestaña. Tu futuro yo te lo agradecerá eternamente.",
      "El examen o proyecto no se va a aprobar solo. Vuelve a la mesa."
    ];
  }

  function displayRandomQuote() {
    quoteTextEl.style.opacity = "0";
    setTimeout(() => {
      const randomIdx = Math.floor(Math.random() * quotes.length);
      quoteTextEl.textContent = quotes[randomIdx];
      quoteTextEl.style.opacity = "1";
    }, 200);
  }

  displayRandomQuote();
  btnRefreshQuote.addEventListener("click", displayRandomQuote);

  // Inicializar temporizador con background
  let remainingMs = 0;
  let timerInterval = null;

  async function syncTimer() {
    chrome.runtime.sendMessage({ action: "getStatus" }, (status) => {
      if (!status || !status.isActive) {
        timerDisplayEl.textContent = "00:00:00";
        timerModeEl.textContent = "Sesión finalizada. ¡Buen trabajo!";
        // Si ya no está bloqueado, redirigir al sitio original si se desea
        setTimeout(() => {
          if (targetUrl) window.location.href = targetUrl;
        }, 1500);
        return;
      }

      remainingMs = status.remainingMs;

      if (status.reason === "routine") {
        timerModeEl.textContent = `Rutina activa: ${status.routineName || "Horario de estudio"}`;
        sessionContextEl.textContent = "Horario de rutina semanal activo. Elimina las distracciones.";
      } else {
        timerModeEl.textContent = "Temporizador de concentración";
        sessionContextEl.textContent = "Sesión de estudio en curso. Tu concentración está blindada.";
      }

      updateDisplay();
    });
  }

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

  function updateDisplay() {
    timerDisplayEl.textContent = formatTime(remainingMs);
  }

  await syncTimer();

  // Cuenta atrás en tiempo real
  timerInterval = setInterval(() => {
    if (remainingMs > 1000) {
      remainingMs -= 1000;
      updateDisplay();
    } else {
      syncTimer();
    }
  }, 1000);

  // Botón "Cerrar y volver a estudiar"
  btnStudy.addEventListener("click", () => {
    // Intentar cerrar la pestaña actual
    window.close();
    // Respaldo si el navegador bloquea window.close()
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 200);
  });

  // Modal de pausa de emergencia con retardo de 5 segundos
  let emergencyInterval = null;

  btnUnlockEmergency.addEventListener("click", () => {
    emergencyModal.classList.remove("hidden");
    let count = 5;
    emergencySecondsEl.textContent = count;
    btnConfirmEmergency.disabled = true;

    if (emergencyInterval) clearInterval(emergencyInterval);
    emergencyInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(emergencyInterval);
        emergencySecondsEl.textContent = "✓";
        btnConfirmEmergency.disabled = false;
      } else {
        emergencySecondsEl.textContent = count;
      }
    }, 1000);
  });

  btnCancelEmergency.addEventListener("click", () => {
    if (emergencyInterval) clearInterval(emergencyInterval);
    emergencyModal.classList.add("hidden");
  });

  btnConfirmEmergency.addEventListener("click", async () => {
    // Desactivar temporalmente sesión
    chrome.runtime.sendMessage({ action: "stopSession" }, () => {
      chrome.runtime.sendMessage({ action: "toggleMaster" }, () => {
        if (targetUrl) {
          window.location.href = targetUrl;
        } else {
          window.close();
        }
      });
    });
  });
});
