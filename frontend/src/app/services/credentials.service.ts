import { Injectable } from '@angular/core';
import { VerifiableCredential } from '@elastosfoundation/did-js-sdk';
import { DID as ConnDID } from "@elastosfoundation/elastos-connectivity-sdk-js";
import { CredentialType } from '../model/credentialtype';
import { AuthService } from './auth.service';
import { HttpService } from './http.service';

/* export enum PropertyType {
  STRING,
  BOOLEAN,
  NUMBER,
  OBJECT
} */

/* export type PropertyWithType = {
  propertyName: string;
  type: PropertyType;
} */

@Injectable({
  providedIn: 'root'
})
export class CredentialsService {
  constructor(public auth: AuthService, private httpService: HttpService) { }

  public async searchCredentialTypes(search?: string): Promise<CredentialType[]> {
    let response = await fetch(`${process.env.NG_APP_API_URL}/api/v1/credentialtypes?search=${search || ""}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
    });

    if (response.status === 200) {
      return response.json();
    }
    else {
      console.error("searchCredentialTypes error:", await response.text());
      return [];
    }
  }

  /**
   * Publishes a new credential type on chain and registers it to the back-end for easy listing.
   *
   * @param credentialId Eg: DiplomaCredential4791459
   * @param shortType Eg: DiplomaCredential
   */
  public async publishCredential(credentialId: string, shortType: string, credentialTypePayload: unknown): Promise<CredentialType> {
    // First step: ask the backend to generate the credential containing the credential type.
    let response = await this.httpService.postBackEndAuthenticatedJson<string>(
      "/api/v1/credentialtype/issue",
      {
        id: credentialId,
        type: shortType,
        credentialType: credentialTypePayload
      }
    );

    if (response.code === 200) {
      let credentialString = response.data;

      let vc = VerifiableCredential.parse(credentialString);
      console.log("Received generated credential type credential:", vc);

      // Step 2: ask user to import the credential into his identity wallet, and to publish it
      // on chain.
      console.log("Asking user to import and publish the credential through the connectivity SDK...");
      const didAccess = new ConnDID.DIDAccess();
      let importedCredential = await didAccess.importCredentialContext(shortType, vc);

      if (importedCredential) {
        console.log("Credential imported and published successfully by the identity wallet");

        // Service ID format in DID document: did:elastos:abcde#shortType
        let serviceId = this.auth.signedInDID() + "#" + shortType;

        // Step 3: let the back-end know about this result and ask it to save the new credential type.
        let registrationResponse = await this.httpService.postBackEndAuthenticatedJson<CredentialType>("/api/v1/credentialtype/register", {
          serviceId
        });

        console.log("registrationResponse", registrationResponse)

        if (registrationResponse && registrationResponse.code === 200)
          return registrationResponse.data;
        else {
          if (registrationResponse.errorMessage)
            console.warn("Failed to publish with error message: ", registrationResponse.errorMessage);

          return null;
        }
      }
      else {
        console.warn("Credential import failed or cancelled by the identity wallet");
        return null;
      }
    }
    else {
      console.warn("Publish credential returns error code " + response.code);
    }

    return null;
  }

  /**
   * Finds the database credential type that matches the given conetxt and short type.
   * If no short type is provided, this normally means that we are willing to fetch only the context,
   * so this returns any arbitrary credential type that is base on the given context url.
   *
   * @param contextUrl did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential
   * @param shortType MyCredential
   *
   * Output: The credential type payload ({@context, etc}) currently stored on the toolbox backend DB.
   */
  public fetchCredentialType(contextUrl: string, shortType?: string): Promise<CredentialType> {
    return new Promise(async resolve => {
      let encodedUrl = encodeURIComponent(contextUrl);
      let response = await fetch(`${process.env.NG_APP_API_URL}/api/v1/credentialTypeByContextUrl?contextUrl=${encodedUrl}${shortType ? `&shortType=${shortType}` : ''}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (response.status === 200) {
        let data = await response.text()
        if (!data)
          resolve(null);
        else
          resolve(JSON.parse(data) as CredentialType);
      }
      else {
        console.error("Failed to retrieve credential type:", await response.text());
        resolve(null);
      }
    });
  }
}