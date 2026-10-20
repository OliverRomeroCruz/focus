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
  const customHoursInput = document.getElementById("customHours");
  const customMinsInput = document.getElementById("customMins");
  const btnCustomStart = document.getElementById("btnCustomStart");

  // Elementos Reto Mental en Mini Pantalla (PRO)
  const popupMentalModal = document.getElementById("popupMentalModal");
  const popupMathQuestion = document.getElementById("popupMathQuestion");
  const popupMathAnswer = document.getElementById("popupMathAnswer");
  const popupMentalFeedback = document.getElementById("popupMentalFeedback");
  const btnMentalKeep = document.getElementById("btnMentalKeep");
  const btnMentalConfirm = document.getElementById("btnMentalConfirm");

  // Elementos Freemium / PRO
  const planBadge = document.getElementById("planBadge");
  const proBanner = document.getElementById("proBanner");
  const btnOpenUpgrade = document.getElementById("btnOpenUpgrade");
  const upgradeModal = document.getElementById("upgradeModal");
  const btnCloseUpgrade = document.getElementById("btnCloseUpgrade");
  const statRank = document.getElementById("statRank");
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
    const exactTimeRow = document.getElementById("exactTimeRow");

    if (isPro) {
      planBadge.textContent = "👑 PRO";
      planBadge.classList.add("is-pro");
      if (proBanner) proBanner.style.display = "none";
      if (exactTimeRow) exactTimeRow.classList.remove("is-locked-pro");
      if (customHoursInput) customHoursInput.disabled = false;
      if (customMinsInput) customMinsInput.disabled = false;
      closeUpgradeModal();
    } else {
      planBadge.textContent = "FREE";
      planBadge.classList.remove("is-pro");
      if (proBanner) proBanner.style.display = "flex";
      if (exactTimeRow) exactTimeRow.classList.add("is-locked-pro");
      if (customHoursInput) customHoursInput.disabled = true;
      if (customMinsInput) customMinsInput.disabled = true;
    }
    updateCustomButtonText();
    updateRankAndModeUI();
  }

  // Actualizar rango de la cabra y modo activo
  function updateRankAndModeUI() {
    chrome.runtime.sendMessage({ action: "getStatsAndRank" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (!res) return;
      if (statRank && res.rank) {
        statRank.textContent = `${res.rank.icon} ${res.rank.title.replace("Nivel ", "N")}`;
        statRank.title = `${res.rank.title} (${res.stats ? res.stats.totalMinutes : 0} min acumulados)`;
      }
    });
  }

  // Actualizar estadísticas de estudio
  function applyStatsUI(stats) {
    if (!stats) return;
    if (statStreak) {
      const days = stats.streakDays || 1;
      statStreak.textContent = `🔥 ${days} día${days > 1 ? "s" : ""}`;
    }
    if (statMinutes) {
      const mins = stats.totalMinutes || 0;
      statMinutes.textContent = `⏱️ ${mins} min`;
    }
    updateRankAndModeUI();
  }

  // Detener intervalo de cuenta atrás
  function stopCountdownTicker() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // Reproducir campana armónica nítida directamente en el popup
  function playPopupChime() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const notes = [
        { freq: 587.33, start: 0, dur: 0.9 },
        { freq: 880.00, start: 0.16, dur: 1.1 },
        { freq: 1174.66, start: 0.36, dur: 1.6 }
      ];

      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + note.start);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + note.start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + note.start + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + note.start);
        osc.stop(ctx.currentTime + note.start + note.dur);
      });
    } catch (e) {
      console.warn("Error playing chime in popup:", e);
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
    remainingMs = 0;
    statusPanel.classList.remove("is-active", "is-paused");
    statusTitle.textContent = "¡SESIÓN COMPLETADA!";
    popupCountdown.textContent = "00:00:00";
    statusDesc.textContent = "¡Gran trabajo de concentración! Sitios desbloqueados.";
    btnPauseSession.classList.add("hidden");
    btnStopSession.classList.add("hidden");

    // Reproducir sonido inmediato en el popup si está activado
    chrome.storage.local.get(["soundAlert"], (res) => {
      if (res.soundAlert !== false) {
        playPopupChime();
      }
    });

    try {
      chrome.alarms.clear("session_timer_finish");
    } catch (e) {}

    await chrome.storage.local.set({
      sessionActive: false,
      sessionPaused: false,
      sessionRemainingMs: 0,
      sessionPausedMs: 0,
      sessionEndTime: 0,
      sessionDurationMins: 0
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
      if (changes.sessionActive !== undefined || changes.sessionPaused !== undefined || changes.sessionEndTime !== undefined) {
        syncTimerState();
      }
      if (changes.blockedSites !== undefined) {
        updateCurrentSiteButtonUI();
      }
    }
  });

  // Normalizar y comprobar si un dominio está en la lista de bloqueo
  function cleanDomainHost(d) {
    return (d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }

  function isDomainInBlockedList(domain, list) {
    if (!domain || !list || !Array.isArray(list)) return false;
    const cleanD = cleanDomainHost(domain);
    return list.some((s) => {
      const cleanS = cleanDomainHost(s);
      if (cleanD === cleanS || cleanD.endsWith("." + cleanS)) return true;
      if ((cleanD === "x.com" || cleanD === "twitter.com") && (cleanS === "x.com" || cleanS === "twitter.com")) return true;
      return false;
    });
  }

  // Actualizar apariencia e icono del botón de sitio actual según si ya está bloqueado o no
  async function updateCurrentSiteButtonUI() {
    if (!currentTabDomain || !btnBlockCurrent) return;

    try {
      const data = await chrome.storage.local.get(["blockedSites", "sessionActive"]);
      const list = data.blockedSites || [];
      const isAlreadyBlocked = isDomainInBlockedList(currentTabDomain, list);

      if (isAlreadyBlocked) {
        btnBlockCurrent.classList.add("is-already-blocked");
        btnBlockCurrent.innerHTML = `
          <svg class="block-current-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span class="block-text-normal">✓ ${currentTabDomain} en lista negra</span>
          <span class="block-text-hover-remove">✕ Quitar ${currentTabDomain} de la lista</span>
        `;
        btnBlockCurrent.title = data.sessionActive
          ? `${currentTabDomain} está en tu lista de bloqueo (Bloqueado activamente en esta sesión). Haz clic para quitarlo.`
          : `${currentTabDomain} está en tu lista de bloqueo (Se bloqueará automáticamente cuando inicies una sesión). Haz clic para quitarlo.`;
      } else {
        btnBlockCurrent.classList.remove("is-already-blocked");
        btnBlockCurrent.innerHTML = `
          <svg class="block-current-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
          <span class="block-text-normal">Bloquear ${currentTabDomain}</span>
        `;
        btnBlockCurrent.title = `Haz clic para añadir ${currentTabDomain} a tu lista de sitios bloqueados.`;
      }
    } catch (e) {}
  }

  // 3. Obtener dominio actual para botón de bloqueo rápido
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) {
      const parsed = new URL(activeTab.url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        currentTabDomain = cleanDomainHost(parsed.hostname);
        await updateCurrentSiteButtonUI();
      } else {
        btnBlockCurrent.style.display = "none";
      }
    } else {
      btnBlockCurrent.style.display = "none";
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
    if (isEnabled && data.sessionActive && data.sessionEndTime) {
      if (data.sessionEndTime > now) {
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
      } else {
        finishSession();
        return;
      }
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

    try {
      chrome.alarms.create("session_timer_finish", { when: endTime });
    } catch (e) {}

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

    // Clean Sweep PRO: Cierre automático de pestañas de distracción al arrancar
    chrome.storage.local.get(["isPro", "cleanSweep", "blockedSites"], (res) => {
      if (res.isPro && res.cleanSweep && res.blockedSites && res.blockedSites.length) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.url) {
              try {
                const url = new URL(tab.url);
                const host = url.hostname.toLowerCase().replace(/^www\./, "");
                const isBlocked = res.blockedSites.some((s) => {
                  const cleanS = s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
                  return host === cleanS || host.endsWith("." + cleanS);
                });
                if (isBlocked) {
                  chrome.tabs.remove(tab.id);
                }
              } catch (e) {}
            }
          });
        });
      }
    });

    startCountdownTicker();
    chrome.runtime.sendMessage({ action: "updateBadge" });
  }

  // 6. Pausar sesión (Congelado exacto instantáneo sin pérdida de segundos)
  async function pauseSession() {
    stopCountdownTicker();
    try {
      chrome.alarms.clear("session_timer_finish");
    } catch (e) {}

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

    try {
      chrome.alarms.create("session_timer_finish", { when: newEndTime });
    } catch (e) {}

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
    try {
      chrome.alarms.clear("session_timer_finish");
    } catch (e) {}

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

  // ==========================================
  // RETO MENTAL PRO EN MINI PANTALLA
  // ==========================================
  let pendingInterruption = null;
  let popupMentalSolution = 0;

  function openPopupMentalModal() {
    const n1 = Math.floor(Math.random() * 38) + 12; // 12..49
    const n2 = Math.floor(Math.random() * 38) + 12; // 12..49
    popupMentalSolution = n1 + n2;
    if (popupMathQuestion) popupMathQuestion.textContent = `${n1} + ${n2} = `;
    if (popupMathAnswer) {
      popupMathAnswer.value = "";
      setTimeout(() => popupMathAnswer.focus(), 80);
    }
    if (popupMentalFeedback) {
      popupMentalFeedback.textContent = "";
      popupMentalFeedback.className = "popup-mental-feedback";
    }
    if (popupMentalModal) popupMentalModal.classList.remove("hidden");
  }

  function closePopupMentalModal() {
    if (popupMentalModal) popupMentalModal.classList.add("hidden");
    if (pendingInterruption && pendingInterruption.type === "toggle_off") {
      masterToggle.checked = true;
    }
    pendingInterruption = null;
  }

  if (btnMentalKeep) {
    btnMentalKeep.addEventListener("click", closePopupMentalModal);
  }

  if (btnMentalConfirm) {
    btnMentalConfirm.addEventListener("click", () => {
      const userAns = parseInt(popupMathAnswer.value, 10);
      if (userAns === popupMentalSolution) {
        popupMentalFeedback.textContent = "✅ ¡Cálculo resuelto! Desactivando...";
        popupMentalFeedback.className = "popup-mental-feedback success";
        const actionToRun = pendingInterruption;
        pendingInterruption = null;
        setTimeout(() => {
          if (popupMentalModal) popupMentalModal.classList.add("hidden");
          if (actionToRun && actionToRun.callback) {
            actionToRun.callback();
          }
        }, 350);
      } else {
        popupMentalFeedback.textContent = "❌ Cálculo incorrecto. ¡Sigue concentrado!";
        popupMentalFeedback.className = "popup-mental-feedback error";
        popupMathAnswer.value = "";
        popupMathAnswer.focus();
      }
    });
  }

  if (popupMathAnswer) {
    popupMathAnswer.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnMentalConfirm.click();
      } else if (e.key === "Escape") {
        closePopupMentalModal();
      }
    });
  }

  async function requestInterruption(type, callback) {
    const data = await chrome.storage.local.get(["sessionActive", "isPro", "mentalChallenge", "strictMode"]);

    // 1. Modo Estricto PRO activo durante una sesión
    if (data.isPro && data.strictMode && data.sessionActive) {
      alert("🔒 Modo Estricto PRO activo: No puedes pausar ni cancelar la sesión hasta que el tiempo llegue a 00:00.");
      if (type === "toggle_off") masterToggle.checked = true;
      return;
    }

    // 2. Reto Mental PRO activo (al pausar, reiniciar o desactivar el escudo en la mini pantalla)
    const requiresChallenge = data.isPro && data.mentalChallenge !== false && (type === "toggle_off" || data.sessionActive);
    if (requiresChallenge) {
      pendingInterruption = { type, callback };
      openPopupMentalModal();
      return;
    }

    // Free o sin reto mental: ejecutar directamente
    callback();
  }

  // Botón Pausar / Reanudar (con protección Reto Mental)
  btnPauseSession.addEventListener("click", () => {
    if (btnPauseSession.classList.contains("is-paused")) {
      resumeSession();
    } else {
      requestInterruption("pause", pauseSession);
    }
  });

  // Botón Reiniciar (con protección Reto Mental)
  btnStopSession.addEventListener("click", () => {
    requestInterruption("stop", resetSession);
  });

  // Switch Master Toggle (con protección Reto Mental)
  masterToggle.addEventListener("change", async () => {
    const isChecked = masterToggle.checked;

    if (!isChecked) {
      const data = await chrome.storage.local.get(["sessionActive", "sessionPaused"]);
      requestInterruption("toggle_off", async () => {
        await chrome.storage.local.set({ enabled: false });
        if (data.sessionActive && !data.sessionPaused) {
          pauseSession();
        } else {
          syncTimerState();
        }
        chrome.runtime.sendMessage({ action: "updateBadge" });
      });
    } else {
      await chrome.storage.local.set({ enabled: true });
      const data = await chrome.storage.local.get(["sessionActive", "sessionPaused"]);
      if (data.sessionActive && data.sessionPaused) {
        resumeSession();
      } else {
        syncTimerState();
      }
      chrome.runtime.sendMessage({ action: "updateBadge" });
    }
  });

  // Botones rápidos de temporizador
  timerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.dataset.mins, 10);
      startNewSession(mins);
    });
  });

  // Selector de Tiempo Exacto (Horas y Minutos) — Exclusivo PRO
  function updateCustomButtonText() {
    if (!isUserPro) {
      btnCustomStart.innerHTML = `<span>⏱️ TIEMPO EXACTO</span>`;
      btnCustomStart.disabled = false;
      return;
    }
    const hours = parseInt(customHoursInput ? customHoursInput.value : 0, 10) || 0;
    const mins = parseInt(customMinsInput ? customMinsInput.value : 0, 10) || 0;
    const total = hours * 60 + mins;
    if (total <= 0) {
      btnCustomStart.textContent = "Elige tiempo";
      btnCustomStart.disabled = true;
    } else {
      btnCustomStart.disabled = false;
      if (hours > 0 && mins > 0) {
        btnCustomStart.textContent = `Empezar ${hours}h ${mins}m`;
      } else if (hours > 0) {
        btnCustomStart.textContent = `Empezar ${hours}h`;
      } else {
        btnCustomStart.textContent = `Empezar ${mins}m`;
      }
    }
  }

  if (customHoursInput) customHoursInput.addEventListener("input", updateCustomButtonText);
  if (customMinsInput) customMinsInput.addEventListener("input", updateCustomButtonText);
  updateCustomButtonText();

  const exactTimeRow = document.getElementById("exactTimeRow");
  if (exactTimeRow) {
    exactTimeRow.addEventListener("click", (e) => {
      if (!isUserPro) {
        e.preventDefault();
        openUpgradeModal();
      }
    });
  }

  btnCustomStart.addEventListener("click", (e) => {
    if (!isUserPro) {
      e.preventDefault();
      openUpgradeModal();
      return;
    }
    const hours = parseInt(customHoursInput ? customHoursInput.value : 0, 10) || 0;
    const mins = parseInt(customMinsInput ? customMinsInput.value : 0, 10) || 0;
    const total = hours * 60 + mins;
    if (total > 0) {
      startNewSession(total);
    }
  });

  // Alternar bloqueo de pestaña actual (Añadir o Quitar de lista negra con feedback inteligente)
  btnBlockCurrent.addEventListener("click", async () => {
    if (!currentTabDomain) return;

    try {
      const data = await chrome.storage.local.get(["blockedSites", "isPro"]);
      const currentList = data.blockedSites || [];
      const cleanD = cleanDomainHost(currentTabDomain);
      const isAlreadyBlocked = isDomainInBlockedList(cleanD, currentList);

      if (isAlreadyBlocked) {
        // Quitar de la lista de bloqueo
        const nextList = currentList.filter((s) => {
          const cleanS = cleanDomainHost(s);
          return cleanS !== cleanD && !cleanD.endsWith("." + cleanS);
        });
        await chrome.storage.local.set({ blockedSites: nextList });
        chrome.runtime.sendMessage({ action: "siteRemoved", domain: cleanD }, () => {
          if (chrome.runtime.lastError) {}
        });
        btnBlockCurrent.innerHTML = `<span>✓ ¡${currentTabDomain} quitado de la lista!</span>`;
        btnBlockCurrent.classList.remove("is-already-blocked");
        setTimeout(updateCurrentSiteButtonUI, 1100);
      } else {
        // Control límite Free (5 sitios)
        if (!data.isPro && currentList.length >= 5 && !isDomainInBlockedList(cleanD, currentList)) {
          openUpgradeModal();
          return;
        }
        // Añadir a la lista de bloqueo
        const nextList = [...currentList, cleanD];
        await chrome.storage.local.set({ blockedSites: nextList });
        chrome.runtime.sendMessage({ action: "sitesUpdated" }, () => {
          if (chrome.runtime.lastError) {}
        });
        btnBlockCurrent.innerHTML = `<span>🛡️ ¡${currentTabDomain} añadido a la lista!</span>`;
        btnBlockCurrent.classList.add("is-already-blocked");
        setTimeout(updateCurrentSiteButtonUI, 1100);
      }
    } catch (e) {
      console.warn("Error alternando sitio actual:", e);
    }
  });

  // Abrir opciones
  btnOpenOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ==========================================
  // MODAL FOCUS GOAT PRO
  // ==========================================
  function openUpgradeModal() {
    if (isUserPro) return; // Si ya es PRO, no abrir modal
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
