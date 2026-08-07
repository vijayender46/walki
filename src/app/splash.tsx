import { useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';

const splashBackground = require('../../assets/images/splash-bg.png');
const walkiLogo = require('../../assets/images/walki-logo-boy.png');

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),

      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    const navigationTimer = setTimeout(() => {
      router.replace('/welcome');
    }, 2400);

    return () => {
      animation.stop();
      clearTimeout(navigationTimer);
    };
  }, [opacity, scale, translateY]);

  return (
    <ImageBackground
      source={splashBackground}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.overlay}>
        <Animated.Image
          source={walkiLogo}
          resizeMode="contain"
          style={[
            styles.logo,
            {
              opacity,
              transform: [{ scale }, { translateY }],
            },
          ]}
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  logo: {
    width: '86%',
    maxWidth: 420,
    height: 300,
  },
});