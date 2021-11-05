export type UserType = 'admin' | 'user';

export type User = {
  did: string;
  name?: string; // User name, from his DID profile
  email?: string; // User email, from his DID profile
  type: UserType;
  creationTime?: number;
  canManageAdmins?: boolean; // Whether this user is allowed to add/remove other admins
}
