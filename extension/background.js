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

const DEFAULT_WHITELIST_SITES = [
  "notion.so",
  "docs.google.com",
  "drive.google.com",
  "wikipedia.org",
  "canvaslms.com",
  "classroom.google.com",
  "github.com",
  "chatgpt.com",
  "claude.ai"
];

// Sistema de Gamificación: Rangos y Niveles de la Cabra según minutos estudiados
function getGoatRank(totalMinutes = 0) {
  if (totalMinutes >= 3600) {
    return { level: 5, title: "El Auténtico GOAT", icon: "👑", nextMinutes: 0, prevMinutes: 3600, badge: "LEGENDARIO" };
  } else if (totalMinutes >= 1800) {
    return { level: 4, title: "Cabra Titán", icon: "💪", nextMinutes: 3600, prevMinutes: 1800, badge: "ÉLITE" };
  } else if (totalMinutes >= 600) {
    return { level: 3, title: "Cabra Opositora", icon: "🎓", nextMinutes: 1800, prevMinutes: 600, badge: "AVANZADO" };
  } else if (totalMinutes >= 120) {
    return { level: 2, title: "Cabra Estudiante", icon: "📚", nextMinutes: 600, prevMinutes: 120, badge: "INTERMEDIO" };
  } else {
    return { level: 1, title: "Cabra Novata", icon: "🐐", nextMinutes: 120, prevMinutes: 0, badge: "PRINCIPIANTE" };
  }
}

// Inicialización de datos y esquema PRO
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([
    "enabled",
    "blockedSites",
    "whitelistSites",
    "blockMode",
    "blockYoutubeShorts",
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
  if (!data.whitelistSites) updates.whitelistSites = DEFAULT_WHITELIST_SITES;
  if (data.blockMode === undefined) updates.blockMode = "blacklist";
  if (data.blockYoutubeShorts === undefined) updates.blockYoutubeShorts = false;
  if (!data.routines) updates.routines = DEFAULT_ROUTINES;
  if (!data.quotes) updates.quotes = DEFAULT_QUOTES;
  if (data.sessionActive === undefined) updates.sessionActive = false;
  if (data.sessionEndTime === undefined) updates.sessionEndTime = 0;
  if (data.sessionPaused === undefined) updates.sessionPaused = false;
  if (data.sessionPausedMs === undefined) updates.sessionPausedMs = 0;
  if (data.sessionRemainingMs === undefined) updates.sessionRemainingMs = 0;

  // Estado Freemium / PRO (Resetear a Free por petición del usuario)
  updates.isPro = false;
  updates.licenseKey = "";
  updates.strictMode = false;

  if (!data.studyStats) {
    updates.studyStats = {
      totalMinutes: 0,
      streakDays: 1,
      sessionsCompleted: 0,
      blockedAttempts: 0,
      dailyHistory: {},
      lastDate: new Date().toISOString().split("T")[0]
    };
  } else {
    let modified = false;
    if (data.studyStats.blockedAttempts === undefined) {
      data.studyStats.blockedAttempts = 0;
      modified = true;
    }
    if (!data.studyStats.dailyHistory) {
      data.studyStats.dailyHistory = {};
      modified = true;
    }
    if (modified) updates.studyStats = data.studyStats;
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
    "sessionRemainingMs",
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

  // 1. Temporizador manual activo (solo si no está en pausa)
  if (data.sessionActive && !data.sessionPaused && data.sessionEndTime && data.sessionEndTime > now) {
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
  } else if (data.sessionActive && !data.sessionPaused && data.sessionEndTime > 0 && data.sessionEndTime <= now) {
    // Sesión finalizada con éxito: registrar estadísticas
    await recordCompletedSession(data.sessionDurationMins || 25);
    await chrome.storage.local.set({ 
      sessionActive: false, 
      sessionEndTime: 0, 
      sessionPaused: false, 
      sessionPausedMs: 0, 
      sessionRemainingMs: 0,
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
  const stats = data.studyStats || { 
    totalMinutes: 0, 
    streakDays: 1, 
    sessionsCompleted: 0, 
    blockedAttempts: 0, 
    dailyHistory: {}, 
    lastDate: "" 
  };

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
  stats.dailyHistory = stats.dailyHistory || {};
  stats.dailyHistory[today] = (stats.dailyHistory[today] || 0) + minutes;

  await chrome.storage.local.set({ studyStats: stats });
}

// Comprueba si una URL coincide con la lista de bloqueo (Lista Negra)
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

// Comprueba si una URL está en la lista blanca de herramientas de estudio (Whitelist PRO)
function isWhitelistedUrl(urlStr, whitelistSites) {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return true;
    if (url.hostname === chrome.runtime.id) return true;

    const host = url.hostname.toLowerCase();
    return (whitelistSites || DEFAULT_WHITELIST_SITES).some((site) => {
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

  const data = await chrome.storage.local.get([
    "blockedSites",
    "whitelistSites",
    "blockMode",
    "blockYoutubeShorts",
    "strictMode",
    "isPro",
    "studyStats"
  ]);
  const status = await getFocusStatus();

  if (!status.isActive) return;

  let isBlocked = false;
  let blockReason = status.reason || "session";

  // 1. Bloqueo quirúrgico de YouTube Shorts (Focus Goat PRO)
  if (data.isPro && data.blockYoutubeShorts) {
    try {
      const u = new URL(urlToInspect);
      if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts")) {
        isBlocked = true;
        blockReason = "shorts";
      }
    } catch (e) {}
  }

  // 2. Comprobar modo de bloqueo
  if (!isBlocked) {
    const isWhitelistMode = data.isPro && data.blockMode === "whitelist";
    if (isWhitelistMode) {
      // Modo Solo Estudio: Bloquear todo excepto las webs autorizadas
      const isAllowed = isWhitelistedUrl(urlToInspect, data.whitelistSites);
      if (!isAllowed) {
        isBlocked = true;
        blockReason = "whitelist";
      }
    } else {
      // Modo Lista Negra estándar
      if (isBlockedUrl(urlToInspect, data.blockedSites || [])) {
        isBlocked = true;
        blockReason = "blacklist";
      }
    }
  }

  if (isBlocked) {
    // Registrar tentación evitada en las estadísticas
    const stats = data.studyStats || { totalMinutes: 0, streakDays: 1, sessionsCompleted: 0, blockedAttempts: 0, dailyHistory: {} };
    stats.blockedAttempts = (stats.blockedAttempts || 0) + 1;
    await chrome.storage.local.set({ studyStats: stats });

    const isStrict = data.isPro && data.strictMode;
    const redirectUrl = `${blockPagePrefix}?target=${encodeURIComponent(urlToInspect)}&reason=${encodeURIComponent(blockReason)}&remainingMs=${status.remainingMs}&strict=${isStrict ? "1" : "0"}&isPro=${data.isPro ? "1" : "0"}`;
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
    const durationMs = mins * 60 * 1000;
    const endTime = Date.now() + durationMs;
    chrome.storage.local.set({
      sessionActive: true,
      sessionPaused: false,
      sessionPausedMs: 0,
      sessionRemainingMs: durationMs,
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
    chrome.storage.local.get(["sessionActive", "sessionEndTime", "sessionRemainingMs", "sessionPausedMs"]).then((res) => {
      let remaining = res.sessionRemainingMs || res.sessionPausedMs || 0;
      if (res.sessionEndTime && res.sessionEndTime > Date.now()) {
        remaining = res.sessionEndTime - Date.now();
      }
      if (res.sessionActive && remaining > 0) {
        chrome.storage.local.set({
          sessionPaused: true,
          sessionPausedMs: remaining,
          sessionRemainingMs: remaining,
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
    chrome.storage.local.get(["sessionActive", "sessionPausedMs", "sessionRemainingMs"]).then((res) => {
      const pausedMs = res.sessionRemainingMs || res.sessionPausedMs || 0;
      if (res.sessionActive && pausedMs > 0) {
        const newEndTime = Date.now() + pausedMs;
        chrome.storage.local.set({
          sessionPaused: false,
          sessionPausedMs: 0,
          sessionRemainingMs: pausedMs,
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
      sessionRemainingMs: 0,
      sessionEndTime: 0,
      sessionDurationMins: 0
    }).then(() => {
      updateBadgeState();
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "toggleMaster") {
    chrome.storage.local.get(["enabled", "sessionActive", "sessionEndTime", "sessionPaused", "sessionPausedMs", "sessionRemainingMs"]).then((res) => {
      const nextState = !res.enabled;
      const updates = { enabled: nextState };

      if (!nextState) {
        // Al APAGAR: Si había una sesión activa corriendo, congelar exactamente el tiempo restante
        let remaining = res.sessionRemainingMs || res.sessionPausedMs || 0;
        if (res.sessionEndTime && res.sessionEndTime > Date.now()) {
          remaining = res.sessionEndTime - Date.now();
        }
        if (res.sessionActive && remaining > 0) {
          updates.sessionPaused = true;
          updates.sessionPausedMs = remaining;
          updates.sessionRemainingMs = remaining;
          updates.sessionEndTime = 0; // Detiene el avance del reloj
        }
      } else {
        // Al ENCENDER: Si había tiempo congelado, restaurar la cuenta exactamente desde ese segundo
        const pausedMs = res.sessionRemainingMs || res.sessionPausedMs || 0;
        if (res.sessionActive && pausedMs > 0) {
          updates.sessionPaused = false;
          updates.sessionEndTime = Date.now() + pausedMs;
          updates.sessionRemainingMs = pausedMs;
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

  // Desactivar Licencia PRO (volver a Free)
  if (request.action === "deactivateLicense") {
    chrome.storage.local.set({ isPro: false, licenseKey: "", strictMode: false }).then(() => {
      updateBadgeState();
      sendResponse({ success: true, isPro: false });
    });
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

  // Obtener estadísticas y Rango GOAT
  if (request.action === "getStatsAndRank") {
    chrome.storage.local.get(["studyStats", "isPro"]).then((res) => {
      const stats = res.studyStats || { totalMinutes: 0, streakDays: 1, sessionsCompleted: 0, blockedAttempts: 0, dailyHistory: {} };
      const rank = getGoatRank(stats.totalMinutes || 0);
      sendResponse({ stats, rank, isPro: !!res.isPro });
    });
    return true;
  }

  // Cambiar modo de bloqueo (Lista Negra vs Lista Blanca / Solo Estudio)
  if (request.action === "setBlockMode") {
    const targetMode = request.mode === "whitelist" ? "whitelist" : "blacklist";
    chrome.storage.local.get(["isPro"]).then((res) => {
      if (targetMode === "whitelist" && !res.isPro) {
        sendResponse({ success: false, message: "El Modo Solo Estudio requiere Focus Goat PRO." });
        return;
      }
      chrome.storage.local.set({ blockMode: targetMode }).then(() => {
        sendResponse({ success: true, mode: targetMode });
      });
    });
    return true;
  }

  // Alternar bloqueo quirúrgico de YouTube Shorts
  if (request.action === "toggleYoutubeShorts") {
    chrome.storage.local.get(["isPro", "blockYoutubeShorts"]).then((res) => {
      if (!res.isPro) {
        sendResponse({ success: false, message: "El Bloqueo de YouTube Shorts requiere Focus Goat PRO." });
        return;
      }
      const nextShorts = !res.blockYoutubeShorts;
      chrome.storage.local.set({ blockYoutubeShorts: nextShorts }).then(() => {
        sendResponse({ success: true, blockYoutubeShorts: nextShorts });
      });
    });
    return true;
  }

  // Gestión de sitios en lista blanca (Whitelist)
  if (request.action === "addWhitelistSite" && request.domain) {
    chrome.storage.local.get(["whitelistSites", "isPro"]).then((res) => {
      if (!res.isPro) {
        sendResponse({ success: false, message: "La Lista Blanca requiere Focus Goat PRO." });
        return;
      }
      const current = res.whitelistSites || DEFAULT_WHITELIST_SITES;
      const clean = request.domain.toLowerCase().trim();
      if (!current.includes(clean)) {
        current.push(clean);
        chrome.storage.local.set({ whitelistSites: current }).then(() => {
          sendResponse({ success: true, sites: current });
        });
      } else {
        sendResponse({ success: false, message: "Ya está en la lista blanca" });
      }
    });
    return true;
  }

  if (request.action === "removeWhitelistSite" && request.domain) {
    chrome.storage.local.get(["whitelistSites"]).then((res) => {
      let current = res.whitelistSites || DEFAULT_WHITELIST_SITES;
      const clean = request.domain.toLowerCase().trim();
      current = current.filter((s) => s !== clean);
      chrome.storage.local.set({ whitelistSites: current }).then(() => {
        sendResponse({ success: true, sites: current });
      });
    });
    return true;
  }
});
