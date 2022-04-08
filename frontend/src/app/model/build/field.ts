import { v4 as uuidv4 } from "uuid";

export enum FieldType {
  STRING,
  BOOLEAN,
  NUMBER,
  OBJECT
}

export type Field = {
  parent: ObjectField; // Containing parent
  uiId: string; // Random identitier just for the UI, not related to generation
  name: string; // Used defined name
  type: FieldType; // Data type
}

export type ObjectField = Field & {
  children: Field[];
}

export const newEmptyObjectField = (): ObjectField => {
  return {
    parent: null,
    name: null,
    uiId: uuidv4(),
    type: FieldType.OBJECT,
    children: []
  }
}

export type FieldTypeInfo = {
  type: FieldType;
  displayableType: string;
  jsonLdType: string;
}

export const fieldTypes: FieldTypeInfo[] = [
  {
    type: FieldType.STRING,
    displayableType: "String",
    jsonLdType: "xsd:string"
  },
  {
    type: FieldType.BOOLEAN,
    displayableType: "Boolean",
    jsonLdType: "xsd:boolean"
  },
  {
    type: FieldType.NUMBER,
    displayableType: "Number",
    jsonLdType: "xsd:number"
  },
  {
    type: FieldType.OBJECT,
    displayableType: "Object",
    jsonLdType: "xsd:object"
  }
];