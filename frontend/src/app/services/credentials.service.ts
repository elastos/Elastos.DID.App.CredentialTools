import { Injectable } from '@angular/core';
import { VerifiableCredential } from '@elastosfoundation/did-js-sdk';
import { DID as ConnDID } from "@elastosfoundation/elastos-connectivity-sdk-js";
import { CredentialType } from '../model/credentialtype';
import { AuthService } from './auth.service';
import { HttpService } from './http.service';

@Injectable({
  providedIn: 'root'
})
export class CredentialsService {
  constructor(public auth: AuthService, private httpService: HttpService) { }

  public searchCredentialTypes(search?: string): Promise<CredentialType[]> {
    return new Promise(resolve => {
      fetch(`${process.env.NG_APP_API_URL}/api/v1/credentialtypes?search=${search || ""}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
      }).then(response => response.json()).then(data => {
        if (data.code === 200) {
          resolve(data.data);
        }
        else {
          console.error("searchCredentialTypes error:", data)
          resolve([]);
        }
      });
    })
  }

  /**
   * Publishes a new credential type on chain and registers it to the back-end for easy listing.
   *
   * @param credentialId Eg: DiplomaCredential4791459
   */
  public async publishCredential(credentialId: string, type: string, credentialType: unknown): Promise<boolean> {
    // First step: ask the backend to generate the credential containing the credential type.
    let response = await this.httpService.postBackEndAuthenticatedJson<string>(
      "/api/v1/credentialtype/issue",
      {
        id: credentialId,
        type,
        credentialType
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
      let importedCredentials = await didAccess.importCredentials([vc], {
        forceToPublishCredentials: true
      });

      if (true || importedCredentials && importedCredentials.length > 0) {
        console.log("Credential imported and published successnfully by the identity wallet");

        // Step 3: let the back-end know about this result and ask it to save the new credential type.
        let registrationResponse = await this.httpService.postBackEndAuthenticatedJson<boolean>("/api/v1/credentialtype/register", {
          id: credentialId
        });
        return registrationResponse.code === 200 && registrationResponse.data === true;
      }
      else {
        console.warn("Credential import failed or cancelled by the identity wallet");
        return false;
      }
    }

    return false;

    /* return new Promise(resolve => {
      fetch(`${process.env.NG_APP_API_URL}/api/v1/credentialtype`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": this.auth.getAuthToken()
        },
        body: JSON.stringify({
          id,
          type,
          credentialType
        })
      }).then(response => response.json()).then(data => {
        if (data.code === 200) {
          resolve(true);
        }
        else {
          resolve(false);
        }
      });
    }); */
  }

  /**
   * Input: did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential7562980#DiplomaCredential
   * Output: The credential type payload ({@context, etc}) currently stored on the toolbox backend DB.
   */
  public getCredentialTypeByUrl(credentialUrl: string): Promise<unknown> {
    return new Promise(resolve => {
      let encodedUrl = encodeURIComponent(credentialUrl);
      fetch(`${process.env.NG_APP_API_URL}/api/v1/credentialTypeByUrl?url=${encodedUrl}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      }).then(response => response.json()).then(data => {
        if (data.code === 200) {
          resolve(data.data);
        }
        else {
          console.error("Failed to retrieve credential type:", data);
          resolve(null);
        }
      });
    });
  }
}