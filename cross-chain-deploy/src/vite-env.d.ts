/// <reference types="vite/client" />
interface ImportMetaEnv {
    readonly DIMO_GLOBAL_ACCOUNTS_API_URL: string;
    readonly DIMO_TURNKEY_API_BASE_URL: string;
    readonly DIMO_TURNKEY_API_PRIVATE_KEY: string;
    readonly DIMO_TURNKEY_API_PUBLIC_KEY: string;
    readonly DIMO_TURNKEY_ORGANIZATION_ID: string;
    readonly DIMO_RPID: string;
    readonly DIMO_POLYGON_RPC_URL: string;
    readonly DIMO_ETHEREUM_RPC_URL: string;
    readonly DIMO_BASE_RPC_URL: string;
    readonly DIMO_BUNDLER_RPC: string;
    readonly DIMO_PAYMASTER_RPC: string;
    readonly DIMO_ENVIRONMENT: 'development' | 'staging' | 'production';s
}

interface MetaEnv {
    readonly env: ImportMetaEnv;
}