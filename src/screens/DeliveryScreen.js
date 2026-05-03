import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import SignatureScreen from 'react-native-signature-canvas';
import api from '../config/api';

export default function DeliveryScreen({ navigation, route }) {
  const { t } = useTranslation();
  const bundle = route.params?.bundle;
  const scanned = route.params?.scannedItems || [];
  const sigRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [photoData, setPhotoData] = useState(null);
  const [refused, setRefused] = useState(false);
  const [refusedReason, setRefusedReason] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [gpsCoords, setGpsCoords] = useState({ lat: 37.6879, lng: -122.0561 });
  const hasControlled = (bundle?.packages || []).some(p => p.rxId && (p.rxId.startsWith('2') || p.rxId.startsWith('4')));

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(loc => {
          setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }).catch(() => {});
      }
    });
  }, []);

  function handleSignatureOK(signature) {
    const base64 = signature.replace('data:image/png;base64,', '');
    setSignatureData(base64);
    setShowSignature(false);
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Camera access needed'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: false, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      try {
        const m = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1200 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        setPhotoData({ uri: m.uri, base64: m.base64 });
      } catch (err) { Alert.alert('Error', 'Could not process photo'); }
    }
  }

  function confirmRefusal() {
    if (!refusedReason) { Alert.alert('Reason required', 'Please select why delivery was refused'); return; }
    setRefused(true);
    setShowRefusalModal(false);
  }

  async function handleConfirm() {
    if (hasControlled && !refused && !signatureData) {
      Alert.alert('Signature Required', 'Controlled substances require recipient signature. Capture signature or mark as refused.');
      return;
    }
    if (!refused && !signatureData && !photoData) {
      Alert.alert('Confirmation required', 'Please capture signature, take photo, or mark as refused');
      return;
    }
    if (refused && !photoData && !recipientName) {
      Alert.alert('Documentation Required', 'Refused deliveries need either recipient name witness OR photo of door');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        bundleId: bundle.id,
        gpsLat: gpsCoords.lat, gpsLng: gpsCoords.lng,
        scannedRxIds: scanned.map(p => p.rxId),
        recipientName: recipientName || null,
        signatureBase64: signatureData,
        photoBase64: photoData?.base64 || null,
        refused: refused,
        refusedReason: refused ? refusedReason : null,
      };
      const { data } = await api.post('/api/delivery', payload);
      navigation.navigate('Success', { delivery: data });
    } catch (err) {
      console.log('Delivery error:', err.response?.data);
      Alert.alert('Error', err.response?.data?.error || 'Could not complete delivery');
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backText}>back</Text></TouchableOpacity>
        <Text style={styles.title}>Confirm Delivery</Text>
        <Text style={styles.subtitle}>{bundle?.packages?.[0]?.patient?.firstName} {bundle?.packages?.[0]?.patient?.lastName}</Text>
        {hasControlled && (<View style={styles.controlledBanner}><Text style={styles.controlledText}>CONTROLLED SUBSTANCE - Signature Required</Text></View>)}
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardRow}><Text style={styles.cardKey}>Patient</Text><Text style={styles.cardVal}>{bundle?.packages?.[0]?.patient?.firstName} {bundle?.packages?.[0]?.patient?.lastName}</Text></View>
          <View style={styles.cardRow}><Text style={styles.cardKey}>Items</Text><Text style={styles.cardVal}>{bundle?.packages?.length || 0} medications</Text></View>
        </View>
        {!refused && (<>
          <Text style={styles.sectionLabel}>Recipient Name</Text>
          <TextInput style={styles.nameInput} placeholder="Print recipient full name" value={recipientName} onChangeText={setRecipientName} autoCapitalize="words" />
          <Text style={styles.sectionLabel}>Signature {hasControlled && <Text style={{color:'#E24B4A'}}>*</Text>}</Text>
          <TouchableOpacity style={[styles.sigPad, signatureData && styles.sigPadDone]} onPress={() => setShowSignature(true)}>
            {signatureData ? (<Image source={{ uri: 'data:image/png;base64,' + signatureData }} style={styles.sigPreview} resizeMode="contain" />) : (<Text style={styles.sigPlaceholder}>Tap to sign</Text>)}
          </TouchableOpacity>
          {signatureData && (<TouchableOpacity onPress={() => setSignatureData(null)} style={styles.clearBtn}><Text style={styles.clearBtnText}>Clear signature</Text></TouchableOpacity>)}
          <Text style={styles.sectionLabel}>Photo (optional proof)</Text>
          <TouchableOpacity style={[styles.photoBtn, photoData && styles.photoBtnDone]} onPress={handleTakePhoto}>
            {photoData ? (<Image source={{ uri: photoData.uri }} style={styles.photoPreview} />) : (<Text style={styles.photoBtnText}>Take photo of delivery</Text>)}
          </TouchableOpacity>
          {photoData && (<TouchableOpacity onPress={() => setPhotoData(null)} style={styles.clearBtn}><Text style={styles.clearBtnText}>Remove photo</Text></TouchableOpacity>)}
        </>)}
        {refused && (<View style={styles.refusedCard}><Text style={styles.refusedTitle}>Marked as Refused</Text><Text style={styles.refusedReasonText}>Reason: {refusedReason}</Text><TouchableOpacity onPress={() => { setRefused(false); setRefusedReason(''); }} style={styles.undoRefuseBtn}><Text style={styles.undoRefuseBtnText}>Undo refusal</Text></TouchableOpacity></View>)}
        {!refused && (<TouchableOpacity style={styles.refuseBtn} onPress={() => setShowRefusalModal(true)}><Text style={styles.refuseBtnText}>Patient/Facility Refused Delivery</Text></TouchableOpacity>)}
        <TouchableOpacity style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]} onPress={handleConfirm} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Complete Delivery</Text>}
        </TouchableOpacity>
      </View>
      <Modal visible={showSignature} animationType="slide">
        <View style={{flex:1, backgroundColor:'#fff'}}>
          <View style={styles.sigModalHeader}>
            <TouchableOpacity onPress={() => setShowSignature(false)}><Text style={styles.sigModalCancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.sigModalTitle}>Sign here</Text>
            <View style={{width:60}} />
          </View>
          <SignatureScreen ref={sigRef} onOK={handleSignatureOK} descriptionText="Sign with your finger above the line" clearText="Clear" confirmText="Save" />
        </View>
      </Modal>
      <Modal visible={showRefusalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Refusal Reason</Text>
            {['Patient not home', 'Wrong address', 'Patient declined', 'Returning to pharmacy', 'Damaged package', 'Other'].map(reason => (
              <TouchableOpacity key={reason} style={[styles.reasonBtn, refusedReason === reason && styles.reasonBtnSelected]} onPress={() => setRefusedReason(reason)}>
                <Text style={styles.reasonBtnText}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRefusalModal(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={confirmRefusal}><Text style={{color:'#fff', fontWeight:'700'}}>Confirm Refusal</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#fff' },
  header: { backgroundColor:'#1D9E75', padding:16, paddingTop:56 },
  backBtn: { marginBottom:8 },
  backText: { color:'rgba(255,255,255,0.85)', fontSize:13 },
  title: { fontSize:17, fontWeight:'600', color:'#fff' },
  subtitle: { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 },
  controlledBanner: { backgroundColor:'#E24B4A', padding:8, borderRadius:6, marginTop:12 },
  controlledText: { color:'#fff', fontSize:12, fontWeight:'700', textAlign:'center' },
  body: { padding:14 },
  card: { backgroundColor:'#f5f5f5', borderRadius:10, padding:12, marginBottom:16 },
  cardRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:5 },
  cardKey: { fontSize:11, color:'#888' },
  cardVal: { fontSize:11, fontWeight:'600', color:'#333' },
  sectionLabel: { fontSize:11, fontWeight:'700', color:'#444', marginBottom:8, marginTop:12, textTransform:'uppercase' },
  nameInput: { borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12, fontSize:14, marginBottom:8 },
  sigPad: { backgroundColor:'#f9f9f9', borderWidth:1, borderColor:'#ddd', borderStyle:'dashed', borderRadius:8, height:120, alignItems:'center', justifyContent:'center', marginBottom:4 },
  sigPadDone: { backgroundColor:'#fff', borderStyle:'solid', borderColor:'#1D9E75' },
  sigPreview: { width:'100%', height:'100%' },
  sigPlaceholder: { color:'#888', fontSize:13 },
  photoBtn: { backgroundColor:'#f9f9f9', borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:14, alignItems:'center', marginBottom:4 },
  photoBtnDone: { backgroundColor:'#fff', borderColor:'#1D9E75', padding:0, height:150, overflow:'hidden' },
  photoPreview: { width:'100%', height:150 },
  photoBtnText: { fontSize:13, color:'#555' },
  clearBtn: { alignItems:'center', padding:6, marginBottom:8 },
  clearBtnText: { fontSize:11, color:'#888', textDecorationLine:'underline' },
  refusedCard: { backgroundColor:'#FFF5F5', borderWidth:1, borderColor:'#E24B4A', borderRadius:10, padding:14, marginBottom:12 },
  refusedTitle: { fontSize:14, fontWeight:'700', color:'#791F1F', marginBottom:6 },
  refusedReasonText: { fontSize:12, color:'#791F1F', marginBottom:8 },
  undoRefuseBtn: { padding:8, borderRadius:6, backgroundColor:'#fff', alignItems:'center' },
  undoRefuseBtnText: { color:'#791F1F', fontSize:12, fontWeight:'600' },
  refuseBtn: { borderWidth:1, borderColor:'#E24B4A', borderRadius:8, padding:12, alignItems:'center', marginTop:8, marginBottom:12 },
  refuseBtnText: { color:'#E24B4A', fontSize:13, fontWeight:'600' },
  confirmBtn: { backgroundColor:'#1D9E75', borderRadius:10, padding:14, alignItems:'center', marginTop:8 },
  confirmBtnDisabled: { opacity:0.5 },
  confirmBtnText: { color:'#fff', fontSize:14, fontWeight:'600' },
  sigModalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:'#eee' },
  sigModalCancel: { fontSize:14, color:'#888' },
  sigModalTitle: { fontSize:14, fontWeight:'600' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:20 },
  modalCard: { backgroundColor:'#fff', borderRadius:12, padding:20 },
  modalTitle: { fontSize:18, fontWeight:'700', marginBottom:12 },
  reasonBtn: { padding:10, borderWidth:1, borderColor:'#ddd', borderRadius:6, marginBottom:6 },
  reasonBtnSelected: { borderColor:'#E24B4A', backgroundColor:'#FFF5F5' },
  reasonBtnText: { fontSize:13 },
  modalBtnRow: { flexDirection:'row', gap:8, marginTop:16 },
  modalCancelBtn: { flex:1, padding:12, borderRadius:6, borderWidth:1, borderColor:'#ddd', alignItems:'center' },
  modalSubmitBtn: { flex:1, padding:12, borderRadius:6, backgroundColor:'#E24B4A', alignItems:'center' },
});
