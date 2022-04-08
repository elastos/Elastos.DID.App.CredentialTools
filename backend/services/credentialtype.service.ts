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
    // Elastos
    { context: "https://ns.elastos.org/credentials/v1", type: "SelfProclaimedCredential" },
    { context: "https://ns.elastos.org/credentials/v1", type: "SensitiveCredential" },
    { context: "https://ns.elastos.org/credentials/displayable/v1", type: "DisplayableCredential" },
    { context: "https://ns.elastos.org/credentials/context/v1", type: "ContextDefCredential" },
    { context: "https://ns.elastos.org/credentials/social/v1", type: "SocialCredential" }
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
            promises.push(this.upsertPreloadedType(info));
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
        let contextJson = await response.json() as JSONObject;

        await this.upsertCredentialType(info.context, info.type, contextJson);
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
     * @returns
     */
    public async issueCredentialType(userDid: string, id: string, type: string, credentialTypePayload: JSONObject): Promise<DataOrError<string>> {
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
                        ...credentialTypePayload,
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

    public async upsertCredentialType(contextUrl: string, shortType: string, credentialTypePayload: JSONObject, publisherDid?: string): Promise<DataOrError<CredentialType>> {
        logger.info("Upserting credential type", contextUrl, shortType, publisherDid);

        try {
            const credentialsTypesCollection = dbService.getClient().db().collection<CredentialType>(CREDENTIAL_TYPES_COLLECTION);

            let keywords = this.extractCredentialTypeKeywords(credentialTypePayload);

            // Append context and short type to searcheable terms
            keywords.push(contextUrl);
            keywords.push(shortType);

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
                        keywords // Update keywords with most recent credential context data
                    }
                });
            }

            console.log("aaaa", credentialTypeMongoId)

            let upsertedCredentialType = await credentialsTypesCollection.findOne({
                _id: credentialTypeMongoId
            });

            console.log("bbbb", credentialTypeMongoId, upsertedCredentialType)

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
            let contextPayload = vc.getSubject().getProperties();

            return this.upsertCredentialType(contextUrl, shortType, contextPayload, publisherDid);
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
            return dataOrErrorData(credentialTypes);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }
}

export const credentialTypeService = new CredentialTypeService();
