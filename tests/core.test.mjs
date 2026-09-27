import assert from 'node:assert/strict';
import { groupFor, project, publicProjection } from '../docs/core.js';

assert.equal(groupFor({ certified:true, qbio:12000, intention:'none' }, 10000), 'absent');
assert.equal(groupFor({ certified:true, qbio:12000, intention:'yes' }, 10000), 'certified');
assert.equal(groupFor({ certified:false, qbio:50000, intention:'no' }, 10000), 'anonymous');
assert.equal(groupFor({ certified:true, qbio:9000, intention:'yes' }, 10000), null);

const dormantNo = project([
  { certified:true, qbio:20000, intention:'yes', commented:false },
  { certified:false, qbio:20000, intention:'no', commented:false },
  { certified:true, qbio:30000, intention:'none', commented:false }
], { threshold:10000, anonymousMultiplier:0.5 });

assert.deepEqual(dormantNo.groups, { certified:1, anonymous:1, absent:1 });
assert.equal(dormantNo.totalVotingPower, 70000);
assert.equal(dormantNo.explicitVotingPower, 40000);
assert.equal(dormantNo.effective.yes, 20000);
assert.equal(dormantNo.effective.noExplicit, 10000);
assert.equal(dormantNo.effective.noWithDormant, 40000);
assert.equal(dormantNo.winner, 'no');
assert.equal(publicProjection(dormantNo).participationBps, null);

const discussed = project([
  { certified:true, qbio:60000, intention:'yes', commented:true },
  { certified:false, qbio:20000, intention:'no', commented:false },
  { certified:true, qbio:20000, intention:'none', commented:false },
  { certified:true, qbio:9000, intention:'yes', commented:false }
], { threshold:10000, anonymousMultiplier:0.5 });

assert.equal(discussed.excludedCount, 1);
assert.equal(discussed.totalVotingPower, 100000);
assert.equal(discussed.explicitVotingPower, 80000);
assert.equal(discussed.participationBps, 8000);
assert.equal(discussed.winner, 'yes');
assert.deepEqual(publicProjection(discussed), { winner:'yes', participationBps:8000 });

console.log('core tests: OK');
