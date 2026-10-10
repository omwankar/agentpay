// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice On-chain spending policy for an agent. Records approval or rejection. Does not move funds.
contract AgentVault {
    error NotOwner();

    address public immutable owner;

    struct Agent {
        bool active;
        uint256 perTxCap;
        uint256 dailyCap;
        uint256 spentToday;
        uint256 windowStart;
    }

    mapping(address => Agent) public agents;
    mapping(address => bool) public allowedMerchant;
    mapping(bytes32 => bool) public usedRef;

    event AgentSet(address indexed agent, uint256 perTxCap, uint256 dailyCap);
    event AgentRevoked(address indexed agent);
    event MerchantSet(address indexed merchant, bool allowed);
    event PaymentApproved(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref);
    event PaymentRejected(
        address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref, string reason
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAgent(address agent, uint256 perTxCap, uint256 dailyCap) external onlyOwner {
        agents[agent] = Agent({
            active: true,
            perTxCap: perTxCap,
            dailyCap: dailyCap,
            spentToday: 0,
            windowStart: block.timestamp
        });
        emit AgentSet(agent, perTxCap, dailyCap);
    }

    function revokeAgent(address agent) external onlyOwner {
        agents[agent].active = false;
        emit AgentRevoked(agent);
    }

    function setMerchant(address merchant, bool allowed) external onlyOwner {
        allowedMerchant[merchant] = allowed;
        emit MerchantSet(merchant, allowed);
    }

    /// @dev Returns false and emits PaymentRejected on the first failing check. Does not revert.
    function authorize(address merchant, uint256 amount, bytes32 ref) external returns (bool) {
        Agent storage agent = agents[msg.sender];

        if (!agent.active) {
            emit PaymentRejected(msg.sender, merchant, amount, ref, "AGENT_REVOKED");
            return false;
        }
        if (usedRef[ref]) {
            emit PaymentRejected(msg.sender, merchant, amount, ref, "REF_ALREADY_USED");
            return false;
        }
        if (!allowedMerchant[merchant]) {
            emit PaymentRejected(msg.sender, merchant, amount, ref, "MERCHANT_NOT_ALLOWED");
            return false;
        }
        if (amount > agent.perTxCap) {
            emit PaymentRejected(msg.sender, merchant, amount, ref, "OVER_PER_TX_CAP");
            return false;
        }

        if (block.timestamp >= agent.windowStart + 1 days) {
            agent.windowStart = block.timestamp;
            agent.spentToday = 0;
        }
        if (agent.spentToday + amount > agent.dailyCap) {
            emit PaymentRejected(msg.sender, merchant, amount, ref, "OVER_DAILY_CAP");
            return false;
        }

        usedRef[ref] = true;
        agent.spentToday += amount;
        emit PaymentApproved(msg.sender, merchant, amount, ref);
        return true;
    }

    /// @notice Remaining daily budget, accounting for a window that has already elapsed.
    function remainingToday(address agentAddr) external view returns (uint256) {
        Agent storage agent = agents[agentAddr];
        uint256 spent = agent.spentToday;
        if (block.timestamp >= agent.windowStart + 1 days) {
            spent = 0;
        }
        if (spent >= agent.dailyCap) {
            return 0;
        }
        return agent.dailyCap - spent;
    }
}
