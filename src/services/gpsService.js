import * as Location from 'expo-location';
import api from '../config/api';

let watchSubscription = null;
let pingInterval = null;
let lastCoords = null;
let gpsStatus = 'starting';

export function getGPSStatus() { return gpsStatus; }

export async function startGPSTracking() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('GPS permission status:', status);
    if (status !== 'granted') {
      console.log('GPS PERMISSION DENIED');
      gpsStatus = 'denied';
      return false;
    }

    // Watch position continuously
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        lastCoords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
        };
      }
    );

    // Ping server every 15 seconds
    pingInterval = setInterval(async () => {
      if (!lastCoords) return;
      try {
        await api.post('/api/gps', {
          lat: lastCoords.lat,
          lng: lastCoords.lng,
          accuracy: lastCoords.accuracy,
          speed: lastCoords.speed,
          heading: lastCoords.heading,
        });
        gpsStatus = 'active';
        console.log('GPS ping sent:', lastCoords.lat.toFixed(4), lastCoords.lng.toFixed(4));
      } catch (err) {
        gpsStatus = 'error';
        console.log('GPS ping failed:', err.message);
      }
    }, 15000);

    // Send first ping immediately
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    lastCoords = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
    };
    await api.post('/api/gps', lastCoords);

    gpsStatus = 'active';
    console.log('GPS tracking started');
    return true;
  } catch (err) {
    gpsStatus = 'error';
    console.log('GPS tracking error:', err.message);
    return false;
  }
}

export function stopGPSTracking() {
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  lastCoords = null;
  console.log('GPS tracking stopped');
}

export function getLastCoords() {
  return lastCoords;
}
