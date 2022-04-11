import { Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  public signingIn = false;

  constructor(private authService: AuthService) { }

  public async signIn() {
    this.signingIn = true;
    await this.authService.signIn();
    this.signingIn = false;
  }
}
