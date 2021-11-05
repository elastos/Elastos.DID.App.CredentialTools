import { Component, ViewEncapsulation } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from '@angular/router';
import { prettyPrintJson } from 'pretty-print-json';
import { Field } from 'src/app/model/build/field';
import { BuildService } from 'src/app/services/build.service';
import { CredentialsService } from 'src/app/services/credentials.service';
import { v4 as uuidv4 } from 'uuid';
import { AddFieldSheetComponent } from './addfield/addfield.component';

@Component({
  selector: 'app-build',
  templateUrl: './build.component.html',
  styleUrls: ['./build.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BuildComponent {
  private credentialId: string = null;
  public credentialType: string = "DiplomaCredential";
  public fields: Field[] = [{
    id: uuidv4(),
    name: "stub",
    type: "xsd:string"
  }];

  private credentialTypeJson: unknown = null;
  public codePreviewHtml: string = "";

  constructor(
    private _bottomSheet: MatBottomSheet,
    private _snackBar: MatSnackBar,
    private buildService: BuildService,
    private router: Router,
    private credentialsService: CredentialsService) {
    this.updateCodePreview();
  }

  openAddField(): void {
    let sheet = this._bottomSheet.open(AddFieldSheetComponent);
    sheet.afterDismissed().toPromise().then((selection) => {
      if (selection) {
        this.fields.push({
          id: uuidv4(),
          name: "myCustomField",
          type: selection
        });
        this.updateCodePreview();
      }
    });
  }

  public deleteField(field: Field) {
    this.fields.splice(this.fields.findIndex(f => f.id === field.id), 1);
  }

  public onFieldNameChanged(field: Field, target: any) {
    this.updateCodePreview();
  }

  public onCredentialTypeChanged(target: any) {
    this.updateCodePreview();
  }

  private async updateCodePreview() {
    /* const doc = {
      //"http://schema.org/name": "Manu Sporny",
      "http://schema.org/url": { "@id": "http://manu.sporny.org/" },
      "http://schema.org/image": { "@id": "http://manu.sporny.org/images/manu.png" }
    };
    const context = {
      "name": "http://schema.org/name",
      "homepage": { "@id": "http://schema.org/url", "@type": "@id" },
      "image": { "@id": "http://schema.org/image", "@type": "@id" }
    };

    const compacted = await compact(doc, context);
    //this.codePreview = JSON.stringify(compacted, null, 2);
    this.codePreviewHtml = prettyPrintJson.toHtml(compacted, {
      quoteKeys: true
    }); */

    this.credentialId = this.buildService.generateCredentialId(this.credentialType);
    this.credentialTypeJson = this.buildService.buildCredentialTypeJson(this.credentialId, this.credentialType, this.fields);
    this.codePreviewHtml = prettyPrintJson.toHtml(this.credentialTypeJson, {
      quoteKeys: true
    });
  }

  public async publishCredentialType() {
    let couldPublish = await this.credentialsService.publishCredential(this.credentialId, this.credentialType, this.credentialTypeJson);
    if (couldPublish)
      this.router.navigate(['home']);
    else {
      this._snackBar.open("Failed to publish...");
    }
  }
}
