import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import type { WalkiInboxNotification } from "@/features/notifications/firestoreNotificationService";
import { colors, shadows, typography } from "@/theme";

type Props = {
  visible: boolean;
  notifications: WalkiInboxNotification[];
  onClose: () => void;
  onNotificationPress: (notification: WalkiInboxNotification) => void;
};

function getRelativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}

export function NotificationInboxModal({
  visible,
  notifications,
  onClose,
  onNotificationPress,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.card}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={22}
                color={colors.parent.textPrimary}
              />
            </Pressable>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={25}
                  color={colors.parent.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>You are all caught up</Text>

              <Text style={styles.emptyText}>
                Your latest alerts will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {notifications.map((notification) => {
                const isVoice = notification.type === "voice";

                return (
                  <Pressable
                    key={notification.id}
                    onPress={() => onNotificationPress(notification)}
                    style={({ pressed }) => [
                      styles.item,
                      !notification.isRead && styles.unreadItem,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    <View
                      style={[styles.alertIcon, isVoice && styles.voiceIcon]}
                    >
                      <Ionicons
                        name={isVoice ? "mic" : "warning"}
                        size={18}
                        color={isVoice ? colors.parent.primary : "#DC2626"}
                      />
                    </View>

                    <View style={styles.copy}>
                      <View style={styles.itemTopRow}>
                        <Text numberOfLines={1} style={styles.itemTitle}>
                          {notification.title}
                        </Text>

                        {!notification.isRead ? (
                          <View style={styles.unreadDot} />
                        ) : null}
                      </View>

                      <Text numberOfLines={2} style={styles.body}>
                        {notification.body}
                      </Text>

                      <Text style={styles.time}>
                        {getRelativeTime(notification.createdAt)}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.parent.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(30, 20, 10, 0.22)",
    paddingTop: 92,
    paddingHorizontal: 16,
    alignItems: "flex-end",
  },

  card: {
    width: "92%",
    maxWidth: 380,
    borderRadius: 24,
    backgroundColor: colors.white,
    padding: 16,

    ...shadows.navigation,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  title: {
    ...typography.heading,
    fontSize: 20,
    color: colors.parent.textPrimary,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.parent.orangeFaint,
  },

  list: {
    gap: 8,
  },

  item: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: "#FAFAFA",
  },

  unreadItem: {
    backgroundColor: colors.parent.orangeFaint,
  },

  itemPressed: {
    opacity: 0.7,
  },

  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    marginRight: 11,
  },

  voiceIcon: {
    backgroundColor: colors.parent.orangeFaint,
  },

  copy: {
    flex: 1,
  },

  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: colors.parent.textPrimary,
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 6,
    backgroundColor: colors.parent.notification,
  },

  body: {
    ...typography.tiny,
    marginTop: 2,
    color: colors.parent.textSecondary,
  },

  time: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: colors.parent.textMuted,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 28,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.parent.orangeFaint,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "800",
    color: colors.parent.textPrimary,
  },

  emptyText: {
    ...typography.tiny,
    marginTop: 3,
    color: colors.parent.textSecondary,
  },
});
