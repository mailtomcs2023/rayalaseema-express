import { useCallback, useRef } from "react";
import { useFocusEffect, useSegments } from "expo-router";

// Fire `onFocus` each time this screen's tab becomes focused. We only want to
// refresh on a re-tap of the already-active tab, not when the user simply
// switches into this tab from another one.
export function useTabPress(onFocus: () => void) {
  const firstRun = useRef(true);
  const prevSegment = useRef<string | null>(null);
  const segments = useSegments();

  useFocusEffect(
    useCallback(() => {
      const currentSegment = segments[segments.length - 1] ?? "";
      if (firstRun.current) {
        firstRun.current = false;
        prevSegment.current = currentSegment;
        return;
      }

      if (prevSegment.current === currentSegment) {
        onFocus();
      }

      prevSegment.current = currentSegment;
    }, [onFocus, segments]),
  );
}
