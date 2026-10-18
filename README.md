# QMOOSA Governance SDK (`qmoosa-governance-sdk`)

## Overview
Part of the **QMOOSA 1,000 Crypto Projects Mission — Domain 1 (DeFi & Financial Invariants)**.
Repository ID: `048/1000`.

`qmoosa-governance-sdk` provides the client library for decentralized governance interaction:
- **Proposal Preparation & Validation**: Validates proposal targets, call data, signatures, and values.
- **Signed Intent Generation**: Cryptographically signs proposal creation and vote intents using deterministic SHA-256 digests.
- **Timelock Status Inspector**: Tracks `NOT_QUEUED`, `LOCKED`, `READY`, and `EXPIRED` execution windows.
- **Quorum Tracker**: Calculates participating vote ratios and quorum progress in basis points.
- **Defensive Immutability**: Enforces deep-frozen object returns across all SDK client methods.

## Verification
- Unit & Invariant Testing: 4 Node.js SDK tests.
- Zero-Spend Invariant: $0.00 spent on live networks. Mainnet and public testnets remain strictly locked.
