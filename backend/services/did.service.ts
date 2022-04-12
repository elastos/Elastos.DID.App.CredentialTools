import { DID, DIDBackend, DIDDocument, DIDStore, Features, RootIdentity } from "@elastosfoundation/did-js-sdk";
import { MyDIDAdapter } from "../adapters/mydid.adapter";
import { SecretConfig } from "../config/env-secret";
import logger from "../logger";

const storePass = "unsafepass"; // No real password. We store the mnemonic in the service anyway.

export type DIDDocumentWithInfo = {
  //estimatedType: "app" | "user";
  document: DIDDocument;
  name: string; // App or user name
  icon: string; // App icon or user avatar
}

class DIDService {
  private issuerDID: DIDDocument = null;
  private documentsWithInfoCache: {
    [did: string]: DIDDocumentWithInfo
  } = {};

  public async setup() {
    let storeId = "kyc-did-store";
    let passphrase = ""; // No mnemonic passphrase

    DIDBackend.initialize(new MyDIDAdapter());
    Features.enableJsonLdContext(true);

    let didStore = await DIDStore.open(storeId);
    if (!didStore.containsDid(SecretConfig.DID.credentialIssuerDIDString)) {
      // The main issuer DID was not imported to the DID store yet, so we do it now.
      // This is mandatory to be able  to issue and sign credentials for others

      let rootIdentity = RootIdentity.createFromMnemonic(SecretConfig.DID.credentialIssuerDIDMnemonic, passphrase, didStore, storePass, true);
      logger.info("Created issuer root identity");

      this.issuerDID = await rootIdentity.newDid(storePass, 0, true); // Index 0, overwrite
      logger.info("Created issuer DID:", this.issuerDID.getSubject().toString());
    }
    else {
      this.issuerDID = await didStore.loadDid(SecretConfig.DID.credentialIssuerDIDString);
      logger.info("Loaded issuer DID:", this.issuerDID.getSubject().toString());
    }
  }

  public getIssuerDID(): DIDDocument {
    return this.issuerDID;
  }

  public getStorePass(): string {
    return storePass;
  }

  public async getDIDWithInfo(did: string): Promise<DIDDocumentWithInfo> {
    if (did in this.documentsWithInfoCache) {
      console.log("getDIDWithInfo cache ", did, this.documentsWithInfoCache[did])

      return this.documentsWithInfoCache[did];
    }
    else {
      let docWithInfo = await this.fetchDIDWithInfo(did);
      this.documentsWithInfoCache[did] = docWithInfo;
      console.log("getDIDWithInfo no cache ", did, docWithInfo)

      return docWithInfo;
    }
  }

  /**
   * Fetches a DID from the EID chain, and tries to extract relevant data from it for convenience,
   * such as the app/user name, or icons/avatars.
   *
   * If the document can't be fetched, null is returned
   */
  private async fetchDIDWithInfo(did: string): Promise<DIDDocumentWithInfo> {
    let document = await new DID(did).resolve();
    if (!document)
      return null;

    return {
      document,
      name: this.getRepresentativeOwnerName(document),
      icon: null // TODO
    };
  }

  /**
  * Returns a subject that provides a displayable title for this document owner.
  * This title can be either:
  * - A "fullname", if the did document represents a regular user
  * - An "app title", if the did document is an application DID
  */
  public getRepresentativeOwnerName(document: DIDDocument): string {
    let name: string = null;

    // Try to find suitable credentials in the document - start with the application credential type
    let applicationCredentials = document.getCredentials().filter(c => c.getType().indexOf("ApplicationCredential") >= 0);
    if (applicationCredentials && applicationCredentials.length > 0) {
      let credSubject = applicationCredentials[0].getSubject().getProperties();
      if ("name" in credSubject)
        name = credSubject["name"] as string;
    }

    // Check the "name" standard
    if (!name) {
      let nameCredentials = document.getCredentials().filter(c => c.getId().getFragment() === "NameCredential");
      if (nameCredentials && nameCredentials.length > 0) {
        let credSubject = nameCredentials[0].getSubject().getProperties();
        if ("name" in credSubject)
          name = credSubject["name"] as string;
      }
    }

    // Check the legacy "name"
    if (!name) {
      let nameCredential = document.getCredential("name");
      if (nameCredential) {
        let credSubject = nameCredential.getSubject().getProperties();
        if ("name" in credSubject)
          name = credSubject["name"] as string;
      }
    }

    return name;
  }
}

export const didService = new DIDService();