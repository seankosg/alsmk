import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string;
  created_by: string;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  defaultDate: string;
  onSaved: () => void;
}

export function EventDialog({ open, onOpenChange, event, defaultDate, onSaved }: EventDialogProps) {
  const { memberId, isAdmin } = useAuthContext();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState("personal");
  const [saving, setSaving] = useState(false);

  const isOwner = event ? event.created_by === memberId : true;
  const canEdit = !event || isOwner || isAdmin;

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setEventDate(event.event_date);
      setEndDate(event.end_date ?? "");
      setEventType(event.event_type);
    } else {
      setTitle("");
      setDescription("");
      setEventDate(defaultDate);
      setEndDate("");
      setEventType("personal");
    }
  }, [event, defaultDate]);

  const handleSave = async () => {
    if (!title.trim() || !eventDate || !memberId) return;
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        end_date: endDate || null,
        event_type: eventType,
        created_by: event?.created_by ?? memberId,
      };

      if (event) {
        const { error } = await supabase.from("calendar_events").update(data).eq("id", event.id);
        if (error) throw error;
        toast.success("일정이 수정되었습니다.");
      } else {
        const { error } = await supabase.from("calendar_events").insert(data);
        if (error) throw error;
        toast.success("일정이 등록되었습니다.");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("calendar_events").delete().eq("id", event.id);
      if (error) throw error;
      toast.success("일정이 삭제되었습니다.");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? (canEdit ? "일정 수정" : "일정 상세") : "새 일정"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>제목</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} placeholder="일정 제목" />
          </div>
          <div>
            <Label>설명</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} placeholder="상세 내용 (선택)" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>시작일</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label>종료일 (선택)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label>유형</Label>
            <Select value={eventType} onValueChange={setEventType} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">개인 일정</SelectItem>
                <SelectItem value="project">프로젝트 일정</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {event && canEdit && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="mr-auto">
              삭제
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {event ? "수정" : "등록"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
