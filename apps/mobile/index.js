import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './src/App';

// Register background handler for FCM messages outside React component lifecycle
messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
  // Process data-only background push if needed
});

AppRegistry.registerComponent('Expyrico', () => App);
