import DDNLive from '../../dist/ddn.mjs';
const w = DDNLive.createWorkspace({'main.ddn': 'ddn "0.5"; module "test";'});
const options = { endpointOrdering: 'optimize' as const };
w.renderSync({entry: 'main.ddn', view: 'overview', overrides: options});
