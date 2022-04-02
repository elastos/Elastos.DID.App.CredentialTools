import { Clipboard } from '@angular/cdk/clipboard';
import { Component } from '@angular/core';
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from '@angular/router';
import { CredentialType } from 'src/app/model/credentialtype';
import { CredentialsService } from 'src/app/services/credentials.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  public searchValue: string = "";
  public latestCredentialTypes: CredentialType[] = [];

  constructor(
    private credentialsService: CredentialsService,
    private clipboard: Clipboard,
    private router: Router,
    private _snackBar: MatSnackBar,) {
  }

  async ngAfterViewInit() {
    this.fetchCredentialTypes();
  }

  public getCredentialTypeMainProperties(credential: CredentialType): string[] {
    let credJson = JSON.parse(credential.contextPayload);

    if (!credential.contextPayload || !("@context" in credJson))
      return [];

    const excludedKeys = ["schema", "xsd", "@version", credential.contextPayload];
    return Object.keys(credJson["@context"]).filter(k => excludedKeys.indexOf(k) < 0);
  }

  public async onSearchValueChanged(event: any) {
    this.fetchCredentialTypes();
  }

  public clearSearch() {
    this.searchValue = '';
    this.fetchCredentialTypes();
  }

  private async fetchCredentialTypes() {
    this.latestCredentialTypes = await this.credentialsService.searchCredentialTypes(this.searchValue);
    console.log("this.latestCredentialTypes", this.latestCredentialTypes)
  }

  public openCredentialTypeDetails(credentialType: CredentialType) {
    this.router.navigate(["/typedetails"], {
      queryParams: {
        context: credentialType.context,
        shortType: credentialType.shortType
      }
    });
  }
}
