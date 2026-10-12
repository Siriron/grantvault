// Single source of truth for chain constants and the deployed contract address.
// Deployed on GenLayer Studionet from contracts/grantvault.py; update here after any redeploy.
export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACT_ADDRESS = "0xeA2107a2c4Dd3d58cD296E42771EeA7caAf45Add" as `0x${string}`;

export const isConfigured = () => CONTRACT_ADDRESS !== ZERO_ADDRESS;
