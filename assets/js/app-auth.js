/**
 * HairLux App Auth Guard + Logout Handler
 * Reusable for all logged-in app pages under /app
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    if (typeof APIHelper === 'undefined' || typeof AuthAPI === 'undefined') {
      return;
    }

    const loginPage = '../log-in.html';

    // Protect app pages: require existing auth state
    if (!APIHelper.isAuthenticated()) {
      window.location.href = loginPage;
      return;
    }

    // Do not force refresh on every page load.
    // Access token refresh is handled on-demand in APIHelper.request() when a protected call returns 401.

    // Populate nav profile from cached user data (no extra API call).
    (function initNavProfile() {
      var user = APIHelper.getUserData();
      if (!user) return;
      var first    = (user.firstName || '').trim();
      var last     = (user.lastName  || '').trim();
      var initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || (user.email || '?')[0].toUpperCase();
      var fullName = (first + ' ' + last).trim() || user.email || '';
      var avatarEl = document.getElementById('navAvatar');
      var nameEl   = document.getElementById('navName');
      var greetEl  = document.getElementById('dashboardGreeting');

      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl)   nameEl.textContent   = fullName;

      if (greetEl) {
        // Nigeria time (UTC+1) greeting
        var ngTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos', hour12: false, hour: 'numeric' });
        var hour = parseInt(ngTime, 10);
        var greeting = 'Hello';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        else greeting = 'Good evening';
        
        greetEl.textContent = `${greeting}, ${first || 'User'}!`;
      }

      // Show influencer-only nav links if user is an active influencer.
      var isInfluencer = !!(user.influencer && user.influencer.isActive === true);
      document.querySelectorAll('[data-influencer-only]').forEach(function (el) {
        el.style.display = isInfluencer ? '' : 'none';
      });

      // Guard: if this is the discounts page and user is not an influencer, redirect.
      if (window.location.pathname.includes('discounts.html') && !isInfluencer) {
        window.location.replace('index.html');
      }
    })();

    const logoutLinks = document.querySelectorAll('[data-logout="true"], a[href="../log-in.html"], a[href="log-in.html"]');

    logoutLinks.forEach((link) => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        AuthAPI.logout();
        sessionStorage.setItem('hairlux_auth_notice', 'logged-out');
        window.location.href = loginPage;
      });
    });
  });
})();
