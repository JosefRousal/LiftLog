import { useAppSelector } from '@/store';

export function useRestTimersEnabled(): boolean {
  return useAppSelector((x) => x.settings.restTimersEnabled);
}
