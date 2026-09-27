import { useSyncExternalStore, type MouseEvent } from 'react';

export function handleNavigation(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.target === '_blank'
  )
    return;
  event.preventDefault();
  navigate(event.currentTarget.pathname + event.currentTarget.search + event.currentTarget.hash);
}

export function navigate(path: string, options: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (options.replace || current === path) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('hashchange', callback);
  };
};

export const useLocation = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search + window.location.hash,
  );

export const usePath = () => useLocation().split(/[?#]/, 1)[0];
