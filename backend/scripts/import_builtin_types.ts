import logger from "../logger";
import { credentialTypeService } from "../services/credentialtype.service";
import { dbService } from "../services/db.service";

void (async () => {
  await dbService.connect();
  logger.info("Fetching and updating built-in types");
  await credentialTypeService.upsertPreloadedTypes();

  console.log();
  logger.info("Import completed, you can stop this script");
  console.log();
})();