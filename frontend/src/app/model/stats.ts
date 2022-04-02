
export type CredentialTypeWithContext = {
  context: string; // Context url: 'https://ns.elastos.org/credentials/v1'
  shortType: string; // Short type that such as: 'SelfProclaimedCredential'
}

type OwnedCredential = {
  issuanceDate: number; // Timestamp secs
  issuer: string; // DID string of the credential issuer - Can be null, if the credential is self-proclaimed
  types: CredentialTypeWithContext[]; // Short type with associated context - eg: "did://elastos/iXMsb6ippqkCHN3EeWc4QCA9ySnrSgLc4u/DiplomaCredential1234" + "DiplomaCredential"
}

type UsedCredentialOperation = "request" | "import";

type UsedCredential = {
  operation: UsedCredentialOperation; // Type of DID operation requested by a third party app: request existing user credentials, import new credential...
  usedAt: number; // timestamp (sec)
  types: CredentialTypeWithContext[]; // Short type with associated context - eg: "did://elastos/iXMsb6ippqkCHN3EeWc4QCA9ySnrSgLc4u/DiplomaCredential1234" + "DiplomaCredential"
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

export type UsingApp = {
  did: string; // Application DID
  name: string; // Resolved app name
  icon: string; // Resolved app icon, cached and served by the current service
  users: number; // Number of users using a credential type through this the app
}

export type Issuer = {
  did: string; // Application or user DID
  name: string; // Resolved app/user name
  icon: string; // Resolved app/user icon, cached and served by the current service
  users: number; // Number of users owning a credential type through this the app
}

/**
 * Type used to append aggregated statistics into credential type objects themselves in mongo.
 */
export type CredentialTypeAggregatedStats = {
  topUsingApps: UsingApp[]; // List of apps that use a credential type and the number of users who recently used this type through this app
  topIssuers: Issuer[]; // List of apps or users who issued credentials that use this credential type.
  totalUsers: number; // Number of users who have at least one credential using such credential type.
  totalCredentials: number; // Total number of credentials using this type. Each user can have many.
  lastCreated: number; // Timestamp - Last time one credential of this type was created, global to all users.
  lastUsed: number; // Timestamp - Last time one credential of this type was used, meaning that it was requested from a third party app, to the user.
}
