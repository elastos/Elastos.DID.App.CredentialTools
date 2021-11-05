import { Component } from '@angular/core';
import { CredentialType } from 'src/app/model/credentialtype';
import { CredentialsService } from 'src/app/services/credentials.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  public searchValue: string = "";
  public latestCredentials: CredentialType[] = [];

  constructor(private credentialsService: CredentialsService) {
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
    this.latestCredentials = await this.credentialsService.searchCredentialTypes(this.searchValue);
  }
}
