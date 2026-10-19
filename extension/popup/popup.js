/**
 * FOCUS GOAT — Popup Controller
 * Control de sesiones, monetización PRO, sintetizador de audio ambiental Web Audio API y estadísticas.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos principales
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

      // Actualizar estado PRO
      isUserPro = !!status.isPro;
      if (isUserPro) {
        planBadge.textContent = "👑 PRO";
        planBadge.classList.add("is-pro");
        if (proBanner) proBanner.style.display = "none";
      } else {
        planBadge.textContent = "FREE";
        planBadge.classList.remove("is-pro");
        if (proBanner) proBanner.style.display = "flex";
      }

      // Actualizar estadísticas de estudio
      if (status.studyStats) {
        if (statStreak) {
          const days = status.studyStats.streakDays || 1;
          statStreak.textContent = `🔥 ${days} día${days > 1 ? "s" : ""} racha`;
        }
        if (statMinutes) {
          const mins = status.studyStats.totalMinutes || 0;
          statMinutes.textContent = `⏱️ ${mins} min enfocados`;
        }
      }

      // Estado de enfoque
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

  // 7. Bloquear sitio actual con control Freemium
  btnBlockCurrent.addEventListener("click", () => {
    if (!currentTabDomain) return;

    chrome.runtime.sendMessage({ action: "addCurrentSite", domain: currentTabDomain }, (res) => {
      if (res && res.success) {
        blockCurrentText.textContent = `¡${currentTabDomain} bloqueado!`;
        btnBlockCurrent.style.borderColor = "var(--color-ink)";
        btnBlockCurrent.style.color = "var(--color-ink)";
      } else if (res && res.isLimitReached) {
        blockCurrentText.textContent = "Límite Free (5 sitios)";
        openUpgradeModal();
      } else {
        blockCurrentText.textContent = res ? res.message : "Ya bloqueado";
      }
    });
  });

  // 8. Abrir panel de opciones completo
  btnOpenOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ==========================================
  // 9. MODAL DE MEJORA FOCUS GOAT PRO
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

  // Activación de Clave de Licencia PRO
  if (btnActivateKey) {
    btnActivateKey.addEventListener("click", () => {
      const key = (licenseKeyInput.value || "").trim();
      if (!key) {
        licenseFeedback.textContent = "Introduce una clave de licencia.";
        licenseFeedback.className = "license-feedback error";
        return;
      }

      chrome.runtime.sendMessage({ action: "activateLicense", key }, (res) => {
        if (res && res.success) {
          licenseFeedback.textContent = "¡Focus Goat PRO activado con éxito! 👑";
          licenseFeedback.className = "license-feedback success";
          setTimeout(() => {
            closeUpgradeModal();
            syncUI();
          }, 1200);
        } else {
          licenseFeedback.textContent = res ? res.message : "Clave no válida.";
          licenseFeedback.className = "license-feedback error";
        }
      });
    });
  }

  // Pasarelas de compra (Checkout)
  function handleCheckout(plan) {
    const testHint = "Redirigiendo a la pasarela de pago segura...\n\nNota de prueba: Puedes activar PRO al instante con la clave:\n👉 GOAT2026 o OLIVER-PRO";
    alert(testHint);
    if (licenseKeyInput) {
      licenseKeyInput.value = "GOAT2026";
      licenseKeyInput.focus();
    }
  }

  if (btnCheckoutMonthly) btnCheckoutMonthly.addEventListener("click", () => handleCheckout("monthly"));
  if (btnCheckoutLifetime) btnCheckoutLifetime.addEventListener("click", () => handleCheckout("lifetime"));

  // ==========================================
  // 10. SINTETIZADOR DE AUDIO AMBIENTAL (Web Audio API)
  // Generación pura y nativa en el navegador, 0 descargas MP3
  // ==========================================
  let audioCtx = null;
  let activeAudioNodes = null;

  function stopAmbientSound() {
    if (activeAudioNodes) {
      try {
        if (activeAudioNodes.gainNode) {
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
