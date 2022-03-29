import { DefaultDIDAdapter } from '@elastosfoundation/did-js-sdk';
import logger from '../logger';

export class MyDIDAdapter extends DefaultDIDAdapter {
    constructor() {
        let resolverUrl = "https://api.trinity-tech.cn/eid";
        logger.info("Using Trinity-Tech DID adapter with resolver url:", resolverUrl)
        super(resolverUrl);
    }
}
