import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Platform, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import api from '../config/api';

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { driver, logout } = useAuth();
  const [route,      setRoute]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [sortMode,   setSortMode]   = useState('default');
  const [startPoint, setStartPoint] = useState({ lat: 37.6879, lng: -122.0561 });
  const [urgentModal, setUrgentModal] = useState(null);
  const [urgentReason, setUrgentReason] = useState('');
  const [urgentNote, setUrgentNote] = useState('');
  const [reordering, setReordering] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [driverLoc,  setDriverLoc]  = useState(null);
  const [stats,      setStats]      = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('goodMorning');
    if (h < 17) return t('goodAfternoon');
    return t('goodEvening');
  };

  const loadRoute = useCallback(async () => {
    try {
      const [routeRes, statsRes] = await Promise.all([
        api.get('/api/scan/route'),
        api.get('/api/driver/stats'),
      ]);
      setRoute(routeRes.data.bundles || routeRes.data.route || []);
      if (routeRes.data.startPoint) setStartPoint(routeRes.data.startPoint);
      setStats(statsRes.data || {});
    } catch (err) {
      console.log('Load route error:', err.message);
    }
  }, []);

  useEffect(() => { loadRoute(); }, [loadRoute]);
  useFocusEffect(useCallback(() => {
    const lastUpdate = route.params?.routeUpdated;
    if (lastUpdate) { loadRoute(); }
  }, [route.params?.routeUpdated]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRoute();
    setRefreshing(false);
  }, [loadRoute]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  // Calculate distance between two coordinates
  function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Get sorted route based on sort mode
  const sortedRoute = React.useMemo(() => {
    if (sortMode === 'default') return route;
    const undelivered = route.filter(b => b.status !== 'DELIVERED');
    const delivered = route.filter(b => b.status === 'DELIVERED');
    // Use driver GPS if available, otherwise pharmacy starting point
    const origin = driverLoc ? { lat: driverLoc.lat, lng: driverLoc.lng } : startPoint;
    const withDist = undelivered.map(b => ({
      ...b,
      _dist: (b.addressLat && b.addressLng)
        ? calcDistance(origin.lat, origin.lng, b.addressLat, b.addressLng)
        : 999
    }));
    withDist.sort((a, b) => sortMode === 'nearest' ? a._dist - b._dist : b._dist - a._dist);
    return [...withDist, ...delivered];
  }, [route, sortMode, driverLoc, startPoint]);

  const nextStop  = sortedRoute.find(b => b.status !== 'DELIVERED');

  async function markUrgent() {
    if (!urgentReason) { Alert.alert('Error', 'Please select a reason'); return; }
    if (urgentReason === 'Other' && (!urgentNote || urgentNote.trim().length < 3)) {
      Alert.alert('Error', 'Please provide an explanation for Other');
      return;
    }
    try {
      await api.post('/api/bundle/' + urgentModal.id + '/urgent', { reason: urgentReason, note: urgentNote });
      setUrgentModal(null);
      setUrgentReason('');
      setUrgentNote('');
      loadRoute();
      Alert.alert('Urgent Marked', 'Stop has been prioritized. Dispatcher and patient notified.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not mark urgent');
    }
  }

  async function removeUrgent(bundleId) {
    try {
      await api.delete('/api/bundle/' + bundleId + '/urgent');
      loadRoute();
    } catch (err) { Alert.alert('Error', 'Could not remove urgent'); }
  }

  async function moveStop(bundleId, direction) {
    if (reordering) return;
    setReordering(true);
    try {
      await api.post('/api/bundle/reorder', { bundleId, direction });
      await loadRoute();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not reorder');
    }
    setReordering(false);
  }

  const completed = route.filter(b => b.status === 'DELIVERED').length;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D9E75" />}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{driver?.firstName?.[0]}{driver?.lastName?.[0]}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.driverName}>{driver?.firstName} {driver?.lastName}</Text>
            <Text style={styles.driverId}>{driver?.driverId}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>{t('signOut')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.driverHeader}>
          <Text style={styles.driverGreeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},</Text>
          <Text style={styles.driverNameLarge}>{driver?.firstName} {driver?.lastName}</Text>
          <Text style={styles.driverZone}>{driver?.zone || 'No zone assigned'}</Text>
        </View>
        {loading && (
          <View style={{backgroundColor:'rgba(29,158,117,0.1)',padding:8,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8}}>
            <ActivityIndicator size="small" color="#1D9E75" />
            <Text style={{fontSize:12,color:'#1D9E75',fontWeight:'600'}}>Updating route...</Text>
          </View>
        )}
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statNum}>{route.length}</Text><Text style={styles.statLabel}>{t('todayStops')}</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{completed}</Text><Text style={styles.statLabel}>{t('delivered')}</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{stats.compliance || '100%'}</Text><Text style={styles.statLabel}>{t('compliance')}</Text></View>
        </View>
      </View>
      <View style={styles.body}>
        {nextStop && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('nextDelivery')}</Text>
            <View style={styles.nextCard}>
              <Text style={styles.stopTag}>{t('stop')} {nextStop.stopOrder} {t('of')} {route.length}</Text>
              <Text style={styles.nextAddr}>{nextStop.address}</Text>
              <Text style={styles.nextPatient}>{nextStop.packages?.[0]?.patient?.firstName} {nextStop.packages?.[0]?.patient?.lastName} · {nextStop.packages?.length} {t('medications')}</Text>
              <View style={styles.nextMeta}>
                <Text style={styles.etaText}>{t('eta')} {nextStop.eta ? new Date(nextStop.eta).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '--'}</Text>
                <TouchableOpacity style={styles.navBtn} onPress={() => {
                  const addr = encodeURIComponent(nextStop?.address || '');
                  const {Linking, Platform} = require('react-native');
                  if (Platform.OS === 'android') {
                    Linking.openURL('geo:0,0?q=' + addr).catch(() => Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + addr));
                  } else {
                    Linking.openURL('maps://?daddr=' + addr).catch(() => Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + addr));
                  }
                }}>
                  <Text style={styles.navBtnText}>{t('navigate')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('Scan', { bundle: nextStop })}>
          <Text style={styles.scanBtnText}>{t('scanMedication')}</Text>
        </TouchableOpacity>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('todayRoute')}</Text>
          <View style={{flexDirection:'row',gap:8,marginBottom:12,alignItems:'center'}}>
            {[['default','Default'],['nearest','Nearest First'],['farthest','Farthest First']].map(([mode,label]) => (
              <TouchableOpacity key={mode} onPress={() => {
                setSortMode(mode);
                if (mode !== 'default') {
                  const Location = require('expo-location');
                  Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced}).then(loc => {
                    setDriverLoc({lat: loc.coords.latitude, lng: loc.coords.longitude});
                  }).catch(() => {});
                }
              }} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:6,backgroundColor:sortMode===mode?'#1D9E75':'#f0f0f0'}}>
                <Text style={{fontSize:10,fontWeight:'600',color:sortMode===mode?'#fff':'#666'}}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={{flex:1}} />
            <TouchableOpacity onPress={() => setEditMode(!editMode)} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:6,backgroundColor:editMode?'#E24B4A':'#0C447C'}}>
              <Text style={{fontSize:11,fontWeight:'700',color:'#fff'}}>{editMode ? '✓ Done Editing' : '✎ Edit Route'}</Text>
            </TouchableOpacity>
          </View>
          {route.length === 0 && <Text style={styles.noStops}>{t('noStops')}</Text>}
          {sortedRoute.map((bundle, idx) => {
            const canMove = bundle.status !== 'DELIVERED' && bundle.status !== 'IN_TRANSIT';
            const isFirst = idx === 0;
            const isLast = idx === sortedRoute.length - 1;
            return (
            <View key={bundle.id} style={[styles.stopRow, bundle.urgent && styles.stopRowUrgent]}>
              {bundle.urgent && (
                <View style={styles.urgentBanner}>
                  <Text style={styles.urgentBannerText}>⚡ URGENT — {bundle.urgentReason}</Text>
                  {bundle.urgentNote && <Text style={styles.urgentNoteText}>{bundle.urgentNote}</Text>}
                </View>
              )}
              <View style={{flexDirection:'row',alignItems:'center'}}>
                <TouchableOpacity style={{flexDirection:"row",flex:1,alignItems:"center"}} onPress={() => !editMode && navigation.navigate("Scan", { bundle })}>
                  <View style={[styles.stopNum, bundle.status === 'DELIVERED' && styles.stopNumDone, bundle.urgent && styles.stopNumUrgent]}>
                    <Text style={styles.stopNumText}>{bundle.status === 'DELIVERED' ? '✓' : bundle.stopOrder}</Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={styles.stopName}>{bundle.packages?.[0]?.patient?.firstName} {bundle.packages?.[0]?.patient?.lastName}</Text>
                    <Text style={styles.stopAddr} numberOfLines={1}>{bundle.address}</Text>
                  </View>
                  {!editMode && (
                    <Text style={[styles.stopEta, bundle.status === 'DELIVERED' && { color:'#1D9E75' }]}>
                      {bundle.status === 'DELIVERED' ? t('done') : bundle.eta ? new Date(bundle.eta).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '--'}
                    </Text>
                  )}
                </TouchableOpacity>
                {editMode && canMove && (
                  <View style={{flexDirection:'column',marginLeft:4}}>
                    <TouchableOpacity disabled={isFirst || reordering} style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]} onPress={() => moveStop(bundle.id, 'up')}>
                      <Text style={styles.arrowText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={isLast || reordering} style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]} onPress={() => moveStop(bundle.id, 'down')}>
                      <Text style={styles.arrowText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!editMode && bundle.status !== "DELIVERED" && (
                  <TouchableOpacity style={{backgroundColor:"#1D9E75",borderRadius:6,padding:8,marginLeft:4,minWidth:44,alignItems:'center'}} onPress={() => { const addr = encodeURIComponent(bundle.address || ""); const {Linking, Platform} = require("react-native"); Platform.OS === "android" ? Linking.openURL("geo:0,0?q=" + addr).catch(() => Linking.openURL("https://www.google.com/maps/dir/?api=1&destination=" + addr)) : Linking.openURL("maps://?daddr=" + addr).catch(() => Linking.openURL("https://www.google.com/maps/dir/?api=1&destination=" + addr)); }}>
                    <Text style={{color:"#fff",fontSize:12,fontWeight:"600"}}>Nav</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editMode && bundle.status !== "DELIVERED" && (
                <View style={{flexDirection:'row',marginTop:8,gap:8}}>
                  {!bundle.urgent ? (
                    <TouchableOpacity style={styles.urgentBtn} onPress={() => setUrgentModal(bundle)}>
                      <Text style={styles.urgentBtnText}>⚡ Mark Urgent</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.removeUrgentBtn} onPress={() => removeUrgent(bundle.id)}>
                      <Text style={styles.removeUrgentBtnText}>Remove Urgent</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            );
          })}
        </View>
      </View>
      <Modal visible={!!urgentModal} transparent animationType="fade" onRequestClose={() => setUrgentModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚡ Mark as Urgent</Text>
            <Text style={{fontSize:13,color:'#666',marginBottom:8}}>
              {urgentModal?.packages?.[0]?.patient?.firstName} {urgentModal?.packages?.[0]?.patient?.lastName}
            </Text>
            <Text style={styles.modalLabel}>Reason (required)</Text>
            {['Patient transitioning', 'Dose time critical', 'Pharmacist request', 'Refrigerated item', 'STAT order', 'Other'].map(r => (
              <TouchableOpacity key={r} style={[styles.reasonBtn, urgentReason === r && styles.reasonBtnSelected]} onPress={() => setUrgentReason(r)}>
                <Text style={styles.reasonBtnText}>{r}</Text>
              </TouchableOpacity>
            ))}
            {urgentReason === 'Other' && (
              <>
                <Text style={styles.modalLabel}>Explanation (required)</Text>
                <TextInput style={styles.modalInput} multiline value={urgentNote} onChangeText={setUrgentNote} placeholder="Enter reason..." />
              </>
            )}
            {urgentReason !== 'Other' && urgentReason && (
              <>
                <Text style={styles.modalLabel}>Additional note (optional)</Text>
                <TextInput style={styles.modalInput} multiline value={urgentNote} onChangeText={setUrgentNote} placeholder="Optional details..." />
              </>
            )}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setUrgentModal(null); setUrgentReason(''); setUrgentNote(''); }}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={markUrgent}>
                <Text style={{color:'#fff',fontWeight:'700'}}>Mark Urgent</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#f5f5f5' },
  header:       { backgroundColor:'#1D9E75', padding:16, paddingTop:56 },
  headerTop:    { flexDirection:'row', alignItems:'center', marginBottom:16 },
  avatar:       { width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center', marginRight:10 },
  avatarText:   { color:'#fff', fontWeight:'bold', fontSize:14 },
  headerInfo:   { flex:1 },
  greeting:     { fontSize:11, color:'rgba(255,255,255,0.8)' },
  driverName:   { fontSize:16, fontWeight:'600', color:'#fff' },
  driverId:     { fontSize:10, color:'rgba(255,255,255,0.7)' },
  signOutBtn:   { padding:6 },
  signOutText:  { fontSize:11, color:'rgba(255,255,255,0.8)' },
  driverHeader:    { backgroundColor:'#1D9E75', paddingHorizontal:20, paddingBottom:16, paddingTop:4 },
  driverGreeting:  { fontSize:13, color:'rgba(255,255,255,0.75)' },
  driverNameLarge: { fontSize:20, fontWeight:'700', color:'#fff', marginTop:2 },
  driverZone:      { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 },
  statsRow:     { flexDirection:'row', gap:8 },
  statBox:      { flex:1, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:8, padding:10, alignItems:'center' },
  statNum:      { fontSize:20, fontWeight:'600', color:'#fff' },
  statLabel:    { fontSize:9, color:'rgba(255,255,255,0.75)', marginTop:2 },
  body:         { padding:14 },
  section:      { marginBottom:16 },
  sectionLabel: { fontSize:10, fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  nextCard:     { backgroundColor:'#fff', borderRadius:10, padding:14, borderWidth:0.5, borderColor:'#e0e0e0' },
  stopTag:      { fontSize:10, fontWeight:'600', color:'#0F6E56', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  nextAddr:     { fontSize:14, fontWeight:'600', color:'#333', marginBottom:2 },
  nextPatient:  { fontSize:12, color:'#666', marginBottom:10 },
  nextMeta:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  etaText:      { fontSize:13, fontWeight:'600', color:'#0F6E56' },
  navBtn:       { backgroundColor:'#1D9E75', borderRadius:7, paddingHorizontal:16, paddingVertical:8 },
  navBtnText:   { color:'#fff', fontSize:12, fontWeight:'600' },
  scanBtn:      { backgroundColor:'#1D9E75', borderRadius:10, padding:14, alignItems:'center', marginBottom:16 },
  scanBtnText:  { color:'#fff', fontSize:14, fontWeight:'600' },
  stopRow:      { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:8, padding:10, marginBottom:6, borderWidth:0.5, borderColor:'#e0e0e0' },
  stopNum:      { width:24, height:24, borderRadius:12, backgroundColor:'#E1F5EE', alignItems:'center', justifyContent:'center', marginRight:10 },
  stopNumDone:  { backgroundColor:'#1D9E75' },
  stopNumText:  { fontSize:10, fontWeight:'600', color:'#085041' },
  stopInfo:     { flex:1 },
  stopName:     { fontSize:12, fontWeight:'600', color:'#333' },
  stopAddr:     { fontSize:10, color:'#888', marginTop:1 },
  stopEta:      { fontSize:11, fontWeight:'600', color:'#0F6E56', marginLeft:8 },
  urgentDot:    { width:8, height:8, borderRadius:4, backgroundColor:'#E24B4A', marginLeft:4 },
  noStops:      { fontSize:13, color:'#888', textAlign:'center', padding:20 },
  stopRowUrgent: { borderLeftWidth: 4, borderLeftColor: '#E24B4A', backgroundColor: '#FFF5F5' },
  stopNumUrgent: { backgroundColor: '#E24B4A' },
  urgentBanner: { backgroundColor: '#E24B4A', padding: 6, borderRadius: 4, marginBottom: 8 },
  urgentBannerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  urgentNoteText: { color: '#fff', fontSize: 10, marginTop: 2, fontStyle: 'italic' },
  arrowBtn: { width: 44, height: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: 4, marginVertical: 1 },
  arrowBtnDisabled: { opacity: 0.3 },
  arrowText: { fontSize: 10, color: '#333', fontWeight: '700' },
  urgentBtn: { backgroundColor: '#E24B4A', padding: 8, borderRadius: 6, flex: 1, alignItems: 'center' },
  urgentBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  removeUrgentBtn: { backgroundColor: '#888', padding: 8, borderRadius: 6, flex: 1, alignItems: 'center' },
  removeUrgentBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  reasonBtn: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, marginBottom: 6 },
  reasonBtnSelected: { borderColor: '#E24B4A', backgroundColor: '#FFF5F5' },
  reasonBtnText: { fontSize: 13 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 14, minHeight: 60 },
  modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  modalSubmitBtn: { flex: 1, padding: 12, borderRadius: 6, backgroundColor: '#E24B4A', alignItems: 'center' },
});