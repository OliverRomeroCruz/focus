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
});

/**
 * Motor de animación Stagger Text (framer-motion / VengeanceUI adaptado para Vanilla JS)
 */
function initStaggerText() {
  const elements = document.querySelectorAll('[data-stagger-text]');
  if (!elements.length) return;

  elements.forEach((element) => {
    const divideBy = element.dataset.staggerDivide || 'word';
    const baseDelay = parseFloat(element.dataset.staggerDelay || '0');
    const customStagger = element.dataset.stagger
      ? parseFloat(element.dataset.stagger)
      : (divideBy === 'letter' ? 0.025 : 0.05);

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
  });
}
