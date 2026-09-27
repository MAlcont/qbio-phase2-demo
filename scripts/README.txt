Etherscan test/render harness
============================

The Python script in this directory is NOT a 2FA or voting backend and is not
served by GitHub Pages. Individual vote intentions are not read from Etherscan.

The contract publishes only aggregate Phase-2 state:

    publishWinner(proposalId, yesWins)

and, after discussion begins:

    publishDiscussionParticipation(proposalId, participationBps)

1. Dry-run the exact source/compiler payload sent to Etherscan:

   python3 scripts/etherscan_bridge.py dry-run

2. After deployment, render public Etherscan data into the static site:

   export ETHERSCAN_API_KEY=...
   export DAO_ADDRESS=0x...
   export CONTRACT_ADDRESS=0x...
   export CHAIN_ID=11155111
   python3 scripts/etherscan_bridge.py render

   This writes docs/etherscan-data.json. Commit that file and GitHub Pages will
   render the DAO address, registry address, verification metadata, and recent
   DAO transactions without exposing the API key.

3. Ask Etherscan to compile and verify Phase2Registry against deployed bytecode:

   export CONSTRUCTOR_ARGS=<ABI encoded args, no 0x prefix>
   python3 scripts/etherscan_bridge.py verify

   Etherscan recompiles the submitted Standard JSON source and checks that it
   matches the bytecode already deployed on-chain.

4. Tests:

   python3 -m unittest -v tests/test_etherscan.py
   node tests/core.test.mjs

   For a live verification integration test:

   export RUN_ETHERSCAN_LIVE=1
   export ETHERSCAN_API_KEY=...
   export CONTRACT_ADDRESS=0x...
   export CONSTRUCTOR_ARGS=...
   python3 -m unittest -v tests/test_etherscan.py

DAO publishing through Etherscan
--------------------------------

Once the registry is verified, Etherscan exposes Write Contract. An EOA
configured as `dao` can connect and call postProposal / publishWinner /
publishDiscussionParticipation. If `dao` is a Safe/multisig contract, the Safe
must execute the call; a signer EOA cannot impersonate the Safe as msg.sender.
