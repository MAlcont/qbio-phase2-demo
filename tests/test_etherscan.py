"""Tests for the Etherscan verification/render bridge.

The normal test suite is offline and verifies the exact Standard JSON payload.
A live integration test is enabled only when RUN_ETHERSCAN_LIVE=1 and the
required Etherscan/deployment environment variables are present.
"""
import importlib.util
import json
import os
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "etherscan_bridge", ROOT / "scripts" / "etherscan_bridge.py"
)
bridge = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(bridge)


class PayloadTests(unittest.TestCase):
    def test_standard_json_targets_solidity_0824_source(self):
        payload = bridge.standard_json_input()
        self.assertEqual(payload["language"], "Solidity")
        self.assertIn("contracts/Phase2Registry.sol", payload["sources"])
        source = payload["sources"]["contracts/Phase2Registry.sol"]["content"]
        self.assertIn("pragma solidity ^0.8.24;", source)
        self.assertIn("contract Phase2Registry", source)
        self.assertIn("function publishWinner", source)
        self.assertIn("function publishDiscussionParticipation", source)
        self.assertNotIn("mapping(address => Vote)", source)
        self.assertNotIn("VoteChanged", source)
        self.assertFalse(payload["settings"]["optimizer"]["enabled"])
        self.assertEqual(payload["settings"]["optimizer"]["runs"], 200)

    def test_verification_body_uses_standard_json(self):
        cfg = {
            "contract_address": "0x" + "12" * 20,
            "contract_name": bridge.DEFAULT_CONTRACT_NAME,
            "compiler_version": bridge.DEFAULT_COMPILER_VERSION,
            "constructor_args": "abcd",
        }
        body = bridge.verification_body(cfg)
        self.assertEqual(body["codeformat"], "solidity-standard-json-input")
        self.assertEqual(body["compilerversion"], "v0.8.24+commit.e11b9ed9")
        self.assertEqual(body["licenseType"], "3")
        decoded = json.loads(body["sourceCode"])
        self.assertEqual(decoded["language"], "Solidity")


@unittest.skipUnless(os.getenv("RUN_ETHERSCAN_LIVE") == "1", "live Etherscan test disabled")
class LiveEtherscanVerificationTest(unittest.TestCase):
    def test_etherscan_compiles_and_matches_deployed_contract(self):
        cfg = bridge.config_from_env()
        bridge.require(cfg["api_key"], "ETHERSCAN_API_KEY")
        bridge.require(cfg["contract_address"], "CONTRACT_ADDRESS")
        result = bridge.verify(cfg)
        self.assertIn(result["status"], {"verified", "already-verified"})
        source = result.get("source") or bridge.get_source_metadata(cfg)
        self.assertTrue(source and source.get("verified"))
        self.assertEqual(source.get("compilerVersion"), cfg["compiler_version"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
