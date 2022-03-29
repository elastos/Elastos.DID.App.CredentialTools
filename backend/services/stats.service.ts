import moment from "moment";
import { hasError } from "../model/dataorerror";
import { CredentialStats, CredentialTypeAggregatedStats, StoredCredentialStats } from "../model/stats";
import { dbService } from "./db.service";

const RAW_STATS_COLLECTION = 'raw-statistics';

class StatsService {
    constructor() {
    }

    /**
     * Starts the repeating task that consolidates raw statistics into more usable statistics for the
     * toolbox.
     */
    public startStatsAggregationTask() {
        void this.runStatsAggregation();

        // TODO: rearm after aggregation finished
    }

    /**
     * Handles new stat payload received from external app. Those stats are used to enrich info
     * given to developers about existing credential types, such as their popularity, last used dates,
     * or third party apps using them.
     */
    public async handleIncomingStats(statsPayload: CredentialStats) {
        console.log("handleIncomingStats", statsPayload)

        // Copy field one by one - basic sanitize
        let storedStats: StoredCredentialStats = {
            createdAt: moment().unix(),
            userId: statsPayload.userId,
            ownedCredentials: statsPayload.ownedCredentials,
            usedCredentials: statsPayload.usedCredentials
        }
        await dbService.getClient().db().collection(RAW_STATS_COLLECTION).insertOne(storedStats);
    }

    private async runStatsAggregation(): Promise<void> {
        let oneMonthAgo = moment().subtract("30", "days").unix();

        // Build aggregated stats for the last 30 days only
        let rawStatsCursor = await dbService.getClient().db().collection(RAW_STATS_COLLECTION).find<StoredCredentialStats>({
            createdAt: { $gte: oneMonthAgo } // Use only recent entries
        });

        // Cache for stats being built, as this concerns all credential types
        // NOTE: not optimal for memory but way better to reduce mongo queries for now, as long as there are not
        // many credential types in database. Later on this can heavily be optimized.
        //let credentialTypeStats: Map<string, StoredCredentialStats> = new Map();

        let targetCredentialTypes: string[] = [];

        // Build the list of all credential types that will need to get stats refreshed
        // so we can iterate this list just after
        let nextRawStat: StoredCredentialStats = null;
        while ((nextRawStat = await rawStatsCursor.next())) {
            for (let owned of nextRawStat.ownedCredentials) {
                for (let type of owned.types) {
                    if (targetCredentialTypes.indexOf(type) < 0)
                        targetCredentialTypes.push(type);
                }
            }
        }

        // Iterate all recently owned types and rebuild their stat field in the credentials types database
        for (let type of targetCredentialTypes) {
            // Get this type from the database.
            let [error, existingCredentialType] = await dbService.getCredentialTypeByUrl(type);
            if (hasError(error)) {
                // TODO: ?
            }
            else {
                let users: { [userId: string]: true } = {}; // Simple map to count UNIQUE users

                let credTypeStats: CredentialTypeAggregatedStats = {
                    topUsingApps: [], // TODO: BY THE "USED" LOOP
                    totalUsers: 0,
                    totalCredentials: 0,
                    lastCreated: -1,
                    lastUsed: -1
                };

                // Iterate again over all raw stats
                rawStatsCursor.rewind();
                while ((nextRawStat = await rawStatsCursor.next())) {
                    for (let owned of nextRawStat.ownedCredentials) {
                        if (owned.types.indexOf(type) >= 0) {
                            // This raw stat entry uses this credential type - let's process it
                            users[nextRawStat.userId] = true;

                            TODO: all the other stuff
                        }
                    }
                }

                credTypeStats.totalUsers = Object.keys(users).length;
            }
        }
    }

    /**
     * Given credentialTypeStats and type, loads the existing value from the database if not existing, or
     * do nothing if already loaded.
     */
    /*  private fillTemporaryTypeStats(credentialTypeStats: Map<string, StoredCredentialStats>, type: string): Promise<void> {

     } */
}

export const statsService = new StatsService();
