export const governance = {
  // Prototype reference supplied for the demo; not a live on-chain supply query yet.
  circulatingVotingPower: 400_000_000,
  totalSupply: 1_000_000_000,
  minimumWalletQbio: 10_000
};

export const proposal = {
  id: 42,
  phase1Ref: 'Phase 1 / manual DAO intake',
  title: 'QBIO Phase-2 deliberation demo',
  documentUrl: 'https://docs.google.com/',
  description: 'Soft deliberation before the hard governance step on Commons/Snapshot. Individual intentions remain local/private in this demo; the public contract receives only the aggregate winner and, after a comment exists, aggregate participation weight.'
};

// Eligible synthetic rows sum to 400,000,000 QBIO so the visual can use the
// approximate current circulating voting-power reference.
// researcher-* = institutional route; member-* = identified; observer-* = unidentified.
export const participants = [
  { username: 'researcher-01',      certified: true,  qbio: 84_000_000, intention: 'yes',  commented: false },
  { username: 'researcher-02',      certified: true,  qbio: 36_000_000, intention: 'no',   commented: false },
  { username: 'researcher-03',      certified: true,  qbio: 54_000_000, intention: 'no',   commented: false },
  { username: 'member-04',          certified: true,  qbio: 66_000_000, intention: 'yes',  commented: false },
  { username: 'member-05',          certified: true,  qbio: 24_000_000, intention: 'no',   commented: false },
  { username: 'observer-06',        certified: false, qbio: 42_000_000, intention: 'no',   commented: false },
  { username: 'observer-09',        certified: false, qbio: 62_000_000, intention: 'none', commented: false },
  { username: 'observer-10',        certified: false, qbio: 32_000_000, intention: 'none', commented: false },

  // Test-only rows below the 10k threshold. They are outside the modeled 400M voting body.
  { username: 'below-threshold-07', certified: false, qbio: 8_000, intention: 'none', commented: false },
  { username: 'below-threshold-08', certified: true,  qbio: 9_500, intention: 'yes',  commented: false }
];
