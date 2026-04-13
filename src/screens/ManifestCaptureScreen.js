import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import api from '../config/api';

export default function ManifestCaptureScreen({ rxId, onSuccess, onCancel }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState('capture');
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', address: '', phone: '', medication: '', dob: '', medications: []
  });

  async function handleTakePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
      await parseManifest(result.assets[0].base64);
    }
  }

  async function parseManifest(base64) {
    setLoading(true);
    setStep('parsing');
    try {
      const { data } = await api.post('/api/manifest/parse', {
        imageBase64: base64,
        mediaType: 'image/jpeg'
      });
      const d = data.data;
      setParsedData(d);
      const fullAddress = d.address ? d.address + (d.city ? ', ' + d.city : '') + (d.state ? ', ' + d.state : '') + (d.zip ? ' ' + d.zip : '') : '';
      const meds = d.medications && d.medications.length > 0 ? d.medications : [{ rxNumber: d.rxNumber, medication: d.medication, quantity: d.quantity }];
      setForm({
        firstName: d.firstName || '',
        lastName: d.lastName || '',
        address: fullAddress,
        phone: d.phone || '',
        medication: meds.map(m => m.medication).filter(Boolean).join(', '),
        dob: '',
        medications: meds
      });
      setStep('confirm');
    } catch (err) {
      Alert.alert('Could not read manifest', 'Please enter the information manually.');
      setStep('manual');
    }
    setLoading(false);
  }

  async function handleConfirm() {
    if (!form.firstName || !form.lastName || !form.address) {
      Alert.alert('Required', 'Please enter patient name and address');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/manifest/create-delivery', {
        firstName: form.firstName,
        lastName: form.lastName,
        address: form.address,
        phone: form.phone,
        medications: form.medications && form.medications.length > 0 ? form.medications : [{ rxNumber: rxId, medication: form.medication }],
        rxNumber: rxId,
        dob: form.dob || null,
      });
      Alert.alert('Success', form.firstName + ' ' + form.lastName + ' added and delivery created', [
        { text: 'OK', onPress: () => onSuccess(data) }
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not create delivery');
    }
    setLoading(false);
  }

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New patient</Text>
        <Text style={styles.subtitle}>RX: {rxId}</Text>
      </View>

      <View style={styles.body}>
        {step === 'capture' && (
          <View>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Patient not found in system</Text>
              <Text style={styles.infoText}>Take a photo of the delivery manifest to automatically add this patient and create their delivery.</Text>
            </View>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
              <Text style={styles.photoBtnText}>📷  Photograph manifest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.manualBtn} onPress={() => setStep('manual')}>
              <Text style={styles.manualBtnText}>Enter manually instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'parsing' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1D9E75" />
            <Text style={styles.loadingText}>Reading manifest...</Text>
          </View>
        )}

        {(step === 'confirm' || step === 'manual') && (
          <View>
            {imageUri && step === 'confirm' && (
              <Image source={{ uri: imageUri }} style={styles.preview} />
            )}
            {step === 'confirm' && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✓ Manifest read successfully — please verify</Text>
              </View>
            )}
            <Text style={styles.sectionLabel}>Patient information</Text>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>First name</Text>
                <TextInput style={styles.input} value={form.firstName} onChangeText={v => update('firstName', v)} placeholder="First name" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Last name</Text>
                <TextInput style={styles.input} value={form.lastName} onChangeText={v => update('lastName', v)} placeholder="Last name" />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Delivery address</Text>
              <TextInput style={styles.input} value={form.address} onChangeText={v => update('address', v)} placeholder="Full address" multiline />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={form.phone} onChangeText={v => update('phone', v)} placeholder="(555) 000-0000" keyboardType="phone-pad" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Medication</Text>
              <TextInput style={styles.input} value={form.medication} onChangeText={v => update('medication', v)} placeholder="Medication name" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Date of birth (optional — for portal access)</Text>
              <TextInput style={styles.input} value={form.dob} onChangeText={v => update('dob', v)} placeholder="YYYY-MM-DD" />
            </View>
            <TouchableOpacity style={[styles.confirmBtn, loading && { opacity: 0.6 }]} onPress={handleConfirm} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Add patient and create delivery</Text>}
            </TouchableOpacity>
            {step === 'confirm' && (
              <TouchableOpacity style={styles.retakeBtn} onPress={() => { setImageUri(null); setStep('capture'); }}>
                <Text style={styles.retakeBtnText}>Retake photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fff' },
  header:         { backgroundColor: '#1D9E75', padding: 16, paddingTop: 56 },
  backBtn:        { marginBottom: 8 },
  backText:       { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  title:          { fontSize: 17, fontWeight: '600', color: '#fff' },
  subtitle:       { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontFamily: 'monospace' },
  body:           { padding: 16 },
  infoBox:        { backgroundColor: '#FFF8EC', borderRadius: 10, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#BA7517' },
  infoTitle:      { fontSize: 14, fontWeight: '600', color: '#633806', marginBottom: 6 },
  infoText:       { fontSize: 13, color: '#633806', lineHeight: 20 },
  photoBtn:       { backgroundColor: '#1D9E75', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  photoBtnText:   { color: '#fff', fontSize: 15, fontWeight: '600' },
  manualBtn:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center' },
  manualBtnText:  { color: '#666', fontSize: 13 },
  loadingBox:     { padding: 40, alignItems: 'center' },
  loadingText:    { marginTop: 16, fontSize: 14, color: '#666' },
  preview:        { width: '100%', height: 180, borderRadius: 10, marginBottom: 12, resizeMode: 'cover' },
  successBox:     { backgroundColor: '#E1F5EE', borderRadius: 8, padding: 10, marginBottom: 12 },
  successText:    { fontSize: 12, color: '#085041', fontWeight: '600' },
  sectionLabel:   { fontSize: 10, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row:            { flexDirection: 'row' },
  field:          { marginBottom: 12 },
  label:          { fontSize: 11, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  input:          { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#f9f9f9' },
  confirmBtn:     { backgroundColor: '#1D9E75', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  retakeBtn:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  retakeBtnText:  { color: '#666', fontSize: 13 },
});
