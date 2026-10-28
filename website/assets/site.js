/* Local navigation, interface preferences and static content filtering. */
(() => {
    'use strict';
    const themes = ['light', 'dark', 'midnight', 'warm'];
    const preferenceKey = 'ddn.interface.v1';
    const select = document.querySelector('[data-site-theme]');
    let theme = 'dark';
    try { const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null'); if (themes.includes(saved?.name)) theme = saved.name; } catch { /* Local pages also work without storage. */ }
    const requested = new URLSearchParams(location.search).get('theme');
    if (themes.includes(requested)) theme = requested;
    const themeURL = (value, force = false) => {
        const url = new URL(value, location.href);
        if (url.origin !== location.origin || !/\/tools\/(?:index\.html|(?:viewer|designer|verifier|studio)\/index\.html)$/.test(url.pathname)) return value;
        if (force || !url.searchParams.has('theme')) url.searchParams.set('theme', theme);
        return url.href;
    };
    function applyTheme(name, save = false) {
        theme = name;
        document.documentElement.dataset.theme = name;
        if (select) select.value = name;
        document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', name === 'light' || name === 'warm' ? 'light' : 'dark');
        for (const image of document.querySelectorAll('img[data-brand]')) {
            image.src = (document.body.dataset.siteRoot || '') + 'assets/brand/' + image.dataset.brand + (name === 'dark' || name === 'midnight' ? '-dark' : '') + '.svg';
        }
        for (const frame of document.querySelectorAll('iframe.live-embed')) {
            const url = themeURL(frame.getAttribute('src'), true);
            if (frame.src !== url) frame.src = url;
        }
        if (save) { try { localStorage.setItem(preferenceKey, JSON.stringify({name, overrides:{}})); } catch { /* A theme remains usable for this page session. */ } }
    }
    applyTheme(theme);
    select?.addEventListener('change', () => { if (themes.includes(select.value)) applyTheme(select.value, true); });
    // Covers dynamically generated gallery links without rewriting their DOM or
    // replacing explicitly themed preview links such as “Dark designer”.
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (link && !link.hasAttribute('download')) { const value=link.getAttribute('href'); if (!new URL(value,location.href).searchParams.has('theme')) link.dataset.inheritTheme='true'; link.href = themeURL(value,link.dataset.inheritTheme==='true'); }
    }, true);
    const button = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    const closeMenu = () => { nav?.classList.remove('open'); button?.setAttribute('aria-expanded', 'false'); };
    button?.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        button.setAttribute('aria-expanded', String(open));
    });
    nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav?.classList.contains('open')) { closeMenu(); button.focus(); } });
    document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
    for (const input of document.querySelectorAll('[data-filter]')) {
        const target = document.getElementById(input.dataset.filter);
        input.addEventListener('input', () => {
            const query = input.value.trim().toLocaleLowerCase();
            let shown = 0;
            for (const item of target.querySelectorAll('[data-search]')) {
                item.hidden = !item.dataset.search.toLocaleLowerCase().includes(query);
                if (!item.hidden) shown++;
            }
            for (const section of target.querySelectorAll('[data-filter-section]')) section.hidden = !section.querySelector('[data-search]:not([hidden])');
            const count = document.getElementById(input.dataset.count);
            if (count) count.textContent = `${shown} matching entries`;
        });
    }
})();
