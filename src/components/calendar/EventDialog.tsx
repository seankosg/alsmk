import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { addDays, addWeeks, addMonths, format, isBefore, isEqual } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string;
  created_by: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  defaultDate: string;
  onSaved: () => void;
}

type RecurrenceType = "none" | "daily" | "weekly" | "biweekly" | "monthly";

function generateRecurrenceDates(startDate: string, recurrence: RecurrenceType, until: string): string[] {
  const dates: string[] = [startDate];
  if (recurrence === "none") return dates;

  let current = new Date(startDate);
  const end = new Date(until);

  while (true) {
    if (recurrence === "daily") current = addDays(current, 1);
    else if (recurrence === "weekly") current = addWeeks(current, 1);
    else if (recurrence === "biweekly") current = addWeeks(current, 2);
    else if (recurrence === "monthly") current = addMonths(current, 1);

    if (isBefore(current, end) || isEqual(current, end)) {
      dates.push(format(current, "yyyy-MM-dd"));
    } else {
      break;
    }

    // Safety limit
    if (dates.length >= 365) break;
  }

  return dates;
}

export function EventDialog({ open, onOpenChange, event, defaultDate, onSaved }: EventDialogProps) {
  const { memberId, isAdmin } = useAuthContext();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  // Recurrence fields
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");

  const isOwner = event ? event.created_by === memberId : true;
  const canEdit = !event || isOwner || isAdmin;

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setEventDate(event.event_date);
      setEndDate(event.end_date ?? "");
      setEventType(event.event_type);
      setAllDay(event.all_day);
      setStartTime(event.start_time ?? "09:00");
      setEndTime(event.end_time ?? "18:00");
      setRecurrence("none");
      setRecurrenceUntil("");
    } else {
      setTitle("");
      setDescription("");
      setEventDate(defaultDate);
      setEndDate("");
      setEventType("personal");
      setAllDay(true);
      setStartTime("09:00");
      setEndTime("18:00");
      setRecurrence("none");
      setRecurrenceUntil("");
    }
  }, [event, defaultDate]);

  const handleSave = async () => {
    if (!title.trim() || !eventDate || !memberId) return;
    setSaving(true);
    try {
      if (event) {
        // Update existing event (no recurrence for updates)
        const data = {
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate,
          end_date: endDate || null,
          event_type: eventType,
          created_by: event.created_by,
        };
        const { error } = await supabase.from("calendar_events").update(data).eq("id", event.id);
        if (error) throw error;
        toast.success("일정이 수정되었습니다.");
      } else {
        // Create new event(s)
        if (recurrence !== "none" && recurrenceUntil) {
          const dates = generateRecurrenceDates(eventDate, recurrence, recurrenceUntil);
          const eventDuration = endDate ? 
            Math.round((new Date(endDate).getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          
          const rows = dates.map(d => ({
            title: title.trim(),
            description: description.trim() || null,
            event_date: d,
            end_date: eventDuration > 0 ? format(addDays(new Date(d), eventDuration), "yyyy-MM-dd") : null,
            event_type: eventType,
            created_by: memberId,
          }));

          const { error } = await supabase.from("calendar_events").insert(rows);
          if (error) throw error;
          toast.success(`반복 일정 ${rows.length}건이 등록되었습니다.`);
        } else {
          const data = {
            title: title.trim(),
            description: description.trim() || null,
            event_date: eventDate,
            end_date: endDate || null,
            event_type: eventType,
            created_by: memberId,
          };
          const { error } = await supabase.from("calendar_events").insert(data);
          if (error) throw error;
          toast.success("일정이 등록되었습니다.");
        }
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

  const recurrenceLabel: Record<RecurrenceType, string> = {
    none: "반복 없음",
    daily: "매일",
    weekly: "매주",
    biweekly: "격주",
    monthly: "매월",
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

          {/* Recurrence - only for new events */}
          {!event && canEdit && (
            <>
              <div>
                <Label>반복 설정</Label>
                <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(recurrenceLabel).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {recurrence !== "none" && (
                <div>
                  <Label>반복 종료일</Label>
                  <Input
                    type="date"
                    value={recurrenceUntil}
                    onChange={(e) => setRecurrenceUntil(e.target.value)}
                    min={eventDate}
                    placeholder="반복 종료일"
                  />
                  {recurrenceUntil && eventDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      총 {generateRecurrenceDates(eventDate, recurrence, recurrenceUntil).length}건의 일정이 생성됩니다.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          {event && canEdit && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="mr-auto">
              삭제
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleSave} disabled={saving || !title.trim() || (recurrence !== "none" && !recurrenceUntil)}>
              {event ? "수정" : recurrence !== "none" ? "반복 등록" : "등록"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
