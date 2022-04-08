import { Clipboard } from '@angular/cdk/clipboard';
import { Component } from '@angular/core';
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from '@angular/router';
import { CredentialType, mostRecentPayload } from 'src/app/model/credentialtype';
import { CredentialsService } from 'src/app/services/credentials.service';
import { BuildPageParams } from '../build/build.component';
import { TypeDetailsPageParams } from '../typedetails/typedetails.component';

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
    let credJson = mostRecentPayload(credential);

    if (!credJson)
      return [];

    const excludedKeys = ["schema", "xsd", "@version", /* credential.contextPayload */];
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

  public openNewCredentialType() {
    let queryParams: BuildPageParams = {
      mode: "new"
    };

    this.router.navigate(["/build"], {
      queryParams
    });
  }

  public openCredentialTypeDetails(credentialType: CredentialType) {
    let queryParams: TypeDetailsPageParams = {
      context: credentialType.context,
      shortType: credentialType.shortType
    };

    this.router.navigate(["/typedetails"], {
      queryParams
    });
  }
}
