import { Clipboard } from '@angular/cdk/clipboard';
import { Component } from '@angular/core';
import { MatSnackBar } from "@angular/material/snack-bar";
import moment from 'moment';
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
    private _snackBar: MatSnackBar,) {
  }

  async ngAfterViewInit() {
    this.fetchCredentialTypes();
  }

  public getCredentialTypeMainProperties(credential: CredentialType): string[] {
    if (!credential.value || !("@context" in credential.value))
      return [];

    const excludedKeys = ["schema", "xsd", "@version", credential.type];
    return Object.keys(credential.value["@context"]).filter(k => excludedKeys.indexOf(k) < 0);
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
  }

  /**
   * Displayable publication date
   */
  public getPublishDate(credentialType: CredentialType): string {
    return moment.unix(Math.floor(credentialType.publishDate)).format("YYYY-MM-DD ");
  }

  public getPublishTime(credentialType: CredentialType): string {
    return moment.unix(Math.floor(credentialType.publishDate)).format("HH:mm");
  }

  public getPublishUrl(credentialType: CredentialType): string {
    let publisherShortIdentitier = credentialType.publisher.replace("did:elastos:", "");
    return `did://elastos/${publisherShortIdentitier}/${credentialType.type}`;
  }

  public copyUrl(credentialType: CredentialType) {
    this.clipboard.copy(this.getPublishUrl(credentialType));
    this._snackBar.open("Credential type URL copied to clipboard", null, {
      duration: 2000
    });
  }
}
