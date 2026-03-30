import * as Location from 'expo-location';
import api from '../config/api';

let watchSubscription = null;
let pingInterval = null;
let lastCoords = null;

export async function startGPSTracking() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('GPS permission denied');
      return false;
    }

    // Watch position continuously
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
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
      } catch (err) {
        console.log('GPS ping failed:', err.message);
      }
    }, 15000);

    // Send first ping immediately
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    lastCoords = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
    };
    await api.post('/api/gps', lastCoords);

    console.log('GPS tracking started');
    return true;
  } catch (err) {
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
