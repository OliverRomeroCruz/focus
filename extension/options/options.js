/**
 * FOCUS GOAT — Lógica del panel de opciones y rutinas
 */

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

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos Sitios Bloqueados
  const siteListEl = document.getElementById("siteList");
  const addSiteForm = document.getElementById("addSiteForm");
  const newSiteInput = document.getElementById("newSiteInput");
  const blockedCountEl = document.getElementById("blockedCount");
  const presetChipsEl = document.getElementById("presetChips");

  // Elementos Rutinas
  const routineListEl = document.getElementById("routineList");
  const btnToggleNewRoutine = document.getElementById("btnToggleNewRoutine");
  const routineForm = document.getElementById("routineForm");
  const btnCancelRoutine = document.getElementById("btnCancelRoutine");
  const routineNameInput = document.getElementById("routineName");
  const routineStartInput = document.getElementById("routineStart");
  const routineEndInput = document.getElementById("routineEnd");
  const daysSelectorEl = document.getElementById("daysSelector");

  // Cargar estado inicial desde storage
  let state = await chrome.storage.local.get(["blockedSites", "routines"]);
  let blockedSites = state.blockedSites || [];
  let routines = state.routines || [];

  function cleanDomain(input) {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.replace(/\/.*$/, "");
    return domain;
  }

  // ==========================================
  // 1. GESTIÓN DE SITIOS BLOQUEADOS
  // ==========================================
  function renderSites() {
    siteListEl.innerHTML = "";
    blockedCountEl.textContent = `${blockedSites.length} sitio${blockedSites.length === 1 ? "" : "s"}`;

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
    if (site && !blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ blockedSites });
      renderSites();
    }
  });


  // ==========================================
  // 2. GESTIÓN DE RUTINAS SEMANALES
  // ==========================================
  btnToggleNewRoutine.addEventListener("click", () => {
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


  // Inicializar renderizados
  renderSites();
  renderRoutines();
});
