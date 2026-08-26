export type UserRole = "parent" | "kid";

export type ProfileTheme = "blue" | "pink";

export type UserProfile = {
  uid: string;

  /*
   * Stable logical kid identity.
   *
   * Parent profiles do not have this.
   * Kid profiles may contain it in Firestore.
   */
  kidId?: string | null;

  phone: string;

  role: UserRole;

  displayName: string;

  theme: ProfileTheme;

  familyId: string | null;

  createdAt: unknown;

  updatedAt: unknown;
};
