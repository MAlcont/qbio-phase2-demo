export const proposal = {
  id: 42,
  phase1Ref: 'Phase 1 / manual DAO intake',
  title: 'QBIO Phase-2 deliberation demo',
  documentUrl: 'https://docs.google.com/',
  description: 'Soft deliberation before the hard governance step on Commons/Snapshot. Individual intentions remain local/private in this demo; the public contract receives only the aggregate winner and, after a comment exists, aggregate participation weight.'
};

// Synthetic local test data. These rows are NOT intended to be published by the live forum.
//
// Placeholder semantics used by the explanatory note:
//   researcher-*       -> institutional-identification route
//   member-*           -> identity verified + >= 10,000 QBIO
//   observer-*         -> unidentified + >= 10,000 QBIO
//   below-threshold-*  -> test-only rows excluded from the voting body
export const participants = [
  { username: 'researcher-01',      certified: true,  qbio: 42000, intention: 'yes',  commented: false },
  { username: 'researcher-02',      certified: true,  qbio: 18000, intention: 'yes',  commented: false },
  { username: 'researcher-03',      certified: true,  qbio: 27000, intention: 'no',   commented: false },
  { username: 'member-04',          certified: true,  qbio: 33000, intention: 'yes',  commented: false },
  { username: 'member-05',          certified: true,  qbio: 12000, intention: 'no',   commented: false },
  { username: 'observer-06',        certified: false, qbio: 21000, intention: 'no',   commented: false },
  { username: 'below-threshold-07', certified: false, qbio: 8000,  intention: 'none', commented: false },
  { username: 'below-threshold-08', certified: true,  qbio: 9500,  intention: 'yes',  commented: false },
  { username: 'observer-09',        certified: false, qbio: 31000, intention: 'none', commented: false },
  { username: 'observer-10',        certified: false, qbio: 16000, intention: 'none', commented: false }
];
