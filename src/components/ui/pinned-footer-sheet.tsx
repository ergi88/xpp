import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Sheet, type SheetRef } from "react-modal-sheet";
import { motion } from "motion/react";
import { useClickOutside } from "@/hooks/use-click-outside";

export type PinnedFooterSheetRef = {
  snapTo: (index: number) => void;
};

export type PinnedFooterSheetProps = {
  snapPoints: number[];
  initialSnap?: number;
  onSnap?: (index: number) => void;
  disableDrag?: boolean;
  disableScroll?: (state: { currentSnap?: number }) => boolean;
  scrollPaddingBottom?: number;
  collapseSnapIndex?: number;
  collapseOnOutsideClick?: boolean;
  zIndex?: number;
  containerClassName?: string;
  body: ReactNode;
  footer: ReactNode;
};

export const PinnedFooterSheet = forwardRef<
  PinnedFooterSheetRef,
  PinnedFooterSheetProps
>(function PinnedFooterSheet(
  {
    snapPoints,
    initialSnap = 1,
    onSnap,
    disableDrag,
    disableScroll,
    scrollPaddingBottom,
    collapseSnapIndex = 1,
    collapseOnOutsideClick = false,
    zIndex = 40,
    containerClassName = "backdrop-blur bg-background/95! supports-backdrop-filter:bg-background/60 border-t",
    body,
    footer,
  },
  ref,
) {
  const [sheetRef, setSheetRef] = useState<SheetRef | null>(null);
  const handleSheetRef = useCallback(
    (instance: SheetRef | null) => {
      if (!sheetRef && instance) setSheetRef(instance);
    },
    [sheetRef],
  );

  const headRef = useRef<HTMLDivElement | null>(null);
  const sheetContentRef = useRef<HTMLDivElement | null>(null);
  const navFooterRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      snapTo: (index: number) => sheetRef?.snapTo(index),
    }),
    [sheetRef],
  );

  useClickOutside(
    [sheetContentRef, navFooterRef, headRef],
    () => sheetRef?.snapTo(collapseSnapIndex),
    collapseOnOutsideClick,
  );

  return (
    <Sheet
      ref={handleSheetRef}
      isOpen={true}
      onClose={() => sheetRef?.snapTo(collapseSnapIndex)}
      snapPoints={snapPoints}
      initialSnap={initialSnap}
      onSnap={onSnap}
      style={{ zIndex }}
      detent="content"
      disableDismiss
    >
      <Sheet.Container
        style={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
        className={containerClassName}
      >
        <Sheet.Header ref={headRef}>
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        </Sheet.Header>
        <Sheet.Content
          disableScroll={disableScroll}
          disableDrag={disableDrag}
          scrollStyle={
            scrollPaddingBottom !== undefined
              ? { paddingBottom: scrollPaddingBottom }
              : undefined
          }
        >
          <div ref={sheetContentRef} className="flex flex-col">
            {body}
          </div>
        </Sheet.Content>
      </Sheet.Container>

      {!!sheetRef && (
        <motion.div
          ref={navFooterRef}
          className="absolute bottom-0 left-0 right-0 z-3 flex items-center justify-center bg-background pointer-events-auto pb-4"
        >
          {footer}
        </motion.div>
      )}
    </Sheet>
  );
});
