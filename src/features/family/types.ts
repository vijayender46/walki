export type Family = {
  id: string;
  parentUid: string;
  kidUid: string | null;
  createdAt: unknown;
};

export type FamilyInvite = {
  code: string;
  familyId: string;
  parentUid: string;
  used: boolean;
  createdAt: unknown;
};
