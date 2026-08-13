import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Game from './Game';

export default function App() {
  return (
    <SafeAreaProvider>
      <Game />
    </SafeAreaProvider>
  );
}
