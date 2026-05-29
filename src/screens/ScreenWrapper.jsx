import { Dimensions, Platform, StyleSheet, View } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_HEIGHT = SH - (Platform.OS === "android" ? 120 : 100);
const CARD_WIDTH = Math.min(CARD_HEIGHT * (9 / 16), SW - 40);

export default function ScreenWrapper({ children, backgroundColor = "transparent" }) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  inner: {
    borderRadius: 28,
    overflow: "hidden",
  },
});
