import { Injectable } from '@angular/core';
import { DIDDocument } from '@elastosfoundation/did-js-sdk';

@Injectable({
  providedIn: 'root'
})
export class DIDService {
  constructor() {
  }

  /**
   * From: did:elastos:iky98j1Zu61CtpbhvU8KZQrtCqJpudj8Pe
   * To: did:elastos:iky...8Pe
   */
  public shortDIDDisplay(didString: string): string {
    return didString.substring(0, 15) + "..." + didString.substring(didString.length - 3);
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