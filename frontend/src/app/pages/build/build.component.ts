import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from "@angular/material/snack-bar";
import { ActivatedRoute, Router } from '@angular/router';
import { prettyPrintJson } from 'pretty-print-json';
import { Field, FieldType, newEmptyObjectField, ObjectField } from 'src/app/model/build/field';
import { CredentialType } from 'src/app/model/credentialtype';
import { AuthService } from 'src/app/services/auth.service';
import { BuildService } from 'src/app/services/build.service';
import { CredentialsService } from 'src/app/services/credentials.service';
import { v4 as uuidv4 } from 'uuid';
import { TypeDetailsPageParams } from '../typedetails/typedetails.component';
import { AddFieldSheetComponent } from './addfield/addfield.component';

export type BuildPageMode = "new" | "edit" | "clone";

export type BuildPageParams = {
  mode: BuildPageMode;
  context?: string; // Only needed for edit and clone modes
  shortType?: string; // Only needed for edit and clone modes
}

/**
 * Supported mode while opening this screen:
 * - new -> builder with no reference type, all data empty, new credential ID.
 * - edit -> builder with reference type, all same data set including the credential type. Credential ID is PRESERVED
 * - clone -> builder with reference type, all same data set, but credential type is clearer. Credential ID is CHANGED
 */
@Component({
  selector: 'app-build',
  templateUrl: './build.component.html',
  styleUrls: ['./build.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BuildComponent implements OnInit {
  private credentialId: string = null;
  private credentialTypeUnicitySuffix: string = null; // Suffix for credential ids to make them unique based on their short type

  public shortType: string = "DiplomaCredential";
  public rootObject: ObjectField = newEmptyObjectField();

  public buildPageMode: BuildPageMode = null;
  private credentialTypeJson: unknown = null;
  public codePreviewHtml: string = "";
  public validationErrorMessage: string = "";
  public publishing = false;
  public wasPublished = false;
  private publishedCredentialType: CredentialType = null;

  constructor(
    private _bottomSheet: MatBottomSheet,
    private _snackBar: MatSnackBar,
    private buildService: BuildService,
    private router: Router,
    private authService: AuthService,
    private route: ActivatedRoute,
    private credentialsService: CredentialsService) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      let typedParams = params as BuildPageParams;

      this.buildPageMode = typedParams.mode;

      switch (typedParams.mode) {
        case "new":
          this.preparePageForNewType();
          break;
        case "edit":
          this.preparePageForTypeEditing(typedParams.context, typedParams.shortType);
          break;
        case "clone":
          this.preparePageForTypeCloning(typedParams.context, typedParams.shortType);
          break;
      }
    });
  }

  private preparePageForNewType() {
    console.log("Preparing builder for a new type");

    // Create a dummy field to start with
    this.rootObject.children.push({
      parent: this.rootObject,
      uiId: uuidv4(),
      name: "stub",
      type: FieldType.STRING,
    });

    this.updateCodePreview();
  }

  /**
   * Edits an existing type.
   * - Only the publisher of this type is allowed to do so
   * - When publishing, a new credential is issued, but the service id (context) remains the same.
   *   The service is updated with the new credential id reference.
   */
  private async preparePageForTypeEditing(context: string, shortType: string) {
    console.log("Preparing builder for edition of existing type:", context, shortType);

    let ct = await this.credentialsService.fetchCredentialType(context, shortType);

    if (ct) {
      let builderInfo = this.buildService.extractBuilderInfoFromExistingType(ct);
      this.rootObject = builderInfo.rootObject;
      this.shortType = builderInfo.credentialTypeName;

      this.updateCodePreview();
    }
  }

  /**
   * Clone an existing type. We first fetch that target type to get its info, then we
   * populate the builder with the target format.
   *
   * A new credential ID is created.
   */
  private async preparePageForTypeCloning(context: string, shortType: string) {
    console.log("Preparing builder to clone existing type:", context, shortType);

    let ct = await this.credentialsService.fetchCredentialType(context, shortType);

    if (ct) {
      let builderInfo = this.buildService.extractBuilderInfoFromExistingType(ct);
      this.rootObject = builderInfo.rootObject;
      this.shortType = ""; // Let user enter his own type name

      this.updateCodePreview();
    }
  }

  /**
   * One of the sub-objects requires to add a new field inside of it
   */
  public onAddField(fieldObject: ObjectField) {
    this.openAddField(fieldObject);
  }

  private openAddField(fieldObject: ObjectField): void {
    let sheet = this._bottomSheet.open(AddFieldSheetComponent);
    sheet.afterDismissed().toPromise().then((selection) => {
      if (selection !== undefined) {
        this.createField(selection, fieldObject);
      }
    });
  }

  /**
   * Creates a new field of the given type and adds it to the given containing object.
   */
  private createField(type: FieldType, containingObject: ObjectField) {
    let newField: Field = {
      parent: containingObject,
      uiId: uuidv4(),
      name: "myCustomField",
      type: type
    };

    if (type === FieldType.OBJECT) {
      (newField as ObjectField).children = [];
    }

    containingObject.children.push(newField);
    this.updateCodePreview();
  }

  public onDeleteField(field: Field) {
    field.parent.children.splice(field.parent.children.findIndex(f => f.uiId === field.uiId), 1);
    this.updateCodePreview();
  }

  public onFieldNameChanged(field: Field) {
    this.updateCodePreview();
  }

  public onCredentialTypeChanged(target: any) {
    this.updateCodePreview();
  }

  public buildDataIsValid(): boolean {
    return !this.buildService.validateBuildData(this.shortType, this.rootObject);
  }

  private getContextUrl(): string {
    return this.authService.signedInDID() + "#" + this.shortType;
  }

  private async updateCodePreview() {
    let { credentialId, unicitySuffix } = this.buildService.generateCredentialId(this.shortType, this.credentialTypeUnicitySuffix);
    this.credentialId = credentialId;
    this.credentialTypeUnicitySuffix = unicitySuffix;

    this.validationErrorMessage = this.buildService.validateBuildData(this.shortType, this.rootObject);
    if (this.validationErrorMessage)
      return;

    this.credentialTypeJson = this.buildService.buildCredentialTypeJson(this.credentialId, this.shortType, this.rootObject.children);
    this.codePreviewHtml = prettyPrintJson.toHtml(this.credentialTypeJson, {
      quoteKeys: true,
      linkUrls: false
    });
  }

  public async publishCredentialType() {
    this.publishing = true;
    let publishedType = await this.credentialsService.publishCredential(this.credentialId, this.shortType, this.credentialTypeJson);
    if (publishedType) {
      this.wasPublished = true;
      this.publishedCredentialType = publishedType;
      console.log("Published credential type:", this.publishedCredentialType);
    }
    else {
      this.publishing = false;
      this._snackBar.open("Failed to publish...", null, {
        duration: 5000
      });
    }
  }

  public viewCredentialType() {
    let queryParams: TypeDetailsPageParams = {
      context: this.publishedCredentialType.context,
      shortType: this.publishedCredentialType.shortType
    };

    this.router.navigate(["/typedetails"], {
      queryParams
    });
  }
}
