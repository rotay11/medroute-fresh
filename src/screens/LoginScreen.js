import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, biometricLogin } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const isES = i18n.language === 'es';

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Please enter your email and password'); return; }
    setLoading(true);
    try {
      await login(email.toLowerCase().trim(), password);
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.error || t('loginError'));
    } finally { setLoading(false); }
  }

  async function handleBiometric() {
    try { await biometricLogin(); }
    catch (err) { Alert.alert('Error', err.message || 'Biometric login failed'); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior='padding'>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoBox}><Text style={styles.logoText}>M</Text></View>
          <Text style={styles.appName}>{t('appName')}</Text>
          <Text style={styles.heroSub}>{t('signIn')}</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>{t('driverIdOrEmail')}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="driver@medroute.com" autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
          <Text style={styles.label}>{t('password')}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>{t('loginBtn')}</Text>}
          </TouchableOpacity>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('orBiometrics')}</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity style={styles.bioBtn} onPress={handleBiometric}>
            <Text style={styles.bioBtnText}>{t('faceIdFingerprint')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.langBtn} onPress={() => i18n.changeLanguage(isES ? 'en' : 'es')}>
            <Text style={styles.langBtnText}>{t('switchToSpanish')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#fff' },
  scroll:       { flexGrow:1 },
  hero:         { backgroundColor:'#1D9E75', padding:36, alignItems:'center', paddingTop:80 },
  logoBox:      { width:56, height:56, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:14, alignItems:'center', justifyContent:'center', marginBottom:12 },
  logoText:     { fontSize:28, fontWeight:'bold', color:'#fff' },
  appName:      { fontSize:22, fontWeight:'bold', color:'#fff', marginBottom:6 },
  heroSub:      { fontSize:13, color:'rgba(255,255,255,0.8)' },
  form:         { padding:24, flex:1 },
  label:        { fontSize:11, fontWeight:'600', color:'#666', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5, marginTop:14 },
  input:        { borderWidth:0.5, borderColor:'#ddd', borderRadius:8, padding:12, fontSize:14, backgroundColor:'#f9f9f9', color:'#333' },
  loginBtn:     { backgroundColor:'#1D9E75', borderRadius:8, padding:14, alignItems:'center', marginTop:20 },
  loginBtnText: { color:'#fff', fontSize:15, fontWeight:'600' },
  dividerRow:   { flexDirection:'row', alignItems:'center', marginVertical:16 },
  dividerLine:  { flex:1, height:0.5, backgroundColor:'#ddd' },
  dividerText:  { marginHorizontal:10, fontSize:11, color:'#999' },
  bioBtn:       { borderWidth:0.5, borderColor:'#ddd', borderRadius:8, padding:12, alignItems:'center', backgroundColor:'#f9f9f9' },
  bioBtnText:   { fontSize:13, color:'#333' },
  langBtn:      { marginTop:20, alignItems:'center' },
  langBtnText:  { fontSize:12, color:'#1D9E75' },
});
