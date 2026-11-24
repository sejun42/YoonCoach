import { createHash } from "node:crypto";

export const issuer = "https://yoon-coach.vercel.app";
export const resource = issuer + "/api/mcp";
export const client = "https://chatgpt.com/oauth/client.json";
export const callback = "https://chatgpt.com/connector_platform_oauth_redirect";
export const scope = "journal";
export const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
export const noStore = { "Cache-Control": "private, no-store" };
