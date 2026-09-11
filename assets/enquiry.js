(function () {
  'use strict';
  const prefixes = { in: '+91', uae: '+971', us: '+1', other: '' };
  const labels = { 'your-name': 'Full name', 'your-company': 'Company', 'your-email': 'Email', 'your-phone': 'Phone', 'pd-configuration': 'Specification', 'your-message': 'Message', 'enquiry-consent': 'Terms and privacy' };
  function normalizePhone(raw, prefix = '') {
    const value = typeof raw === 'string' ? raw.trim() : '';
    return value === prefix ? '' : value;
  }
  function validateEnquiry(data = {}, prefix = '') {
    data = data && typeof data === 'object' ? data : {};
    const errors = {}, value = {};
    for (const [name, maximum, required] of [['your-name', 100, true], ['your-company', 160, true], ['your-email', 254, true], ['your-phone', 40, false], ['pd-configuration', 4000, false], ['your-message', 2000, false]]) {
      value[name] = typeof data[name] === 'string' ? data[name].trim() : '';
      if (name === 'your-phone') value[name] = normalizePhone(value[name], prefix);
      if (required && !value[name]) errors[name] = 'Please enter your ' + labels[name].toLowerCase() + '.';
      else if (value[name].length > maximum) errors[name] = 'Use no more than ' + maximum + ' characters.';
      else if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value[name]) || (!['pd-configuration', 'your-message'].includes(name) && /[\r\n]/.test(value[name]))) errors[name] = 'Please remove any hidden formatting characters and try again.';
    }
    if (!errors['your-email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value['your-email'])) errors['your-email'] = 'Please check your email address, for example name@company.com.';
    if (value['your-phone'] && !errors['your-phone']) {
      const digits = value['your-phone'].replace(/\D/g, '');
      if (!/^\+[1-9][\d ()\-.]*$/.test(value['your-phone']) || digits.length < 5 || digits.length > 15) errors['your-phone'] = 'Use +, the international calling code and your number (5–15 digits in total), or leave phone blank.';
    }
    value['enquiry-consent'] = data['enquiry-consent'] === true || data['enquiry-consent'] === '1';
    if (!value['enquiry-consent']) errors['enquiry-consent'] = 'Review the Terms and Privacy Policy and tick the enquiry consent box.';
    return { valid: !Object.keys(errors).length, errors, value };
  }
  function cf7Outcome(type) {
    return {
      wpcf7mailsent: { phase: 'sent', message: 'Thank you — your enquiry has been sent. This is a request for a quote, not an order.' },
      wpcf7invalid: { phase: 'error', message: 'A few details need another look. Please check the highlighted fields before sending.' },
      wpcf7unaccepted: { phase: 'error', message: 'Before we can send your enquiry, please review and accept the terms and privacy notice.' },
      wpcf7spam: { phase: 'error', message: 'We couldn’t accept this enquiry. Your details are still here — please contact Pactap for help.' },
      wpcf7mailfailed: { phase: 'error', message: 'We couldn’t send your enquiry. Your details are still here. Please try again or contact Pactap.' },
      wpcf7aborted: { phase: 'error', message: 'Sending was interrupted. Your details are still here, but we haven’t confirmed your enquiry was sent. Please contact Pactap for help.' }
    }[type] || null;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validateEnquiry, normalizePhone, cf7Outcome };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-pd-enquiry]').forEach((panel, index) => {
    const form = panel.matches('form') ? panel : panel.closest('form');
    if (!form) return;
    const preview = panel.hasAttribute('data-enquiry-preview');
    const host = preview ? form : form.closest('.wpcf7');
    if (!host) return;
    const summary = panel.querySelector('[data-enquiry-summary]'), status = panel.querySelector('[data-enquiry-status]');
    const phone = form.elements.namedItem('your-phone'), country = panel.querySelector('[data-enquiry-country]');
    const controls = name => form.elements.namedItem(name);
    const submitters = Array.from(form.querySelectorAll('[type="submit"]'));
    const disabledBefore = new Map();
    let prefix = '', attempted = false, busy = false, settled = false, timer = 0, signature = '', serverErrors = {};
    const touched = new Set();
    const say = (message, phase = '') => { status.textContent = message; panel.dataset.enquiryState = phase; };
    const read = () => Object.fromEntries(Object.keys(labels).map(name => {
      const field = controls(name);
      return [name, name === 'enquiry-consent' ? !!field?.checked : field?.value || ''];
    }));
    const check = () => validateEnquiry(read(), prefix);
    function display(errors, focus = false) {
      for (const name of Object.keys(labels)) {
        const field = controls(name), note = panel.querySelector('[data-enquiry-error="' + name + '"]');
        if (note) note.textContent = errors[name] || '';
        if (field?.setAttribute) field.setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
      }
      const next = JSON.stringify(errors);
      summary.hidden = !Object.keys(errors).length;
      // Stable links survive focus moving from an input into the summary.
      if (signature !== next) {
        signature = next;
        const list = summary.querySelector('ul'); list.replaceChildren();
        for (const [name, message] of Object.entries(errors)) {
          const field = controls(name); if (!field?.focus) continue;
          const item = document.createElement('li'), link = document.createElement('a');
          link.href = '#' + field.id; link.textContent = labels[name] + ': ' + message;
          link.addEventListener('click', event => {
            event.preventDefault();
            let section = field.closest('details');
            while (section) { section.open = true; section = section.parentElement?.closest('details'); }
            field.focus();
          });
          item.appendChild(link); list.appendChild(item);
        }
      }
      if (focus && !summary.hidden) summary.focus();
    }
    function refresh() {
      const errors = check().errors;
      display({ ...serverErrors, ...Object.fromEntries(Object.entries(errors).filter(([name]) => attempted || touched.has(name))) });
    }
    function setBusy(value) {
      busy = value; form.setAttribute('aria-busy', String(value));
      if (timer) { window.clearTimeout(timer); timer = 0; }
      submitters.forEach(button => {
        if (value) { if (!disabledBefore.has(button)) disabledBefore.set(button, button.disabled); button.disabled = true; }
        else if (disabledBefore.has(button)) { button.disabled = disabledBefore.get(button); disabledBefore.delete(button); }
      });
      if (value) timer = window.setTimeout(() => {
        timer = 0;
        say('We couldn’t confirm whether your enquiry was sent. Your details are still here. Please contact Pactap before trying again.', 'unconfirmed');
      }, 45000);
    }
    function begin() {
      if (busy) return;
      settled = false; serverErrors = {}; display({}); setBusy(true);
      say('Sending your enquiry…', 'sending');
    }
    function validateAndShow() {
      attempted = true;
      const result = check(); display({ ...serverErrors, ...result.errors }, !result.valid || !!Object.keys(serverErrors).length);
      return result;
    }
    // Capture before CF7's submit listener, but leave valid production submissions to CF7.
    form.addEventListener('submit', event => {
      if (preview || busy) { event.preventDefault(); event.stopImmediatePropagation(); if (busy) return; }
      const result = validateAndShow();
      if (!result.valid) { event.preventDefault(); event.stopImmediatePropagation(); say('Please check your enquiry details.', 'error'); return; }
      if (preview) { say('Your details look ready. Nothing was sent or saved — this is a preview.', 'preview'); return; }
      // A suggested country prefix on its own is not a supplied phone number.
      if (phone && !result.value['your-phone']) phone.value = '';
    }, true);
    panel.addEventListener('input', event => {
      const name = event.target.name;
      if (!Object.hasOwn(labels, name || '')) return;
      delete serverErrors[name];
      if (!busy) { if (panel.dataset.enquiryState === 'sent' || panel.dataset.enquiryState === 'preview') say('You’ve updated your details. Please give them one more look.'); refresh(); }
    });
    panel.addEventListener('focusout', event => { if (Object.hasOwn(labels, event.target.name || '')) { touched.add(event.target.name); refresh(); } });
    for (const name of Object.keys(labels)) {
      const field = controls(name), note = panel.querySelector('[data-enquiry-error="' + name + '"]');
      if (!field?.setAttribute || !note) continue;
      if (!field.id) field.id = 'pde-' + index + '-' + name;
      note.id = 'pde-' + index + '-error-' + name;
      const described = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      described.add(note.id); field.setAttribute('aria-describedby', [...described].join(' '));
    }
    if (country && phone) {
      const market = panel.closest('[data-market]')?.dataset.market;
      country.value = Object.hasOwn(prefixes, market) ? market : 'other';
      prefix = prefixes[country.value];
      if (!phone.value.trim()) phone.value = prefix ? prefix + ' ' : '';
      country.disabled = false;
      country.addEventListener('change', () => {
        const next = prefixes[country.value] || '', current = phone.value.trim();
        if (!current || current === prefix) phone.value = next ? next + ' ' : '';
        else if (prefix && next && current.startsWith(prefix)) phone.value = next + current.slice(prefix.length);
        prefix = next; delete serverErrors['your-phone']; refresh();
      });
    }
    if (preview) {
      panel.querySelector('[data-enquiry-preview-fields]').disabled = false;
      panel.querySelector('[data-enquiry-check]').addEventListener('click', () => {
        const result = validateAndShow();
        say(result.valid ? 'Your details look ready. Nothing was sent or saved — this is a preview.' : 'Please check the highlighted fields. Nothing was sent or saved.', result.valid ? 'preview' : 'error');
      });
    } else {
      host.addEventListener('wpcf7beforesubmit', begin);
      host.addEventListener('wpcf7statuschanged', event => {
        const state = event.detail?.status;
        if (state === 'submitting') begin();
        else if (busy && ['invalid', 'unaccepted', 'spam', 'aborted', 'failed', 'sent'].includes(state)) setBusy(false);
      });
      for (const type of ['wpcf7invalid', 'wpcf7unaccepted', 'wpcf7spam', 'wpcf7mailfailed', 'wpcf7mailsent', 'wpcf7aborted']) host.addEventListener(type, event => {
        settled = true; setBusy(false);
        const outcome = cf7Outcome(type); say(outcome.message, outcome.phase);
        if (type === 'wpcf7invalid' || type === 'wpcf7unaccepted') {
          serverErrors = {};
          const invalidFields = event.detail?.apiResponse?.invalid_fields;
          for (const error of Array.isArray(invalidFields) ? invalidFields : []) if (error && Object.hasOwn(labels, error.field) && typeof error.message === 'string') serverErrors[error.field] = error.message;
          if (type === 'wpcf7unaccepted') serverErrors['enquiry-consent'] = 'Review the terms and select enquiry consent.';
          attempted = true; display({ ...check().errors, ...serverErrors }, true);
        }
      });
      host.addEventListener('wpcf7submit', () => {
        setBusy(false);
        if (!settled) say('We couldn’t confirm whether your enquiry was sent. Your details are still here. Please contact Pactap before trying again.', 'unconfirmed');
      });
    }
  });
})();
