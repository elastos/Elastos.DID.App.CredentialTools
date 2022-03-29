
type OwnedCredential = {
  issuanceDate: number; // Timestamp secs
  issuer: string; // DID string of the credential issuer - Can be null, if the credential is self-proclaimed
  types: string[]; // Full credential type with context - eg: ["did://elastos/iXMsb6ippqkCHN3EeWc4QCA9ySnrSgLc4u/DiplomaCredential"]
}

type UsedCredentialOperation = "request" | "import";

type UsedCredential = {
  operation: UsedCredentialOperation; // Type of DID operation requested by a third party app: request existing user credentials, import new credential...
  usedAt: number; // timestamp (sec)
  types: string[]; // Full credential type with context - eg: ["did://elastos/iXMsb6ippqkCHN3EeWc4QCA9ySnrSgLc4u/DiplomaCredential"]
  appDid?: string; // DID string of the application requesting the DID operation
}

/**
 * Raw stats as received from the API
 */
export type CredentialStats = {
  userId: string;
  ownedCredentials: OwnedCredential[];
  usedCredentials: UsedCredential[];
}

/**
 * Raw stats as stored in mongo
 */
export type StoredCredentialStats = CredentialStats & {
  createdAt: number; // timestamp sec
}

export type TopUsingApp = {
  did: string; // Application DID
  users: number; // Number of users using a credential type through this the app
}

/**
 * Type used to append aggregated statistics into credential type objects themselves in mongo.
 */
export type CredentialTypeAggregatedStats = {
  topUsingApps: TopUsingApp[]; // List of apps that use a credential type and the number of users who recently used this type through this app
  totalUsers: number; // Number of users who have at least one credential using such credential type.
  totalCredentials: number; // Total number of credentials using this type. Each user can have many.
  lastCreated: number; // Timestamp - Last time one credential of this type was created, global to all users.
  lastUsed: number; // Timestamp - Last time one credential of this type was used, meaning that it was requested from a third party app, to the user.
}
