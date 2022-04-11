//import { } from "@elastosfoundation/hive-js-sdk";

class HiveService {
  //private cache = new Map<string, BehaviorSubject<Buffer>>(); // Map of asset unique key / asset data

  /**
     * Returns a subject that provides a resolved remote icon content.
     * This icon represents the did document and can be either:
     * - An "avatar", if the did document represents a regular user
     * - An "app icon", if the did document is an application DID
     */
  /* public getRepresentativeIcon(document: DIDDocument): BehaviorSubject<Buffer> {
    let hiveIconUrl: string = null;

    //console.log("getRepresentativeIcon", document)

    // Try to find suitable credentials in the document - start with the application credential type
    let applicationCredentials = document.getCredentialsByType("ApplicationCredential");
    //console.log("getRepresentativeIcon applicationCredentials", applicationCredentials)
    if (applicationCredentials && applicationCredentials.length > 0) {
      let credSubject = applicationCredentials[0].getSubject();
      if ("iconUrl" in credSubject)
        hiveIconUrl = credSubject["iconUrl"];
    }

    // Check the "avatar" standard
    if (!hiveIconUrl) {
      let avatarCredentials = document.getCredentialsByType("AvatarCredential");
      //console.log("getRepresentativeIcon avatarCredentials", avatarCredentials)
      if (!avatarCredentials || avatarCredentials.length === 0) {
        // Could not find the more recent avatarcredential type. Try the legacy #avatar name
        let avatarCredential = document.getCredentialById(new DIDURL("#avatar"));
        if (avatarCredential)
          avatarCredentials.push(avatarCredential);
      }

      if (avatarCredentials && avatarCredentials.length > 0) {
        let credSubject = avatarCredentials[0].getSubject();
        if ("avatar" in credSubject && typeof credSubject["avatar"] === "object") {
          let avatar = credSubject["avatar"];
          if ("type" in avatar && avatar["type"] === "elastoshive")
            hiveIconUrl = avatar["data"];
        }
      }
    }

    if (!hiveIconUrl)
      return null;

    return this.globalHiveCacheService.getAssetByUrl(hiveIconUrl, hiveIconUrl);
  } */

  /**
   * Returns a cached asset previously fetched from a hive vault using a
   * hive scripting url. If no item if cached:
   * - if hiveScriptUrl is set: fetched the assets from hive then caches and returns the asset.
   * - if hiveScriptUrl is not set: returns null.
   */
  /* public getAssetByUrl(key: string, hiveScriptUrl?: string): BehaviorSubject<Buffer> {
    // Already in cache? Return the cached data.
    if (this.cache.has(key)) {
      //console.log("DEBUG HIVE CACHE RETURN FROM KEY", key);
      return this.cache.get(key);
    }

    // Nothing in cache? try to fetch something
    let subject = new BehaviorSubject(null);
    this.cache.set(key, subject);

    if (hiveScriptUrl) {
      Logger.log("hivecache", "Fetching hive asset at ", hiveScriptUrl);

      // Don't block the current call
      void this.globalHiveService.fetchHiveScriptPicture(hiveScriptUrl).then(rawPicture => {
        subject.next(rawPicture);
      });
    }
    else {
      // No way to get data for now. Maybe someone will update this later.
    }

    return subject;
  } */

  /**
   * Manually sets an assets value, for example right after creating a local avatar.
   */
  /* public set(key: string, data: any) {
    Logger.log("hivecache", "Setting hive cache item:", key);
    if (!this.cache.has(key))
      this.cache.set(key, new BehaviorSubject(data));

    this.cache.get(key).next(data);
  } */

  /**
   * Removes an entry from the cache
   */
  /* public invalidate(key: string) {
    Logger.log("hivecache", "Invalidating cache item:", key);
    this.cache.set(key, null);
  } */
}

export const hiveService = new HiveService();