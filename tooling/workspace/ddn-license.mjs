import {copyFileSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './context.mjs';

export const ddnLicense = 'GPL-2.0-or-later';
export const ddnProject = 'https://github.com/ScratchBird-Software-Inc/Diagram-Design-Notation';
export const ddnSponsor = 'https://scratchbird.ca';
export const ddnCopyright = 'Copyright (c) 2026 ScratchBird Software Inc. and DDN contributors.';
export const ddnLicenseFiles = ['LICENSE', 'NOTICE.md'];
export const ddnLicenseMetadata = {license: ddnLicense, licenseFile: 'LICENSE', notices: 'NOTICE.md', copyright: ddnCopyright, project: ddnProject, sponsor: ddnSponsor};
export const ddnScriptNotice = `/*! DDN — Diagram Design Notation\n * ${ddnCopyright}\n * SPDX-License-Identifier: ${ddnLicense}\n * Free and open-source software. See LICENSE and NOTICE.md.\n * Sponsored by ScratchBird Software Inc. — ${ddnSponsor}\n * Public project: ${ddnProject}\n */\n`;

export function copyDdnLicense(destination) {
    for (const file of ddnLicenseFiles) copyFileSync(join(root, 'project/ddn', file), join(destination, file));
}

/** A single downloaded HTML utility keeps the complete licence with its code. */
export function ddnHtmlNotice() {
    return '<meta name="license" content="' + ddnLicense + '">\n<!-- DDN — Diagram Design Notation. ' + ddnCopyright + ' -->\n' +
        '<script type="text/plain" id="ddn-license">\nDDN — Diagram Design Notation\n' + ddnCopyright + '\nSPDX-License-Identifier: ' + ddnLicense +
        '\nFree and open-source software sponsored by ScratchBird Software Inc.\n' + ddnSponsor + '\nPublic project: ' + ddnProject +
        '\n\n' + readFileSync(join(root, 'project/ddn/LICENSE'), 'utf8') + '\n</script>\n';
}
