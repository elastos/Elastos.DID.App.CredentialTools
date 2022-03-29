import { JSONObject } from "@elastosfoundation/did-js-sdk";
import { CredentialTypeAggregatedStats } from "./stats";

export type CredentialType = {
  publisher: string; // DID string of the user that published the credential;
  publishDate: number; // Publish time timestamp (secs)
  id: string; // simulation for the credential type's containing credential ID
  type: string; // simulation for the credential type's containing credential credential type as defined by the user
  value: JSONObject; // Credential payload (containing credential's subject)
  keywords: string[]; // List of extracted keywords, used to search inside credentials.
  lastMonthStats?: CredentialTypeAggregatedStats; // Aggregated statistics, computed by this service. Initially not set, then appended by stats background tasks after receiving usage stats from external sources like the identity wallet
}