import { Component, ElementRef, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Prism from "prismjs";
import { ObjectField } from 'src/app/model/build/field';
import { CredentialType } from 'src/app/model/credentialtype';
import { BuildService } from 'src/app/services/build.service';
import { CredentialsService } from 'src/app/services/credentials.service';

export type TypeDetailsPageParams = {
  context: string;
  shortType: string
}

@Component({
  selector: 'app-typedetails',
  templateUrl: './typedetails.component.html',
  styleUrls: ['./typedetails.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TypeDetailsComponent implements OnInit {
  @ViewChild('createCredentialSample') createCredentialSample: ElementRef<HTMLElement>;
  @ViewChild('requestCredentialSample') requestCredentialSample: ElementRef<HTMLElement>;

  public context: string;
  public shortType: string;
  public credentialType: CredentialType;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private builderService: BuildService,
    private credentialsService: CredentialsService) {
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      let typedParams = params as TypeDetailsPageParams;

      this.context = typedParams.context;
      this.shortType = typedParams.shortType;

      if (!this.context || !this.shortType) {
        console.warn("Credential type details screen called without context or short type, redirecting to home");
        this.router.navigate(["/home"]);
        return;
      }

      this.credentialsService.fetchCredentialType(this.context, this.shortType).then(ct => {
        this.credentialType = ct;

        setTimeout(() => {
          Prism.highlightElement(this.createCredentialSample.nativeElement);
          Prism.highlightElement(this.requestCredentialSample.nativeElement);
        }, 500);
      });
    });
  }

  public getCredentialTypeMainProperties(): ObjectField {
    return this.builderService.extractObjectFieldFromCredentialType(this.credentialType);
  }

  public getCreateCredentialSampleSourceCode(): string {
    let code = "";

    code += "let credential = new VerifiableCredential.Builder(issuer, targetDID)\n";
    code += "   .id('#YourCredentialUniqueIdentifier')\n";
    code += `   // Mandatory: use this credential type and fill the associated properties with data\n`;
    code += `   .typeWithContext("${this.credentialType.shortType}", "${this.credentialType.context}")\n`;

    let rootObject = this.getCredentialTypeMainProperties();
    for (let field of rootObject.children) {
      code += `   .property("${field.name}", "Your value here")\n`;
    }

    code += `   // Optional: implement the standard DisplayableCredential for better display in wallets\n`;
    code += `   .typeWithContext("DisplayableCredential", "https://ns.elastos.org/credentials/displayable/v1")\n`;
    code += `   .property("displayable", {\n`;
    code += `       icon: "https://icon.that.users.will.see.png",\n`;
    code += `       title: "Title that users will see",\n`;
    code += `       description: "Short description that users will see"\n`;
    code += `   })\n`;

    code += `   // Sign\n`;
    code += `   .seal("didStorePassword");`;

    return code;
  }

  public getRequestCredentialSampleSourceCode() {
    let code = "";

    code += `import { DID as ConnDID } from "@elastosfoundation/elastos-connectivity-sdk-js";\n\n`;

    code += `let presentation = await new ConnDID.DIDAccess().requestCredentials({\n`;
    code += `  claims: [\n`;
    code += `    ConnDID.simpleTypeClaim("To populate your profile", "${this.credentialType.context}#${this.credentialType.shortType}")\n`;
    code += `  ]\n`;
    code += `});`;

    return code;
  }
}
