import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Vibration, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import ManifestCaptureScreen from './ManifestCaptureScreen';

export default function ScanScreen({ navigation, route }) {
  const { t } = useTranslation();
  const bundle = route.params?.bundle;
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItems, setScannedItems] = useState([]);
  const [scanning, setScanning] = useState(true);
  const [manualId, setManualId] = useState('');
  const [flashMsg, setFlashMsg] = useState(null);
  const [total, setTotal] = useState(bundle?.packages?.length || 0);
  const [scannedCount, setScannedCount] = useState(0);
  const lastScan = useRef('');
  const [showManifestCapture, setShowManifestCapture] = useState(false);
  const [unknownRxId, setUnknownRxId] = useState(null);
  const [gpsCoords, setGpsCoords] = useState({ lat: 37.6879, lng: -122.0561 });

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(loc => {
          setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }).catch(() => {});
      }
    });
  }, []);

  const allScanned = total > 0 && scannedCount >= total;
  const pct = total > 0 ? Math.round((scannedCount / total) * 100) : 0;

  async function processRxId(rxId) {
    if (!rxId || rxId === lastScan.current) return;
    lastScan.current = rxId;
    setTimeout(() => { lastScan.current = ''; }, 2000);
    try {
      const { data } = await api.post('/api/scan', {
        rxId: rxId.toUpperCase(),
        scanType: 'PICKUP',
        gpsLat: gpsCoords.lat,
        gpsLng: gpsCoords.lng,
      });
      Vibration.vibrate(100);
      const newItems = [...scannedItems, data.package];
      setScannedItems(newItems);
      setFlashMsg({ type: 'success', text: 'Scanned: ' + rxId });
      if (navigation.getParent()) { navigation.getParent().setParams({ routeUpdated: Date.now() }); }
      if (data.bundleProgress) {
        setTotal(data.bundleProgress.total);
        setScannedCount(data.bundleProgress.scanned);
      } else {
        setScannedCount(newItems.length);
      }
    } catch (err) {
      Vibration.vibrate([100, 100, 100]);
      const code = err.response?.data?.code;
      if (code === 'ITEM_NOT_ON_MANIFEST') {
        setUnknownRxId(rxId);
        setShowManifestCapture(true);
        setFlashMsg({ type: 'error', text: 'New patient — photograph manifest' });
      } else {
        const msg = code === 'ALREADY_SCANNED' ? 'Already scanned'
          : code === 'WRONG_DRIVER' ? 'Wrong driver'
          : 'Scan failed';
        setFlashMsg({ type: 'error', text: msg });
      }
    }
    setTimeout(() => setFlashMsg(null), 2500);
  }

  function handleBarcodeScanned({ data }) {
    setScanning(false);
    processRxId(data);
    setTimeout(() => setScanning(true), 2000);
  }

  function handleNavigate() {
    const addr = encodeURIComponent(bundle?.address || '');
    const lat = bundle?.addressLat || 0;
    const lng = bundle?.addressLng || 0;
    Linking.openURL('maps://?daddr=' + addr + '&ll=' + lat + ',' + lng)
      .catch(() => Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + addr + '&travelmode=driving'));
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan each medication</Text>
        <Text style={styles.subtitle}>All items must be scanned before delivery</Text>
      </View>
      <View style={styles.viewfinder}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
            barcodeScannerSettings={{ barcodeTypes: ['code128','code39','ean13','qr'] }}
          />
        ) : (
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permText}>Tap to enable camera</Text>
          </TouchableOpacity>
        )}
        <View style={styles.cornerTL} /><View style={styles.cornerTR} />
        <View style={styles.cornerBL} /><View style={styles.cornerBR} />
        <Text style={styles.vfHint}>Point camera at barcode</Text>
      </View>
      {flashMsg && (
        <View style={[styles.flash, flashMsg.type === 'success' ? styles.flashGreen : styles.flashRed]}>
          <Text style={styles.flashText}>{flashMsg.text}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.progressBox}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Pickup progress</Text>
            <Text style={styles.progressCount}>{scannedCount} / {total}</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: pct + '%' }]} />
          </View>
        </View>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualId}
            onChangeText={setManualId}
            placeholder="RX-XXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.lookupBtn} onPress={() => {
            if (manualId.trim()) {
              processRxId(manualId.trim().toUpperCase());
              setManualId('');
            }
          }}>
            <Text style={styles.lookupText}>Lookup</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionLabel}>Items for this stop</Text>
        {bundle?.packages?.map(pkg => {
          const done = scannedItems.some(s => s.rxId === pkg.rxId);
          return (
            <View key={pkg.rxId} style={styles.itemRow}>
              <View style={[styles.itemDot, done && styles.itemDotDone]}>
                {done && <Text style={styles.itemDotCheck}>ok</Text>}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemId}>{pkg.rxId}</Text>
                <Text style={styles.itemDrug}>{pkg.medication} {pkg.dosage}</Text>
              </View>
              {pkg.urgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>Urgent</Text>
                </View>
              )}
            </View>
          );
        })}
        {allScanned && (
          <TouchableOpacity style={styles.navMapBtn} onPress={handleNavigate}>
            <Text style={styles.navMapBtnText}>Navigate to delivery address</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, !allScanned && styles.confirmBtnDisabled]}
          disabled={!allScanned}
          onPress={() => navigation.navigate('Delivery', { bundle, scannedItems })}
        >
          <Text style={styles.confirmBtnText}>Confirm and deliver</Text>
        </TouchableOpacity>
      </View>
      {showManifestCapture && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 100 }}>
          <ManifestCaptureScreen
            rxId={unknownRxId}
            onSuccess={(data) => {
              setShowManifestCapture(false);
              setUnknownRxId(null);
              setFlashMsg({ type: 'success', text: 'Patient added — delivery created' });
              setTimeout(() => navigation.navigate('Home'), 1500);
            }}
            onCancel={() => {
              setShowManifestCapture(false);
              setUnknownRxId(null);
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor:'#fff' },
  header:        { backgroundColor:'#1D9E75', padding:16, paddingTop:56 },
  backBtn:       { marginBottom:8 },
  backText:      { color:'rgba(255,255,255,0.85)', fontSize:13 },
  title:         { fontSize:17, fontWeight:'600', color:'#fff' },
  subtitle:      { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 },
  viewfinder:    { height:200, backgroundColor:'#0d0d0d', position:'relative', overflow:'hidden' },
  camera:        { flex:1 },
  permBtn:       { flex:1, alignItems:'center', justifyContent:'center' },
  permText:      { color:'rgba(255,255,255,0.6)', fontSize:13 },
  cornerTL:      { position:'absolute', top:14, left:14, width:20, height:20, borderTopWidth:2, borderLeftWidth:2, borderColor:'#1D9E75', borderTopLeftRadius:3 },
  cornerTR:      { position:'absolute', top:14, right:14, width:20, height:20, borderTopWidth:2, borderRightWidth:2, borderColor:'#1D9E75', borderTopRightRadius:3 },
  cornerBL:      { position:'absolute', bottom:14, left:14, width:20, height:20, borderBottomWidth:2, borderLeftWidth:2, borderColor:'#1D9E75', borderBottomLeftRadius:3 },
  cornerBR:      { position:'absolute', bottom:14, right:14, width:20, height:20, borderBottomWidth:2, borderRightWidth:2, borderColor:'#1D9E75', borderBottomRightRadius:3 },
  vfHint:        { position:'absolute', bottom:8, alignSelf:'center', fontSize:10, color:'rgba(255,255,255,0.5)' },
  flash:         { margin:12, borderRadius:8, padding:10 },
  flashGreen:    { backgroundColor:'#E1F5EE' },
  flashRed:      { backgroundColor:'#FCEBEB' },
  flashText:     { fontSize:12, fontWeight:'600', color:'#333', textAlign:'center' },
  body:          { padding:14 },
  progressBox:   { backgroundColor:'#f5f5f5', borderRadius:8, padding:10, marginBottom:12 },
  progressTop:   { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  progressLabel: { fontSize:11, color:'#666' },
  progressCount: { fontSize:11, fontWeight:'600', color:'#333' },
  progressBg:    { backgroundColor:'#e0e0e0', borderRadius:4, height:6, overflow:'hidden' },
  progressFill:  { height:'100%', backgroundColor:'#1D9E75', borderRadius:4 },
  manualRow:     { flexDirection:'row', gap:8, marginBottom:14 },
  manualInput:   { flex:1, borderWidth:0.5, borderColor:'#ddd', borderRadius:8, padding:10, fontSize:13, backgroundColor:'#f9f9f9' },
  lookupBtn:     { backgroundColor:'#1D9E75', borderRadius:8, paddingHorizontal:14, justifyContent:'center' },
  lookupText:    { color:'#fff', fontSize:12, fontWeight:'600' },
  sectionLabel:  { fontSize:10, fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  itemRow:       { flexDirection:'row', alignItems:'center', paddingVertical:8, borderBottomWidth:0.5, borderBottomColor:'#f0f0f0' },
  itemDot:       { width:20, height:20, borderRadius:10, borderWidth:1.5, borderColor:'#ccc', backgroundColor:'#f9f9f9', alignItems:'center', justifyContent:'center', marginRight:10 },
  itemDotDone:   { backgroundColor:'#1D9E75', borderColor:'#1D9E75' },
  itemDotCheck:  { color:'#fff', fontSize:8, fontWeight:'bold' },
  itemInfo:      { flex:1 },
  itemId:        { fontSize:11, fontWeight:'600', color:'#333' },
  itemDrug:      { fontSize:11, color:'#666', marginTop:1 },
  urgentBadge:   { backgroundColor:'#FCEBEB', borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  urgentText:    { fontSize:9, fontWeight:'600', color:'#791F1F' },
  navMapBtn:     { backgroundColor:'#085041', borderRadius:10, padding:14, alignItems:'center', marginTop:8, marginBottom:8 },
  navMapBtnText: { color:'#fff', fontSize:14, fontWeight:'600' },
  confirmBtn:    { backgroundColor:'#1D9E75', borderRadius:10, padding:14, alignItems:'center', marginTop:8 },
  confirmBtnDisabled: { opacity:0.4 },
  confirmBtnText:{ color:'#fff', fontSize:14, fontWeight:'600' },
});
