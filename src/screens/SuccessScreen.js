import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function SuccessScreen({ navigation, route }) {
  const { t } = useTranslation();
  const delivery = route.params?.delivery;
  const nextStop = delivery?.nextStop;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}><Text style={styles.icon}>✓</Text></View>
      <Text style={styles.title}>{t('deliveryComplete')}</Text>
      <Text style={styles.sub}>{t('notified')}</Text>
      <View style={styles.nextCard}>
        {nextStop ? (
          <>
            <Text style={styles.nextLabel}>{t('nextStop')}</Text>
            <Text style={styles.nextName}>{nextStop.patientName}</Text>
            <Text style={styles.nextAddr}>{nextStop.address}</Text>
          </>
        ) : (
          <Text style={styles.allDoneText}>{t('allDelivered')}</Text>
        )}
      </View>
      <TouchableOpacity style={styles.continueBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.continueBtnText}>{nextStop ? t('continueRoute') : t('done')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex:1, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', padding:24 },
  iconWrap:       { width:70, height:70, borderRadius:35, backgroundColor:'#1D9E75', alignItems:'center', justifyContent:'center', marginBottom:16 },
  icon:           { fontSize:32, color:'#fff', fontWeight:'bold' },
  title:          { fontSize:22, fontWeight:'bold', color:'#333', marginBottom:8, textAlign:'center' },
  sub:            { fontSize:13, color:'#888', textAlign:'center', marginBottom:24, maxWidth:240 },
  nextCard:       { backgroundColor:'#f5f5f5', borderRadius:10, padding:16, width:'100%' , marginBottom:20 },
  nextLabel:      { fontSize:10, fontWeight:'600', color:'#0F6E56', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 },
  nextName:       { fontSize:15, fontWeight:'600', color:'#333', marginBottom:3 },
  nextAddr:       { fontSize:12, color:'#666' },
  allDoneText:    { fontSize:14, color:'#1D9E75', fontWeight:'600', textAlign:'center' },
  continueBtn:    { backgroundColor:'#1D9E75', borderRadius:10, padding:14, width:'100%' , alignItems:'center' },
  continueBtnText:{ color:'#fff', fontSize:15, fontWeight:'600' },
});
