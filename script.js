/**
 * GLASSLINE — MOVILIDAD SUSPENDIDA
 * Control de ciclo de vida del video y accesibilidad
 */

document.addEventListener('DOMContentLoaded', () => {
  const heroElement = document.querySelector('.hero-frame');
  const video = document.querySelector('.hero-video');
  const poster = document.querySelector('.hero-poster');

  if (!video || !heroElement) return;

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isIntersectingViewport = true;

  // Función segura para reproducir video
  function playVideo() {
    if (reducedMotionQuery.matches) {
      video.pause();
      if (poster) poster.style.display = 'block';
      return;
    }

    if (video.paused && isIntersectingViewport) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Autoplay silenciado habitualmente permitido, capturamos cualquier política estricta
          console.warn('Reproducción de video diferida por política del navegador:', err);
        });
      }
    }
  }

  // Función para pausar video
  function pauseVideo() {
    if (!video.paused) {
      video.pause();
    }
  }

  // 1. Detección de preferencia de movimiento reducido (prefers-reduced-motion)
  function handleReducedMotionChange(e) {
    if (e.matches) {
      pauseVideo();
      if (poster) poster.style.display = 'block';
    } else {
      if (poster) poster.style.display = 'none';
      if (isIntersectingViewport) {
        playVideo();
      }
    }
  }

  if (reducedMotionQuery.matches) {
    pauseVideo();
    if (poster) poster.style.display = 'block';
  } else {
    playVideo();
  }

  reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

  // 2. IntersectionObserver para pausar fuera del viewport y reanudar al volver
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isIntersectingViewport = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (!reducedMotionQuery.matches) {
            playVideo();
          }
        } else {
          pauseVideo();
        }
      });
    }, {
      root: null,
      threshold: 0.15 // Al menos 15% visible para reproducir
    });

    observer.observe(heroElement);
  }

  // 3. Respaldo ante fallos de carga en el video
  video.addEventListener('error', () => {
    console.info('Usando poster como respaldo visual del video.');
    if (poster) poster.style.display = 'block';
  });

  // 4. Animación Stagger Text (VengeanceUI)
  initStaggerText();

  // 5. Selector de idioma (ES / EN)
  initLanguageSwitcher();

  // 6. Modal guía de instalación rápida
  initInstallModal();
});

/**
 * Control del modal de instalación de la extensión
 */
function initInstallModal() {
  const btnOpen = document.getElementById('btnOpenInstallModal');
  const modal = document.getElementById('installModal');
  const btnClose = document.getElementById('btnCloseModal');
  const backdrop = document.getElementById('modalBackdrop');
  const btnCopy = document.getElementById('btnCopyPath');
  const feedback = document.getElementById('copyFeedback');

  if (!btnOpen || !modal) return;

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  btnOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  if (btnCopy && feedback) {
    btnCopy.addEventListener('click', () => {
      const extPath = 'C:\\Users\\Oliver\\Documents\\antigravity\\3. Desarrollo\\focus\\extension';
      navigator.clipboard.writeText(extPath).then(() => {
        feedback.classList.add('is-visible');
        setTimeout(() => feedback.classList.remove('is-visible'), 2500);
      }).catch(() => {
        // Fallback
        prompt('Copia la ruta de la extensión:', extPath);
      });
    });
  }
}

/**
 * Diccionario multilingüe para Focus Goat
 */
const I18N = {
  es: {
    status: 'EXTENSIÓN ACTIVA',
    description: 'Bloquea las distracciones, domina tus horas de estudio y desbloquea el verdadero potencial de tu mente. La extensión de Google definitiva para transformar tu concentración en resultados extraordinarios. Tu mejor versión empieza ahora.',
    cta: 'Añadir a Chrome'
  },
  en: {
    status: 'EXTENSION ACTIVE',
    description: 'Block every distraction, master your study hours, and unlock your mind’s true potential. The ultimate Google extension designed to turn deep focus into extraordinary results. Your best version starts now.',
    cta: 'Add to Chrome'
  }
};

/**
 * Control del cambio de idioma superior derecho
 */
function initLanguageSwitcher() {
  const langButtons = document.querySelectorAll('.lang-btn');
  if (!langButtons.length) return;

  langButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.lang;
      if (!I18N[selected]) return;

      langButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      document.documentElement.lang = selected;

      // Actualizar estado del badge
      const statusEl = document.querySelector('[data-i18n="status"]');
      if (statusEl) statusEl.textContent = I18N[selected].status;

      // Actualizar botón CTA
      const ctaEl = document.querySelector('[data-i18n="cta"]');
      if (ctaEl) ctaEl.textContent = I18N[selected].cta;

      // Actualizar descripción y re-animar con stagger
      const descEl = document.querySelector('[data-i18n="description"]');
      if (descEl) {
        descEl.textContent = I18N[selected].description;
        applyStaggerToElement(descEl);
      }
    });
  });
}

/**
 * Motor de animación Stagger Text (framer-motion / VengeanceUI adaptado para Vanilla JS)
 */
function initStaggerText() {
  const elements = document.querySelectorAll('[data-stagger-text]');
  elements.forEach((element) => applyStaggerToElement(element));
}

function applyStaggerToElement(element) {
  const divideBy = element.dataset.staggerDivide || 'word';
  const baseDelay = parseFloat(element.dataset.staggerDelay || '0');
  const customStagger = element.dataset.stagger
    ? parseFloat(element.dataset.stagger)
    : (divideBy === 'letter' ? 0.025 : 0.045);

  let partIndex = 0;

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) {
        return document.createTextNode(text);
      }

      const fragment = document.createDocumentFragment();

      if (divideBy === 'letter') {
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const mask = document.createElement('span');
          mask.className = 'stagger-mask';

          const inner = document.createElement('span');
          inner.className = 'stagger-item';
          inner.textContent = char === ' ' ? '\u00A0' : char;

          if (char === '?' || char === '¿') {
            mask.style.paddingRight = '0.22em';
          }

          const delay = baseDelay + (partIndex * customStagger);
          inner.style.transitionDelay = `${delay.toFixed(3)}s`;

          mask.appendChild(inner);
          fragment.appendChild(mask);
          partIndex++;
        }
      } else {
        const tokens = text.split(/(\s+)/);
        tokens.forEach((token) => {
          if (/^\s+$/.test(token)) {
            fragment.appendChild(document.createTextNode(' '));
          } else if (token.length > 0) {
            const mask = document.createElement('span');
            mask.className = 'stagger-mask';

            const inner = document.createElement('span');
            inner.className = 'stagger-item';
            inner.textContent = token;

            // Asegurar holgura extra si contiene signos de interrogación o puntuación inclinada
            if (token.includes('?')) {
              mask.style.paddingRight = '0.25em';
              mask.style.marginRight = '0.05em';
            }

            const delay = baseDelay + (partIndex * customStagger);
            inner.style.transitionDelay = `${delay.toFixed(3)}s`;

            mask.appendChild(inner);
            fragment.appendChild(mask);
            partIndex++;
          }
        });
      }

      return fragment;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName.toLowerCase() === 'br') {
        return node.cloneNode(true);
      }
      const clone = node.cloneNode(false);
      Array.from(node.childNodes).forEach((child) => {
        clone.appendChild(processNode(child));
      });
      return clone;
    }
    return node.cloneNode(true);
  }

  const processedNodes = Array.from(element.childNodes).map(processNode);
  element.innerHTML = '';
  processedNodes.forEach((n) => element.appendChild(n));

  const masks = element.querySelectorAll('.stagger-mask');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          requestAnimationFrame(() => {
            masks.forEach((m) => m.classList.add('is-visible'));
          });
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    observer.observe(element);
  } else {
    masks.forEach((m) => m.classList.add('is-visible'));
  }
}
