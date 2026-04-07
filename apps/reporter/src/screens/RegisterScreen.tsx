import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";

const API_URL = __DEV__ ? "http://10.0.2.2:3001" : "https://admin.rayalaseemaexpress.com";

const districts = [
  { label: "కర్నూలు (Kurnool)", value: "kurnool" },
  { label: "నంద్యాల (Nandyal)", value: "nandyal" },
  { label: "అనంతపురం (Anantapur)", value: "ananthapuramu" },
  { label: "శ్రీ సత్యసాయి", value: "sri-sathya-sai" },
  { label: "వై.యస్.ఆర్ కడప", value: "ysr-kadapa" },
  { label: "అన్నమయ్య", value: "annamayya" },
  { label: "తిరుపతి (Tirupati)", value: "tirupati" },
  { label: "చిత్తూరు (Chittoor)", value: "chittoor" },
];

export function RegisterScreen({ navigation }: any) {
  const [step, setStep] = useState(1); // 1=personal, 2=documents, 3=bank
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", password: "",
    dateOfBirth: "", gender: "", address: "", city: "", pincode: "",
    primaryDistrict: "kurnool",
    aadhaarNumber: "", panNumber: "",
    aadhaarFrontUri: "", aadhaarBackUri: "", panCardUri: "", photoUri: "",
    upiId: "", bankName: "", bankAccount: "", bankIfsc: "",
    experience: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });

  const pickImage = async (key: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7 });
    if (!result.canceled) update(key, result.assets[0].uri);
  };

  const takePhoto = async (key: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera permission required");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) update(key, result.assets[0].uri);
  };

  const uploadFile = async (uri: string): Promise<string> => {
    if (!uri) return "";
    const formData = new FormData();
    const filename = uri.split("/").pop() || "doc.jpg";
    formData.append("file", { uri, name: filename, type: "image/jpeg" } as any);
    const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: formData });
    const data = await res.json();
    return data.url || "";
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.phone || !form.password) {
      return Alert.alert("Error", "Please fill all required fields");
    }
    setLoading(true);

    try {
      // Upload documents
      const [aadhaarFront, aadhaarBack, panCard, photo] = await Promise.all([
        uploadFile(form.aadhaarFrontUri),
        uploadFile(form.aadhaarBackUri),
        uploadFile(form.panCardUri),
        uploadFile(form.photoUri),
      ]);

      // Create user + profile
      const res = await fetch(`${API_URL}/api/reporter/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          aadhaarFrontUrl: aadhaarFront,
          aadhaarBackUrl: aadhaarBack,
          panCardUrl: panCard,
          photoUrl: photo,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      Alert.alert(
        "Registration Submitted!",
        "Your KYC documents are under review. You'll be notified once verified.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>జర్నలిస్ట్ రిజిస్ట్రేషన్</Text>
      <Text style={styles.subtitle}>Step {step} of 3</Text>

      {/* Progress */}
      <View style={styles.progress}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
        ))}
      </View>

      {step === 1 && (
        <>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <TextInput style={styles.input} placeholder="Full Name *" value={form.fullName} onChangeText={(v) => update("fullName", v)} />
          <TextInput style={styles.input} placeholder="Email *" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Phone *" value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Password *" value={form.password} onChangeText={(v) => update("password", v)} secureTextEntry />
          <TextInput style={styles.input} placeholder="Date of Birth (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={(v) => update("dateOfBirth", v)} />
          <TextInput style={styles.input} placeholder="Address" value={form.address} onChangeText={(v) => update("address", v)} multiline />
          <TextInput style={styles.input} placeholder="City" value={form.city} onChangeText={(v) => update("city", v)} />
          <TextInput style={styles.input} placeholder="Pincode" value={form.pincode} onChangeText={(v) => update("pincode", v)} keyboardType="numeric" />

          <Text style={styles.label}>Primary District *</Text>
          <View style={styles.chipRow}>
            {districts.map((d) => (
              <TouchableOpacity key={d.value} onPress={() => update("primaryDistrict", d.value)}
                style={[styles.chip, form.primaryDistrict === d.value && styles.chipActive]}>
                <Text style={[styles.chipText, form.primaryDistrict === d.value && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={[styles.input, { height: 80 }]} placeholder="Previous media experience..." value={form.experience} onChangeText={(v) => update("experience", v)} multiline />

          <TouchableOpacity style={styles.button} onPress={() => setStep(2)}>
            <Text style={styles.buttonText}>Next: Documents →</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.sectionTitle}>KYC Documents</Text>

          {/* Selfie */}
          <Text style={styles.label}>Passport Photo *</Text>
          <View style={styles.docRow}>
            <TouchableOpacity style={styles.docButton} onPress={() => takePhoto("photoUri")}>
              <Text style={styles.docButtonText}>📷 Take Selfie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docButton} onPress={() => pickImage("photoUri")}>
              <Text style={styles.docButtonText}>📁 Choose File</Text>
            </TouchableOpacity>
          </View>
          {form.photoUri ? <Image source={{ uri: form.photoUri }} style={styles.preview} /> : null}

          {/* Aadhaar */}
          <TextInput style={styles.input} placeholder="Aadhaar Number" value={form.aadhaarNumber} onChangeText={(v) => update("aadhaarNumber", v)} keyboardType="numeric" />
          <Text style={styles.label}>Aadhaar Front</Text>
          <View style={styles.docRow}>
            <TouchableOpacity style={styles.docButton} onPress={() => takePhoto("aadhaarFrontUri")}>
              <Text style={styles.docButtonText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docButton} onPress={() => pickImage("aadhaarFrontUri")}>
              <Text style={styles.docButtonText}>📁 File</Text>
            </TouchableOpacity>
          </View>
          {form.aadhaarFrontUri ? <Image source={{ uri: form.aadhaarFrontUri }} style={styles.preview} /> : null}

          <Text style={styles.label}>Aadhaar Back</Text>
          <View style={styles.docRow}>
            <TouchableOpacity style={styles.docButton} onPress={() => takePhoto("aadhaarBackUri")}>
              <Text style={styles.docButtonText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docButton} onPress={() => pickImage("aadhaarBackUri")}>
              <Text style={styles.docButtonText}>📁 File</Text>
            </TouchableOpacity>
          </View>
          {form.aadhaarBackUri ? <Image source={{ uri: form.aadhaarBackUri }} style={styles.preview} /> : null}

          {/* PAN */}
          <TextInput style={styles.input} placeholder="PAN Number" value={form.panNumber} onChangeText={(v) => update("panNumber", v)} autoCapitalize="characters" />
          <Text style={styles.label}>PAN Card Photo</Text>
          <View style={styles.docRow}>
            <TouchableOpacity style={styles.docButton} onPress={() => takePhoto("panCardUri")}>
              <Text style={styles.docButtonText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docButton} onPress={() => pickImage("panCardUri")}>
              <Text style={styles.docButtonText}>📁 File</Text>
            </TouchableOpacity>
          </View>
          {form.panCardUri ? <Image source={{ uri: form.panCardUri }} style={styles.preview} /> : null}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setStep(3)}>
              <Text style={styles.buttonText}>Next: Bank Details →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.sectionTitle}>Bank / Payment Details</Text>
          <TextInput style={styles.input} placeholder="UPI ID (e.g. name@upi)" value={form.upiId} onChangeText={(v) => update("upiId", v)} />
          <TextInput style={styles.input} placeholder="Bank Name" value={form.bankName} onChangeText={(v) => update("bankName", v)} />
          <TextInput style={styles.input} placeholder="Account Number" value={form.bankAccount} onChangeText={(v) => update("bankAccount", v)} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="IFSC Code" value={form.bankIfsc} onChangeText={(v) => update("bankIfsc", v)} autoCapitalize="characters" />

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Submitting..." : "Submit Registration"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  title: { fontSize: 22, fontWeight: "800", color: "#111", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 12 },
  progress: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  progressDot: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb" },
  progressDotActive: { backgroundColor: "#FF2C2C" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", color: "#555", marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, fontSize: 14, marginBottom: 10, backgroundColor: "#fff" },
  button: { backgroundColor: "#FF2C2C", borderRadius: 10, padding: 16, alignItems: "center", flex: 1 },
  buttonDisabled: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  backButton: { padding: 16, alignItems: "center" },
  backText: { color: "#888", fontSize: 14, fontWeight: "600" },
  navRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  chipActive: { backgroundColor: "#FF2C2C", borderColor: "#FF2C2C" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },
  docRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  docButton: { flex: 1, padding: 12, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  docButtonText: { fontSize: 13, fontWeight: "600", color: "#555" },
  preview: { width: "100%", height: 150, borderRadius: 8, marginBottom: 12 },
});
