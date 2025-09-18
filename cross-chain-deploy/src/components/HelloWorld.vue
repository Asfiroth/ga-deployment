<script setup lang="ts">
import {ref} from "vue";
import {getTurnkeyClient, getTurnkeyWalletAddress} from "../services/turnkey.ts";
import {generateP256KeyPair} from "@turnkey/crypto";
import {passkeyClient} from "../config/turnkey.ts";
import {getFromSession, GlobalAccountSession, saveToSession} from "../utils/sessionStorage.ts";
import type {IGlobalAccountSession} from "../models/wallet.ts";
import {EmbeddedKey, getFromLocalStorage, saveToLocalStorage} from "../utils/localStorage.ts";
import { getKernelClient} from "../services/zerodev.ts";
import type {SupportedChains} from "../models/enums.ts";
import {zeroAddress} from "viem";
const halfHour = 60 * 30;
//const fifteenMinutes = 15 * 60;

const email = ref<string>('');
const otherEmail = ref<string>('');
const isLoggedIn = ref<boolean>(false);
const myData = ref({});
const selectedChain = ref<string>('');

const loginToGlobalAccount = async () => {

  const response = await fetch(`${import.meta.env.DIMO_GLOBAL_ACCOUNTS_API_URL}/api/account/${email.value}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  const { subOrganizationId } = data!.organizations[0];
  const key = generateP256KeyPair();
  const targetPubHex = key.publicKeyUncompressed;
  const nowInSeconds = Math.ceil(Date.now() / 1000);

  const sessionExpiration = nowInSeconds + halfHour;

  const { credentialBundle } = await passkeyClient.createReadWriteSession({
    organizationId: subOrganizationId,
    targetPublicKey: targetPubHex,
    expirationSeconds: sessionExpiration.toString(),
  });
  saveToLocalStorage(EmbeddedKey, key.privateKey);
  saveToSession<IGlobalAccountSession>(GlobalAccountSession, {
    email: data!.email,
    role: 'owner',
    subOrganizationId: subOrganizationId,
    token: credentialBundle,
    expiry: sessionExpiration,
  });
  isLoggedIn.value = true;
}

const deployToGlobalAccount = async () => {
const session = getFromSession<IGlobalAccountSession>(GlobalAccountSession);
  if (!session) {
    throw new Error('No session found');
  }
  const key = getFromLocalStorage<string>(EmbeddedKey)

  if (!key) {
    throw new Error('No key found in local storage');
  }

  const { subOrganizationId, token,  } = session;
  const turnkeyClient = getTurnkeyClient({
    authKey: token,
    eKey: key!
  });

  const walletAddress = await getTurnkeyWalletAddress({
    subOrganizationId: subOrganizationId,
    client: turnkeyClient,
  });

  const kernelClient = await getKernelClient({
    subOrganizationId: subOrganizationId,
    walletAddress: walletAddress,
    client: turnkeyClient,
    targetChain: selectedChain.value as SupportedChains,
  })

  const callData = await kernelClient.account.encodeCalls([
    {
      to: zeroAddress,
      value: BigInt(0),
      data: '0x',
    },
  ]);

  const transactionHash = await kernelClient.sendUserOperation({
    callData: callData,
  });

  const { success, reason } = await kernelClient.waitForUserOperationReceipt({
    hash: transactionHash,
    timeout: 120_000,
    pollingInterval: 10_000,
  });

  if (!success) {
    throw new Error('Transaction receipt not found');
  }

  const { address: kernelAddress } = kernelClient.account;
  myData.value = {
    address: kernelAddress,
    transactionHash,
    success,
    reason
  };
}

const inviteToGlobalAccount = async () => {
  const invitee = otherEmail.value;
  const session = getFromSession<IGlobalAccountSession>(GlobalAccountSession);
  if (!session) {
    throw new Error('No session found');
  }
  const client = getTurnkeyClient({
    authKey: session.token,
    eKey: getFromLocalStorage<string>(EmbeddedKey)!
  });

  const me = await client.getWhoami({
    organizationId: session.subOrganizationId,
  });

  console.info("Me:", me);

  const { users } = await client.getUsers({
    organizationId: session.subOrganizationId,
  });

  console.info("Users in organization:", users);

/*
    const qresponse = await client.updateRootQuorum({
      type: 'ACTIVITY_TYPE_UPDATE_ROOT_QUORUM',
      timestampMs: Date.now().toString(),
      organizationId: me.organizationId,
      parameters: {
        threshold: 1,
        userIds: [me.userId],
      }
    });

    console.info("Update Root Quorum Reonse:", qresponse);
*/
  /*
    const policyResponse = await client.createPolicies({
      type: 'ACTIVITY_TYPE_CREATE_POLICIES',
      organizationId: me.organizationId,
      timestampMs: Date.now().toString(),
      parameters: {
        policies: [
          {
            policyName: "Create Authenticator Policy",
            effect: "EFFECT_ALLOW",
            condition: "activity.type == 'ACTIVITY_TYPE_CREATE_AUTHENTICATORS_V2'",
            consensus: "approvers.any(user, user.id == '2ddeef2c-50be-40eb-b128-40c09cc7d7ca')",
            notes: "Create Authenticator Policy",
          },
          {
            policyName: "Create Users Policy",
            effect: "EFFECT_ALLOW",
            condition: "activity.type == 'ACTIVITY_TYPE_CREATE_USERS_V3'",
            consensus: "approvers.any(user, user.id == '2ddeef2c-50be-40eb-b128-40c09cc7d7ca')",
            notes: "Create Users Policy",
          },
          {
            policyName: "Delete Users Policy",
            effect: "EFFECT_ALLOW",
            condition: "activity.type == 'ACTIVITY_TYPE_DELETE_USERS'",
            consensus: "approvers.any(user, user.id == '2ddeef2c-50be-40eb-b128-40c09cc7d7ca')",
            notes: "Delete Users Policy",
          }
        ],
      }
    });

  console.info("Create Policies Response:", policyResponse);
*/
  const {authenticators} = await client.getAuthenticators({
    organizationId: me.organizationId,
    userId: me.userId,
  });

  console.info("Authenticators:", authenticators);

    const stampedAddUser = await client.stampCreateUsers({
      type: "ACTIVITY_TYPE_CREATE_USERS_V3",
      organizationId: session.subOrganizationId,
      timestampMs: Date.now().toString(),
      parameters: {
        users: [{
          userEmail: invitee,
          userName: invitee,
          authenticators: [],
          oauthProviders: [],
          apiKeys: [],
          userTags: [],
        }],
      }
    });

    const addUser =JSON.parse(stampedAddUser.body);

    await fetch(`${import.meta.env.DIMO_GLOBAL_ACCOUNTS_API_URL}/api/organization/${session.subOrganizationId}/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signedAddUserToOrganizationRequest: stampedAddUser,
      }),
    });

    console.info(addUser);

}

</script>

<template>
<main>
  <div>
    <label>
      <input type="text" v-model="email" />
    </label>
    <button @click="loginToGlobalAccount">Login</button>


    <div v-if="isLoggedIn">
      <h4>deploy account on other chain</h4>
      <select v-model="selectedChain">
        <option value="ETHEREUM">Ethereum</option>
        <option value="POLYGON">Polygon</option>
        <option value="BASE">Base</option>
      </select>
      <button @click="deployToGlobalAccount">Deploy</button>
      <div>
        <pre>{{ myData }}</pre>
      </div>
    </div>
    <div>
      <h4>get assets</h4>
      <select v-model="selectedChain">
        <option value="ETHEREUM">Ethereum</option>
        <option value="POLYGON">Polygon</option>
        <option value="BASE">Base</option>
      </select>
      <button>Get my Tokens</button>
    </div>

    <div>
      <input type="text" v-model="otherEmail" />
      <button @click="inviteToGlobalAccount">Invite</button>/
    </div>

  </div>
</main>
</template>

<style scoped>

</style>
