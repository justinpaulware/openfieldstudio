import { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";

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
import { submitComment } from "@/lib/publish.functions";

export type PendingPin = { lng: number; lat: number };

export function CommentComposer({
  slug,
  pin,
  categories,
  onClose,
  onSubmitted,
}: {
  slug: string;
  pin: PendingPin;
  categories: string[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    setError(null);
    if (body.trim().length < 2) {
      setError("Please write a comment.");
      return;
    }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("That email address doesn't look right.");
      return;
    }
    setSending(true);
    try {
      const result = await submitComment({
        data: {
          slug,
          lng: pin.lng,
          lat: pin.lat,
          body: body.trim(),
          category: category || null,
          authorName: name.trim() || null,
          authorEmail: email.trim() || null,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      onSubmitted();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-map-overlay-border bg-map-overlay p-3 text-map-overlay-foreground shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{done ? "Thank you" : "Leave feedback"}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {done ? (
        <div className="mt-3 flex items-start gap-2 font-secondary text-xs">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your comment was submitted and will appear once the map owner reviews it.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="comment-body" className="text-xs">
              Comment
            </Label>
            <Textarea
              id="comment-body"
              value={body}
              rows={3}
              maxLength={2000}
              onChange={(e) => setBody(e.target.value)}
              placeholder="This crossing needs a safer pedestrian connection."
              className="bg-background text-foreground"
            />
          </div>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background text-foreground">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="comment-name" className="text-xs">
                Name
              </Label>
              <Input
                id="comment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                className="bg-background text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comment-email" className="text-xs">
                Email
              </Label>
              <Input
                id="comment-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
                className="bg-background text-foreground"
              />
            </div>
          </div>

          <p className="font-secondary text-[11px] opacity-70">
            Your email is only visible to the map owner. Comments appear after review.
          </p>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={send} disabled={sending}>
              {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
