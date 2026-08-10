export type UserRole = "parent" | "kid";

export type ProfileTheme = "blue" | "pink";

export type UserProfile = {
  uid: string;
  phone: string;
  role: UserRole;
  displayName: string;
  theme: ProfileTheme;
  familyId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};
