import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** App icon plus the app name, used as the library header title. */
export function HeaderLogo() {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="UR Story">
      <Image source={require('../../assets/logo.png')} style={styles.logo} accessible={false} />
      <Text style={styles.name} accessible={false}>
        UR Story
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
});
