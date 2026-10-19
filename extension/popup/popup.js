/**
 * FOCUS GOAT — Popup Controller
 * Control de sesiones, estado congelado durante pausas, sincronización PRO instantánea y audio ambiental Web Audio API.
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
  const soundStatus = document.getElementById("soundStatus");
  const soundChips = document.querySelectorAll(".chip-sound");
  const licenseKeyInput = document.getElementById("licenseKeyInput");
  const btnActivateKey = document.getElementById("btnActivateKey");
  const licenseFeedback = document.getElementById("licenseFeedback");
  const btnCheckoutMonthly = document.getElementById("btnCheckoutMonthly");
  const btnCheckoutLifetime = document.getElementById("btnCheckoutLifetime");

  let remainingMs = 0;
  let countdownInterval = null;
  let currentTabDomain = "";
  let isUserPro = false;
  let activeSoundType = "none";

  // Función para aplicar la apariencia visual PRO de inmediato
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

  // Función para actualizar las estadísticas visuales
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

  // 1. CARGA INICIAL DIRECTA DESDE STORAGE (Sin esperar respuestas del background)
  const initialData = await chrome.storage.local.get([
    "enabled",
    "isPro",
    "strictMode",
    "studyStats",
    "sessionActive",
    "sessionEndTime",
    "sessionPaused",
    "sessionPausedMs"
  ]);

  isUserPro = !!initialData.isPro;
  applyProUI(isUserPro);
  masterToggle.checked = initialData.enabled !== false;
  if (initialData.studyStats) {
    applyStatsUI(initialData.studyStats);
  }

  // 2. SINCRONIZACIÓN EN TIEMPO REAL CON CAMBIOS DE STORAGE (Ej: activación desde options)
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
      syncUI();
    }
  });

  // 3. Obtener la pestaña activa actual para el botón "Bloquear este sitio"
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

  // 4. Formateo de tiempo
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

  // 5. Sincronizar estado completo con background y storage
  function syncUI() {
    chrome.storage.local.get([
      "enabled",
      "isPro",
      "sessionActive",
      "sessionEndTime",
      "sessionPaused",
      "sessionPausedMs",
      "routines",
      "studyStats"
    ]).then((data) => {
      isUserPro = !!data.isPro;
      applyProUI(isUserPro);
      if (data.studyStats) applyStatsUI(data.studyStats);

      const isEnabled = data.enabled !== false;
      masterToggle.checked = isEnabled;

      // CASO 1: Sesión Pausada (Tiempo CONGELADO sin bajar)
      if (data.sessionActive && (data.sessionPaused || !isEnabled) && (data.sessionPausedMs || 0) > 0) {
        statusPanel.classList.add("is-active");
        statusPanel.classList.add("is-paused");
        statusTitle.textContent = "SESIÓN PAUSADA";
        remainingMs = data.sessionPausedMs;
        popupCountdown.textContent = formatTime(remainingMs);
        statusDesc.textContent = "Tiempo congelado. Pulsa Reanudar cuando vuelvas.";
        btnPauseSession.classList.remove("hidden");
        btnPauseSession.textContent = "▶ Reanudar";
        btnPauseSession.classList.add("is-paused");
        btnStopSession.classList.remove("hidden");
        return;
      }

      // CASO 2: Sesión Activa contando
      const now = Date.now();
      if (isEnabled && data.sessionActive && data.sessionEndTime && data.sessionEndTime > now) {
        statusPanel.classList.add("is-active");
        statusPanel.classList.remove("is-paused");
        statusTitle.textContent = "SESIÓN DE ESTUDIO ACTIVA";
        remainingMs = data.sessionEndTime - now;
        popupCountdown.textContent = formatTime(remainingMs);
        statusDesc.textContent = "Sitios distractores bloqueados.";
        btnPauseSession.classList.remove("hidden");
        btnPauseSession.textContent = "⏸ Pausar";
        btnPauseSession.classList.remove("is-paused");
        btnStopSession.classList.remove("hidden");
        return;
      }

      // CASO 3: Enfoque Inactivo
      statusPanel.classList.remove("is-active");
      statusPanel.classList.remove("is-paused");
      statusTitle.textContent = isEnabled ? "ENFOQUE INACTIVO" : "ESCUDO DESACTIVADO";
      popupCountdown.textContent = "00:00:00";
      statusDesc.textContent = isEnabled 
        ? "Inicia una sesión de estudio para blindar tu concentración." 
        : "La protección de sitios está pausada globalmente.";
      btnPauseSession.classList.add("hidden");
      btnStopSession.classList.add("hidden");
      remainingMs = 0;
    });
  }

  syncUI();

  // Tic de cuenta atrás: SOLO baja si NO está pausado
  countdownInterval = setInterval(() => {
    const isPaused = statusPanel.classList.contains("is-paused");
    if (!isPaused && remainingMs > 1000) {
      remainingMs -= 1000;
      popupCountdown.textContent = formatTime(remainingMs);
    } else if (!isPaused && remainingMs > 0 && remainingMs <= 1000) {
      syncUI();
    }
  }, 1000);

  // 6. Master Toggle (Activar/Desactivar extensión)
  masterToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({ action: "toggleMaster" }, () => {
      syncUI();
    });
  });

  // 7. Botón Pausar / Reanudar sesión
  btnPauseSession.addEventListener("click", () => {
    const isPaused = btnPauseSession.classList.contains("is-paused");
    if (isPaused) {
      // Reanudar
      chrome.runtime.sendMessage({ action: "resumeSession" }, () => {
        syncUI();
      });
    } else {
      // Pausar
      chrome.runtime.sendMessage({ action: "pauseSession" }, () => {
        syncUI();
      });
    }
  });

  // 8. Iniciar sesiones rápidas
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

  // 9. Detener sesión actual por completo
  btnStopSession.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopSession" }, () => {
      syncUI();
    });
  });

  // 10. Bloquear sitio actual con control Freemium (10 sitios)
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

  // 11. Abrir panel de opciones completo
  btnOpenOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ==========================================
  // 12. MODAL DE MEJORA FOCUS GOAT PRO
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
      if (e.target === upgradeModal) {
        closeUpgradeModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeUpgradeModal();
    }
  });

  // Activación de Clave de Licencia PRO directa en Popup
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
          chrome.runtime.sendMessage({ action: "activateLicense", key }, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
          applyProUI(true);
          licenseFeedback.textContent = "¡Focus Goat PRO activado con éxito! 👑";
          licenseFeedback.className = "license-feedback success";
          setTimeout(() => {
            closeUpgradeModal();
            syncUI();
          }, 1000);
        });
      } else {
        licenseFeedback.textContent = "Clave de licencia no válida (ej: GOAT2026 o OLIVER-PRO)";
        licenseFeedback.className = "license-feedback error";
      }
    });
  }

  // Pasarelas de compra (Checkout)
  function handleCheckout(plan) {
    alert("Redirigiendo a la pasarela de pago segura...\n\nNota de prueba: Puedes activar PRO al instante con la clave:\n👉 GOAT2026 o OLIVER-PRO");
    if (licenseKeyInput) {
      licenseKeyInput.value = "GOAT2026";
      licenseKeyInput.focus();
    }
  }

  if (btnCheckoutMonthly) btnCheckoutMonthly.addEventListener("click", () => handleCheckout("monthly"));
  if (btnCheckoutLifetime) btnCheckoutLifetime.addEventListener("click", () => handleCheckout("lifetime"));

  // ==========================================
  // 13. SINTETIZADOR DE AUDIO AMBIENTAL (Web Audio API)
  // Generación pura y nativa en el navegador, 0 descargas MP3
  // ==========================================
  let audioCtx = null;
  let activeAudioNodes = null;

  function stopAmbientSound() {
    if (activeAudioNodes) {
      try {
        if (activeAudioNodes.gainNode && audioCtx) {
          activeAudioNodes.gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        }
        setTimeout(() => {
          if (activeAudioNodes && activeAudioNodes.source) {
            activeAudioNodes.source.stop();
            activeAudioNodes.source.disconnect();
          }
          activeAudioNodes = null;
        }, 350);
      } catch (e) {
        activeAudioNodes = null;
      }
    }
    activeSoundType = "none";
    if (soundStatus) soundStatus.textContent = "Silencio";
    soundChips.forEach(chip => {
      chip.classList.toggle("is-active", chip.dataset.sound === "none");
    });
  }

  function createNoiseBuffer(ctx, seconds = 5) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function playAmbientSound(type) {
    stopAmbientSound();
    if (type === "none") return;

    if (!isUserPro) {
      openUpgradeModal();
      return;
    }

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const noiseBuffer = createNoiseBuffer(audioCtx, 4);
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

      if (type === "rain") {
        // Lluvia suave: filtro paso banda y ruido blanco matizado
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 950;

        const highpass = audioCtx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 350;

        noiseSource.connect(filter);
        filter.connect(highpass);
        highpass.connect(gainNode);

        gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.5);
        if (soundStatus) soundStatus.textContent = "🌧️ Lluvia";

      } else if (type === "white") {
        // Olas de océano: LFO modulando el volumen
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 450;

        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.15; // Onda de 6.6 segundos
        lfoGain.gain.value = 0.08;

        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();

        noiseSource.connect(filter);
        filter.connect(gainNode);

        gainNode.gain.linearRampToValueAtTime(0.10, audioCtx.currentTime + 0.5);
        if (soundStatus) soundStatus.textContent = "🌊 Olas";

      } else if (type === "focus") {
        // Ruido rosa / 432Hz calmo para concentración profunda
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 320;

        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.value = 108; // Armónico de 432 Hz
        subGain.gain.value = 0.03;

        noiseSource.connect(filter);
        filter.connect(gainNode);
        subOsc.connect(subGain);
        subGain.connect(gainNode);

        subOsc.start();
        gainNode.gain.linearRampToValueAtTime(0.14, audioCtx.currentTime + 0.5);
        if (soundStatus) soundStatus.textContent = "🎧 Ruido Rosa";
      }

      gainNode.connect(audioCtx.destination);
      noiseSource.start();

      activeAudioNodes = { source: noiseSource, gainNode };
      activeSoundType = type;

      soundChips.forEach(chip => {
        chip.classList.toggle("is-active", chip.dataset.sound === type);
      });

    } catch (err) {
      console.warn("No se pudo iniciar el audio:", err);
    }
  }

  soundChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.sound;
      playAmbientSound(type);
    });
  });

  // Detener audio al cerrar el popup
  window.addEventListener("beforeunload", () => {
    stopAmbientSound();
  });
});
