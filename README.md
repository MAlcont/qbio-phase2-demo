# QBIO Phase-2 Governance Demo

Static GitHub Pages prototype for a soft Phase-2 deliberation step before the final Snapshot vote.

Python is **not** an authentication or voting backend in this revision. It is only an **Etherscan verification/render harness**.

## Current public-state rule

The live/public smart-contract state deliberately does **not** contain individual YES/NO intentions.

For each proposal the public Phase-2 state is limited to:

1. the current aggregate winner: `YES` or `NO`;
2. only after at least one forum comment exists, the percentage of total eligible QBIO voting power represented by explicit intentions.

A wallet can change its private/local intention without creating a per-address vote event. If a YES->NO or NO->YES change does not change the aggregate winner, the public contract needs no vote-related update at all.

Dormant/absent eligible voting power is projected as **NO by default**.

## Mathematical model in the demo

Let:

```text
T = total QBIO voting power held by wallets meeting the 10,000 QBIO threshold
E = raw QBIO voting power of wallets with an explicit YES or NO intention
Y = effective YES weight after the anonymous rebalance rule
N = effective explicit NO weight after the anonymous rebalance rule
D = dormant/absent eligible voting power
```

The public projection uses:

```text
projected YES = Y
projected NO  = N + D
winner        = YES only if projected YES > projected NO
               otherwise NO (including a tie)
```

After discussion begins, the disclosed participation figure is:

```text
participation = E / T
```

The participation numerator uses **raw eligible QBIO**, not the anonymous-rebalanced effective weight. That keeps the public percentage interpretable as “how much of the eligible voting power has expressed an intention”.

### Three groups

Only wallets meeting the QBIO threshold are part of the voting body. Inside that body:

- **Certified** — explicit YES/NO intention + certified identity.
- **Anonymous** — explicit YES/NO intention without identity certification.
- **Absent / dormant** — no explicit intention; projected as NO.

Wallets below 10,000 QBIO are excluded from the voting body and therefore are not a fourth voting group and do not enter the denominator `T`.

The exact anonymous rebalance formula is still open. The UI retains a visible demo multiplier so that this unresolved policy can be tested without hard-coding it into Solidity.

## Architecture

```text
                         private/local Phase-2 maths
                        (synthetic in this demo)
                                  |
              intention changes  |  aggregate result only
                                  v
DAO executor ----------------> Phase2Registry.sol --------> Ethereum / Sepolia
   |                              |                            |
   | postProposal                 | publishWinner              v
   |                              | publishDiscussion...   Etherscan
   |                              |                            |
   |                              |                   Python verify/render
   |                              |                            |
   +------------------------------+-------------> docs/etherscan-data.json
                                                            |
                                                            v
                                                       GitHub Pages
                                                            |
                                              winner + conditional %
```

The future forum can provide usernames and comments without publishing the username->wallet relationship in its public HTML. This repository does not yet implement that identity storage layer.

## Solidity interface relevant to Phase 2

The DAO manually promotes a proposal from Phase 1:

```solidity
postProposal(proposalId, documentURI)
```

A new proposal begins with `NO` as the public projection because all eligible voting power is initially dormant.

When the aggregate winner changes:

```solidity
publishWinner(proposalId, yesWins)
```

No voter address or vote is accepted by this function.

Once a forum comment exists, the DAO can start/update aggregate participation disclosure:

```solidity
publishDiscussionParticipation(proposalId, participationBps)
```

`participationBps = 5500` means 55.00% of eligible voting power has an explicit intention. This function also receives no voter address or individual choice.

Wallet certification remains separate from vote intention:

```solidity
certifyWallet(wallet, verifierRef)
isCertified(wallet)
meetsQbioThreshold(wallet)
```

The certification registry is retained because it was part of the initial design. Note that certification transactions themselves are public on Ethereum even though vote intentions are not.

## What the GitHub Pages demo shows

The public panel shows only:

```text
Current winner: YES / NO

[only after first comment]
Explicit intentions / eligible voting power: XX.XX%
```

The page also contains a clearly labelled **LOCAL TEST HARNESS** with synthetic users. It exists only to test the maths and state transitions. It is not the intended public forum output.

The test harness demonstrates:

- YES<->NO changes with no per-address on-chain publication;
- an aggregate `publishWinner` call only when the winner changes;
- first comment activating the participation disclosure;
- an absent wallet becoming explicit, which can change the disclosed participation percentage;
- certified / anonymous / absent grouping;
- threshold exclusion;
- the still-provisional anonymous rebalance coefficient.

## Etherscan and Python

Etherscan does not compile an undeployed contract as the deployment step. The flow is:

```text
compile/deploy -> submit source/settings to Etherscan -> Etherscan recompiles -> bytecode match
```

The Python script performs two jobs:

```bash
python3 scripts/etherscan_bridge.py verify
python3 scripts/etherscan_bridge.py render
```

`verify` submits the exact Solidity Standard JSON source/settings and polls Etherscan until verification succeeds or fails.

`render` reads public Etherscan data and writes:

```text
docs/etherscan-data.json
```

so the GitHub Pages site never needs an Etherscan API key.

## Repository layout

```text
contracts/
  Phase2Registry.sol       proposal + certification + aggregate projection state
  MockQBIO.sol             minimal balance token for test deployments

docs/
  index.html               GitHub Pages UI
  app.js                   local simulation + aggregate publication trace
  core.js                  deterministic projection maths
  demo-data.js             synthetic test data only
  etherscan-data.json      static/public Etherscan snapshot
  styles.css

scripts/
  etherscan_bridge.py      Etherscan V2 render + verification harness
  README.txt

tests/
  core.test.mjs            maths/state tests
  test_etherscan.py        verification-payload tests + optional live Etherscan test
```

## Run locally

```bash
python3 -m http.server 8000 -d docs
```

Open `http://localhost:8000`.

MetaMask is optional. Connecting it sends no vote transaction.

## Run tests

```bash
node tests/core.test.mjs
python3 -m unittest -v tests/test_etherscan.py
python3 scripts/etherscan_bridge.py dry-run
```

The ordinary Python test is offline. It verifies that the source sent to Etherscan contains the aggregate-only interface and uses the expected Standard JSON/compiler configuration.

## Live Etherscan verification

After deploying the registry, for example on Sepolia:

```bash
export ETHERSCAN_API_KEY=...
export CHAIN_ID=11155111
export DAO_ADDRESS=0x...
export CONTRACT_ADDRESS=0x...
export CONSTRUCTOR_ARGS=<ABI encoded constructor args without 0x>

python3 scripts/etherscan_bridge.py verify
python3 scripts/etherscan_bridge.py render
```

Defaults:

```text
compiler:      v0.8.24+commit.e11b9ed9
format:        solidity-standard-json-input
optimizer:     disabled
optimizerRuns: 200
license:       MIT
contract:      contracts/Phase2Registry.sol:Phase2Registry
```

To enable the live integration test:

```bash
export RUN_ETHERSCAN_LIVE=1
python3 -m unittest -v tests/test_etherscan.py
```

This requires a real deployed address and Etherscan API key.

## Where this revision differs from the first interpretation

The repository now intentionally rejects several earlier assumptions:

- There is **no per-address intention mapping in Solidity**.
- Head-to-head YES/NO percentages are **not public output**; only the current winner is.
- Participation percentage appears **only after discussion exists**.
- `Absent` is not merely a separate neutral bucket in the projection: its voting power is counted as default NO.
- The 10,000 QBIO threshold defines the voting body; certification is a separate identity property.
- Python is not a 2FA/runtime backend here; it verifies and renders Etherscan data.
- The 50% anonymous multiplier remains only a testing placeholder because the actual rebalance formula has not been specified.

A future privacy/identity implementation still has to decide how wallet intentions are authenticated without making the individual choice public. This demo keeps that layer synthetic rather than pretending an ordinary Ethereum transaction can be private.
