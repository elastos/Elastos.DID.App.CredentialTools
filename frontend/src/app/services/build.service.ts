/*
 * Copyright (c) 2021 Elastos Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Injectable } from '@angular/core';
import { Field } from '../model/build/field';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class BuildService {
  constructor(private authService: AuthService) { }

  public generateCredentialId(credentialType: string): string {
    let randomCredentialIdNumber = Math.floor((Math.random() * 10000000));
    return `${credentialType}${randomCredentialIdNumber}`;
  }

  public buildCredentialTypeJson(credentialId: string, credentialType: string, fields: Field[]): unknown {
    let signedInDID = this.authService.signedInDID();
    let didIdentifierOnly = signedInDID.replace("did:elastos:", "");
    // Format: did://elastos/did-identifier-only/credentialType314314
    let resolveUrl = `did://elastos/${didIdentifierOnly}/${credentialId}`;

    let json: any = {
      "@context": {
        "@version": 1.1,
        "schema": "http://schema.org/",
        "xsd": "http://www.w3.org/2001/XMLSchema#",

        //"SuperCredential": `${resolveUrl}#SuperCredential`,

        /* "customField": {
          "@id": `${resolveUrl}#customField`,
          "@type": "xsd:Name"
        },

        "customObject": {
          "@id": `${resolveUrl}#customObject`,
          "@type": "@id",

          "@context": {
            "id": `@id`,
            "type": "@type",

            "customField": {
              "@id": `${resolveUrl}#customField`, "@type": "xsd:string"
            },

            "avatar": {
              "@id": "${resolveUrl}#avatar",
              "@type": "[ANOTHER-published-cred-type-url]#Avatar"
            },
          }
        } */
      }
    }

    // Credential type: "DiplomaCredential": "https://trinity-tech.io/credentials/diploma#DiplomaCredential",
    json["@context"][credentialType] = `${resolveUrl}#${credentialType}`;

    for (let field of fields) {
      json["@context"][field.name] = {
        "@id": `${resolveUrl}#${field.name}`,
        "@type": field.type
      }
    }

    return json;
  }
}
