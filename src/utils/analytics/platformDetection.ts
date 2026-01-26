import { getDeviceInfo } from '@utils/core/deviceDetection';

export interface AnalyticsPlatform {
  type: 'web' | 'pwa' | 'native';
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  isStandalone: boolean;
}

/**
 * Detect the current platform for Analytics initialization
 */
export const getAnalyticsPlatform = (): AnalyticsPlatform => {
  const deviceInfo = getDeviceInfo();
  
  return {
    type: deviceInfo.isStandalone ? 'pwa' : 'web',
    platform: deviceInfo.platform,
    isStandalone: deviceInfo.isStandalone,
  };
};
