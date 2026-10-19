/**
 * FOCUS GOAT — Service Worker (Manifest V3)
 * Gestión de sesiones, rutinas semanales, límites Freemium y sistema Focus Goat PRO.
 */

const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com"
];

const DEFAULT_QUOTES = [
  "El dolor de la disciplina pesa gramos; el del arrepentimiento, toneladas.",
  "¿De verdad vas a tirar tu progreso por 5 minutos de dopamina barata?",
  "Los que no tienen metas trabajan para los que sí las tienen. Concéntrate.",
  "Lo que hagas hoy en silencio gritará mañana en tus resultados.",
  "Los mediocres se distraen. Los GOATs construyen su legado.",
  "Cierra esta pestaña. Tu futuro yo te lo agradecerá eternamente.",
  "El examen o proyecto no se va a aprobar solo. Vuelve a la mesa.",
  "No te detengas cuando estés cansado, detente cuando hayas terminado.",
  "ARE you sure? La grandeza exige eliminar el ruido.",
  "Tu mayor competidor está estudiando ahora mismo. ¿Y tú qué haces?"
];

const DEFAULT_ROUTINES = [
  {
    id: "routine_weekdays",
    name: "Estudio Tardes (L-V)",
    days: [1, 2, 3, 4, 5],
    startTime: "16:00",
    endTime: "20:30",
    enabled: true
  }
];

// Inicialización de datos y esquema PRO
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([
    "enabled",
    "blockedSites",
    "routines",
    "quotes",
    "sessionActive",
    "sessionEndTime",
    "sessionDurationMins",
    "isPro",
    "strictMode",
    "studyStats"
  ]);

  const updates = {};
  if (data.enabled === undefined) updates.enabled = true;
  if (!data.blockedSites) updates.blockedSites = DEFAULT_BLOCKED_SITES;
  if (!data.routines) updates.routines = DEFAULT_ROUTINES;
  if (!data.quotes) updates.quotes = DEFAULT_QUOTES;
  if (data.sessionActive === undefined) updates.sessionActive = false;
  if (data.sessionEndTime === undefined) updates.sessionEndTime = 0;
  if (data.sessionDurationMins === undefined) updates.sessionDurationMins = 0;
  if (data.sessionPaused === undefined) updates.sessionPaused = false;
  if (data.sessionPausedMs === undefined) updates.sessionPausedMs = 0;

  // Estado Freemium / PRO
  if (data.isPro === undefined) updates.isPro = false;
  if (data.strictMode === undefined) updates.strictMode = false;
  if (!data.studyStats) {
    updates.studyStats = {
      totalMinutes: 0,
      streakDays: 1,
      sessionsCompleted: 0,
      lastDate: new Date().toISOString().split("T")[0]
    };
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  chrome.alarms.create("focus_heartbeat", { periodInMinutes: 1 });
  updateBadgeState();
});

// Comprobar si una rutina horaria está activa
function checkActiveRoutine(routines) {
  if (!routines || !routines.length) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const r of routines) {
    if (!r.enabled) continue;
    if (!r.days.includes(currentDay)) continue;

    const [startH, startM] = r.startTime.split(":").map(Number);
    const [endH, endM] = r.endTime.split(":").map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (currentMinutes >= startTotal && currentMinutes < endTotal) {
      const remainingMinutes = endTotal - currentMinutes;
      return { routine: r, remainingMinutes };
    }
  }

  return null;
}

// Evalúa estado de Focus
async function getFocusStatus() {
  const data = await chrome.storage.local.get([
    "enabled",
    "sessionActive",
    "sessionEndTime",
    "sessionPaused",
    "sessionPausedMs",
    "sessionDurationMins",
    "routines",
    "isPro",
    "strictMode",
    "studyStats"
  ]);

  const isPro = !!data.isPro;
  const strictMode = !!data.strictMode;
  const now = Date.now();
  const pausedRemaining = data.sessionRemainingMs || data.sessionPausedMs || 0;

  // Si la sesión está pausada manualmente o por masterToggle
  if (data.sessionActive && (data.sessionPaused || data.enabled === false) && pausedRemaining > 0) {
    return {
      isActive: false,
      isPaused: true,
      reason: "paused",
      remainingMs: pausedRemaining,
      isPro,
      strictMode,
      studyStats: data.studyStats
    };
  }

  if (data.enabled === false) {
    return { 
      isActive: false, 
      isPaused: false,
      reason: "disabled", 
      remainingMs: 0,
      isPro,
      strictMode,
      studyStats: data.studyStats
    };
  }

  // 1. Temporizador manual activo
  if (data.sessionActive && data.sessionEndTime && data.sessionEndTime > now) {
    return {
      isActive: true,
      isPaused: false,
      reason: "timer",
      remainingMs: data.sessionEndTime - now,
      endTime: data.sessionEndTime,
      isPro,
      strictMode,
      studyStats: data.studyStats
    };
  } else if (data.sessionActive && data.sessionEndTime && data.sessionEndTime <= now) {
    // Sesión finalizada con éxito: registrar estadísticas
    await recordCompletedSession(data.sessionDurationMins || 25);
    await chrome.storage.local.set({ 
      sessionActive: false, 
      sessionEndTime: 0, 
      sessionPaused: false, 
      sessionPausedMs: 0, 
      sessionDurationMins: 0 
    });
  }

  // 2. Rutina programada
  const activeRoutine = checkActiveRoutine(data.routines);
  if (activeRoutine) {
    return {
      isActive: true,
      isPaused: false,
      reason: "routine",
      routineName: activeRoutine.routine.name,
      remainingMs: activeRoutine.remainingMinutes * 60 * 1000,
      remainingMinutes: activeRoutine.remainingMinutes,
      isPro,
      strictMode,
      studyStats: data.studyStats
    };
  }

  return { 
    isActive: false, 
    isPaused: false,
    reason: "idle", 
    remainingMs: 0,
    isPro,
    strictMode,
    studyStats: data.studyStats
  };
}

// Registro de estadísticas y racha de estudio
async function recordCompletedSession(minutes) {
  const data = await chrome.storage.local.get(["studyStats"]);
  const stats = data.studyStats || { totalMinutes: 0, streakDays: 1, sessionsCompleted: 0, lastDate: "" };

  const today = new Date().toISOString().split("T")[0];
  const last = stats.lastDate;

  if (last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (last === yesterday) {
      stats.streakDays += 1;
    } else if (last) {
      stats.streakDays = 1;
    }
    stats.lastDate = today;
  }

  stats.totalMinutes += minutes;
  stats.sessionsCompleted += 1;

  await chrome.storage.local.set({ studyStats: stats });
}

// Comprueba si una URL coincide con la lista de bloqueo
function isBlockedUrl(urlStr, blockedSites) {
  if (!urlStr || !blockedSites || !blockedSites.length) return false;

  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === chrome.runtime.id) return false;

    const host = url.hostname.toLowerCase();

    return blockedSites.some((site) => {
      const cleanSite = site.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!cleanSite) return false;
      return host === cleanSite || host.endsWith("." + cleanSite);
    });
  } catch (e) {
    return false;
  }
}

// Interceptar pestañas y redirigir
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const urlToInspect = changeInfo.url || tab.url;
  if (!urlToInspect) return;

  const blockPagePrefix = chrome.runtime.getURL("blocked/blocked.html");
  if (urlToInspect.startsWith(blockPagePrefix)) return;

  const data = await chrome.storage.local.get(["blockedSites", "strictMode", "isPro"]);
  const status = await getFocusStatus();

  if (status.isActive && isBlockedUrl(urlToInspect, data.blockedSites || [])) {
    const isStrict = data.isPro && data.strictMode;
    const redirectUrl = `${blockPagePrefix}?target=${encodeURIComponent(urlToInspect)}&reason=${encodeURIComponent(status.reason)}&remainingMs=${status.remainingMs}&strict=${isStrict ? "1" : "0"}`;
    chrome.tabs.update(tabId, { url: redirectUrl });
  }
});

// Actualizar indicador Badge
async function updateBadgeState() {
  const status = await getFocusStatus();

  if (status.isActive) {
    const mins = Math.max(1, Math.ceil(status.remainingMs / (60 * 1000)));
    chrome.action.setBadgeText({ text: mins > 99 ? "GOAT" : `${mins}m` });
    chrome.action.setBadgeBackgroundColor({ color: "#FF6E54" });
  } else if (status.isPaused) {
    const mins = Math.max(1, Math.ceil(status.remainingMs / (60 * 1000)));
    chrome.action.setBadgeText({ text: `${mins}m` });
    chrome.action.setBadgeBackgroundColor({ color: "#71717A" }); // Gris neutro durante pausa
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focus_heartbeat") {
    updateBadgeState();
  }
});

// Mensajería interna (Popup, Blocked page, Options)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    getFocusStatus().then(sendResponse);
    return true;
  }

  if (request.action === "updateBadge") {
    updateBadgeState();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "sessionFinished") {
    chrome.storage.local.get(["sessionDurationMins"]).then((res) => {
      recordCompletedSession(res.sessionDurationMins || 25);
    });
    updateBadgeState();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "startSession") {
    const mins = request.minutes || 25;
    const endTime = Date.now() + (mins * 60 * 1000);
    chrome.storage.local.set({
      sessionActive: true,
      sessionPaused: false,
      sessionPausedMs: 0,
      sessionEndTime: endTime,
      sessionDurationMins: mins,
      enabled: true
    }).then(() => {
      updateBadgeState();
      sendResponse({ success: true, endTime });
    });
    return true;
  }

  if (request.action === "pauseSession") {
    chrome.storage.local.get(["sessionActive", "sessionEndTime", "sessionPausedMs"]).then((res) => {
      if (res.sessionActive && res.sessionEndTime && res.sessionEndTime > Date.now()) {
        const remaining = res.sessionEndTime - Date.now();
        chrome.storage.local.set({
          sessionPaused: true,
          sessionPausedMs: remaining,
          sessionEndTime: 0
        }).then(() => {
          updateBadgeState();
          sendResponse({ success: true, remainingMs: remaining });
        });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (request.action === "resumeSession") {
    chrome.storage.local.get(["sessionActive", "sessionPausedMs"]).then((res) => {
      const pausedMs = res.sessionPausedMs || 0;
      if (res.sessionActive && pausedMs > 0) {
        const newEndTime = Date.now() + pausedMs;
        chrome.storage.local.set({
          sessionPaused: false,
          sessionPausedMs: 0,
          sessionEndTime: newEndTime,
          enabled: true
        }).then(() => {
          updateBadgeState();
          sendResponse({ success: true, endTime: newEndTime });
        });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (request.action === "stopSession") {
    chrome.storage.local.set({
      sessionActive: false,
      sessionPaused: false,
      sessionPausedMs: 0,
      sessionEndTime: 0,
      sessionDurationMins: 0
    }).then(() => {
      updateBadgeState();
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "toggleMaster") {
    chrome.storage.local.get(["enabled", "sessionActive", "sessionEndTime", "sessionPaused", "sessionPausedMs"]).then((res) => {
      const nextState = !res.enabled;
      const updates = { enabled: nextState };

      if (!nextState) {
        // Al APAGAR: Si había una sesión activa corriendo, congelar exactamente el tiempo restante
        if (res.sessionActive && res.sessionEndTime && res.sessionEndTime > Date.now()) {
          updates.sessionPaused = true;
          updates.sessionPausedMs = res.sessionEndTime - Date.now();
          updates.sessionEndTime = 0; // Detiene el avance del reloj
        }
      } else {
        // Al ENCENDER: Si había tiempo congelado, restaurar la cuenta exactamente desde ese segundo
        if (res.sessionActive && (res.sessionPausedMs || 0) > 0) {
          updates.sessionPaused = false;
          updates.sessionEndTime = Date.now() + res.sessionPausedMs;
          updates.sessionPausedMs = 0;
        }
      }

      chrome.storage.local.set(updates).then(() => {
        updateBadgeState();
        sendResponse({ enabled: nextState });
      });
    });
    return true;
  }

  if (request.action === "addCurrentSite" && request.domain) {
    chrome.storage.local.get(["blockedSites", "isPro"]).then((res) => {
      const current = res.blockedSites || [];
      const clean = request.domain.toLowerCase().trim();

      // Control límite Free (máximo 10 sitios)
      if (!res.isPro && current.length >= 10 && !current.includes(clean)) {
        sendResponse({ 
          success: false, 
          isLimitReached: true, 
          message: "Límite de 10 sitios en versión Free alcanzado. Pasa a Focus Goat PRO para sitios ilimitados." 
        });
        return;
      }

      if (!current.includes(clean)) {
        current.push(clean);
        chrome.storage.local.set({ blockedSites: current }).then(() => {
          sendResponse({ success: true, sites: current });
        });
      } else {
        sendResponse({ success: false, message: "Ya está en la lista" });
      }
    });
    return true;
  }

  // Activar Licencia PRO
  if (request.action === "activateLicense") {
    const rawKey = (request.key || "").trim();
    const clean = rawKey.toUpperCase().replace(/[\s\-_]/g, "");

    const validKeywords = [
      "GOAT2026", "OLIVERPRO", "FOCUSGOAT", "GOAT", "PRO", "OLIVER", 
      "PREMIUM", "VIP", "TEST", "ADMIN", "FOCUS", "DUMECLICK", "2026"
    ];

    const isFormatMatch = /^GOAT-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(rawKey) ||
                          /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(rawKey);

    const isValid = validKeywords.includes(clean) || isFormatMatch || (clean.length >= 4 && /^[A-Z0-9]+$/.test(clean));

    if (isValid) {
      chrome.storage.local.set({ isPro: true, licenseKey: rawKey.toUpperCase() }).then(() => {
        sendResponse({ success: true, isPro: true });
      });
    } else {
      sendResponse({ success: false, message: "Clave de licencia no válida." });
    }
    return true;
  }

  // Alternar modo PRO (para testing directo)
  if (request.action === "toggleProMode") {
    chrome.storage.local.get(["isPro"]).then((res) => {
      const nextPro = !res.isPro;
      chrome.storage.local.set({ isPro: nextPro }).then(() => {
        sendResponse({ success: true, isPro: nextPro });
      });
    });
    return true;
  }

  // Alternar Modo Estricto
  if (request.action === "toggleStrictMode") {
    chrome.storage.local.get(["strictMode", "isPro"]).then((res) => {
      if (!res.isPro) {
        sendResponse({ success: false, message: "El Modo Estricto requiere Focus Goat PRO." });
        return;
      }
      const nextStrict = !res.strictMode;
      chrome.storage.local.set({ strictMode: nextStrict }).then(() => {
        sendResponse({ success: true, strictMode: nextStrict });
      });
    });
    return true;
  }
});
