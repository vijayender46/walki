export type UserRole = "parent" | "kid";

export type ProfileTheme = "blue" | "pink";

export type ParentType = "dad" | "mom";

export type UserProfile = {
  uid: string;

  /*
   * Stable logical kid identity.
   *
   * Parent profiles do not have this.
   */
  kidId?: string | null;

  /*
   * Parent avatar identity.
   *
   * Kid profiles do not use this.
   *
   * Optional so existing Firestore profiles
   * continue to work without migration.
   */
  parentType?: ParentType | null;

  phone: string;

  role: UserRole;

  displayName: string;

  theme: ProfileTheme;

  familyId: string | null;

  createdAt: unknown;

  updatedAt: unknown;
};
