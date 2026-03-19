import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, format } from "date-fns";
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

interface MonthGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthGrid({ currentDate, events, onDateClick, onEventClick }: MonthGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter((ev) => {
      if (ev.end_date) {
        return dateStr >= ev.event_date && dateStr <= ev.end_date;
      }
      return ev.event_date === dateStr;
    });
  };

  const today = new Date();

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={cn("py-2 text-center text-xs font-medium border-b border-border bg-muted/50", i === 0 && "text-destructive")}>
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);
          const holiday = getHolidayName(day);
          const sunday = isSunday(day);
          const dayEvents = getEventsForDate(day);

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[90px] border-b border-r border-border p-1 cursor-pointer transition-colors hover:bg-muted/30",
                !inMonth && "opacity-40",
                holiday && "bg-destructive/5"
              )}
              onClick={() => onDateClick(day)}
            >
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground",
                    !isToday && (holiday || sunday) && "text-destructive"
                  )}
                >
                  {format(day, "d")}
                </span>
                {holiday && (
                  <span className="text-[10px] text-destructive truncate">{holiday}</span>
                )}
              </div>
              <div className="mt-0.5 space-y-0.5 overflow-hidden max-h-[60px]">
                {dayEvents.slice(0, 3).map((ev) => (
                  <Tooltip key={ev.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-pointer",
                          ev.event_type === "project"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      >
                        {ev.title}
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
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3}개</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
