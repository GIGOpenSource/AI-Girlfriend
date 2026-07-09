import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aigirlfriend.app',
  appName: 'AI-Girlfriend',
  webDir: 'dist',
  server: {
    // 开发时可用局域网调试，打包时注释掉这行即可
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
  },
};

export default config;
