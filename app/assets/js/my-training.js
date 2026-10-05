/**
 * My Training -- the learner's in-branch training registrations.
 * Counterpart to My Courses (digital courses). Data: GET /academy/registrations,
 * which returns each registration with its stage, cohort, branch, schedule,
 * attendance and module progress already summarised.
 *
 * Payment, identity verification and the full registration panel live on
 * training.html -- cards link there with ?registration=<id>, which opens that
 * registration's panel, so those flows exist in exactly one place.
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof APIHelper !== 'undefined' && !APIHelper.isAuthenticated()) return; // app-auth.js is redirecting to log in
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg, type = 'success') => { if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type); };
  const errMsg = (err, fallback) => (err && err.message) ? err.message : fallback;

  const STAGE_LABELS = {
    PENDING_PAYMENT: 'Awaiting Payment',
    WAITLISTED: 'Waitlisted',
    UPCOMING: 'Upcoming',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CLOSED: 'Closed',
  };

  // Cohort dates are timestamps -> show in Lagos time. Session dates are
  // calendar dates stored at UTC midnight -> format in UTC so they never shift a day.
  const fmtDate = (v, tz = 'Africa/Lagos') => v
    ? new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz })
    : '-';
  const fmtTime = (v) => v
    ? new Date(v).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })
    : '';
  const money = (v) => '₦' + Number(v || 0).toLocaleString('en-NG');

  let rows = [];
  let activeBucket = 'ALL';
  let certsByCohortId = {}; // cohortId -> ISSUED certificate

  const regLink = (r) => `../training.html?registration=${encodeURIComponent(r.id)}`;

  function nextSessionText(r) {
    const s = r.schedule && r.schedule.nextSession;
    if (!s) return null;
    const time = s.startTime ? ` · ${fmtTime(s.startTime)}${s.endTime ? '–' + fmtTime(s.endTime) : ''}` : '';
    return fmtDate(s.date, 'UTC') + time;
  }

  function renderCard(r) {
    const stage = r.stage;
    const confirmed = r.status === 'CONFIRMED';
    const idVerified = r.identityStatus === 'VERIFIED';
    const cert = certsByCohortId[r.cohort.id];
    const next = (stage === 'UPCOMING' || stage === 'IN_PROGRESS') ? nextSessionText(r) : null;
    const showProgress = stage === 'IN_PROGRESS' || stage === 'COMPLETED';
    const modulesPct = r.modules && r.modules.total ? Math.round((r.modules.passed / r.modules.total) * 100) : 0;

    const facts = [
      ['Branch', r.cohort.branch ? r.cohort.branch.name : '-'],
      ['Cohort', r.cohort.name],
      ['Dates', `${fmtDate(r.cohort.startDate)} – ${fmtDate(r.cohort.endDate)}`],
      next ? ['Next session', next] : null,
      r.cohort.trainerName ? ['Trainer', r.cohort.trainerName] : null,
    ].filter(Boolean);

    let notes = '';
    if (stage === 'PENDING_PAYMENT') {
      notes = `<div class="trn-card-note">Payment not confirmed${r.order ? ` · ${money(r.order.amount)}` : ''}${r.expiresAt ? ` · seat held until ${fmtDate(r.expiresAt)}` : ''}</div>`;
    } else if (stage === 'WAITLISTED') {
      notes = `<div class="crs-card-meta"><span>You're on the waitlist: we'll email you if a seat opens up.</span></div>`;
    } else if (confirmed && !idVerified && stage !== 'CLOSED') {
      notes = `<div class="trn-card-note">Identity verification needed${r.identityStatus === 'FAILED' ? ': last attempt failed' : ''}</div>`;
    }

    let progress = '';
    if (showProgress) {
      const rate = r.attendance.ratePercent;
      const held = r.schedule.sessionsHeld;
      progress = `
        ${r.modules.total ? `<div class="crs-progress-mini" title="Modules passed"><div class="crs-progress-mini-fill" style="width:${modulesPct}%;"></div></div>` : ''}
        <div class="crs-card-meta">
          ${r.modules.total ? `<span>${r.modules.passed} of ${r.modules.total} modules passed</span>` : ''}
          ${rate != null ? `<span>Attendance ${rate}% (${r.attendance.present + r.attendance.late} of ${held} sessions)</span>` : ''}
        </div>`;
    }

    const certHtml = cert
      ? `<div class="crs-cert-badge">🎓 Certificate earned: ${esc(cert.certificateNumber)}</div>`
      : (stage === 'COMPLETED' && r.training.certificationEnabled ? '<div class="crs-card-meta"><span>Certificate will appear here once issued.</span></div>' : '');

    const actions = [];
    if (stage === 'PENDING_PAYMENT') {
      actions.push(`<a class="btn-crs btn-crs-primary" href="${regLink(r)}">Complete Payment</a>`);
    } else if (stage === 'CLOSED') {
      actions.push(`<a class="btn-crs btn-crs-outline" href="../training.html">Browse Training</a>`);
    } else if (stage === 'WAITLISTED') {
      actions.push(`<a class="btn-crs btn-crs-outline" href="${regLink(r)}">View Registration</a>`);
    } else {
      if (confirmed && !idVerified) actions.push(`<a class="btn-crs btn-crs-primary" href="${regLink(r)}">Verify Identity</a>`);
      if (cert) actions.push(`<a class="btn-crs btn-crs-primary" href="${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES}/${encodeURIComponent(cert.certificateNumber)}/download" target="_blank" rel="noopener">Download Certificate</a>`);
      actions.push(`<a class="btn-crs btn-crs-outline" href="id-card.html?registrationId=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">ID Card</a>`);
      if (idVerified && !cert) actions.push(`<a class="btn-crs btn-crs-outline" href="${regLink(r)}">View Details</a>`);
    }

    return `
      <div class="crs-card" data-href="${stage === 'CLOSED' ? '' : regLink(r)}">
        ${r.training.coverImageUrl ? `<img class="trn-card-cover" src="${esc(r.training.coverImageUrl)}" alt="" loading="lazy" />` : ''}
        <div class="crs-card-top">
          <div class="crs-card-name">${esc(r.training.name)}</div>
          <span class="crs-pill crs-pill-${stage}">${STAGE_LABELS[stage] || esc(stage)}</span>
        </div>
        <div class="trn-card-code">${esc(r.registrationCode)}${r.training.category ? ` · ${esc(r.training.category)}` : ''}</div>
        <dl class="trn-card-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${notes}
        ${progress}
        ${certHtml}
        <div class="trn-card-actions">${actions.join('')}</div>
      </div>`;
  }

  function renderGrid() {
    const grid = document.getElementById('myTrainingGrid');
    const filtered = activeBucket === 'ALL' ? rows : rows.filter(r => r.stage === activeBucket);
    if (!filtered.length) {
      grid.innerHTML = rows.length
        ? '<div class="empty-state">Nothing in this tab.</div>'
        : '<div class="empty-state">You haven\'t registered for any in-branch training yet. <a href="../training.html">Browse In-Branch Training →</a></div>';
      return;
    }
    grid.innerHTML = filtered.map(renderCard).join('');
    grid.querySelectorAll('.crs-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // buttons/links handle themselves
        if (card.dataset.href) window.location.href = card.dataset.href;
      });
    });
  }

  async function load() {
    const grid = document.getElementById('myTrainingGrid');
    try {
      rows = await AcademyTrainingAPI.listMyRegistrations();
      renderGrid();
    } catch (err) {
      grid.innerHTML = '<div class="empty-state">Could not load your training.</div>';
      toast(errMsg(err, 'Could not load your training.'), 'error');
      return;
    }
    if (rows.some(r => r.status === 'CONFIRMED' && r.training.certificationEnabled)) {
      try {
        const certs = await AcademyTrainingAPI.listMyCertificates();
        certsByCohortId = {};
        (certs || []).forEach(c => {
          if (c.programType === 'TRAINING' && c.status === 'ISSUED') certsByCohortId[c.programId] = c;
        });
        renderGrid();
      } catch (_) { /* no badge/download button -- the rest of the page still works */ }
    }
  }

  document.getElementById('tabBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.crs-tab');
    if (!btn) return;
    activeBucket = btn.dataset.bucket;
    document.querySelectorAll('.crs-tab').forEach(t => t.classList.toggle('is-active', t === btn));
    renderGrid();
  });

  load();
});
