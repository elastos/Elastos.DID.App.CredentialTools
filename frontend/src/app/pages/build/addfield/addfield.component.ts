import { Component } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FieldType } from 'src/app/model/build/field';

@Component({
  selector: 'add-field-sheet',
  templateUrl: 'addfield.component.html',
  styleUrls: ['./addfield.component.scss']
})
export class AddFieldSheetComponent {
  public addFieldSearch: string = "";

  constructor(private _bottomSheetRef: MatBottomSheetRef<AddFieldSheetComponent>) { }

  selectString() {
    this._bottomSheetRef.dismiss(FieldType.STRING);
  }

  selectBoolean() {
    this._bottomSheetRef.dismiss(FieldType.BOOLEAN);
  }

  selectNumber() {
    this._bottomSheetRef.dismiss(FieldType.NUMBER);
  }

  selectObject() {
    this._bottomSheetRef.dismiss(FieldType.OBJECT);
  }
}