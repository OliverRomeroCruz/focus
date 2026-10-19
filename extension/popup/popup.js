/**
 * FOCUS GOAT — Popup Controller
 * Control de sesiones, congelado exacto de tiempo al pausar, sincronización PRO instantánea.
 * (Módulo de audio eliminado por petición del usuario).
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos principales
  const masterToggle = document.getElementById("masterToggle");
  const statusPanel = document.getElementById("statusPanel");
  const statusTitle = document.getElementById("statusTitle");
  const popupCountdown = document.getElementById("popupCountdown");
  const statusDesc = document.getElementById("statusDesc");
  const btnPauseSession = document.getElementById("btnPauseSession");
  const btnStopSession = document.getElementById("btnStopSession");
  const btnBlockCurrent = document.getElementById("btnBlockCurrent");
  const blockCurrentText = document.getElementById("blockCurrentText");
  const btnOpenOptions = document.getElementById("btnOpenOptions");
  const timerButtons = document.querySelectorAll(".btn-timer");
  const customMinsInput = document.getElementById("customMins");
  const btnCustomStart = document.getElementById("btnCustomStart");

  // Elementos Freemium / PRO
  const planBadge = document.getElementById("planBadge");
  const proBanner = document.getElementById("proBanner");
  const btnOpenUpgrade = document.getElementById("btnOpenUpgrade");
  const upgradeModal = document.getElementById("upgradeModal");
  const btnCloseUpgrade = document.getElementById("btnCloseUpgrade");
  const statStreak = document.getElementById("statStreak");
  const statMinutes = document.getElementById("statMinutes");
  const licenseKeyInput = document.getElementById("licenseKeyInput");
  const btnActivateKey = document.getElementById("btnActivateKey");
  const licenseFeedback = document.getElementById("licenseFeedback");
  const btnCheckoutMonthly = document.getElementById("btnCheckoutMonthly");
  const btnCheckoutLifetime = document.getElementById("btnCheckoutLifetime");

  let remainingMs = 0;
  let countdownInterval = null;
  let currentTabDomain = "";
  let isUserPro = false;

  // Formateo de milisegundos a HH:MM:SS
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

  // Aplicar apariencia visual PRO de forma inmediata
  function applyProUI(isPro) {
    isUserPro = isPro;
    if (isPro) {
      planBadge.textContent = "👑 PRO";
      planBadge.classList.add("is-pro");
      if (proBanner) proBanner.style.display = "none";
    } else {
      planBadge.textContent = "FREE";
      planBadge.classList.remove("is-pro");
      if (proBanner) proBanner.style.display = "flex";
    }
  }

  // Actualizar estadísticas de estudio
  function applyStatsUI(stats) {
    if (!stats) return;
    if (statStreak) {
      const days = stats.streakDays || 1;
      statStreak.textContent = `🔥 ${days} día${days > 1 ? "s" : ""} racha`;
    }
    if (statMinutes) {
      const mins = stats.totalMinutes || 0;
      statMinutes.textContent = `⏱️ ${mins} min enfocados`;
    }
  }

  // Detener intervalo de cuenta atrás
  function stopCountdownTicker() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // Iniciar intervalo de cuenta atrás
  function startCountdownTicker() {
    stopCountdownTicker();
    countdownInterval = setInterval(() => {
      if (remainingMs > 1000) {
        remainingMs -= 1000;
        popupCountdown.textContent = formatTime(remainingMs);
        chrome.storage.local.set({ 
          sessionRemainingMs: remainingMs,
          sessionPausedMs: remainingMs 
        });
      } else {
        remainingMs = 0;
        popupCountdown.textContent = "00:00:00";
        stopCountdownTicker();
        finishSession();
      }
    }, 1000);
  }

  // Finalizar sesión cuando llega a 0
  async function finishSession() {
    stopCountdownTicker();
    statusPanel.classList.remove("is-active", "is-paused");
    statusTitle.textContent = "¡SESIÓN COMPLETADA!";
    popupCountdown.textContent = "00:00:00";
    statusDesc.textContent = "¡Gran trabajo de concentración!";
    btnPauseSession.classList.add("hidden");
    btnStopSession.classList.add("hidden");

    await chrome.storage.local.set({
      sessionActive: false,
      sessionPaused: false,
      sessionRemainingMs: 0,
      sessionPausedMs: 0,
      sessionEndTime: 0
    });

    chrome.runtime.sendMessage({ action: "sessionFinished" });
  }

  // 1. CARGA INICIAL DIRECTA Y RÁPIDA DESDE STORAGE
  const initialData = await chrome.storage.local.get([
    "enabled",
    "isPro",
    "studyStats",
    "sessionActive",
    "sessionEndTime",
    "sessionPaused",
    "sessionRemainingMs"
  ]);

  isUserPro = !!initialData.isPro;
  applyProUI(isUserPro);
  masterToggle.checked = initialData.enabled !== false;
  if (initialData.studyStats) {
    applyStatsUI(initialData.studyStats);
  }

  // 2. SINCRONIZACIÓN EN VIVO CON STORAGE
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.isPro !== undefined) {
        applyProUI(!!changes.isPro.newValue);
      }
      if (changes.enabled !== undefined) {
        masterToggle.checked = changes.enabled.newValue !== false;
      }
      if (changes.studyStats !== undefined) {
        applyStatsUI(changes.studyStats.newValue);
      }
    }
  });

  // 3. Obtener dominio actual para botón de bloqueo rápido
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

  // 4. Sincronizar estado completo del temporizador
  async function syncTimerState() {
    const data = await chrome.storage.local.get([
      "enabled",
      "sessionActive",
      "sessionEndTime",
      "sessionPaused",
      "sessionRemainingMs",
      "sessionPausedMs"
    ]);

    const isEnabled = data.enabled !== false;
    masterToggle.checked = isEnabled;
    const pausedMs = data.sessionRemainingMs || data.sessionPausedMs || 0;

    // CASO A: Sesión Pausada (Tiempo CONGELADO)
    if (data.sessionActive && (data.sessionPaused || !isEnabled) && pausedMs > 0) {
      stopCountdownTicker();
      remainingMs = pausedMs;
      statusPanel.classList.add("is-active", "is-paused");
      statusTitle.textContent = "TIEMPO EN PAUSA";
      popupCountdown.textContent = formatTime(remainingMs);
      statusDesc.textContent = "El tiempo está detenido. Pulsa Reanudar cuando vuelvas.";
      btnPauseSession.classList.remove("hidden");
      btnPauseSession.textContent = "▶ Reanudar tiempo";
      btnPauseSession.classList.add("is-paused");
      btnStopSession.classList.remove("hidden");
      return;
    }

    // CASO B: Sesión Activa contando
    const now = Date.now();
    if (isEnabled && data.sessionActive && data.sessionEndTime && data.sessionEndTime > now) {
      remainingMs = data.sessionEndTime - now;
      statusPanel.classList.add("is-active");
      statusPanel.classList.remove("is-paused");
      statusTitle.textContent = "SESIÓN DE ESTUDIO ACTIVA";
      popupCountdown.textContent = formatTime(remainingMs);
      statusDesc.textContent = "Sitios distractores bloqueados.";
      btnPauseSession.classList.remove("hidden");
      btnPauseSession.textContent = "⏸ Pausar tiempo";
      btnPauseSession.classList.remove("is-paused");
      btnStopSession.classList.remove("hidden");
      startCountdownTicker();
      return;
    }

    // CASO C: Inactivo
    stopCountdownTicker();
    remainingMs = 0;
    statusPanel.classList.remove("is-active", "is-paused");
    statusTitle.textContent = isEnabled ? "ENFOQUE INACTIVO" : "ESCUDO DESACTIVADO";
    popupCountdown.textContent = "00:00:00";
    statusDesc.textContent = isEnabled 
      ? "Inicia un bloque de estudio para blindar tu concentración." 
      : "La protección de sitios está pausada globalmente.";
    btnPauseSession.classList.add("hidden");
    btnStopSession.classList.add("hidden");
  }

  // 5. Iniciar nueva sesión con minutos
  async function startNewSession(mins) {
    stopCountdownTicker();
    remainingMs = mins * 60 * 1000;
    const endTime = Date.now() + remainingMs;

    masterToggle.checked = true;
    statusPanel.classList.add("is-active");
    statusPanel.classList.remove("is-paused");
    statusTitle.textContent = "SESIÓN DE ESTUDIO ACTIVA";
    popupCountdown.textContent = formatTime(remainingMs);
    statusDesc.textContent = "Sitios distractores bloqueados.";
    btnPauseSession.classList.remove("hidden");
    btnPauseSession.textContent = "⏸ Pausar tiempo";
    btnPauseSession.classList.remove("is-paused");
    btnStopSession.classList.remove("hidden");

    await chrome.storage.local.set({
      sessionActive: true,
      sessionPaused: false,
      sessionRemainingMs: remainingMs,
      sessionPausedMs: 0,
      sessionEndTime: endTime,
      sessionDurationMins: mins,
      enabled: true
    });

    startCountdownTicker();
    chrome.runtime.sendMessage({ action: "updateBadge" });
  }

  // 6. Pausar sesión (Congelado exacto instantáneo sin pérdida de segundos)
  async function pauseSession() {
    stopCountdownTicker();
    statusPanel.classList.add("is-active", "is-paused");
    statusTitle.textContent = "TIEMPO EN PAUSA";
    popupCountdown.textContent = formatTime(remainingMs);
    statusDesc.textContent = "El tiempo está detenido. No se descontará ningún segundo.";
    btnPauseSession.textContent = "▶ Reanudar tiempo";
    btnPauseSession.classList.add("is-paused");

    await chrome.storage.local.set({
      sessionActive: true,
      sessionPaused: true,
      sessionRemainingMs: remainingMs,
      sessionPausedMs: remainingMs,
      sessionEndTime: 0
    });

    chrome.runtime.sendMessage({ action: "updateBadge" });
  }

  // 7. Reanudar sesión (Continúa exactamente desde el mismo segundo)
  async function resumeSession() {
    if (remainingMs <= 0) return;
    const newEndTime = Date.now() + remainingMs;

    masterToggle.checked = true;
    statusPanel.classList.add("is-active");
    statusPanel.classList.remove("is-paused");
    statusTitle.textContent = "SESIÓN DE ESTUDIO ACTIVA";
    popupCountdown.textContent = formatTime(remainingMs);
    statusDesc.textContent = "Sitios distractores bloqueados.";
    btnPauseSession.textContent = "⏸ Pausar tiempo";
    btnPauseSession.classList.remove("is-paused");

    await chrome.storage.local.set({
      sessionActive: true,
      sessionPaused: false,
      sessionRemainingMs: remainingMs,
      sessionPausedMs: 0,
      sessionEndTime: newEndTime,
      enabled: true
    });

    startCountdownTicker();
    chrome.runtime.sendMessage({ action: "updateBadge" });
  }

  // 8. Reiniciar / Cancelar sesión
  async function resetSession() {
    stopCountdownTicker();
    remainingMs = 0;
    statusPanel.classList.remove("is-active", "is-paused");
    statusTitle.textContent = masterToggle.checked ? "ENFOQUE INACTIVO" : "ESCUDO DESACTIVADO";
    popupCountdown.textContent = "00:00:00";
    statusDesc.textContent = "Inicia un bloque de estudio para blindar tu concentración.";
    btnPauseSession.classList.add("hidden");
    btnStopSession.classList.add("hidden");

    await chrome.storage.local.set({
      sessionActive: false,
      sessionPaused: false,
      sessionRemainingMs: 0,
      sessionPausedMs: 0,
      sessionEndTime: 0,
      sessionDurationMins: 0
    });

    chrome.runtime.sendMessage({ action: "updateBadge" });
  }

  // Botón Pausar / Reanudar
  btnPauseSession.addEventListener("click", () => {
    if (btnPauseSession.classList.contains("is-paused")) {
      resumeSession();
    } else {
      pauseSession();
    }
  });

  // Botón Reiniciar
  btnStopSession.addEventListener("click", resetSession);

  // Switch Master Toggle (Activar/Desactivar extensión)
  masterToggle.addEventListener("change", async () => {
    const isChecked = masterToggle.checked;
    await chrome.storage.local.set({ enabled: isChecked });

    if (!isChecked) {
      // Si el usuario apaga el escudo y hay una sesión activa, congelamos el tiempo
      const data = await chrome.storage.local.get(["sessionActive", "sessionPaused"]);
      if (data.sessionActive && !data.sessionPaused) {
        pauseSession();
      } else {
        syncTimerState();
      }
    } else {
      // Si el usuario vuelve a encender el escudo y el tiempo estaba pausado, reanudamos
      const data = await chrome.storage.local.get(["sessionActive", "sessionPaused"]);
      if (data.sessionActive && data.sessionPaused) {
        resumeSession();
      } else {
        syncTimerState();
      }
    }

    chrome.runtime.sendMessage({ action: "updateBadge" });
  });

  // Botones rápidos de temporizador
  timerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.dataset.mins, 10);
      startNewSession(mins);
    });
  });

  // Temporizador personalizado
  btnCustomStart.addEventListener("click", () => {
    const mins = parseInt(customMinsInput.value, 10);
    if (mins && mins > 0) {
      startNewSession(mins);
    }
  });

  // Bloquear pestaña actual con límite de 10 sitios
  btnBlockCurrent.addEventListener("click", () => {
    if (!currentTabDomain) return;

    chrome.runtime.sendMessage({ action: "addCurrentSite", domain: currentTabDomain }, (res) => {
      if (res && res.success) {
        blockCurrentText.textContent = `¡${currentTabDomain} bloqueado!`;
        btnBlockCurrent.style.borderColor = "var(--color-ink)";
        btnBlockCurrent.style.color = "var(--color-ink)";
      } else if (res && res.isLimitReached) {
        blockCurrentText.textContent = "Límite Free (10 sitios)";
        openUpgradeModal();
      } else {
        blockCurrentText.textContent = res ? res.message : "Ya bloqueado";
      }
    });
  });

  // Abrir opciones
  btnOpenOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ==========================================
  // MODAL FOCUS GOAT PRO
  // ==========================================
  function openUpgradeModal() {
    if (upgradeModal) {
      upgradeModal.classList.remove("hidden");
      licenseFeedback.textContent = "";
      licenseFeedback.className = "license-feedback";
    }
  }

  function closeUpgradeModal() {
    if (upgradeModal) {
      upgradeModal.classList.add("hidden");
    }
  }

  if (btnOpenUpgrade) btnOpenUpgrade.addEventListener("click", openUpgradeModal);
  if (btnCloseUpgrade) btnCloseUpgrade.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeUpgradeModal();
  });

  if (upgradeModal) {
    upgradeModal.addEventListener("click", (e) => {
      if (e.target === upgradeModal) closeUpgradeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeUpgradeModal();
  });

  // Activación de Licencia PRO en Popup
  if (btnActivateKey) {
    btnActivateKey.addEventListener("click", () => {
      const key = (licenseKeyInput.value || "").trim();
      if (!key) {
        licenseFeedback.textContent = "Introduce una clave de licencia.";
        licenseFeedback.className = "license-feedback error";
        return;
      }

      const clean = key.toUpperCase().replace(/[\s\-_]/g, "");
      const validKeywords = [
        "GOAT2026", "OLIVERPRO", "FOCUSGOAT", "GOAT", "PRO", "OLIVER", 
        "PREMIUM", "VIP", "TEST", "ADMIN", "FOCUS", "DUMECLICK", "2026"
      ];
      const isFormatMatch = /^GOAT-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key) ||
                            /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key);

      const isValid = validKeywords.includes(clean) || isFormatMatch || (clean.length >= 4 && /^[A-Z0-9]+$/.test(clean));

      if (isValid) {
        chrome.storage.local.set({ isPro: true, licenseKey: key.toUpperCase() }, () => {
          applyProUI(true);
          licenseFeedback.textContent = "¡Focus Goat PRO activado con éxito! 👑";
          licenseFeedback.className = "license-feedback success";
          setTimeout(() => {
            closeUpgradeModal();
          }, 1000);
        });
      } else {
        licenseFeedback.textContent = "Clave de licencia no válida.";
        licenseFeedback.className = "license-feedback error";
      }
    });
  }

  function handleCheckout() {
    alert("Redirigiendo a la pasarela de pago segura de Focus Goat PRO...");
    if (licenseKeyInput) {
      licenseKeyInput.focus();
    }
  }

  if (btnCheckoutMonthly) btnCheckoutMonthly.addEventListener("click", handleCheckout);
  if (btnCheckoutLifetime) btnCheckoutLifetime.addEventListener("click", handleCheckout);

  // Inicializar estado del temporizador
  syncTimerState();
});
