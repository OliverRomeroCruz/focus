/**
 * FOCUS GOAT — Service Worker (Manifest V3)
 * Gestión de sesiones, rutinas semanales y redirección a pantalla de bloqueo.
 */

const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "facebook.com",
  "netflix.com",
  "twitch.tv",
  "discord.com"
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
    days: [1, 2, 3, 4, 5], // 1=Lunes ... 5=Viernes
    startTime: "16:00",
    endTime: "20:30",
    enabled: true
  }
];

// Inicialización de datos
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([
    "enabled",
    "blockedSites",
    "routines",
    "quotes",
    "sessionActive",
    "sessionEndTime"
  ]);

  const updates = {};
  if (data.enabled === undefined) updates.enabled = true;
  if (!data.blockedSites) updates.blockedSites = DEFAULT_BLOCKED_SITES;
  if (!data.routines) updates.routines = DEFAULT_ROUTINES;
  if (!data.quotes) updates.quotes = DEFAULT_QUOTES;
  if (data.sessionActive === undefined) updates.sessionActive = false;
  if (data.sessionEndTime === undefined) updates.sessionEndTime = 0;

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  // Alarma cada minuto para chequear rutinas y actualizar badge
  chrome.alarms.create("focus_heartbeat", { periodInMinutes: 1 });
  updateBadgeState();
});

// Comprobar si una rutina horaria está activa en este instante
function checkActiveRoutine(routines) {
  if (!routines || !routines.length) return null;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes...
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const r of routines) {
    if (!r.enabled) continue;
    if (!r.days.includes(currentDay)) continue;

    const [startH, startM] = r.startTime.split(":").map(Number);
    const [endH, endM] = r.endTime.split(":").map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (currentMinutes >= startTotal && currentMinutes < endTotal) {
      // Minutos restantes hasta fin de rutina
      const remainingMinutes = endTotal - currentMinutes;
      return { routine: r, remainingMinutes };
    }
  }

  return null;
}

// Evalúa si el modo Focus está activo (por temporizador o por rutina programada)
async function getFocusStatus() {
  const data = await chrome.storage.local.get([
    "enabled",
    "sessionActive",
    "sessionEndTime",
    "routines"
  ]);

  if (data.enabled === false) {
    return { isActive: false, reason: "disabled", remainingMs: 0 };
  }

  const now = Date.now();

  // 1. Temporizador manual activo
  if (data.sessionActive && data.sessionEndTime && data.sessionEndTime > now) {
    return {
      isActive: true,
      reason: "timer",
      remainingMs: data.sessionEndTime - now,
      endTime: data.sessionEndTime
    };
  } else if (data.sessionActive && data.sessionEndTime && data.sessionEndTime <= now) {
    // Sesión finalizada
    await chrome.storage.local.set({ sessionActive: false, sessionEndTime: 0 });
  }

  // 2. Rutina programada por día y hora
  const activeRoutine = checkActiveRoutine(data.routines);
  if (activeRoutine) {
    return {
      isActive: true,
      reason: "routine",
      routineName: activeRoutine.routine.name,
      remainingMs: activeRoutine.remainingMinutes * 60 * 1000,
      remainingMinutes: activeRoutine.remainingMinutes
    };
  }

  return { isActive: false, reason: "idle", remainingMs: 0 };
}

// Comprueba si una URL coincide con la lista de dominios bloqueados
function isBlockedUrl(urlStr, blockedSites) {
  if (!urlStr || !blockedSites || !blockedSites.length) return false;

  try {
    const url = new URL(urlStr);
    // Solo bloquear protocolos web estándar
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    // Ignorar URLs internas de la extensión
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

// Interceptar navegación en pestañas
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Solo actuar si hay URL y está cargando
  const urlToInspect = changeInfo.url || tab.url;
  if (!urlToInspect) return;

  const blockPagePrefix = chrome.runtime.getURL("blocked/blocked.html");
  if (urlToInspect.startsWith(blockPagePrefix)) return;

  const data = await chrome.storage.local.get(["blockedSites"]);
  const status = await getFocusStatus();

  if (status.isActive && isBlockedUrl(urlToInspect, data.blockedSites || [])) {
    const redirectUrl = `${blockPagePrefix}?target=${encodeURIComponent(urlToInspect)}&reason=${encodeURIComponent(status.reason)}&remainingMs=${status.remainingMs}`;
    chrome.tabs.update(tabId, { url: redirectUrl });
  }
});

// Actualizar indicador Badge del icono de la extensión
async function updateBadgeState() {
  const status = await getFocusStatus();

  if (status.isActive) {
    const mins = Math.max(1, Math.ceil(status.remainingMs / (60 * 1000)));
    chrome.action.setBadgeText({ text: mins > 99 ? "GOAT" : `${mins}m` });
    chrome.action.setBadgeBackgroundColor({ color: "#FF6E54" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focus_heartbeat") {
    updateBadgeState();
  }
});

// Mensajería interna (desde popup o blocked page)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    getFocusStatus().then(sendResponse);
    return true;
  }

  if (request.action === "startSession") {
    const endTime = Date.now() + (request.minutes * 60 * 1000);
    chrome.storage.local.set({
      sessionActive: true,
      sessionEndTime: endTime,
      enabled: true
    }).then(() => {
      updateBadgeState();
      sendResponse({ success: true, endTime });
    });
    return true;
  }

  if (request.action === "stopSession") {
    chrome.storage.local.set({
      sessionActive: false,
      sessionEndTime: 0
    }).then(() => {
      updateBadgeState();
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "toggleMaster") {
    chrome.storage.local.get(["enabled"]).then((res) => {
      const nextState = !res.enabled;
      chrome.storage.local.set({ enabled: nextState }).then(() => {
        updateBadgeState();
        sendResponse({ enabled: nextState });
      });
    });
    return true;
  }

  if (request.action === "addCurrentSite" && request.domain) {
    chrome.storage.local.get(["blockedSites"]).then((res) => {
      const current = res.blockedSites || [];
      const clean = request.domain.toLowerCase().trim();
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
});
