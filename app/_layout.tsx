import { Stack } from 'expo-router';

import { AppProvider } from '../src/state/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProvider>
  );
}
