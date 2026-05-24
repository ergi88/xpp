import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FolderSectionLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface FolderSectionProps {
  title: string;
  links: FolderSectionLink[];
  footer?: React.ReactNode;
  showLabel?: boolean;
}

export function FolderSection({
  title,
  links,
  footer,
  showLabel,
}: FolderSectionProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isActive = links.some((l) => location.pathname.startsWith(l.to));

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const [Icon0, Icon1, Icon2, Icon3] = links.slice(0, 4).map((l) => l.icon);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
        aria-label={title}
        aria-expanded={open}
      >
        <div
          className={cn(
            "size-12 rounded-[5px] grid grid-cols-2 place-items-center gap-px p-1",
            "ring-1 ring-border/60",
            isActive && "ring-primary/40",
          )}
        >
          {Icon0 && <Icon0 className="size-3" />}
          {Icon1 && <Icon1 className="size-3" />}
          {Icon2 && <Icon2 className="size-3" />}
          {Icon3 && <Icon3 className="size-3" />}
        </div>
        {showLabel && <span className="text-[11px]">{title}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{
                type: "spring",
                damping: 22,
                stiffness: 380,
                mass: 0.8,
              }}
              style={{ transformOrigin: "100% 100%" }}
              className="absolute bottom-full right-0 z-50 mb-3 w-52 overflow-hidden rounded-2xl border bg-background/90 shadow-2xl backdrop-blur-xl"
            >
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {title}
                </p>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5">
                {links.map((link, i) => {
                  const Icon = link.icon;
                  const active = location.pathname.startsWith(link.to);
                  return (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.18 }}
                    >
                      <Link
                        to={link.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              {footer && (
                <div className="mx-3 mb-2.5 mt-1 border-t pt-2">{footer}</div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
