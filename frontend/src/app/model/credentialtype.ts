import { CredentialTypeAggregatedStats } from "./stats";

/**
 * Storage location/origin for a credential type.
 */
export enum CredentialTypeMedium {
  HTTPS = "https",
  EID_CHAIN = "eid_chain"
}

export type CredentialType = {
  medium: CredentialTypeMedium; // Storage location for this type
  context: string; // Context url. One type can be defined only in one context url
  shortType: string; // Short type name, must be defined inside the context
  //resolvedType?: string; // resolved type's @id - NOT IMPLEMENTED YET
  //fullTypeUrl: string; // https://#type or did://elastos/xxx/type-randomint#type
  contextPayload: string; // JSONLD context payload as JSON string - Main root field must be a "@context"
  keywords: string[]; // List of extracted keywords, used to search inside credentials.
  creationDate: number; // Timestamp at which this type was created (null for http contexts)
  lastMonthStats?: CredentialTypeAggregatedStats; // Aggregated statistics, computed by this service. Initially not set, then appended by stats background tasks after receiving usage stats from external sources like the identity wallet

  // EID CHAIN specific
  elastosEIDChain?: { // Optional. Set only for types published on the elastos identity chain
    publisher: string; // DID string of the user that published the credential.
  }
}
