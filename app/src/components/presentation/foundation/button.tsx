import { GesturePressableProps } from '@/components/presentation/foundation/pressable-props';
import { AppIconSource } from '@/components/presentation/foundation/ms-icon-source';
import { isNotNullOrUndefined } from '@/utils/null';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
// oxlint-disable-next-line no-restricted-imports
import { Button as NativeButton, ButtonProps as PaperButtonProps } from 'react-native-paper';

// This is the paper-based primitive being migrated away from — new call sites should reach for
// `foundation/native-button` (expo-ui) instead; this stays until that migration covers the rest
// of the app's 30+ remaining usages.

export type ButtonProps = {
  icon?: AppIconSource;
} & Omit<PaperButtonProps, 'icon'>;
export default function Button({ onPress, onLongPress, disabled, ...rest }: GesturePressableProps<ButtonProps>) {
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onStart(() => !disabled && onPress?.());
  const longPress = onLongPress
    ? Gesture.LongPress()
        .runOnJS(true)
        .onStart(() => !disabled && onLongPress())
    : undefined;
  const gesture = Gesture.Race(...[tap, longPress].filter(isNotNullOrUndefined));
  return (
    <GestureDetector gesture={gesture}>
      <NativeButton
        disabled={disabled}
        onPress={onPress ? () => {} : undefined!}
        onLongPress={onLongPress || onPress ? () => {} : undefined!}
        {...rest}
      />
    </GestureDetector>
  );
}
