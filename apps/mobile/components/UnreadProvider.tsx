import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { getApiClient } from "../lib/api";

type UnreadContextValue = {
  /** Unread notifications. Zero while loading, so nothing flashes a dot. */
  unread: number;
  /** Re-count now. Called after the notifications screen marks things seen. */
  refresh: () => void;
};

const UnreadContext = createContext<UnreadContextValue>({
  unread: 0,
  refresh: () => undefined,
});

export function useUnread(): UnreadContextValue {
  return useContext(UnreadContext);
}

/**
 * One unread count, shared by the Menu tab icon and the Menu screen's bell.
 *
 * Both need the same number, and two components fetching it independently
 * would mean two requests and two chances to disagree — one showing a dot
 * while the other doesn't is exactly the sort of thing that makes a badge
 * untrustworthy.
 *
 * There is no count endpoint, so this reads the list and counts locally. Fine
 * at the sizes involved, but worth knowing it is a full fetch: hence once,
 * here, rather than on every screen that wants to know.
 *
 * Refreshed when the app comes back to the foreground rather than on a timer.
 * A poll would spend battery to learn something that almost never changes
 * while the phone is in a pocket, and returning to the app is the moment the
 * answer might actually be stale.
 */
export default function UnreadProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [unread, setUnread] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback((): void => {
    // Guarded: foregrounding and a screen's own refresh can land together.
    if (inFlight.current) return;
    inFlight.current = true;

    void (async () => {
      try {
        const api = await getApiClient();
        const res = await api.notifications.list();
        if (!("error" in res)) {
          setUnread(res.data.notifications.filter((n) => n.seenAt === null).length);
        }
      } catch {
        // A badge is a nicety. Leaving the last known count is better than
        // showing an error, and better than clearing it and implying there is
        // nothing waiting.
      } finally {
        inFlight.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => { sub.remove(); };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
