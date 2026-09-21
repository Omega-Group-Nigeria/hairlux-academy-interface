
    document.addEventListener('DOMContentLoaded', async () => {
      const fmtNaira = (n) => n === 0 ? 'Free' : '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const toast = (msg, type = 'success') => { if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type); };
      const errMsg = (err, fallback) => (err && err.message) ? err.message : fallback;

      let coursesCache = [];

      function renderStars(avg) {
        if (avg === null || avg === undefined) return '';
        const rounded = Math.round(avg * 10) / 10;
        return `<span class="crs-card-rating">★ ${rounded.toFixed(1)}</span>`;
      }

      function applyFilters() {
        const category = document.getElementById('categoryFilter').value;
        const level = document.getElementById('levelFilter').value;
        return coursesCache.filter(c =>
          (!category || c.category === category) &&
          (!level || c.level === level)
        );
      }

      function renderGrid() {
        const grid = document.getElementById('coursesGrid');
        const filtered = applyFilters();
        if (!filtered.length) {
          grid.innerHTML = '<div class="empty-state">No courses match those filters yet.</div>';
          return;
        }
        grid.innerHTML = filtered.map(c => {
          const price = c.currentPrice;
          const priceLabel = c.status === 'COMING_SOON' ? 'Coming soon' : (price ? fmtNaira(price.amount) : 'Pricing TBC');
          return `
            <div class="crs-card" data-id="${c.id}">
              <div class="crs-card-top">
                <div class="crs-card-name">${c.title}</div>
                ${c.category ? `<span class="crs-card-badge">${c.category}</span>` : ''}
              </div>
              <div class="crs-card-desc">${c.shortDescription || c.description || 'No description provided yet.'}</div>
              <div class="crs-card-meta">
                <span>${c.level}</span>
                ${c.duration ? `<span>${c.duration} min</span>` : ''}
                ${renderStars(c.averageRating)}
              </div>
              <div class="crs-card-bottom">
                <div class="crs-card-price">${priceLabel}</div>
                ${c.certificateEnabled ? '<div class="crs-card-badge" style="background:var(--success-bg);color:var(--success);border-color:#c2e8ce;">🎓 Certificate</div>' : ''}
              </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.crs-card').forEach(card => {
          card.addEventListener('click', () => {
            window.location.href = `course-detail.html?id=${card.dataset.id}`;
          });
        });
      }

      async function loadCourses() {
        const grid = document.getElementById('coursesGrid');
        try {
          coursesCache = await AcademyCoursesAPI.listCourses({});
          if (!coursesCache.length) {
            grid.innerHTML = '<div class="empty-state">No courses are published yet — check back soon.</div>';
            return;
          }
          const categories = Array.from(new Set(coursesCache.map(c => c.category).filter(Boolean)));
          const categoryFilter = document.getElementById('categoryFilter');
          categoryFilter.innerHTML = '<option value="">All categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
          renderGrid();
        } catch (err) {
          grid.innerHTML = '<div class="empty-state">Could not load courses.</div>';
          toast(errMsg(err, 'Could not load courses.'), 'error');
        }
      }

      document.getElementById('categoryFilter').addEventListener('change', renderGrid);
      document.getElementById('levelFilter').addEventListener('change', renderGrid);

      loadCourses();
    });
