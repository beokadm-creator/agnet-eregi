import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo } from "react";
import { router } from "expo-router";
import { useApi } from "../../../hooks/useApi";

export default function CasesIndex() {
  const { busy, data, error, callApi } = useApi();
  const items: any[] = data?.items || data?.submissions || [];

  useEffect(() => {
    callApi("/v1/user/submissions");
  }, []);

  const statusLabel = useMemo(() => ({
    draft: "작성중",
    collecting: "처리중",
    packaging: "처리중",
    ready: "완료",
    completed: "완료",
    failed: "실패",
  } as Record<string, string>), []);

  function renderItem({ item }: { item: any }) {
    const s = String(item.status || "unknown");
    const label = statusLabel[s] || s;
    return (
      <Pressable onPress={() => router.push(`/(tabs)/cases/${item.id}`)} style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.id}</Text>
          <View style={[styles.badge, s === "failed" ? styles.badgeFail : s === "completed" || s === "ready" ? styles.badgeOk : styles.badgeWip]}>
            <Text style={styles.badgeText}>{label}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.id}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {busy && items.length === 0 && <ActivityIndicator />}
      {!busy && error ? (
        <Text style={{ color: "#b91c1c" }}>{error}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748b",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeOk: {
    backgroundColor: "#dcfce7",
  },
  badgeWip: {
    backgroundColor: "#e0e7ff",
  },
  badgeFail: {
    backgroundColor: "#fee2e2",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
});

