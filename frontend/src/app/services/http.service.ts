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
import { CommonResponse } from '../model/response';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  constructor(private authService: AuthService) { }

  public async postBackEndAuthenticatedJson<T>(url: string, body: Object): Promise<CommonResponse<T>> {
    let response = await fetch(`${process.env.NG_APP_API_URL}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": this.authService.getAuthToken()
      },
      body: JSON.stringify(body)
    });

    if (response && response.status === 200) {
      let textContent = await response.text();
      let jsonContent = textContent ? JSON.parse(textContent) : null;

      return {
        code: response.status,
        data: jsonContent as T
      };
    }
    else {
      return {
        code: response.status,
        errorMessage: await response.text()
      }
    }
  }
}
