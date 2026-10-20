/**
 * FOCUS GOAT — Lógica del panel de opciones y rutinas
 * Gestión de sitios, rutinas semanales, límites Freemium y sistema Focus Goat PRO.
 */

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos Rango GOAT & Estadísticas
  const rankIcon = document.getElementById("rankIcon");
  const rankBadge = document.getElementById("rankBadge");
  const rankTitle = document.getElementById("rankTitle");
  const rankXpLabel = document.getElementById("rankXpLabel");
  const rankXpBar = document.getElementById("rankXpBar");
  const rankDesc = document.getElementById("rankDesc");
  const statStreakDays = document.getElementById("statStreakDays");
  const statTotalHours = document.getElementById("statTotalHours");
  const statBlockedAttempts = document.getElementById("statBlockedAttempts");
  const statSessionsDone = document.getElementById("statSessionsDone");
  const chartWeekTotal = document.getElementById("chartWeekTotal");
  const weeklyBars = document.getElementById("weeklyBars");

  // Elementos PRO
  const planTag = document.getElementById("planTag");
  const proSubtitle = document.getElementById("proSubtitle");
  const proActiveBanner = document.getElementById("proActiveBanner");
  const proLicenseSection = document.getElementById("proLicenseSection");
  const btnOptionsUpgrade = document.getElementById("btnOptionsUpgrade");
  const btnDeactivatePro = document.getElementById("btnDeactivatePro");
  const toggleStrictMode = document.getElementById("toggleStrictMode");
  const toggleYoutubeShorts = document.getElementById("toggleYoutubeShorts");
  const toggleMentalChallenge = document.getElementById("toggleMentalChallenge");
  const toggleCleanSweep = document.getElementById("toggleCleanSweep");
  const toggleFastRedirect = document.getElementById("toggleFastRedirect");
  const optLicenseInput = document.getElementById("optLicenseInput");
  const btnOptActivate = document.getElementById("btnOptActivate");
  const optLicenseFeedback = document.getElementById("optLicenseFeedback");

  // Modal Upgrade en Opciones
  const optionsUpgradeModal = document.getElementById("optionsUpgradeModal");
  const btnCloseOptModal = document.getElementById("btnCloseOptModal");
  const optModalKeyInput = document.getElementById("optModalKeyInput");
  const btnOptModalActivate = document.getElementById("btnOptModalActivate");
  const optModalFeedback = document.getElementById("optModalFeedback");
  const btnOptCheckoutMonthly = document.getElementById("btnOptCheckoutMonthly");
  const btnOptCheckoutLifetime = document.getElementById("btnOptCheckoutLifetime");

  // Elementos Sitios Bloqueados
  const siteListEl = document.getElementById("siteList");
  const addSiteForm = document.getElementById("addSiteForm");
  const newSiteInput = document.getElementById("newSiteInput");
  const blockedCountEl = document.getElementById("blockedCount");
  const presetChipsEl = document.getElementById("presetChips");

  // Elementos Rutinas
  const routineListEl = document.getElementById("routineList");
  const routineCountEl = document.getElementById("routineCount");
  const btnToggleNewRoutine = document.getElementById("btnToggleNewRoutine");
  const routineForm = document.getElementById("routineForm");
  const btnCancelRoutine = document.getElementById("btnCancelRoutine");
  const routineNameInput = document.getElementById("routineName");
  const routineStartInput = document.getElementById("routineStart");
  const routineEndInput = document.getElementById("routineEnd");
  const daysSelectorEl = document.getElementById("daysSelector");

  // Cargar estado inicial desde storage
  let state = await chrome.storage.local.get([
    "blockedSites",
    "blockYoutubeShorts",
    "cleanSweep",
    "activeProfile",
    "routines",
    "isPro",
    "strictMode",
    "soundAlert",
    "desktopNotifications",
    "mentalChallenge",
    "fastRedirect",
    "studyStats"
  ]);
  let blockedSites = state.blockedSites || [];
  let blockYoutubeShorts = !!state.blockYoutubeShorts;
  let cleanSweep = state.cleanSweep !== false;
  let activeProfile = state.activeProfile || "max";
  let routines = state.routines || [];
  let isPro = !!state.isPro;
  let strictMode = !!state.strictMode;
  let soundAlert = state.soundAlert !== false;
  let desktopNotifications = state.desktopNotifications !== false;
  let mentalChallenge = state.mentalChallenge !== false;
  let fastRedirect = state.fastRedirect !== false;
  let studyStats = state.studyStats || {};

  function cleanDomain(input) {
    if (!input) return "";
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.replace(/\/.*$/, "");
    return domain;
  }

  function isSameDomainOrVariant(d1, d2) {
    const c1 = cleanDomain(d1);
    const c2 = cleanDomain(d2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if ((c1.includes("youtube.com") || c1.includes("youtu.be")) && (c2.includes("youtube.com") || c2.includes("youtu.be"))) {
      return true;
    }
    if ((c1 === "x.com" || c1 === "twitter.com") && (c2 === "x.com" || c2 === "twitter.com")) {
      return true;
    }
    return false;
  }

  // ==========================================
  // 1. SISTEMA PRO & LICENCIAS
  // ==========================================
  function updateProUI() {
    if (isPro) {
      planTag.textContent = "👑 PLAN PRO ACTIVO";
      planTag.classList.add("is-pro");
      if (proSubtitle) proSubtitle.textContent = "¡Eres PRO! Puedes activar o desactivar libremente cualquiera de las herramientas avanzadas de blindaje.";

      // Ocultar botón de compra y formulario de cupón
      if (btnOptionsUpgrade) btnOptionsUpgrade.classList.add("hidden");
      if (proLicenseSection) proLicenseSection.classList.add("hidden");
      if (proActiveBanner) proActiveBanner.classList.remove("hidden");
      if (btnDeactivatePro) {
        btnDeactivatePro.classList.remove("hidden");
        btnDeactivatePro.textContent = "Volver al plan Free / Desactivar PRO";
      }

      document.querySelectorAll(".pro-setting-item:not(.license-item)").forEach((item) => {
        item.classList.remove("is-locked");
      });
    } else {
      planTag.textContent = "PLAN GRATUITO";
      planTag.classList.remove("is-pro");
      if (proSubtitle) proSubtitle.textContent = "Las siguientes 5 herramientas de blindaje requieren Focus Goat PRO para poder activarse:";

      // Mostrar botón de compra y formulario de cupón
      if (btnOptionsUpgrade) {
        btnOptionsUpgrade.classList.remove("hidden");
        btnOptionsUpgrade.textContent = "Mejorar a PRO";
        btnOptionsUpgrade.style.background = "var(--color-coral)";
        btnOptionsUpgrade.disabled = false;
      }
      if (proLicenseSection) proLicenseSection.classList.remove("hidden");
      if (proActiveBanner) proActiveBanner.classList.add("hidden");
      if (btnDeactivatePro) btnDeactivatePro.classList.add("hidden");

      document.querySelectorAll(".pro-setting-item:not(.license-item)").forEach((item) => {
        item.classList.add("is-locked");
      });
    }

    setToggleUI(toggleStrictMode, statusStrictMode, isPro && strictMode);
    setToggleUI(toggleYoutubeShorts, statusYoutubeShorts, isPro && blockYoutubeShorts);
    setToggleUI(toggleMentalChallenge, statusMentalChallenge, isPro && mentalChallenge);
    setToggleUI(toggleCleanSweep, statusCleanSweep, isPro && cleanSweep);
    setToggleUI(toggleFastRedirect, statusFastRedirect, isPro && fastRedirect);

    renderSites();
    renderRoutines();
    renderStatsAndRank();
  }

  // Elementos de texto de estado para cada botón interruptor
  const statusStrictMode = document.getElementById("statusStrictMode");
  const statusYoutubeShorts = document.getElementById("statusYoutubeShorts");
  const statusMentalChallenge = document.getElementById("statusMentalChallenge");
  const statusCleanSweep = document.getElementById("statusCleanSweep");
  const statusFastRedirect = document.getElementById("statusFastRedirect");

  function setToggleUI(inputEl, labelEl, active) {
    if (inputEl) inputEl.checked = !!active;
    if (labelEl) {
      if (active) {
        labelEl.textContent = "ACTIVADO";
        labelEl.classList.add("active");
      } else {
        labelEl.textContent = "DESACTIVADO";
        labelEl.classList.remove("active");
      }
    }
  }

  // Desactivar PRO y volver al Plan Gratuito
  if (btnDeactivatePro) {
    btnDeactivatePro.addEventListener("click", async () => {
      isPro = false;
      strictMode = false;
      blockYoutubeShorts = false;
      await chrome.storage.local.set({ 
        isPro: false, 
        licenseKey: "", 
        strictMode: false,
        blockYoutubeShorts: false
      });
      chrome.runtime.sendMessage({ action: "deactivateLicense" }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
      if (optLicenseInput) optLicenseInput.value = "";
      optLicenseFeedback.textContent = "Has vuelto al Plan Gratuito.";
      optLicenseFeedback.className = "opt-license-feedback";
      updateProUI();
    });
  }

  // Interceptar clics en opciones PRO si el usuario no es PRO
  document.querySelectorAll(".pro-setting-item:not(.license-item)").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (!isPro) {
        e.preventDefault();
        const sw = item.querySelector("input[type=checkbox]");
        const statusText = item.querySelector(".toggle-status-text");
        setToggleUI(sw, statusText, false);
        openOptModal();
      }
    });
  });

  // 1. Modo Estricto Infranqueable (PRO)
  if (toggleStrictMode) {
    toggleStrictMode.addEventListener("change", async (e) => {
      if (!isPro) {
        e.preventDefault();
        setToggleUI(toggleStrictMode, statusStrictMode, false);
        openOptModal();
        return;
      }
      strictMode = toggleStrictMode.checked;
      setToggleUI(toggleStrictMode, statusStrictMode, strictMode);
      await chrome.storage.local.set({ strictMode });
    });
  }

  // 2. Bloquear YouTube Shorts (PRO)
  if (toggleYoutubeShorts) {
    toggleYoutubeShorts.addEventListener("change", async (e) => {
      if (!isPro) {
        e.preventDefault();
        setToggleUI(toggleYoutubeShorts, statusYoutubeShorts, false);
        openOptModal();
        return;
      }
      blockYoutubeShorts = toggleYoutubeShorts.checked;
      setToggleUI(toggleYoutubeShorts, statusYoutubeShorts, blockYoutubeShorts);
      await chrome.storage.local.set({ blockYoutubeShorts });
    });
  }

  // 3. Reto Mental al Desactivar en Mini Pantalla (PRO)
  if (toggleMentalChallenge) {
    toggleMentalChallenge.addEventListener("change", async (e) => {
      if (!isPro) {
        e.preventDefault();
        setToggleUI(toggleMentalChallenge, statusMentalChallenge, false);
        openOptModal();
        return;
      }
      mentalChallenge = toggleMentalChallenge.checked;
      setToggleUI(toggleMentalChallenge, statusMentalChallenge, mentalChallenge);
      await chrome.storage.local.set({ mentalChallenge });
    });
  }

  // 4. Cierre Automático de Pestañas Clean Sweep (PRO)
  if (toggleCleanSweep) {
    toggleCleanSweep.addEventListener("change", async (e) => {
      if (!isPro) {
        e.preventDefault();
        setToggleUI(toggleCleanSweep, statusCleanSweep, false);
        openOptModal();
        return;
      }
      cleanSweep = toggleCleanSweep.checked;
      setToggleUI(toggleCleanSweep, statusCleanSweep, cleanSweep);
      await chrome.storage.local.set({ cleanSweep });
    });
  }

  // 5. Blindaje Inmediato (PRO)
  if (toggleFastRedirect) {
    toggleFastRedirect.addEventListener("change", async (e) => {
      if (!isPro) {
        e.preventDefault();
        setToggleUI(toggleFastRedirect, statusFastRedirect, false);
        openOptModal();
        return;
      }
      fastRedirect = toggleFastRedirect.checked;
      setToggleUI(toggleFastRedirect, statusFastRedirect, fastRedirect);
      await chrome.storage.local.set({ fastRedirect });
    });
  }

  // Rango GOAT y Gráfico Semanal
  function renderStatsAndRank() {
    chrome.runtime.sendMessage({ action: "getStatsAndRank" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (!res) return;
      const stats = res.stats || {};
      const rank = res.rank || { level: 1, title: "Cabra Novata", icon: "🐐", badge: "PRINCIPIANTE", nextMinutes: 120, prevMinutes: 0 };

      if (rankIcon) rankIcon.textContent = rank.icon;
      if (rankBadge) rankBadge.textContent = rank.badge;
      if (rankTitle) rankTitle.textContent = `Nivel ${rank.level} — ${rank.title}`;

      const totalMins = stats.totalMinutes || 0;
      if (rank.nextMinutes > 0) {
        const span = rank.nextMinutes - rank.prevMinutes;
        const currentInSpan = Math.max(0, totalMins - rank.prevMinutes);
        const pct = Math.min(100, Math.round((currentInSpan / span) * 100));
        if (rankXpBar) rankXpBar.style.width = `${pct}%`;
        if (rankXpLabel) rankXpLabel.textContent = `${totalMins} / ${rank.nextMinutes} min`;
      } else {
        if (rankXpBar) rankXpBar.style.width = "100%";
        if (rankXpLabel) rankXpLabel.textContent = "¡NIVEL MÁXIMO!";
      }

      if (statStreakDays) {
        const d = stats.streakDays || 1;
        statStreakDays.textContent = `${d} día${d > 1 ? "s" : ""}`;
      }
      if (statTotalHours) {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        statTotalHours.textContent = `${h}h ${m}m`;
      }
      if (statBlockedAttempts) {
        statBlockedAttempts.textContent = stats.blockedAttempts || 0;
      }
      if (statSessionsDone) {
        statSessionsDone.textContent = stats.sessionsCompleted || 0;
      }

      renderWeeklyChart(stats.dailyHistory || {});
    });
  }

  function renderWeeklyChart(history) {
    if (!weeklyBars) return;
    weeklyBars.innerHTML = "";

    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const distanceToMon = (currentDayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon);

    const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const weekData = [];
    let weekTotal = 0;
    const todayStr = now.toISOString().split("T")[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const mins = history[dateStr] || 0;
      weekTotal += mins;
      weekData.push({
        dayName: weekDays[i],
        dateStr,
        mins,
        isToday: dateStr === todayStr
      });
    }

    if (chartWeekTotal) {
      chartWeekTotal.textContent = `${weekTotal} min esta semana`;
    }

    const maxMins = Math.max(60, ...weekData.map((d) => d.mins));

    weekData.forEach((item) => {
      const heightPct = Math.max(8, Math.round((item.mins / maxMins) * 100));
      const col = document.createElement("div");
      col.className = `bar-col ${item.isToday ? "today" : ""}`;
      col.innerHTML = `
        <span class="bar-val-text">${item.mins > 0 ? item.mins + "m" : ""}</span>
        <div class="bar-track">
          <div class="bar-fill" style="height: ${heightPct}%;"></div>
        </div>
        <span class="bar-day-name">${item.dayName}</span>
      `;
      weeklyBars.appendChild(col);
    });
  }

  // Modal Upgrade
  function openOptModal() {
    if (isPro) return; // Si ya eres PRO, no mostrar modal de compra
    if (optionsUpgradeModal) {
      optionsUpgradeModal.classList.remove("hidden");
      optModalFeedback.textContent = "";
      optModalFeedback.className = "license-feedback";
    }
  }

  function closeOptModal() {
    if (optionsUpgradeModal) {
      optionsUpgradeModal.classList.add("hidden");
    }
  }

  if (btnOptionsUpgrade) btnOptionsUpgrade.addEventListener("click", openOptModal);
  if (btnCloseOptModal) btnCloseOptModal.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeOptModal();
  });

  if (optionsUpgradeModal) {
    optionsUpgradeModal.addEventListener("click", (e) => {
      if (e.target === optionsUpgradeModal) {
        closeOptModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeOptModal();
    }
  });

  // Función unificada de validación y activación PRO
  function checkAndActivateKey(rawKey, feedbackEl, onSuccess) {
    const key = (rawKey || "").trim();
    if (!key) {
      feedbackEl.textContent = "Introduce una clave de licencia.";
      feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback error" : "license-feedback error";
      return;
    }

    feedbackEl.textContent = "Verificando clave...";
    feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback" : "license-feedback";

    chrome.runtime.sendMessage({ action: "activateLicense", key }, (res) => {
      if (chrome.runtime.lastError) {
        feedbackEl.textContent = "Error al conectar con el servicio de licencias.";
        feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback error" : "license-feedback error";
        return;
      }

      if (res && res.success) {
        isPro = true;
        updateProUI();
        renderSites();
        feedbackEl.textContent = "¡Focus Goat PRO activado con éxito! 👑";
        feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback success" : "license-feedback success";
        if (onSuccess) setTimeout(onSuccess, 1200);
      } else {
        feedbackEl.textContent = (res && res.message) || "Clave de licencia no válida.";
        feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback error" : "license-feedback error";
      }
    });
  }

  // Activación de Licencia desde la tarjeta principal
  btnOptActivate.addEventListener("click", () => {
    checkAndActivateKey(optLicenseInput.value, optLicenseFeedback);
  });

  // Activación de Licencia desde el Modal
  btnOptModalActivate.addEventListener("click", () => {
    checkAndActivateKey(optModalKeyInput.value, optModalFeedback, () => {
      closeOptModal();
    });
  });

  // Botones checkout en opciones
  function handleOptCheckout() {
    chrome.tabs.create({ url: "https://oliverrc8.gumroad.com/l/focusgoat?wanted=true" });
  }
  btnOptCheckoutMonthly.addEventListener("click", handleOptCheckout);
  btnOptCheckoutLifetime.addEventListener("click", handleOptCheckout);

  // ==========================================
  // 2. GESTIÓN DE SITIOS BLOQUEADOS (Límite Free: 5)
  // ==========================================
  function renderSites() {
    siteListEl.innerHTML = "";
    if (isPro) {
      blockedCountEl.textContent = `${blockedSites.length} sitios (PRO ilimitado)`;
    } else {
      blockedCountEl.textContent = `${blockedSites.length} / 5 sitios (Free)`;
    }

    if (!blockedSites.length) {
      siteListEl.innerHTML = `<li style="grid-column: 1 / -1; text-align: center; color: #888; padding: 1rem;">No tienes ningún sitio bloqueado aún.</li>`;
      return;
    }

    blockedSites.forEach((site) => {
      const li = document.createElement("li");
      li.className = "site-item";
      li.innerHTML = `
        <span class="site-domain" title="${site}">⛔ ${site}</span>
        <button type="button" class="btn-remove" title="Eliminar ${site}">&times;</button>
      `;

      li.querySelector(".btn-remove").addEventListener("click", async () => {
        const targetClean = cleanDomain(site);
        blockedSites = blockedSites.filter((s) => !isSameDomainOrVariant(s, site) && cleanDomain(s) !== targetClean);
        await chrome.storage.local.set({ blockedSites });
        renderSites();
        // Notificar de inmediato al background para desbloquear pestañas abiertas
        chrome.runtime.sendMessage({ action: "siteRemoved", domain: targetClean }, () => {
          if (chrome.runtime.lastError) {}
        });
      });

      siteListEl.appendChild(li);
    });
  }

  addSiteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const domain = cleanDomain(newSiteInput.value);
    if (!domain) return;

    if (!isPro && blockedSites.length >= 5 && !blockedSites.includes(domain)) {
      openOptModal();
      return;
    }

    if (!blockedSites.includes(domain)) {
      blockedSites.push(domain);
      await chrome.storage.local.set({ blockedSites });
      renderSites();
      newSiteInput.value = "";
      chrome.runtime.sendMessage({ action: "sitesUpdated" }, () => {
        if (chrome.runtime.lastError) {}
      });
    } else {
      alert("Este sitio ya está en tu lista de bloqueo.");
    }
  });

  // Sugerencias rápidas (chips)
  presetChipsEl.addEventListener("click", async (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const site = chip.dataset.site;

    if (!isPro && blockedSites.length >= 5 && !blockedSites.includes(site)) {
      openOptModal();
      return;
    }

    if (site && !blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ blockedSites });
      renderSites();
      chrome.runtime.sendMessage({ action: "sitesUpdated" }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });


  // ==========================================
  // 3. GESTIÓN DE RUTINAS SEMANALES (Límite Free: 1)
  // ==========================================
  btnToggleNewRoutine.addEventListener("click", () => {
    if (!isPro && routines.length >= 1) {
      openOptModal();
      return;
    }
    routineForm.classList.toggle("hidden");
  });

  btnCancelRoutine.addEventListener("click", () => {
    routineForm.classList.add("hidden");
  });

  function formatDays(daysArray) {
    if (!daysArray || !daysArray.length) return "Ningún día";
    if (daysArray.length === 7) return "Todos los días";
    if (daysArray.length === 5 && [1, 2, 3, 4, 5].every(d => daysArray.includes(d))) return "Lunes a Viernes";
    if (daysArray.length === 2 && [0, 6].every(d => daysArray.includes(d))) return "Fines de semana";
    return daysArray.map(d => DAY_NAMES[d]).join(", ");
  }

  function renderRoutines() {
    routineListEl.innerHTML = "";
    if (routineCountEl) {
      if (isPro) {
        routineCountEl.textContent = `${routines.length} rutinas (PRO ilimitado)`;
      } else {
        routineCountEl.textContent = `${routines.length} / 1 rutina (Free)`;
      }
    }

    if (!routines.length) {
      routineListEl.innerHTML = `<div style="text-align: center; color: #888; padding: 1.5rem; background: #fafafa; border-radius: 12px;">No hay rutinas creadas. Pulsa <strong>+ Nueva Rutina</strong> para programar tu estudio.</div>`;
      return;
    }

    routines.forEach((r) => {
      const card = document.createElement("div");
      card.className = `routine-card ${r.enabled ? "is-active" : ""}`;
      card.innerHTML = `
        <div class="routine-info">
          <span class="routine-title">${r.name}</span>
          <span class="routine-meta">📅 ${formatDays(r.days)} • ⏰ ${r.startTime} a ${r.endTime}</span>
        </div>
        <div class="routine-controls">
          <label class="switch" title="Activar/desactivar rutina">
            <input type="checkbox" ${r.enabled ? "checked" : ""}>
            <span class="slider"></span>
          </label>
          <button type="button" class="btn-remove" title="Eliminar rutina">&times;</button>
        </div>
      `;

      // Toggle rutina
      card.querySelector("input[type='checkbox']").addEventListener("change", async (e) => {
        r.enabled = e.target.checked;
        await chrome.storage.local.set({ routines });
        renderRoutines();
      });

      // Eliminar rutina
      card.querySelector(".btn-remove").addEventListener("click", async () => {
        routines = routines.filter(item => item.id !== r.id);
        await chrome.storage.local.set({ routines });
        renderRoutines();
      });

      routineListEl.appendChild(card);
    });
  }

  routineForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isPro && routines.length >= 1) {
      openOptModal();
      return;
    }

    const name = routineNameInput.value.trim() || "Sesión de Estudio";
    const selectedDays = Array.from(daysSelectorEl.querySelectorAll("input:checked")).map(cb => parseInt(cb.value, 10));

    if (!selectedDays.length) {
      alert("Por favor, selecciona al menos un día de la semana.");
      return;
    }

    const newRoutine = {
      id: "routine_" + Date.now(),
      name,
      days: selectedDays,
      startTime: routineStartInput.value,
      endTime: routineEndInput.value,
      enabled: true
    };

    routines.push(newRoutine);
    await chrome.storage.local.set({ routines });
    renderRoutines();
    routineForm.reset();
    routineForm.classList.add("hidden");
  });

  // Inicializar estado y renderizados
  updateProUI();
});
