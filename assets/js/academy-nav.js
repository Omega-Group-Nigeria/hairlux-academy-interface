/**
 * Hairlux Academy — Guest-Friendly Nav Auth
 * For top-level Academy pages (index/courses/course-detail/training) that must
 * stay browsable by logged-out visitors. Mirrors the main site's
 * app-guest-auth.js pattern: never redirects, only toggles the pre-existing
 * Login/Signup vs. profile-dropdown markup based on session state.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof APIHelper === 'undefined' || typeof AuthAPI === 'undefined') return;
    if (!APIHelper.isAuthenticated()) return; // leave guest nav as-is, no redirect

    const loginMobile  = document.getElementById('guestLoginMobile');
    const loginDesktop = document.getElementById('guestLoginDesktop');
    const dropdown      = document.getElementById('navProfileDropdown');

    if (loginMobile)  loginMobile.style.display = 'none';
    if (loginDesktop) loginDesktop.style.display = 'none';
    if (dropdown)     dropdown.style.display = '';

    const user = APIHelper.getUserData();
    if (!user) return;

    const first = (user.firstName || '').trim();
    const last  = (user.lastName  || '').trim();
    const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || (user.email || '?')[0].toUpperCase();
    const fullName = (first + ' ' + last).trim() || user.email || '';

    const avatarEl = document.getElementById('navAvatar');
    const nameEl   = document.getElementById('navName');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = fullName;

    document.querySelectorAll('[data-logout="true"]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        AuthAPI.logout();
        sessionStorage.setItem('hairlux_auth_notice', 'logged-out');
        window.location.href = 'log-in.html';
      });
    });
  });
})();
