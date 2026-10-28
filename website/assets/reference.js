/* Searchable codex and role catalogue, carried locally by reference-data.js. */
(() => {
    'use strict';
    const data = window.DDN_WEBSITE_REFERENCE;
    const host = document.querySelector('#reference-results');
    if (!host || !data) return;
    const root = document.body.dataset.siteRoot || '../';
    const mode = host.dataset.mode;
    const search = document.querySelector('#reference-search');
    const select = document.querySelector('#reference-kind');
    const count = document.querySelector('#reference-count');
    const all = mode === 'properties' ? data.properties : data.roles;
    const element = (tag, value, className) => {
        const node = document.createElement(tag);
        if (value !== undefined) node.textContent = value;
        if (className) node.className = className;
        return node;
    };
    const kinds = [...new Set(all.map(item => mode === 'properties' ? item.owner : item.category))].sort();
    for (const kind of kinds) {
        const option = element('option', kind);
        option.value = kind;
        select.append(option);
    }
    let page = 0;
    const size = mode === 'properties' ? 50 : 60;
    function render() {
        const query = search.value.trim().toLocaleLowerCase();
        const items = all.filter(item => (!select.value || (mode === 'properties' ? item.owner : item.category) === select.value) && [item.id, item.role, item.name, item.path, item.owner, item.meaning, item.family, ...(item.profiles || [])].join(' ').toLocaleLowerCase().includes(query));
        page = Math.max(0, Math.min(page, Math.ceil(items.length / size) - 1));
        host.replaceChildren();
        const slice = items.slice(page * size, (page + 1) * size);
        if (mode === 'properties') {
            const wrap = element('div', undefined, 'table-scroll');
            const table = element('table');
            const header = element('tr');
            for (const name of ['Owner / property', 'Meaning', 'Default', 'CSS']) header.append(element('th', name));
            const thead = element('thead');
            thead.append(header);
            table.append(thead);
            const tbody = element('tbody');
            for (const item of slice) {
                const row = element('tr');
                row.id = item.id;
                const name = element('td');
                name.append(element('small', item.owner), element('br'), element('code', item.path));
                row.append(name, element('td', item.meaning), element('td', typeof item.default === 'string' ? item.default : JSON.stringify(item.default)), element('td', item.css ? 'Allowed' : 'No'));
                tbody.append(row);
            }
            table.append(tbody);
            wrap.append(table);
            host.append(wrap);
        } else {
            const grid = element('div', undefined, 'grid role-grid');
            for (const item of slice) {
                const card = element('article', undefined, 'card role-card');
                card.id = 'role-' + item.slug;
                const swatch = element('span', undefined, 'role-symbol');
                const preview = document.createElement('img');
                preview.src = root + item.preview;
                preview.alt = item.role + ' base contour';
                preview.loading = 'lazy';
                swatch.append(preview);
                swatch.title = 'Base contour from the current renderer; open its profile for complete context';
                const text = element('div');
                text.append(element('h3', item.name || item.role), element('code', item.role), element('p', item.meaning ? 'Recorded core meaning: ' + item.meaning : item.category));
                const meta = element('p', `${item.category} · ${item.profiles.length} profile${item.profiles.length === 1 ? '' : 's'}`, 'role-meta');
                text.append(meta);
                const link = element('a', 'Role contract');
                link.href = root + 'reference/roles/' + item.slug + '.html';
                text.append(link);
                card.append(swatch, text);
                grid.append(card);
            }
            host.append(grid);
        }
        count.textContent = `${items.length} matching ${mode === 'properties' ? 'properties' : 'roles'} · ${items.length ? page * size + 1 : 0}–${Math.min(items.length, (page + 1) * size)}`;
        if (!items.length) host.append(element('p', 'No matching entries.', 'empty-state'));
        if (items.length > size) {
            const pagination = element('nav', undefined, 'pagination');
            pagination.setAttribute('aria-label', 'Reference pages');
            for (const [delta, title] of [[-1, 'Previous'], [1, 'Next']]) {
                const button = element('button', title);
                button.disabled = delta < 0 ? page === 0 : (page + 1) * size >= items.length;
                button.addEventListener('click', () => { page += delta; render(); count.scrollIntoView({block:'start'}); });
                pagination.append(button);
                if (delta < 0) pagination.append(element('span', `Page ${page + 1} of ${Math.ceil(items.length / size)}`));
            }
            host.append(pagination);
        }
    }
    search.addEventListener('input', () => { page = 0; render(); });
    select.addEventListener('change', () => { page = 0; render(); });
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') || '';
    render();
})();
