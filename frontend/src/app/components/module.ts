import { ClipboardModule } from '@angular/cdk/clipboard';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserModule } from '@angular/platform-browser';
import { CloudsComponent } from './clouds/clouds.component';
import { CredentialTypeComponent } from './credentialtype/credentialtype.component';
import { ToolbarComponent } from './toolbar/toolbar.component';

@NgModule({
  declarations: [
    ToolbarComponent,
    CloudsComponent,
    CredentialTypeComponent
  ],
  imports: [
    BrowserModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    MatIconModule,
    BrowserModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    FormsModule,
    MatIconModule,
    ClipboardModule
  ],
  exports: [
    ToolbarComponent,
    CloudsComponent,
    CredentialTypeComponent
  ],
  providers: [],
})
export class ComponentsModule { }
