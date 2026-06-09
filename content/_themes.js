// _themes.js — theme switcher for the Theme Picker screen
(function () {
  'use strict';
  document.addEventListener('click', function (event) {
    var card = event.target.closest('[data-theme-card]');
    if (!card) return;
    var theme = card.getAttribute('data-theme-card');
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-card]').forEach(function (el) {
      el.classList.toggle('is-selected', el === card);
    });
  });
})();
