import { ClipboardModule } from '@angular/cdk/clipboard';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { JwtModule } from '@auth0/angular-jwt';
import 'prismjs';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-typescript';
import 'prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard';
import 'prismjs/plugins/toolbar/prism-toolbar';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ComponentsModule } from './components/module';
import { AddFieldSheetComponent } from './pages/build/addfield/addfield.component';
import { BuildComponent } from './pages/build/build.component';
import { FieldObjectComponent } from './pages/build/fieldobj/fieldobj.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { TypeDetailsComponent } from './pages/typedetails/typedetails.component';
import { VerifyComponent } from './pages/verify/verify.component';


@NgModule({
  declarations: [
    // Pages
    AppComponent,
    HomeComponent,
    BuildComponent,
    LoginComponent,
    VerifyComponent,
    TypeDetailsComponent,

    // UI components
    FieldObjectComponent,

    // Sheets
    AddFieldSheetComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatButtonModule,
    MatBottomSheetModule,
    MatSnackBarModule,
    MatGridListModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatIconModule,
    ClipboardModule,
    ComponentsModule,
    JwtModule.forRoot({})
  ],
  providers: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
