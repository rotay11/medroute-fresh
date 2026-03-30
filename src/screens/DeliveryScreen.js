import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import api from '../config/api';

export default function DeliveryScreen({ navigation, route }) {
  const { t }   = useTranslation();
  const bundle  = route.params?.bundle;
  const scanned = route.params?.scannedItems || [];
  const [loading,    setLoading]    = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [sigDone,    setSigDone]    = useState(false);
  const [refused,     setRefused]    = useState(false);
  const [gpsCoords, setGpsCoords] = useState({ lat: 37.6879, lng: -122.0561 });

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(loc => {
          setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }).catch(() => {});
      }
    });
  }, []);

  async function handleConfirm() {
    if (!refused && !sigDone && !photoTaken) { Alert.alert('Required', 'Please capture a signature or photo'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/api/delivery', {
        bundleId: bundle.id,
        gpsLat: gpsCoords.lat, gpsLng: gpsCoords.lng,
        scannedRxIds: scanned.map(p => p.rxId),
        signatureBase64: sigDone ? 'sig_placeholder' : null,
        refused: refused,
        photoBase64: photoTaken ? 'photo_placeholder' : null,
      });
      navigation.navigate('Success', { delivery: data });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || t('serverError'));
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('confirmDelivery')}</Text>
        <Text style={styles.subtitle}>{bundle?.packages?.[0]?.patient?.firstName} {bundle?.packages?.[0]?.patient?.lastName}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardRow}><Text style={styles.cardKey}>{t('patient')}</Text><Text style={styles.cardVal}>{bundle?.packages?.[0]?.patient?.firstName} {bundle?.packages?.[0]?.patient?.lastName}</Text></View>
          <View style={styles.cardRow}><Text style={styles.cardKey}>{t('items')}</Text><Text style={styles.cardVal}>{scanned.length} {t('medications')}</Text></View>
          <View style={styles.cardRow}><Text style={styles.cardKey}>{t('deliveredAt')}</Text><Text style={styles.cardVal}>{new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</Text></View>
        </View>
        <Text style={styles.sectionLabel}>{t('itemsHandedOver')}</Text>
        {scanned.map(pkg => (
          <View key={pkg.rxId} style={styles.itemRow}>
            <View style={styles.checkDot}><Text style={styles.checkMark}>✓</Text></View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemId}>{pkg.rxId}</Text>
              <Text style={styles.itemDrug}>{pkg.medication} {pkg.dosage}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.sectionLabel}>{t('recipientSignature')}</Text>
        <TouchableOpacity style={[styles.sigPad, sigDone && styles.sigPadDone]} onPress={() => setSigDone(true)}>
          <Text style={styles.sigText}>{sigDone ? '✓ Signature captured' : t('signHere')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.refusedBtn, refused && styles.refusedBtnActive]}
          onPress={() => {
            setRefused(!refused);
            if (!refused) { setSigDone(false); setPhotoTaken(false); }
          }}
        >
          <Text style={[styles.refusedBtnText, refused && styles.refusedBtnTextActive]}>
            {refused ? '✓ Marked as refused' : 'Patient refused delivery'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.photoBtn, photoTaken && styles.photoBtnDone]} onPress={() => setPhotoTaken(true)}>
          <Text style={styles.photoBtnText}>{photoTaken ? '✓ ' + t('photoTaken') : t('takePhoto')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !(sigDone || photoTaken || refused) && styles.confirmBtnDisabled]}
          disabled={!(sigDone || photoTaken || refused) || loading}
          onPress={handleConfirm}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>{t('completeDelivery')}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#fff' },
  header:       { backgroundColor:'#1D9E75', padding:16, paddingTop:56 },
  backBtn:      { marginBottom:8 },
  backText:     { color:'rgba(255,255,255,0.85)', fontSize:13 },
  title:        { fontSize:17, fontWeight:'600', color:'#fff' },
  subtitle:     { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 },
  body:         { padding:14 },
  card:         { backgroundColor:'#f5f5f5', borderRadius:10, padding:12, marginBottom:16 },
  cardRow:      { flexDirection:'row', justifyContent:'space-between', paddingVertical:5, borderBottomWidth:0.5, borderBottomColor:'#e0e0e0' },
  cardKey:      { fontSize:11, color:'#888' },
  cardVal:      { fontSize:11, fontWeight:'600', color:'#333' },
  sectionLabel: { fontSize:10, fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8, marginTop:4 },
  itemRow:      { flexDirection:'row', alignItems:'center', paddingVertical:7, borderBottomWidth:0.5, borderBottomColor:'#f0f0f0' },
  checkDot:     { width:20, height:20, borderRadius:10, backgroundColor:'#1D9E75', alignItems:'center', justifyContent:'center', marginRight:10 },
  checkMark:    { color:'#fff', fontSize:10, fontWeight:'bold' },
  itemInfo:     { flex:1 },
  itemId:       { fontSize:11, fontWeight:'600', color:'#333' },
  itemDrug:     { fontSize:11, color:'#666' },
  sigPad:       { backgroundColor:'#f9f9f9', borderWidth:1, borderColor:'#ddd', borderStyle:'solid', borderRadius:8, height:90, alignItems:'center', justifyContent:'center', marginBottom:12 },
  refusedBtn:        { borderWidth:1, borderColor:'#E24B4A', borderRadius:8, padding:12, alignItems:'center', marginBottom:12 },
  refusedBtnActive:  { backgroundColor:'#FCEBEB' },
  refusedBtnText:    { color:'#E24B4A', fontSize:13, fontWeight:'600' },
  refusedBtnTextActive: { color:'#791F1F' },
  sigPadDone:   { backgroundColor:'#E1F5EE', borderColor:'#9FE1CB', borderStyle:'solid' },
  sigText:      { fontSize:12, color:'#999' },
  photoBtn:     { backgroundColor:'#f9f9f9', borderWidth:0.5, borderColor:'#ddd', borderRadius:8, padding:12, alignItems:'center', marginBottom:16 },
  photoBtnDone: { backgroundColor:'#E1F5EE', borderColor:'#9FE1CB' },
  photoBtnText: { fontSize:12, color:'#555' },
  confirmBtn:   { backgroundColor:'#1D9E75', borderRadius:10, padding:14, alignItems:'center', marginTop:8 },
  confirmBtnDisabled: { opacity:0.4 },
  confirmBtnText:{ color:'#fff', fontSize:14, fontWeight:'600' },
});
