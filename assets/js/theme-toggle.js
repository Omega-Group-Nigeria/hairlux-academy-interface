/**
 * Hairlux Academy - light/dark mode toggle.
 * Pilot rollout (index.html, courses.html, course-detail.html) -- follows
 * the visitor's OS/browser preference (prefers-color-scheme) until they
 * click the toggle, at which point their explicit choice is remembered in
 * localStorage and takes over from system preference going forward. Runs
 * as an early, non-deferred <head> script so data-theme is set before
 * first paint (no flash of the wrong theme).
 */
(function () {
  var STORAGE_KEY = 'hairlux-theme';

  function storedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function syncButtons() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', isDark ? 'true' : 'false');
      buttons[i].title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }

  window.HairluxTheme = {
    current: function () { return document.documentElement.getAttribute('data-theme') || 'light'; },
    toggle: function () {
      var next = window.HairluxTheme.current() === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
      syncButtons();
    }
  };

  // Set the theme immediately, before the rest of <head>/<body> parses.
  var stored = storedTheme();
  apply(stored === 'dark' || stored === 'light' ? stored : (systemPrefersDark() ? 'dark' : 'light'));

  // Keep following the system setting for as long as the visitor hasn't
  // made an explicit choice of their own.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (e) {
      if (storedTheme() === 'dark' || storedTheme() === 'light') return;
      apply(e.matches ? 'dark' : 'light');
      syncButtons();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncButtons();
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', window.HairluxTheme.toggle);
    }
  });
})();
