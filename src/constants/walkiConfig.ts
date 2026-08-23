export const WALKI_CONFIG = {
  audio: {
    /*
     * Maximum length of one Walki message.
     *
     * 3000 = 3 seconds
     * 5000 = 5 seconds
     */
    maxRecordingDurationMs: 3000,

    /*
     * Orange lock period after recording ends.
     *
     * 6000 = 6 seconds
     */
    cooldownDurationMs: 6000,

    /*
     * Daily send limit.
     *
     * Server enforcement will be added separately.
     */
    dailyMessageLimit: 15,

    /*
     * Low-bandwidth voice settings.
     */
    sampleRate: 16000,
    bitRate: 32000,
    numberOfChannels: 1,
  },

  family: {
    maxParents: 2,
    maxKids: 6,
  },
} as const;
