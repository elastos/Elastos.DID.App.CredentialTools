import { JSONObject } from "@elastosfoundation/did-js-sdk";
import { MongoClient } from "mongodb";
import { SecretConfig } from "../config/env-secret";
import logger from "../logger";
import { CredentialType } from "../model/credentialtype";
import { CommonResponse } from "../model/response";
import { User, UserType } from "../model/user";

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

    public async publishCredentialType(did: string, id: string, type: string, credentialType: JSONObject): Promise<CommonResponse<void>> {
        try {
            await this.client.connect();
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            await credentialsTypesCollection.insertOne({
                publisher: did,
                publishDate: Date.now() / 1000,
                id,
                type,
                value: credentialType
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

    public async getCredentialTypes(): Promise<CommonResponse<CredentialType[]>> {
        try {
            await this.client.connect();
            const credentialsTypesCollection = this.client.db().collection<CredentialType>('credential_types');

            let credentialTypes = await credentialsTypesCollection.find().sort({ publishDate: -1 }).toArray();
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
