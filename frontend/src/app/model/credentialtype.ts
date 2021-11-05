import { JSONObject } from "@elastosfoundation/did-js-sdk";

export type CredentialType = {
  publisher: string; // DID string of the user that published the credential;
  publishDate: number; // Publish time timestamp (secs)
  id: string; // simulation for the credential type's containing credential ID
  type: string; // simulation for the credential type's containing credential credential type as defined by the user
  value: JSONObject; // Credential payload (containing credential's subject)
}