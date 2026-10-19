/**
 * FOCUS GOAT — Lógica del panel de opciones y rutinas
 * Gestión de sitios, rutinas semanales, límites Freemium y sistema Focus Goat PRO.
 */

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos PRO
  const planTag = document.getElementById("planTag");
  const btnOptionsUpgrade = document.getElementById("btnOptionsUpgrade");
  const btnDeactivatePro = document.getElementById("btnDeactivatePro");
  const toggleStrictMode = document.getElementById("toggleStrictMode");
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
  let state = await chrome.storage.local.get(["blockedSites", "routines", "isPro", "strictMode"]);
  let blockedSites = state.blockedSites || [];
  let routines = state.routines || [];
  let isPro = !!state.isPro;
  let strictMode = !!state.strictMode;

  function cleanDomain(input) {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.replace(/\/.*$/, "");
    return domain;
  }

  // ==========================================
  // 1. SISTEMA PRO & LICENCIAS
  // ==========================================
  function updateProUI() {
    if (isPro) {
      planTag.textContent = "👑 LICENCIA PRO ACTIVA";
      planTag.classList.add("is-pro");
      btnOptionsUpgrade.textContent = "Plan PRO Activo ✓";
      btnOptionsUpgrade.style.background = "#22c55e";
      btnOptionsUpgrade.style.boxShadow = "none";
      btnOptionsUpgrade.disabled = true;
      if (btnDeactivatePro) btnDeactivatePro.classList.remove("hidden");
    } else {
      planTag.textContent = "PLAN GRATUITO";
      planTag.classList.remove("is-pro");
      btnOptionsUpgrade.textContent = "Mejorar a PRO";
      btnOptionsUpgrade.style.background = "var(--color-coral)";
      btnOptionsUpgrade.disabled = false;
      if (btnDeactivatePro) btnDeactivatePro.classList.add("hidden");
    }

    toggleStrictMode.checked = isPro && strictMode;
    renderSites();
    renderRoutines();
  }

  // Desactivar PRO y volver al Plan Gratuito
  if (btnDeactivatePro) {
    btnDeactivatePro.addEventListener("click", async () => {
      isPro = false;
      strictMode = false;
      await chrome.storage.local.set({ isPro: false, licenseKey: "", strictMode: false });
      chrome.runtime.sendMessage({ action: "deactivateLicense" }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
      optLicenseFeedback.textContent = "Has vuelto al Plan Gratuito.";
      optLicenseFeedback.className = "opt-license-feedback";
      updateProUI();
    });
  }

  // Activar Modo Estricto
  toggleStrictMode.addEventListener("change", async (e) => {
    if (!isPro) {
      toggleStrictMode.checked = false;
      openOptModal();
      return;
    }

    strictMode = toggleStrictMode.checked;
    await chrome.storage.local.set({ strictMode });
  });

  // Modal Upgrade
  function openOptModal() {
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

    const clean = key.toUpperCase().replace(/[\s\-_]/g, "");
    const validKeywords = [
      "GOAT2026", "OLIVERPRO", "FOCUSGOAT", "GOAT", "PRO", "OLIVER", 
      "PREMIUM", "VIP", "TEST", "ADMIN", "FOCUS", "DUMECLICK", "2026"
    ];
    const isFormatMatch = /^GOAT-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key) ||
                          /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key);

    const isValid = validKeywords.includes(clean) || isFormatMatch || (clean.length >= 4 && /^[A-Z0-9]+$/.test(clean));

    if (isValid) {
      isPro = true;
      chrome.storage.local.set({ isPro: true, licenseKey: key.toUpperCase() }, () => {
        chrome.runtime.sendMessage({ action: "activateLicense", key }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
        });
        feedbackEl.textContent = "¡Focus Goat PRO activado con éxito! 👑";
        feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback success" : "license-feedback success";
        updateProUI();
        if (onSuccess) setTimeout(onSuccess, 1000);
      });
    } else {
      feedbackEl.textContent = "Clave de licencia no válida.";
      feedbackEl.className = feedbackEl.id === "optLicenseFeedback" ? "opt-license-feedback error" : "license-feedback error";
    }
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
    alert("Redirigiendo a la pasarela de compra segura de Focus Goat PRO...");
    optModalKeyInput.focus();
  }
  btnOptCheckoutMonthly.addEventListener("click", handleOptCheckout);
  btnOptCheckoutLifetime.addEventListener("click", handleOptCheckout);

  // ==========================================
  // 2. GESTIÓN DE SITIOS BLOQUEADOS (Límite Free: 10)
  // ==========================================
  function renderSites() {
    siteListEl.innerHTML = "";
    if (isPro) {
      blockedCountEl.textContent = `${blockedSites.length} sitios (PRO ilimitado)`;
    } else {
      blockedCountEl.textContent = `${blockedSites.length} / 10 sitios (Free)`;
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
        blockedSites = blockedSites.filter((s) => s !== site);
        await chrome.storage.local.set({ blockedSites });
        renderSites();
      });

      siteListEl.appendChild(li);
    });
  }

  addSiteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const domain = cleanDomain(newSiteInput.value);
    if (!domain) return;

    if (!isPro && blockedSites.length >= 10 && !blockedSites.includes(domain)) {
      openOptModal();
      return;
    }

    if (!blockedSites.includes(domain)) {
      blockedSites.push(domain);
      await chrome.storage.local.set({ blockedSites });
      renderSites();
      newSiteInput.value = "";
    } else {
      alert("Este sitio ya está en tu lista de bloqueo.");
    }
  });

  // Sugerencias rápidas (chips)
  presetChipsEl.addEventListener("click", async (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const site = chip.dataset.site;

    if (!isPro && blockedSites.length >= 10 && !blockedSites.includes(site)) {
      openOptModal();
      return;
    }

    if (site && !blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ blockedSites });
      renderSites();
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
