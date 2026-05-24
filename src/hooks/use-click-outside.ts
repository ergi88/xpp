import { useEffect, useRef } from "react";

/**
 * Fires handler when a pointerdown lands outside all provided refs.
 * Uses capture phase so it fires before any element's own handlers.
 */
export function useClickOutside(
  refs: React.RefObject<Element | null>[],
  handler: () => void,
  enabled: boolean,
) {
  const handler$ = useRef(handler);
  handler$.current = handler;

  const refs$ = useRef(refs);
  refs$.current = refs;

  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inside = refs$.current.some((r) => r.current?.contains(target));
      if (!inside) handler$.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [enabled]);
}
