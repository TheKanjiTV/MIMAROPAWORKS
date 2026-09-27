import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  window.addEventListener('resize', callback);
  window.visualViewport?.addEventListener('resize', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.visualViewport?.removeEventListener('resize', callback);
  };
};
const snapshot = () =>
  `${window.innerWidth}:${Math.round(window.visualViewport?.height ?? window.innerHeight)}`;
export function useAuthViewport() {
  const [width, height] = useSyncExternalStore(subscribe, snapshot).split(':').map(Number);
  return { compact: width < 760 || height < 800, tight: height < 700 };
}
