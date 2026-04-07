import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, uploadImage } from "../api/client";

const districts = [
  { label: "కర్నూలు", value: "kurnool" },
  { label: "నంద్యాల", value: "nandyal" },
  { label: "అనంతపురం", value: "ananthapuramu" },
  { label: "శ్రీ సత్యసాయి", value: "sri-sathya-sai" },
  { label: "వై.యస్.ఆర్ కడప", value: "ysr-kadapa" },
  { label: "అన్నమయ్య", value: "annamayya" },
  { label: "తిరుపతి", value: "tirupati" },
  { label: "చిత్తూరు", value: "chittoor" },
];

export function NewArticleScreen({ navigation }: any) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [imageUri, setImageUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    api("/api/categories").then(setCategories).catch(() => {});
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera permission required");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const translateToTelugu = async () => {
    if (!body && !title) return Alert.alert("Write something first");
    setTranslating(true);
    try {
      const data = await api("/api/ai/rewrite", {
        method: "POST",
        body: { text: `Title: ${title}\n\nBody: ${body}`, action: "translate" },
      });
      if (data.result) {
        // Extract title from h2
        const h2Match = data.result.match(/<h2[^>]*>(.*?)<\/h2>/);
        if (h2Match) setTitle(h2Match[1].replace(/<[^>]+>/g, "").trim());
        // Extract summary from first paragraph
        const pMatch = data.result.match(/<p[^>]*>(.*?)<\/p>/);
        if (pMatch) setSummary(pMatch[1].replace(/<[^>]+>/g, "").trim().substring(0, 200));
        // Set body
        setBody(data.result.replace(/<[^>]+>/g, " ").trim());
        Alert.alert("Translated!", "Content translated to Telugu");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setTranslating(false);
  };

  const generateSlug = (text: string) => {
    const english = text.replace(/[^\x00-\x7F]/g, "").trim();
    if (!english) return `news-${Date.now()}`;
    return english.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").substring(0, 60);
  };

  const handleSubmit = async (status: string) => {
    if (!title.trim()) return Alert.alert("Error", "Title required");
    if (!categoryId) return Alert.alert("Error", "Select a category");
    setSaving(true);

    try {
      // Upload image if present
      let featuredImage = null;
      if (imageUri) {
        featuredImage = await uploadImage(imageUri);
      }

      await api("/api/articles", {
        method: "POST",
        body: {
          title: title.trim(),
          slug: generateSlug(title),
          summary: summary.trim(),
          body: `<p>${body.trim()}</p>`,
          categoryId,
          featuredImage,
          status,
        },
      });

      Alert.alert(
        status === "SUBMITTED" ? "Submitted!" : "Saved!",
        status === "SUBMITTED" ? "Article submitted for review." : "Draft saved.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.header}>New Article</Text>

      {/* Title */}
      <Text style={styles.label}>Headline *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle}
        placeholder="Article headline..." multiline numberOfLines={2} />

      {/* Summary */}
      <Text style={styles.label}>Summary</Text>
      <TextInput style={[styles.input, { height: 60 }]} value={summary} onChangeText={setSummary}
        placeholder="Brief summary (2-3 lines)..." multiline />

      {/* Body */}
      <Text style={styles.label}>Article Body *</Text>
      <TextInput style={[styles.input, { height: 200, textAlignVertical: "top" }]} value={body} onChangeText={setBody}
        placeholder="Write your article here... Type in English and use Translate button for Telugu." multiline />

      {/* AI Translate */}
      <TouchableOpacity style={styles.translateBtn} onPress={translateToTelugu} disabled={translating}>
        <Text style={styles.translateText}>{translating ? "Translating..." : "🤖 తెలుగులో రాయండి (Translate to Telugu)"}</Text>
      </TouchableOpacity>

      {/* Category */}
      <Text style={styles.label}>Category *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.chipRow}>
          {categories.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => setCategoryId(c.id)}
              style={[styles.chip, categoryId === c.id && { backgroundColor: c.color || "#FF2C2C", borderColor: c.color || "#FF2C2C" }]}>
              <Text style={[styles.chipText, categoryId === c.id && { color: "#fff" }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Photo */}
      <Text style={styles.label}>Featured Image</Text>
      <View style={styles.photoRow}>
        <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
          <Text style={styles.photoBtnText}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
          <Text style={styles.photoBtnText}>📁 Gallery</Text>
        </TouchableOpacity>
      </View>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

      {/* Submit */}
      <View style={styles.submitRow}>
        <TouchableOpacity style={styles.draftBtn} onPress={() => handleSubmit("DRAFT")} disabled={saving}>
          <Text style={styles.draftText}>{saving ? "..." : "Save Draft"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={() => handleSubmit("SUBMITTED")} disabled={saving}>
          <Text style={styles.submitText}>{saving ? "Submitting..." : "Submit for Review"}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: { fontSize: 22, fontWeight: "800", color: "#111", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#555", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 8 },
  translateBtn: { backgroundColor: "#111827", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 12 },
  translateText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  chipRow: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#555" },
  photoRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  photoBtn: { flex: 1, padding: 14, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  photoBtnText: { fontSize: 14, fontWeight: "700", color: "#555" },
  preview: { width: "100%", height: 200, borderRadius: 10, marginBottom: 12 },
  submitRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  draftBtn: { flex: 1, padding: 16, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center" },
  draftText: { fontSize: 14, fontWeight: "700", color: "#555" },
  submitBtn: { flex: 2, padding: 16, backgroundColor: "#FF2C2C", borderRadius: 10, alignItems: "center" },
  submitText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
