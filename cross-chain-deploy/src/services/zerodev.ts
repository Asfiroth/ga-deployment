import { turnkeyConfig } from '../config/turnkey';
import { TurnkeyClient } from '@turnkey/http';
import { createAccount } from '@turnkey/viem';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  getUserOperationGasPrice,
  type KernelAccountClient,
  createFallbackKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { type Client, createPublicClient, type RpcSchema } from 'viem';
import type {
  GetPaymasterDataParameters,
  SmartAccount,
} from 'viem/account-abstraction';
import { http, type Transport } from 'viem';
import { type Chain } from 'viem/chains';
import { polygon, polygonAmoy, mainnet, sepolia, base, baseSepolia } from 'viem/chains';
import {SupportedChains} from "../models/enums.ts";

const getRpcUrl = (targetChain: SupportedChains): string => {
  switch (targetChain) {
    case SupportedChains.ETHEREUM:
      return turnkeyConfig.ethereumRpcUrl;
    case SupportedChains.BASE:
      return turnkeyConfig.baseRpcUrl;
    case SupportedChains.POLYGON:
    default:
      return turnkeyConfig.polygonRpcUrl;
  }
};

const getChain = (targetChain: SupportedChains): Chain => {
  const environment = import.meta.env.DIMO_ENVIRONMENT;
  const isProduction = environment === 'production';
  switch (targetChain) {
    case SupportedChains.ETHEREUM:
      return isProduction ? mainnet : sepolia;
    case SupportedChains.BASE:
      return isProduction ? base : baseSepolia;
    case SupportedChains.POLYGON:
    default:
      return isProduction ? polygon : polygonAmoy;
  }
};

export const getPublicClient = (targetChain: SupportedChains) => {
  const chain = getChain(targetChain);
  const rpcUrl = getRpcUrl(targetChain);
  return createPublicClient({
    chain: chain,
    transport: http(rpcUrl),
  });
};

const sponsorUserOperation = async ({
  userOperation,
  provider,
    targetChain
}: {
  userOperation: GetPaymasterDataParameters;
  provider: string;
  targetChain: SupportedChains;
}) => {
  const chain = getChain(targetChain);
  const zerodevPaymaster = createZeroDevPaymasterClient({
    chain: chain,
    transport: http(`${turnkeyConfig.bundleRpc}/${chain.id}?provider=${provider}`),
  });
  return zerodevPaymaster.sponsorUserOperation({
    userOperation,
  });
};

const buildFallbackKernelClients = async ({
  subOrganizationId,
  walletAddress,
  client,
    targetChain
}: {
  subOrganizationId: string;
  walletAddress: `0x${string}`;
  client: TurnkeyClient;
  targetChain: SupportedChains;
}) => {
  const fallbackProviders: string[] = ['ALCHEMY', 'GELATO', 'PIMLICO'];
  const fallbackKernelClients: KernelAccountClient<
    Transport,
    Chain,
    SmartAccount,
    Client,
    RpcSchema
  >[] = [];

  const chain = getChain(targetChain);
  const kernelAccount = await getKernelAccount({
    subOrganizationId,
    walletAddress,
    client,
    targetChain
  });

  for (const provider of fallbackProviders) {
    const kernelClient = createKernelAccountClient({
      account: kernelAccount,
      chain: chain,
      bundlerTransport: http(`${turnkeyConfig.bundleRpc}/${chain.id}?provider=${provider}`),
      client: kernelAccount.client,
      paymaster: {
        getPaymasterData: (userOperation) => {
          return sponsorUserOperation({
            userOperation,
            provider,
            targetChain
          });
        },
      },
      userOperation: {
        estimateFeesPerGas: async ({ bundlerClient }) => {
          return getUserOperationGasPrice(bundlerClient);
        },
      },
    });

    fallbackKernelClients.push(kernelClient);
  }

  return createFallbackKernelAccountClient(fallbackKernelClients);
};

export const getKernelAccount = async ({
  subOrganizationId,
  walletAddress,
  client,
    targetChain
}: {
  subOrganizationId: string;
  walletAddress: `0x${string}`;
  client: TurnkeyClient;
  targetChain: SupportedChains;
}) => {
  console.info(targetChain);
  const entryPoint = getEntryPoint('0.7');
  const publicClient = getPublicClient(targetChain);

  const localAccount = await createAccount({
    client: client,
    organizationId: subOrganizationId,
    signWith: walletAddress,
    ethereumAddress: walletAddress,
  });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: localAccount,
    entryPoint: entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const zeroDevKernelAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint: entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  return zeroDevKernelAccount;
};

export const getKernelClient = async ({
  subOrganizationId,
  walletAddress,
  client,
    targetChain
}: {
  subOrganizationId: string;
  walletAddress: `0x${string}`;
  client: TurnkeyClient;
  targetChain: SupportedChains;
}) => {
  const kernelClient = await buildFallbackKernelClients({
    subOrganizationId,
    walletAddress,
    client,
    targetChain
  });
  return kernelClient;
};
