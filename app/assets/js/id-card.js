/**
 * Hairlux Academy - Trainee ID Card
 * app/id-card.html?registrationId=<id>
 * Auth-guarded (app-auth.js). Renders a printable digital ID card for a
 * CONFIRMED In-Branch Training registration, using the same
 * AcademyTrainingAPI.getRegistration() call the training status panel uses
 * (now includes cohort.branch.name and applicant details server-side).
 */

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('idcRoot');
  const printBtn = document.getElementById('idcPrintBtn');

  const escSafe = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  function renderLoading() {
    root.innerHTML = '<div class="idc-loading">Loading your ID card…</div>';
    if (printBtn) printBtn.style.display = 'none';
  }

  function renderError(message) {
    root.innerHTML = `<div class="idc-error">${escSafe(message)}</div>`;
    if (printBtn) printBtn.style.display = 'none';
  }

  function renderNotReady(status) {
    const label = (status || '').replace(/_/g, ' ').toLowerCase();
    root.innerHTML = `
      <div class="idc-error">
        Your ID card will be available once your registration is confirmed.
        ${status ? `Current status: <strong>${escSafe(label)}</strong>.` : ''}
      </div>
    `;
    if (printBtn) printBtn.style.display = 'none';
  }

  function renderCard(reg) {
    const applicant = reg.applicant || {};
    const cohort = reg.cohort || {};
    const training = cohort.training || {};
    const branch = cohort.branch || {};

    const firstName = (applicant.firstName || '').trim();
    const lastName = (applicant.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || applicant.email || 'Trainee';
    const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() || (applicant.email || '?')[0].toUpperCase();

    root.innerHTML = `
      <div class="idc-card">
        <div class="idc-card-head">
          <div class="idc-card-brand">Hairlux Academy<small>In-Branch Training</small></div>
          <span class="idc-status-badge">Confirmed</span>
        </div>
        <div class="idc-card-body">
          <div class="idc-avatar">${escSafe(initials)}</div>
          <div class="idc-details">
            <p class="idc-name">${escSafe(fullName)}</p>
            <p class="idc-code">${escSafe(reg.registrationCode || '—')}</p>
            <div class="idc-rows">
              <div class="idc-row">
                <span class="idc-row-label">Training</span>
                <span class="idc-row-value">${escSafe(training.name || '—')}</span>
              </div>
              <div class="idc-row">
                <span class="idc-row-label">Cohort</span>
                <span class="idc-row-value">${escSafe(cohort.name || '—')}</span>
              </div>
              <div class="idc-row">
                <span class="idc-row-label">Branch</span>
                <span class="idc-row-value">${escSafe(branch.name || '—')}</span>
              </div>
              <div class="idc-row">
                <span class="idc-row-label">Cohort Dates</span>
                <span class="idc-row-value">${escSafe(fmtDate(cohort.startDate))} &rarr; ${escSafe(fmtDate(cohort.endDate))}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="idc-card-foot">Issued by Hairlux Academy &middot; hairlux.com.ng</div>
      </div>
    `;
    if (printBtn) printBtn.style.display = '';
  }

  const registrationId = new URLSearchParams(window.location.search).get('registrationId');
  if (!registrationId) {
    renderError('No registration specified.');
    return;
  }

  renderLoading();
  try {
    const reg = await AcademyTrainingAPI.getRegistration(registrationId);
    if (!reg || !reg.id) { renderError('Registration not found.'); return; }
    if (reg.status !== 'CONFIRMED') { renderNotReady(reg.status); return; }
    renderCard(reg);
  } catch (err) {
    renderError((err && err.message) ? err.message : 'Could not load your ID card.');
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }
});
