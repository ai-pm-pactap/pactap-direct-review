(function () {
  'use strict';
  const bags = { twisted: 'Twisted-handle paper bag', flat: 'Flat-handle paper bag', sos: 'SOS paper bag' };
  const markets = { global: 'Global', in: 'India', uae: 'United Arab Emirates', us: 'United States' };
  const emirates = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
  const papers = { brown: 'Brown kraft', white: 'White paper' };
  const printing = { unprinted: 'Unprinted', 'one-colour': 'One colour', 'two-colour': 'Two colours', 'full-colour': 'Full colour' };
  const timings = { '': 'Not specified', flexible: 'Flexible', 'under-2-weeks': 'Within 2 weeks', '2-4-weeks': '2–4 weeks', '1-3-months': '1–3 months' };
  const frequencies = { '': 'Not specified', 'one-off': 'One-off requirement', repeat: 'Repeat requirement', unsure: 'Not sure yet' };

  function validateConfiguration(input) {
    const data = input && typeof input === 'object' ? input : {};
    const errors = {};
    const value = {};
    value.mode = data.mode === undefined ? 'detailed' : data.mode;
    if (!['detailed', 'assisted'].includes(value.mode)) errors.mode = 'Choose how you would like to prepare your requirement.';
    value.purpose = value.mode === 'assisted' && typeof data.purpose === 'string' ? data.purpose.trim() : '';
    if (value.mode === 'assisted' && (!value.purpose || value.purpose.length > 300 || /[\x00-\x1f\x7f]/.test(value.purpose))) errors.purpose = 'Describe what you need to pack (up to 300 characters, on one line).';
    for (const [key, choices] of Object.entries({ timing: timings, frequency: frequencies })) {
      value[key] = data[key] === undefined ? '' : data[key];
      if (typeof value[key] !== 'string' || !Object.hasOwn(choices, value[key])) errors[key] = 'Choose a supported ' + (key === 'timing' ? 'timeframe' : 'order pattern') + '.';
    }
    for (const [key, choices] of Object.entries({ market: markets, bag: bags, paper: papers, print: printing })) {
      if (value.mode === 'assisted' && key !== 'market') { value[key] = ''; continue; }
      value[key] = typeof data[key] === 'string' ? data[key] : '';
      if (!Object.hasOwn(choices, value[key])) errors[key] = 'Choose a supported ' + (key === 'print' ? 'print option' : key) + '.';
    }
    for (const [key, minimum, maximum] of [['width', 1, 2000], ['gusset', 1, 2000], ['height', 1, 2000], ['quantity', 1, 10000000], ['gsm', 40, 300]]) {
      if (value.mode === 'assisted' && key !== 'quantity') { value[key] = null; continue; }
      const raw = String(data[key] ?? '').trim();
      value[key] = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value[key]) || value[key] < minimum || value[key] > maximum) {
        errors[key] = 'Enter a whole number from ' + minimum.toLocaleString('en') + ' to ' + maximum.toLocaleString('en') + '.';
      }
    }
    value.city = typeof data.city === 'string' ? data.city.trim() : '';
    if (!value.city || value.city.length > 120 || /[\r\n\x00-\x1f]/.test(value.city)) errors.city = 'Enter your delivery city / locality (up to 120 characters).';
    value.postal = typeof data.postal === 'string' ? data.postal.trim() : '';
    value.emirate = typeof data.emirate === 'string' ? data.emirate : '';
    value.country = value.market === 'global' && typeof data.country === 'string' ? data.country.trim() : '';
    if (value.market === 'global') {
      if (!value.country || value.country.length > 80 || /[\x00-\x1f\x7f]/.test(value.country)) errors.country = 'Enter the destination country (up to 80 characters).';
      if (value.postal.length > 20 || /[\x00-\x1f\x7f]/.test(value.postal)) errors.postal = 'Enter a postal code of up to 20 characters, or leave it blank.';
    }
    if (value.market === 'in' && !/^[1-9]\d{5}$/.test(value.postal)) errors.postal = 'Enter a six-digit Indian PIN code.';
    if (value.market === 'us' && !/^\d{5}(-\d{4})?$/.test(value.postal)) errors.postal = 'Enter a five-digit ZIP or ZIP+4 (e.g. 10001-1234).';
    if (value.market === 'uae') {
      value.postal = '';
      if (!emirates.includes(value.emirate)) errors.emirate = 'Choose a delivery emirate.';
    } else value.emirate = '';
    return { valid: Object.keys(errors).length === 0, errors, value };
  }

  function buildBrief(input) {
    const checked = validateConfiguration(input);
    if (!checked.valid) throw new TypeError('A complete valid specification is required.');
    const v = checked.value;
    return [
      'PACTAP DIRECT — CUSTOMER REQUIREMENT',
      'Market: ' + markets[v.market],
      'Entry path: ' + (v.mode === 'assisted' ? 'Help me choose' : 'Known specification'),
      ...(v.mode === 'assisted' ? ['Product range: Paper bags', 'Intended use: ' + v.purpose, 'Format, dimensions, material and print: To be confirmed with the buyer'] : [
        'Bag: ' + bags[v.bag],
        'Dimensions (width × gusset × height): ' + v.width + ' × ' + v.gusset + ' × ' + v.height + ' mm',
        'Paper requested: ' + papers[v.paper] + ', ' + v.gsm + ' GSM',
        'Print requested: ' + printing[v.print]
      ]),
      'Quantity: ' + v.quantity.toLocaleString('en') + ' bags',
      'Requested timeframe: ' + timings[v.timing] + ' (requested need-by timeframe, not a dispatch date)',
      'Order pattern: ' + frequencies[v.frequency],
      'Delivery: ' + [v.city, v.emirate, v.postal, v.country || markets[v.market]].filter(Boolean).join(', '),
      '',
      'This is a customer-supplied specification, not a price quotation.',
      'Live pricing is not connected. Availability, taxes and total price require confirmation. Delivery schedules are agreed with your written quote, subject to Terms and Conditions.'
    ].join('\n');
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { validateConfiguration, buildBrief };
  if (typeof document === 'undefined') return;
  window.PactapDirect = { validateConfiguration, buildBrief };
  const root = document.querySelector('.pd[data-market]');
  if (!root) return;
  const menus = [root.querySelector?.('.pd-market'), root.querySelector?.('[data-route-filters]')].filter(Boolean);
  menus.forEach(marketSelector => {
    marketSelector.addEventListener('keydown', event => {
      if (event.key === 'Escape' && marketSelector.open) {
        marketSelector.open = false;
        marketSelector.querySelector('summary').focus();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (marketSelector.open && !marketSelector.contains(event.target)) marketSelector.open = false;
    });
    marketSelector.addEventListener('focusout', event => {
      if (event.relatedTarget && !marketSelector.contains(event.relatedTarget)) marketSelector.open = false;
    });
  });
  const productCanvas = root.querySelector?.('[data-product-render]');
  let productScene = null;
  if (productCanvas && window.PactapDirect3D) {
    const frame = productCanvas.parentElement;
    const poster = frame.querySelector('img');
    const hint = frame.querySelector('[data-product-hint]');
    productCanvas.addEventListener('pd3d:unavailable', () => {
      productScene?.destroy();
      productScene = null;
      frame.classList.remove('pd-3d-ready');
      productCanvas.tabIndex = -1;
      productCanvas.setAttribute('aria-hidden', 'true');
      poster?.removeAttribute('aria-hidden');
      if (hint) hint.hidden = true;
    });
    try { productScene = window.PactapDirect3D.mount(productCanvas); } catch { productScene = null; }
    if (productScene) {
      frame.classList.add('pd-3d-ready');
      productCanvas.tabIndex = 0;
      productCanvas.removeAttribute('aria-hidden');
      poster?.setAttribute('aria-hidden', 'true');
      if (hint) hint.hidden = false;
    }
  }
  const portfolio = Array.from(root.querySelectorAll?.('[data-hero-product]') || []);
  let selectedProduct = 0, resetProductTour = () => {};
  function selectProduct(button) {
    const type = button.dataset.heroProduct;
    if (!Object.hasOwn(bags, type)) return;
    const frame = productCanvas?.parentElement, poster = frame?.querySelector('img');
    if (poster) {
      poster.src = button.dataset.productAsset + '-960.webp';
      poster.srcset = button.dataset.productAsset + '-480.webp 480w, ' + button.dataset.productAsset + '-960.webp 960w';
      poster.alt = 'Representative ' + bags[type].toLowerCase();
    }
    const deliveryProduct = root.querySelector?.('[data-delivery-product]');
    if (deliveryProduct) deliveryProduct.src = button.dataset.productAsset + '-480.webp';
    productCanvas?.setAttribute('aria-label', 'Interactive 3D illustration: ' + bags[type] + '. Drag or use left and right arrows to rotate.');
    if (productScene && !productScene.setProduct(type)) {
      productScene?.destroy(); productScene = null;
      frame.classList.remove('pd-3d-ready');
      productCanvas.tabIndex = -1; productCanvas.setAttribute('aria-hidden', 'true');
      poster?.removeAttribute('aria-hidden');
      const hint = frame.querySelector('[data-product-hint]'); if (hint) hint.hidden = true;
    }
    portfolio.forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    selectedProduct = portfolio.indexOf(button);
  }
  portfolio.forEach(button => { button.disabled = false; button.addEventListener('click', () => {
    selectProduct(button); resetProductTour();
  }); });
  // Product and route motion share the same user-controlled pause state.
  const stage = root.querySelector?.('.pd-product-stage');
  if (stage && window.requestAnimationFrame && window.matchMedia) {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gradients = root.querySelectorAll('.pd-hero,.pd-enquiry-section');
    const reveals = root.querySelectorAll('.pd-section-heading,.pd-product-card,.pd-how-grid article');
    const priceTargets = Array.from(root.querySelectorAll('.pd-price,.pd-delivery-tag strong'));
    const pricePlayed = new Set();
    let priceCues = [];
    const shipping = root.querySelector('.pd-shipping');
    const route = shipping?.querySelector('.pd-route[data-destination="' + root.dataset.market + '"]');
    const routeMap = shipping?.querySelector('#pd-shipping-map');
    const routeLand = routeMap?.querySelector('.pd-shipping-land');
    const routeContext = shipping?.querySelector('[data-route-context]');
    const filterGroup = shipping?.querySelector('[data-route-filters]');
    const filters = shipping?.querySelectorAll('[data-route-filter]') || [];
    if (route && filterGroup) {
      filterGroup.hidden = false;
      shipping.classList.add('pd-route-explorable');
      filters.forEach(button => button.addEventListener('click', () => {
        const view = button.dataset.routeFilter;
        if (!['all', 'global', 'local'].includes(view) || (view === 'local' && root.dataset.market === 'global')) return;
        shipping.dataset.routeView = view;
        routeMap?.setAttribute('viewBox', view === 'local' ? route.dataset.domesticViewbox : '0 0 720 290');
        routeLand?.setAttribute('href', view === 'local' ? routeLand.dataset.domesticSrc : routeLand.dataset.worldSrc);
        shipping.style.setProperty('--pd-route-scale', view === 'local' ? route.dataset.domesticScale : '1');
        if (routeContext) routeContext.textContent = {
          all: root.dataset.market === 'global' ? 'India and international origins. Delivery availability is confirmed for your destination.' : 'Across borders. Within ' + markets[root.dataset.market] + '. One delivery destination.',
          global: root.dataset.market === 'in' ? 'International sourcing across five illustrative origin regions.' : 'India and international sourcing origins. Routes are illustrative, not confirmed serviceability.',
          local: 'Domestic sourcing within ' + markets[root.dataset.market] + ' · country detail.'
        }[view];
        filters.forEach(control => control.setAttribute('aria-pressed', String(control === button)));
        const current = filterGroup.querySelector?.('[data-route-current]');
        if (current) current.textContent = { all: 'All sources', global: 'International', local: 'Domestic' }[view];
        filterGroup.open = false;
        const trigger = filterGroup.querySelector?.('summary');
        trigger?.setAttribute('aria-label', 'Sourcing view: ' + ({ all: 'All sources', global: 'International', local: 'Domestic' }[view]));
        trigger?.focus({ preventScroll: true });
      }));
    }
    const lanes = Array.from(route?.querySelectorAll('.pd-route-lane') || []).map(lane => ({
      path: lane.querySelector('.pd-route-path'), marker: lane.querySelector('.pd-route-marker'), arrival: lane.querySelector('.pd-route-arrival')
    }));
    const toggle = shipping?.querySelector('[data-route-toggle]');
    const canShip = window.IntersectionObserver && lanes.length && lanes.every(lane => lane.marker?.animate && lane.arrival?.animate && lane.path?.getTotalLength && lane.path?.getPointAtLength);
    let shippingAnimations = [], shippingVisible = false, shippingPaused = false, shippingFailed = false;
    let frame = 0, observer;
    let tourTimer = 0, tourAnimation = null, tourFocused = false, tourDragging = false, tourFailed = false;
    const canTour = () => productScene && shippingVisible && !shippingPaused && !preference.matches && !document.hidden && !tourFocused && !tourDragging && !tourFailed && portfolio.length > 1 && productCanvas?.animate && window.setTimeout;
    function stopTour() {
      if (tourTimer) window.clearTimeout(tourTimer);
      tourTimer = 0;
      if (tourAnimation) { tourAnimation.onfinish = null; tourAnimation.cancel(); tourAnimation = null; }
    }
    function syncTour() {
      if (!canTour()) { stopTour(); return; }
      if (tourTimer || tourAnimation) return;
      tourTimer = window.setTimeout(() => {
        tourTimer = 0;
        if (!canTour()) return;
        // One canvas: swap the mesh only at full fade, retaining the same rotation and GPU resources.
        const fade = (keyframes, duration, finish) => {
          const animation = productCanvas.animate(keyframes, { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
          tourAnimation = animation;
          animation.onfinish = () => { if (tourAnimation === animation) finish(animation); };
        };
        try {
          fade([{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-8px) scale(.985)' }], 280, outgoing => {
            try {
              if (!canTour()) { stopTour(); return; }
              selectProduct(portfolio[(selectedProduct + 1) % portfolio.length]);
              outgoing.cancel(); tourAnimation = null;
              if (!productScene) { syncShipping(); return; }
              fade([{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 620, incoming => {
                incoming.cancel(); tourAnimation = null; syncTour();
              });
            } catch { tourFailed = true; stopTour(); }
          });
        } catch { tourFailed = true; stopTour(); }
      }, 7600);
    }
    resetProductTour = () => { stopTour(); syncTour(); };
    // The explicit Resume control may restart the tour while keeping keyboard focus.
    stage.addEventListener?.('focusin', event => { tourFocused = event.target !== toggle; resetProductTour(); });
    stage.addEventListener?.('focusout', event => {
      if (!stage.contains(event.relatedTarget)) { tourFocused = false; resetProductTour(); }
    });
    productCanvas?.addEventListener('pointerdown', () => { tourDragging = true; stopTour(); });
    const finishDrag = () => { if (tourDragging) { tourDragging = false; resetProductTour(); } };
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', finishDrag);
    function syncShipping() {
      syncTour();
      if (shippingPaused || preference.matches || document.hidden) {
        priceCues.forEach(animation => animation.cancel());
        priceCues = [];
      }
      productScene?.setPaused(shippingPaused);
      if (toggle) {
        toggle.hidden = preference.matches || (!productScene && (!canShip || shippingFailed));
        toggle.textContent = shippingPaused ? 'Resume motion' : 'Pause motion';
      }
      if (preference.matches) {
        shippingAnimations.forEach(animation => animation.cancel());
        shippingAnimations = [];
        return;
      }
      if (!canShip || shippingFailed) return;
      if (!shippingVisible || shippingPaused || document.hidden) {
        shippingAnimations.forEach(animation => animation.pause());
        return;
      }
      // Decorative API failures must not interrupt the specification form.
      try {
        if (!shippingAnimations.length) {
          const start = document.timeline?.currentTime;
          // Unequal periods and invisible resets avoid one obvious whole-scene restart.
          const periods = [19000, 23000, 29000, 31000, 37000, 13000, 17000, 21000, 27000, 33000, 39000, 41000];
          const phases = [-2000, -9800, -17400, -8600, -26700, -700, -9200, -15500, -11000, -2100, -22900, -31400];
          lanes.forEach((lane, index) => {
            const length = lane.path.getTotalLength();
            if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid illustrative route');
            const keyframes = [];
            for (let i = 0; i <= 64; i++) {
              const point = lane.path.getPointAtLength(length * i / 64);
              if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Invalid route point');
              keyframes.push({ transform: 'translate(' + point.x + 'px, ' + point.y + 'px)', offset: i / 64 * .64, opacity: Math.min(1, i / 3) });
            }
            const end = keyframes.at(-1).transform;
            keyframes.push({ transform: end, offset: .70, opacity: 0 }, { transform: end, offset: 1, opacity: 0 });
            const options = { duration: periods[index % periods.length], delay: phases[index % phases.length], iterations: Infinity, easing: 'linear' };
            const markerAnimation = lane.marker.animate(keyframes, options);
            shippingAnimations.push(markerAnimation);
            const arrivalAnimation = lane.arrival.animate([
              { opacity: 0, transform: 'scale(.7)', offset: 0 },
              { opacity: 0, transform: 'scale(.7)', offset: .64 },
              { opacity: .35, transform: 'scale(1)', offset: .68 },
              { opacity: 0, transform: 'scale(1.7)', offset: .80 },
              { opacity: 0, transform: 'scale(1.7)', offset: 1 }
            ], options);
            shippingAnimations.push(arrivalAnimation);
            if (Number.isFinite(start)) { markerAnimation.startTime = start; arrivalAnimation.startTime = start; }
          });
        }
        shippingAnimations.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
      } catch {
        shippingAnimations.forEach(animation => animation.cancel());
        shippingAnimations = [];
        shippingFailed = true;
        if (toggle) toggle.hidden = !productScene;
      }
    }
    toggle?.addEventListener('click', () => { shippingPaused = !shippingPaused; syncShipping(); });
    productCanvas?.addEventListener('pd3d:unavailable', syncShipping);
    function emphasizePrice(target) {
      if (pricePlayed.has(target)) return;
      pricePlayed.add(target);
      if (shippingPaused || preference.matches || document.hidden) return;
      const rows = Array.from(target.querySelectorAll('.pd-price-ddp,.pd-price-total'));
      // Brief visual emphasis only: no counters, loading state or fabricated quote values.
      (rows.length ? rows : [target]).forEach((element, index) => {
        if (!element.animate) return;
        try {
          priceCues.push(element.animate([
            { boxShadow: 'inset 0 -2px 0 #aad6bd00' },
            { boxShadow: 'inset 0 -2px 0 #aad6bd', offset: .35 },
            { boxShadow: 'inset 0 -2px 0 #aad6bd00' }
          ], { duration: 1100, delay: index * 150, iterations: 1, easing: 'ease-out' }));
        } catch { /* Decorative failures must not interrupt the requirement form. */ }
      });
    }
    const progress = rect => Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height))) - 0.5;
    function paintMotion() {
      frame = 0;
      const rect = stage.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const depth = progress(rect) * (window.innerWidth <= 800 ? 48 : 96);
        stage.style.setProperty('--pd-bag-y', depth.toFixed(2) + 'px');
        stage.style.setProperty('--pd-card-y', (-depth * 0.6).toFixed(2) + 'px');
      }
      gradients.forEach(section => {
        const bounds = section.getBoundingClientRect();
        if (bounds.bottom > 0 && bounds.top < window.innerHeight) section.style.setProperty('--pd-gradient-y', (progress(bounds) * 70).toFixed(2) + 'px');
      });
    }
    function queueMotion() {
      if (!frame && !document.hidden && !preference.matches) frame = window.requestAnimationFrame(paintMotion);
    }
    function configureMotion() {
      shippingVisible = false;
      syncShipping();
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('scroll', queueMotion);
      window.removeEventListener('resize', queueMotion);
      observer?.disconnect();
      const enabled = !preference.matches && !document.hidden;
      root.classList.toggle('pd-motion', enabled);
      if (!enabled) return;
      window.addEventListener('scroll', queueMotion, { passive: true });
      window.addEventListener('resize', queueMotion, { passive: true });
      if (window.IntersectionObserver) {
        observer = new window.IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.target === shipping) {
            shippingVisible = entry.isIntersecting;
            syncShipping();
          } else if (entry.isIntersecting) {
            if (priceTargets.includes(entry.target)) emphasizePrice(entry.target);
            else entry.target.classList.add('pd-revealed');
            observer.unobserve(entry.target);
          }
        }), { threshold: 0.12 });
        reveals.forEach(element => {
          if (!element.classList.contains('pd-revealed')) { element.classList.add('pd-reveal'); observer.observe(element); }
        });
        priceTargets.forEach(element => { if (!pricePlayed.has(element)) observer.observe(element); });
        if (shipping) observer.observe(shipping);
      }
      queueMotion();
    }
    preference.addEventListener('change', configureMotion);
    document.addEventListener('visibilitychange', configureMotion);
    configureMotion();
  }
  const form = document.getElementById('pd-configurator');
  if (!form) return;
  const status = document.getElementById('pd-config-status');
  const fields = key => form.elements.namedItem(key);
  const read = () => ({ ...Object.fromEntries(new FormData(form)), market: root.dataset.market });
  let attempted = false, prepared = false;
  const touched = new Set();
  const errorSummary = document.getElementById('pd-error-summary');
  let summarySignature = '';
  const fieldLabels = { market: 'Delivery market', mode: 'Specification path', purpose: 'Intended use', timing: 'Requested timeframe', frequency: 'Order pattern', bag: 'Product format', width: 'Width', gusset: 'Gusset', height: 'Height', quantity: 'Order quantity', paper: 'Paper finish', print: 'Printing', gsm: 'Paper weight', city: 'Delivery city', postal: 'Postal code', emirate: 'Emirate', country: 'Destination country' };
  const generatedBriefs = new WeakMap();
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  function update(showErrors = false) {
    const assisted = fields('mode')?.value === 'assisted';
    form.querySelectorAll('[data-detail-only]').forEach(section => { section.hidden = assisted; section.disabled = assisted; });
    form.querySelectorAll('[data-assisted-only]').forEach(section => { section.hidden = !assisted; section.disabled = !assisted; });
    const result = validateConfiguration(read());
    const v = result.value;
    setText('pd-summary-bag', assisted ? 'Paper bags · help me choose' : bags[v.bag] || 'Choose your bag');
    const selectedImage = form.querySelector('input[name="bag"]:checked')?.closest('.pd-bag-option')?.querySelector('img');
    const summaryImage = document.querySelector('.pd-quote-product img');
    if (summaryImage) summaryImage.hidden = assisted;
    if (selectedImage && summaryImage) {
      summaryImage.src = selectedImage.src;
      summaryImage.srcset = selectedImage.srcset || '';
    }
    setText('pd-summary-size', assisted ? 'Format & dimensions to confirm' : ['width', 'gusset', 'height'].some(key => result.errors[key]) ? 'Complete dimensions' : v.width + ' × ' + v.gusset + ' × ' + v.height + ' mm');
    setText('pd-summary-quantity', result.errors.quantity ? 'Enter quantity' : v.quantity.toLocaleString(root.dataset.locale || 'en') + ' bags');
    setText('pd-summary-destination', v.city ? [v.city, v.emirate, v.postal, v.country].filter(Boolean).join(', ') : 'Add your delivery location');
    setText('pd-summary-material', assisted ? 'Material & print to confirm' : ['paper', 'gsm', 'print'].some(key => result.errors[key]) ? 'Complete material details' : papers[v.paper] + ' · ' + v.gsm + ' GSM · ' + printing[v.print]);
    setText('pd-summary-planning', [timings[v.timing], frequencies[v.frequency]].filter(label => label && label !== 'Not specified').join(' · ') || 'Not specified');
    setText('pd-progress-product', assisted ? result.errors.purpose ? 'Describe use' : 'Assisted' : result.errors.bag ? 'Required' : 'Selected');
    setText('pd-progress-spec', ['mode', 'purpose', 'timing', 'frequency', 'width', 'gusset', 'height', 'quantity', 'paper', 'print', 'gsm'].some(key => result.errors[key]) ? 'Check details' : 'Complete');
    setText('pd-progress-delivery', ['city', 'postal', 'emirate', 'country'].some(key => result.errors[key]) ? 'Required' : 'Complete');
    setText('pd-review-state', !result.valid ? 'A few details are still needed.' : prepared ? 'Ready for enquiry · not submitted' : 'Your brief is ready to review.');
    const brief = result.valid ? buildBrief(v) : '';
    const requestFields = document.querySelectorAll('[name="pd-configuration"]');
    let hasManualBrief = false;
    requestFields.forEach(field => {
      // CF7 also supports typed specifications; never overwrite a customer's edits.
      if (field.value && field.value !== (generatedBriefs.get(field) || '')) { hasManualBrief = true; return; }
      field.value = brief;
      generatedBriefs.set(field, brief);
    });
    setText('pd-spec-sync-status', hasManualBrief ? 'Your edits have been kept. Check them against any changes above, or clear the specification to use the configured details again.' : '');
    const downloads = document.querySelectorAll('[data-download-brief]');
    downloads.forEach(button => { button.disabled = !result.valid; });
    {
      for (const key of Object.keys(fieldLabels)) {
        const control = fields(key);
        const error = document.getElementById('pd-error-' + key);
        const message = showErrors || touched.has(key) ? result.errors[key] || '' : '';
        if (error) error.textContent = message;
        const controls = control?.setAttribute ? [control] : Array.from(control || []);
        controls.forEach(item => item.setAttribute('aria-invalid', message ? 'true' : 'false'));
      }
    }
    if (errorSummary) {
      errorSummary.hidden = !showErrors || result.valid;
      const signature = JSON.stringify(showErrors ? result.errors : {});
      if (signature !== summarySignature) {
        summarySignature = signature;
        const list = errorSummary.querySelector('ul');
        list.replaceChildren();
        if (showErrors) Object.entries(result.errors).forEach(([key, message]) => {
          const item = document.createElement('li'), link = document.createElement('a');
          link.href = '#pd-' + key;
          link.textContent = (fieldLabels[key] || 'Requirement') + ': ' + message;
          link.addEventListener('click', event => { event.preventDefault(); focusField(key); });
          item.appendChild(link); list.appendChild(item);
        });
      }
    }
    return result;
  }

  function focusField(key) {
    const field = fields(key), invalid = field?.focus ? field : field?.[0];
    if (!invalid) return;
    let section = invalid.closest('details');
    while (section) { section.open = true; section = section.parentElement?.closest('details'); }
    invalid.focus();
  }
  function invalidatePrepared() {
    if (prepared) status.textContent = 'You’ve changed your requirements. Please review your brief again.';
    prepared = false;
  }
  form.addEventListener('input', () => { invalidatePrepared(); update(attempted); });
  form.addEventListener('focusout', event => { if (Object.hasOwn(fieldLabels, event.target.name || '')) { touched.add(event.target.name); update(attempted); } });
  form.addEventListener('change', event => {
    invalidatePrepared();
    if (event.target.name === 'size-preset' && event.target.value !== 'custom') {
      if (['180x80x240', '240x100x320', '320x120x410'].includes(event.target.value)) {
        const values = event.target.value.split('x');
        ['width', 'gusset', 'height'].forEach((key, i) => { fields(key).value = values[i]; });
      }
    }
    update(attempted);
  });
  ['width', 'gusset', 'height'].forEach(key => fields(key).addEventListener('input', () => { fields('size-preset').value = 'custom'; }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    attempted = true;
    const result = update(true);
    if (!result.valid) {
      status.textContent = 'Please check the highlighted details.';
      if (errorSummary) errorSummary.focus();
      else focusField(Object.keys(result.errors)[0]);
      return;
    }
    prepared = true;
    update(true);
    status.textContent = 'Your brief is ready. No quote has been priced or submitted.';
    const destination = document.getElementById('pd-enquiry-title');
    destination.focus({ preventScroll: true });
    destination.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
  document.querySelectorAll('[data-bag-select]').forEach(button => button.addEventListener('click', () => {
    const option = form.querySelector('input[name="bag"][value="' + button.dataset.bagSelect + '"]');
    if (option) { if (fields('mode')) fields('mode').value = 'detailed'; option.checked = true; invalidatePrepared(); update(attempted); option.focus({ preventScroll: true }); form.scrollIntoView({ block: 'start' }); }
  }));
  document.querySelectorAll('[data-download-brief]').forEach(button => button.addEventListener('click', () => {
    const result = update(true);
    if (!result.valid) return;
    let url, link;
    try {
      url = URL.createObjectURL(new Blob([buildBrief(result.value)], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = 'pactap-direct-' + result.value.market + '-requirement.txt';
      document.body.appendChild(link);
      link.click();
      status.textContent = 'Your brief is ready to download. No enquiry has been submitted.';
    } catch {
      status.textContent = 'We couldn’t download your brief. Your details are still here—please try again.';
    } finally {
      link?.remove();
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }));
  update();
  form.noValidate = true;
  form.querySelectorAll('[data-enhanced-only]').forEach(button => { button.disabled = false; });
  document.documentElement.classList.add('pd-enhanced');
})();
