/**
 * FOCUS GOAT — Bloqueador Quirúrgico de YouTube Shorts (Focus Goat PRO)
 * Permite buscar y ver tutoriales/clases normales pero elimina el pozo adictivo de Shorts.
 */

(function () {
  const STYLE_ID = "focus-goat-anti-shorts-style";
  const CSS_RULES = `
    /* Ocultar botones de navegación a Shorts */
    ytd-guide-entry-renderer:has(a[title*="Shorts"]),
    ytd-mini-guide-entry-renderer:has(a[title*="Shorts"]),
    ytd-guide-entry-renderer:has(a[href*="/shorts"]),
    ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
    ytm-pivot-bar-item-renderer:has(a[href*="/shorts"]),
    a#endpoint[title*="Shorts"],
    a[href*="/shorts"]:not([href*="watch"]),
    /* Ocultar estantes y secciones enteras de Shorts en la página principal y recomendaciones */
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
    ytd-reel-shelf-renderer,
    ytd-rich-shelf-renderer[is-shorts],
    grid-shelf-renderer:has(a[href*="/shorts"]) {
      display: none !important;
    }
  `;

  let isBlocked = false;

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

  function checkShortsRedirect() {
    if (isBlocked && window.location.pathname.startsWith("/shorts")) {
      window.location.replace("https://www.youtube.com/?focus_goat_blocked_shorts=1");
    }
  }

  async function checkState() {
    try {
      const data = await chrome.storage.local.get([
        "isPro",
        "blockYoutubeShorts",
        "enabled",
        "sessionActive"
      ]);

      const shouldBlock = data.isPro && data.blockYoutubeShorts && data.enabled !== false;
      isBlocked = !!shouldBlock;

      if (isBlocked) {
        applyStyle();
        checkShortsRedirect();
      } else {
        removeStyle();
      }
    } catch (e) {
      // Extension context invalidated
    }
  }

  // Verificar navegación SPA de YouTube
  window.addEventListener("yt-navigate-start", checkShortsRedirect);
  window.addEventListener("popstate", checkShortsRedirect);

  // Observador de cambios en storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      checkState();
    }
  });

  checkState();
})();
