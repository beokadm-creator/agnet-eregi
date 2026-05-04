import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo } from "react";
import { router } from "expo-router";
import { useApi } from "../../../hooks/useApi";
import { T, R, S, FS, FW } from '../../../lib/tokens';

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
        <Text style={{ color: T.danger }}>{error}</Text>
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
    padding: S.lg,
    backgroundColor: T.paper,
  },
  card: {
    backgroundColor: T.canvas,
    borderWidth: 1,
    borderColor: T.hairline,
    borderRadius: R.r2,
    padding: S.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: S.sm + 2,
  },
  cardTitle: {
    flex: 1,
    fontSize: FS.md,
    fontWeight: FW.bold,
    color: T.ink,
  },
  cardMeta: {
    marginTop: S.sm - 2,
    fontSize: FS.sm,
    color: T.slate,
  },
  badge: {
    paddingHorizontal: S.sm + 2,
    paddingVertical: S.xs,
    borderRadius: R.pill,
  },
  badgeOk: {
    backgroundColor: T.successSoft,
  },
  badgeWip: {
    backgroundColor: T.accentSoft,
  },
  badgeFail: {
    backgroundColor: T.dangerSoft,
  },
  badgeText: {
    fontSize: FS.sm,
    fontWeight: FW.bold,
    color: T.ink,
  },
});

