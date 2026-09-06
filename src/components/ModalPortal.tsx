"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let activeModalCount = 0;

interface ModalPortalProps {
  children: React.ReactNode;
}

export function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    activeModalCount++;
    const prevOverflow = document.body.style.overflow;
    if (activeModalCount === 1) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = prevOverflow || "";
      }
    };
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

