/**
 * Hairlux Academy -- Free Resources page.
 * Public (no login). Lists published resources; downloading asks for Full
 * Name, Phone and Email (the lead), then starts a short-lived download.
 * Deep link: resources.html?r=<slug> opens that resource's form directly.
 */
(function () {
  'use strict';

  const LEAD_KEY = 'hairlux_resource_lead';
  const DONE_KEY = 'hairlux_resources_downloaded';
  const BASE = (API_CONFIG.ENDPOINTS.FREE_RESOURCES && API_CONFIG.ENDPOINTS.FREE_RESOURCES.BASE) || '/academy/free-resources';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg, type) => { if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type || 'success'); };
  const fmtBytes = (n) => { n = Number(n) || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return Math.round(n / 1024) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
  };

  const params = new URLSearchParams(window.location.search);
  const attribution = {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    referrer: (document.referrer && document.referrer.indexOf(window.location.host) === -1) ? document.referrer.slice(0, 500) : undefined,
  };

  let resources = [];
  let activeCategory = '';
  let current = null;
  let lastUrl = null;
  let downloaded = new Set(store.get(DONE_KEY, []));

  // ── Render ─────────────────────────────────────────────────────────────
  function renderChips() {
    const cats = [...new Set(resources.map((r) => r.category).filter(Boolean))].sort();
    const wrap = $('resCategoryChips');
    if (cats.length < 2) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = ['', ...cats].map((c) =>
      `<button type="button" class="res-chip${c === activeCategory ? ' is-active' : ''}" data-cat="${esc(c)}">${c ? esc(c) : 'All'}</button>`
    ).join('');
  }

  function renderGrid() {
    const q = ($('resSearch').value || '').trim().toLowerCase();
    const list = resources.filter((r) =>
      (!activeCategory || r.category === activeCategory) &&
      (!q || (r.title + ' ' + (r.description || '') + ' ' + (r.category || '')).toLowerCase().includes(q)));
    const grid = $('resGrid');
    if (!resources.length) {
      grid.innerHTML = '<div class="empty-state">New free resources are on the way &mdash; check back soon.</div>';
      return;
    }
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state">No resources match your search.</div>';
      return;
    }
    grid.innerHTML = list.map((r) => {
      const cover = r.coverImageUrl
        ? `<img src="${esc(r.coverImageUrl)}" alt="" loading="lazy" />`
        : `<div class="res-file-icon">${esc(r.fileExtension)}</div>`;
      const desc = r.description && r.description.length > 180 ? r.description.slice(0, 180).trimEnd() + '…' : (r.description || '');
      return `<article class="crs-card res-card" data-slug="${esc(r.slug)}">
        <div class="res-card-cover">${cover}${r.coverImageUrl ? `<span class="res-card-type">${esc(r.fileExtension)}</span>` : ''}</div>
        <div class="res-card-body">
          <div class="crs-card-top">
            <div class="crs-card-name">${esc(r.title)}</div>
            ${r.category ? `<span class="crs-card-badge">${esc(r.category)}</span>` : ''}
          </div>
          ${desc ? `<div class="crs-card-desc res-card-desc">${esc(desc)}</div>` : '<div class="crs-card-desc"></div>'}
          <div class="res-card-bottom">
            <span class="res-card-meta">${downloaded.has(r.id) ? '<span class="res-card-done">&#10003; Downloaded</span>' : esc(r.fileExtension) + ' &middot; ' + fmtBytes(r.fileSizeBytes)}</span>
            <button type="button" class="btn-crs btn-crs-primary res-download-btn" data-id="${esc(r.id)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/></svg>
              ${downloaded.has(r.id) ? 'Download again' : 'Free Download'}
            </button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  function prefill() {
    const saved = store.get(LEAD_KEY, null);
    let user = null;
    try { user = (typeof APIHelper !== 'undefined' && APIHelper.isAuthenticated()) ? APIHelper.getUserData() : null; } catch (_) { user = null; }
    const name = (saved && saved.fullName) || (user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '');
    const phone = (saved && saved.phone) || (user && user.phone) || '';
    const email = (saved && saved.email) || (user && user.email) || '';
    if (!$('resFullName').value) $('resFullName').value = name;
    if (!$('resPhone').value) $('resPhone').value = phone;
    if (!$('resEmail').value) $('resEmail').value = email;
  }

  function clearErrors() {
    ['resFullName', 'resPhone', 'resEmail'].forEach((id) => { $(id).classList.remove('is-invalid'); $(id + 'Err').classList.remove('is-visible'); });
    $('resFormErr').classList.remove('is-visible');
  }
  function fieldError(id, msg) {
    $(id).classList.add('is-invalid');
    $(id + 'Err').textContent = msg;
    $(id + 'Err').classList.add('is-visible');
  }

  function openModal(resource) {
    current = resource;
    clearErrors();
    $('resFormView').hidden = false;
    $('resDoneView').hidden = true;
    $('resSummary').innerHTML = `<div class="res-summary-icon">${esc(resource.fileExtension)}</div>
      <div><div class="res-summary-title">${esc(resource.title)}</div>
      <div class="res-summary-meta">${esc(resource.fileExtension)} &middot; ${fmtBytes(resource.fileSizeBytes)} &middot; Free</div></div>`;
    prefill();
    $('resOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = ['resFullName', 'resPhone', 'resEmail'].map($).find((el) => !el.value);
      (first || $('resSubmit')).focus();
    }, 50);
  }

  function closeModal() {
    $('resOverlay').classList.remove('open');
    document.body.style.overflow = '';
    current = null;
    if (params.has('r')) {
      params.delete('r');
      const qs = params.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    }
  }

  function startDownload(url) {
    // Presigned URL responds with Content-Disposition: attachment, so the
    // browser saves the file and this page stays put.
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
  }

  function validate(v) {
    let ok = true;
    if (v.fullName.length < 2) { fieldError('resFullName', 'Please enter your full name.'); ok = false; }
    if (!/^\+?[0-9][0-9\s\-()]{6,19}$/.test(v.phone)) { fieldError('resPhone', 'Please enter a valid phone number.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) { fieldError('resEmail', 'Please enter a valid email address.'); ok = false; }
    return ok;
  }

  async function submit(e) {
    e.preventDefault();
    if (!current) return;
    clearErrors();
    const v = {
      fullName: $('resFullName').value.trim().replace(/\s+/g, ' '),
      phone: $('resPhone').value.trim(),
      email: $('resEmail').value.trim().toLowerCase(),
    };
    if (!validate(v)) return;

    const btn = $('resSubmit');
    btn.disabled = true;
    btn.textContent = 'Preparing download…';
    try {
      const body = Object.assign({}, v, { marketingConsent: $('resConsent').checked }, attribution);
      const hp = $('resWebsite').value;
      if (hp) body.website = hp;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      const res = await APIHelper.request(`${BASE}/${encodeURIComponent(current.id)}/download`, { method: 'POST', body: JSON.stringify(body) });
      const data = (res && res.data) || {};
      lastUrl = data.downloadUrl;
      store.set(LEAD_KEY, v);
      downloaded.add(current.id);
      store.set(DONE_KEY, [...downloaded]);
      startDownload(lastUrl);
      $('resDoneText').textContent = `“${current.title}” is downloading now. Thanks, ${v.fullName.split(' ')[0]}!`;
      $('resFormView').hidden = true;
      $('resDoneView').hidden = false;
      $('resDoneClose').focus();
      renderGrid();
    } catch (err) {
      let msg = (err && err.message) || 'Something went wrong. Please try again.';
      if (Array.isArray(msg)) msg = msg.join(' ');
      if (err && err.status === 429) msg = 'Too many attempts — please wait a minute and try again.';
      $('resFormErr').textContent = msg;
      $('resFormErr').classList.add('is-visible');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Download Now';
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────
  async function load() {
    try {
      const res = await APIHelper.request(BASE, { method: 'GET' });
      const data = (res && res.data) || {};
      resources = Array.isArray(data) ? data : (data.resources || []);
      if (data.consentText) $('resConsentText').textContent = data.consentText;
      renderChips();
      renderGrid();
      const slug = params.get('r');
      if (slug) {
        const r = resources.find((x) => x.slug === slug || x.id === slug);
        if (r) {
          const card = document.querySelector(`.res-card[data-slug="${CSS.escape(r.slug)}"]`);
          if (card) { card.classList.add('is-highlight'); card.scrollIntoView({ block: 'center' }); }
          openModal(r);
        } else {
          toast('That resource is no longer available — here’s everything else we have.', 'info');
        }
      }
    } catch (err) {
      $('resGrid').innerHTML = '<div class="empty-state">We couldn’t load resources right now. Please refresh the page.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('resSearch').addEventListener('input', renderGrid);
    $('resCategoryChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.res-chip');
      if (!chip) return;
      activeCategory = chip.dataset.cat || '';
      renderChips();
      renderGrid();
    });
    $('resGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('.res-download-btn');
      if (!btn) return;
      const r = resources.find((x) => x.id === btn.dataset.id);
      if (r) openModal(r);
    });
    $('resForm').addEventListener('submit', submit);
    ['resClose', 'resCancel', 'resDoneClose'].forEach((id) => $(id).addEventListener('click', closeModal));
    $('resOverlay').addEventListener('click', (e) => { if (e.target === $('resOverlay')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('resOverlay').classList.contains('open')) closeModal(); });
    $('resDownloadAgain').addEventListener('click', (e) => { e.preventDefault(); if (lastUrl) startDownload(lastUrl); });
    load();
  });
})();
