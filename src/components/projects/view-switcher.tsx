import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCreateView,
  useDeleteView,
  useProjectViews,
  useUpdateView,
  type ProjectView,
} from "@/lib/views";

type Props = {
  projectId: string;
  projectSlug: string;
  activeSlug: string;
};

/** View picker in the project header: switch, create, duplicate, rename, delete. */
export function ViewSwitcher({ projectId, projectSlug, activeSlug }: Props) {
  const navigate = useNavigate();
  const { data: views = [] } = useProjectViews(projectId);
  const createView = useCreateView(projectId);
  const updateView = useUpdateView(projectId);
  const deleteView = useDeleteView(projectId);

  const [dialog, setDialog] = useState<
    { mode: "create" | "duplicate" | "rename"; source?: ProjectView } | null
  >(null);
  const [name, setName] = useState("");

  const active = views.find((v) => v.slug === activeSlug) ?? views.find((v) => v.is_main) ?? null;

  const goTo = (slug: string) =>
    navigate({
      to: "/projects/$projectSlug/map",
      params: { projectSlug },
      search: slug === "main" ? {} : { view: slug },
    });

  const openDialog = (mode: "create" | "duplicate" | "rename", source?: ProjectView) => {
    setDialog({ mode, ...(source ? { source } : {}) });
    setName(
      mode === "rename" ? (source?.name ?? "") : mode === "duplicate" ? `${source?.name} copy` : "",
    );
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (dialog?.mode === "rename" && dialog.source) {
        await updateView.mutateAsync({ id: dialog.source.id, patch: { name: trimmed } });
        toast.success("View renamed.");
      } else {
        const created = await createView.mutateAsync({
          name: trimmed,
          from: dialog?.mode === "duplicate" ? (dialog.source ?? null) : null,
        });
        toast.success("View created.");
        void goTo(created.slug);
      }
      setDialog(null);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const remove = async (view: ProjectView) => {
    try {
      await deleteView.mutateAsync(view);
      toast.success("View deleted.");
      if (view.slug === activeSlug) void goTo("main");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-secondary text-xs">{active?.name ?? "Main"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-64">
          <DropdownMenuLabel className="font-secondary text-xs text-muted-foreground">
            Views
          </DropdownMenuLabel>
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              className="group flex items-center gap-2"
              onSelect={(event) => {
                event.preventDefault();
                void goTo(view.slug);
              }}
            >
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${
                  view.slug === active?.slug ? "opacity-100" : "opacity-0"
                }`}
              />
              <span className="min-w-0 flex-1 truncate">{view.name}</span>
              {view.status === "published" && (
                <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-secondary text-[10px] text-primary">
                  Live
                </span>
              )}
              <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Rename ${view.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openDialog("rename", view);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Duplicate ${view.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openDialog("duplicate", view);
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {!view.is_main && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Delete ${view.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void remove(view);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openDialog("create");
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            New view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "rename"
                ? "Rename view"
                : dialog?.mode === "duplicate"
                  ? "Duplicate view"
                  : "New view"}
            </DialogTitle>
            <DialogDescription className="font-secondary">
              Views share the project's data but keep their own framing, layer visibility and
              publish state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="view-name">View name</Label>
            <Input
              id="view-name"
              value={name}
              autoFocus
              placeholder="e.g. Downtown detail"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void submit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={!name.trim() || createView.isPending || updateView.isPending}
            >
              {dialog?.mode === "rename" ? "Save" : "Create view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
