import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "#f3f4f6", text: "#555" },
  SUBMITTED: { bg: "#fef3c7", text: "#92400e" },
  IN_REVIEW: { bg: "#dbeafe", text: "#1d4ed8" },
  APPROVED: { bg: "#dcfce7", text: "#166534" },
  PUBLISHED: { bg: "#dcfce7", text: "#166534" },
  REJECTED: { bg: "#fef2f2", text: "#dc2626" },
};

export function DashboardScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, earnings: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const userData = await AsyncStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));

    try {
      const data = await api("/api/articles?limit=20&authorId=me");
      setArticles(data.articles || []);
      setStats({
        total: data.total || 0,
        published: (data.articles || []).filter((a: any) => a.status === "PUBLISHED").length,
        pending: (data.articles || []).filter((a: any) => ["SUBMITTED", "IN_REVIEW"].includes(a.status)).length,
        earnings: 0,
      });
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["user", "auth-token"]);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>నమస్కారం, {user?.name || "Reporter"}</Text>
          <Text style={styles.role}>{user?.role || "REPORTER"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderTopColor: "#3b82f6" }]}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: "#16a34a" }]}>
          <Text style={styles.statNumber}>{stats.published}</Text>
          <Text style={styles.statLabel}>Published</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: "#f59e0b" }]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: "#16a34a" }]}>
          <Text style={styles.statNumber}>₹{stats.earnings}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("NewArticle")}>
          <Text style={styles.actionIcon}>✏️</Text>
          <Text style={styles.actionText}>New Article</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Earnings")}>
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionText}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.actionIcon}>👤</Text>
          <Text style={styles.actionText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Articles List */}
      <Text style={styles.sectionTitle}>My Articles</Text>
      <FlatList
        data={articles}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#FF2C2C"]} />}
        renderItem={({ item }) => {
          const sc = statusColors[item.status] || statusColors.DRAFT;
          return (
            <TouchableOpacity style={styles.articleCard} onPress={() => navigation.navigate("EditArticle", { id: item.id })}>
              <View style={styles.articleRow}>
                <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.articleMeta}>
                {item.category?.nameEn || ""} • {item.viewCount || 0} views • {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              {item.rejectionNote && item.status === "REJECTED" && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionLabel}>Feedback:</Text>
                  <Text style={styles.rejectionText}>{item.rejectionNote}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No articles yet. Tap "New Article" to start writing!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50, backgroundColor: "#FF2C2C" },
  greeting: { fontSize: 18, fontWeight: "800", color: "#fff" },
  role: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  logoutBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8 },
  logoutText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center", borderTopWidth: 3, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statNumber: { fontSize: 20, fontWeight: "900", color: "#111" },
  statLabel: { fontSize: 10, color: "#888", marginTop: 2 },
  actionsRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 12 },
  actionBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  actionIcon: { fontSize: 22 },
  actionText: { fontSize: 11, fontWeight: "700", color: "#555", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", paddingHorizontal: 16, marginBottom: 8 },
  articleCard: { backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  articleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  articleTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#111", marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  articleMeta: { fontSize: 11, color: "#888", marginTop: 6 },
  rejectionBox: { marginTop: 8, padding: 8, backgroundColor: "#fef2f2", borderRadius: 6, borderLeftWidth: 3, borderLeftColor: "#dc2626" },
  rejectionLabel: { fontSize: 10, fontWeight: "700", color: "#dc2626" },
  rejectionText: { fontSize: 12, color: "#666" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#aaa", textAlign: "center" },
});
