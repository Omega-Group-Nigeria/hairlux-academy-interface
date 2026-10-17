// training.html is public: guests browse and check registration status.
window.HAIRLUX_PUBLIC_PAGE = true;

    document.addEventListener('DOMContentLoaded', async () => {
      // Public page: guests can browse programmes/cohorts and use "Check
      // Registration Status". Only the signed-in parts (pending registration,
      // payment verify, my registrations/certificates) are skipped for guests;
      // account-only actions send them to log in at that moment.
      const isLoggedIn = () => typeof APIHelper !== 'undefined' && APIHelper.isAuthenticated();
      const goToLogin = (returnTo) => {
        window.location.href = `log-in.html?returnTo=${encodeURIComponent(returnTo || ('training.html' + window.location.search))}`;
      };

      // Descriptions are rich text now -- cards show a short plain-text preview.
      const textPreview = (html, max = 160) => {
        const d = document.createElement('div');
        d.innerHTML = html == null ? '' : String(html);
        const t = (d.textContent || '').replace(/\s+/g, ' ').trim();
        return (t.length > max ? t.slice(0, max).trimEnd() + '\u2026' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      };
      // ── Helpers ──────────────────────────────────────────────────
      const fmtNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      /** "Mon, Wed, Fri, 9:00am to 3:00pm" from the cohort's own schedule (served ready-made by the API). */
      const cohortSchedule = (c) => {
        const s = c.schedule || {};
        return [s.daysLabel, s.hoursLabel].filter(Boolean).join(', ');
      };
      /** Price now, with the normal price struck through while a promotion runs. */
      const priceHtml = (t) => (t && t.promo && t.regularPrice > t.price)
        ? `${fmtNaira(t.price)}<s>${fmtNaira(t.regularPrice)}</s>`
        : fmtNaira(t ? t.price : 0);
      const fmtDate  = (iso) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
      };
      const toast = (msg, type = 'success') => {
        // A 401 means the session ended mid-page and APIHelper is already
        // redirecting to log in -- don't flash an error on the way out.
        if (typeof APIHelper !== 'undefined' && APIHelper.redirectingToLogin) return;
        if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type);
      };
      const errMsg = (err, fallback) => (err && err.message) ? err.message : fallback;
      const STATE_KEY = 'hairlux_academy_training_pending';

      const saveState = (payload) => {
        try { window.sessionStorage.setItem(STATE_KEY, JSON.stringify(payload)); } catch (_) { /* ignore */ }
      };
      const readState = () => {
        try {
          const raw = window.sessionStorage.getItem(STATE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') return null;
          if (parsed.createdAt && (Date.now() - Number(parsed.createdAt)) > (6 * 60 * 60 * 1000)) {
            clearState();
            return null;
          }
          return parsed;
        } catch (_) { return null; }
      };
      const clearState = () => {
        try { window.sessionStorage.removeItem(STATE_KEY); } catch (_) { /* ignore */ }
      };
      const cleanCallbackQuery = () => {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };

      let trainingsCache = [];
      let cohortsCache = [];
      let selectedTrainingId = null;
      let selectedCohort = null;
      let appliedDiscount = null; // { code, discountAmount, finalAmount }
      let cachedCertificate = null; // this cohort's own ISSUED AcademyCertificate, once found
      let cachedCertificateCohortId = null; // which cohortId cachedCertificate was resolved for

      // ── Trainings ────────────────────────────────────────────────
      function filteredTrainings() {
        const searchInput = document.getElementById('trainingSearch');
        const keyword = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
        if (!keyword) return trainingsCache;
        return trainingsCache.filter(t => {
          const haystack = [t.name, t.description, t.category].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(keyword);
        });
      }

      function renderTrainingsGrid() {
        const grid = document.getElementById('trainingsGrid');
        const list = filteredTrainings();
        // Take the dates panel out before the grid is rebuilt; it goes back under
        // the open programme's card at the end (or stays hidden if a search hides it).
        parkCohortsPanel();
        cohortsPanel.style.display = 'none';
        if (!trainingsCache.length) {
          grid.innerHTML = '<div class="empty-state">No programmes are published yet: check back soon.</div>';
          return;
        }
        if (!list.length) {
          grid.innerHTML = '<div class="empty-state">No programmes match that search.</div>';
          return;
        }
        grid.innerHTML = list.map(t => {
          const moduleCount = Array.isArray(t.curriculumModules) ? t.curriculumModules.length : 0;
          const chips = [];
          if (t.durationLabel) chips.push(esc(t.durationLabel));
          if (t.kitOption === 'INCLUDED') chips.push('Starter kit included');
          else if (t.kitOption === 'OPTIONAL') chips.push('Starter kit available');
          const open = t.id === selectedTrainingId;
          return `
            <div class="trn-card${open ? ' is-active' : ''}" data-id="${t.id}" role="button" tabindex="0" aria-controls="cohortsPanel" aria-expanded="${open ? 'true' : 'false'}">
              ${t.coverImageUrl ? `<img src="${t.coverImageUrl}" alt="" class="trn-card-image" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:10px;">` : ''}
              <div class="trn-card-top">
                <div class="trn-card-name">${t.name}</div>
                ${t.category ? `<span class="trn-card-category">${t.category}</span>` : ''}
              </div>
              ${t.promo ? `<div><span class="trn-card-promo">Promo${t.promo.endsAt ? ` until ${fmtDate(t.promo.endsAt)}` : ''}</span></div>` : ''}
              <div class="trn-card-desc">${textPreview(t.description) || 'No description provided yet.'}</div>
              ${chips.length ? `<div class="trn-card-chips">${chips.map(c => `<span>${c}</span>`).join('')}</div>` : ''}
              ${moduleCount ? `<div class="trn-card-modules">${moduleCount} curriculum module${moduleCount === 1 ? '' : 's'}</div>` : ''}
              <div class="trn-card-bottom">
                <div class="trn-card-price">${priceHtml(t)}</div>
                ${t.certificationEnabled ? '<div class="trn-card-cert">\u{1F393} Certificate included</div>' : ''}
              </div>
              <div class="trn-card-toggle"><span>${open ? 'Hide class dates' : 'View class dates'}</span>${CHEVRON}</div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.trn-card').forEach(card => {
          card.addEventListener('click', () => toggleTraining(card.dataset.id));
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTraining(card.dataset.id); }
          });
        });

        // Keep the open programme's dates under its card (hidden while a search hides the card).
        if (selectedTrainingId) cohortsPanel.style.display = placeCohortsPanel() ? '' : 'none';
      }

      // ── Class dates open under the clicked programme ────────────
      // The dates panel is moved into the grid as a full-width row right after
      // the row holding the clicked card (directly under the card on phones),
      // so it opens like a dropdown instead of at the bottom of the page.
      const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      const cohortsPanel = document.getElementById('cohortsPanel');
      const cohortsPanelHome = cohortsPanel.parentNode;
      const cohortsPanelNext = cohortsPanel.nextSibling;

      function parkCohortsPanel() {
        if (cohortsPanel.parentNode !== cohortsPanelHome) cohortsPanelHome.insertBefore(cohortsPanel, cohortsPanelNext);
      }

      /** Puts the panel under the selected card's row. False when the card is not on screen. */
      function placeCohortsPanel() {
        const grid = document.getElementById('trainingsGrid');
        const cards = Array.from(grid.querySelectorAll('.trn-card'));
        const index = cards.findIndex(c => c.dataset.id === selectedTrainingId);
        if (index === -1) { parkCohortsPanel(); return false; }
        const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
        const rowEnd = Math.min(Math.floor(index / cols) * cols + cols - 1, cards.length - 1);
        cards[rowEnd].after(cohortsPanel);
        // Point the panel's arrow at the clicked card.
        const gridBox = grid.getBoundingClientRect();
        const cardBox = cards[index].getBoundingClientRect();
        cohortsPanel.style.setProperty('--trn-caret-left', `${Math.round(cardBox.left - gridBox.left + cardBox.width / 2)}px`);
        return true;
      }

      function syncCardStates() {
        document.querySelectorAll('.trn-card').forEach(c => {
          const open = c.dataset.id === selectedTrainingId;
          c.classList.toggle('is-active', open);
          c.setAttribute('aria-expanded', open ? 'true' : 'false');
          const label = c.querySelector('.trn-card-toggle span');
          if (label) label.textContent = open ? 'Hide class dates' : 'View class dates';
        });
      }

      function closeCohortsPanel() {
        selectedTrainingId = null;
        cohortsPanel.style.display = 'none';
        parkCohortsPanel();
        syncCardStates();
      }

      /** Clicking the open programme again closes its dates. */
      function toggleTraining(trainingId) {
        if (trainingId === selectedTrainingId && cohortsPanel.style.display !== 'none') closeCohortsPanel();
        else selectTraining(trainingId);
      }

      document.getElementById('cohortsClose').addEventListener('click', closeCohortsPanel);

      let panelResizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(panelResizeTimer);
        panelResizeTimer = setTimeout(() => {
          if (selectedTrainingId && cohortsPanel.style.display !== 'none') placeCohortsPanel();
        }, 120);
      });

      async function loadTrainings() {
        const grid = document.getElementById('trainingsGrid');
        try {
          trainingsCache = await AcademyTrainingAPI.getTrainings();
          renderTrainingsGrid();
        } catch (err) {
          grid.innerHTML = '<div class="empty-state">Could not load programmes.</div>';
          toast(errMsg(err, 'Could not load programmes.'), 'error');
        }
      }

      // ── Cohorts for a selected training ─────────────────────────
      async function selectTraining(trainingId) {
        selectedTrainingId = trainingId;
        syncCardStates();

        const training = trainingsCache.find(t => t.id === trainingId);
        const panel = document.getElementById('cohortsPanel');
        const list = document.getElementById('cohortsList');
        const title = document.getElementById('cohortsTitle');
        const branchFilter = document.getElementById('branchFilter');

        title.textContent = training ? `Class dates: ${training.name}` : 'Class dates';
        renderTrainingDetails(training);
        branchFilter.value = '';
        list.innerHTML = '<div class="empty-state">Loading class dates…</div>';
        placeCohortsPanel();
        panel.style.display = '';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        try {
          cohortsCache = await AcademyTrainingAPI.getCohorts(trainingId);

          const branches = Array.from(new Set(cohortsCache.map(c => (c.branch && c.branch.name) || '').filter(Boolean)));
          branchFilter.innerHTML = '<option value="">All branches</option>' +
            branches.map(b => `<option value="${b}">${b}</option>`).join('');

          renderCohorts('');
        } catch (err) {
          list.innerHTML = '<div class="empty-state">Could not load class dates for this programme.</div>';
        }
      }

      /** Benefits, starter kit and curriculum (grouped by week or day when the training is set up that way). */
      function renderTrainingDetails(t) {
        const box = document.getElementById('trainingDetails');
        if (!box) return;
        if (!t) { box.style.display = 'none'; box.innerHTML = ''; return; }
        let html = '';
        if (Array.isArray(t.benefits) && t.benefits.length) {
          html += `<h4>What is included</h4><ul class="trn-benefits">${t.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
        }
        if (t.kitOption && t.kitOption !== 'NOT_AVAILABLE') {
          html += `<div class="trn-kit"><strong>${t.kitOption === 'INCLUDED' ? 'Starter kit (included)' : 'Starter kit (optional, not in the fee)'}:</strong> ${esc(t.kitDescription || '')}</div>`;
        }
        const mods = (t.curriculumModules || []).slice().sort((a, b) => a.order - b.order);
        if (mods.length) {
          const word = t.curriculumLayout === 'WEEKS' ? 'Week' : t.curriculumLayout === 'DAYS' ? 'Day' : '';
          let body;
          if (word) {
            const groups = [];
            const byKey = {};
            mods.forEach(m => {
              const k = m.period ? String(m.period) : 'other';
              if (!byKey[k]) { byKey[k] = { period: m.period, items: [] }; groups.push(byKey[k]); }
              byKey[k].items.push(m);
            });
            groups.sort((a, b) => (a.period || 9999) - (b.period || 9999));
            body = groups.map(g => `<div class="trn-week"><strong>${g.period ? `${word} ${g.period}` : 'Also covered'}</strong><ol>${g.items.map(m => `<li>${esc(m.name)}</li>`).join('')}</ol></div>`).join('');
          } else {
            body = `<ol>${mods.map(m => `<li>${esc(m.name)}</li>`).join('')}</ol>`;
          }
          html += `<details><summary>Curriculum (${mods.length} module${mods.length === 1 ? '' : 's'}${t.durationLabel ? `, ${esc(t.durationLabel)}` : ''})</summary>${body}</details>`;
        }
        box.innerHTML = html;
        box.style.display = html ? '' : 'none';
      }

      function renderCohorts(branchName) {
        const list = document.getElementById('cohortsList');
        const filtered = branchName
          ? cohortsCache.filter(c => (c.branch && c.branch.name) === branchName)
          : cohortsCache;

        if (!filtered.length) {
          // Same wording as the enrolment page: past classes and closed registration windows are not listed.
          list.innerHTML = branchName && cohortsCache.length
            ? '<div class="empty-state">No class dates at this branch right now.</div>'
            : '<div class="empty-state">New dates coming soon. Check back shortly or contact Hairlux Academy.</div>';
          return;
        }

        list.innerHTML = filtered.map(c => {
          const isFull = c.status === 'FULL';
          const actionLabel = isFull ? 'Join Waitlist' : 'Register';
          const actionable = c.status === 'OPEN' || c.status === 'FULL';
          return `
            <div class="trn-cohort-row" data-id="${c.id}">
              <div class="trn-cohort-info">
                <div class="trn-cohort-name">${c.name}</div>
                <div class="trn-cohort-meta">${(c.branch && c.branch.name) || 'Branch TBC'} · ${fmtDate(c.startDate)} – ${fmtDate(c.endDate)} · up to ${c.capacityMax} seats</div>
                ${cohortSchedule(c) || c.instructor || c.accommodation ? `<div class="trn-cohort-meta">${[
                  cohortSchedule(c) ? esc(cohortSchedule(c)) : '',
                  c.instructor ? `Instructor: ${esc(c.instructor)}` : '',
                  c.accommodation ? (c.accommodation.available
                    ? `Accommodation ${c.accommodation.free ? 'included' : fmtNaira(c.accommodation.fee)} (${c.accommodation.bedsLeft} ${c.accommodation.bedsLeft === 1 ? 'bed' : 'beds'} left)`
                    : 'Accommodation fully booked') : '',
                ].filter(Boolean).join(' · ')}</div>` : ''}
              </div>
              <div class="trn-cohort-actions">
                <span class="trn-pill trn-pill-${c.status}">${c.status}</span>
                ${actionable
                  ? `<button class="btn-trn ${isFull ? 'btn-trn-secondary' : 'btn-trn-primary'}" data-cohort-id="${c.id}">${actionLabel}</button>`
                  : ''}
              </div>
            </div>`;
        }).join('');

        list.querySelectorAll('button[data-cohort-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const cohort = filtered.find(c => c.id === btn.dataset.cohortId);
            if (cohort) openRegisterModal(cohort);
          });
        });
      }

      document.getElementById('branchFilter').addEventListener('change', (e) => renderCohorts(e.target.value));

      // ── Register modal ──────────────────────────────────────────
      const registerOverlay  = document.getElementById('registerOverlay');
      const registerForm     = document.getElementById('registerForm');
      const registerSummary  = document.getElementById('registerSummary');
      const discountCodeEl   = document.getElementById('discountCode');
      const discountHint     = document.getElementById('discountHint');
      const discountError    = document.getElementById('discountError');
      const registerSubmit   = document.getElementById('registerSubmit');

      function openRegisterModal(cohort) {
        if (!isLoggedIn()) {
          goToLogin(`training.html?training=${encodeURIComponent(selectedTrainingId || '')}&cohort=${encodeURIComponent(cohort.id)}`);
          return;
        }
        selectedCohort = cohort;
        appliedDiscount = null;
        currentQuote = null;
        registerForm.reset();
        document.getElementById('paymentPlanGroup').style.display = 'none';
        discountHint.textContent = '';
        discountError.classList.remove('is-visible');

        const training = cohort.training || trainingsCache.find(t => t.id === selectedTrainingId) || {};
        registerSummary.innerHTML = `
          <div><strong>${training.name || 'Training'}</strong></div>
          <div style="margin:4px 0;">${cohort.name} · ${(cohort.branch && cohort.branch.name) || ''}</div>
          <div style="margin:4px 0;">${fmtDate(cohort.startDate)} – ${fmtDate(cohort.endDate)}</div>
          ${cohortSchedule(cohort) ? `<div style="margin:4px 0;">${esc(cohortSchedule(cohort))}</div>` : ''}
          <div class="trn-summary-price" id="registerPrice"></div>
          <div class="form-hint" id="registerPriceBreakdown"></div>
          ${cohort.status === 'FULL' ? '<div class="form-hint" style="margin-top:8px;">This cohort is full: registering will add you to the waitlist instead.</div>' : ''}
        `;

        // Accommodation: a separate charge (not discounted), only while beds are left and the class has seats.
        const acc = cohort.accommodation;
        const accGroup = document.getElementById('accommodationGroup');
        const accBox = document.getElementById('withAccommodation');
        accBox.checked = false;
        accGroup.style.display = acc && cohort.status !== 'FULL' ? '' : 'none';
        if (acc) {
          accBox.disabled = !acc.available;
          document.getElementById('accommodationLabel').textContent = acc.available
            ? `Book a bed in the class accommodation: ${acc.free ? 'included' : fmtNaira(acc.fee)}`
            : 'Accommodation is fully booked for this class';
          document.getElementById('accommodationHint').textContent = acc.available
            ? `${acc.bedsLeft} ${acc.bedsLeft === 1 ? 'bed' : 'beds'} left.${acc.note ? ' ' + acc.note.replace(/[.!]?\s*$/, '.') : ''}${acc.free ? '' : ' Paid with your training fee, shown separately.'}`
            : '';
        }
        updateRegisterPrice();

        document.getElementById('registerTitle').textContent = cohort.status === 'FULL' ? 'Join Waitlist' : 'Register';
        registerSubmit.textContent = cohort.status === 'FULL' ? 'Join Waitlist' : 'Confirm Registration';
        registerOverlay.classList.add('open');
      }
      function closeRegisterModal() { registerOverlay.classList.remove('open'); }

      /** Training fee (after any discount) plus accommodation when chosen. */
      function updateRegisterPrice() {
        if (!selectedCohort) return;
        const training = selectedCohort.training || trainingsCache.find(t => t.id === selectedTrainingId) || {};
        const trainingFee = appliedDiscount ? Number(appliedDiscount.finalAmount) : Number(training.price || 0);
        const acc = selectedCohort.accommodation;
        const withAcc = !!(acc && acc.available && document.getElementById('withAccommodation').checked);
        const accFee = withAcc ? Number(acc.fee || 0) : 0;
        const priceEl = document.getElementById('registerPrice');
        if (priceEl) priceEl.innerHTML = (training.promo && !appliedDiscount && !withAcc) ? priceHtml(training) : fmtNaira(trainingFee + accFee);
        const parts = [];
        if (training.promo) parts.push(`Promo price ${fmtNaira(training.price)} (normally ${fmtNaira(training.regularPrice)})`);
        if (withAcc) parts.push(`Training ${fmtNaira(trainingFee)} + accommodation ${accFee > 0 ? fmtNaira(accFee) : 'included'}`);
        const breakdown = document.getElementById('registerPriceBreakdown');
        if (breakdown) breakdown.textContent = parts.join(' · ');
        refreshPaymentPlan(withAcc);
      }
      document.getElementById('withAccommodation').addEventListener('change', updateRegisterPrice);

      // ── Part payment: deposit now to secure the seat, balance before the class ──
      let currentQuote = null;
      let quoteSeq = 0;
      const planGroup = document.getElementById('paymentPlanGroup');

      function selectedPlan() {
        const checked = document.querySelector('input[name="paymentPlan"]:checked');
        return checked && checked.value === 'DEPOSIT' && currentQuote && currentQuote.depositAllowed ? 'DEPOSIT' : 'FULL';
      }

      function updateSubmitLabel() {
        if (!selectedCohort || selectedCohort.status === 'FULL') return;
        registerSubmit.textContent = selectedPlan() === 'DEPOSIT'
          ? `Pay Deposit ${fmtNaira(currentQuote.payNowWithDeposit)}`
          : 'Confirm Registration';
      }

      /** Asks the server what a deposit would be for this class, after any discount and with accommodation. */
      async function refreshPaymentPlan(withAcc) {
        const seq = ++quoteSeq;
        if (!selectedCohort || selectedCohort.status === 'FULL') {
          currentQuote = null; planGroup.style.display = 'none'; return;
        }
        try {
          const quote = await AcademyTrainingAPI.getRegistrationQuote(selectedCohort.id, appliedDiscount ? appliedDiscount.code : undefined, withAcc);
          if (seq !== quoteSeq) return; // a newer change is on its way
          currentQuote = quote;
        } catch (_) {
          if (seq !== quoteSeq) return;
          currentQuote = null; // no quote: pay in full only
        }
        if (!currentQuote || !currentQuote.depositAllowed) {
          planGroup.style.display = 'none';
          document.querySelector('input[name="paymentPlan"][value="FULL"]').checked = true;
          updateSubmitLabel();
          return;
        }
        document.getElementById('planFullAmount').textContent = `${fmtNaira(currentQuote.payInFull)} today`;
        document.getElementById('planDepositAmount').textContent =
          `${fmtNaira(currentQuote.payNowWithDeposit)} today, then ${fmtNaira(currentQuote.balanceDue)} by ${fmtDate(currentQuote.balanceDueAt)}`;
        document.getElementById('paymentPlanHint').textContent = currentQuote.accommodationFee > 0
          ? 'Accommodation is paid in full today with either option. You can pay the balance online or at the branch.'
          : 'You can pay the balance online or at the branch. You will get reminders before it is due.';
        planGroup.style.display = '';
        updateSubmitLabel();
      }
      document.querySelectorAll('input[name="paymentPlan"]').forEach((r) => r.addEventListener('change', updateSubmitLabel));

      document.getElementById('registerClose').addEventListener('click', closeRegisterModal);
      document.getElementById('registerCancel').addEventListener('click', closeRegisterModal);
      registerOverlay.addEventListener('click', (e) => { if (e.target === registerOverlay) closeRegisterModal(); });

      document.getElementById('btnApplyCode').addEventListener('click', async () => {
        discountError.classList.remove('is-visible');
        const code = discountCodeEl.value.trim();
        if (!code) { discountError.textContent = 'Enter a code first.'; discountError.classList.add('is-visible'); return; }

        const training = selectedCohort.training || trainingsCache.find(t => t.id === selectedTrainingId) || {};
        const price = Number(training.price || 0);

        try {
          const result = await AcademyTrainingAPI.validateDiscountCode(code, price);
          appliedDiscount = { code, ...result };
          discountHint.textContent = `${result.name || code}: −${fmtNaira(result.discountAmount)} off the training fee: ${fmtNaira(result.finalAmount)}`;
          updateRegisterPrice();
        } catch (err) {
          appliedDiscount = null;
          discountError.textContent = errMsg(err, 'That code is not valid.');
          discountError.classList.add('is-visible');
          updateRegisterPrice(); // back to the undiscounted price and deposit
        }
      });

      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedCohort) return;

        UIHelper.setButtonLoading(registerSubmit, true);
        try {
          const accBox = document.getElementById('withAccommodation');
          const withAccommodation = !!(selectedCohort.accommodation && selectedCohort.accommodation.available && accBox.checked);
          const result = await AcademyTrainingAPI.register(selectedCohort.id, appliedDiscount ? appliedDiscount.code : undefined, withAccommodation, selectedPlan());
          const training = selectedCohort.training || trainingsCache.find(t => t.id === selectedTrainingId) || {};

          if (result.waitlisted) {
            closeRegisterModal();
            toast('Cohort is full: you have been added to the waitlist.', 'success');
            saveState({
              registrationId: result.registration.id,
              registrationCode: result.registration.registrationCode,
              status: result.registration.status,
              trainingName: training.name,
              cohortName: selectedCohort.name,
              cohortId: selectedCohort.id,
              createdAt: Date.now()
            });
            renderRegPanelFromState();
          } else if (result.authorizationUrl) {
            saveState({
              registrationId: result.registration.id,
              registrationCode: result.registration.registrationCode,
              status: result.registration.status,
              trainingName: training.name,
              cohortName: selectedCohort.name,
              cohortId: selectedCohort.id,
              createdAt: Date.now()
            });
            toast('Redirecting to Paystack to complete payment…');
            window.location.href = result.authorizationUrl;
          } else {
            closeRegisterModal();
            toast('Registration confirmed!');
            saveState({
              registrationId: result.registration.id,
              registrationCode: result.registration.registrationCode,
              status: result.registration.status,
              trainingName: training.name,
              cohortName: selectedCohort.name,
              cohortId: selectedCohort.id,
              createdAt: Date.now()
            });
            renderRegPanelFromState();
          }
        } catch (err) {
          toast(errMsg(err, 'Could not complete registration.'), 'error');
        } finally {
          UIHelper.setButtonLoading(registerSubmit, false);
        }
      });

      // ── "Your Registration" panel ───────────────────────────────
      function renderRegPanelFromState() {
        const state = readState();
        const panel = document.getElementById('regPanel');
        if (!state) { panel.style.display = 'none'; return; }

        panel.style.display = '';
        const needsPayment = state.status === 'PENDING_PAYMENT' || state.status === 'DRAFT';
        const isConfirmed  = state.status === 'CONFIRMED';
        const isWaitlisted = state.status === 'WAITLISTED';
        const idStatus = state.identityStatus || null;

        let body = `
          <div class="trn-reg-top">
            <div>
              <div class="trn-reg-code">${state.registrationCode || '-'}</div>
              <div class="form-hint">${state.trainingName || ''} · ${state.cohortName || ''}</div>
            </div>
            <span class="trn-pill trn-pill-${state.status}">${(state.status || '').replace(/_/g, ' ')}</span>
          </div>`;

        if (isWaitlisted) {
          body += `<div class="trn-reg-line">You're on the waitlist: we'll email you if a seat opens up.</div>`;
        } else if (needsPayment) {
          body += `<div class="trn-reg-line">Payment has not been confirmed yet.</div>
            <div class="trn-reg-actions"><button class="btn-trn btn-trn-primary" id="btnVerifyPayment">I've Completed Payment: Verify</button></div>`;
        } else if (isConfirmed) {
          body += `<div class="trn-reg-line" style="color:var(--success);font-weight:600;">Registration confirmed.</div>`;
          if (Number(state.balanceDue) > 0) {
            // Paid with a deposit: the seat is secured, the balance is due before the class.
            body += `<div class="trn-reg-line">Your deposit secured your seat. Balance <strong>${fmtNaira(state.balanceDue)}</strong> is due by ${fmtDate(state.balanceDueAt)}.</div>`;
            body += `<div class="trn-reg-actions"><a class="btn-trn btn-trn-primary" href="pay-balance.html?code=${encodeURIComponent(state.registrationCode)}">Pay Balance</a></div>`;
          }
          body += `<div class="trn-reg-actions"><a class="btn-trn btn-trn-primary" href="app/id-card.html?registrationId=${encodeURIComponent(state.registrationId)}" target="_blank" rel="noopener">View My ID Card</a></div>`;
          if (state.cohortId && cachedCertificateCohortId !== state.cohortId) {
            ensureCertificateChecked(state.cohortId);
          } else if (cachedCertificate) {
            body += `<div class="trn-reg-line" style="color:var(--success);font-weight:600;">🎓 Certificate earned: ${cachedCertificate.certificateNumber}</div>`;
            body += `<div class="trn-reg-actions"><a class="btn-trn btn-trn-primary" href="${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES}/${encodeURIComponent(cachedCertificate.certificateNumber)}/download" target="_blank" rel="noopener">Download Certificate (PDF)</a></div>`;
          }
          const escA = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
          if (idStatus === 'VERIFIED') {
            body += `<div class="trn-reg-line">Identity verification: <span class="trn-pill trn-pill-VERIFIED">VERIFIED</span></div>`;
            const confirmed = [state.nameFirst, state.nameLast].filter(Boolean).join(' ');
            if (confirmed) body += `<div class="trn-reg-line">Name on your certificate &amp; ID card: <strong>${escA(confirmed)}</strong></div>`;
          } else {
            // Prefill: last attempt / registration's name, else the signed-in profile.
            const profile = (typeof APIHelper !== 'undefined' && APIHelper.getUserData && APIHelper.getUserData()) || {};
            const preFirst = state.nameFirst || profile.firstName || '';
            const preLast = state.nameLast || profile.lastName || '';
            if (idStatus === 'FAILED') {
              body += `<div class="trn-reg-line" style="color:var(--danger,#c0392b);font-weight:600;">Identity verification failed: please double-check your NIN and name, then try again.</div>`;
            }
            body += `
              <form id="identityForm" class="trn-id-form" novalidate>
                <div class="form-hint">Verify your identity with your NIN to complete registration.</div>
                <div class="form-group"><label for="idNin">NIN (11 digits)</label><input type="text" id="idNin" maxlength="11" inputmode="numeric" autocomplete="off" required /></div>
                <div class="trn-id-row">
                  <div class="form-group"><label for="idFirstName">First Name</label><input type="text" id="idFirstName" autocomplete="given-name" value="${escA(preFirst)}" required /></div>
                  <div class="form-group"><label for="idLastName">Last Name</label><input type="text" id="idLastName" autocomplete="family-name" value="${escA(preLast)}" required /></div>
                </div>
                <div class="form-hint">Prefilled from your profile: edit to match the name on your NIN if needed. The name you confirm here is used on your certificate and ID card for this training.</div>
                <div class="form-error" id="idError"></div>
                <div><button type="submit" class="btn-trn btn-trn-primary" id="idSubmit">Verify Identity</button></div>
              </form>`;
          }
        }

        body += `<div class="form-hint" style="margin-top:12px;">All your registrations are in <a href="app/my-training.html">My Training</a>. You can also use "Check Registration Status" above any time.</div>`;
        panel.innerHTML = body;

        const verifyBtn = document.getElementById('btnVerifyPayment');
        if (verifyBtn) {
          verifyBtn.addEventListener('click', async () => {
            UIHelper.setButtonLoading(verifyBtn, true);
            try {
              await AcademyTrainingAPI.verifyPayment(state.registrationId);
              await refreshRegistrationDetail(state.registrationId);
              toast('Payment verified!');
            } catch (err) {
              toast(errMsg(err, 'Payment could not be verified yet.'), 'error');
              UIHelper.setButtonLoading(verifyBtn, false);
            }
          });
        }

        const idForm = document.getElementById('identityForm');
        if (idForm) {
          idForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idError = document.getElementById('idError');
            idError.classList.remove('is-visible');
            const nin = document.getElementById('idNin').value.trim();
            if (!/^\d{11}$/.test(nin)) {
              idError.textContent = 'NIN must be exactly 11 digits.';
              idError.classList.add('is-visible');
              return;
            }
            const firstName = document.getElementById('idFirstName').value.trim();
            const lastName = document.getElementById('idLastName').value.trim();
            if (!firstName || !lastName) {
              idError.textContent = 'Enter your first and last name as they appear on your NIN.';
              idError.classList.add('is-visible');
              return;
            }
            const idSubmit = document.getElementById('idSubmit');
            UIHelper.setButtonLoading(idSubmit, true);
            try {
              const idResult = await AcademyTrainingAPI.verifyIdentity(state.registrationId, { nin, firstName, lastName });
              // Keep what they typed so a failed attempt re-renders with it.
              saveState({ ...(readState() || state), nameFirst: firstName, nameLast: lastName });
              await refreshRegistrationDetail(state.registrationId);
              if (idResult && idResult.status === 'VERIFIED') {
                toast('Identity verified!');
              } else {
                toast('Identity verification failed: please check your details and try again.', 'error');
              }
            } catch (err) {
              idError.textContent = errMsg(err, 'Could not verify identity.');
              idError.classList.add('is-visible');
              UIHelper.setButtonLoading(idSubmit, false);
            }
          });
        }
      }

      async function refreshRegistrationDetail(registrationId) {
        try {
          const reg = await AcademyTrainingAPI.getRegistration(registrationId);
          const state = readState() || {};
          saveState({
            ...state,
            registrationId: reg.id,
            registrationCode: reg.registrationCode,
            status: reg.status,
            identityStatus: reg.identityVerification ? reg.identityVerification.status : null,
            // applicant.* is the confirmed (NIN-verified) name once verified,
            // else the profile name; a just-typed failed attempt wins over the profile.
            nameFirst: (reg.applicant && reg.applicant.nameVerified) ? reg.applicant.firstName : ((state.registrationId === reg.id && state.nameFirst) || (reg.applicant && reg.applicant.firstName) || ''),
            nameLast: (reg.applicant && reg.applicant.nameVerified) ? reg.applicant.lastName : ((state.registrationId === reg.id && state.nameLast) || (reg.applicant && reg.applicant.lastName) || ''),
            trainingName: (reg.cohort && reg.cohort.training && reg.cohort.training.name) || state.trainingName,
            cohortName: (reg.cohort && reg.cohort.name) || state.cohortName,
            cohortId: (reg.cohort && reg.cohort.id) || state.cohortId,
            balanceDue: Number(reg.balanceDue) || 0,
            balanceDueAt: reg.balanceDueAt || (reg.cohort && reg.cohort.startDate) || null
          });
          renderRegPanelFromState();
        } catch (err) {
          if (err && (err.status === 401 || err.status === 404)) {
            // Session ended (APIHelper redirects to log in) or a stale
            // registration that isn't this user's -- drop it quietly.
            if (err.status === 404) { clearState(); renderRegPanelFromState(); }
            return;
          }
          toast(errMsg(err, 'Could not refresh registration status.'), 'error');
        }
      }

      async function ensureCertificateChecked(cohortId) {
        cachedCertificateCohortId = cohortId;
        try {
          const certs = await AcademyTrainingAPI.listMyCertificates();
          cachedCertificate = (certs || []).find(c => c.programType === 'TRAINING' && c.programId === cohortId && c.status === 'ISSUED') || null;
        } catch (_) {
          cachedCertificate = null;
        }
        renderRegPanelFromState();
      }

      // ── Handle return from Paystack ─────────────────────────────
      async function handlePaymentReturn() {
        const query = new URLSearchParams(window.location.search);
        const reference = query.get('trxref') || query.get('reference') || '';
        const state = readState();

        if (!reference && !state) return;
        // Back from Paystack without a session -- log in first, then return here.
        if (!isLoggedIn()) {
          if (reference) goToLogin();
          return;
        }
        if (reference) cleanCallbackQuery();
        if (!state || !state.registrationId) return;

        try {
          await AcademyTrainingAPI.verifyPayment(state.registrationId);
          toast('Payment verified: registration confirmed!');
        } catch (err) {
          toast(errMsg(err, 'Could not verify payment automatically: use "I\'ve Completed Payment" below.'), 'error');
        }
        await refreshRegistrationDetail(state.registrationId);
      }

      // ── Check Registration Status (public lookup) ───────────────
      document.getElementById('lookupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('lookupCode').value.trim();
        const email = document.getElementById('lookupEmail').value.trim();
        const resultBox = document.getElementById('lookupResult');
        const submitBtn = document.getElementById('lookupSubmit');
        if (!code || !email) return;

        UIHelper.setButtonLoading(submitBtn, true);
        try {
          const data = await AcademyTrainingAPI.lookupByCode(code, email);
          resultBox.innerHTML = `
            <div class="trn-reg-top">
              <div>
                <div class="trn-reg-code">${data.registrationCode}</div>
                <div class="form-hint">${data.trainingName} · ${data.cohortName}</div>
              </div>
              <span class="trn-pill trn-pill-${data.status}">${String(data.status || '').replace(/_/g, ' ')}</span>
            </div>
            <div class="trn-reg-line" style="margin-top:8px;">Starts ${fmtDate(data.startDate)}</div>`;
          resultBox.classList.add('is-visible');
        } catch (err) {
          resultBox.innerHTML = `<div class="trn-reg-line" style="color:var(--danger);">${errMsg(err, 'No registration found for that code and email.')}</div>`;
          resultBox.classList.add('is-visible');
        } finally {
          UIHelper.setButtonLoading(submitBtn, false);
        }
      });

      async function restoreSelectionFromQuery() {
        const query = new URLSearchParams(window.location.search);
        const trainingId = query.get('training');
        const cohortId = query.get('cohort');
        if (!trainingId) return;
        await selectTraining(trainingId);
        if (cohortId && isLoggedIn()) {
          const cohort = cohortsCache.find(c => c.id === cohortId);
          if (cohort) openRegisterModal(cohort);
        }
      }

      // ── Init ─────────────────────────────────────────────────────
      if (isLoggedIn()) {
        renderRegPanelFromState();
      } else {
        clearState(); // leftover from a previous session -- never shown to a guest
      }
      await handlePaymentReturn();

      // Deep link from My Training: training.html?registration=<id> opens that
      // registration's panel (payment check, identity verification, ID card,
      // certificate) -- the same panel a fresh registration uses.
      const linkedRegistrationId = new URLSearchParams(window.location.search).get('registration');
      if (linkedRegistrationId && !isLoggedIn()) {
        goToLogin(); // viewing a registration needs its owner's account
        return;
      }
      if (linkedRegistrationId) {
        await refreshRegistrationDetail(linkedRegistrationId);
        const regPanel = document.getElementById('regPanel');
        if (regPanel && regPanel.style.display !== 'none') regPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const trainingSearchInput = document.getElementById('trainingSearch');
      if (trainingSearchInput) trainingSearchInput.addEventListener('input', renderTrainingsGrid);

      await loadTrainings();
      await restoreSelectionFromQuery();
    });
