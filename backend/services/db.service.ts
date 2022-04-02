import { MongoClient } from "mongodb";
import { SecretConfig } from "../config/env-secret";
import logger from "../logger";
import { DataOrError, dataOrErrorData, serverError } from "../model/dataorerror";

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
}

export const dbService = new DBService();
