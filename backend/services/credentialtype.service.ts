import { DID, DIDURL, Issuer, JSONObject } from "@elastosfoundation/did-js-sdk";
import fetch from "node-fetch";
import logger from "../logger";
import { CredentialType, CredentialTypeMedium } from "../model/credentialtype";
import { DataOrError, dataOrErrorData, invalidParamError, serverError, stateError } from "../model/dataorerror";
import { dbService } from "./db.service";
import { didService } from "./did.service";

/*
toolbox creation:
    - credential short type
    - stored on EID chain (context url) like did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential6206269
    - stored locally on mongo as a new credential type (context url + short type)

toolbox search/display:
- we want to search credential TYPES. This is what developers want.
- we want to know stats for this TYPE.
- we want to search for fields inside a type (@context inside the type field like on https://www.w3.org/2018/credentials/v1)

- after searching what do we do? we want to use for generating creds = we want to use CONTEXT + TYPE
- we need to store context url + context data + last fetch date + short type + keywords inside a "credential type" collection

stats:
    - essentials:
        - credential -> 2 arrays of context urls (multiple) + credential short types (multiple)
        - for each short type, find it in a context in the root @context item
        - send stats for pairs of context+type

    - backend:
        - discover types:
            - fetch each context url
            - store a new credential type entry in mongo (context / short type pair)

        - build stats:
            - find mongo cred type from context url + type
            - update stats inside this object
*/

export const CREDENTIAL_TYPES_COLLECTION = "credential_types";

type PreloadedCredentialTypeInfo = {
    context: string; // eg: 'https://ns.elastos.org/credentials/v1'
    type: string; // Short type that we want to extract from there. eg: 'SelfProclaimedCredential'
}

/**
 * List of hardcoded types that we want to preload into database, in case they are not already.
 * This is useful to not start empy before the discovery mechanism (from stats) starts to populate
 * the database by other means.
 *
 * Those can be HTTPS or EID CHAIN types.
 */
const PRELOADED_CREDENTIAL_TYPES: PreloadedCredentialTypeInfo[] = [
    // W3C
    { context: "https://www.w3.org/2018/credentials/v1", type: "VerifiableCredential" },

    // Elastos - Base
    { context: "https://ns.elastos.org/credentials/v1", type: "SelfProclaimedCredential" },
    { context: "https://ns.elastos.org/credentials/v1", type: "SensitiveCredential" },
    { context: "https://ns.elastos.org/credentials/displayable/v1", type: "DisplayableCredential" },
    { context: "https://ns.elastos.org/credentials/context/v1", type: "ContextDefCredential" },

    // Elastos - Profile
    { context: "https://ns.elastos.org/credentials/profile/nationality/v1", type: "NationalityCredential" },
    { context: "https://ns.elastos.org/credentials/profile/gender/v1", type: "GenderCredential" },
    { context: "https://ns.elastos.org/credentials/profile/url/v1", type: "URLCredential" },
    { context: "https://ns.elastos.org/credentials/profile/description/v1", type: "DescriptionCredential" },
    { context: "https://ns.elastos.org/credentials/profile/gender/v1", type: "GenderCredential" },
    { context: "https://ns.elastos.org/credentials/profile/avatar/v1", type: "AvatarCredential" },
    { context: "https://ns.elastos.org/credentials/profile/name/v1", type: "NameCredential" },
    { context: "https://ns.elastos.org/credentials/profile/email/v1", type: "EmailCredential" },

    // Elastos - Wallet
    { context: "https://ns.elastos.org/credentials/wallet/v1", type: "WalletCredential" },

    // Elastos - Social
    { context: "https://ns.elastos.org/credentials/social/twitter/v1", type: "TwitterCredential" },
    { context: "https://ns.elastos.org/credentials/social/tumblr/v1", type: "TumblrCredential" },
    { context: "https://ns.elastos.org/credentials/social/wechat/v1", type: "WechatCredential" },
    { context: "https://ns.elastos.org/credentials/social/facebook/v1", type: "FacebookCredential" },
    { context: "https://ns.elastos.org/credentials/social/telegram/v1", type: "TelegramCredential" },
    { context: "https://ns.elastos.org/credentials/social/weibo/v1", type: "WeiboCredential" },
    { context: "https://ns.elastos.org/credentials/social/instagram/v1", type: "InstagramCredential" },
    { context: "https://ns.elastos.org/credentials/social/linkedin/v1", type: "LinkedinCredential" },
    { context: "https://ns.elastos.org/credentials/social/qq/v1", type: "QQCredential" }
];


type BuiltInTypeDescription = {
    context: string;
    type: string;
    description: string;
}

const builtInDescriptions: BuiltInTypeDescription[] = [
    {
        context: "https://www.w3.org/2018/credentials/v1",
        type: "VerifiableCredential",
        description: "This is the base type for all verifiable credentials. All credentials have to implement at least this type, but there are no specific properties for it."
    },
    {
        context: "https://ns.elastos.org/credentials/displayable/v1",
        type: "DisplayableCredential",
        description: "This custom elastos foundation type is used as a standardized way to better display credentials using an icon, a title and a description. When a credential implements those properties, it will be displayed in a better way in identity wallets."
    },
    {
        context: "https://ns.elastos.org/credentials/context/v1",
        type: "ContextDefCredential",
        description: "This is a special credential, used by developers (and by this toolbox) to store newly created credential types on the identity chain. Standard user credentials usually don't use this type."
    },
    {
        context: "https://ns.elastos.org/credentials/v1",
        type: "SelfProclaimedCredential",
        description: "This type is usually used to inform that a credential was self-created, meaning that a user has created the credential for himself, probably in his identity wallet (eg: name, birth date...)."
    },
    {
        context: "https://ns.elastos.org/credentials/v1",
        type: "SensitiveCredential",
        description: "This sensitive credential type is useful to inform that user should pay attention - meaning, be careful to not share it with everyone - to the implementing credential. For instance, social security number, credit card number... Identity wallets usually show a specific visual indicator for such credentials."
    },
    {
        context: "https://ns.elastos.org/credentials/social/v1",
        type: "SocialCredential",
        description: "This credential context contains several properties such as telegram or wechat, that can be used independently in credentials to describe social network accounts."
    },
    {
        context: "https://ns.elastos.org/credentials/email/v1",
        type: "EmailCredential",
        description: "Standard type that describes email credentials."
    },
    {
        context: "https://ns.elastos.org/credentials/profile/v1",
        type: "ProfileCredential",
        description: "This credential context contains several properties such as name or gender, that can be used independently in credentials to describe a user, a person."
    },
    {
        context: "https://ns.elastos.org/credentials/wallet/v1",
        type: "WalletCredential",
        description: "This credential type allows creating credentials with wallet addresses. Most fields are optional and can be used to describe the wallet blockchain, address, address type, balance, public key, etc."
    },
];


/**
 * NOTE: we have 2 kinds of credential type origins: standard HTTPS urls such as
 * https://ns.elastos.org/credentials/v1#SensitiveCredential, but also EID chain types published
 * inside DID documents, as special "ContextRefCredential" VCs.
 *
 * The CREDENTIAL_TYPES_COLLECTION mongo collection is a type cache to efficiently query types. This cache
 * is populated from various origins:
 * - when first fetching hardcoded https url
 * - when users create new types on the frontend (flow: users create types on this tool -> then publish on EID chain)
 * - when stats report new types not created on this tool (flow: users create types somewhere else -> publish on chain -> we discover them through stats)
 */
class CredentialTypeService {
    constructor() { }

    public async setup(): Promise<void> {
        // Upsert credential types that we want to preload
        await this.upsertPreloadedTypes();
    }

    private async upsertPreloadedTypes(): Promise<void> {
        logger.info("Refreshing preloaded types, fetching context urls");

        //  Launch all requests in parrallel to save time, await all promises.
        let promises: Promise<void>[] = [];
        for (let info of PRELOADED_CREDENTIAL_TYPES) {
            //promises.push(this.upsertPreloadedType(info));
            await this.upsertPreloadedType(info); // Don't flood the server with too many parrallel requests
        }

        await Promise.all(promises);

        logger.info("Http types refresh completed");
    }

    private async upsertPreloadedType(info: PreloadedCredentialTypeInfo): Promise<void> {
        // Fetch the url
        // TODO: Handle did:// urls too
        logger.info(`Fetching ${info.context}`);
        let response = await fetch(info.context, {
            headers: {
                "Accept": "application/json"
            }
        });

        if (response && response.status >= 200 && response.status < 400) {
            let contextJson = await response.json() as JSONObject;

            await this.upsertCredentialType(info.context, info.type, contextJson);
        }
    }

    /**
     * Finds relevant fields that we want to search on in the future, and returns a
     * list of searchable strings. Recursive.
     */
    private extractCredentialTypeKeywords(json: JSONObject): string[] {
        let keywords: string[] = [];
        let excludedWords = [ // Don't add those strings to the list
            "@context", "id", "type", "credentialSubject", "@id",
            "@type", "schema", "dc", "sec", "xsd", "@version"
        ];
        let excludedObjects = ["displayable"];

        for (let field of Object.keys(json)) {
            if (excludedWords.indexOf(field) < 0 && excludedObjects.indexOf(field) < 0) {
                keywords.push(field);
            }

            // Recurse
            if (excludedObjects.indexOf(field) < 0 && typeof json[field] === "object") {
                keywords = keywords.concat(this.extractCredentialTypeKeywords(json[field] as JSONObject));
            }
        }

        // Append publisher's did to the keywords
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (("credentialSubject" in json) && ("id" in (json as any).credentialSubject)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            keywords.push((json.credentialSubject as any).id);
        }

        return keywords;
    }

    /**
     *
     * @param userDid DID string of the user to whom we will issue the credential. That user will publish the ne credential type with his DID.
     * @param id Unique short credential identifier used to target this DID this credential. Eg: DiplomaCredential4504564
     * @param type User friendly credential type name
     * @param credentialTypePayload JSON payload for the credential subject. Represents the JSON-LD definition of the credential type.
     * @param description A short description made by the credential type creator (user) to tell others what it is about
     */
    public async issueCredentialType(userDid: string, id: string, type: string, credentialTypePayload: JSONObject, description: string): Promise<DataOrError<string>> {
        console.log("issueCredentialType", userDid, id, credentialTypePayload);

        try {
            let doc = await didService.getIssuerDID();

            let selfIssuer = new Issuer(doc);
            let cb = selfIssuer.issueFor(userDid);

            let vc = await cb.id(id)
                // This credential is a special "credential type" credential
                .typeWithContext("ContextDefCredential", "https://ns.elastos.org/credentials/context/v1")
                // Make the credential nicely displayable
                .typeWithContext("DisplayableCredential", "https://ns.elastos.org/credentials/displayable/v1")
                .properties(
                    {
                        definition: credentialTypePayload,
                        description,
                        displayable: {
                            title: `${type}`,
                            description: "Credential descriptor for developers to use as credential type in applications",
                            //icon: "some url" // TODO
                        }
                    })
                .seal(didService.getStorePass());

            let vcJson = JSON.stringify(vc.toJSON());

            return dataOrErrorData(vcJson);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    public async upsertCredentialType(contextUrl: string, shortType: string, credentialTypePayload: JSONObject, description = "", publisherDid?: string): Promise<DataOrError<CredentialType>> {
        logger.info("Upserting credential type", contextUrl, shortType, publisherDid);

        try {
            const credentialsTypesCollection = dbService.getClient().db().collection<CredentialType>(CREDENTIAL_TYPES_COLLECTION);

            let keywords = this.extractCredentialTypeKeywords(credentialTypePayload);

            // Append context and short type to searcheable terms
            keywords.push(contextUrl);
            keywords.push(shortType);

            // If known, add the ability to search by publisher DID too
            if (publisherDid)
                keywords.push(publisherDid);

            let existingCredentialType = await credentialsTypesCollection.findOne({
                context: contextUrl,
                shortType
            });

            // There are 2 possibilities here:
            // - If we already have this context url / short type in DB, then we are registering a
            //   new version of the credential (modified), so we must add the payload to the list of
            //   existing payloads.
            // - If there is no such context yet, we create a new one with only one payload
            let now = Date.now() / 1000;
            let credentialTypeMongoId;
            if (!existingCredentialType) {
                // First creation - insert
                logger.info("Credential type doesn't exist, creating a new entry");

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let insertQuery: any = {
                    context: contextUrl,
                    shortType: shortType,
                    description,
                    contextPayloads: [{
                        insertDate: now,
                        payload: JSON.stringify(credentialTypePayload)
                    }],
                    creationDate: now,
                    keywords
                };

                if (contextUrl.startsWith("did:")) {
                    insertQuery.medium = CredentialTypeMedium.EID_CHAIN;
                    insertQuery.elastosEIDChain = {
                        publisher: publisherDid,
                    };
                }
                else {
                    insertQuery.medium = CredentialTypeMedium.HTTPS;
                }

                let insertResult = await credentialsTypesCollection.insertOne(insertQuery);

                // Retrieve the inserted document to return it
                if (!insertResult.acknowledged) {
                    return serverError("Failed to register the credential type");
                }

                credentialTypeMongoId = insertResult.insertedId;
            }
            else {
                // Credential type update - append, but only if not a duplicate payload
                logger.info("Credential type exists, updating the existing entry");

                credentialTypeMongoId = existingCredentialType._id;

                // Make sure that we don't have this payload yet
                let payloadStr = JSON.stringify(credentialTypePayload);
                let hasThisPayload = !!existingCredentialType.contextPayloads.find(p => p.payload === payloadStr);
                if (hasThisPayload) {
                    return stateError("Credential type already exists - " + contextUrl + " - " + shortType);
                }

                await credentialsTypesCollection.updateOne({
                    _id: credentialTypeMongoId
                }, {
                    $push: {
                        contextPayloads: {
                            insertDate: now,
                            payload: payloadStr
                        },
                    },
                    $set: {
                        description, // Update description with the newest value
                        keywords // Update keywords with most recent credential context data
                    }
                });
            }

            let upsertedCredentialType = await credentialsTypesCollection.findOne({
                _id: credentialTypeMongoId
            });

            return dataOrErrorData(upsertedCredentialType);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    /**
     * From: did:elastos:abcdef#MyCred
     * To: did:elastos:abcdef
     */
    private serviceIdToPublisherDid(serviceId: string): string {
        if (!serviceId || !serviceId.startsWith("did:elastos:"))
            return null;

        return new DIDURL(serviceId).getDid().toString();
    }

    /**
     * From: did:elastos:abcdef#MyCred
     * To: MyCred
     */
    private serviceIdToShortType(serviceId: string): string {
        if (!serviceId || !serviceId.startsWith("did:elastos:"))
            return null;

        return new DIDURL(serviceId).getFragment();
    }

    /**
     * From: did://elastos/abcdef/MyCred (context)
     * To: did:elastos:abcdef#MyCred (service id)
     */
    public contextToServiceId(contextUrl: string): string {
        let regex = new RegExp(/^did:\/\/elastos\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)#?/);
        let parts = regex.exec(contextUrl);

        if (!parts || parts.length < 3) {
            return null;
        }

        let publisher = `did:elastos:${parts[1]}`;
        let shortType = parts[2];

        return `${publisher}#${shortType}`;
    }

    /**
     * From a given service ID, resolve the target DID document on chain, find the service entry,
     * resolve the target credential context credential targeted by the service and saves a copy
     * in the local database.
     *
     * @param serviceId Eg: did:elastos:abcdef#MyCred
     */
    public async registerEIDCredentialType(serviceId: string): Promise<DataOrError<CredentialType>> {
        console.log("registerCredentialType", serviceId);

        try {
            let publisherDid = this.serviceIdToPublisherDid(serviceId);
            let shortType = this.serviceIdToShortType(serviceId);

            // Make sure this credential exists on chain, and get the payload
            let checkedDID = new DID(publisherDid);

            console.log(`Resolving on chain DID ${checkedDID} to check if the credential type credential exists`);
            let resolvedDocument = await checkedDID.resolve(true);
            if (!resolvedDocument) {
                return invalidParamError('DID not found on the EID chain');
            }

            // Find the target service and extract the endpoint - Example:
            /*
            "service": [
                {
                "id": "did:elastos:insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq#DiplomaCredential",
                "type": "CredentialContext",
                "serviceEndpoint": "did:elastos:insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq#DiplomaCredential1234567890"
                }
            ]
            */
            let service = resolvedDocument.getService(serviceId);
            if (!service)
                return invalidParamError(`Service ${serviceId} not found in the DID document`);

            let targetCredentialId = service.getServiceEndpoint();

            console.log("Trying to find the credential in the DID document", targetCredentialId);
            let vc = resolvedDocument.getCredential(targetCredentialId);
            if (!vc) {
                return invalidParamError(`Credential ${targetCredentialId} not found in the target DID`);
            }

            let didIdentifierOnly = publisherDid.replace("did:elastos:", "");
            //let credentialIdFragment = vc.getId().getFragment();
            let contextUrl = `did://elastos/${didIdentifierOnly}/${shortType}`;

            // Find the context definition in the credential subject of this VC
            let definitionPayload = vc.getSubject().getProperties();
            if ("definition" in definitionPayload) {
                // If there is a description, save it too
                let description = "";
                if ("description" in definitionPayload && typeof definitionPayload["description"] === "string")
                    description = <string>definitionPayload["description"];

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return this.upsertCredentialType(contextUrl, shortType, <any>definitionPayload["definition"], description, publisherDid);
            }

            return invalidParamError(`Context payload not found in DID document`);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    /**
     * @param contextUrl eg: did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential (service id)
     * @param shortType eg: MyCredentialType
     */
    public async getCredentialTypeByContextUrl(contextUrl: string, shortType?: string): Promise<DataOrError<CredentialType>> {
        // Extract publisher and credential ID from the url
        //let regex = new RegExp(/^did:\/\/elastos\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)#?/);
        //let parts = regex.exec(contextUrl);

        /* if (!parts || parts.length < 3) {
            return invalidParamError('Invalid url format, cannot find credential publisher and ID');
        }

        let publisher = `did:elastos:${parts[1]}`;
        let shortType = parts[2]; */

        console.log("getCredentialTypeByContextUrl", contextUrl);

        try {
            const credentialsTypesCollection = dbService.getClient().db().collection<CredentialType>(CREDENTIAL_TYPES_COLLECTION);

            let query: { context: string; shortType?: string } = {
                context: contextUrl
            };

            if (shortType)
                query.shortType = shortType;

            let credentialType = await credentialsTypesCollection.findOne(query);

            return dataOrErrorData(credentialType);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    public async getCredentialTypeByTypeWithContext(context: string, shortType: string): Promise<DataOrError<CredentialType>> {
        try {
            const credentialsTypesCollection = dbService.getClient().db().collection<CredentialType>(CREDENTIAL_TYPES_COLLECTION);

            let credentialType = await credentialsTypesCollection.findOne({ context, shortType });
            this.applyBuiltInDescriptionsToTypes([credentialType]);

            return dataOrErrorData(credentialType);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    public async getCredentialTypes(search: string): Promise<DataOrError<CredentialType[]>> {
        try {
            const credentialsTypesCollection = dbService.getClient().db().collection<CredentialType>(CREDENTIAL_TYPES_COLLECTION);

            let credentialTypes = await credentialsTypesCollection.find({
                $or: [
                    {
                        keywords: {
                            $regex: new RegExp(search, "i")
                        }
                    }
                ]
            }).limit(30).sort({ "lastMonthStats.totalUsers": -1, "lastMonthStats.totalCredentials": -1 }).toArray();

            this.applyBuiltInDescriptionsToTypes(credentialTypes);

            return dataOrErrorData(credentialTypes);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    /**
     * Checks if some of the given types have no description and have a built-in description,
     * in which case the built-in description is applied.
     */
    private applyBuiltInDescriptionsToTypes(credentialTypes: CredentialType[]) {
        if (!credentialTypes)
            return;

        credentialTypes.forEach(ct => {
            if (ct && !ct.description) {
                ct.description = this.getBuiltInCredentialTypeDescription(ct);
            }
        })
    }

    /**
     * For convenience, some credential types (essentially https ones) have hardcoded descriptions
     * for now.
     */
    public getBuiltInCredentialTypeDescription(credentialType: CredentialType): string {
        let builtInDescription = builtInDescriptions.find(bid => bid.context === credentialType.context && bid.type === credentialType.shortType);
        if (!builtInDescription)
            return null;

        return builtInDescription.description;
    }
}

export const credentialTypeService = new CredentialTypeService();
