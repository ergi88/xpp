import React, { useState } from "react";
import {
  motion,
  MotionConfig,
  useMotionValue,
  type Transition,
} from "motion/react";

interface FundWidgetProps {
  slides: React.ReactNode[];
  initialIndex?: number;
}

const CARD_HEIGHT = 170;
const DRAG_BUFFER = 40;
const VELOCITY_THRESHOLD = 0;

const SPRING_OPTIONS: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 40,
};

export const FundWidget: React.FC<FundWidgetProps> = ({
  slides,
  initialIndex = 0,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const y = useMotionValue(-(initialIndex * CARD_HEIGHT));

  const handleDragEnd = (
    _: unknown,
    info: { offset: { y: number }; velocity: { y: number } },
  ) => {
    const offset = info.offset.y;
    const velocity = info.velocity.y;
    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      setIndex((prev) => Math.min(prev + 1, slides.length - 1));
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      setIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="w-full">
      <MotionConfig transition={SPRING_OPTIONS}>
        <div className="relative h-[170px] w-full overflow-hidden rounded-2xl border border-[#E0DEDA] bg-[#FBFCF9] shadow-md select-none dark:border-white/10 dark:bg-zinc-900">
          <motion.div
            drag="y"
            dragConstraints={{
              top: -((slides.length - 1) * CARD_HEIGHT),
              bottom: 0,
            }}
            dragElastic={0.12}
            style={{ y }}
            onDragEnd={handleDragEnd}
            animate={{ y: -(index * CARD_HEIGHT) }}
            className="flex cursor-grab flex-col active:cursor-grabbing"
          >
            {slides.map((slide, i) => (
              <div key={i} className="flex min-h-[170px] w-full">
                {slide}
              </div>
            ))}
          </motion.div>
          <div className="absolute top-1/2 right-1 z-20 flex -translate-y-1/2 flex-col">
            {slides.map((_, i) => (
              <button
                key={i}
                title="slider"
                onClick={() => setIndex(i)}
                className="py-1 focus:outline-none"
              >
                <motion.div
                  animate={{
                    height: i === index ? 42 : 10,
                    backgroundColor: i === index ? "#585652" : "#D3D3D3",
                  }}
                  transition={{ duration: 0.3 }}
                  className="w-[6px] rounded-full"
                />
              </button>
            ))}
          </div>
        </div>
      </MotionConfig>
    </div>
  );
};
