(function () {
  'use strict';
  const strip = document.querySelector('[data-assurances]');
  if (!strip || !window.matchMedia) return;
  const list = strip.querySelector('.pd-assurance-list');
  const button = strip.querySelector('[data-assurance-toggle]');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const copy = list.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  list.parentElement.appendChild(copy);
  let paused = false, visible = !('IntersectionObserver' in window);
  function update() {
    const animated = !paused && !preference.matches;
    strip.dataset.animated = String(animated);
    strip.dataset.running = String(animated && visible && !document.hidden);
    button.hidden = preference.matches;
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? 'Resume slider →' : 'Pause & read Ⅱ';
  }
  button.addEventListener('click', () => { paused = !paused; strip.dataset.resumed = String(!paused); update(); });
  strip.addEventListener('focusin', event => { if (event.target !== button) strip.dataset.resumed = 'false'; });
  strip.addEventListener('focusout', event => { if (!strip.contains(event.relatedTarget)) strip.dataset.resumed = 'false'; });
  strip.addEventListener('pointerleave', () => { strip.dataset.resumed = 'false'; });
  preference.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    const observer = new window.IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); });
    observer.observe(strip);
  }
  update();
})();
