/* SPDX-License-Identifier: GPL-2.0-or-later
 * Direct-source wiring (B1-019): importing this module evaluates every runtime
 * module and registers every projection renderer on the engine, mirroring what
 * the ddn.global.js bundle does. Node tooling and test suites that consume the
 * sources directly (instead of dist) import this for a fully wired engine.
 */
import './ddn-core.js';
import './ddn-render.js';
import Interaction from './ddn-interaction.js';
import Projections from './ddn-projections.js';
import './ddn-quality-render.js';
import Engine from './ddn-engine.js';
Engine.registerProjectionRenderer('graph', Interaction.render);
for (const k of ['chart', 'matrix', 'panels', 'timeline', 'table', 'sequence', 'timing', 'chen', 'fishbone', 'decision'])
  Engine.registerProjectionRenderer(k, Projections.render);
export default Engine;
