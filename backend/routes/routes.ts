import { VerifiablePresentation } from '@elastosfoundation/did-js-sdk';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { SecretConfig } from '../config/env-secret';
import logger from '../logger';
import { authMiddleware } from '../middlewares/auth.middleware';
import { apiError } from '../model/api';
import { convertedError, hasError, invalidParamError } from '../model/dataorerror';
import { User } from '../model/user';
import { credentialTypeService } from '../services/credentialtype.service';
import { dbService } from '../services/db.service';
import { statsService } from '../services/stats.service';
import { userService } from '../services/user.service';

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
    let existingUser = await userService.findUserByDID(did);
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
        let [error, result] = await userService.addUser(user);
        if (hasError(error)) {
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
 * Issues a new credential type, signed by this back-end, to the user.
 *
 * @returns JSON object of the credential type credential created
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/credentialtype/issue', authMiddleware, async (req, res) => {
    let did = req.user.did;
    let { id, type, credentialType } = req.body;

    if (!id || !type || !credentialType) {
        return apiError(res, invalidParamError("id, type or credentialType is missing"));
    }

    let [error, data] = await credentialTypeService.issueCredentialType(did, id, type, credentialType)

    if (hasError(error))
        return apiError(res, convertedError(error));

    res.json(JSON.parse(data));
});

/**
 * Registers a new credential type into database for further listing on the front-end.
 * The credential is first checked online to make sure is really exists and was published
 * successfully by user's identity wallet.
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/credentialtype/register', authMiddleware, async (req, res) => {
    //let did = req.user.did;
    let { serviceId } = req.body;

    if (!serviceId) {
        return apiError(res, invalidParamError("serviceId is missing"));
    }

    let [error, credentialType] = await credentialTypeService.registerEIDCredentialType(serviceId);

    if (hasError(error))
        return apiError(res, convertedError(error));

    res.json(credentialType);
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/credentialTypeByContextUrl', async (req, res) => {
    let { contextUrl, shortType } = req.query;

    if (!contextUrl)
        return apiError(res, invalidParamError("context 'url' is missing"));

    let [error, data] = await credentialTypeService.getCredentialTypeByContextUrl(contextUrl as string, shortType as string);
    if (hasError(error))
        return apiError(res, convertedError(error));

    res.json(data);
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/credentialtypes', async (req, res) => {
    let search = (req.query.search || "") as string;

    let [error, data] = await credentialTypeService.getCredentialTypes(search);
    if (hasError(error))
        return apiError(res, convertedError(error));

    res.json(data);
});

/********************
 **** STATISTICS ****
 ********************/

/**
 * Posts usage statistics (owned and used credential types) from the identity wallet
 * to this service, to data aggregation purpose (enrich credential types on the toolbox with
 * more info and better order).
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/statistics/', async (req, res) => {
    res.json(await statsService.handleIncomingStats(req.body));
});

export default router;
