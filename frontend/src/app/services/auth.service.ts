import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { VerifiablePresentation } from '@elastosfoundation/did-js-sdk/typings';
import { DID } from "@elastosfoundation/elastos-connectivity-sdk-js";
import jwtDecode from 'jwt-decode';
import { User } from '../model/user';
import { ConnectivityService } from './connectivity.service';

const AUTH_TOKEN_STORAGE_KEY = "didauthtoken";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private user: User = null;
  private postAuthRoute: string = null;

  constructor(
    private jwtHelper: JwtHelperService,
    public router: Router,
    private connectivityService: ConnectivityService) {
    this.loadUser();
  }

  /**
   * Reloads authenticated user info from the stored JWT.
   */
  private loadUser() {
    const token = this.getAuthToken();
    if (token) {
      this.user = jwtDecode(token);
    }
  }

  public isAuthenticated(): boolean {
    const token = this.getAuthToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }

  public getAuthToken(): string {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  public signedInDID(): string {
    if (!this.user)
      return null;

    return this.user.did;
  }

  /**
   * Saves the route to which user should be redirected after a successful authentication.
   */
  public setPostAuthRoute(postAuthRoute: string) {
    this.postAuthRoute = postAuthRoute;
  }

  public async signIn(): Promise<void> {
    // Always disconnect from older WC session first to restart fresh, if needed
    if (this.connectivityService.getEssentialsConnector().hasWalletConnectSession())
      await this.connectivityService.getEssentialsConnector().disconnectWalletConnect();

    const didAccess = new DID.DIDAccess();
    let presentation: VerifiablePresentation;

    console.log("Trying to sign in using the connectivity SDK");
    try {
      presentation = await didAccess.requestCredentials({
        claims: [
          DID.standardNameClaim("Display your name to yourself", false)
        ]
      });
    } catch (e) {
      // Possible exception while using wallet connect (i.e. not an identity wallet)
      // Kill the wallet connect session
      console.warn("Error while getting credentials", e);
      return;
    }

    if (presentation) {
      const did = presentation.getHolder().getMethodSpecificId();

      await new Promise<void>(resolve => {
        fetch(`${process.env.NG_APP_API_URL}/api/v1/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(presentation.toJSON())
          }).then(response => response.json()).then(data => {
            if (data.code === 200) {
              const token = data.data;

              localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);

              this.user = jwtDecode(token);
              console.log("Sign in: setting user to:", this.user);

              resolve();

              if (this.postAuthRoute) {
                this.router.navigate([this.postAuthRoute]);
                this.postAuthRoute = null;
              }
              else {
                this.router.navigate(['home']);
              }
            } else {
              console.log(data);
              resolve();
            }
          }).catch((error) => {
            console.log(error);
            //showToast(`Failed to call the backend API. Check your connectivity and make sure ${api.url} is reachable`, "error");
            resolve();
          })
      });
    }
  }

  public signOut() {
    this.user = null;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    this.router.navigate(['home']);
  }
}