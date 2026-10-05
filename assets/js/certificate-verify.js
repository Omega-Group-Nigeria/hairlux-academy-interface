/**
 * Hairlux Academy - Public Certificate Verification
 * Public, unauthenticated lookup against GET /commerce/certificates/:id/verify
 * (accepts either the certificate's DB id or its printed certificateNumber).
 * Used by certificate-verify.html?code=<certificateNumber>, and by the
 * secondary manual-lookup form on the same page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('cvRoot');
  const lookupForm = document.getElementById('cvLookupForm');
  const lookupInput = document.getElementById('cvLookupInput');

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const STATUS_META = {
    ISSUED: { badgeClass: 'cv-status-issued', icon: '✅', label: 'Valid Certificate' },
    REVOKED: { badgeClass: 'cv-status-revoked', icon: '⛔', label: 'Revoked' },
    ELIGIBLE: { badgeClass: 'cv-status-not-eligible', icon: 'ℹ️', label: 'Not Yet Issued' },
    NOT_ELIGIBLE: { badgeClass: 'cv-status-not-eligible', icon: 'ℹ️', label: 'Not Yet Issued' },
  };

  const kindLabel = (programType) => (programType === 'COURSE' ? 'Digital Course' : 'In-Branch Training');

  function renderPrompt() {
    root.innerHTML = `
      <div class="cv-error">
        Enter a certificate number below to verify it.
      </div>
    `;
  }

  function renderLoading() {
    root.innerHTML = '<div class="cv-loading">Looking up certificate…</div>';
  }

  function renderError(message) {
    root.innerHTML = `
      <div class="cv-card">
        <p class="cv-icon">❌</p>
        <span class="cv-status-badge cv-status-revoked">Not Found</span>
        <div class="cv-error" style="padding-top:0;">
          ${esc(message || "We couldn't find a certificate matching that number. Double-check it and try again.")}
        </div>
      </div>
    `;
  }

  function renderResult(cert) {
    const meta = STATUS_META[cert.status] || STATUS_META.NOT_ELIGIBLE;

    root.innerHTML = `
      <div class="cv-card">
        <p class="cv-icon">${meta.icon}</p>
        <span class="cv-status-badge ${meta.badgeClass}">${esc(meta.label)}</span>
        <div class="cv-rows">
          <div class="cv-row">
            <span class="cv-row-label">Certificate Number</span>
            <span class="cv-row-value cv-cert-number">${esc(cert.certificateNumber)}</span>
          </div>
          <div class="cv-row">
            <span class="cv-row-label">Issued To</span>
            <span class="cv-row-value">${esc(cert.holderName || '-')}</span>
          </div>
          <div class="cv-row">
            <span class="cv-row-label">Programme</span>
            <span class="cv-row-value">${esc(cert.programName || '-')}</span>
          </div>
          <div class="cv-row">
            <span class="cv-row-label">Type</span>
            <span class="cv-row-value">${esc(kindLabel(cert.programType))}</span>
          </div>
          <div class="cv-row">
            <span class="cv-row-label">Completion Date</span>
            <span class="cv-row-value">${esc(fmtDate(cert.completionDate))}</span>
          </div>
        </div>
        ${cert.status === 'ISSUED' ? `
        <div style="margin-top:20px;">
          <a class="btn-trn btn-trn-primary" style="display:inline-block;padding:10px 22px;border-radius:10px;background:#1a1a1a;color:#fff;text-decoration:none;font-weight:600;font-size:14px;" href="${downloadUrl(cert.certificateNumber)}" target="_blank" rel="noopener">Download PDF</a>
        </div>` : ''}
      </div>
    `;
  }

  function downloadUrl(certificateNumber) {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES}/${encodeURIComponent(certificateNumber)}/download`;
  }

  async function verify(code) {
    if (!code) { renderPrompt(); return; }
    renderLoading();
    try {
      const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES}/${encodeURIComponent(code)}/verify`, { method: 'GET' });
      const data = (res && res.data) ? res.data : res;
      if (!data || !data.certificateNumber) { renderError(); return; }
      renderResult(data);
    } catch (err) {
      renderError(err && err.message ? err.message : null);
    }
  }

  function updateUrl(code) {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('code', code);
    else url.searchParams.delete('code');
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  if (lookupForm && lookupInput) {
    lookupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = lookupInput.value.trim();
      if (!code) return;
      updateUrl(code);
      verify(code);
    });
  }

  const initialCode = new URLSearchParams(window.location.search).get('code');
  if (initialCode && lookupInput) lookupInput.value = initialCode;
  verify(initialCode);
});
