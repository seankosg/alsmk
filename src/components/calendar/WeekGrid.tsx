import { startOfWeek, addDays, isSameDay, format } from "date-fns";
import { isHoliday, getHolidayName, isSunday } from "./holidays";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

interface WeekGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function WeekGrid({ currentDate, events, onDateClick, onEventClick }: WeekGridProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter((ev) => {
      if (ev.end_date) {
        return dateStr >= ev.event_date && dateStr <= ev.end_date;
      }
      return ev.event_date === dateStr;
    });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const holiday = getHolidayName(day);
          const sunday = isSunday(day);
          const isToday = isSameDay(day, today);

          return (
            <div key={i} className={cn("text-center py-2 border-b border-border bg-muted/50", (sunday || holiday) && "text-destructive")}>
              <div className="text-xs font-medium">{WEEKDAYS[i]}</div>
              <div className={cn("text-lg font-bold mt-0.5", isToday && "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto")}>
                {format(day, "d")}
              </div>
              {holiday && <div className="text-[10px] text-destructive">{holiday}</div>}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((day, i) => {
          const dayEvents = getEventsForDate(day);
          const holiday = isHoliday(day);

          return (
            <div
              key={i}
              className={cn(
                "border-r border-border p-2 cursor-pointer hover:bg-muted/30 transition-colors",
                holiday && "bg-destructive/5"
              )}
              onClick={() => onDateClick(day)}
            >
              <div className="space-y-1.5">
                {dayEvents.map((ev) => (
                  <Tooltip key={ev.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "text-xs p-1.5 rounded cursor-pointer",
                          ev.event_type === "project"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      >
                        <div className="font-medium truncate">{ev.title}</div>
                        {ev.description && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{ev.description}</div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-medium">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.event_type === "project" ? "프로젝트" : "개인"} · 작성자: {ev.creator_name ?? "Unknown"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
