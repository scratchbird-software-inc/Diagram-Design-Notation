/* SPDX-License-Identifier: GPL-2.0-or-later. Nav toggle for small screens (B1-017, D5). */
(function () {
  var btn = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (btn && nav) btn.addEventListener('click', function () { nav.classList.toggle('open'); });
})();
