export const GROUP = Object.freeze({
  CERTIFIED: 'certified',
  ANONYMOUS: 'anonymous',
  ABSENT: 'absent'
});

export const VOTE = Object.freeze({
  YES: 'yes',
  NO: 'no',
  NONE: 'none'
});

export function meetsThreshold(person, threshold = 10_000) {
  return Number(person.qbio || 0) >= threshold;
}

// Only wallets above the QBIO threshold are part of the voting body.
// Inside that body, no intention means ABSENT/DORMANT; otherwise identity
// certification distinguishes CERTIFIED from ANONYMOUS participation.
export function groupFor(person, threshold = 10_000) {
  if (!meetsThreshold(person, threshold)) return null;
  if (!person.intention || person.intention === VOTE.NONE) return GROUP.ABSENT;
  return person.certified ? GROUP.CERTIFIED : GROUP.ANONYMOUS;
}

export function project(participants, {
  threshold = 10_000,
  anonymousMultiplier = 0.5
} = {}) {
  const out = {
    eligibleCount: 0,
    excludedCount: 0,
    groups: { certified: 0, anonymous: 0, absent: 0 },
    totalVotingPower: 0,
    explicitVotingPower: 0,
    dormantVotingPower: 0,
    effective: { yes: 0, noExplicit: 0, noWithDormant: 0 },
    winner: VOTE.NO,
    participationPct: 0,
    participationBps: 0,
    hasDiscussion: participants.some(p => Boolean(p.commented))
  };

  for (const p of participants) {
    const qbio = Number(p.qbio || 0);
    if (!meetsThreshold(p, threshold)) {
      out.excludedCount += 1;
      continue;
    }

    out.eligibleCount += 1;
    out.totalVotingPower += qbio;

    const group = groupFor(p, threshold);
    out.groups[group] += 1;
    const intention = p.intention || VOTE.NONE;

    if (intention === VOTE.NONE) {
      // Dormant/absent is the governance default: NO.
      out.dormantVotingPower += qbio;
      continue;
    }

    out.explicitVotingPower += qbio;
    const factor = group === GROUP.ANONYMOUS ? anonymousMultiplier : 1;
    const effectiveWeight = qbio * factor;

    if (intention === VOTE.YES) out.effective.yes += effectiveWeight;
    else if (intention === VOTE.NO) out.effective.noExplicit += effectiveWeight;
  }

  out.effective.noWithDormant = out.effective.noExplicit + out.dormantVotingPower;

  // Tie remains NO because NO is also the dormant/default state.
  out.winner = out.effective.yes > out.effective.noWithDormant ? VOTE.YES : VOTE.NO;

  if (out.totalVotingPower > 0) {
    out.participationPct = 100 * out.explicitVotingPower / out.totalVotingPower;
    out.participationBps = Math.round(10_000 * out.explicitVotingPower / out.totalVotingPower);
  }

  return out;
}

export function publicProjection(stats) {
  return {
    winner: stats.winner,
    participationBps: stats.hasDiscussion ? stats.participationBps : null
  };
}
