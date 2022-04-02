import logger from "../logger";
import { DataOrError, dataOrErrorData, serverError, stateError } from "../model/dataorerror";
import { User } from "../model/user";
import { dbService } from "./db.service";

class UserService {
    constructor() { }

    public async updateUser(did: string, name: string, email: string): Promise<number> {
        try {
            const collection = dbService.getClient().db().collection('users');
            let result = await collection.updateOne({ did }, { $set: { name, email } });
            return result.matchedCount;
        } catch (err) {
            logger.error(err);
            return -1;
        }
    }

    public async findUserByDID(did: string): Promise<User | null> {
        try {
            const collection = dbService.getClient().db().collection<User>('users');
            return (await collection.find({ did }).project<User>({ '_id': 0 }).limit(1).toArray())[0];
        } catch (err) {
            logger.error(err);
            return null;
        }
    }

    public async addUser(user: User): Promise<DataOrError<void>> {
        try {
            const collection = dbService.getClient().db().collection('users');
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
}

export const userService = new UserService();
