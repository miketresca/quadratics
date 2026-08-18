"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";

export function OutsideCloseDetails({
  children,
  className,
  initialOpen = false
}: {
  children: ReactNode;
  className?: string;
  initialOpen?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    setOpen(initialOpen);
  }, [initialOpen]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <details className={className} onToggle={(event) => setOpen(event.currentTarget.open)} open={open} ref={ref}>
      {children}
    </details>
  );
}
