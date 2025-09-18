import { Turnkey } from '@turnkey/sdk-browser';
export const turnkeyConfig = {
  apiBaseUrl: import.meta.env.DIMO_TURNKEY_API_BASE_URL!,
  apiPrivateKey: import.meta.env.DIMO_TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: import.meta.env.DIMO_TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: import.meta.env.DIMO_TURNKEY_ORGANIZATION_ID!,
  rpId: import.meta.env.DIMO_RPID!,
  polygonRpcUrl: import.meta.env.DIMO_POLYGON_RPC_URL!,
    ethereumRpcUrl: import.meta.env.DIMO_ETHEREUM_RPC_URL!,
    baseRpcUrl: import.meta.env.DIMO_BASE_RPC_URL!,
  bundleRpc: import.meta.env.DIMO_BUNDLER_RPC!,
  paymasterRpc: import.meta.env.DIMO_PAYMASTER_RPC!,
};

export const turnkeyClient = new Turnkey({
  apiBaseUrl: turnkeyConfig.apiBaseUrl,
  defaultOrganizationId: turnkeyConfig.defaultOrganizationId,
});

export const passkeyClient = turnkeyClient.passkeyClient({
  rpId: turnkeyConfig.rpId,
});
