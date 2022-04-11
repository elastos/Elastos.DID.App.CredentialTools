import { v4 as uuidv4 } from "uuid";

export enum FieldType {
  STRING,
  BOOLEAN,
  NUMBER,
  OBJECT,
  CUSTOM
}

export class Field {
  public uiId: string; // Random identitier just for the UI, not related to generation
  public canBeAList = false; // Some fields can contain either a single value, or an array of values of this type

  constructor(
    public parent: ObjectField, // Containing parent
    public name: string, // Used defined name
    public type: FieldType, // Data type
    public customType?: FieldTypeInfo // For custom (FieldType.CUSTOM) types, use this as a replacement
  ) {
    this.uiId = uuidv4();
  }

  public getFieldTypeInfo(): FieldTypeInfo {
    return this.customType || getFieldTypeInfo(this.type);
  }
}

export class ObjectField extends Field {
  public children: Field[] = [];
}

export const newEmptyObjectField = (): ObjectField => {
  return new ObjectField(null, null, FieldType.OBJECT);
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

export const getFieldTypeInfo = (fieldType: FieldType): FieldTypeInfo => {
  return fieldTypes.find(ft => ft.type === fieldType);
}

export const getFieldTypeInfoFromJsonLdType = (jsonLdType: string): FieldTypeInfo => {
  return fieldTypes.find(ft => ft.jsonLdType === jsonLdType);
}