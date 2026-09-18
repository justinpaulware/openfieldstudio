import { useMemo, useState } from "react";
import { Folder, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GalleryFolder } from "./project-gallery";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: GalleryFolder[];
  /** Folder currently holding the item (null = top level). */
  currentParent: string | null;
  /** When moving a folder, its own id — it and its descendants are disabled. */
  movingFolderId?: string | null;
  itemName: string;
  onMove: (target: string | null) => void;
};

function descendantIds(folders: GalleryFolder[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  currentParent,
  movingFolderId,
  itemName,
  onMove,
}: Props) {
  const [selected, setSelected] = useState<string | null>(currentParent);

  const blocked = useMemo(
    () => (movingFolderId ? descendantIds(folders, movingFolderId) : new Set<string>()),
    [folders, movingFolderId],
  );

  const rows = useMemo(() => {
    const out: { folder: GalleryFolder; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      folders
        .filter((f) => (f.parent_id ?? null) === parent)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((folder) => {
          out.push({ folder, depth });
          walk(folder.id, depth + 1);
        });
    };
    walk(null, 0);
    return out;
  }, [folders]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(currentParent);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>Choose where “{itemName}” should live.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary",
              selected === null && "bg-primary/15",
            )}
          >
            <FolderOpen className="h-4 w-4 text-primary" />
            All projects (top level)
          </button>
          {rows.map(({ folder, depth }) => {
            const disabled = blocked.has(folder.id);
            return (
              <button
                key={folder.id}
                type="button"
                disabled={disabled}
                onClick={() => setSelected(folder.id)}
                style={{ paddingLeft: 12 + depth * 18 }}
                className={cn(
                  "flex w-full items-center gap-2 py-2 pr-3 text-left text-sm hover:bg-secondary",
                  selected === folder.id && "bg-primary/15",
                  disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
              >
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{folder.name}</span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selected === currentParent}
            onClick={() => {
              onMove(selected);
              onOpenChange(false);
            }}
          >
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
