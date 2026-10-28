/* Converted examples are supplied by catalogue.js; this page never fetches files. */
(() => {
    'use strict';
    const root = document.body.dataset.siteRoot || '../';
    const catalogue = window.DDN_WEBSITE_CATALOGUE;
    const host = document.querySelector('#gallery-results');
    const search = document.querySelector('#gallery-search');
    const family = document.querySelector('#gallery-family');
    const count = document.querySelector('#gallery-count');
    const status = document.querySelector('#gallery-status');
    const buttons = [...document.querySelectorAll('[data-gallery-tab]')];
    const slug = value => String(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const element = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    const tool = (entry, view, mode) => `${root}tools/index.html?${new URLSearchParams({ example: entry, view: view || '', mode })}`;
    if (!catalogue) {
        status.textContent = 'The converted example catalogue has not been loaded. Rebuild the review website to install its catalogue and previews.';
        return;
    }
    const profiles = Array.isArray(catalogue.profiles) ? catalogue.profiles : Object.entries(catalogue.profiles || {}).map(([id, value]) => ({ id, ...value }));
    const sheets = Array.isArray(catalogue.sheets) ? catalogue.sheets : Object.entries(catalogue.sheets || {}).map(([id, value]) => ({ id, ...value }));
    const corpus = catalogue.corpus || [];
    let tab = 'profiles';
    let page = 0;
    const pageSize = 36;
    const families = [...new Set(profiles.map(item => item.id.split(/[.@]/)[0]))].sort();
    for (const id of families) {
        const option = element('option', id);
        option.value = id;
        family.append(option);
    }
    const all = {
        profiles: profiles.map(item => ({ ...item, key: `profile-${slug(item.id)}`, profile: item.id })),
        sheets: sheets.flatMap(sheet => (sheet.items || sheet.views || []).map(item => ({ ...item, entry: item.entry || sheet.entry || sheet.source, view: item.view || item.id, key: `sheet-${slug(sheet.id)}-${slug(item.view || item.id)}`, group: sheet.title, profile: item.profile || '' }))),
        corpus: corpus.map(item => ({ ...item, key: `corpus-${slug(item.id || item.entry)}`, view: item.view || item.views?.[0]?.id, profile: item.profile || item.views?.[0]?.profile || '', description: item.description || `${item.views?.length || 1} view${item.views?.length === 1 ? '' : 's'} from this converted example.` })),
    };
    document.querySelector('#profile-total').textContent = String(profiles.length);
    document.querySelector('#sheet-total').textContent = String(sheets.length);
    document.querySelector('#corpus-total').textContent = String(corpus.length);
    status.textContent = 'Previews and source use the new DDN implementation. Open a view to inspect it, edit a copy, or run verification.';
    function card(item) {
        const figure = element('figure', undefined, 'gallery-card');
        figure.id = item.key;
        const picture = element('a', undefined, 'gallery-image');
        picture.href = tool(item.entry, item.view, 'view');
        picture.setAttribute('aria-label', `Open ${item.title || item.id} in the viewer`);
        if (item.svg) {
            const img = document.createElement('img');
            img.src = root + item.svg;
            img.alt = item.title || item.id;
            img.loading = 'lazy';
            picture.append(img);
        } else picture.append(element('span', 'Open live preview', 'muted'));
        const caption = element('figcaption');
        caption.append(element('span', item.profile || item.group || 'DDN example', 'profile-id'), element('h3', item.title || item.id || item.entry));
        if (item.description) caption.append(element('p', item.description, 'description'));
        if (item.views?.length > 1) {
            const label = element('label', 'View ');
            label.className = 'count';
            const select = document.createElement('select');
            select.setAttribute('aria-label', `Choose a view in ${item.title}`);
            for (const view of item.views) {
                const option = element('option', view.title || view.id);
                option.value = view.id;
                option.selected = view.id === item.view;
                select.append(option);
            }
            select.addEventListener('change', () => {
                picture.href = tool(item.entry, select.value, 'view');
                for (const link of caption.querySelectorAll('[data-mode]')) link.href = tool(item.entry, select.value, link.dataset.mode);
            });
            label.append(select);
            caption.append(label);
        }
        const actions = element('div', undefined, 'gallery-actions');
        for (const [mode, name] of [['view', 'Viewer'], ['design', 'Designer'], ['verify', 'Verifier']]) {
            const link = element('a', name);
            link.href = tool(item.entry, item.view, mode);
            link.dataset.mode = mode;
            actions.append(link);
        }
        const source = element('a', 'DDN source');
        source.href = root + item.entry;
        source.setAttribute('download', item.entry.split('/').at(-1));
        actions.append(source);
        caption.append(actions, element('p', item.entry, 'source-name'));
        figure.append(picture, caption);
        return figure;
    }
    function render(scroll) {
        const query = search.value.trim().toLocaleLowerCase();
        const items = all[tab].filter(item => (!family.value || String(item.profile).split(/[.@]/)[0] === family.value) && [item.id, item.title, item.profile, item.description, item.entry, item.group].join(' ').toLocaleLowerCase().includes(query));
        page = Math.max(0, Math.min(page, Math.ceil(items.length / pageSize) - 1));
        host.replaceChildren();
        if (!items.length) host.append(element('p', 'No examples match these filters.', 'empty-state'));
        const grid = element('div', undefined, 'gallery-grid');
        grid.append(...items.slice(page * pageSize, (page + 1) * pageSize).map(card));
        host.append(grid);
        count.textContent = `${items.length} matching ${tab === 'profiles' ? 'profiles' : tab === 'sheets' ? 'variations' : 'examples'}${items.length > pageSize ? ` · showing ${page * pageSize + 1}–${Math.min(items.length, (page + 1) * pageSize)}` : ''}`;
        if (items.length > pageSize) {
            const paging = element('nav', undefined, 'pagination');
            paging.setAttribute('aria-label', 'Gallery pages');
            for (const [delta, name] of [[-1, 'Previous'], [1, 'Next']]) {
                const button = element('button', name);
                button.disabled = delta < 0 ? page === 0 : (page + 1) * pageSize >= items.length;
                button.addEventListener('click', () => { page += delta; render(true); });
                paging.append(button);
                if (delta < 0) paging.append(element('span', `Page ${page + 1} of ${Math.ceil(items.length / pageSize)}`));
            }
            host.append(paging);
        }
        if (scroll) document.querySelector('#gallery-count').scrollIntoView({ block: 'start' });
    }
    for (const button of buttons) button.addEventListener('click', () => {
        tab = button.dataset.galleryTab;
        page = 0;
        family.value = '';
        for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
        history.replaceState(null, '', location.pathname + location.search);
        render(false);
    });
    search.addEventListener('input', () => { page = 0; render(false); });
    family.addEventListener('change', () => { page = 0; render(false); });
    function fromHash() {
        const key = decodeURIComponent(location.hash.slice(1));
        const match = all.profiles.find(item => item.key === key);
        if (match) {
            tab = 'profiles';
            search.value = match.profile;
            family.value = '';
            for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.galleryTab === tab));
        }
        render(false);
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
})();
