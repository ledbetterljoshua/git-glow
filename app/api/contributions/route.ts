import { NextRequest, NextResponse } from 'next/server';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

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

interface YearContributions {
  year: number;
  total: number;
  calendar: ContributionCalendar;
}

interface FetchError {
  year: number;
  error: string;
}

interface FetchResult {
  year: number;
  calendar: ContributionCalendar | null;
  error?: string;
}

async function fetchYearContributions(
  username: string,
  token: string,
  year: number,
  from: string,
  to: string
): Promise<FetchResult> {
  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { username, from, to },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        year,
        calendar: null,
        error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`,
      };
    }

    const data = await response.json();

    if (data.errors) {
      const errorMessage = data.errors
        .map((e: { message: string }) => e.message)
        .join('; ');
      console.error(`GraphQL errors for year ${year}:`, data.errors);
      return {
        year,
        calendar: null,
        error: errorMessage,
      };
    }

    const calendar = data.data?.user?.contributionsCollection?.contributionCalendar || null;

    if (!calendar) {
      return {
        year,
        calendar: null,
        error: 'No contribution data returned (user may not exist or have no contributions)',
      };
    }

    return { year, calendar };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching contributions for year ${year}:`, error);
    return {
      year,
      calendar: null,
      error: errorMessage,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, token, years } = await request.json();

    if (!username || !token) {
      return NextResponse.json(
        { error: 'Username and token are required' },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const yearsToFetch = years || 5;

    // Build array of year fetch promises
    const fetchPromises: Promise<FetchResult>[] = [];
    for (let i = 0; i < yearsToFetch; i++) {
      const year = currentYear - i;
      const from = `${year}-01-01T00:00:00Z`;
      const to = `${year}-12-31T23:59:59Z`;
      fetchPromises.push(fetchYearContributions(username, token, year, from, to));
    }

    // Fetch all years in parallel
    const fetchResults = await Promise.all(fetchPromises);

    // Separate successful results from errors
    const results: YearContributions[] = [];
    const errors: FetchError[] = [];

    for (const result of fetchResults) {
      if (result.calendar) {
        results.push({
          year: result.year,
          total: result.calendar.totalContributions,
          calendar: result.calendar,
        });
      } else if (result.error) {
        errors.push({
          year: result.year,
          error: result.error,
        });
      }
    }

    // Sort by year ascending
    results.sort((a, b) => a.year - b.year);

    // Handle edge case where all years failed
    if (results.length === 0) {
      return NextResponse.json({
        username,
        years: [],
        monthlyData: [],
        stats: {
          totalContributions: 0,
          averagePerYear: 0,
          bestYear: { year: currentYear, total: 0 },
          yearsActive: 0,
        },
        warnings: errors.length > 0 ? errors : [{ year: currentYear, error: 'No contribution data could be fetched' }],
      });
    }

    // Calculate some stats
    const totalContributions = results.reduce((sum, y) => sum + y.total, 0);
    const averagePerYear = Math.round(totalContributions / results.length);

    // Find best year
    const bestYear = results.reduce((best, curr) =>
      curr.total > best.total ? curr : best
    );

    // Calculate monthly data for each year
    const monthlyData = results.map(yearData => {
      const months: { month: string; count: number }[] = [];
      const monthCounts: { [key: string]: number } = {};

      yearData.calendar.weeks.forEach(week => {
        week.contributionDays.forEach(day => {
          const date = new Date(day.date);
          const monthKey = date.toLocaleDateString('en-US', { month: 'short' });

          if (!monthCounts[monthKey]) {
            monthCounts[monthKey] = 0;
          }
          monthCounts[monthKey] += day.contributionCount;
        });
      });

      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthOrder.forEach(month => {
        months.push({
          month,
          count: monthCounts[month] || 0,
        });
      });

      return {
        year: yearData.year,
        months,
      };
    });

    // Build response with backward-compatible structure
    const response: {
      username: string;
      years: YearContributions[];
      monthlyData: { year: number; months: { month: string; count: number }[] }[];
      stats: {
        totalContributions: number;
        averagePerYear: number;
        bestYear: { year: number; total: number };
        yearsActive: number;
      };
      warnings?: FetchError[];
    } = {
      username,
      years: results,
      monthlyData,
      stats: {
        totalContributions,
        averagePerYear,
        bestYear: {
          year: bestYear.year,
          total: bestYear.total,
        },
        yearsActive: results.length,
      },
    };

    // Include warnings if any years failed to fetch
    if (errors.length > 0) {
      response.warnings = errors;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}
