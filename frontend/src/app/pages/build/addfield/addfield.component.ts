import { Component } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';

@Component({
  selector: 'add-field-sheet',
  templateUrl: 'addfield.component.html',
})
export class AddFieldSheetComponent {
  public addFieldSearch: string = "";

  constructor(private _bottomSheetRef: MatBottomSheetRef<AddFieldSheetComponent>) { }

  selectString() {
    this._bottomSheetRef.dismiss("xsd:string");
  }
}