/**
 * Hairlux Academy — Navigation Authentication Handler
 * Updates navbar buttons based on login state for public Academy pages
 * (log-in, sign-up, landing page). Mirrors the main site's nav-auth.js
 * dynamic-injection pattern, trimmed to the links that exist on this site.
 */
(function () {
  function updateNavAuth() {
    if (typeof APIHelper === 'undefined') {
      console.warn('APIHelper not defined. Ensure config.js and auth-api.js are loaded.');
      return;
    }

    const user = APIHelper.getUserData();
    const token = APIHelper.getToken();

    if (user && token) {
      const authCta = document.querySelector('[data-auth-cta="hero"]');
      if (authCta) {
        authCta.setAttribute('href', 'app/index.html');
        const authCtaLabel = authCta.querySelector('div');
        if (authCtaLabel) authCtaLabel.textContent = 'Go to Dashboard';
      }

      const first = (user.firstName || '').trim();
      const last  = (user.lastName  || '').trim();
      const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || (user.email || '?')[0].toUpperCase();
      const fullName = (first + ' ' + last).trim() || user.email || 'My Account';

      const btnWrapper = document.querySelector('.button-wrapper');
      if (btnWrapper) btnWrapper.style.display = 'none';

      const mobileLogin = document.querySelector('.login-nav-mobile');
      if (mobileLogin) mobileLogin.style.display = 'none';

      const containerNav = document.querySelector('.container-nav');
      const menuButton = document.querySelector('.menu-button.w-nav-button');

      if (containerNav && menuButton) {
        let toolsWrapper = containerNav.querySelector('.mobile-nav-tools');

        if (!toolsWrapper) {
          toolsWrapper = document.createElement('div');
          toolsWrapper.className = 'mobile-nav-tools';
          containerNav.appendChild(toolsWrapper);
          toolsWrapper.appendChild(menuButton);
        }

        const dropdownHtml = `
          <div data-hover="false" data-delay="0" class="profile-dropdown w-dropdown">
            <div class="profile-toggle w-dropdown-toggle">
              <div class="top-profile">
                <div class="top-profile-avatar" id="navAvatar">${initials}</div>
                <div>
                  <div class="top-profile-name" id="navName">${fullName}</div>
                  <div class="top-profile-link">View profile</div>
                </div>
              </div>
            </div>
            <nav class="profile-list w-dropdown-list">
              <a href="app/index.html" class="dropdown-link w-dropdown-link">Dashboard</a>
              <a href="courses.html" class="dropdown-link w-dropdown-link">Digital Courses</a>
              <a href="training.html" class="dropdown-link w-dropdown-link">In-Branch Training</a>
              <a href="app/my-courses.html" class="dropdown-link w-dropdown-link">My Courses</a>
              <a href="app/my-training.html" class="dropdown-link w-dropdown-link">My Training</a>
              <a href="app/profile.html" class="dropdown-link w-dropdown-link">My Profile</a>
              <a href="#" id="navLogoutBtn" class="dropdown-link w-dropdown-link">Logout</a>
            </nav>
          </div>
        `;

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = dropdownHtml.trim();
        const dropdownEl = tempContainer.firstChild;
        toolsWrapper.appendChild(dropdownEl);

        const toggle = dropdownEl.querySelector('.profile-toggle');
        const list = dropdownEl.querySelector('.profile-list');

        if (toggle && list) {
          toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = dropdownEl.classList.contains('w--open');
            if (isOpen) {
              dropdownEl.classList.remove('w--open');
              toggle.classList.remove('w--open');
              list.classList.remove('w--open');
            } else {
              dropdownEl.classList.add('w--open');
              toggle.classList.add('w--open');
              list.classList.add('w--open');
            }
          });

          document.addEventListener('click', function (e) {
            if (!dropdownEl.contains(e.target)) {
              dropdownEl.classList.remove('w--open');
              toggle.classList.remove('w--open');
              list.classList.remove('w--open');
            }
          });
        }

        const logoutBtn = dropdownEl.querySelector('#navLogoutBtn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            AuthAPI.logout();
            window.location.reload();
          });
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavAuth);
  } else {
    updateNavAuth();
  }
})();
