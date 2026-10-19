/**
 * FOCUS GOAT — Lógica de pantalla de bloqueo con diseño idéntico a la web
 */

const PREDETERMINED_QUOTES = [
  "“El dolor de la disciplina pesa gramos; el del arrepentimiento, toneladas.”",
  "“¿De verdad vas a tirar tu progreso por 5 minutos de dopamina barata?”",
  "“Los que no tienen metas trabajan para los que sí las tienen. Concéntrate.”",
  "“Lo que hagas hoy en silencio gritará mañana en tus resultados.”",
  "“Los mediocres se distraen. Los GOATs construyen su legado.”",
  "“Cierra esta pestaña. Tu futuro yo te lo agradecerá eternamente.”",
  "“El examen o proyecto no se va a aprobar solo. Vuelve a la mesa.”",
  "“No te detengas cuando estés cansado, detente cuando hayas terminado.”",
  "“ARE you sure? La grandeza exige eliminar el ruido.”",
  "“Tu mayor competidor está estudiando ahora mismo. ¿Y tú qué haces?”",
  "“Cada minuto que pierdes aquí es un paso atrás en tu objetivo.”",
  "“Domina tu mente o tu mente te dominará a ti.”"
];

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get("target") || "";

  // Elementos del DOM
  const blockedGoatRank = document.getElementById("blockedGoatRank");
  const blockedTargetEl = document.getElementById("blockedTarget");
  const eyebrowTargetEl = document.getElementById("eyebrowTarget");
  const quoteTextEl = document.getElementById("quoteText");
  const btnRefreshQuote = document.getElementById("btnRefreshQuote");
  const timerDisplayEl = document.getElementById("timerDisplay");
  const timerModeEl = document.getElementById("timerMode");
  const btnStudy = document.getElementById("btnStudy");
  const btnUnlockEmergency = document.getElementById("btnUnlockEmergency");
  const emergencyModal = document.getElementById("emergencyModal");
  const btnCancelEmergency = document.getElementById("btnCancelEmergency");
  const btnConfirmEmergency = document.getElementById("btnConfirmEmergency");
  const freeFrictionBox = document.getElementById("freeFrictionBox");
  const emergencySecondsEl = document.getElementById("emergencySeconds");
  const btnCheckUnblock = document.getElementById("btnCheckUnblock");

  // Cargar Rango de la Cabra
  chrome.runtime.sendMessage({ action: "getStatsAndRank" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res && res.rank && blockedGoatRank) {
      blockedGoatRank.textContent = `${res.rank.icon} ${res.rank.title}`;
    }
  });

  // Mostrar el motivo y dominio del bloqueo
  const reason = urlParams.get("reason") || "blacklist";
  if (reason === "shorts") {
    blockedTargetEl.textContent = "YOUTUBE SHORTS (BLOQUEO QUIRÚRGICO)";
    eyebrowTargetEl.textContent = "POZO DE DISTRACCIÓN DETECTADO (PRO)";
  } else if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname.replace(/^www\./, "");
      blockedTargetEl.textContent = `BLOQUEADO: ${host.toUpperCase()}`;
      eyebrowTargetEl.textContent = `INTENTANDO ACCEDER A ${host.toUpperCase()}`;
    } catch (e) {
      blockedTargetEl.textContent = "ACCESO BLOQUEADO";
      eyebrowTargetEl.textContent = "INTENTANDO ACCEDER A DISTRACCIÓN";
    }
  }

  // Rotación de frases motivadoras predeterminadas
  let currentQuoteIndex = Math.floor(Math.random() * PREDETERMINED_QUOTES.length);

  function showQuote(index) {
    quoteTextEl.style.opacity = "0";
    setTimeout(() => {
      quoteTextEl.textContent = PREDETERMINED_QUOTES[index];
      quoteTextEl.style.opacity = "1";
    }, 200);
  }

  showQuote(currentQuoteIndex);

  btnRefreshQuote.addEventListener("click", () => {
    currentQuoteIndex = (currentQuoteIndex + 1) % PREDETERMINED_QUOTES.length;
    showQuote(currentQuoteIndex);
  });

  // Temporizador en vivo conectado con el background service worker
  let remainingMs = 0;
  let timerInterval = null;

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

  function syncTimer() {
    chrome.runtime.sendMessage({ action: "getStatus" }, (status) => {
      if (chrome.runtime.lastError) return;
      if (status && status.isPaused) {
        remainingMs = status.remainingMs;
        timerModeEl.textContent = "Sesión pausada (Tiempo detenido)";
        updateDisplay();
        return;
      }

      if (!status || !status.isActive) {
        timerDisplayEl.textContent = "00:00:00";
        timerModeEl.textContent = "Sesión finalizada. Desbloqueado.";
        setTimeout(() => {
          if (targetUrl) window.location.href = targetUrl;
        }, 1200);
        return;
      }

      remainingMs = status.remainingMs;

      if (status.isPro && status.strictMode) {
        setStrictModeActive();
      }

      if (status.reason === "routine") {
        timerModeEl.textContent = `Rutina semanal: ${status.routineName || "Estudio"}`;
      } else {
        timerModeEl.textContent = "Temporizador de sesión activo";
      }

      updateDisplay();
    });
  }

  function setStrictModeActive() {
    isStrict = true;
    btnUnlockEmergency.textContent = "🔒 Modo Estricto PRO activo (Sin pausas)";
    btnUnlockEmergency.title = "El Modo Estricto PRO está activo. No se permiten pausas de emergencia.";
    btnUnlockEmergency.style.cursor = "not-allowed";
    btnUnlockEmergency.style.opacity = "0.6";
    btnUnlockEmergency.style.textDecoration = "none";
  }

  let isStrict = urlParams.get("strict") === "1";
  if (isStrict) {
    setStrictModeActive();
  }

  // Comprueba si esta URL específica ya no está bloqueada (por ejemplo, si se eliminó de la lista)
  function checkUrlStillBlocked() {
    if (!targetUrl) return;
    chrome.runtime.sendMessage({ action: "checkUrlStatus", url: targetUrl }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.isBlocked === false) {
        timerDisplayEl.textContent = "00:00:00";
        timerModeEl.textContent = "¡Sitio desbloqueado! Redirigiendo...";
        if (timerInterval) clearInterval(timerInterval);
        setTimeout(() => {
          window.location.replace(targetUrl);
        }, 200);
      }
    });
  }

  // Botón directo para reintentar / comprobar si el usuario lo eliminó de la lista
  if (btnCheckUnblock) {
    btnCheckUnblock.addEventListener("click", () => {
      btnCheckUnblock.textContent = "Comprobando...";
      chrome.runtime.sendMessage({ action: "checkUrlStatus", url: targetUrl }, (res) => {
        if (chrome.runtime.lastError || !res) {
          window.location.replace(targetUrl);
          return;
        }
        if (!res.isBlocked) {
          timerDisplayEl.textContent = "00:00:00";
          timerModeEl.textContent = "¡Sitio desbloqueado! Entrando...";
          window.location.replace(targetUrl);
        } else {
          alert("Este sitio todavía figura en tu lista de sitios bloqueados o tu sesión de estudio continúa activa.");
          btnCheckUnblock.innerHTML = "<span>¿Has eliminado este sitio de la lista? Haz clic para entrar ahora ➜</span>";
        }
      });
    });
  }

  syncTimer();
  checkUrlStillBlocked();

  // Desbloqueo reactivo instantáneo cuando finaliza la sesión o se modifica la lista en storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.sessionActive && changes.sessionActive.newValue === false) {
        timerDisplayEl.textContent = "00:00:00";
        timerModeEl.textContent = "Sesión finalizada. Desbloqueado.";
        if (targetUrl) {
          window.location.replace(targetUrl);
        }
      }
      if (changes.blockedSites || changes.activeProfile || changes.enabled) {
        checkUrlStillBlocked();
      }
    }
  });

  let tickCount = 0;
  timerInterval = setInterval(() => {
    tickCount++;
    if (remainingMs > 1000) {
      remainingMs -= 1000;
      updateDisplay();
    } else {
      syncTimer();
    }
    // Cada 3 segundos verificar si el sitio fue desbloqueado
    if (tickCount % 3 === 0) {
      checkUrlStillBlocked();
    }
  }, 1000);

  // Botón "Cerrar y volver a estudiar"
  btnStudy.addEventListener("click", () => {
    window.close();
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 200);
  });

  // Modal de pausa de emergencia (Freno consciente de 10 segundos)
  let emergencyInterval = null;

  btnUnlockEmergency.addEventListener("click", () => {
    if (isStrict) {
      alert("Modo Estricto PRO activo:\n\nTu sesión de concentración está blindada y no admite pausas de emergencia. ¡Termina tu bloque de estudio!");
      return;
    }

    emergencyModal.classList.remove("hidden");
    btnConfirmEmergency.disabled = true;

    let count = 10;
    if (emergencySecondsEl) {
      emergencySecondsEl.textContent = count;
      emergencySecondsEl.classList.remove("completed");
    }

    if (emergencyInterval) clearInterval(emergencyInterval);
    emergencyInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(emergencyInterval);
        if (emergencySecondsEl) {
          emergencySecondsEl.textContent = "✓";
          emergencySecondsEl.classList.add("completed");
        }
        btnConfirmEmergency.disabled = false;
      } else {
        if (emergencySecondsEl) {
          emergencySecondsEl.textContent = count;
        }
      }
    }, 1000);
  });

  btnCancelEmergency.addEventListener("click", () => {
    if (emergencyInterval) clearInterval(emergencyInterval);
    emergencyModal.classList.add("hidden");
    if (emergencySecondsEl) {
      emergencySecondsEl.classList.remove("completed");
      emergencySecondsEl.textContent = "10";
    }
  });

  btnConfirmEmergency.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopSession" }, () => {
      if (chrome.runtime.lastError) {}
      chrome.runtime.sendMessage({ action: "toggleMaster" }, () => {
        if (chrome.runtime.lastError) {}
        if (targetUrl) {
          window.location.href = targetUrl;
        } else {
          window.close();
        }
      });
    });
  });
});
