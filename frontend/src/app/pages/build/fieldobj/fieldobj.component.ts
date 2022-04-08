import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Field, FieldType, ObjectField } from 'src/app/model/build/field';
import { BuildService } from 'src/app/services/build.service';

@Component({
  selector: 'fieldobj',
  templateUrl: './fieldobj.component.html',
  styleUrls: ['./fieldobj.component.scss']
})
export class FieldObjectComponent {
  @Input("object")
  public rootObject: ObjectField;

  @Output("onDeleteField")
  private _onDeleteField?= new EventEmitter();

  @Output("onAddField")
  private _onAddField?= new EventEmitter();

  @Output("onFieldNameChanged")
  private _onFieldNameChanged?= new EventEmitter();

  constructor(
    public buildService: BuildService
  ) { }

  /**
   * "Delete field" clicked on this screen
   */
  public deleteField(field: Field) {
    this.onDeleteField(field);
  }

  /**
   * Forward event up to the top page
   */
  public onDeleteField(field: Field) {
    this._onDeleteField.emit(field);
  }

  /**
   * Input field modified in this component.
   */
  public fieldNameChanged(field: Field, target: any) {
    this.onFieldNameChanged(field);
  }

  /**
   * Forward event up to the top page
   */
  public onFieldNameChanged(field: Field) {
    this._onFieldNameChanged.emit(field);
  }

  /**
   * "Add field" button clicked in this object. Emit event so that the containing page
   * knows we want to add a field in the current field object
   */
  addField(): void {
    this.onAddField(this.rootObject);
  }

  /**
   * Forward event up to the top page
   */
  public onAddField(fieldObject: ObjectField): void {
    this._onAddField.emit(fieldObject);
  }

  public fieldIsSubObject(field: Field): boolean {
    return field.type === FieldType.OBJECT;
  }

  public fieldAsSubObject(field: Field): ObjectField {
    return field as ObjectField;
  }
}
