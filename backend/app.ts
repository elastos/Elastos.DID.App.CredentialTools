import bodyParser from "body-parser";
import cors from "cors";
import debug from "debug";
import express from "express";
import http from "http";
import logger from "morgan";
import { AddressInfo } from "net";
import traceLogger from "./logger";
import router from "./routes/routes";
import { credentialTypeService } from "./services/credentialtype.service";
import { dbService } from "./services/db.service";
import { didService } from "./services/did.service";
import { statsService } from "./services/stats.service";

class CredentialsToolboxApp {
    constructor() { }

    public async initialize(): Promise<void> {
        let app = express();

        app.use(cors());
        app.use(bodyParser.json({ limit: '5mb' }));
        app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
        app.use(logger('dev'));
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        //app.use(authMiddleware)
        app.use('/api/v1', router);

        await dbService.connect();
        await didService.setup();
        await credentialTypeService.setup();

        statsService.startStatsAggregationTask();

        let dbg = debug('credentials-toolbox:server');

        let port = '3020';
        app.set('port', port);

        let server = http.createServer(app);
        server.listen(port);

        server.on('error', (error) => {
            /* if (error.syscall !== 'listen') {
                throw error;
            } */

            let bind = typeof port === 'string'
                ? 'Pipe ' + port
                : 'Port ' + port;

            // handle specific listen errors with friendly messages
            switch (error.name) {
                case 'EACCES':
                    throw new Error(bind + ' requires elevated privileges');
                case 'EADDRINUSE':
                    throw new Error(bind + ' is already in use');
                default:
                    throw error;
            }
        });

        /**
         * Event listener for HTTP server "listening" event.
         */
        server.on('listening', () => {
            let addr = server.address() as AddressInfo;
            if (!addr)
                throw new Error("No server address!");

            let bind = typeof addr === 'string'
                ? 'pipe ' + addr
                : 'port ' + addr.port;
            dbg('Listening on ' + bind);

            traceLogger.info(`========= Credentials toolbox service started with ${bind} =============`);
        });
    }
}

const mainApp = new CredentialsToolboxApp();
void mainApp.initialize();