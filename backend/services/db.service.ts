import { DID, Issuer, JSONObject } from "@elastosfoundation/did-js-sdk";
import { MongoClient } from "mongodb";
import { SecretConfig } from "../config/env-secret";
import logger from "../logger";
import { CredentialType } from "../model/credentialtype";
import { CommonResponse } from "../model/response";
import { User, UserType } from "../model/user";
import { didService } from "./did.service";

class DBService {
    private client: MongoClient;

    constructor() {
        let mongoConnectionUrl;
        if (SecretConfig.Mongo.user)
            mongoConnectionUrl = `mongodb://${SecretConfig.Mongo.user}:${SecretConfig.Mongo.password}@${SecretConfig.Mongo.host}:${SecretConfig.Mongo.port}/${SecretConfig.Mongo.dbName}?authSource=admin`;
        else
            mongoConnectionUrl = `mongodb://${SecretConfig.Mongo.host}:${SecretConfig.Mongo.port}/${SecretConfig.Mongo.dbName}`;

        console.log("mongoConnectionUrl", mongoConnectionUrl);

        this.client = new MongoClient(mongoConnectionUrl, {
            //useNewUrlParser: true, useUnifiedTopology: true
        });
    }

    public async checkConnect(): Promise<CommonResponse<void>> {
        try {
            await this.client.connect();
            await this.client.db().collection('users').find({}).limit(1);
            return { code: 200, message: 'success' };
        } catch (err) {
            logger.error(err);
            return { code: 200, message: 'mongodb connect failed' };
        } finally {
            await this.client.close();
        }
    }

    public async updateUser(did: string, name: string, email: string): Promise<number> {
        try {
            await this.client.connect();
            const collection = this.client.db().collection('users');
            let result = await collection.updateOne({ did }, { $set: { name, email } });
            return result.matchedCount;
        } catch (err) {
            logger.error(err);
            return -1;
        } finally {
            await this.client.close();
        }
    }

    public async setUserType(targetDid: string, type: UserType) {
        try {
            await this.client.connect();
            const collection = this.client.db().collection('users');

            let user = await collection.findOne({ did: targetDid });
            if (!user) {
                return { code: 404, message: 'User not found' };
            }

            await collection.updateOne({ did: targetDid }, { $set: { type } });

            return { code: 200, message: 'success' };
        } catch (err) {
            logger.error(err);
            return { code: 500, message: 'server error' };
        } finally {
            await this.client.close();
        }
    }

    public async findUserByDID(did: string): Promise<User | null> {
        try {
            await this.client.connect();
            const collection = this.client.db().collection<User>('users');
            return (await collection.find({ did }).project<User>({ '_id': 0 }).limit(1).toArray())[0];
        } catch (err) {
            logger.error(err);
            return null;
        } finally {
            await this.client.close();
        }
    }

    public async addUser(user: User): Promise<CommonResponse<void>> {
        try {
            await this.client.connect();
            const collection = this.client.db().collection('users');
            const docs = await collection.find({ did: user.did }).toArray();
            if (docs.length === 0) {
                await collection.insertOne(user);
                return { code: 200, message: 'success' };
            } else {
                return { code: 400, message: 'DID or Telegram exists' }
            }
        } catch (err) {
            logger.error(err);
            return { code: 500, message: 'server error' };
        } finally {
            await this.client.close();
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
    public async issueCredentialType(userDid: string, id: string, type: string, credentialTypePayload: JSONObject): Promise<CommonResponse<string>> {
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

            return { code: 200, message: 'success', data: vcJson };
        } catch (err) {
            logger.error(err);
            return { code: 500, message: 'server error' };
        } finally {
            await this.client.close();
        }
    }

    public async registerCredentialType(publisherDid: string, credentialId: string): Promise<CommonResponse<void>> {
        console.log("registerCredentialType", publisherDid, credentialId);

        try {
            // Step 1: make sure this credential exists on chain
            let checkedDID = new DID(publisherDid);

            console.log(`Resolving on chain DID ${checkedDID} to check if the credential type credential exists`);
            let resolvedDocument = await checkedDID.resolve(true);
            if (!resolvedDocument) {
                return { code: 403, message: 'DID not found on the EID chain' };
            }

            let credentialTypeId = `${publisherDid}#${credentialId}`;

            console.log("Trying to find the credential in the DID document", credentialTypeId);
            let vc = resolvedDocument.getCredential(credentialTypeId);
            if (!vc) {
                return { code: 403, message: `Credential ${credentialId} not found in the target DID` };
            }

            // Step 2: now that we are sure the credential is published, we can insert it to the database
            await this.client.connect();
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
                return { code: 403, message: `Credential ${credentialId} Already exists. Not inserting again` };
            }

            await credentialsTypesCollection.insertOne({
                publisher: publisherDid,
                publishDate: Date.now() / 1000,
                id: credentialId,
                type: vc.getId().getFragment(),
                value: credentialType,
                keywords
            });

            return { code: 200, message: 'success' };
        } catch (err) {
            logger.error(err);
            return { code: 500, message: 'server error' };
        } finally {
            await this.client.close();
        }
    }

    // did://elastos/insTmxdDDuS9wHHfeYD1h5C2onEHh3D8Vq/DiplomaCredential7562980#DiplomaCredential
    public async getCredentialTypeByUrl(credentialUrl: string): Promise<unknown> {
        // Extract publisher and credential ID from the url
        let regex = new RegExp(/^did:\/\/elastos\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)#?/);
        let parts = regex.exec(credentialUrl);

        if (!parts || parts.length < 3) {
            return { code: 403, message: 'Invalid url format, cannot find credential publisher and ID' };
        }

        let publisher = `did:elastos:${parts[1]}`;
        let credentialId = parts[2];

        try {
            await this.client.connect();
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            let credentialType = await credentialsTypesCollection.findOne({
                publisher: publisher,
                id: credentialId
            });

            return { code: 200, message: 'success', data: credentialType?.value };
        } catch (err) {
            logger.error(err);
            return { code: 500, message: 'server error' };
        } finally {
            await this.client.close();
        }
    }

    public async getCredentialTypes(search: string): Promise<CommonResponse<CredentialType[]>> {
        try {
            await this.client.connect();
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            let credentialTypes = await credentialsTypesCollection.find({
                keywords: {
                    $regex: new RegExp(search, "i")
                }
                /* $text: {
                    $search: search
                } */
            }).limit(30).sort({ publishDate: -1 }).toArray();
            return { code: 200, message: 'success', data: credentialTypes };
        } catch (err) {
            logger.error(err);
            return { code: 500, message: 'server error' };
        } finally {
            await this.client.close();
        }
    }
}

export const dbService = new DBService();
