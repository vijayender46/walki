export const DEFAULT_AVATARS = {
  dad: require("../../assets/images/avatars/dad.png"),

  mom: require("../../assets/images/avatars/mom.png"),

  boy: require("../../assets/images/avatars/boy.png"),

  girl: require("../../assets/images/avatars/girl.png"),
} as const;

export type DefaultAvatarKey = keyof typeof DEFAULT_AVATARS;

type GetDefaultAvatarInput = {
  role: "parent" | "kid";

  theme?: "blue" | "pink" | null;

  parentType?: "dad" | "mom" | null;
};

export function getDefaultAvatar({
  role,
  theme,
  parentType,
}: GetDefaultAvatarInput) {
  if (role === "parent") {
    /*
     * Existing legacy parents without parentType
     * safely default to Dad for now.
     */
    return parentType === "mom" ? DEFAULT_AVATARS.mom : DEFAULT_AVATARS.dad;
  }

  return theme === "pink" ? DEFAULT_AVATARS.girl : DEFAULT_AVATARS.boy;
}
