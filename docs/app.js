import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { governance, proposal, participants as seed } from './demo-data.js';
import { project, groupFor, publicProjection, meetsThreshold } from './core.js';

const state = {
  participants: structuredClone(seed),
  threshold: governance.minimumWalletQbio,
  anonymousMultiplier: 0.5,
  wallet: null,
  chainId: null,
  etherscan: null,
  events: [
    { layer: 'ON-CHAIN', text: `ProposalPosted(${proposal.id}, documentURI) · initial projection calculated from dormant-NO rules.` },
    { layer: 'ETHERSCAN', text: 'Static Etherscan snapshot not loaded yet.' }
  ]
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const pct = (n) => `${fmt(n)}%`;
const short = (v) => v && v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)}` : (v || '—');

function stats() {
  return project(state.participants, {
    threshold: state.threshold,
    anonymousMultiplier: state.anonymousMultiplier
  });
}

function explorerUrl(path) {
  const base = state.etherscan?.explorerBase || 'https://sepolia.etherscan.io';
  return `${base}${path}`;
}

function percentOf(value, total) {
  return total > 0 ? 100 * value / total : 0;
}

function conicGradient(segments, total) {
  const palette = {
    certifiedYes: 'var(--cert-yes)',
    certifiedNo: 'var(--cert-no)',
    anonymousYesCounted: 'var(--anon-yes)',
    anonymousNoCounted: 'var(--anon-no)',
    anonymousDiscounted: 'var(--discounted)'
  };

  let cursor = 0;
  const stops = [];
  for (const [key, value] of Object.entries(segments)) {
    if (value <= 0 || total <= 0) continue;
    const start = cursor;
    cursor += 100 * value / total;
    stops.push(`${palette[key]} ${start}% ${cursor}%`);
  }
  if (cursor < 100) stops.push(`var(--discounted) ${cursor}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

function renderEtherscan() {
  const data = state.etherscan;
  if (!data) return;

  $('chainIdValue').textContent = data.chainId || '—';
  $('daoAddressValue').textContent = short(data.daoAddress);
  $('contractAddressValue').textContent = short(data.contractAddress);
  $('sourceStatus').textContent = data.source?.verified ? 'Verified' : (data.contractAddress ? 'Not verified / unknown' : 'Awaiting deployment');
  $('compilerValue').textContent = data.source?.compilerVersion || '—';

  const daoLink = $('daoEtherscanLink');
  const contractLink = $('contractEtherscanLink');
  const writeLink = $('writeContractLink');

  if (data.daoAddress) {
    daoLink.href = explorerUrl(`/address/${data.daoAddress}`);
    daoLink.classList.remove('disabled');
  } else {
    daoLink.removeAttribute('href');
    daoLink.classList.add('disabled');
  }

  if (data.contractAddress) {
    contractLink.href = explorerUrl(`/address/${data.contractAddress}#code`);
    writeLink.href = explorerUrl(`/address/${data.contractAddress}#writeContract`);
    contractLink.classList.remove('disabled');
    writeLink.classList.remove('disabled');
  } else {
    contractLink.removeAttribute('href');
    writeLink.removeAttribute('href');
    contractLink.classList.add('disabled');
    writeLink.classList.add('disabled');
  }

  $('etherscanTxRows').innerHTML = (data.recentTransactions || []).length
    ? data.recentTransactions.map(tx => `
      <tr>
        <td><a class="txlink" target="_blank" rel="noreferrer" href="${explorerUrl(`/tx/${tx.hash}`)}">${short(tx.hash)}</a></td>
        <td>${tx.functionName || tx.methodId || 'transaction'}</td>
        <td>${tx.status || '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="muted">No Etherscan snapshot yet. Run the Python render command after deployment.</td></tr>';
}

function renderProjectionVisual(s) {
  $('circulatingPowerValue').textContent = `≈${compact(governance.circulatingVotingPower)} QBIO`;
  $('totalSupplyValue').textContent = compact(governance.totalSupply);
  $('effectiveYesPower').textContent = `${compact(s.effective.yes)} QBIO`;
  $('effectiveNoPower').textContent = `${compact(s.effective.noWithDormant)} QBIO`;
  $('explicitSummaryPower').textContent = `${compact(s.explicitVotingPower)} QBIO`;
  $('countedPowerValue').textContent = `${compact(s.effective.totalCounted)} QBIO`;
  $('discountedAnonymousPower').textContent = `${compact(s.effective.discountedAnonymous)} QBIO`;

  const yesPct = percentOf(s.effective.yes, s.effective.totalCounted);
  const noPct = percentOf(s.effective.noWithDormant, s.effective.totalCounted);
  $('yesShareValue').textContent = pct(yesPct);
  $('noShareValue').textContent = pct(noPct);

  const donut = $('powerDonut');
  donut.style.background = conicGradient(s.chart, s.totalVotingPower);
  donut.setAttribute('aria-label', `Voting power composition: ${yesPct.toFixed(1)} percent effective YES and ${noPct.toFixed(1)} percent effective NO among counted power.`);

  $('legendCertifiedYes').textContent = compact(s.chart.certifiedYes);
  $('legendCertifiedNo').textContent = compact(s.chart.certifiedNo);
  $('legendAnonymousYes').textContent = compact(s.chart.anonymousYesCounted);
  $('legendAnonymousNo').textContent = compact(s.chart.anonymousNoCounted);
  $('legendDiscounted').textContent = compact(s.chart.anonymousDiscounted);

  const referenceDelta = s.totalVotingPower - governance.circulatingVotingPower;
  $('referenceCheck').textContent = Math.abs(referenceDelta) < 1
    ? 'Synthetic eligible rows = 400M reference voting power.'
    : `Synthetic rows differ from the 400M reference by ${compact(referenceDelta)} QBIO.`;
}

function render() {
  const s = stats();
  const publicState = publicProjection(s);

  $('proposalTitle').textContent = proposal.title;
  $('proposalDescription').textContent = proposal.description;
  $('proposalId').textContent = `#${proposal.id}`;
  $('proposalDoc').href = proposal.documentUrl;

  $('winnerValue').textContent = publicState.winner.toUpperCase();
  $('winnerValue').dataset.winner = publicState.winner;

  const disclose = publicState.participationBps !== null;
  $('participationDisclosure').hidden = !disclose;
  $('discussionWaiting').hidden = disclose;
  if (disclose) {
    const p = publicState.participationBps / 100;
    $('participationValue').textContent = pct(p);
    $('participationBar').style.width = `${p}%`;
  }

  $('certifiedCount').textContent = s.groups.certified;
  $('anonymousCount').textContent = s.groups.anonymous;
  $('absentCount').textContent = s.groups.absent;
  $('eligiblePower').textContent = `${fmt(s.totalVotingPower)} QBIO`;
  $('explicitPower').textContent = `${fmt(s.explicitVotingPower)} QBIO`;
  $('excludedCount').textContent = s.excludedCount;
  $('multiplierValue').textContent = `${Math.round(state.anonymousMultiplier * 100)}%`;

  renderProjectionVisual(s);

  $('participantRows').innerHTML = state.participants.map((p, i) => {
    const eligible = meetsThreshold(p, state.threshold);
    const group = groupFor(p, state.threshold);
    const groupLabel = eligible ? group : 'excluded';
    const intention = p.intention === 'none' ? '—' : p.intention.toUpperCase();
    const effectiveWeight = eligible ? p.qbio * (p.certified ? 1 : state.anonymousMultiplier) : 0;

    return `<tr class="${eligible ? '' : 'excludedRow'}">
      <td>${p.username}</td>
      <td>${fmt(p.qbio)}</td>
      <td><span class="pill ${groupLabel}">${groupLabel}</span></td>
      <td>${intention}</td>
      <td>${eligible ? compact(effectiveWeight) : '—'}</td>
      <td>${p.commented ? 'yes' : 'no'}</td>
      <td class="actionCell">
        <button class="mini" data-act="yes" data-i="${i}">YES</button>
        <button class="mini" data-act="no" data-i="${i}">NO</button>
        <button class="mini secondary" data-act="absent" data-i="${i}">ABSENT</button>
        <button class="mini secondary" data-act="comment" data-i="${i}" ${p.commented ? 'disabled' : ''}>COMMENT</button>
      </td>
    </tr>`;
  }).join('');

  $('eventLog').innerHTML = state.events.slice().reverse().map(e =>
    `<div class="event"><span>${e.layer}</span>${e.text}</div>`
  ).join('');

  renderEtherscan();
}

function publishAggregateDiff(before, after, reason) {
  if (before.winner !== after.winner) {
    state.events.push({
      layer: 'ON-CHAIN',
      text: `publishWinner(${proposal.id}, ${after.winner === 'yes'}) · aggregate changed to ${after.winner.toUpperCase()} (${reason}).`
    });
  }

  if (after.hasDiscussion) {
    const firstDisclosure = !before.hasDiscussion;
    const participationChanged = before.participationBps !== after.participationBps;
    if (firstDisclosure || participationChanged) {
      state.events.push({
        layer: 'ON-CHAIN',
        text: `publishDiscussionParticipation(${proposal.id}, ${after.participationBps}) · ${(after.participationBps / 100).toFixed(2)}% explicit nominal voting power.`
      });
    }
  }
}

async function loadEtherscanSnapshot() {
  try {
    const response = await fetch('./etherscan-data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.etherscan = await response.json();
    const count = state.etherscan.recentTransactions?.length || 0;
    state.events.push({
      layer: 'ETHERSCAN',
      text: state.etherscan.mode === 'etherscan'
        ? `Rendered Python snapshot: ${count} recent DAO transaction(s).`
        : 'Demo snapshot loaded; run scripts/etherscan_bridge.py render to replace it with Etherscan data.'
    });
  } catch (err) {
    state.events.push({ layer: 'ETHERSCAN', text: `Snapshot unavailable: ${err.message}` });
  }
  render();
}

async function connectWallet() {
  if (!window.ethereum) {
    state.events.push({ layer: 'WALLET', text: 'No injected EVM wallet detected; demo remains readable.' });
    render();
    return;
  }
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    state.wallet = await signer.getAddress();
    const network = await provider.getNetwork();
    state.chainId = Number(network.chainId);
    $('walletStatus').textContent = `${state.wallet.slice(0, 6)}…${state.wallet.slice(-4)} · chain ${state.chainId}`;
    state.events.push({ layer: 'WALLET', text: 'Wallet connected for registration/bootstrap demo. No vote transaction was sent.' });
  } catch (err) {
    state.events.push({ layer: 'WALLET', text: `Connection cancelled or failed: ${err.shortMessage || err.message}` });
  }
  render();
}

function setIntention(index, intention) {
  const before = stats();
  const p = state.participants[index];
  const previous = p.intention;
  p.intention = intention;
  const after = stats();

  state.events.push({ layer: 'LOCAL', text: `${p.username}: ${previous.toUpperCase()} → ${intention.toUpperCase()}. No per-address vote is published.` });
  publishAggregateDiff(before, after, 'private intention update');
  render();
}

function addComment(index) {
  const p = state.participants[index];
  if (p.commented) return;
  const before = stats();
  p.commented = true;
  const after = stats();

  state.events.push({ layer: 'FORUM', text: `${p.username}: first/local comment marker added. Comment does not itself change the vote intention.` });
  publishAggregateDiff(before, after, 'discussion started');
  render();
}

function setAnonymousMultiplier(value) {
  const before = stats();
  state.anonymousMultiplier = value;
  const after = stats();
  state.events.push({ layer: 'LOCAL', text: `Anonymous weight → ${Math.round(value * 100)}%. At 0%, only certified researcher/member power affects the winner.` });
  publishAggregateDiff(before, after, 'anonymous rebalance parameter changed');
  render();
}

$('connectWallet').addEventListener('click', connectWallet);
$('anonymousMultiplier').addEventListener('input', (e) => {
  setAnonymousMultiplier(Number(e.target.value) / 100);
});
$('participantRows').addEventListener('click', (e) => {
  const action = e.target.dataset.act;
  if (!action) return;
  const index = Number(e.target.dataset.i);
  if (action === 'comment') addComment(index);
  else setIntention(index, action === 'absent' ? 'none' : action);
});

render();
loadEtherscanSnapshot();
