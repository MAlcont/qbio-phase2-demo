// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockQBIO {
    string public constant name = "Mock QBIO";
    string public constant symbol = "QBIO";
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}
