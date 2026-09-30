import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

/** Sentinel because an empty string is not a valid Select item value. */
const NONE = "__none__";

export type EditableComment = {
  id: string;
  body: string;
  category: string | null;
  source: string | null;
  created_at: string;
};

/** ISO timestamp -> value a datetime-local input understands, in local time. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Lets the map owner correct a comment: assign or change its topic, tidy the
 * wording for public legibility, and fix the source label.
 */
export function EditCommentDialog({
  comment,
  categories,
  onOpenChange,
  onSaved,
}: {
  comment: EditableComment | null;
  categories: string[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(NONE);
  const [source, setSource] = useState("");
  const [when, setWhen] = useState("");

  useEffect(() => {
    if (!comment) return;
    setBody(comment.body);
    setCategory(comment.category?.trim() ? comment.category : NONE);
    setSource(comment.source ?? "");
    setWhen(toLocalInput(comment.created_at));
  }, [comment]);

  const save = useMutation({
    mutationFn: async () => {
      if (!comment) return;
      const text = body.trim();
      if (!text) throw new Error("A comment can't be empty.");
      const stamp = when ? new Date(when) : null;
      if (when && Number.isNaN(stamp!.getTime())) throw new Error("That date isn't valid.");
      const { error } = await supabase
        .from("comments")
        .update({
          body: text,
          category: category === NONE ? null : category,
          source: source.trim() || "Webmap",
          ...(stamp ? { created_at: stamp.toISOString() } : {}),
        })
        .eq("id", comment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment updated.");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Categories the project no longer lists still need to stay selectable.
  const options =
    comment?.category?.trim() && !categories.includes(comment.category.trim())
      ? [...categories, comment.category.trim()]
      : categories;

  return (
    <Dialog open={comment != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit comment</DialogTitle>
          <DialogDescription className="font-secondary">
            Change the topic freely. Edit the wording only to fix spelling, grammar or
            clarity — never to change what the contributor meant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-comment-category">Topic</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="edit-comment-category">
                <SelectValue placeholder="No topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No topic</SelectItem>
                {options.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-comment-body">Comment</Label>
            <Textarea
              id="edit-comment-body"
              value={body}
              rows={5}
              maxLength={2000}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-comment-source">Source</Label>
            <Input
              id="edit-comment-source"
              value={source}
              maxLength={60}
              placeholder="Webmap"
              onChange={(event) => setSource(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-comment-date">Date &amp; time</Label>
            <Input
              id="edit-comment-date"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
            <p className="font-secondary text-xs text-muted-foreground">
              Shown in your local time. Change it when the feedback was collected on another day.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
