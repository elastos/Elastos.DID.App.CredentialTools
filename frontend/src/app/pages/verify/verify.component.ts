import { Component, ViewEncapsulation } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import * as jsonld from "jsonld";
import { NodeObject } from 'jsonld';
import { Url } from 'jsonld/jsonld-spec';
import { prettyPrintJson } from 'pretty-print-json';
import { BuildService } from 'src/app/services/build.service';
import { CredentialsService } from 'src/app/services/credentials.service';

type JsonLdError = {
  details: {
    url: string; // ie "https://elastos.org/credentials/v1"
  },
  message: string; // ie "Dereferencing a URL did not result in a valid JSON-LD object. Possible causes are an inaccessible URL perhaps due to a same-origin policy (ensure the server uses CORS if you are using client-side JavaScript), too many redirects, a non-JSON response, or more than one HTTP Link Header was provided for a remote context."
  name: string; // ie "jsonld.InvalidUrl"
}

// Missing in JSONLD types
type RemoteDocument = {
  contextUrl?: Url | undefined;
  documentUrl: Url;
  document: unknown; // raw data
}

class JsonLdParsingError {
  constructor(public message: string) { }
}

class UrlUnreachableError extends JsonLdParsingError {
  constructor(message: string, public url: string) {
    super(message);
  }
}

class InvalidJsonError extends JsonLdParsingError {
  constructor(message: string) {
    super(message);
  }
}

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class VerifyComponent {
  public credentialContent: string = null;
  public codePreviewHtml: string = "";
  public parseResult: "error" | "success" | "warning" | "idle" = "idle";
  public error: JsonLdParsingError = null;
  public previewDisplayMode = "compact";

  constructor(
    private _bottomSheet: MatBottomSheet,
    private buildService: BuildService,
    private router: Router,
    private credentialsService: CredentialsService) {
    this.verify();
  }

  public onCredentialContentChanged(target: any) {
    this.verify();
  }

  public onDisplayModeChanged() {
    this.verify();
  }

  // TOOD: Before calling jsonld, check that @context contains "https://www.w3.org/2018/credentials/v1" as first entry (W3C spec)
  private async verify() {
    // Reset the previous error
    this.parseResult = "idle";

    if (!this.credentialContent || this.credentialContent === "")
      return;

    try {
      let credentialContentJson = JSON.parse(this.credentialContent);

      if (this.previewDisplayMode === "compact") {
        let compacted = await jsonld.compact(credentialContentJson, credentialContentJson["@context"], {
          documentLoader: this.buildElastosJsonLdDocLoader()
        });

        if (compacted) {
          // Check what original fields are missing after compacting to visually show this
          // problem to the user.
          let { modifiedDoc, warningsGenerated } = this.addMissingFieldsToCompactHtmlResult(credentialContentJson, compacted);

          this.codePreviewHtml = prettyPrintJson.toHtml(modifiedDoc, {
            quoteKeys: true,
            linkUrls: false
          });

          // Style the missing items
          this.codePreviewHtml = this.codePreviewHtml.replace(/<span class=json-key>"MISSING_KEY_([a-zA-Z0-9]+)"<\/span>/g, '<span class="json-missing-key">"$1"<\/span>');

          if (!warningsGenerated)
            this.handleJsonLdParsingSuccess();
          else
            this.parseResult = "warning";
        }
        else {
          this.handleJsonLdParsingError(new Error("Empty response from the JsonLD parser"));
        }
      }
      else {
        // Expanded
        const expanded = await jsonld.expand(credentialContentJson, {
          documentLoader: this.buildElastosJsonLdDocLoader()
        });

        if (expanded && expanded.length > 0) {
          //this.codePreview = JSON.stringify(compacted, null, 2);
          this.codePreviewHtml = prettyPrintJson.toHtml(expanded[0], {
            quoteKeys: true,
            linkUrls: false
          });
          this.handleJsonLdParsingSuccess();
        }
        else {
          this.handleJsonLdParsingError(new Error("Empty response from the JsonLD parser"));
        }
      }
    }
    catch (e) {
      console.error(e)
      this.handleJsonLdParsingError(e);
    }
  }

  // TODO: RECURSIVE
  private addMissingFieldsToCompactHtmlResult(originalUserDoc: any, compactedDoc: any): { modifiedDoc: NodeObject, warningsGenerated: boolean } {
    let warningsGenerated = false;
    let modifiedCompactedDoc = Object.assign({}, compactedDoc);
    for (let key of Object.keys(originalUserDoc.credentialSubject)) {
      if (!(key in compactedDoc.credentialSubject)) {
        modifiedCompactedDoc.credentialSubject["MISSING_KEY_" + key] = "This field is missing in credential types";
        warningsGenerated = true;
      }
    }
    return {
      modifiedDoc: modifiedCompactedDoc,
      warningsGenerated
    };
  }

  private buildElastosJsonLdDocLoader(): { (url: Url, callback: any): Promise<any> } {
    return (url: Url, callback: any) => {
      return new Promise(async resolve => {
        if (url.startsWith("did")) {
          console.log("Loader is resolving url using our DID loader", url);

          // NOTE: this is temporary while we don't store credentials on chain. Replace this with
          // chain resolving later.
          // Convert urls such as: did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential7562980#DiplomaCredential
          // into local toolbox API call: http://apiurl/api/v1/credentialTypeByUrl?url=did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential7562980#DiplomaCredential
          let credentialTypeData = await this.credentialsService.getCredentialTypeByUrl(url);
          console.log("Received data", credentialTypeData)
          resolve({
            contextUrl: null,
            documentUrl: url,
            document: credentialTypeData
          });
        }
        else {
          console.log("Loader is resolving url using default jsonld loader", url);
          let defaultLoader = (jsonld as any).documentLoaders.xhr();
          let data = await defaultLoader(url);
          console.log("Default data:", data)
          resolve(data);
        }
      });
    }
  }

  private handleJsonLdParsingSuccess() {
    this.parseResult = "success";
  }

  private handleJsonLdParsingError(e: any) {
    this.parseResult = "error";

    if (e.hasOwnProperty("details")) {
      let jsonLdError = e as JsonLdError;
      console.warn("JSONLD specific error", jsonLdError.name, jsonLdError.details.url);

      if (jsonLdError.name === "jsonld.InvalidUrl") {
        this.error = new UrlUnreachableError("A url is possibly unreachable.", jsonLdError.details.url);
      }
      else {
        throw new Error("Unhandled JSONLD error type: " + jsonLdError.message);
      }
    }
    else {
      //console.warn("JSONLD other error", e);

      if (new String(e).indexOf("Unexpected token") >= 0)
        this.error = new InvalidJsonError("JSON syntax error, make sure your json is valid.");
      else
        throw new Error("Unhandled other error type: " + e);
    }
  }

  public errorIsUnreachableUrl(): boolean {
    return this.error instanceof UrlUnreachableError;
  }

  public getUrlUnreachableError(): UrlUnreachableError {
    return this.error as UrlUnreachableError;
  }

  public getGenericErrorMessage(): string {
    return this.error.message;
  }
}
