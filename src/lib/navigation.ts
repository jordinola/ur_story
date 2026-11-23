import { router } from 'expo-router';

/**
 * Leaves the current screen. Goes back when there is somewhere to go back to; otherwise (a cold
 * deep link made this the only route) replaces it with home so the user is never trapped.
 */
export function leave(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
