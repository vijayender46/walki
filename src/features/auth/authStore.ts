import { signInWithPhoneNumber } from "@react-native-firebase/auth";

type ConfirmationResult = Awaited<ReturnType<typeof signInWithPhoneNumber>>;

let confirmationResult: ConfirmationResult | null = null;

export const authStore = {
  setConfirmation(confirmation: ConfirmationResult) {
    confirmationResult = confirmation;
  },

  getConfirmation() {
    return confirmationResult;
  },

  clearConfirmation() {
    confirmationResult = null;
  },
};
