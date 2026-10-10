// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract AgentVaultTest is Test {
    AgentVault internal vault;
    address internal agent;
    address internal merchant;
    address internal stranger;

    uint256 internal constant PER_TX = 1 ether;
    uint256 internal constant DAILY = 2 ether;

    function setUp() public {
        vault = new AgentVault();
        agent = makeAddr("agent");
        merchant = makeAddr("merchant");
        stranger = makeAddr("stranger");
    }

    function test_approveSuccess() public {
        _activate();

        bytes32 ref = keccak256("ok");
        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentApproved(agent, merchant, PER_TX, ref);

        vm.prank(agent);
        bool ok = vault.authorize(merchant, PER_TX, ref);

        assertTrue(ok);
        assertTrue(vault.usedRef(ref));
        (,,, uint256 spentToday,) = vault.agents(agent);
        assertEq(spentToday, PER_TX);
        assertEq(vault.remainingToday(agent), DAILY - PER_TX);
    }

    function test_rejectAgentRevokedWhenNeverSet() public {
        bytes32 ref = keccak256("inactive");
        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentRejected(agent, merchant, 1, ref, "AGENT_REVOKED");

        vm.prank(agent);
        bool ok = vault.authorize(merchant, 1, ref);

        assertFalse(ok);
        assertFalse(vault.usedRef(ref));
    }

    function test_rejectRefAlreadyUsed() public {
        _activate();
        bytes32 ref = keccak256("once");

        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 0.4 ether, ref));

        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentRejected(agent, merchant, 0.4 ether, ref, "REF_ALREADY_USED");

        vm.prank(agent);
        bool ok = vault.authorize(merchant, 0.4 ether, ref);

        assertFalse(ok);
        (,,, uint256 spentToday,) = vault.agents(agent);
        assertEq(spentToday, 0.4 ether);
    }

    function test_rejectMerchantNotAllowed_andRetrySameRef() public {
        vault.setAgent(agent, PER_TX, DAILY);
        bytes32 ref = keccak256("retry");

        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentRejected(agent, merchant, 0.2 ether, ref, "MERCHANT_NOT_ALLOWED");

        vm.prank(agent);
        assertFalse(vault.authorize(merchant, 0.2 ether, ref));
        assertFalse(vault.usedRef(ref));

        vault.setMerchant(merchant, true);

        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentApproved(agent, merchant, 0.2 ether, ref);

        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 0.2 ether, ref));
        assertTrue(vault.usedRef(ref));
    }

    function test_rejectOverPerTxCap() public {
        _activate();
        bytes32 ref = keccak256("big");
        uint256 amount = PER_TX + 1;

        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentRejected(agent, merchant, amount, ref, "OVER_PER_TX_CAP");

        vm.prank(agent);
        bool ok = vault.authorize(merchant, amount, ref);

        assertFalse(ok);
        assertFalse(vault.usedRef(ref));
        (,,, uint256 spentToday,) = vault.agents(agent);
        assertEq(spentToday, 0);
    }

    function test_rejectOverDailyCap_thenResetAfterOneDay() public {
        // Per-payment cap is above the daily cap so the fifth check is the one that fails.
        vault.setAgent(agent, DAILY, DAILY);
        vault.setMerchant(merchant, true);

        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 1.5 ether, keccak256("first")));

        bytes32 blocked = keccak256("blocked");
        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentRejected(agent, merchant, 0.6 ether, blocked, "OVER_DAILY_CAP");

        vm.prank(agent);
        assertFalse(vault.authorize(merchant, 0.6 ether, blocked));
        assertFalse(vault.usedRef(blocked));
        assertEq(vault.remainingToday(agent), 0.5 ether);

        (,,,, uint256 windowStart) = vault.agents(agent);
        vm.warp(windowStart + 1 days);

        assertEq(vault.remainingToday(agent), DAILY);

        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentApproved(agent, merchant, 0.6 ether, blocked);

        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 0.6 ether, blocked));

        (,,, uint256 spentToday, uint256 newWindow) = vault.agents(agent);
        assertEq(spentToday, 0.6 ether);
        assertEq(newWindow, windowStart + 1 days);
        assertEq(vault.remainingToday(agent), DAILY - 0.6 ether);
    }

    function test_nonOwnerCannotCallOwnerFunctions() public {
        vm.startPrank(stranger);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.setAgent(agent, PER_TX, DAILY);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.revokeAgent(agent);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.setMerchant(merchant, true);
        vm.stopPrank();
    }

    function test_spentTodayAccumulates() public {
        _activate();

        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 0.4 ether, keccak256("a")));
        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 0.4 ether, keccak256("b")));

        (,,, uint256 spentToday,) = vault.agents(agent);
        assertEq(spentToday, 0.8 ether);
        assertEq(vault.remainingToday(agent), DAILY - 0.8 ether);
    }

    function test_revokeStopsPreviouslyWorkingAgent() public {
        _activate();

        vm.prank(agent);
        assertTrue(vault.authorize(merchant, 0.1 ether, keccak256("before")));

        vm.expectEmit(true, true, true, true);
        emit AgentVault.AgentRevoked(agent);
        vault.revokeAgent(agent);

        (bool active,,,,) = vault.agents(agent);
        assertFalse(active);

        bytes32 ref = keccak256("after");
        vm.expectEmit(true, true, true, true);
        emit AgentVault.PaymentRejected(agent, merchant, 0.1 ether, ref, "AGENT_REVOKED");

        vm.prank(agent);
        assertFalse(vault.authorize(merchant, 0.1 ether, ref));
        assertFalse(vault.usedRef(ref));
    }

    function _activate() internal {
        vm.expectEmit(true, true, true, true);
        emit AgentVault.AgentSet(agent, PER_TX, DAILY);
        vault.setAgent(agent, PER_TX, DAILY);

        vm.expectEmit(true, true, true, true);
        emit AgentVault.MerchantSet(merchant, true);
        vault.setMerchant(merchant, true);
    }
}
