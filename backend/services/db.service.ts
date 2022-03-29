import { DID, Issuer, JSONObject } from "@elastosfoundation/did-js-sdk";
import { MongoClient } from "mongodb";
import { SecretConfig } from "../config/env-secret";
import logger from "../logger";
import { CredentialType } from "../model/credentialtype";
import { DataOrError, dataOrErrorData, invalidParamError, notFoundError, serverError, stateError } from "../model/dataorerror";
import { User, UserType } from "../model/user";
import { didService } from "./did.service";

class DBService {
    private client: MongoClient;

    constructor() { }

    public async connect(): Promise<void> {
        let mongoConnectionUrl;
        if (SecretConfig.Mongo.user)
            mongoConnectionUrl = `mongodb://${SecretConfig.Mongo.user}:${SecretConfig.Mongo.password}@${SecretConfig.Mongo.host}:${SecretConfig.Mongo.port}/${SecretConfig.Mongo.dbName}?authSource=admin`;
        else
            mongoConnectionUrl = `mongodb://${SecretConfig.Mongo.host}:${SecretConfig.Mongo.port}/${SecretConfig.Mongo.dbName}`;

        this.client = new MongoClient(mongoConnectionUrl, {
            minPoolSize: 10,
            maxPoolSize: 50
        });
        await this.client.connect();

        logger.info("Connected to mongo");
    }

    public getClient(): MongoClient {
        return this.client;
    }

    public async checkConnect(): Promise<DataOrError<string>> {
        try {
            await this.client.db().collection('users').find({}).limit(1);
            return dataOrErrorData('success');
        } catch (err) {
            logger.error(err);
            return serverError('mongodb connect failed');
        }
    }

    public async updateUser(did: string, name: string, email: string): Promise<number> {
        try {
            const collection = this.client.db().collection('users');
            let result = await collection.updateOne({ did }, { $set: { name, email } });
            return result.matchedCount;
        } catch (err) {
            logger.error(err);
            return -1;
        }
    }

    public async setUserType(targetDid: string, type: UserType): Promise<DataOrError<void>> {
        try {
            const collection = this.client.db().collection('users');

            let user = await collection.findOne({ did: targetDid });
            if (!user) {
                return notFoundError('User not found');
            }

            await collection.updateOne({ did: targetDid }, { $set: { type } });

            return dataOrErrorData();
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    public async findUserByDID(did: string): Promise<User | null> {
        try {
            const collection = this.client.db().collection<User>('users');
            return (await collection.find({ did }).project<User>({ '_id': 0 }).limit(1).toArray())[0];
        } catch (err) {
            logger.error(err);
            return null;
        }
    }

    public async addUser(user: User): Promise<DataOrError<void>> {
        try {
            const collection = this.client.db().collection('users');
            const docs = await collection.find({ did: user.did }).toArray();
            if (docs.length === 0) {
                await collection.insertOne(user);
                return dataOrErrorData();
            } else {
                return stateError('DID or Telegram exists');
            }
        } catch (err) {
            logger.error(err);
            return serverError('server error');
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
            "@type", "schema", "xsd", "@version"
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

    public async registerCredentialType(publisherDid: string, credentialId: string): Promise<DataOrError<void>> {
        console.log("registerCredentialType", publisherDid, credentialId);

        try {
            // Step 1: make sure this credential exists on chain
            let checkedDID = new DID(publisherDid);

            console.log(`Resolving on chain DID ${checkedDID} to check if the credential type credential exists`);
            let resolvedDocument = await checkedDID.resolve(true);
            if (!resolvedDocument) {
                return invalidParamError('DID not found on the EID chain');
            }

            let credentialTypeId = `${publisherDid}#${credentialId}`;

            console.log("Trying to find the credential in the DID document", credentialTypeId);
            let vc = resolvedDocument.getCredential(credentialTypeId);
            if (!vc) {
                return invalidParamError(`Credential ${credentialId} not found in the target DID`);
            }

            // Step 2: now that we are sure the credential is published, we can insert it to the database
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            let credentialType = vc.getSubject().getProperties();
            let keywords = this.extractCredentialTypeKeywords(credentialType);
            // Append publisher's did to the keywords
            keywords.push(publisherDid);

            console.log("Created keywords:", keywords);

            // Make sure we don't insert duplicates
            let existingEntry = await credentialsTypesCollection.findOne({
                publisher: publisherDid,
                id: credentialId
            });
            if (existingEntry) {
                return invalidParamError(`Credential ${credentialId} Already exists. Not inserting again`);
            }

            // Insert
            await credentialsTypesCollection.insertOne({
                publisher: publisherDid,
                publishDate: Date.now() / 1000,
                id: credentialId,
                type: vc.getId().getFragment(),
                value: credentialType,
                keywords
            });

            return dataOrErrorData();
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    // did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential7562980#DiplomaCredential
    public async getCredentialTypeByUrl(credentialUrl: string): Promise<DataOrError<CredentialType>> {
        // Extract publisher and credential ID from the url
        let regex = new RegExp(/^did:\/\/elastos\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)#?/);
        let parts = regex.exec(credentialUrl);

        if (!parts || parts.length < 3) {
            return invalidParamError('Invalid url format, cannot find credential publisher and ID');
        }

        let publisher = `did:elastos:${parts[1]}`;
        let credentialId = parts[2];

        try {
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            let credentialType = await credentialsTypesCollection.findOne({
                publisher: publisher,
                id: credentialId
            });

            return dataOrErrorData(credentialType);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }

    public async getCredentialTypes(search: string): Promise<DataOrError<CredentialType[]>> {
        try {
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            let credentialTypes = await credentialsTypesCollection.find({
                keywords: {
                    $regex: new RegExp(search, "i")
                }
                /* $text: {
                    $search: search
                } */
            }).limit(30).sort({ publishDate: -1 }).toArray();
            return dataOrErrorData(credentialTypes);
        } catch (err) {
            logger.error(err);
            return serverError('server error');
        }
    }
}

export const dbService = new DBService();
