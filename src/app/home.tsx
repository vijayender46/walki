import { WALKI_CONFIG } from "@/constants/walkiConfig";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getAuth, signOut } from "@react-native-firebase/auth";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { TalkButton } from "@/components/TalkButton";

import { uploadWalkiAudio } from "@/features/audio/audioUploadService";
import { useWalkiFamilyChannel } from "@/features/audio/useWalkiFamilyChannel";
import { useWalkiRecorder } from "@/features/audio/useWalkiRecorder";

import {
  publishFamilyMessage,
  publishKidMessage,
  publishParentMessage,
} from "@/features/audio/walkiChannelService";

import { useAuth } from "@/features/auth/AuthContext";

import type { UserProfile } from "@/features/auth/types";

import {
  listenToFamilyRoster,
  type FamilyPerson,
} from "@/features/family/familyRosterService";

import { createKidInvite } from "@/features/family/familyService";

import {
  getParentFamilyAccess,
  leaveFamily,
} from "@/features/family/parentMembershipService";

import { colors, radius, spacing, typography } from "@/theme";

type ProfileWithKidId = UserProfile & {
  kidId?: string | null;
};

type KidFamilyTab = "family" | "parents" | "siblings";

export default function HomeScreen() {
  const { profile, refreshProfile } = useAuth();

  /*
   * ========================================
   * FAMILY
   * ========================================
   */

  const [familyRoster, setFamilyRoster] = useState<FamilyPerson[]>([]);

  const [isLoadingFamily, setIsLoadingFamily] = useState(false);

  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const [familyError, setFamilyError] = useState<string | null>(null);

  /*
   * ========================================
   * RECIPIENT
   * ========================================
   */

  const [kidFamilyTab, setKidFamilyTab] = useState<KidFamilyTab>("family");

  const [selectedFamilyPersonId, setSelectedFamilyPersonId] = useState<
    string | null
  >(null);

  /*
   * ========================================
   * PARENT ACCESS
   * ========================================
   */

  const [isFamilyCreator, setIsFamilyCreator] = useState(false);

  const [isLoadingFamilyAccess, setIsLoadingFamilyAccess] = useState(false);

  const [isLeavingFamily, setIsLeavingFamily] = useState(false);

  /*
   * ========================================
   * WALKI
   * ========================================
   */

  const [isSendingWalki, setIsSendingWalki] = useState(false);

  const [isWalkiLocked, setIsWalkiLocked] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);

  const [walkiSent, setWalkiSent] = useState(false);

  /*
   * Prevent finger release and automatic
   * 3-second completion from sending twice.
   */
  const recordingCycleHandledRef = useRef(false);

  /*
   * Stable callback reference used by the
   * 3-second auto-send effect.
   *
   * This avoids adding handleTalkEnd itself to
   * the effect dependency array.
   */
  const handleTalkEndRef = useRef<() => Promise<void>>(async () => {});

  const walkiLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isRecording,

    durationMillis,

    maxDurationReached,

    isPlaying,

    error: recordingError,

    startRecording,
    stopRecording,

    playRecordingFromUri,

    stopPlayback,
    clearRecording,
  } = useWalkiRecorder();

  const profileWithKidId = profile as ProfileWithKidId | null;

  /*
   * ========================================
   * FAMILY GROUPS
   * ========================================
   */

  const familyKids = familyRoster.filter((person) => person.role === "kid");

  const familyParents = familyRoster.filter(
    (person) => person.role === "parent",
  );

  /*
   * Current parent cannot select themselves.
   */
  const otherParents = familyParents.filter((person) => !person.isCurrentUser);

  /*
   * Current kid cannot select themselves.
   */
  const siblings = familyKids.filter((person) => !person.isCurrentUser);

  const selectedFamilyPerson = selectedFamilyPersonId
    ? (familyRoster.find(
        (person) =>
          person.id === selectedFamilyPersonId && !person.isCurrentUser,
      ) ?? null)
    : null;

  /*
   * No recording if nobody else exists in the
   * family to receive the Walki.
   */
  const hasAnyRecipient = familyRoster.some((person) => !person.isCurrentUser);

  /*
   * Tear down family listeners immediately
   * while a joined parent leaves.
   */
  const activeFamilyId = isLeavingFamily ? null : (profile?.familyId ?? null);

  /*
   * ========================================
   * SIX-SECOND WALKI LOCK
   * ========================================
   */

  const beginWalkiLock = () => {
    if (walkiLockTimerRef.current) {
      clearTimeout(walkiLockTimerRef.current);
    }

    setIsWalkiLocked(true);

    walkiLockTimerRef.current = setTimeout(() => {
      setIsWalkiLocked(false);

      setWalkiSent(false);

      walkiLockTimerRef.current = null;
    }, WALKI_CONFIG.audio.cooldownDurationMs);
  };

  useEffect(() => {
    return () => {
      if (walkiLockTimerRef.current) {
        clearTimeout(walkiLockTimerRef.current);
      }
    };
  }, []);

  /*
   * ========================================
   * PARENT ACCESS
   * ========================================
   */

  useEffect(() => {
    let cancelled = false;

    const loadFamilyAccess = async () => {
      if (isLeavingFamily || profile?.role !== "parent" || !profile.familyId) {
        setIsFamilyCreator(false);

        setIsLoadingFamilyAccess(false);

        return;
      }

      try {
        setIsLoadingFamilyAccess(true);

        const access = await getParentFamilyAccess(profile.familyId);

        if (!cancelled) {
          setIsFamilyCreator(access.isCreator);
        }
      } catch (error) {
        if (!cancelled && !isLeavingFamily) {
          console.error("Load parent family access error:", error);

          setIsFamilyCreator(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFamilyAccess(false);
        }
      }
    };

    void loadFamilyAccess();

    return () => {
      cancelled = true;
    };
  }, [profile?.familyId, profile?.role, isLeavingFamily]);

  /*
   * ========================================
   * FAMILY ROSTER
   * ========================================
   */

  useEffect(() => {
    if (
      !activeFamilyId ||
      !profile?.uid ||
      (profile.role !== "parent" && profile.role !== "kid")
    ) {
      setFamilyRoster([]);

      setIsLoadingFamily(false);

      return;
    }

    setIsLoadingFamily(true);
    setFamilyError(null);

    let receivedFirstRoster = false;

    const currentAuthUid = getAuth().currentUser?.uid ?? profile.uid;

    const currentKidId =
      profile.role === "kid" ? (profileWithKidId?.kidId ?? null) : null;

    const unsubscribe = listenToFamilyRoster({
      familyId: activeFamilyId,

      currentUserUid: currentAuthUid,

      currentKidId,

      onRoster: (people) => {
        setFamilyRoster(people);

        if (!receivedFirstRoster) {
          receivedFirstRoster = true;

          setIsLoadingFamily(false);
        }
      },

      onError: (error) => {
        if (isLeavingFamily) {
          return;
        }

        console.error("Load family roster error:", error);

        setIsLoadingFamily(false);

        setFamilyError("We couldn't load your family.");
      },
    });

    return () => {
      unsubscribe();
    };
  }, [
    activeFamilyId,
    profile?.role,
    profile?.uid,
    profileWithKidId?.kidId,
    isLeavingFamily,
  ]);

  /*
   * ========================================
   * REMOVE STALE RECIPIENT
   * ========================================
   */

  useEffect(() => {
    if (!selectedFamilyPersonId) {
      return;
    }

    const stillExists = familyRoster.some(
      (person) => person.id === selectedFamilyPersonId && !person.isCurrentUser,
    );

    if (!stillExists) {
      setSelectedFamilyPersonId(null);
    }
  }, [familyRoster, selectedFamilyPersonId]);

  /*
   * ========================================
   * WALKI LISTENERS
   * ========================================
   *
   * Parent:
   * family + own parent inbox
   *
   * Kid:
   * family + own kid inbox
   */

  const directKidIds =
    profile?.role === "kid" && profileWithKidId?.kidId
      ? [profileWithKidId.kidId]
      : [];

  const directParentUid =
    profile?.role === "parent" && !isLeavingFamily
      ? (getAuth().currentUser?.uid ?? profile.uid)
      : null;

  const { lastReceivedAudioUri, isReceiving, incomingError, playLastMessage } =
    useWalkiFamilyChannel({
      familyId: activeFamilyId,

      directKidIds: activeFamilyId ? directKidIds : [],

      directParentUid,

      playAudio: playRecordingFromUri,
    });

  /*
   * ========================================
   * FAMILY ACTIONS
   * ========================================
   */

  const handleCreateFirstFamily = () => {
    router.push("/family/create");
  };

  const handleJoinExistingFamily = () => {
    router.push("/family/parent-join");
  };

  const handleAddParent = () => {
    if (!isFamilyCreator) {
      return;
    }

    router.push("/family/parent-invite");
  };

  /*
   * ========================================
   * LEAVE FAMILY
   * ========================================
   */

  const handleLeaveFamily = () => {
    if (isLeavingFamily || isFamilyCreator) {
      return;
    }

    Alert.alert(
      "Leave family?",
      "You'll leave this Walki family, but your parent account will stay signed in.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Leave",
          style: "destructive",

          onPress: () => {
            void (async () => {
              try {
                setIsLeavingFamily(true);

                setFamilyError(null);

                setSendError(null);

                setSelectedFamilyPersonId(null);

                await leaveFamily();

                await refreshProfile();

                router.replace("/home");
              } catch (error) {
                console.error("Leave family error:", error);

                const message = error instanceof Error ? error.message : "";

                if (message === "FAMILY_CREATOR_CANNOT_LEAVE") {
                  setFamilyError("The family owner can't leave the family.");
                } else {
                  setFamilyError(
                    "We couldn't leave the family. Please try again.",
                  );
                }

                setIsLeavingFamily(false);

                return;
              }

              setIsLeavingFamily(false);
            })();
          },
        },
      ],
    );
  };

  /*
   * ========================================
   * ADD KID
   * ========================================
   */

  const handleAddAnotherKid = async () => {
    if (!profile?.familyId || isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);

      setFamilyError(null);

      const result = await createKidInvite(profile.familyId);

      router.push({
        pathname: "/family/invite",

        params: {
          code: result.inviteCode,
        },
      });
    } catch (error) {
      console.error("Create kid invite error:", error);

      setFamilyError("We couldn't create a kid invite.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  /*
   * ========================================
   * KID PROFILE
   * ========================================
   */

  const handleKidPress = (kid: FamilyPerson) => {
    if (!kid.kidId) {
      return;
    }

    router.push({
      pathname: "/kid/[uid]",

      params: {
        uid: kid.kidId,
      },
    });
  };

  /*
   * ========================================
   * PARENT RECIPIENT
   * ========================================
   */

  const handleParentPersonPress = (parent: FamilyPerson) => {
    if (parent.role !== "parent" || parent.isCurrentUser || !parent.parentUid) {
      return;
    }

    setSelectedFamilyPersonId((current) =>
      current === parent.id ? null : parent.id,
    );

    setSendError(null);
    setWalkiSent(false);
  };

  /*
   * ========================================
   * KID RECIPIENT
   * ========================================
   */

  const handleKidFamilyTabPress = (tab: KidFamilyTab) => {
    setKidFamilyTab(tab);

    setSelectedFamilyPersonId(null);

    setSendError(null);
    setWalkiSent(false);
  };

  const handleKidPersonPress = (person: FamilyPerson) => {
    if (person.isCurrentUser) {
      return;
    }

    setSelectedFamilyPersonId(person.id);

    setSendError(null);
    setWalkiSent(false);
  };

  /*
   * ========================================
   * TALK AVAILABILITY
   * ========================================
   */

  const kidNeedsRecipient =
    profile?.role === "kid" && kidFamilyTab !== "family";

  const kidRecipientReady =
    profile?.role !== "kid" ||
    kidFamilyTab === "family" ||
    Boolean(selectedFamilyPerson);

  const talkDisabled =
    isSendingWalki ||
    isReceiving ||
    isWalkiLocked ||
    isLeavingFamily ||
    isLoadingFamily ||
    !hasAnyRecipient ||
    !kidRecipientReady;

  /*
   * ========================================
   * TALK START
   * ========================================
   */

  const handleTalkStart = async () => {
    if (
      isSendingWalki ||
      isReceiving ||
      isWalkiLocked ||
      isLeavingFamily ||
      isLoadingFamily
    ) {
      return;
    }

    if (!hasAnyRecipient) {
      setSendError("Add a family member to start talking.");

      return;
    }

    if (profile?.role === "kid" && kidNeedsRecipient && !selectedFamilyPerson) {
      setSendError(
        kidFamilyTab === "parents"
          ? "Choose a parent first."
          : "Choose a sibling first.",
      );

      return;
    }

    try {
      /*
       * A new press creates a new Walki cycle.
       */
      recordingCycleHandledRef.current = false;

      setSendError(null);
      setWalkiSent(false);

      if (isPlaying) {
        stopPlayback();
      }

      await startRecording();
    } catch (error) {
      console.error("Walki recording start error:", error);

      setSendError("We couldn't start recording.");
    }
  };

  /*
   * ========================================
   * TALK RELEASE / SEND
   * ========================================
   */

  const handleTalkEnd = async () => {
    /*
     * Auto-stop may already have processed
     * this same recording before PressOut fires.
     */
    if (
      recordingCycleHandledRef.current ||
      isLeavingFamily ||
      !hasAnyRecipient
    ) {
      return;
    }

    /*
     * Reserve the cycle BEFORE awaiting.
     *
     * This prevents duplicate uploads when
     * auto-stop and PressOut happen together.
     */
    recordingCycleHandledRef.current = true;

    try {
      const audioUri = await stopRecording();

      if (!audioUri) {
        /*
         * No completed recording.
         *
         * Allow another attempt.
         */
        recordingCycleHandledRef.current = false;

        return;
      }

      /*
       * Recording has ended.
       *
       * Enter orange locked state immediately.
       */
      beginWalkiLock();

      if (!profile?.familyId) {
        throw new Error("FAMILY_ID_MISSING");
      }

      /*
       * Kid direct routes require a selected
       * destination.
       */
      if (
        profile.role === "kid" &&
        kidFamilyTab !== "family" &&
        !selectedFamilyPerson
      ) {
        clearRecording();

        setSendError("Choose who you want to talk to first.");

        return;
      }

      setIsSendingWalki(true);

      setSendError(null);

      const result = await uploadWalkiAudio({
        audioUri,

        familyId: profile.familyId,
      });

      /*
       * ====================================
       * KID SEND
       * ====================================
       */

      if (profile.role === "kid") {
        const senderKidId = profileWithKidId?.kidId;

        if (!senderKidId) {
          throw new Error("KID_ID_MISSING");
        }

        /*
         * KID → FAMILY
         */

        if (kidFamilyTab === "family") {
          await publishFamilyMessage({
            familyId: profile.familyId,

            audioKey: result.key,

            senderKidId,
          });
        } else if (kidFamilyTab === "parents") {
          /*
           * KID → PARENT
           */
          if (
            !selectedFamilyPerson ||
            selectedFamilyPerson.role !== "parent" ||
            !selectedFamilyPerson.parentUid
          ) {
            throw new Error("INVALID_PARENT_RECIPIENT");
          }

          await publishParentMessage({
            familyId: profile.familyId,

            parentUid: selectedFamilyPerson.parentUid,

            audioKey: result.key,

            senderKidId,
          });
        } else {
          /*
           * KID → SIBLING
           */
          if (
            !selectedFamilyPerson ||
            selectedFamilyPerson.role !== "kid" ||
            !selectedFamilyPerson.kidId ||
            selectedFamilyPerson.kidId === senderKidId
          ) {
            throw new Error("INVALID_SIBLING_RECIPIENT");
          }

          await publishKidMessage({
            familyId: profile.familyId,

            kidId: selectedFamilyPerson.kidId,

            audioKey: result.key,

            senderKidId,
          });
        }
      } else {
        /*
         * ====================================
         * PARENT SEND
         * ====================================
         */
        /*
         * PARENT → SPECIFIC PARENT
         */

        if (
          selectedFamilyPerson?.role === "parent" &&
          selectedFamilyPerson.parentUid
        ) {
          await publishParentMessage({
            familyId: profile.familyId,

            parentUid: selectedFamilyPerson.parentUid,

            audioKey: result.key,

            senderKidId: null,
          });
        } else {
          /*
           * PARENT → FAMILY
           */
          await publishFamilyMessage({
            familyId: profile.familyId,

            audioKey: result.key,

            senderKidId: null,
          });
        }
      }

      clearRecording();

      setWalkiSent(true);
    } catch (error) {
      console.error("Walki release-to-send error:", error);

      const message = error instanceof Error ? error.message : "";

      if (message === "INVALID_PARENT_RECIPIENT") {
        setSendError("Choose a parent first.");
      } else if (message === "INVALID_SIBLING_RECIPIENT") {
        setSendError("Choose a sibling first.");
      } else {
        setSendError("We couldn't send this Walki message.");
      }
    } finally {
      setIsSendingWalki(false);
    }
  };

  /*
   * Keep the ref pointing at the latest version
   * of handleTalkEnd without making the auto-send
   * effect depend on the function identity.
   */
  handleTalkEndRef.current = handleTalkEnd;

  /*
   * ========================================
   * AUTO SEND AT 3 SECONDS
   * ========================================
   */

  useEffect(() => {
    if (!maxDurationReached || recordingCycleHandledRef.current) {
      return;
    }

    void handleTalkEndRef.current();
  }, [maxDurationReached]);

  /*
   * ========================================
   * PLAY LAST MESSAGE
   * ========================================
   */

  const handlePlayLastMessage = async () => {
    if (
      !lastReceivedAudioUri ||
      isRecording ||
      isReceiving ||
      isSendingWalki ||
      isWalkiLocked
    ) {
      return;
    }

    try {
      if (isPlaying) {
        stopPlayback();

        return;
      }

      await playLastMessage();
    } catch (error) {
      console.error("Play last Walki error:", error);
    }
  };

  /*
   * ========================================
   * LOGOUT
   * ========================================
   */

  const handleLogout = async () => {
    try {
      const auth = getAuth();

      await signOut(auth);

      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  /*
   * ========================================
   * DISPLAY HELPERS
   * ========================================
   */

  const getInitial = (name: string) => {
    const clean = name.trim();

    return clean ? clean.charAt(0).toUpperCase() : "K";
  };

  const getKidTabPeople = (): FamilyPerson[] => {
    if (kidFamilyTab === "parents") {
      return familyParents;
    }

    if (kidFamilyTab === "siblings") {
      return siblings;
    }

    return [...familyParents, ...siblings];
  };

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (!profile) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isKid = profile.role === "kid";

  const kidTabPeople = isKid ? getKidTabPeople() : [];

  const kidTalkSubtitle = !hasAnyRecipient
    ? "Add a family member to start talking"
    : kidFamilyTab === "family"
      ? "Hold the mic to talk to everyone"
      : kidFamilyTab === "parents"
        ? selectedFamilyPerson
          ? `Hold to talk to ${selectedFamilyPerson.displayName}`
          : "Choose a parent above"
        : selectedFamilyPerson
          ? `Hold to talk to ${selectedFamilyPerson.displayName}`
          : "Choose a sibling above";

  const parentTalkSubtitle = !hasAnyRecipient
    ? "Add a family member to start talking"
    : selectedFamilyPerson?.role === "parent"
      ? `Hold to talk to ${selectedFamilyPerson.displayName}`
      : "Hold the mic to broadcast";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, isKid && styles.kidContainer]}
      showsVerticalScrollIndicator={false}
    >
      {/*
       * ======================================
       * HEADER
       * ======================================
       */}

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hi {profile.displayName || "Walki"}
            {isKid ? " 👋" : ""}
          </Text>

          <Text style={styles.accountType}>
            {isKid ? "KID WALKI" : "PARENT WALKI"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={handleLogout}
          hitSlop={10}
          style={styles.headerIconButton}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {/*
       * ======================================
       * PARENT WITHOUT FAMILY
       * ======================================
       */}

      {!isKid && !profile.familyId ? (
        <View style={styles.emptyFamilyCard}>
          <Ionicons name="people-outline" size={34} color={colors.primary} />

          <Text style={styles.emptyFamilyTitle}>Connect your family</Text>

          <Text style={styles.emptyFamilyText}>
            Create a Walki family or join an existing one.
          </Text>

          <Pressable
            onPress={handleCreateFirstFamily}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Create family</Text>
          </Pressable>

          <Pressable
            onPress={handleJoinExistingFamily}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Join family</Text>
          </Pressable>
        </View>
      ) : null}

      {/*
       * ======================================
       * PARENT FAMILY
       * ======================================
       */}

      {!isKid && profile.familyId && !isLeavingFamily ? (
        <View style={styles.familyCompactSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>YOUR FAMILY</Text>

              <Text style={styles.sectionTitle}>Kids</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add kid"
              disabled={isCreatingInvite}
              onPress={handleAddAnotherKid}
              style={styles.addKidTopButton}
            >
              {isCreatingInvite ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="add" size={18} color={colors.primary} />

                  <Text style={styles.addKidTopText}>Kid</Text>
                </>
              )}
            </Pressable>
          </View>

          {isLoadingFamily ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.kidLoader}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleRow}
            >
              {familyKids.map((kid) => {
                const pink = kid.theme === "pink";

                return (
                  <Pressable
                    key={`${kid.id}-${kid.displayName}-${kid.theme}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${kid.displayName}`}
                    onPress={() => handleKidPress(kid)}
                    style={styles.personTile}
                  >
                    <View
                      style={[
                        styles.personAvatar,

                        pink ? styles.pinkAvatar : styles.blueAvatar,
                      ]}
                    >
                      <Text style={styles.personInitial}>
                        {getInitial(kid.displayName)}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={styles.personName}>
                      {kid.displayName || "Kid"}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add kid"
                disabled={isCreatingInvite}
                onPress={handleAddAnotherKid}
                style={styles.personTile}
              >
                <View style={styles.addPersonAvatar}>
                  {isCreatingInvite ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="add" size={28} color={colors.primary} />
                  )}
                </View>

                <Text style={styles.personName}>Add</Text>
              </Pressable>
            </ScrollView>
          )}

          <View style={styles.parentSectionHeader}>
            <Text style={styles.sectionTitle}>Parents</Text>

            {isLoadingFamilyAccess ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isFamilyCreator ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Invite parent"
                onPress={handleAddParent}
                style={styles.addKidTopButton}
              >
                <Ionicons
                  name="person-add-outline"
                  size={17}
                  color={colors.primary}
                />

                <Text style={styles.addKidTopText}>Invite</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Leave family"
                disabled={isLeavingFamily}
                onPress={handleLeaveFamily}
                style={styles.leaveFamilyButton}
              >
                {isLeavingFamily ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons
                      name="exit-outline"
                      size={17}
                      color={colors.danger}
                    />

                    <Text style={styles.leaveFamilyText}>Leave</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {isLoadingFamily ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.parentLoader}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleRow}
            >
              {otherParents.map((parent) => {
                const selected = selectedFamilyPersonId === parent.id;

                return (
                  <Pressable
                    key={parent.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Talk directly to ${parent.displayName}`}
                    accessibilityState={{
                      selected,
                    }}
                    onPress={() => handleParentPersonPress(parent)}
                    style={[
                      styles.personTile,

                      selected && styles.parentRecipientTileSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.personAvatar,
                        styles.parentAvatar,

                        selected && styles.parentRecipientAvatarSelected,
                      ]}
                    >
                      <Text style={styles.personInitial}>
                        {getInitial(parent.displayName)}
                      </Text>

                      {selected ? (
                        <View style={styles.selectedBadge}>
                          <Ionicons
                            name="checkmark"
                            size={11}
                            color={colors.white}
                          />
                        </View>
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.personName,

                        selected && styles.parentRecipientNameSelected,
                      ]}
                    >
                      {parent.displayName || "Parent"}
                    </Text>
                  </Pressable>
                );
              })}

              {isFamilyCreator && !isLoadingFamilyAccess ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Invite another parent"
                  onPress={handleAddParent}
                  style={styles.personTile}
                >
                  <View style={styles.addParentAvatar}>
                    <Ionicons
                      name="person-add-outline"
                      size={25}
                      color={colors.primary}
                    />
                  </View>

                  <Text style={styles.personName}>Invite</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}

          {familyError ? (
            <Text style={styles.errorText}>{familyError}</Text>
          ) : null}
        </View>
      ) : null}

      {/*
       * ======================================
       * KID FAMILY SELECTOR
       * ======================================
       */}

      {isKid && profile.familyId ? (
        <View style={styles.kidFamilySection}>
          <View style={styles.kidConnectedPill}>
            <Ionicons name="people" size={17} color="#16A34A" />

            <Text style={styles.kidConnectedText}>Family connected</Text>
          </View>

          <Text style={styles.kidFamilyTitle}>Who do you want to talk to?</Text>

          <View style={styles.kidTabs}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Talk to family"
              onPress={() => handleKidFamilyTabPress("family")}
              style={[
                styles.kidTab,

                kidFamilyTab === "family" && styles.kidTabActive,
              ]}
            >
              <Ionicons
                name="home-outline"
                size={16}
                color={
                  kidFamilyTab === "family"
                    ? colors.primary
                    : colors.textSecondary
                }
              />

              <Text
                style={[
                  styles.kidTabText,

                  kidFamilyTab === "family" && styles.kidTabTextActive,
                ]}
              >
                Family
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Talk to parents"
              onPress={() => handleKidFamilyTabPress("parents")}
              style={[
                styles.kidTab,

                kidFamilyTab === "parents" && styles.kidTabActive,
              ]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={
                  kidFamilyTab === "parents"
                    ? colors.primary
                    : colors.textSecondary
                }
              />

              <Text
                style={[
                  styles.kidTabText,

                  kidFamilyTab === "parents" && styles.kidTabTextActive,
                ]}
              >
                Parents
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Talk to siblings"
              onPress={() => handleKidFamilyTabPress("siblings")}
              style={[
                styles.kidTab,

                kidFamilyTab === "siblings" && styles.kidTabActive,
              ]}
            >
              <Ionicons
                name="happy-outline"
                size={16}
                color={
                  kidFamilyTab === "siblings"
                    ? colors.primary
                    : colors.textSecondary
                }
              />

              <Text
                style={[
                  styles.kidTabText,

                  kidFamilyTab === "siblings" && styles.kidTabTextActive,
                ]}
              >
                Siblings
              </Text>
            </Pressable>
          </View>

          {isLoadingFamily ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.kidRosterLoader}
            />
          ) : kidFamilyTab === "family" ? (
            <>
              <View
                style={[
                  styles.familyTargetCard,
                  styles.familyTargetCardSelected,
                ]}
              >
                <View style={styles.familyTargetIcon}>
                  <Ionicons name="people" size={25} color={colors.white} />
                </View>

                <View style={styles.familyTargetContent}>
                  <Text style={styles.familyTargetTitle}>Everyone</Text>

                  <Text style={styles.familyTargetSubtitle}>
                    Your whole Walki family
                  </Text>
                </View>

                <Ionicons
                  name="checkmark-circle"
                  size={21}
                  color={colors.primary}
                />
              </View>

              {kidTabPeople.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.kidPeopleRow}
                >
                  {kidTabPeople.map((person) => {
                    const pink =
                      person.role === "kid" && person.theme === "pink";

                    return (
                      <View key={person.id} style={styles.kidPersonTile}>
                        <View
                          style={[
                            styles.kidPersonAvatar,

                            person.role === "parent"
                              ? styles.parentAvatar
                              : pink
                                ? styles.pinkAvatar
                                : styles.blueAvatar,
                          ]}
                        >
                          <Text style={styles.kidPersonInitial}>
                            {getInitial(person.displayName)}
                          </Text>
                        </View>

                        <Text numberOfLines={1} style={styles.kidPersonName}>
                          {person.displayName}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : null}
            </>
          ) : kidTabPeople.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kidPeopleRow}
            >
              {kidTabPeople.map((person) => {
                const selected = selectedFamilyPersonId === person.id;

                const pink = person.role === "kid" && person.theme === "pink";

                return (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${person.displayName}`}
                    accessibilityState={{
                      selected,
                    }}
                    onPress={() => handleKidPersonPress(person)}
                    style={[
                      styles.kidPersonTile,

                      selected && styles.kidPersonTileSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.kidPersonAvatar,

                        person.role === "parent"
                          ? styles.parentAvatar
                          : pink
                            ? styles.pinkAvatar
                            : styles.blueAvatar,

                        selected && styles.kidPersonAvatarSelected,
                      ]}
                    >
                      <Text style={styles.kidPersonInitial}>
                        {getInitial(person.displayName)}
                      </Text>

                      {selected ? (
                        <View style={styles.selectedBadge}>
                          <Ionicons
                            name="checkmark"
                            size={11}
                            color={colors.white}
                          />
                        </View>
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.kidPersonName,

                        selected && styles.kidPersonNameSelected,
                      ]}
                    >
                      {person.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.kidEmptyGroup}>
              <Ionicons
                name={
                  kidFamilyTab === "siblings"
                    ? "happy-outline"
                    : "people-outline"
                }
                size={24}
                color={colors.textMuted}
              />

              <Text style={styles.kidEmptyGroupText}>
                {kidFamilyTab === "siblings"
                  ? "No other kids yet"
                  : "No parents available"}
              </Text>
            </View>
          )}

          {familyError ? (
            <Text style={styles.errorText}>{familyError}</Text>
          ) : null}
        </View>
      ) : null}

      {/*
       * ======================================
       * TALK
       * ======================================
       */}

      <View style={[styles.talkArea, isKid && styles.kidTalkArea]}>
        <Text style={[styles.readyTitle, isKid && styles.kidReadyTitle]}>
          {isRecording
            ? "Talking..."
            : isWalkiLocked
              ? "Walki sent"
              : isSendingWalki
                ? "Sending..."
                : isReceiving
                  ? "Listen up!"
                  : isPlaying
                    ? "Playing Walki"
                    : isKid
                      ? "Ready!"
                      : "Ready to talk"}
        </Text>

        <Text style={styles.readySubtitle}>
          {isRecording
            ? `Release anytime — max ${
                WALKI_CONFIG.audio.maxRecordingDurationMs / 1000
              } seconds`
            : isWalkiLocked
              ? "Talk will be ready again shortly"
              : isReceiving
                ? "Incoming Walki message"
                : isKid
                  ? kidTalkSubtitle
                  : parentTalkSubtitle}
        </Text>

        <View style={styles.talkButtonSpace}>
          <TalkButton
            kidMode={isKid}
            isRecording={isRecording}
            durationMillis={durationMillis}
            isSending={isSendingWalki}
            isReceiving={isReceiving}
            isLocked={isWalkiLocked}
            disabled={talkDisabled}
            onPressIn={() => {
              void handleTalkStart();
            }}
            onPressOut={() => {
              void handleTalkEnd();
            }}
          />
        </View>

        {walkiSent && !isRecording ? (
          <View style={styles.sentPill}>
            <Ionicons name="checkmark-circle" size={17} color="#16A34A" />

            <Text style={styles.sentText}>Walki sent</Text>
          </View>
        ) : null}

        {lastReceivedAudioUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play last message"
            disabled={
              isRecording || isReceiving || isSendingWalki || isWalkiLocked
            }
            onPress={() => {
              void handlePlayLastMessage();
            }}
            style={({ pressed }) => [
              styles.lastMessageButton,

              pressed && styles.lastMessagePressed,

              (isRecording || isReceiving || isSendingWalki || isWalkiLocked) &&
                styles.disabled,
            ]}
          >
            <Ionicons
              name={isPlaying ? "stop-circle-outline" : "play-circle-outline"}
              size={23}
              color={colors.primary}
            />

            <Text style={styles.lastMessageText}>
              {isPlaying ? "Stop message" : "Play last message"}
            </Text>
          </Pressable>
        ) : null}

        {sendError || recordingError || incomingError ? (
          <Text style={styles.errorText}>
            {sendError || recordingError || incomingError}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 18,
    paddingBottom: 24,
    backgroundColor: colors.background,
  },

  kidContainer: {
    justifyContent: "space-between",
  },

  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  greeting: {
    ...typography.title,
    fontSize: 27,
    color: colors.textPrimary,
  },

  accountType: {
    ...typography.caption,
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textMuted,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },

  familyCompactSection: {
    width: "100%",
    marginTop: spacing.lg,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  parentSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },

  eyebrow: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.primary,
  },

  sectionTitle: {
    ...typography.title,
    marginTop: 1,
    fontSize: 20,
    color: colors.textPrimary,
  },

  addKidTopButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },

  addKidTopText: {
    ...typography.caption,
    marginLeft: 2,
    fontWeight: "700",
    color: colors.primary,
  },

  leaveFamilyButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },

  leaveFamilyText: {
    ...typography.caption,
    marginLeft: 4,
    fontWeight: "700",
    color: colors.danger,
  },

  peopleRow: {
    gap: 13,
    paddingTop: 12,
    paddingBottom: 10,
  },

  kidLoader: {
    marginVertical: 22,
  },

  parentLoader: {
    marginVertical: 18,
  },

  personTile: {
    width: 68,
    alignItems: "center",
  },

  personAvatar: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
  },

  blueAvatar: {
    backgroundColor: "#3B82F6",
  },

  pinkAvatar: {
    backgroundColor: "#FF5CA8",
  },

  parentAvatar: {
    backgroundColor: colors.primary,
  },

  personInitial: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.white,
  },

  personName: {
    ...typography.caption,
    width: 68,
    marginTop: 5,
    textAlign: "center",
    fontWeight: "600",
    color: colors.textPrimary,
  },

  addPersonAvatar: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: 29,
    backgroundColor: colors.surface,
  },

  addParentAvatar: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: 29,
    backgroundColor: colors.surface,
  },

  parentRecipientTileSelected: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  parentRecipientAvatarSelected: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },

  parentRecipientNameSelected: {
    fontWeight: "800",
    color: colors.primary,
  },

  emptyFamilyCard: {
    width: "100%",
    alignItems: "center",
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  emptyFamilyTitle: {
    ...typography.title,
    marginTop: 8,
    fontSize: 22,
    color: colors.textPrimary,
  },

  emptyFamilyText: {
    ...typography.body,
    marginTop: 5,
    textAlign: "center",
    color: colors.textSecondary,
  },

  primaryAction: {
    width: "100%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },

  primaryActionText: {
    ...typography.button,
    color: colors.white,
  },

  secondaryAction: {
    width: "100%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  secondaryActionText: {
    ...typography.button,
    color: colors.primary,
  },

  kidFamilySection: {
    width: "100%",
    marginTop: 12,
    paddingTop: 4,
  },

  kidConnectedPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.round,
    backgroundColor: "#ECFDF3",
  },

  kidConnectedText: {
    ...typography.caption,
    marginLeft: 6,
    fontWeight: "700",
    color: "#15803D",
  },

  kidFamilyTitle: {
    ...typography.title,
    marginTop: 13,
    fontSize: 18,
    textAlign: "center",
    color: colors.textPrimary,
  },

  kidTabs: {
    width: "100%",
    flexDirection: "row",
    gap: 7,
    marginTop: 11,
    padding: 4,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },

  kidTab: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
  },

  kidTabActive: {
    backgroundColor: colors.background,
  },

  kidTabText: {
    ...typography.caption,
    marginLeft: 4,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  kidTabTextActive: {
    color: colors.primary,
  },

  kidRosterLoader: {
    marginVertical: 22,
  },

  familyTargetCard: {
    width: "100%",
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 13,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  familyTargetCardSelected: {
    borderColor: colors.primary,
  },

  familyTargetIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },

  familyTargetContent: {
    flex: 1,
    marginLeft: 11,
  },

  familyTargetTitle: {
    ...typography.body,
    fontWeight: "800",
    color: colors.textPrimary,
  },

  familyTargetSubtitle: {
    ...typography.caption,
    marginTop: 1,
    color: colors.textSecondary,
  },

  kidPeopleRow: {
    gap: 11,
    paddingTop: 12,
    paddingBottom: 4,
  },

  kidPersonTile: {
    width: 68,
    alignItems: "center",
    paddingVertical: 3,
    borderRadius: radius.md,
  },

  kidPersonTileSelected: {
    backgroundColor: colors.surface,
  },

  kidPersonAvatar: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 27,
  },

  kidPersonAvatarSelected: {
    borderColor: colors.textPrimary,
  },

  kidPersonInitial: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.white,
  },

  kidPersonName: {
    ...typography.caption,
    width: 68,
    marginTop: 5,
    textAlign: "center",
    fontWeight: "600",
    color: colors.textPrimary,
  },

  kidPersonNameSelected: {
    fontWeight: "800",
    color: colors.primary,
  },

  selectedBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 19,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },

  kidEmptyGroup: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  kidEmptyGroupText: {
    ...typography.caption,
    marginTop: 4,
    color: colors.textMuted,
  },

  talkArea: {
    width: "100%",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  kidTalkArea: {
    marginTop: 14,
    paddingTop: 20,
    paddingBottom: 22,
    backgroundColor: colors.surface,
  },

  readyTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.textPrimary,
  },

  kidReadyTitle: {
    fontSize: 28,
    fontWeight: "800",
  },

  readySubtitle: {
    ...typography.caption,
    marginTop: 3,
    textAlign: "center",
    color: colors.textSecondary,
  },

  talkButtonSpace: {
    marginTop: 16,
  },

  sentPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: "#ECFDF3",
  },

  sentText: {
    ...typography.caption,
    marginLeft: 5,
    fontWeight: "700",
    color: "#15803D",
  },

  lastMessageButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 15,
    borderRadius: radius.round,
    backgroundColor: colors.background,
  },

  lastMessageText: {
    ...typography.body,
    marginLeft: 7,
    fontWeight: "700",
    color: colors.primary,
  },

  lastMessagePressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.45,
  },

  errorText: {
    ...typography.caption,
    marginTop: 8,
    textAlign: "center",
    color: colors.danger,
  },
});
