'use client';

import { useState } from 'react';

interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: string;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

interface CalendarHeatmapProps {
  weeks: ContributionWeek[];
}

// Map GitHub's contribution levels to CSS classes
function levelToClass(level: string): string {
  switch (level) {
    case 'NONE':
      return 'contrib-0';
    case 'FIRST_QUARTILE':
      return 'contrib-1';
    case 'SECOND_QUARTILE':
      return 'contrib-2';
    case 'THIRD_QUARTILE':
      return 'contrib-3';
    case 'FOURTH_QUARTILE':
      return 'contrib-4';
    default:
      return 'contrib-0';
  }
}

// Get month labels and their positions
function getMonthLabels(weeks: ContributionWeek[]): { label: string; index: number }[] {
  const labels: { label: string; index: number }[] = [];
  let lastMonth = '';

  weeks.forEach((week, index) => {
    if (week.contributionDays.length > 0) {
      // Use the first day of the week to determine month
      const firstDay = week.contributionDays[0];
      const date = new Date(firstDay.date);
      const month = date.toLocaleDateString('en-US', { month: 'short' });

      if (month !== lastMonth) {
        labels.push({ label: month, index });
        lastMonth = month;
      }
    }
  });

  return labels;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarHeatmap({ weeks }: CalendarHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    count: number;
  } | null>(null);

  const monthLabels = getMonthLabels(weeks);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    day: ContributionDay
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const date = new Date(day.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      date: formattedDate,
      count: day.contributionCount,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Calculate total width: 53 weeks * 13px (11px cell + 2px gap)
  const gridWidth = weeks.length * 13;

  return (
    <div className="relative">
      <div className="flex">
        {/* Day labels - fixed on left */}
        <div className="flex flex-col justify-between mr-2 py-[2px] shrink-0" style={{ height: `${7 * 13}px` }}>
          {DAY_LABELS.map((day, i) => (
            <div
              key={day}
              className="text-xs text-[var(--text-tertiary)] h-[11px] flex items-center"
              style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
            >
              {day.charAt(0)}
            </div>
          ))}
        </div>

        {/* Scrollable container for month labels + grid */}
        <div className="overflow-x-auto flex-1">
          {/* Month labels - positioned absolutely relative to grid */}
          <div className="relative mb-1" style={{ width: `${gridWidth}px`, height: '16px' }}>
            {monthLabels.map((month, i) => (
              <div
                key={`${month.label}-${i}`}
                className="absolute text-xs text-[var(--text-tertiary)]"
                style={{ left: `${month.index * 13}px` }}
              >
                {month.label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[2px]" style={{ width: `${gridWidth}px` }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[2px]">
                {week.contributionDays.map((day) => (
                  <div
                    key={day.date}
                    className={`w-[11px] h-[11px] rounded-[2px] ${levelToClass(day.contributionLevel)} cursor-pointer transition-transform hover:scale-125`}
                    onMouseEnter={(e) => handleMouseEnter(e, day)}
                    onMouseLeave={handleMouseLeave}
                    role="gridcell"
                    aria-label={`${day.contributionCount} contributions on ${day.date}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg text-sm pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-[var(--text-primary)] font-medium">
            {tooltip.count} contribution{tooltip.count !== 1 ? 's' : ''}
          </div>
          <div className="text-[var(--text-tertiary)] text-xs">{tooltip.date}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end mt-3 gap-2 text-xs text-[var(--text-tertiary)]">
        <span>Less</span>
        <div className="flex gap-[2px]">
          <div className="w-[11px] h-[11px] rounded-[2px] contrib-0" />
          <div className="w-[11px] h-[11px] rounded-[2px] contrib-1" />
          <div className="w-[11px] h-[11px] rounded-[2px] contrib-2" />
          <div className="w-[11px] h-[11px] rounded-[2px] contrib-3" />
          <div className="w-[11px] h-[11px] rounded-[2px] contrib-4" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
