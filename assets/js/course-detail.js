
    document.addEventListener('DOMContentLoaded', async () => {
      const fmtNaira = (n) => n === 0 ? 'Free' : '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // Promotional or discounted price shown against the normal fee, struck
      // through (the API resolves which applies -- promotional supersedes discounted).
      const priceHtml = (p) => {
        if (!p) return 'Pricing TBC';
        if (p.originalAmount == null || p.originalAmount <= p.amount) return fmtNaira(p.amount);
        const pct = Math.round((1 - p.amount / p.originalAmount) * 100);
        return `<s class="crs-price-was">${fmtNaira(p.originalAmount)}</s> <span class="crs-price-now">${fmtNaira(p.amount)}</span>`
          + (pct > 0 ? ` <span class="crs-price-save">${p.priceType === 'PROMOTIONAL' ? 'Promo ' : ''}-${pct}%</span>` : '');
      };
      const fmtDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
      };
      const toast = (msg, type = 'success') => { if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type); };
      const errMsg = (err, fallback) => (err && err.message) ? err.message : fallback;
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      // Description/requirements/objectives/do's/don'ts are rich text from the
      // admin editor, sanitised server-side (sanitizeRichText). Older plain-text
      // values are escaped instead, keeping their line breaks.
      const richText = (s) => {
        const v = s == null ? '' : String(s);
        return /<\/?[a-z][\s\S]*>/i.test(v) ? v : esc(v).replace(/\n/g, '<br>');
      };

      const STATE_KEY = 'hairlux_academy_course_pending';
      const saveState = (payload) => { try { window.sessionStorage.setItem(STATE_KEY, JSON.stringify(payload)); } catch (_) {} };
      const readState = () => {
        try {
          const raw = window.sessionStorage.getItem(STATE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') return null;
          if (parsed.createdAt && (Date.now() - Number(parsed.createdAt)) > (6 * 60 * 60 * 1000)) { clearState(); return null; }
          return parsed;
        } catch (_) { return null; }
      };
      const clearState = () => { try { window.sessionStorage.removeItem(STATE_KEY); } catch (_) {} };
      const cleanCallbackQuery = () => {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/[?&](trxref|reference)=[^&]*/g, '').replace(/^&/, '?'));
        }
      };

      const params = new URLSearchParams(window.location.search);
      const courseId = params.get('id');
      const root = document.getElementById('courseDetailRoot');

      if (!courseId) {
        root.innerHTML = '<div class="empty-state">No course specified. <a href="courses.html">Back to Digital Courses</a></div>';
        return;
      }

      let course = null;
      let myAccessEntry = null; // { access, progress, bucket }
      let reviews = [];
      let myCertificate = null; // this course's own ISSUED AcademyCertificate, if any

      function mediaMarkup(lesson) {
        const key = lesson.contentKey || '';
        if (!key) return '<div class="empty-state">No content attached to this lesson yet.</div>';
        const isEmbed = /youtube\.com|youtu\.be|vimeo\.com/i.test(key);
        if (lesson.type === 'VIDEO') {
          if (isEmbed) return `<div class="crs-media-wrap"><iframe src="${esc(key)}" allowfullscreen></iframe></div>`;
          return `<div class="crs-media-wrap"><video controls src="${esc(key)}"></video></div>`;
        }
        if (lesson.type === 'AUDIO') return `<div class="crs-media-wrap"><audio controls src="${esc(key)}"></audio></div>`;
        if (lesson.type === 'PDF') return `<div class="crs-media-wrap"><iframe src="${esc(key)}"></iframe></div>`;
        // TEXT
        if (/^https?:\/\//i.test(key)) return `<div class="form-hint">Read: <a href="${esc(key)}" target="_blank" rel="noopener">${esc(key)}</a></div>`;
        // TEXT lesson body: rich text from the admin editor, sanitised server-side.
        // Older plain-text lessons are escaped, keeping their line breaks.
        return /<\/?[a-z][\s\S]*>/i.test(key)
          ? `<div class="crs-text-lesson crs-rich">${key}</div>`
          : `<div class="crs-text-lesson">${esc(key)}</div>`;
      }

      function renderCurriculum() {
        const owned = !!(myAccessEntry && myAccessEntry.access.status === 'ACTIVE' && (!myAccessEntry.access.expiresAt || new Date(myAccessEntry.access.expiresAt) > new Date()));
        const modules = course.modules || [];
        if (!modules.length) return '<div class="empty-state">Curriculum has not been published yet.</div>';

        return `<div class="crs-curriculum">${modules.map(m => `
          <div class="crs-module">
            <div class="crs-module-head">
              <h4>${esc(m.name)}</h4>
              <span class="crs-module-meta">${(m.lessons || []).length} lesson${(m.lessons || []).length === 1 ? '' : 's'}${m.estimatedDuration ? ` · ${m.estimatedDuration} min` : ''}</span>
            </div>
            ${(m.lessons || []).map(l => {
              const canPreview = !owned && l.previewAvailable;
              const locked = !owned && !l.previewAvailable;
              return `
                <div class="crs-lesson-row ${locked ? 'is-locked' : ''}" data-lesson-id="${l.id}" ${canPreview ? 'data-previewable="1" style="cursor:pointer;"' : ''}${owned ? ' data-owned="1" style="cursor:pointer;" title="Open lesson"' : ''}>
                  <div class="crs-lesson-left">
                    <span class="crs-lesson-icon">${locked ? '🔒' : (canPreview ? '▶' : '▶')}</span>
                    <span class="crs-lesson-name">${esc(l.title)}</span>
                    ${canPreview ? '<span class="crs-card-badge" style="margin-left:6px;">Preview</span>' : ''}
                  </div>
                  <span class="crs-lesson-duration">${l.duration ? l.duration + ' min' : ''}</span>
                </div>
                <div class="crs-lesson-preview" data-preview-for="${l.id}" style="display:none; padding:0 18px 14px;"></div>`;
            }).join('')}
          </div>`).join('')}</div>`;
      }

      // The course player lives under app/, this page at the site root.
      const playerUrl = (lessonId) => `app/course-player.html?id=${encodeURIComponent(courseId)}${lessonId ? `&lesson=${encodeURIComponent(lessonId)}` : ''}`;

      function bindPreviewToggles() {
        // Enrolled learners: a lesson row opens that lesson in the course
        // player (which loads the full, access-checked content -- the public
        // course payload only carries contentKey for preview lessons).
        document.querySelectorAll('.crs-lesson-row[data-owned="1"]').forEach(row => {
          row.addEventListener('click', () => { window.location.href = playerUrl(row.dataset.lessonId); });
        });

        document.querySelectorAll('.crs-lesson-row[data-previewable="1"]').forEach(row => {
          row.addEventListener('click', () => {
            const lessonId = row.dataset.lessonId;
            const panel = document.querySelector(`.crs-lesson-preview[data-preview-for="${lessonId}"]`);
            if (!panel) return;
            if (panel.style.display === 'none') {
              const lesson = (course.modules || []).flatMap(m => m.lessons || []).find(l => l.id === lessonId);
              panel.innerHTML = lesson ? mediaMarkup(lesson) : '';
              panel.style.display = '';
            } else {
              panel.style.display = 'none';
            }
          });
        });
      }

      function renderReviews() {
        if (!reviews.length) return '<div class="empty-state">No reviews yet.</div>';
        return `<div class="crs-reviews">${reviews.map(r => `
          <div class="crs-review">
            <div class="crs-review-top">
              <span class="crs-review-name">${esc((r.user && (r.user.firstName + ' ' + (r.user.lastName || ''))) || 'Hairlux Customer')}</span>
              <span class="crs-review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            </div>
            ${r.review ? `<div class="crs-review-text">${esc(r.review)}</div>` : ''}
            <div class="crs-review-date">${fmtDate(r.createdAt)}</div>
          </div>`).join('')}</div>`;
      }

      function renderPurchaseBox() {
        const owned = !!(myAccessEntry && myAccessEntry.access.status === 'ACTIVE' && (!myAccessEntry.access.expiresAt || new Date(myAccessEntry.access.expiresAt) > new Date()));
        const expired = !!(myAccessEntry && (myAccessEntry.access.status === 'EXPIRED' || (myAccessEntry.access.expiresAt && new Date(myAccessEntry.access.expiresAt) <= new Date())));
        const price = course.currentPrice;

        if (course.status === 'COMING_SOON') {
          return `<div class="crs-purchase-box"><span class="crs-pill crs-pill-COMING_SOON">Coming Soon</span>
            <div class="form-hint" style="margin-top:12px;">This course isn't open for enrollment yet.</div></div>`;
        }

        if (owned) {
          const progress = myAccessEntry.progress;
          const pct = progress ? Math.round(progress.percentComplete) : 0;
          const isComplete = myAccessEntry.bucket === 'COMPLETED';
          return `<div class="crs-purchase-box">
            <span class="crs-pill crs-pill-${myAccessEntry.bucket}">${myAccessEntry.bucket.replace('_', ' ')}</span>
            <div class="crs-progress-bar" style="margin-top:14px;"><div class="crs-progress-bar-fill" style="width:${pct}%;"></div></div>
            <div class="crs-progress-label">${pct}% complete</div>
            <button class="btn-crs btn-crs-primary btn-crs-block" style="margin-top:16px;" id="btnContinue">${isComplete ? 'Review Course' : 'Continue Learning'}</button>
            ${isComplete && course.certificateEnabled ? (myCertificate
              ? `<div class="crs-cert-badge" style="margin-top:12px;">🎓 Certificate earned — ${esc(myCertificate.certificateNumber)}</div><div class="crs-cert-note">Keep this number for your records — Hairlux Academy can verify it on request.</div><a class="btn-crs btn-crs-outline btn-crs-block" style="margin-top:10px;" href="${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES}/${encodeURIComponent(myCertificate.certificateNumber)}/download" target="_blank" rel="noopener">Download Certificate (PDF)</a>`
              : '<div class="crs-cert-badge" style="margin-top:12px;">🎓 Certificate earned</div><div class="crs-cert-note">Your certificate is being issued — check back shortly, or reach out to Hairlux Academy.</div>') : ''}
            ${isComplete ? '<button class="btn-crs btn-crs-outline btn-crs-block" style="margin-top:10px;" id="btnWriteReview">Write a Review</button>' : ''}
          </div>`;
        }

        if (expired) {
          return `<div class="crs-purchase-box">
            <span class="crs-pill crs-pill-EXPIRED">Access Expired</span>
            <div class="crs-purchase-price" style="margin-top:12px;">${priceHtml(price)}</div>
            <button class="btn-crs btn-crs-primary btn-crs-block" style="margin-top:16px;" id="btnEnroll">Enroll Again</button>
          </div>`;
        }

        return `<div class="crs-purchase-box">
          <div class="crs-purchase-price">${priceHtml(price)}</div>
          <div class="crs-purchase-meta">
            <span>${course.accessType === 'LIFETIME' ? 'Lifetime access' : course.accessType === 'FIXED_DAYS' ? `${course.accessDurationDays}-day access` : 'Limited-time access'}</span>
            ${course.certificateEnabled ? '<span>🎓 Certificate on completion</span>' : ''}
          </div>
          <button class="btn-crs btn-crs-primary btn-crs-block" id="btnEnroll" ${price ? '' : 'disabled'}>Enroll Now</button>
        </div>`;
      }

      function render() {
        const price = course.currentPrice;
        root.innerHTML = `
          <div class="crs-detail-grid">
            <div class="crs-detail-main">
              <div class="crs-detail-hero">
                ${course.coverImageUrl ? `<img src="${course.coverImageUrl}" alt="" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px;margin-bottom:16px;">` : ''}
                <div class="crs-detail-meta-row">
                  ${course.category ? `<span class="crs-card-badge">${esc(course.category)}</span>` : ''}
                  <span class="crs-pill crs-pill-${course.status}">${course.status.replace('_', ' ')}</span>
                  <span class="form-hint">${course.level}</span>
                  ${course.averageRating ? `<span class="crs-card-rating">★ ${(Math.round(course.averageRating * 10) / 10).toFixed(1)}</span>` : ''}
                </div>
                <h1>${esc(course.title)}</h1>
                ${course.instructor ? `<div class="form-hint" style="margin-bottom:12px;">Instructor: ${esc(course.instructor.name)}${course.instructor.currentRole ? ' — ' + esc(course.instructor.currentRole) : ''}</div>` : ''}
                <div class="crs-detail-desc crs-rich">${richText(course.description || course.shortDescription || '')}</div>
                ${course.requirements ? `<div class="crs-detail-block"><h4>Requirements</h4><div class="crs-rich">${richText(course.requirements)}</div></div>` : ''}
                ${course.learningObjectives ? `<div class="crs-detail-block"><h4>What you'll learn</h4><div class="crs-rich">${richText(course.learningObjectives)}</div></div>` : ''}
                ${course.dos ? `<div class="crs-detail-block"><h4>Do's</h4><div class="crs-rich">${richText(course.dos)}</div></div>` : ''}
                ${course.donts ? `<div class="crs-detail-block"><h4>Don'ts</h4><div class="crs-rich">${richText(course.donts)}</div></div>` : ''}
              </div>

              <div>
                <div class="crs-section-title"><h2>Curriculum</h2></div>
                ${renderCurriculum()}
              </div>

              <div>
                <div class="crs-section-title"><h2>Reviews</h2></div>
                ${renderReviews()}
              </div>
            </div>
            ${renderPurchaseBox()}
          </div>`;

        bindPreviewToggles();

        const btnEnroll = document.getElementById('btnEnroll');
        if (btnEnroll) btnEnroll.addEventListener('click', openPurchaseModal);
        const btnContinue = document.getElementById('btnContinue');
        if (btnContinue) btnContinue.addEventListener('click', () => { window.location.href = playerUrl(); });
        const btnWriteReview = document.getElementById('btnWriteReview');
        if (btnWriteReview) btnWriteReview.addEventListener('click', openReviewModal);
      }

      async function loadAll() {
        try {
          course = await AcademyCoursesAPI.getCourse(courseId);
        } catch (err) {
          root.innerHTML = `<div class="empty-state">${errMsg(err, 'Course not found.')}</div>`;
          return false;
        }
        try {
          const access = await AcademyCoursesAPI.listMyAccess();
          myAccessEntry = (access || []).find(a => a.access.courseId === courseId) || null;
        } catch (_) { myAccessEntry = null; }
        try {
          reviews = await AcademyCoursesAPI.listReviews(courseId);
        } catch (_) { reviews = []; }
        myCertificate = null;
        if (myAccessEntry && myAccessEntry.bucket === 'COMPLETED' && course.certificateEnabled) {
          try {
            const certs = await AcademyCoursesAPI.listMyCertificates();
            myCertificate = (certs || []).find(c => c.programType === 'COURSE' && c.programId === courseId && c.status === 'ISSUED') || null;
          } catch (_) { myCertificate = null; }
        }
        render();
        return true;
      }

      // ── Purchase modal ──────────────────────────────────────────
      let appliedDiscount = null;
      const purchaseOverlay = document.getElementById('purchaseOverlay');
      const purchaseForm = document.getElementById('purchaseForm');
      const purchaseSummary = document.getElementById('purchaseSummary');
      const discountCodeEl = document.getElementById('discountCode');
      const discountHint = document.getElementById('discountHint');
      const discountError = document.getElementById('discountError');
      const purchaseSubmit = document.getElementById('purchaseSubmit');

      function openPurchaseModal() {
        if (typeof APIHelper !== 'undefined' && !APIHelper.isAuthenticated()) {
          const returnTo = `course-detail.html?id=${encodeURIComponent(courseId)}`;
          window.location.href = `log-in.html?returnTo=${encodeURIComponent(returnTo)}`;
          return;
        }
        appliedDiscount = null;
        purchaseForm.reset();
        discountHint.textContent = '';
        discountError.classList.remove('is-visible');
        const price = course.currentPrice;
        purchaseSummary.innerHTML = `
          <div><strong>${esc(course.title)}</strong></div>
          <div class="crs-summary-price" id="purchasePrice" style="margin-top:8px;">${priceHtml(price)}</div>`;
        document.getElementById('purchaseTitle').textContent = (price && price.amount === 0) ? 'Enroll for Free' : 'Enroll';
        purchaseSubmit.textContent = (price && price.amount === 0) ? 'Confirm Free Enrollment' : 'Confirm Enrollment';
        purchaseOverlay.classList.add('open');
      }
      function closePurchaseModal() { purchaseOverlay.classList.remove('open'); }
      document.getElementById('purchaseClose').addEventListener('click', closePurchaseModal);
      document.getElementById('purchaseCancel').addEventListener('click', closePurchaseModal);
      purchaseOverlay.addEventListener('click', (e) => { if (e.target === purchaseOverlay) closePurchaseModal(); });

      document.getElementById('btnApplyCode').addEventListener('click', async () => {
        discountError.classList.remove('is-visible');
        const code = discountCodeEl.value.trim();
        if (!code) { discountError.textContent = 'Enter a code first.'; discountError.classList.add('is-visible'); return; }
        const price = course.currentPrice;
        try {
          const result = await AcademyCoursesAPI.validateDiscountCode(code, price ? price.amount : 0);
          appliedDiscount = { code, ...result };
          discountHint.textContent = `${result.name || code}: −${fmtNaira(result.discountAmount)} — you pay ${fmtNaira(result.finalAmount)}`;
          const priceEl = document.getElementById('purchasePrice');
          // Keep the normal fee struck through, now against the final amount after the code.
          if (priceEl) {
            const was = price && price.originalAmount != null ? price.originalAmount : (price ? price.amount : null);
            priceEl.innerHTML = was != null && was > result.finalAmount
              ? `<s class="crs-price-was">${fmtNaira(was)}</s> <span class="crs-price-now">${fmtNaira(result.finalAmount)}</span>`
              : fmtNaira(result.finalAmount);
          }
        } catch (err) {
          appliedDiscount = null;
          discountError.textContent = errMsg(err, 'That code is not valid.');
          discountError.classList.add('is-visible');
        }
      });

      purchaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        UIHelper.setButtonLoading(purchaseSubmit, true);
        try {
          const result = await AcademyCoursesAPI.purchase(courseId, appliedDiscount ? appliedDiscount.code : undefined);
          if (result.authorizationUrl) {
            saveState({ courseId, orderId: result.order.id, createdAt: Date.now() });
            toast('Redirecting to Paystack to complete payment…');
            window.location.href = result.authorizationUrl;
          } else {
            closePurchaseModal();
            toast('Enrolled! Access granted.');
            clearState();
            await loadAll();
          }
        } catch (err) {
          toast(errMsg(err, 'Could not complete enrollment.'), 'error');
        } finally {
          UIHelper.setButtonLoading(purchaseSubmit, false);
        }
      });

      // ── Review modal ─────────────────────────────────────────────
      const reviewOverlay = document.getElementById('reviewOverlay');
      const reviewForm = document.getElementById('reviewForm');
      const reviewError = document.getElementById('reviewError');
      const reviewSubmit = document.getElementById('reviewSubmit');
      let selectedRating = 0;

      function openReviewModal() {
        selectedRating = 0;
        reviewForm.reset();
        reviewError.classList.remove('is-visible');
        document.querySelectorAll('.crs-rating-star').forEach(s => s.classList.remove('is-active'));
        reviewOverlay.classList.add('open');
      }
      function closeReviewModal() { reviewOverlay.classList.remove('open'); }
      document.getElementById('reviewClose').addEventListener('click', closeReviewModal);
      document.getElementById('reviewCancel').addEventListener('click', closeReviewModal);
      reviewOverlay.addEventListener('click', (e) => { if (e.target === reviewOverlay) closeReviewModal(); });

      document.querySelectorAll('.crs-rating-star').forEach(star => {
        star.addEventListener('click', () => {
          selectedRating = Number(star.dataset.value);
          document.querySelectorAll('.crs-rating-star').forEach(s => s.classList.toggle('is-active', Number(s.dataset.value) <= selectedRating));
        });
      });

      reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        reviewError.classList.remove('is-visible');
        if (!selectedRating) { reviewError.textContent = 'Pick a star rating.'; reviewError.classList.add('is-visible'); return; }
        UIHelper.setButtonLoading(reviewSubmit, true);
        try {
          await AcademyCoursesAPI.submitReview(courseId, selectedRating, document.getElementById('reviewText').value.trim() || undefined);
          closeReviewModal();
          toast('Review submitted — pending moderation.');
        } catch (err) {
          reviewError.textContent = errMsg(err, 'Could not submit review.');
          reviewError.classList.add('is-visible');
        } finally {
          UIHelper.setButtonLoading(reviewSubmit, false);
        }
      });

      // ── Payment return ───────────────────────────────────────────
      async function handlePaymentReturn() {
        const query = new URLSearchParams(window.location.search);
        const reference = query.get('trxref') || query.get('reference') || '';
        const state = readState();
        if (!reference || !state || state.courseId !== courseId) return;
        cleanCallbackQuery();
        try {
          await AcademyCoursesAPI.verifyPayment(state.orderId);
          toast('Payment verified — access granted!');
        } catch (err) {
          toast(errMsg(err, 'Could not verify payment automatically.'), 'error');
        }
        clearState();
      }

      await handlePaymentReturn();
      await loadAll();
    });
