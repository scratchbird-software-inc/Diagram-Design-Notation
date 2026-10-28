import { createGraphFixture, graphFixtureProfiles } from '../browser/graph-profiles.fixtures.mjs';
import { dataProfileFixture, fixtureProfiles } from '../browser/data-profile-fixtures.mjs';
export const nativeSources = {
    'ddn@1': 'erd Sales\n    Customer\n    Order\n    connect Customer to Order\n',
    'mindmap.basic@1': 'mindmap Product\n    Research\n        Interviews\n    Delivery\n',
    'concept.map@1': 'view Knowledge as concept.map@1\n    element Concept as object\n    element Evidence as object\n    connect Concept to Evidence as assoc : supports\n',
    'table.records@1': 'data Tasks\n    task.owner\n    Design.Alex\n    Build.Sam\nview Records as table.records@1\n    with\n        projection.options\n            records Tasks\n            columns 2\n            missing gap\n',
};
export const allFixtureProfiles = [...Object.keys(nativeSources), ...graphFixtureProfiles, ...fixtureProfiles];
export function profileSource(profile, language) {
    if (nativeSources[profile]) return nativeSources[profile];
    const { document } = graphFixtureProfiles.includes(profile) ? createGraphFixture(profile) : dataProfileFixture(profile);
    return documentSource(document, language);
}
/** Emit new-dialect typed declarations; normalized witnesses never bypass the parser. */
export function documentSource(document, { quoteText, serializeProperties }) {
    const lines = [];
    const emit = (header, record, omitted) => {
        const properties = { ...record };
        for (const key of omitted) delete properties[key];
        lines.push(header + '\n    with\n' + serializeProperties(properties, '        '));
    };
    for (const record of document.assets ?? []) emit(`asset ${quoteText(record.name ?? record.id)} as resource from ${quoteText(record.path ?? record.id + '.json')}`, record, ['name', 'path']);
    for (const record of document.data ?? []) emit(`data ${quoteText(record.name ?? record.id)}`, record, ['name']);
    for (const record of document.definitions ?? []) emit(`${record.category === 'relation' ? 'relation' : 'element'} ${quoteText(record.name ?? record.id)} as ${quoteText(record.role)}`, record, ['name', 'role', 'category']);
    for (const record of document.views ?? []) emit(`view ${quoteText(record.name ?? record.id)} as ${quoteText(record.profile)}`, record, ['name', 'profile']);
    return lines.join('\n');
}
export const sourceSet = text => ({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: '1', encoding: 'utf-8', writable: true }] });
