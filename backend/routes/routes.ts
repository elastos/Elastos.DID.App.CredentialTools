import { VerifiablePresentation } from '@elastosfoundation/did-js-sdk';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { SecretConfig } from '../config/env-secret';
import logger from '../logger';
import { authMiddleware } from '../middlewares/auth.middleware';
import { User } from '../model/user';
import { dbService } from '../services/db.service';

let router = Router();

/* Used for service check. */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/check', async (req, res) => {
    res.json(await dbService.checkConnect());
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/login', async (req, res) => {
    let presentationStr = req.body;
    let vp = VerifiablePresentation.parse(presentationStr);
    let valid = await vp.isValid();
    if (!valid) {
        res.json({ code: 403, message: 'Invalid presentation' });
        return;
    }

    let did = vp.getHolder().toString();
    if (!did) {
        res.json({ code: 400, message: 'Unable to extract owner DID from the presentation' })
        return;
    }

    // First check if we know this user yet or not. If not, we will create an entry
    let existingUser = await dbService.findUserByDID(did);
    let user: User;
    if (existingUser) {
        // Nothing to do yet
        logger.info("Existing user is signing in", existingUser);
        user = existingUser;
    }
    else {
        logger.info("Unknown user is signing in with DID", did, ". Creating a new user");

        // Optional name
        let nameCredential = vp.getCredential(`name`);
        let name = nameCredential ? nameCredential.getSubject().getProperty('name') : '';

        // Optional email
        let emailCredential = vp.getCredential(`email`);
        let email = emailCredential ? emailCredential.getSubject().getProperty('email') : '';

        user = {
            did,
            type: 'user',
            name,
            email,
            canManageAdmins: false
        };
        let result = await dbService.addUser(user);
        if (result.code != 200) {
            res.json(result);
            return;
        }
    }

    let token = jwt.sign(user, SecretConfig.Auth.jwtSecret, { expiresIn: 60 * 60 * 24 * 7 });
    res.json({ code: 200, message: 'success', data: token });
})

router.get('/currentUser', (req, res) => {
    res.json({ code: 200, message: 'success', data: req.user })
})

/**
 * Publish a new credential type
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/credentialtype', authMiddleware, async (req, res) => {
    let did = req.user.did;
    let { id, type, credentialType } = req.body;

    if (!id || !type || !credentialType) {
        return res.json({
            code: 403,
            message: "id, type or credentialType is missing"
        });
    }

    res.json(await dbService.publishCredentialType(did, id, type, credentialType));
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/credentialTypeByUrl', async (req, res) => {
    let credentialUrl = req.query.url as string;

    if (!credentialUrl) {
        return res.json({
            code: 403,
            message: "credentialUrl is missing"
        });
    }

    res.json(await dbService.getCredentialTypeByUrl(credentialUrl));
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/credentialtypes', async (req, res) => {
    let search = (req.query.search || "") as string;
    res.json(await dbService.getCredentialTypes(search));
});

export default router;
