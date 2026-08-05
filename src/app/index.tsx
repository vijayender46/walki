import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Walki</Text>

      <Text style={styles.subtitle}>
        Simple voice communication for parents and kids.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.talkButton,
          pressed && styles.talkButtonPressed,
        ]}
        onPressIn={() => console.log('Recording started')}
        onPressOut={() => console.log('Recording stopped and sent')}
      >
        <Text style={styles.microphone}>🎙️</Text>
        <Text style={styles.buttonText}>Hold to Talk</Text>
      </Pressable>

      <Text style={styles.helperText}>
        Press and hold the button to record a message.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f7f8fc',
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 24,
    color: '#4b5563',
    marginBottom: 48,
  },
  talkButton: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffb703',
    elevation: 6,
  },
  talkButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  microphone: {
    fontSize: 42,
    marginBottom: 10,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  helperText: {
    marginTop: 32,
    fontSize: 14,
    textAlign: 'center',
    color: '#6b7280',
  },
});