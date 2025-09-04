declare namespace Cloudflare {
  interface Env {
    // Google OAuth2 Configuration
    GOOGLE_OAUTH_CLIENT_ID: string;
    GOOGLE_OAUTH_CLIENT_SECRET: string;
    COOKIE_ENCRYPTION_KEY: string;
    
    // Cloudflare KV for token storage
    TOKENS_KV: KVNamespace;
    
    // Durable Object binding
    MCP_OBJECT: DurableObjectNamespace<import("./src/index").MyMCP>;
    
    // Assets fetcher
    ASSETS: Fetcher;
    
    // Environment configuration
    ENVIRONMENT?: string;
    REDIRECT_URI?: string;
    
    // Development token support (fallback)
    GOOGLE_DEV_TOKEN?: string;
    GOOGLE_DEV_TOKEN_EXPIRES_AT?: string;
    NODE_ENV?: string;
  }
}

interface Env extends Cloudflare.Env {}

type StringifyValues<EnvType extends Record<string, unknown>> = {
  [Binding in keyof EnvType]: EnvType[Binding] extends string
    ? EnvType[Binding]
    : string;
};

declare namespace NodeJS {
  interface ProcessEnv
    extends StringifyValues<
      Pick<
        Cloudflare.Env,
        | "GOOGLE_OAUTH_CLIENT_ID"
        | "GOOGLE_OAUTH_CLIENT_SECRET"
        | "COOKIE_ENCRYPTION_KEY"
      >
    > {}
}