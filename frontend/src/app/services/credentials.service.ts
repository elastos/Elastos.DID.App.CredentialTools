import { Injectable } from '@angular/core';
import { CredentialType } from '../model/credentialtype';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CredentialsService {
  constructor(public auth: AuthService) { }

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

  public publishCredential(id: string, type: string, credentialType: unknown): Promise<boolean> {
    return new Promise(resolve => {
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
    });
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