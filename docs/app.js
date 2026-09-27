import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { proposal, participants as seed } from './demo-data.js';
import { project, groupFor, publicProjection, meetsThreshold } from './core.js';

const state = {
  participants: structuredClone(seed),
  threshold: 10_000,
  anonymousMultiplier: 0.5,
  wallet: null,
  chainId: null,
  etherscan: null,
  events: [
    { layer: 'ON-CHAIN', text: `ProposalPosted(${proposal.id}, documentURI) · initial winner NO (dormant default).` },
    { layer: 'ETHERSCAN', text: 'Static Etherscan snapshot not loaded yet.' }
  ]
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
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

  $('participantRows').innerHTML = state.participants.map((p, i) => {
    const eligible = meetsThreshold(p, state.threshold);
    const group = groupFor(p, state.threshold);
    const groupLabel = eligible ? group : 'excluded';
    const intention = p.intention === 'none' ? '—' : p.intention.toUpperCase();
    return `<tr class="${eligible ? '' : 'excludedRow'}">
      <td>${p.username}</td>
      <td>${fmt(p.qbio)}</td>
      <td><span class="pill ${groupLabel}">${groupLabel}</span></td>
      <td>${intention}</td>
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
        text: `publishDiscussionParticipation(${proposal.id}, ${after.participationBps}) · ${(after.participationBps / 100).toFixed(2)}% explicit voting power.`
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
    state.events.push({ layer: 'WALLET', text: 'MetaMask/EIP-1193 wallet connected. No vote transaction was sent.' });
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

  state.events.push({
    layer: 'LOCAL',
    text: `${p.username}: ${previous.toUpperCase()} → ${intention.toUpperCase()}. No per-address vote is published.`
  });
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
  state.events.push({ layer: 'LOCAL', text: `Anonymous demo coefficient → ${Math.round(value * 100)}%. This is a modelling parameter, not a live voter action.` });
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
