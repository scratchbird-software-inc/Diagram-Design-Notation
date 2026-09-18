/** SPDX-License-Identifier: GPL-2.0-or-later.
 * Optional prototype. Libraries must be supplied by the trusted host. This module
 * never downloads packages or data, and is not a replacement for DDN publication.
 * Real external-library execution is an unverified gate in this release; see README.
 */
export async function renderVegaSVG(workspace, request, {vega, vegaLite, expressionInterpreter} = {}) {
  if (!vega?.parse || !vega?.View || !vegaLite?.compile || !expressionInterpreter) {
    throw new TypeError('Provide compatible Vega, Vega-Lite and expressionInterpreter explicitly.');
  }
  const specification = workspace.exportVegaLite(request);
  if (!Array.isArray(specification.data?.values) || specification.data.url) {
    throw new Error('Adapter accepts DDN-generated local-values specifications only.');
  }
  const warnings = [];
  const logger = {level(){return this;},warn(...a){warnings.push(a.join(' '));return this;},info(){return this;},debug(){return this;},error(...a){throw new Error(a.join(' '));}};
  const compiled = vegaLite.compile(specification, {logger}).spec;
  const denied = async () => { throw new Error('External data, image and URL loading is disabled.'); };
  const runtime = vega.parse(compiled, null, {ast:true});
  const view = new vega.View(runtime, {renderer:'none', expr:expressionInterpreter, loader:{load:denied,sanitize:denied}});
  try {
    await view.runAsync();
    return {svg:await view.toSVG(), specification, warnings, omissions:specification.usermeta?.omissions||[],
      scope:'Optional quantitative export; native DDN controls, instance ID scoping, page guards, style and editing are not reproduced.'};
  } finally { view.finalize(); }
}
