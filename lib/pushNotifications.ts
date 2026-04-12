import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '@/lib/supabase';

let Notifications: any = null;
const isExpoGoAndroid = Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
if (!isExpoGoAndroid) {
  try {
    Notifications = require("expo-notifications");
  } catch (e) {
    console.warn("expo-notifications not available");
  }
}

// Configure how notifications appear when the app is in the foreground
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;
  if (!Notifications) return token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification! App does NOT have permission.');
      return;
    }

    try {
      // For EAS you'd typically want to pass your projectId here, e.g.:
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
        
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        })
      ).data;
      console.log("Expo Push Token:", token);
    } catch (e) {
      console.error("Error getting Expo Push Token:", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export const savePushTokenToProfile = async (userId: string, token: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error saving push token:', error);
  }
};
