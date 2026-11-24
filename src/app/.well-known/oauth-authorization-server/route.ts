import { issuer, scope } from "@/lib/gpt-auth";
export function GET() {
  return Response.json({issuer, authorization_endpoint: issuer + "/connect/chatgpt", token_endpoint: issuer + "/api/gpt-token",
    client_id_metadata_document_supported: true, authorization_response_iss_parameter_supported: true,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code"], scopes_supported: [scope],
    token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"]});
}
