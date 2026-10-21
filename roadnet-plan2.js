// roadnet-plan2.js — генераторът на градове (cityplan2.js, plan2) → пътната мрежа (roadnet.js). Улиците, възлите и кръговите на плана
// стават сегменти и възли на мрежата с ТОЧНИТЕ ширини на плана (ленти, ширина на лента, разделителна ивица, тротоар) — парцелите не
// се местят; кръговото пази своя радиус. После всичко (изглед, ленти, светофари, тротоари, проверки) идва от мрежата.
// planToRoadNet(P, opts) → { net, dirty } (dirty — за net.update)
import { createRoadNet } from './roadnet.js';

// класът на мрежата по профила на улицата от плана
const clsOf = rd => rd.median ? 'blvd' : (rd.lanes[0] > 1 || rd.lanes[1] > 1) ? 'avenue' : 'street';
export function planToRoadNet(P, opts = {}) {
  const net = createRoadNet({ drive: P.drive === 'L' ? 'L' : 'R', obstacles: opts.obstacles || [] });
  const used = new Set(); for (const rd of P.roads) { used.add(rd.from); used.add(rd.to); }
  const nodes = P.nodes.filter(n => used.has(n.id)).map(n => { const R = n.kind === 'round' ? (P.rounds || []).find(r => r.node === n.id) : null; return { key: n.id, x: n.x, z: n.z, tpl: R ? 'round' : null, roundOuter: R ? R.outer : null }; });
  const segs = P.roads.map(rd => ({ a: rd.from, b: rd.to, pts: rd.pts, cls: clsOf(rd), lanes: rd.oneway ? rd.lanes : rd.lanes, laneW: rd.laneW, median: rd.median || 0, walk: rd.walk, w: rd.w, noCars: !!rd.noCars, nm: rd.nm || '' }));
  const dirty = net.importGraph({ nodes, segs });
  return { net, dirty };
}
