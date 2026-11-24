import { issuer, resource, scope } from "@/lib/gpt-auth";
export function GET() {
  return Response.json({ resource, authorization_servers: [issuer], scopes_supported: [scope], bearer_methods_supported: ["header"] });
}
