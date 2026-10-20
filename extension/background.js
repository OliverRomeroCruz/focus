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
    enabled: false
  }
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
    "cleanSweep",
    "activeProfile",
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
  if (data.cleanSweep === undefined) updates.cleanSweep = true;
  if (data.activeProfile === undefined) updates.activeProfile = "max";
  if (data.blockYoutubeShorts === undefined) updates.blockYoutubeShorts = false;
  if (!data.routines) {
    updates.routines = DEFAULT_ROUTINES;
  } else if (Array.isArray(data.routines)) {
    // Desactivar la rutina de muestra para no bloquear la navegación por defecto
    let modifiedRoutines = false;
    const cleanRoutines = data.routines.map(r => {
      if (r.id === "routine_weekdays" && !data.userConfiguredRoutines && r.enabled) {
        modifiedRoutines = true;
        return { ...r, enabled: false };
      }
      return r;
    });
    if (modifiedRoutines) updates.routines = cleanRoutines;
  }
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

// Comprobación al arrancar el navegador
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(["sessionActive", "sessionPaused", "sessionEndTime", "routines", "userConfiguredRoutines"]);
  if (data.routines && Array.isArray(data.routines)) {
    let modified = false;
    const cleanRoutines = data.routines.map(r => {
      if (r.id === "routine_weekdays" && !data.userConfiguredRoutines && r.enabled) {
        modified = true;
        return { ...r, enabled: false };
      }
      return r;
    });
    if (modified) await chrome.storage.local.set({ routines: cleanRoutines });
  }

  if (data.sessionActive && !data.sessionPaused) {
    if (data.sessionEndTime > 0 && data.sessionEndTime <= Date.now()) {
      await handleSessionCompleted();
    } else if (data.sessionEndTime > Date.now()) {
      chrome.alarms.create("session_timer_finish", { when: data.sessionEndTime });
    }
  }
  updateBadgeState();
});

// Limpieza inmediata de rutina de muestra al arrancar el service worker
chrome.storage.local.get(["routines", "userConfiguredRoutines"], (data) => {
  if (data && data.routines && Array.isArray(data.routines)) {
    let changed = false;
    const clean = data.routines.map(r => {
      if (r.id === "routine_weekdays" && !data.userConfiguredRoutines && r.enabled) {
        changed = true;
        return { ...r, enabled: false };
      }
      return r;
    });
    if (changed) {
      chrome.storage.local.set({ routines: clean });
    }
  }
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
    // Sesión finalizada con éxito: registrar estadísticas, alerta sonoro-visual y desbloqueo
    await handleSessionCompleted();
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

// Alerta de finalización de concentración: Notificación de escritorio + Sonido nítido
let lastCompletedAlertTime = 0;

async function triggerFinishAlert() {
  const data = await chrome.storage.local.get(["soundAlert", "desktopNotifications"]);
  if (data.desktopNotifications !== false) {
    showDesktopNotification();
  }
  if (data.soundAlert !== false) {
    await playFinishSound();
  }
}

function showDesktopNotification() {
  try {
    chrome.notifications.create("focus_goat_finish_" + Date.now(), {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "¡Sesión Completada! 🐐🏆",
      message: "¡Gran trabajo de concentración! Sitios desbloqueados, ya puedes entrar donde quieras.",
      priority: 2,
      requireInteraction: false
    }, (notifId) => {
      if (chrome.runtime.lastError) {
        console.warn("Notification info:", chrome.runtime.lastError);
      }
    });
  } catch (e) {
    console.warn("Error mostrando notificación de escritorio:", e);
  }
}

async function playFinishSound() {
  try {
    const offscreenUrl = chrome.runtime.getURL("offscreen/sound.html");
    let hasOffscreen = false;
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({ 
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl]
      });
      hasOffscreen = contexts && contexts.length > 0;
    }

    if (!hasOffscreen) {
      try {
        await chrome.offscreen.createDocument({
          url: offscreenUrl,
          reasons: ["AUDIO_PLAYBACK"],
          justification: "Reproducir sonido de campana al finalizar concentración"
        });
      } catch (e) {
        // Ignorar si se estaba creando en paralelo
      }
    }

    chrome.runtime.sendMessage({ action: "playFinishChime" }, () => {
      if (chrome.runtime.lastError) {
        // Ignorar si el canal no está listo
      }
    });

    // Cerrar el documento offscreen tras la campana para optimizar memoria
    setTimeout(async () => {
      try {
        await chrome.offscreen.closeDocument();
      } catch (e) {}
    }, 3500);
  } catch (e) {
    console.warn("Error al reproducir audio offscreen:", e);
  }
}

// Desbloquear automáticamente todas las pestañas actualmente en blocked.html
async function unblockExistingBlockedTabs() {
  try {
    const blockPagePrefix = chrome.runtime.getURL("blocked/blocked.html");
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith(blockPagePrefix)) {
        try {
          const parsed = new URL(tab.url);
          const target = parsed.searchParams.get("target");
          if (target && (target.startsWith("http://") || target.startsWith("https://"))) {
            chrome.tabs.update(tab.id, { url: target }).catch(() => {});
          } else {
            chrome.tabs.update(tab.id, { url: "https://www.google.com" }).catch(() => {});
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

// Manejador maestro de sesión terminada
async function handleSessionCompleted() {
  const now = Date.now();
  if (now - lastCompletedAlertTime < 3000) return;
  lastCompletedAlertTime = now;

  try {
    const data = await chrome.storage.local.get(["sessionDurationMins", "sessionActive"]);
    if (data.sessionActive) {
      const durationMins = data.sessionDurationMins || 25;
      await recordCompletedSession(durationMins);
    }

    await chrome.storage.local.set({
      sessionActive: false,
      sessionEndTime: 0,
      sessionPaused: false,
      sessionPausedMs: 0,
      sessionRemainingMs: 0,
      sessionDurationMins: 0
    });

    try {
      chrome.alarms.clear("session_timer_finish");
    } catch (e) {}

    updateBadgeState();
    triggerFinishAlert();
    unblockExistingBlockedTabs();
  } catch (err) {
    console.error("Error al finalizar sesión:", err);
  }
}

// Normaliza y extrae el hostname limpio de cualquier URL o dominio
function cleanDomainHost(input) {
  if (!input) return "";
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.replace(/\/.*$/, "");
  return domain;
}

// Comprueba si una URL coincide con la lista de bloqueo (Lista Negra)
function isBlockedUrl(urlStr, blockedSites) {
  if (!urlStr || !blockedSites || !blockedSites.length) return false;

  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === chrome.runtime.id) return false;

    const host = cleanDomainHost(url.hostname);

    return blockedSites.some((site) => {
      const cleanSite = cleanDomainHost(site);
      if (!cleanSite) return false;
      return host === cleanSite || host.endsWith("." + cleanSite);
    });
  } catch (e) {
    return false;
  }
}

// Comprueba de forma global si una URL debe estar bloqueada en este momento
async function checkUrlBlocked(urlStr) {
  if (!urlStr) return { isBlocked: false, reason: "none" };

  const data = await chrome.storage.local.get([
    "enabled",
    "blockedSites",
    "blockYoutubeShorts",
    "isPro",
    "activeProfile"
  ]);

  if (data.enabled === false) {
    return { isBlocked: false, reason: "disabled" };
  }

  // 1. Bloqueo quirúrgico de YouTube Shorts (Focus Goat PRO)
  // Aplica siempre que Focus Goat esté habilitado y blockYoutubeShorts sea PRO
  if (data.isPro && data.blockYoutubeShorts) {
    try {
      const u = new URL(urlStr);
      const isYt = u.hostname.includes("youtube.com") || u.hostname === "youtu.be";
      if (isYt) {
        if (u.pathname.startsWith("/shorts") || u.pathname.includes("/shorts/")) {
          return { isBlocked: true, reason: "shorts" };
        }
        // Permitir clases y tutoriales en YouTube (no-shorts) aunque youtube.com figure en blockedSites
        return { isBlocked: false, reason: "allowed_youtube_tutorials" };
      }
    } catch (e) {}
  }

  const status = await getFocusStatus();
  if (!status.isActive) {
    return { isBlocked: false, reason: "inactive" };
  }

  // 2. Comprobar perfil de concentración PRO
  const profile = (data.isPro && data.activeProfile) ? data.activeProfile : "max";

  // Perfil "work" (Trabajo Ligero): permite YouTube para música o tutoriales
  if (profile === "work") {
    try {
      const u = new URL(urlStr);
      const host = cleanDomainHost(u.hostname);
      if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
        return { isBlocked: false, reason: "allowed_work_profile" };
      }
    } catch (e) {}
  }

  // Perfil "social" (Cero Redes Sociales): solo bloquea redes sociales de ocio
  if (profile === "social") {
    const SOCIAL_DOMAINS = [
      "instagram.com", "tiktok.com", "twitter.com", "x.com",
      "reddit.com", "facebook.com", "threads.net", "pinterest.com", "twitch.tv"
    ];
    try {
      const u = new URL(urlStr);
      const host = cleanDomainHost(u.hostname);
      const isSocial = SOCIAL_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain));
      if (!isSocial) {
        return { isBlocked: false, reason: "allowed_social_profile" };
      }
    } catch (e) {}
  }

  // Comprobar si está en blockedSites
  if (isBlockedUrl(urlStr, data.blockedSites || [])) {
    return { isBlocked: true, reason: "blacklist" };
  }

  return { isBlocked: false, reason: "allowed" };
}

// Desbloquear automáticamente todas las pestañas de blocked.html cuya web objetivo ya NO esté bloqueada
async function unblockTabsNoLongerBlocked() {
  try {
    const blockPagePrefix = chrome.runtime.getURL("blocked/blocked.html");
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith(blockPagePrefix)) {
        try {
          const parsed = new URL(tab.url);
          const target = parsed.searchParams.get("target");
          if (target && (target.startsWith("http://") || target.startsWith("https://"))) {
            const check = await checkUrlBlocked(target);
            if (!check.isBlocked) {
              chrome.tabs.update(tab.id, { url: target }).catch(() => {});
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

// Interceptar pestañas y redirigir
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const urlToInspect = changeInfo.url || tab.url;
  if (!urlToInspect) return;

  const blockPagePrefix = chrome.runtime.getURL("blocked/blocked.html");
  if (urlToInspect.startsWith(blockPagePrefix)) return;

  const data = await chrome.storage.local.get([
    "enabled",
    "strictMode",
    "isPro",
    "blockYoutubeShorts",
    "studyStats"
  ]);

  if (data.enabled === false) return;

  const status = await getFocusStatus();

  // Si no hay sesión activa ni rutina, verificar si aplica el bloqueo de YouTube Shorts PRO
  const isShortsCheck = data.isPro && data.blockYoutubeShorts;
  if (!status.isActive && !isShortsCheck) return;

  const check = await checkUrlBlocked(urlToInspect);
  if (check.isBlocked) {
    // Registrar tentación evitada en las estadísticas
    const stats = data.studyStats || { totalMinutes: 0, streakDays: 1, sessionsCompleted: 0, blockedAttempts: 0, dailyHistory: {} };
    stats.blockedAttempts = (stats.blockedAttempts || 0) + 1;
    await chrome.storage.local.set({ studyStats: stats });

    const isStrict = data.isPro && data.strictMode;
    const remainingMs = status.remainingMs || 0;
    const redirectUrl = `${blockPagePrefix}?target=${encodeURIComponent(urlToInspect)}&reason=${encodeURIComponent(check.reason)}&remainingMs=${remainingMs}&strict=${isStrict ? "1" : "0"}&isPro=${data.isPro ? "1" : "0"}`;
    chrome.tabs.update(tabId, { url: redirectUrl }).catch(() => {});
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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "session_timer_finish") {
    await handleSessionCompleted();
    return;
  }

  if (alarm.name === "focus_heartbeat") {
    const data = await chrome.storage.local.get(["sessionActive", "sessionPaused", "sessionEndTime"]);
    if (data.sessionActive && !data.sessionPaused && data.sessionEndTime > 0 && data.sessionEndTime <= Date.now()) {
      await handleSessionCompleted();
    } else {
      updateBadgeState();
    }
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
    handleSessionCompleted().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "startSession") {
    const mins = request.minutes || 25;
    const durationMs = mins * 60 * 1000;
    const endTime = Date.now() + durationMs;
    chrome.alarms.create("session_timer_finish", { when: endTime });
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
    chrome.alarms.clear("session_timer_finish");
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
        chrome.alarms.create("session_timer_finish", { when: newEndTime });
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
    chrome.alarms.clear("session_timer_finish");
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
        chrome.alarms.clear("session_timer_finish");
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
          const newEndTime = Date.now() + pausedMs;
          chrome.alarms.create("session_timer_finish", { when: newEndTime });
          updates.sessionPaused = false;
          updates.sessionEndTime = newEndTime;
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

  // Quitar sitio actual de la lista de bloqueo
  if (request.action === "removeCurrentSite" && request.domain) {
    chrome.storage.local.get(["blockedSites"]).then((res) => {
      const current = res.blockedSites || [];
      const clean = cleanDomainHost(request.domain);
      const nextList = current.filter((s) => cleanDomainHost(s) !== clean);
      chrome.storage.local.set({ blockedSites: nextList }).then(() => {
        unblockTabsNoLongerBlocked().then(() => {
          sendResponse({ success: true, sites: nextList });
        });
      });
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

  // Alternar bloqueo quirúrgico de YouTube Shorts
  if (request.action === "toggleYoutubeShorts") {
    chrome.storage.local.get(["isPro", "blockYoutubeShorts"]).then((res) => {
      if (!res.isPro) {
        sendResponse({ success: false, message: "El Bloqueo de YouTube Shorts requiere Focus Goat PRO." });
        return;
      }
      const nextShorts = (request.value !== undefined) ? !!request.value : !res.blockYoutubeShorts;
      chrome.storage.local.set({ blockYoutubeShorts: nextShorts }).then(() => {
        sendResponse({ success: true, blockYoutubeShorts: nextShorts });
      });
    });
    return true;
  }

  // Notificación de sitio eliminado o lista actualizada -> desbloquear pestañas de inmediato
  if (request.action === "siteRemoved" || request.action === "sitesUpdated") {
    unblockTabsNoLongerBlocked().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Comprobar estado de bloqueo de una URL específica desde blocked.js
  if (request.action === "checkUrlStatus" && request.url) {
    checkUrlBlocked(request.url).then((res) => {
      sendResponse(res);
    });
    return true;
  }

  // Prueba de sonido de campana desde Opciones
  if (request.action === "testFinishSound") {
    playFinishSound().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

// Desbloquear pestañas de forma reactiva cuando cambie la lista de bloqueo o el perfil en almacenamiento
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.blockedSites || changes.activeProfile || changes.enabled || changes.isPro) {
      unblockTabsNoLongerBlocked();
    }
  }
});

