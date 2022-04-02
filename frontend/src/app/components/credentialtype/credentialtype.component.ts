import { Clipboard } from '@angular/cdk/clipboard';
import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import moment from 'moment';
import { CredentialType } from 'src/app/model/credentialtype';
import { CredentialsService, PropertyType, PropertyWithType } from 'src/app/services/credentials.service';

@Component({
  selector: 'credential-type',
  templateUrl: './credentialtype.component.html',
  styleUrls: ['./credentialtype.component.scss']
})
export class CredentialTypeComponent {
  public _credentialType: CredentialType = null;

  @Input()
  set credentialType(ct: CredentialType) {
    this._credentialType = ct;
    this.prepareModel();
  }

  @Input()
  public showView: boolean = true;

  // Pre-computed model
  public properties: PropertyWithType[] = [];

  constructor(
    private clipboard: Clipboard,
    private _snackBar: MatSnackBar,
    private router: Router,
    private credentialsService: CredentialsService
  ) { }

  /**
   * Precompute / get some data ready after receiving a new credentialType value
   */
  private prepareModel() {
    this.properties = this.getCredentialTypeMainProperties();
  }

  private getCredentialTypeMainProperties(): PropertyWithType[] {
    return this.credentialsService.getUsablePropertiesWithTypes(this._credentialType);
  }

  public getFormattedDate(timestamp: number): string {
    return moment.unix(Math.floor(timestamp)).format("YYYY-MM-DD ");
  }

  /**
   * Displayable publication date
   */
  public getPublishDate(): string {
    if (!this._credentialType.creationDate)
      return null;

    return moment.unix(Math.floor(this._credentialType.creationDate)).format("YYYY-MM-DD ");
  }

  public getPublishTime(): string {
    if (!this._credentialType.creationDate)
      return null;

    return moment.unix(Math.floor(this._credentialType.creationDate)).format("HH:mm");
  }

  public getPublisher(): string {
    return this._credentialType.elastosEIDChain?.publisher || null;
  }

  public getPublishUrl(): string {
    if (this._credentialType.elastosEIDChain && this._credentialType.elastosEIDChain.publisher) {
      let publisherShortIdentitier = this._credentialType.elastosEIDChain.publisher.replace("did:elastos:", "");
      return `did://elastos/${publisherShortIdentitier}/${this._credentialType.shortType}`;
    }
    else {
      return null;
    }
  }

  public getDisplayablePropertyType(type: PropertyType): string {
    switch (type) {
      case PropertyType.STRING: return "String";
      default: return "";
    }
  }

  public copyShortType() {
    this.clipboard.copy(this._credentialType.shortType);
    this._snackBar.open("Short credential type copied to clipboard", null, {
      duration: 2000
    });
  }

  public copyContext() {
    this.clipboard.copy(this._credentialType.context);
    this._snackBar.open("Context copied to clipboard", null, {
      duration: 2000
    });
  }

  public openCredentialTypeDetails() {
    this.router.navigate(["/typedetails"], {
      queryParams: {
        context: this._credentialType.context,
        shortType: this._credentialType.shortType
      }
    });
  }
}
