import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { SecretConfig } from "../config/env-secret";
import { userService } from "../services/user.service";

type DIDAuthTokenPayload = {
    did: string;
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.path !== "/api/v1/login" && req.path != "/api/v1/check") {
        let token = req.headers['token'] as string;
        if (token) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            jwt.verify(token, SecretConfig.Auth.jwtSecret, async (error, decoded) => {
                if (error || !decoded) {
                    res.json({ code: 403, message: 'Token verify failed' })
                } else {
                    let tokenPayload = <DIDAuthTokenPayload>decoded;
                    let user = await userService.findUserByDID(tokenPayload.did);
                    if (user) {
                        req.user = user;
                        next();
                    }
                }
            })
        } else {
            res.json({ code: 403, message: 'Can not find the token' });
        }
    } else {
        next();
    }
}
