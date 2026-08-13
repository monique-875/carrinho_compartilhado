import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent chama AppRegistry.registerComponent('main', () => App),
// e também garante que o app carregue certo tanto no Expo Go quanto em builds nativas.
registerRootComponent(App);
