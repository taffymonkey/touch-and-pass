/**
 * Notification Preferences Screen
 *
 * Shows notification permission status and allows users to manage
 * their notification preferences using OneSignal tags.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  DARK_BG,
  CARD_BG,
  BORDER_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BRAND_GREEN,
} from "@/constants/Colors";

interface NotificationCategory {
  key: string;
  label: string;
  description: string;
}

interface NotificationSection {
  title: string;
  categories: NotificationCategory[];
}

const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    title: "Match Alerts",
    categories: [
      {
        key: "notify_kickoff_reminder",
        label: "Kick-off Reminder",
        description: "1 hour before your team plays",
      },
      {
        key: "notify_match_started",
        label: "Match Started",
        description: "When your team's match kicks off",
      },
      {
        key: "notify_half_time",
        label: "Half Time",
        description: "Half-time score for your team's matches",
      },
      {
        key: "notify_second_half",
        label: "Second Half Started",
        description: "When the second half begins",
      },
      {
        key: "notify_full_time",
        label: "Full Time",
        description: "Final score when your team's match ends",
      },
      {
        key: "notify_new_fixture",
        label: "New Fixture",
        description: "When a new match is scheduled for your team",
      },
    ],
  },
  {
    title: "In-Game Events",
    categories: [
      {
        key: "notify_try",
        label: "Try Scored",
        description: "Any try in your team's match",
      },
      {
        key: "notify_conversion",
        label: "Conversion",
        description: "Any conversion in your team's match",
      },
      {
        key: "notify_penalty",
        label: "Penalty",
        description: "Any penalty in your team's match",
      },
      {
        key: "notify_drop_goal",
        label: "Drop Goal",
        description: "Any drop goal in your team's match",
      },
      {
        key: "notify_yellow_card",
        label: "Yellow Card",
        description: "Any yellow card in your team's match",
      },
      {
        key: "notify_red_card",
        label: "Red Card",
        description: "Any red card in your team's match",
      },
      {
        key: "notify_player_milestone",
        label: "Player Milestone",
        description: "When a favourite player hits a scoring milestone",
      },
    ],
  },
];

const ALL_CATEGORIES = NOTIFICATION_SECTIONS.flatMap((s) => s.categories);

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { hasPermission, permissionDenied, isWeb, requestPermission, sendTag, deleteTag } =
    useNotifications();

  const [categories, setCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_CATEGORIES.map((cat) => [cat.key, true]))
  );

  const handleEnableNotifications = async () => {
    console.log("[NotificationPreferences] Enable notifications pressed");
    if (permissionDenied) {
      Alert.alert(
        "Notifications Disabled",
        "To receive notifications, please enable them in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                Linking.openURL("app-settings:");
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
      return;
    }

    await requestPermission();
  };

  const handleCategoryToggle = (key: string, value: boolean) => {
    console.log("[NotificationPreferences] Toggle preference:", key, "->", value);
    setCategories((prev) => ({ ...prev, [key]: value }));

    if (value) {
      sendTag(key, "true");
    } else {
      deleteTag(key);
    }
  };

  if (isWeb) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.webMessage}>
            Push notifications are available in the mobile app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          console.log("[NotificationPreferences] Back pressed");
          router.back();
        }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Permission Status */}
        <View style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionIcon}>
              {hasPermission ? "🔔" : "🔕"}
            </Text>
            <View style={styles.permissionTextContainer}>
              <Text style={styles.permissionTitle}>
                {hasPermission ? "Notifications Enabled" : "Notifications Disabled"}
              </Text>
              <Text style={styles.permissionDescription}>
                {hasPermission
                  ? "You'll receive push notifications"
                  : "Enable notifications to stay updated"}
              </Text>
            </View>
          </View>
          {!hasPermission && (
            <TouchableOpacity
              style={styles.enableButton}
              onPress={handleEnableNotifications}
            >
              <Text style={styles.enableButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notification Sections */}
        {hasPermission && NOTIFICATION_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.categories.map((category, index) => {
                const isLast = index === section.categories.length - 1;
                return (
                  <View
                    key={category.key}
                    style={[styles.categoryRow, !isLast && styles.categoryRowBorder]}
                  >
                    <View style={styles.categoryText}>
                      <Text style={styles.categoryLabel}>{category.label}</Text>
                      <Text style={styles.categoryDescription}>
                        {category.description}
                      </Text>
                    </View>
                    <Switch
                      value={categories[category.key]}
                      onValueChange={(value) =>
                        handleCategoryToggle(category.key, value)
                      }
                      trackColor={{ false: BORDER_COLOR, true: BRAND_GREEN }}
                      thumbColor="#fff"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    fontSize: 16,
    color: BRAND_GREEN,
    width: 60,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  webMessage: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
  permissionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  permissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  permissionIcon: {
    fontSize: 32,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  permissionDescription: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  enableButton: {
    marginTop: 16,
    backgroundColor: BRAND_GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  enableButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_SECONDARY,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: "hidden",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  categoryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  categoryText: {
    flex: 1,
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    fontWeight: "500",
  },
  categoryDescription: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
});
