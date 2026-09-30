
    document.addEventListener('DOMContentLoaded', async () => {

      // Descriptions are rich text now -- cards show a short plain-text preview.
      const textPreview = (html, max = 160) => {
        // <template> content is inert -- no image loads/handlers while extracting text.
        const d = document.createElement('template');
        d.innerHTML = html == null ? '' : String(html);
        const t = (d.content.textContent || '').replace(/\s+/g, ' ').trim();
        return (t.length > max ? t.slice(0, max).trimEnd() + '\u2026' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      };
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
        const keyword = (document.getElementById('keywordSearch').value || '').trim().toLowerCase();
        return coursesCache.filter(c => {
          if (category && c.category !== category) return false;
          if (level && c.level !== level) return false;
          if (keyword) {
            const haystack = [c.title, c.shortDescription, c.description, c.category].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(keyword)) return false;
          }
          return true;
        });
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
          const priceLabel = c.status === 'COMING_SOON' ? 'Coming soon' : priceHtml(price);
          return `
            <div class="crs-card" data-id="${c.id}">
              ${c.coverImageUrl ? `<img src="${c.coverImageUrl}" alt="" class="crs-card-image" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:10px;">` : ''}
              <div class="crs-card-top">
                <div class="crs-card-name">${c.title}</div>
                ${c.category ? `<span class="crs-card-badge">${c.category}</span>` : ''}
              </div>
              <div class="crs-card-desc">${textPreview(c.shortDescription || c.description) || 'No description provided yet.'}</div>
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
      document.getElementById('keywordSearch').addEventListener('input', renderGrid);

      loadCourses();
    });
