// Single source of truth for chain constants and the deployed contract address.
// Deployed on GenLayer Studionet from contracts/grantvault.py; update here after any redeploy.
export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACT_ADDRESS = "0x66c85966A4fCfBEEAc43152F0188fb468CC6BD87" as `0x${string}`;

export const isConfigured = () => CONTRACT_ADDRESS !== ZERO_ADDRESS;
