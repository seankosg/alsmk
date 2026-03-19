import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/layout/AppLayout";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { EventDialog } from "@/components/calendar/EventDialog";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string;
  created_by: string;
  creator_name?: string;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();

  // Compute date range for query
  const getRange = useCallback(() => {
    if (view === "month") {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      const gs = startOfWeek(ms, { weekStartsOn: 0 });
      const ge = endOfWeek(me, { weekStartsOn: 0 });
      return { from: format(gs, "yyyy-MM-dd"), to: format(ge, "yyyy-MM-dd") };
    }
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const we = addDays(ws, 6);
    return { from: format(ws, "yyyy-MM-dd"), to: format(we, "yyyy-MM-dd") };
  }, [currentDate, view]);

  const range = getRange();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events", range.from, range.to],
    queryFn: async () => {
      // Fetch events that overlap with the range
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*, members!calendar_events_created_by_fkey(name)")
        .or(`and(event_date.lte.${range.to},end_date.gte.${range.from}),and(event_date.gte.${range.from},event_date.lte.${range.to})`)
        .order("event_date");

      if (error) throw error;

      return (data ?? []).map((ev: any) => ({
        ...ev,
        creator_name: ev.members?.name ?? "Unknown",
      })) as CalendarEvent[];
    },
  });

  const handlePrev = () => {
    setCurrentDate(view === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  };

  const handleNext = () => {
    setCurrentDate(view === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedEvent(null);
    setDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(event.event_date);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  };

  const headerLabel = view === "month"
    ? format(currentDate, "yyyy년 M월", { locale: ko })
    : (() => {
        const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
        const we = addDays(ws, 6);
        return `${format(ws, "M/d")} — ${format(we, "M/d, yyyy")}`;
      })();

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Project Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "month" | "week")} size="sm">
            <ToggleGroupItem value="month" className="text-xs">월간</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs">주간</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{headerLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => { setSelectedEvent(null); setSelectedDate(format(new Date(), "yyyy-MM-dd")); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> 일정 추가
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
      ) : view === "month" ? (
        <MonthGrid currentDate={currentDate} events={events} onDateClick={handleDateClick} onEventClick={handleEventClick} />
      ) : (
        <WeekGrid currentDate={currentDate} events={events} onDateClick={handleDateClick} onEventClick={handleEventClick} />
      )}

      {/* Event Dialog */}
      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        defaultDate={selectedDate}
        onSaved={handleSaved}
      />
    </div>
  );
}
