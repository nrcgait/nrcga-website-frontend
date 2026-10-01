/**
 * Native form submissions via NRCGA API.
 *
 * Static forms: data-nrcga-form="<type>" with named inputs (+ honeypot website_url).
 * Schema-driven mounts: data-nrcga-form-mount="<slug>" — fetches GET /forms/:slug and renders fields.
 */
(function () {
  function sd() {
    return window.NRCGA_safeDom || {
      escapeHtml: (v) => String(v ?? ''),
      isSafeHttpUrl: () => false,
    };
  }

  function serializeForm(form) {
    const data = {};
    const fd = new FormData(form);
    for (const [key, value] of fd.entries()) {
      data[key] = typeof value === 'string' ? value : '';
    }
    form.querySelectorAll('input[type="checkbox"][name]').forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;
      if (!Object.prototype.hasOwnProperty.call(data, el.name)) data[el.name] = false;
      else data[el.name] = true;
    });
    const turnstileEl = form.querySelector('[data-turnstile-widget]');
    if (turnstileEl && window.NRCGA_turnstile) {
      data.turnstile_token = window.NRCGA_turnstile.readToken(turnstileEl);
    }
    return data;
  }

  async function ensureTurnstileOnForm(form) {
    if (!form || form.querySelector('[data-turnstile-widget]')) return;
    if (!window.NRCGA_turnstile) return;
    const siteKey = await window.NRCGA_turnstile.getSiteKey();
    if (!siteKey) return;
    const wrap = document.createElement('div');
    wrap.className = 'turnstile-widget-wrap';
    wrap.setAttribute('data-turnstile-widget', '1');
    const submit = form.querySelector('[type="submit"]');
    if (submit && submit.parentNode) {
      submit.parentNode.insertBefore(wrap, submit);
    } else {
      form.appendChild(wrap);
    }
    await window.NRCGA_turnstile.mountWidget(wrap);
  }

  async function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const type = form.getAttribute('data-nrcga-form');
    if (!type || !window.NRCGA_API) return;
    event.preventDefault();

    const statusEl = form.querySelector('[data-form-status]');
    const submitBtn = form.querySelector('[type="submit"]');
    const successMessage =
      form.getAttribute('data-success-message') || 'Thank you — your submission was received.';
    if (statusEl) {
      statusEl.textContent = 'Sending…';
      statusEl.className = 'form-status';
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
      await ensureTurnstileOnForm(form);
      const payload = serializeForm(form);
      const result = await window.NRCGA_API.post(`/forms/${encodeURIComponent(type)}`, payload);
      if (!result.success) throw new Error(result.error || 'Submission failed');
      form.reset();
      if (statusEl) {
        statusEl.textContent = result.message || successMessage;
        statusEl.className = 'form-status form-status-success';
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Something went wrong. Please try again.';
        statusEl.className = 'form-status form-status-error';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function renderField(field) {
    const { escapeHtml } = sd();
    const required = field.required ? 'required' : '';
    const placeholder = field.placeholder
      ? `placeholder="${escapeHtml(field.placeholder)}"`
      : '';
    const name = escapeHtml(field.name);
    const label = escapeHtml(field.label);
    const reqMark = field.required ? ' <span aria-hidden="true">*</span>' : '';

    if (field.type === 'textarea') {
      return `<div class="form-group"><label for="nrcga-${name}">${label}${reqMark}</label><textarea id="nrcga-${name}" name="${name}" rows="5" ${required} ${placeholder}></textarea></div>`;
    }
    if (field.type === 'select') {
      const options = (field.options || [])
        .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
        .join('');
      return `<div class="form-group"><label for="nrcga-${name}">${label}${reqMark}</label><select id="nrcga-${name}" name="${name}" ${required}><option value="">Select…</option>${options}</select></div>`;
    }
    if (field.type === 'checkbox') {
      return `<div class="form-group"><label><input type="checkbox" name="${name}" value="1" ${required} /> ${label}${reqMark}</label></div>`;
    }
    const inputType = ['email', 'tel', 'url'].includes(field.type) ? field.type : 'text';
    return `<div class="form-group"><label for="nrcga-${name}">${label}${reqMark}</label><input id="nrcga-${name}" type="${inputType}" name="${name}" ${required} ${placeholder} /></div>`;
  }

  async function mountSchemaForm(el) {
    const { escapeHtml } = sd();
    const slug = el.getAttribute('data-nrcga-form-mount');
    if (!slug || !window.NRCGA_API) {
      el.textContent = 'Form unavailable.';
      return;
    }
    el.innerHTML = '<p class="form-status">Loading form…</p>';
    try {
      const schema = await window.NRCGA_API.get(`/forms/${encodeURIComponent(slug)}`);
      if (!schema || schema.success === false || !Array.isArray(schema.fields)) {
        throw new Error((schema && schema.error) || 'Form not found.');
      }
      const fieldsHtml = schema.fields.map(renderField).join('');
      const submitLabel = escapeHtml(schema.submit_label || 'Submit');
      const successMessage = escapeHtml(
        schema.success_message || 'Thank you — your submission was received.',
      );
      el.innerHTML = `
        <form class="nrcga-form" data-nrcga-form="${escapeHtml(slug)}" data-success-message="${successMessage}">
          <div class="honeypot" aria-hidden="true">
            <label>Website<input type="text" name="website_url" tabindex="-1" autocomplete="off"></label>
          </div>
          ${fieldsHtml}
          <div data-turnstile-widget></div>
          <button type="submit">${submitLabel}</button>
          <p class="form-status" data-form-status></p>
        </form>
      `;
      const form = el.querySelector('form[data-nrcga-form]');
      if (form) await ensureTurnstileOnForm(form);
    } catch (err) {
      el.innerHTML = `<p class="form-status form-status-error">${escapeHtml(err.message || 'Could not load form.')}</p>`;
    }
  }

  function bindFormSubmit(form) {
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.nrcgaBound === '1') return;
    form.dataset.nrcgaBound = '1';
    form.addEventListener('submit', onSubmit);
    ensureTurnstileOnForm(form);
  }

  async function mountDynamicForms(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const mounts = scope.querySelectorAll('[data-nrcga-form-mount]:not([data-nrcga-form-mounted])');
    for (const el of mounts) {
      el.setAttribute('data-nrcga-form-mounted', '1');
      await mountSchemaForm(el);
    }
    scope.querySelectorAll('form[data-nrcga-form]').forEach(bindFormSubmit);
  }

  window.NRCGA_mountForms = mountDynamicForms;

  document.addEventListener('DOMContentLoaded', () => {
    mountDynamicForms(document);
  });
})();
