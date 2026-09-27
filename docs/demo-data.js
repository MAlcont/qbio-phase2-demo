export const proposal = {
  id: 42,
  phase1Ref: 'Phase 1 / manual DAO intake',
  title: 'QBIO Phase-2 deliberation demo',
  documentUrl: 'https://docs.google.com/',
  description: 'Soft deliberation before the final Snapshot vote. Individual intentions remain local/private in this demo; the public contract receives only the aggregate winner and, after a comment exists, aggregate participation weight.'
};

// Synthetic local test data. These rows are NOT intended to be published by the live forum.
// qbio < 10,000 is excluded from the voting body entirely.
export const participants = [
  { username: 'researcher-01', certified: true,  qbio: 42000, intention: 'yes',  commented: false },
  { username: 'researcher-02', certified: true,  qbio: 18000, intention: 'yes',  commented: false },
  { username: 'researcher-03', certified: true,  qbio: 27000, intention: 'no',   commented: false },
  { username: 'member-04',     certified: false, qbio: 33000, intention: 'yes',  commented: false },
  { username: 'member-05',     certified: false, qbio: 12000, intention: 'no',   commented: false },
  { username: 'observer-06',   certified: true,  qbio: 21000, intention: 'none', commented: false },
  { username: 'observer-07',   certified: false, qbio: 8000,  intention: 'none', commented: false },
  { username: 'member-08',     certified: true,  qbio: 9500,  intention: 'yes',  commented: false },
  { username: 'observer-09',   certified: true,  qbio: 31000, intention: 'none', commented: false },
  { username: 'observer-10',   certified: false, qbio: 16000, intention: 'none', commented: false }
];
