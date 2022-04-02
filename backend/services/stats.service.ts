import moment from "moment";
import sanitize from 'mongo-sanitize';
import logger from "../logger";
import { hasError } from "../model/dataorerror";
import { CredentialStats, CredentialTypeAggregatedStats, CredentialTypeWithContext, StoredCredentialStats } from "../model/stats";
import { credentialTypeService, CREDENTIAL_TYPES_COLLECTION } from "./credentialtype.service";
import { dbService } from "./db.service";
import { didService } from "./did.service";

const RAW_STATS_COLLECTION = 'raw-statistics';
const STATS_COMPUTATION_INTERVAL_SEC = 30; // TODO TMP // X seconds between each stats computation

class StatsService {
    constructor() {
    }

    /**
     * Starts the repeating task that consolidates raw statistics into more usable statistics for the
     * toolbox.
     */
    public startStatsAggregationTask() {
        void this.runStatsAggregation();
    }

    /**
     * Handles new stat payload received from external app. Those stats are used to enrich info
     * given to developers about existing credential types, such as their popularity, last used dates,
     * or third party apps using them.
     *
     * Eventhough we receive raw data from the wallet in one block, we differenciate owned stats from
     * used stats. The whole owned stats list is always sent by the wallet (so far), but the used stats
     * are sent then deleted by the wallet (to avoid making this list grow too much on the client side).
     * As a consequence, we do:
     * - owned stats: always overwrite
     * - used stats: insert only inexisting ones, with cleanup later for older stats
     */
    public async handleIncomingStats(statsPayload: CredentialStats) {
        // If no userid entry exists, create an empty one
        let existingEntry = await dbService.getClient().db().collection(RAW_STATS_COLLECTION).findOne<StoredCredentialStats>({
            userId: sanitize(statsPayload.userId)
        });
        if (!existingEntry) {
            // Not existing, just save everything as is
            await dbService.getClient().db().collection(RAW_STATS_COLLECTION).insertOne({
                createdAt: moment().unix(),
                userId: statsPayload.userId,
                ownedCredentials: statsPayload.ownedCredentials,
                usedCredentials: statsPayload.usedCredentials
            });
        }
        else {
            // Existing so we:
            // Overwrite owned stats
            await dbService.getClient().db().collection(RAW_STATS_COLLECTION).updateOne({
                userId: sanitize(statsPayload.userId)
            }, {
                $set: {
                    ownedCredentials: statsPayload.ownedCredentials // Overwrite all owned credentials
                }
            });

            // Check all used stats and insert missing ones
            for (let usedCred of statsPayload.usedCredentials) {
                // Note: use usedAt as our "unique" comparison entry, good enough.
                if (!existingEntry.usedCredentials.find(uc => uc.usedAt === usedCred.usedAt)) {
                    // Not found, append used stat entry to existing array.
                    await dbService.getClient().db().collection(RAW_STATS_COLLECTION).updateOne({
                        userId: sanitize(statsPayload.userId)
                    }, {
                        $push: {
                            usedCredentials: usedCred
                        }
                    });
                }
            }
        }
    }

    private async runStatsAggregation(): Promise<void> {
        logger.info("Starting statistics computation");

        // Model for debug info purpose only
        let updatedCredentialTypeEntriesInDatabase = 0;
        let rawStatEntriesChecked = 0;

        let oneMonthAgo = moment().subtract("30", "days").unix();

        // Build aggregated stats for the last 30 days only
        let rawStatsCursor = await dbService.getClient().db().collection(RAW_STATS_COLLECTION).find<StoredCredentialStats>({
            createdAt: { $gte: oneMonthAgo } // Use only recent entries
        });
        rawStatEntriesChecked = await rawStatsCursor.count();

        let targetCredentialTypes: CredentialTypeWithContext[] = [];

        // Build the list of all credential types that will need to get stats refreshed
        // so we can iterate this list just after
        let nextRawStat: StoredCredentialStats = null;
        while ((nextRawStat = await rawStatsCursor.next())) {
            // Find owned credential types
            for (let owned of nextRawStat.ownedCredentials) {
                for (let type of owned.types) {
                    if (!this.typesWithContextsArrayContains(targetCredentialTypes, type))
                        targetCredentialTypes.push(type);
                }
            }

            // Find used credential types
            for (let used of nextRawStat.usedCredentials) {
                for (let type of used.types) {
                    if (!this.typesWithContextsArrayContains(targetCredentialTypes, type))
                        targetCredentialTypes.push(type);
                }
            }
        }

        // Iterate all recently owned types and rebuild their stat field in the credentials types database
        for (let type of targetCredentialTypes) {
            console.log("processing type", type);

            // Get this type from the database.
            let [error, existingCredentialType] = await credentialTypeService.getCredentialTypeByTypeWithContext(type.context, type.shortType);
            if (hasError(error)) {
                // TODO: if this is a EID chain type that we don't know, we should fetch it and register it
                // into our local collection (cache), as this was probably published by someone else not using
                // this tool.
                console.error("not found")
            }
            else {
                let users: { [userId: string]: true } = {}; // Simple map to count UNIQUE users
                let usingApps: { [appDID: string]: { [userId: string]: true } } = {}; // Map to count UNIQUE apps (with number of users) using a credential type
                let issuers: { [issuerDID: string]: { [userId: string]: true } } = {}; // Map to count UNIQUE issuers (with number of users) who issued a credential type
                let totalCredentials = 0;
                let lastCreated = moment(0);
                let lastUsed = moment(0);

                let credTypeStats: CredentialTypeAggregatedStats = {
                    topUsingApps: [],
                    topIssuers: [],
                    totalUsers: 0,
                    totalCredentials: 0,
                    lastCreated: -1,
                    lastUsed: -1
                };

                // Iterate again over all raw stats
                rawStatsCursor.rewind();
                while ((nextRawStat = await rawStatsCursor.next())) {
                    // "Owned" loop
                    for (let owned of nextRawStat.ownedCredentials) {
                        if (this.typesWithContextsArrayContains(owned.types, type)) {
                            // This raw stat entry has this credential type - let's process it
                            users[nextRawStat.userId] = true;
                            totalCredentials++;

                            if (owned.issuer) { // It's possible that this info is not provided (eg: self claimed credentials)
                                if (!(owned.issuer in issuers))
                                    issuers[owned.issuer] = {};

                                issuers[owned.issuer][nextRawStat.userId] = true;
                            }

                            // Update the last created date if needed
                            let credIssueDate = moment.unix(owned.issuanceDate);
                            if (lastCreated.isBefore(credIssueDate))
                                lastCreated = credIssueDate;
                        }
                    }

                    // "Used" loop
                    for (let used of nextRawStat.usedCredentials) {
                        if (this.typesWithContextsArrayContains(used.types, type)) {
                            if (used.appDid) { // It's possible that this info is not provided
                                if (!(used.appDid in usingApps))
                                    usingApps[used.appDid] = {};

                                usingApps[used.appDid][nextRawStat.userId] = true;
                            }

                            // Update the last used date if needed
                            let useDate = moment.unix(used.usedAt);
                            if (lastUsed.isBefore(useDate))
                                lastUsed = useDate;
                        }
                    }
                }

                credTypeStats.topUsingApps = Object.keys(usingApps).map(appDID => {
                    return {
                        did: appDID,
                        name: null, // TODO
                        icon: null, // TODO
                        users: Object.keys(usingApps[appDID]).length // Number of users using this type
                    }
                });
                credTypeStats.topIssuers = Object.keys(issuers).map(issuerDID => {
                    return {
                        did: issuerDID,
                        name: null, // TODO
                        icon: null, // TODO
                        users: Object.keys(issuers[issuerDID]).length // Number of users using credentials of this type , issued by this issuer
                    }
                });

                // Populate app / issuers info
                for (let app of credTypeStats.topUsingApps) {
                    let info = await didService.getDIDWithInfo(app.did);
                    if (info) {
                        app.name = info.name;
                        app.icon = info.icon;
                    }
                }

                credTypeStats.totalUsers = Object.keys(users).length;
                credTypeStats.totalCredentials = totalCredentials;
                credTypeStats.lastCreated = lastCreated.unix();
                credTypeStats.lastUsed = lastUsed.unix();

                console.log("credTypeStats", type, credTypeStats)

                // Now that the stats are built, update the database entry
                await dbService.getClient().db().collection(CREDENTIAL_TYPES_COLLECTION).updateOne({
                    context: existingCredentialType.context,
                    shortType: existingCredentialType.shortType
                }, {
                    $set: {
                        lastMonthStats: credTypeStats
                    }
                });
                updatedCredentialTypeEntriesInDatabase++;
            }
        }

        logger.info(`Statistics computation completed. Processed ${rawStatEntriesChecked} raw entries and updated ${updatedCredentialTypeEntriesInDatabase} credential types in database`);

        // Rearm a timer for the next stat computation
        setTimeout(() => {
            void this.runStatsAggregation();
        }, STATS_COMPUTATION_INTERVAL_SEC * 1000);
    }

    private typesWithContextsArrayContains(currentArray: CredentialTypeWithContext[], type: CredentialTypeWithContext): boolean {
        return !!currentArray.find(t => t.context === type.context && t.shortType === type.shortType);
    }
}

export const statsService = new StatsService();
