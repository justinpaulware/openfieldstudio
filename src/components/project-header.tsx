import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const PROJECT_ACTIONS_ID = "project-header-actions";

/** Renders `children` into the right side of the project header band. */
export function ProjectHeaderActions({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setNode(document.getElementById(PROJECT_ACTIONS_ID));
  });

  if (!node) return null;
  return createPortal(children, node);
}
