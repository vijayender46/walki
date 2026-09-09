import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@walki/recent-notifications";
const MAX_NOTIFICATIONS = 3;

export type WalkiNotification = {
  id: string;
  type: "sos";
  title: string;
  body: string;
  familyId?: string;
  kidId?: string;
  receivedAt: number;
  isRead: boolean;
};

export async function getRecentNotifications(): Promise<WalkiNotification[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const notifications = JSON.parse(stored) as WalkiNotification[];

    return notifications.slice(0, MAX_NOTIFICATIONS);
  } catch (error) {
    console.error("Load notification inbox error:", error);

    return [];
  }
}

export async function saveNotification(notification: WalkiNotification) {
  try {
    const current = await getRecentNotifications();

    const next = [
      notification,
      ...current.filter((item) => item.id !== notification.id),
    ].slice(0, MAX_NOTIFICATIONS);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    return next;
  } catch (error) {
    console.error("Save notification inbox error:", error);

    return [];
  }
}

export async function markNotificationRead(id: string) {
  const current = await getRecentNotifications();

  const next = current.map((notification) =>
    notification.id === id
      ? {
          ...notification,
          isRead: true,
        }
      : notification,
  );

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  return next;
}

export async function markAllNotificationsRead() {
  const current = await getRecentNotifications();

  const next = current.map((notification) => ({
    ...notification,
    isRead: true,
  }));

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  return next;
}
