import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import api from '../config/api';

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { driver, logout } = useAuth();
  const [route,      setRoute]      = useState([]);
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
      setStats(statsRes.data || {});
    } catch (err) {
      console.log('Load route error:', err.message);
    }
  }, []);

  useEffect(() => { loadRoute(); }, [loadRoute]);
  useFocusEffect(useCallback(() => { loadRoute(); }, [loadRoute]));

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

  const nextStop  = route.find(b => b.status !== 'DELIVERED');
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
                <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Scan', { bundle: nextStop })}>
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
          {route.length === 0 && <Text style={styles.noStops}>{t('noStops')}</Text>}
          {route.map((bundle) => (
            <TouchableOpacity key={bundle.id} style={styles.stopRow} onPress={() => navigation.navigate('Scan', { bundle })}>
              <View style={[styles.stopNum, bundle.status === 'DELIVERED' && styles.stopNumDone]}>
                <Text style={styles.stopNumText}>{bundle.status === 'DELIVERED' ? '✓' : bundle.stopOrder}</Text>
              </View>
              <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{bundle.packages?.[0]?.patient?.firstName} {bundle.packages?.[0]?.patient?.lastName}</Text>
                <Text style={styles.stopAddr} numberOfLines={1}>{bundle.address}</Text>
              </View>
              <Text style={[styles.stopEta, bundle.status === 'DELIVERED' && { color:'#1D9E75' }]}>
                {bundle.status === 'DELIVERED' ? t('done') : bundle.eta ? new Date(bundle.eta).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '--'}
              </Text>
              {bundle.hasUrgent && <View style={styles.urgentDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
});
