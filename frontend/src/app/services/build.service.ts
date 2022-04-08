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
import { v4 as uuidv4 } from "uuid";
import { Field, FieldType, FieldTypeInfo, fieldTypes, newEmptyObjectField, ObjectField } from '../model/build/field';
import { ContextPayload } from '../model/context';
import { CredentialType, mostRecentPayload } from '../model/credentialtype';
import { AuthService } from './auth.service';
import { hasSpaces } from './utils';

type IdMap = { [id: string]: number };

export type CredentialTypeBuilderInfo = {
  credentialTypeName: string;
  rootObject: ObjectField;
}

@Injectable({
  providedIn: 'root'
})
export class BuildService {
  constructor(private authService: AuthService) { }

  /**
   * From a credential short type (eg: MyCredType), generates a unique ID to use in published VCs.
   * If unicitySuffix is not passed, a new random ID is generated and returned. 
   * If unicitySuffix is passed, it is reused.
   */
  public generateCredentialId(shortType: string, unicitySuffix?: string): { credentialId: string, unicitySuffix: string } {
    if (!unicitySuffix)
      unicitySuffix = `${Math.floor((Math.random() * 10000000))}`;

    return {
      credentialId: `${shortType}${unicitySuffix}`,
      unicitySuffix
    };
  }

  /**
   * From: MyCredType318932
   * To: 318932
   */
  public extractUnicitySuffixFromCredentialId(shortType: string, credentialId: string): string {
    return credentialId.replace(shortType, "");
  }

  /**
   * Checks some inputs to make sure everything is ready for json generation.
   * In case something is wrong, the first error met is returned as a displayable error message.
   */
  public validateBuildData(credentialType: string, object: ObjectField): string {
    if (credentialType === null || credentialType === "")
      return "Your credential type should have a name";

    if (hasSpaces(credentialType))
      return "Don't use spaces in the credential type name";

    return this.validatefield(object, true);
  }

  private validatefield(field: Field, isRoot = false): string {
    if (!isRoot && (field.name === null || field.name === ""))
      return "All fields must be named";

    if (!isRoot && hasSpaces(field.name))
      return "Avoid spaces in field names";

    if (field.type === FieldType.OBJECT) {
      for (let child of (field as ObjectField).children) {
        let validation = this.validatefield(child);
        if (validation) // Error
          return validation;
      }
    }

    return null;
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

    // Map of generated IDs. Used to avoid duplicate IDs in case of duplicate field names.
    // In case of duplicates, a ending digit is added.
    // The map is a id -> current ending digit list.
    let idMap: IdMap = {};

    // Credential type: "DiplomaCredential": "https://trinity-tech.io/credentials/diploma#DiplomaCredential",
    json["@context"][credentialType] = `${resolveUrl}#${credentialType}`;

    for (let field of fields) {
      this.writeField(json["@context"], field, resolveUrl, idMap);
    }

    return json;
  }

  private writeField(json: any, field: Field | ObjectField, resolveUrl: string, idMap: IdMap) {
    // Generate the field ID, making sure it was not in use already
    let id = `${resolveUrl}#${field.name}`;
    if (id in idMap) {
      // Duplicate - add a digit in the end
      let currentCount = idMap[id];
      currentCount++;
      idMap[id] = currentCount; // Increment for subsequent uses
      id += currentCount;
    }
    else {
      idMap[id] = 1;
    }

    if (field.type !== FieldType.OBJECT) {
      json[field.name] = {
        "@id": id,
        "@type": this.getFieldTypeInfo(field.type).jsonLdType
      }
    }
    else {
      json[field.name] = {
        "@id": id,
        "@type": '@id',
        "@context": {
          "id": "@id",
          "type": "@type"
        }
      };

      for (let child of (field as ObjectField).children) {
        this.writeField(json[field.name]["@context"], child, resolveUrl, idMap);
      }
    }
  }

  public getFieldTypeInfo(fieldType: FieldType): FieldTypeInfo {
    return fieldTypes.find(ft => ft.type === fieldType);
  }

  /**
   * Extracts credential type name (string) and fields from an existing credential type.
   * Used to edit and existing type.
   */
  public extractBuilderInfoFromExistingType(credentialType: CredentialType): CredentialTypeBuilderInfo {
    return {
      credentialTypeName: credentialType.shortType,
      rootObject: this.extractObjectFieldFromCredentialType(credentialType)
    }
  }

  /**
   * From a credential type, returns the list of properties that may be used by users
   * to implement credentials, together with their types.
   */
  public extractObjectFieldFromCredentialType(credentialType: CredentialType): ObjectField {
    if (!credentialType || !credentialType.contextPayloads)
      return newEmptyObjectField();

    let contextPayload: ContextPayload = mostRecentPayload(credentialType);

    return this.extractObjectFieldFromCredentialTypeJson(contextPayload['@context']);
  }

  public extractObjectFieldFromCredentialTypeJson(json: any, parent: ObjectField = null, name: string = null): ObjectField {
    let rootObject = newEmptyObjectField();
    rootObject.parent = parent;
    rootObject.name = name;

    let payloadKeys = Object.keys(json);
    for (let key of payloadKeys) {
      let item = json[key];

      // For now, only consider items that are format like this: field: { @id:"", @type:"xsd:string" }
      if (typeof item === "object") {
        if ("@type" in item) {
          switch (item["@type"]) {
            case "xsd:string":
            case "xsd:boolean":
            case "xsd:number":
              // Simple field
              rootObject.children.push({
                parent: rootObject,
                uiId: uuidv4(),
                name: key,
                type: this.getFieldTypeInfoFromJsonLdType(item["@type"]).type
              });
              break;
            case "@id":
              if ("@context" in item) {
                rootObject.children.push(this.extractObjectFieldFromCredentialTypeJson(item["@context"], rootObject, key as string));
              }
              break;
          }
        }
      }
    }

    return rootObject;
  }

  public getFieldTypeInfoFromJsonLdType(jsonLdType: string): FieldTypeInfo {
    return fieldTypes.find(ft => ft.jsonLdType === jsonLdType);
  }
}
