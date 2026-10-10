// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address agent = vm.envAddress("AGENT_ADDRESS");
        address merchant = vm.envAddress("MERCHANT_ADDRESS");

        vm.startBroadcast(deployerKey);

        AgentVault vault = new AgentVault();
        vault.setAgent(agent, 0.5 ether, 2 ether);
        vault.setMerchant(merchant, true);

        vm.stopBroadcast();

        console.log("AgentVault deployed at", address(vault));
    }
}
