#!/usr/bin/env python3
"""Etherscan bridge for the QBIO Phase-2 static demo.

This is NOT an authentication backend. It has two jobs:

1. ``render``: query Etherscan V2 for the DAO transaction history and the
   deployed registry verification metadata, then write a static
   ``docs/etherscan-data.json`` file consumed by GitHub Pages.
2. ``verify``: submit the Solidity Standard JSON source to Etherscan, let
   Etherscan compile it, and poll until the deployed bytecode is verified.

Typical Sepolia usage:

  export ETHERSCAN_API_KEY=...
  export DAO_ADDRESS=0x...
  export CONTRACT_ADDRESS=0x...
  python3 scripts/etherscan_bridge.py render

After deploying Phase2Registry:

  export CONSTRUCTOR_ARGS=<abi-encoded args without 0x>
  python3 scripts/etherscan_bridge.py verify

The script uses only the Python standard library.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "Phase2Registry.sol"
OUTPUT_PATH = ROOT / "docs" / "etherscan-data.json"
API_URL = "https://api.etherscan.io/v2/api"

DEFAULT_CHAIN_ID = "11155111"  # Sepolia
DEFAULT_COMPILER_VERSION = "v0.8.24+commit.e11b9ed9"
DEFAULT_CONTRACT_NAME = "contracts/Phase2Registry.sol:Phase2Registry"
DEFAULT_RUNS = 200

EXPLORERS = {
    "1": "https://etherscan.io",
    "11155111": "https://sepolia.etherscan.io",
}


def config_from_env() -> dict:
    chain_id = os.getenv("CHAIN_ID", DEFAULT_CHAIN_ID)
    return {
        "api_key": os.getenv("ETHERSCAN_API_KEY", ""),
        "chain_id": chain_id,
        "dao_address": os.getenv("DAO_ADDRESS", ""),
        "contract_address": os.getenv("CONTRACT_ADDRESS", ""),
        "compiler_version": os.getenv("COMPILER_VERSION", DEFAULT_COMPILER_VERSION),
        "contract_name": os.getenv("CONTRACT_NAME", DEFAULT_CONTRACT_NAME),
        "constructor_args": os.getenv("CONSTRUCTOR_ARGS", "").removeprefix("0x"),
        "explorer_base": os.getenv("EXPLORER_BASE", EXPLORERS.get(chain_id, "https://etherscan.io")),
    }


def require(value: str, name: str) -> str:
    if not value:
        raise SystemExit(f"Missing {name}. Set it as an environment variable.")
    return value


def _request(params: dict, body: dict | None = None) -> dict:
    """Call Etherscan V2 and return decoded JSON."""
    query = urlencode(params)
    url = f"{API_URL}?{query}"
    data = urlencode(body).encode() if body is not None else None
    req = Request(url, data=data)
    if body is not None:
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"Etherscan request failed: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Unexpected Etherscan response")
    return payload


def api_params(cfg: dict, module: str, action: str, **extra) -> dict:
    return {
        "apikey": require(cfg["api_key"], "ETHERSCAN_API_KEY"),
        "chainid": cfg["chain_id"],
        "module": module,
        "action": action,
        **extra,
    }


def standard_json_input() -> dict:
    """Exact Solidity Standard JSON source sent to Etherscan."""
    source = CONTRACT_PATH.read_text(encoding="utf-8")
    return {
        "language": "Solidity",
        "sources": {
            "contracts/Phase2Registry.sol": {"content": source},
        },
        "settings": {
            "optimizer": {"enabled": False, "runs": DEFAULT_RUNS},
            "outputSelection": {
                "*": {"*": ["abi", "evm.bytecode", "evm.deployedBytecode"]}
            },
        },
    }


def verification_body(cfg: dict) -> dict:
    return {
        "contractaddress": require(cfg["contract_address"], "CONTRACT_ADDRESS"),
        "sourceCode": json.dumps(standard_json_input(), separators=(",", ":")),
        "contractname": cfg["contract_name"],
        "compilerversion": cfg["compiler_version"],
        "codeformat": "solidity-standard-json-input",
        "constructorArguments": cfg["constructor_args"],
        "evmVersion": "default",
        "licenseType": "3",  # MIT
    }


def get_source_metadata(cfg: dict) -> dict | None:
    if not cfg["contract_address"]:
        return None
    payload = _request(api_params(
        cfg, "contract", "getsourcecode", address=cfg["contract_address"]
    ))
    result = payload.get("result")
    if not isinstance(result, list) or not result:
        return None
    item = result[0]
    source = item.get("SourceCode", "")
    verified = bool(source and source != "Contract source code not verified")
    return {
        "verified": verified,
        "contractName": item.get("ContractName", ""),
        "compilerVersion": item.get("CompilerVersion", ""),
        "optimizationUsed": item.get("OptimizationUsed", ""),
        "runs": item.get("Runs", ""),
        "licenseType": item.get("LicenseType", ""),
    }


def get_dao_transactions(cfg: dict, limit: int = 10) -> list[dict]:
    dao = require(cfg["dao_address"], "DAO_ADDRESS")
    payload = _request(api_params(
        cfg,
        "account",
        "txlist",
        address=dao,
        startblock=0,
        endblock=99999999,
        page=1,
        offset=limit,
        sort="desc",
    ))
    result = payload.get("result", [])
    if not isinstance(result, list):
        return []
    out = []
    for tx in result[:limit]:
        out.append({
            "hash": tx.get("hash", ""),
            "from": tx.get("from", ""),
            "to": tx.get("to", ""),
            "functionName": tx.get("functionName", ""),
            "methodId": tx.get("methodId", ""),
            "timeStamp": tx.get("timeStamp", ""),
            "status": "success" if tx.get("isError") == "0" else "error",
        })
    return out


def render(cfg: dict, output: Path = OUTPUT_PATH) -> dict:
    """Materialize an Etherscan snapshot for the static GitHub Pages UI."""
    txs = get_dao_transactions(cfg)
    source = get_source_metadata(cfg)
    data = {
        "mode": "etherscan",
        "generatedAt": int(time.time()),
        "chainId": cfg["chain_id"],
        "explorerBase": cfg["explorer_base"],
        "daoAddress": cfg["dao_address"],
        "contractAddress": cfg["contract_address"],
        "source": source,
        "recentTransactions": txs,
        "note": "Generated by scripts/etherscan_bridge.py; no API key is shipped to GitHub Pages.",
    }
    output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return data


def submit_verification(cfg: dict) -> str:
    payload = _request(
        api_params(cfg, "contract", "verifysourcecode"),
        verification_body(cfg),
    )
    result = str(payload.get("result", ""))
    if payload.get("status") != "1":
        # Already-verified contracts may be returned as a non-success submission.
        if "already verified" in result.lower():
            return "ALREADY_VERIFIED"
        raise RuntimeError(f"Verification submission failed: {payload}")
    return result


def check_verification_guid(cfg: dict, guid: str) -> str:
    payload = _request(api_params(
        cfg, "contract", "checkverifystatus", guid=guid
    ))
    return str(payload.get("result", ""))


def verify(cfg: dict, timeout_seconds: int = 90, poll_seconds: int = 5) -> dict:
    """Ask Etherscan to compile the source and match it to deployed bytecode."""
    require(cfg["api_key"], "ETHERSCAN_API_KEY")
    require(cfg["contract_address"], "CONTRACT_ADDRESS")

    # If already verified, avoid a redundant submission and validate metadata.
    existing = get_source_metadata(cfg)
    if existing and existing.get("verified"):
        return {"status": "already-verified", "source": existing}

    guid = submit_verification(cfg)
    if guid == "ALREADY_VERIFIED":
        return {"status": "already-verified", "source": get_source_metadata(cfg)}

    deadline = time.time() + timeout_seconds
    last = "Pending in queue"
    while time.time() < deadline:
        last = check_verification_guid(cfg, guid)
        low = last.lower()
        if "pass - verified" in low:
            return {"status": "verified", "guid": guid, "result": last, "source": get_source_metadata(cfg)}
        if "pending" not in low and "queue" not in low:
            raise RuntimeError(f"Etherscan compilation/verification failed: {last}")
        time.sleep(poll_seconds)
    raise TimeoutError(f"Etherscan verification still pending after {timeout_seconds}s: {last}")


def dry_run(cfg: dict) -> dict:
    """Show the exact compiler/source payload without exposing the API key."""
    return {
        "chainid": cfg["chain_id"],
        "contractaddress": cfg["contract_address"] or "<CONTRACT_ADDRESS>",
        "contractname": cfg["contract_name"],
        "compilerversion": cfg["compiler_version"],
        "codeformat": "solidity-standard-json-input",
        "constructorArguments": cfg["constructor_args"] or "<ABI_ENCODED_CONSTRUCTOR_ARGS>",
        "sourceCode": standard_json_input(),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["render", "verify", "check", "dry-run"])
    args = parser.parse_args(argv)
    cfg = config_from_env()

    if args.command == "render":
        print(json.dumps(render(cfg), indent=2))
    elif args.command == "verify":
        print(json.dumps(verify(cfg), indent=2))
        # Refresh the static render after a successful verification.
        if cfg["dao_address"]:
            render(cfg)
    elif args.command == "check":
        require(cfg["api_key"], "ETHERSCAN_API_KEY")
        require(cfg["contract_address"], "CONTRACT_ADDRESS")
        print(json.dumps(get_source_metadata(cfg), indent=2))
    else:
        print(json.dumps(dry_run(cfg), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
