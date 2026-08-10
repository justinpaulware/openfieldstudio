import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const ProjectActionsContext = createContext<HTMLElement | null>(null);

/** Renders `children` into the right side of the project header band. */
export function ProjectHeaderActions({ children }: { children: ReactNode }) {
  const node = useContext(ProjectActionsContext);
  if (!node) return null;
  return createPortal(children, node);
}
