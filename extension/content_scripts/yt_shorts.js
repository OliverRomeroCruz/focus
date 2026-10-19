/**
 * FOCUS GOAT — Bloqueador Quirúrgico de YouTube Shorts (Focus Goat PRO)
 * Permite buscar y ver tutoriales/clases normales pero elimina por completo el pozo adictivo de Shorts.
 */

(function () {
  const STYLE_ID = "focus-goat-anti-shorts-style";
  const CSS_RULES = `
    /* Ocultar botones de navegación a Shorts en barra lateral y móvil */
    ytd-guide-entry-renderer:has(a[href*="/shorts"]),
    ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
    ytd-guide-section-renderer:has(a[href*="/shorts"]),
    ytm-pivot-bar-item-renderer:has(a[href*="/shorts"]),
    ytm-pivot-bar-entry-renderer:has(a[href*="/shorts"]),
    a[title="Shorts"],
    a#endpoint[title*="Shorts"],
    a[href*="/shorts"]:not([href*="watch"]),
    a[href^="/shorts"],

    /* Ocultar estantes enteros de Shorts en Inicio, Suscripciones y Búsqueda */
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer),
    ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
    ytd-rich-shelf-renderer[is-shorts],
    ytd-rich-shelf-renderer,
    ytd-reel-shelf-renderer,
    ytd-item-section-renderer:has(ytd-reel-shelf-renderer),
    grid-shelf-renderer:has(a[href*="/shorts"]),
    ytd-rich-item-renderer:has(a[href*="/shorts"]),
    ytd-video-renderer:has(a[href*="/shorts"]),
    ytd-compact-video-renderer:has(a[href*="/shorts"]),
    ytd-grid-video-renderer:has(a[href*="/shorts"]),
    yt-chip-cloud-chip-renderer:has([text*="Shorts"]),
    ytd-notification-renderer:has(a[href*="/shorts"]),

    /* Ocultar reproductor y contenedor de Shorts */
    ytd-shorts,
    #shorts-container,
    ytd-reel-video-renderer {
      display: none !important;
    }
  `;

  let isBlocked = false;
  let observer = null;

  function applyStyle() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS_RULES;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  function purgeShortsElements() {
    if (!isBlocked) return;
    try {
      document.querySelectorAll("ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-rich-shelf-renderer, ytd-item-section-renderer").forEach((shelf) => {
        if (shelf.querySelector && shelf.querySelector('a[href*="/shorts"]')) {
          shelf.style.setProperty("display", "none", "important");
        }
      });
      document.querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer").forEach((item) => {
        if (item.querySelector && item.querySelector('a[href*="/shorts"]')) {
          item.style.setProperty("display", "none", "important");
        }
      });
    } catch (e) {}
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      purgeShortsElements();
    });
    if (document.body || document.documentElement) {
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function checkShortsRedirect(targetUrl) {
    if (!isBlocked) return;
    const currentPath = window.location.pathname || "";
    const isShortsPath = currentPath.startsWith("/shorts") || currentPath.includes("/shorts/");

    if (isShortsPath || (targetUrl && (targetUrl.includes("/shorts/") || targetUrl.includes("/shorts")))) {
      try {
        // Pausar y silenciar inmediatamente para no oír dopamina
        document.querySelectorAll("video, audio").forEach((el) => {
          el.pause();
          el.muted = true;
          el.currentTime = 0;
        });
      } catch (e) {}

      const dest = targetUrl || window.location.href;
      const blockUrl = chrome.runtime.getURL(
        "blocked/blocked.html?target=" + encodeURIComponent(dest) + "&reason=shorts"
      );
      window.location.replace(blockUrl);
    }
  }

  async function checkState() {
    try {
      const data = await chrome.storage.local.get([
        "isPro",
        "blockYoutubeShorts",
        "enabled"
      ]);

      const shouldBlock = !!(data.isPro && data.blockYoutubeShorts && data.enabled !== false);
      isBlocked = shouldBlock;

      if (isBlocked) {
        applyStyle();
        startObserver();
        purgeShortsElements();
        checkShortsRedirect();
      } else {
        removeStyle();
        stopObserver();
      }
    } catch (e) {
      // Context invalidated
    }
  }

  // Interceptar clics en enlaces a Shorts en fase de captura antes que YouTube los procese
  document.addEventListener("click", (e) => {
    if (!isBlocked) return;
    const targetLink = e.target && e.target.closest && e.target.closest('a[href*="/shorts"]');
    if (targetLink) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      checkShortsRedirect(targetLink.href);
    }
  }, true);

  // Interceptar navegación SPA de YouTube
  document.addEventListener("yt-navigate-start", () => checkShortsRedirect());
  document.addEventListener("yt-navigate-finish", () => {
    checkShortsRedirect();
    purgeShortsElements();
  });
  document.addEventListener("yt-page-data-updated", () => {
    checkShortsRedirect();
    purgeShortsElements();
  });
  window.addEventListener("popstate", () => checkShortsRedirect());
  window.addEventListener("hashchange", () => checkShortsRedirect());

  // Monkey-patching de history API para atrapar cualquier pushState de YouTube
  const origPushState = history.pushState;
  history.pushState = function (state, title, url) {
    origPushState.apply(this, arguments);
    if (url) checkShortsRedirect(typeof url === "string" ? url : url.toString());
    else checkShortsRedirect();
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function (state, title, url) {
    origReplaceState.apply(this, arguments);
    if (url) checkShortsRedirect(typeof url === "string" ? url : url.toString());
    else checkShortsRedirect();
  };

  // Intervalo de seguridad ligero cada 250ms
  setInterval(() => {
    if (isBlocked && window.location.pathname.startsWith("/shorts")) {
      checkShortsRedirect();
    }
  }, 250);

  // Observador de cambios en storage (cuando el usuario activa/desactiva la opción PRO)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.blockYoutubeShorts || changes.isPro || changes.enabled) {
        checkState();
      }
    }
  });

  // Suprimir error "Navigation rejected" emitido por el router interno de YouTube al redirigir
  window.addEventListener("unhandledrejection", (event) => {
    if (event && event.reason) {
      const msg = event.reason.message || String(event.reason);
      if (msg.includes("Navigation rejected") || msg.includes("navigation rejected")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  });

  checkState();
})();
