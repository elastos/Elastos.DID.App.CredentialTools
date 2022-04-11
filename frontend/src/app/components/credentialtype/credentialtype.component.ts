import { Clipboard } from '@angular/cdk/clipboard';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import moment from 'moment';
import Prism from "prismjs";
import { FieldType, ObjectField } from 'src/app/model/build/field';
import { CredentialType } from 'src/app/model/credentialtype';
import { BuildPageParams } from 'src/app/pages/build/build.component';
import { AuthService } from 'src/app/services/auth.service';
import { BuildService } from 'src/app/services/build.service';
import { CredentialsService } from 'src/app/services/credentials.service';
import { DIDService } from 'src/app/services/did.service';

type Mode = "listing" | "details";

@Component({
  selector: 'credential-type',
  templateUrl: './credentialtype.component.html',
  styleUrls: ['./credentialtype.component.scss']
})
export class CredentialTypeComponent {
  @ViewChild('propertiesCode') propertiesCode: ElementRef<HTMLElement>;

  public _credentialType: CredentialType = null;

  @Input()
  set credentialType(ct: CredentialType) {
    this._credentialType = ct;
    this.prepareModel();
  }

  @Input()
  public mode: Mode = "listing";

  // Pre-computed model
  private rootObject: ObjectField = null;
  public propertiesSourceCode: string = null;
  public displayableDescription: string = null;

  constructor(
    private clipboard: Clipboard,
    private _snackBar: MatSnackBar,
    private router: Router,
    private didService: DIDService,
    private authService: AuthService,
    private builderService: BuildService,
    private credentialsService: CredentialsService
  ) { }

  /**
   * Precompute / get some data ready after receiving a new credentialType value
   */
  private prepareModel() {
    this.rootObject = this.builderService.extractObjectFieldFromCredentialType(this._credentialType);
    this.propertiesSourceCode = this.getPropertiesSourceCode(this.rootObject);

    this.displayableDescription = this._credentialType.description || "";

    setTimeout(() => {
      Prism.highlightElement(this.propertiesCode.nativeElement);
    }, 500);
  }

  private getPropertiesSourceCode(root: ObjectField, parent: ObjectField = null, indentLevel = 0): string {
    let indent = "  ".repeat(indentLevel);
    let childrenIndent = "  ".repeat(indentLevel + 1);

    // Filter out unwanted fields
    root.children = root.children.filter(c => !this.propExcludedFromDisplayList(c.name));

    console.log("root", root)


    let code = "";
    if (!parent) // In sub-object or not?
      code = indent;

    code += "{" + (root.children.length === 0 ? "" : "\n");

    for (let prop of root.children) {
      let listComment = prop.canBeAList ? ` // Single entry of type ${prop.name}, or array of ${prop.name}` : "";

      if (prop.type !== FieldType.OBJECT) {
        let typeInfo = prop.getFieldTypeInfo();
        code += childrenIndent + "\"" + prop.name + "\": \"" + typeInfo.jsonLdType + "\"" + listComment + "\n";
      }
      else {
        code += childrenIndent + "\"" + prop.name + "\": " + this.getPropertiesSourceCode(prop as ObjectField, prop as ObjectField, indentLevel + 1);
      }
    }
    let listComment = root.canBeAList ? ` // Single entry of type ${root.name}, or array of ${root.name}` : "";
    code += (root.children.length >= 0 ? indent : "") + "}" + listComment + "\n"; // } on the same line as its {, or not

    return code;
  }

  private propExcludedFromDisplayList(prop: string): boolean {
    return [
      "VerifiableCredential",
      "VerifiablePresentation",
      "EcdsaSecp256k1Signature2019",
      "ECDSAsecp256r1",
      "RsaSignature2018",
      "Ed25519Signature2018",
      "EcdsaSecp256r1Signature2019",
      "proof"
    ].indexOf(prop) >= 0;
  }

  public hasProperties(): boolean {
    return this.propertiesSourceCode != null;
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

  /**
   * Opens this type in the builder for editing and possibly overwriting of a previous
   * version.
   */
  public editType() {
    let queryParams: BuildPageParams = {
      mode: "edit",
      context: this._credentialType.context,
      shortType: this._credentialType.shortType
    };

    this.router.navigate(["/build"], {
      queryParams
    });
  }

  /**
   * Opens this type in the builder to create a new type, using the same format as the current type
   * to not restart the new type from scratch.
   */
  public cloneType() {
    let queryParams: BuildPageParams = {
      mode: "clone",
      context: this._credentialType.context,
      shortType: this._credentialType.shortType
    };

    this.router.navigate(["/build"], {
      queryParams
    });
  }

  /**
   * Tells if the currently signed in user if the owner of this credential type.
   */
  public userIsOwner(): boolean {
    return this._credentialType && this._credentialType.elastosEIDChain &&
      this._credentialType.elastosEIDChain.publisher === this.authService.signedInDID();
  }

  public shortDid(did: string): string {
    return this.didService.shortDIDDisplay(did);
  }

  public getDisplayableAppName(appName: string): string {
    return appName ? appName : "Unnamed app";
  }

  /**
   * Tells if we want to allow this type to be clone. Doesn't make sense for
   * some kind of types.
   */
  public canClone(): boolean {
    // Exclusion list
    return [
      "VerifiableCredential",
    ].indexOf(this._credentialType.shortType) < 0;
  }
}
