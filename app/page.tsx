'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import CalendarHeatmap from './components/CalendarHeatmap';

interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: string;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

interface ContributionCalendar {
  totalContributions: number;
  weeks: ContributionWeek[];
}

interface YearData {
  year: number;
  total: number;
  calendar: ContributionCalendar;
}

interface MonthData {
  month: string;
  count: number;
}

interface MonthlyData {
  year: number;
  months: MonthData[];
}

interface Stats {
  totalContributions: number;
  averagePerYear: number;
  bestYear: { year: number; total: number };
  yearsActive: number;
}

interface ContributionData {
  username: string;
  years: YearData[];
  monthlyData: MonthlyData[];
  stats: Stats;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [years, setYears] = useState(8);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContributionData | null>(null);
  const [error, setError] = useState('');
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [calendarYear, setCalendarYear] = useState<number | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [areaChartStartYear, setAreaChartStartYear] = useState<number | null>(null);
  const [areaChartEndYear, setAreaChartEndYear] = useState<number | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('github-token');
    const savedUsername = localStorage.getItem('github-username');
    if (savedToken) setToken(savedToken);
    if (savedUsername) setUsername(savedUsername);
  }, []);

  const fetchData = async () => {
    if (!username || !token) {
      setError('Please enter both username and token');
      return;
    }

    setLoading(true);
    setError('');

    // Save to localStorage
    localStorage.setItem('github-token', token);
    localStorage.setItem('github-username', username);

    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token, years }),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        if (result.years.length > 0) {
          // Select the most recent year by default
          const mostRecentYear = result.years[result.years.length - 1].year;
          setSelectedYears([mostRecentYear]);
          setCalendarYear(mostRecentYear);
        }
      }
    } catch {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  // Get available years for the area chart (excluding current incomplete year)
  const availableAreaChartYears = data?.years
    .filter((y) => y.year < currentYear)
    .map((y) => y.year)
    .sort((a, b) => a - b) || [];

  // Filter year chart data based on selected range
  const yearChartData = data?.years
    .filter((y) => {
      if (y.year >= currentYear) return false; // Exclude incomplete current year
      const startYear = areaChartStartYear ?? availableAreaChartYears[0];
      const endYear = areaChartEndYear ?? availableAreaChartYears[availableAreaChartYears.length - 1];
      return y.year >= startYear && y.year <= endYear;
    })
    .map((y) => ({
      year: y.year.toString(),
      contributions: y.total,
    })) || [];

  // Colors for multi-year comparison (terminal-style greens and complementary colors)
  const yearColors = [
    '#00ff88', // terminal green
    '#00ccff', // cyan
    '#ff9500', // orange
    '#bf7fff', // purple
  ];

  // Build grouped bar chart data for multiple years
  const monthChartData = (() => {
    if (selectedYears.length === 0 || !data) return [];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return months.map((month) => {
      const entry: { month: string; [key: string]: string | number } = { month };

      selectedYears.forEach((year) => {
        const yearMonths = data.monthlyData.find((m) => m.year === year)?.months || [];
        const monthData = yearMonths.find((m) => m.month === month);
        entry[`year_${year}`] = monthData?.count || 0;
      });

      return entry;
    });
  })();

  // Toggle year selection (max 4 years)
  const toggleYear = (year: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        // Remove year (but keep at least one)
        const filtered = prev.filter((y) => y !== year);
        return filtered.length > 0 ? filtered : prev;
      } else {
        // Add year (max 4)
        if (prev.length >= 4) {
          return [...prev.slice(1), year]; // Remove oldest, add new
        }
        return [...prev, year].sort((a, b) => a - b);
      }
    });
  };

  return (
    <div className="min-h-screen p-8 relative">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--terminal-green) 1px, transparent 1px),
            linear-gradient(90deg, var(--terminal-green) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <header className="mb-12 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-4 text-[var(--text-tertiary)] text-sm">
              ~/github/contributions
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            <span className="text-[var(--terminal-green)] glow">$</span>{' '}
            <span className="text-[var(--text-primary)]">git</span>{' '}
            <span className="text-[var(--accent-orange)]">contributions</span>
            <span className="cursor-blink" />
          </h1>

          <p className="text-[var(--text-secondary)] text-lg mt-4">
            Visualize your GitHub journey across the years
          </p>
        </header>

        {/* Input Form */}
        {!data && (
          <div
            className="animate-fade-in p-8 rounded-lg mb-8"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              animationDelay: '0.1s',
            }}
          >
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  <span className="text-[var(--terminal-green)]">→</span> GitHub Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ledbetterljoshua"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-deep)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--terminal-green)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  <span className="text-[var(--terminal-green)]">→</span> Personal Access Token
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="ml-2 text-xs text-[var(--accent-blue)] hover:underline"
                  >
                    {showToken ? 'hide' : 'show'}
                  </button>
                </label>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-deep)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--terminal-green)] transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  <span className="text-[var(--terminal-green)]">→</span> Years to fetch
                </label>
                <select
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="px-4 py-3 rounded-lg bg-[var(--bg-deep)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--terminal-green)]"
                >
                  {[3, 5, 8, 10, 12, 15].map((y) => (
                    <option key={y} value={y}>
                      {y} years
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-[var(--accent-orange)] mb-4">
                <span className="text-red-500">ERROR:</span> {error}
              </p>
            )}

            <button
              onClick={fetchData}
              disabled={loading}
              className="px-8 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                background: 'var(--terminal-green)',
                color: 'var(--bg-deep)',
              }}
            >
              {loading ? 'Fetching...' : '$ fetch --contributions'}
            </button>

            <p className="text-xs text-[var(--text-tertiary)] mt-4">
              Need a token?{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=read:user"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-blue)] hover:underline"
              >
                Generate one here
              </a>{' '}
              (only needs <code className="text-[var(--terminal-green)]">read:user</code> scope)
            </p>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            >
              <StatCard
                label="Total Contributions"
                value={data.stats.totalContributions.toLocaleString()}
                color="var(--terminal-green)"
              />
              <StatCard
                label="Years Active"
                value={data.stats.yearsActive.toString()}
                color="var(--accent-blue)"
              />
              <StatCard
                label="Avg per Year"
                value={data.stats.averagePerYear.toLocaleString()}
                color="var(--accent-orange)"
              />
              <StatCard
                label="Best Year"
                value={`${data.stats.bestYear.year}`}
                subvalue={`${data.stats.bestYear.total.toLocaleString()} commits`}
                color="var(--contribution-max)"
              />
            </div>

            {/* Honest Framing Section */}
            <HonestFraming />

            {/* Yearly Trend Chart */}
            <div
              className="p-6 rounded-lg animate-fade-in"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                animationDelay: '0.2s',
              }}
            >
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <span className="text-[var(--terminal-green)]">▸</span>
                  Contributions Over Time
                </h2>

                {availableAreaChartYears.length > 1 && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-tertiary)]">From:</span>
                      <div className="flex gap-1 flex-wrap">
                        {availableAreaChartYears.map((year) => {
                          const effectiveEndYear = areaChartEndYear ?? availableAreaChartYears[availableAreaChartYears.length - 1];
                          const isDisabled = year > effectiveEndYear;
                          const isSelected = (areaChartStartYear ?? availableAreaChartYears[0]) === year;
                          return (
                            <button
                              key={`start-${year}`}
                              onClick={() => setAreaChartStartYear(year)}
                              disabled={isDisabled}
                              className={`px-2 py-0.5 rounded text-xs transition-all ${
                                isSelected
                                  ? 'bg-[var(--terminal-green)] text-[var(--bg-deep)]'
                                  : isDisabled
                                  ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {year}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-tertiary)]">To:</span>
                      <div className="flex gap-1 flex-wrap">
                        {availableAreaChartYears.map((year) => {
                          const effectiveStartYear = areaChartStartYear ?? availableAreaChartYears[0];
                          const isDisabled = year < effectiveStartYear;
                          const isSelected = (areaChartEndYear ?? availableAreaChartYears[availableAreaChartYears.length - 1]) === year;
                          return (
                            <button
                              key={`end-${year}`}
                              onClick={() => setAreaChartEndYear(year)}
                              disabled={isDisabled}
                              className={`px-2 py-0.5 rounded text-xs transition-all ${
                                isSelected
                                  ? 'bg-[var(--terminal-green)] text-[var(--bg-deep)]'
                                  : isDisabled
                                  ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {year}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearChartData}>
                    <defs>
                      <linearGradient id="colorContrib" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="year"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#888', fontSize: 12 }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#12131a',
                        border: '1px solid #2a2d38',
                        borderRadius: '8px',
                        color: '#e8e8e8',
                      }}
                      formatter={(value) => [Number(value).toLocaleString(), 'Contributions']}
                    />
                    <Area
                      type="monotone"
                      dataKey="contributions"
                      stroke="#00ff88"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorContrib)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Year Selector + Monthly Breakdown */}
            <div
              className="p-6 rounded-lg animate-fade-in"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                animationDelay: '0.3s',
              }}
            >
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <span className="text-[var(--terminal-green)]">▸</span>
                  Monthly Breakdown
                </h2>

                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    Select up to 4 years:
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {data.years.map((y) => {
                      const isSelected = selectedYears.includes(y.year);
                      const colorIndex = selectedYears.indexOf(y.year);
                      return (
                        <button
                          key={y.year}
                          onClick={() => toggleYear(y.year)}
                          className={`px-3 py-1 rounded text-sm transition-all border ${
                            isSelected
                              ? 'text-[var(--bg-deep)] border-transparent'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]'
                          }`}
                          style={isSelected ? { backgroundColor: yearColors[colorIndex] } : {}}
                        >
                          {y.year}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthChartData} barCategoryGap="15%">
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#888', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#888', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#12131a',
                        border: '1px solid #2a2d38',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#e8e8e8' }}
                      formatter={(value, name) => {
                        const year = String(name).replace('year_', '');
                        return [Number(value).toLocaleString(), year];
                      }}
                    />
                    {selectedYears.length > 1 && (
                      <Legend
                        formatter={(value: string) => value.replace('year_', '')}
                        wrapperStyle={{ paddingTop: '10px' }}
                        iconType="square"
                      />
                    )}
                    {selectedYears.map((year, index) => (
                      <Bar
                        key={year}
                        dataKey={`year_${year}`}
                        fill={yearColors[index]}
                        radius={[2, 2, 0, 0]}
                        name={`year_${year}`}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Calendar Heatmap - independent year selector */}
            {calendarYear && (
              <div
                className="p-6 rounded-lg animate-fade-in"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  animationDelay: '0.4s',
                }}
              >
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h2 className="text-lg font-medium flex items-center gap-2">
                    <span className="text-[var(--terminal-green)]">▸</span>
                    Contribution Calendar
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    {data.years.map((y) => (
                      <button
                        key={y.year}
                        onClick={() => setCalendarYear(y.year)}
                        className={`px-3 py-1 rounded text-sm transition-all ${
                          calendarYear === y.year
                            ? 'bg-[var(--terminal-green)] text-[var(--bg-deep)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {y.year}
                      </button>
                    ))}
                  </div>
                </div>

                <CalendarHeatmap
                  weeks={data.years.find((y) => y.year === calendarYear)?.calendar.weeks || []}
                />
              </div>
            )}

            {/* Reset Button */}
            <div className="text-center">
              <button
                onClick={() => setData(null)}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--terminal-green)] transition-colors"
              >
                ← fetch different user
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[var(--border)] text-center text-sm text-[var(--text-tertiary)]">
          <p>
            Built with{' '}
            <span className="text-[var(--terminal-green)]">Next.js</span> +{' '}
            <span className="text-[var(--accent-blue)]">Recharts</span> +{' '}
            <span className="text-[var(--accent-orange)]">GitHub GraphQL API</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subvalue,
  color,
}: {
  label: string;
  value: string;
  subvalue?: string;
  color: string;
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="text-xs text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      {subvalue && (
        <div className="text-xs text-[var(--text-secondary)] mt-1">{subvalue}</div>
      )}
    </div>
  );
}

function HonestFraming() {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  return (
    <div
      className="rounded-lg animate-fade-in overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        animationDelay: '0.15s',
      }}
    >
      <button
        onClick={toggle}
        className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-[var(--bg-elevated)] transition-colors"
        aria-expanded={isExpanded}
      >
        <span
          className="text-[var(--terminal-green)] transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▸
        </span>
        <span className="text-[var(--text-secondary)]">
          <span className="text-[var(--accent-orange)]">?</span>{' '}
          What this data actually shows
        </span>
        <span className="text-[var(--text-tertiary)] text-sm ml-auto">
          {isExpanded ? 'collapse' : 'expand'}
        </span>
      </button>

      {isExpanded && (
        <div
          className="px-6 pb-5 pt-2 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--terminal-green)] mt-0.5">→</span>
              <span>
                <strong className="text-[var(--text-primary)]">Activity, not achievement.</strong>{' '}
                Contribution count measures how often you pushed code, not how good it was.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--terminal-green)] mt-0.5">→</span>
              <span>
                <strong className="text-[var(--text-primary)]">Private repos are invisible.</strong>{' '}
                ~81% of professional dev work happens in private repositories that don&apos;t show here.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--terminal-green)] mt-0.5">→</span>
              <span>
                <strong className="text-[var(--text-primary)]">Squash merges hide work.</strong>{' '}
                A 50-commit PR becomes 1 contribution when squash-merged.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--terminal-green)] mt-0.5">→</span>
              <span>
                <strong className="text-[var(--text-primary)]">Invisible labor.</strong>{' '}
                Code reviews, mentoring, architecture discussions, and planning don&apos;t appear.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--terminal-green)] mt-0.5">→</span>
              <span>
                <strong className="text-[var(--text-primary)]">Streaks aren&apos;t healthy.</strong>{' '}
                The graph gamifies daily commits. Taking breaks is good, actually.
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
