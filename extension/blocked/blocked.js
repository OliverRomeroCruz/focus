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
  const proChallengeBox = document.getElementById("proChallengeBox");
  const mathQuestion = document.getElementById("mathQuestion");
  const mathAnswer = document.getElementById("mathAnswer");
  const mathFeedback = document.getElementById("mathFeedback");

  // Cargar Rango de la Cabra
  chrome.runtime.sendMessage({ action: "getStatsAndRank" }, (res) => {
    if (res && res.rank && blockedGoatRank) {
      blockedGoatRank.textContent = `${res.rank.icon} ${res.rank.title}`;
    }
  });

  // Mostrar el motivo y dominio del bloqueo
  const reason = urlParams.get("reason") || "blacklist";
  if (reason === "shorts") {
    blockedTargetEl.textContent = "YOUTUBE SHORTS (BLOQUEO QUIRÚRGICO)";
    eyebrowTargetEl.textContent = "POZO DE DISTRACCIÓN DETECTADO (PRO)";
  } else if (reason === "whitelist") {
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname.replace(/^www\./, "");
      blockedTargetEl.textContent = `MODO SOLO ESTUDIO: ${host.toUpperCase()}`;
      eyebrowTargetEl.textContent = "SITIO NO AUTORIZADO EN TUS APUNTES";
    } catch (e) {
      blockedTargetEl.textContent = "MODO SOLO ESTUDIO";
      eyebrowTargetEl.textContent = "SITIO NO AUTORIZADO";
    }
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

  syncTimer();

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
    window.close();
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 200);
  });

  // Modal de pausa de emergencia (Freno 10s para Free o Reto Mental para PRO)
  let emergencyInterval = null;
  let currentSolution = null;

  btnUnlockEmergency.addEventListener("click", () => {
    if (isStrict) {
      alert("Modo Estricto PRO activo:\n\nTu sesión de concentración está blindada y no admite pausas de emergencia. ¡Termina tu bloque de estudio!");
      return;
    }

    const isUserPro = urlParams.get("isPro") === "1";
    emergencyModal.classList.remove("hidden");
    btnConfirmEmergency.disabled = true;

    if (isUserPro) {
      // MODO PRO: Reto Mental Antiprocrastinación
      if (freeFrictionBox) freeFrictionBox.classList.add("hidden");
      if (proChallengeBox) proChallengeBox.classList.remove("hidden");

      const num1 = Math.floor(Math.random() * 25) + 14;
      const num2 = Math.floor(Math.random() * 25) + 11;
      currentSolution = num1 + num2;

      if (mathQuestion) mathQuestion.textContent = `${num1} + ${num2} = `;
      if (mathAnswer) {
        mathAnswer.value = "";
        setTimeout(() => mathAnswer.focus(), 100);
      }
      if (mathFeedback) {
        mathFeedback.textContent = "Resuelve el cálculo para desbloquear la salida";
        mathFeedback.style.color = "var(--color-ink-muted)";
      }

      mathAnswer.oninput = () => {
        const val = parseInt(mathAnswer.value.trim(), 10);
        if (val === currentSolution) {
          mathFeedback.textContent = "✓ ¡Cálculo correcto! Puedes desactivar el bloqueo.";
          mathFeedback.style.color = "#10B981";
          btnConfirmEmergency.disabled = false;
        } else {
          mathFeedback.textContent = "Cálculo incorrecto. Sigue intentando...";
          mathFeedback.style.color = "#EF4444";
          btnConfirmEmergency.disabled = true;
        }
      };

    } else {
      // MODO FREE: Freno Consciente de 10 segundos
      if (proChallengeBox) proChallengeBox.classList.add("hidden");
      if (freeFrictionBox) freeFrictionBox.classList.remove("hidden");

      let count = 10;
      emergencySecondsEl.textContent = count;

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
    }
  });

  btnCancelEmergency.addEventListener("click", () => {
    if (emergencyInterval) clearInterval(emergencyInterval);
    emergencyModal.classList.add("hidden");
  });

  btnConfirmEmergency.addEventListener("click", () => {
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
