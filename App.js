import { StyleSheet, View } from 'react-native';
import FeedScreen from './src/screens/FeedScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <FeedScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});