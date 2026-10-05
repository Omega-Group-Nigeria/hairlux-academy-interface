
    document.addEventListener('DOMContentLoaded', async () => {
      if (typeof APIHelper !== 'undefined' && !APIHelper.isAuthenticated()) return; // app-auth.js is redirecting to log in
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const toast = (msg, type = 'success') => { if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type); };
      const errMsg = (err, fallback) => (err && err.message) ? err.message : fallback;

      let accessCache = [];
      let activeBucket = 'ALL';
      let certsByCourseId = {}; // courseId -> ISSUED AcademyCertificate for that course

      function renderGrid() {
        const grid = document.getElementById('myCoursesGrid');
        const filtered = activeBucket === 'ALL' ? accessCache : accessCache.filter(a => a.bucket === activeBucket);
        if (!filtered.length) {
          grid.innerHTML = `<div class="empty-state">Nothing here yet. <a href="../courses.html">Browse Digital Courses →</a></div>`;
          return;
        }
        grid.innerHTML = filtered.map(a => {
          const pct = a.progress ? Math.round(a.progress.percentComplete) : 0;
          const isComplete = a.bucket === 'COMPLETED';
          return `
            <div class="crs-card" data-id="${a.access.courseId}">
              <div class="crs-card-top">
                <div class="crs-card-name">${esc(a.access.course.title)}</div>
                <span class="crs-pill crs-pill-${a.bucket}">${a.bucket.replace('_', ' ')}</span>
              </div>
              ${a.access.course.category ? `<div class="crs-card-meta"><span>${esc(a.access.course.category)}</span></div>` : ''}
              <div class="crs-progress-mini"><div class="crs-progress-mini-fill" style="width:${pct}%;"></div></div>
              <div class="crs-card-meta"><span>${pct}% complete</span>${a.access.expiresAt ? `<span>Access until ${new Date(a.access.expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}</div>
              ${isComplete && a.access.course.certificateEnabled ? (certsByCourseId[a.access.courseId]
                ? `<div class="crs-cert-badge">🎓 Certificate earned: ${esc(certsByCourseId[a.access.courseId].certificateNumber)}</div>`
                : '<div class="crs-cert-badge">🎓 Certificate earned</div>') : ''}
              <button class="btn-crs btn-crs-primary btn-crs-block" data-action="${isComplete ? 'review' : 'continue'}">${isComplete ? 'Review Course' : 'Continue Learning'}</button>
            </div>`;
        }).join('');

        grid.querySelectorAll('.crs-card button[data-action]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.crs-card');
            const action = btn.dataset.action;
            window.location.href = action === 'review' ? `../course-detail.html?id=${card.dataset.id}` : `course-player.html?id=${card.dataset.id}`;
          });
        });
        grid.querySelectorAll('.crs-card').forEach(card => {
          card.addEventListener('click', () => { window.location.href = `../course-detail.html?id=${card.dataset.id}`; });
        });
      }

      async function loadAccess() {
        const grid = document.getElementById('myCoursesGrid');
        try {
          accessCache = await AcademyCoursesAPI.listMyAccess();
          renderGrid();
        } catch (err) {
          grid.innerHTML = '<div class="empty-state">Could not load your courses.</div>';
          toast(errMsg(err, 'Could not load your courses.'), 'error');
          return;
        }
        if (accessCache.some(a => a.bucket === 'COMPLETED' && a.access.course.certificateEnabled)) {
          try {
            const certs = await AcademyCoursesAPI.listMyCertificates();
            certsByCourseId = {};
            (certs || []).forEach(c => {
              if (c.programType === 'COURSE' && c.status === 'ISSUED') certsByCourseId[c.programId] = c;
            });
            renderGrid();
          } catch (_) { /* badges just fall back to the generic "Certificate earned" label */ }
        }
      }

      document.getElementById('tabBar').addEventListener('click', (e) => {
        const btn = e.target.closest('.crs-tab');
        if (!btn) return;
        activeBucket = btn.dataset.bucket;
        document.querySelectorAll('.crs-tab').forEach(t => t.classList.toggle('is-active', t === btn));
        renderGrid();
      });

      loadAccess();
    });
