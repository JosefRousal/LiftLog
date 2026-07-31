import { useAppSelector } from '@/store';

export function useNotesExpandedByDefault(): boolean {
  return useAppSelector((x) => x.settings.notesExpandedByDefault);
}
