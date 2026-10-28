import {readFileSync} from 'node:fs';
const expectations=JSON.parse(readFileSync(new URL('../../website/gallery/verification-expectations.json',import.meta.url),'utf8')).entries;
/** Compare exact diagnostics, including multiplicity. This is not an error-code allowlist. */
export function matchesGalleryVerification(entry, report) {
    const expected=expectations[entry]??[];
    if(!expected.length)return report?.outcome==='valid';
    if(report?.outcome!=='invalid')return false;
    const errors=report.diagnostics.filter(d=>d.severity==='error');
    if(errors.some(d=>d.target?.file!==entry||d.rule!=='ddn.profile.bpmn.process@1'))return false;
    const signature=value=>JSON.stringify(value.map(d=>[d.code,typeof d.target==='string'?d.target:d.target?.id]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    return signature(errors)===signature(expected);
}
