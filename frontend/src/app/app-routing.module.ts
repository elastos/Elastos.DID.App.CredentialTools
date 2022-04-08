import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuildComponent } from './pages/build/build.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { TypeDetailsComponent } from './pages/typedetails/typedetails.component';
import { VerifyComponent } from './pages/verify/verify.component';
import { AuthGuardService } from './services/auth-guard.service';

const routes: Routes = [
  { path: 'signin', component: LoginComponent },
  { path: 'build', component: BuildComponent, canActivate: [AuthGuardService] },
  { path: 'verify', component: VerifyComponent },
  { path: 'typedetails', component: TypeDetailsComponent },

  { path: '**', component: HomeComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: "top" })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
