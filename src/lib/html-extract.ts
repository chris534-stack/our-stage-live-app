'use server';

import { load, type CheerioAPI } from 'cheerio';
import { format, isValid, parse, parseISO, startOfToday } from 'date-fns';
import { getAllVenues } from '@/lib/data';
import type { ScrapeEventDetailsOutput } from '@/ai/flows/scrape-event-details';

// Normalize strings for venue matching
function normalize(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tryJSONParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    // Some sites embed invalid JSON-LD (e.g. unescaped line breaks). Try a mild cleanup.
    try {
      const cleaned = text
        .replace(/\n|\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function collectJsonLdObjects($: CheerioAPI): any[] {
  const out: any[] = [];
  $('script[type="application/ld+json"]').each((_: number, el: unknown) => {
    const raw = $(el as any).contents().text();
    if (!raw) return;
    const json = tryJSONParse(raw);
    if (!json) return;

    const pushNode = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(pushNode);
      } else if (node['@graph']) {
        pushNode(node['@graph']);
      } else {
        out.push(node);
      }
    };

    pushNode(json);
  });
  return out;
}

function hasEventType(node: any): boolean {
  const t = node?.['@type'] ?? node?.type;
  if (!t) return false;
  if (Array.isArray(t)) {
    return t.some((v) => typeof v === 'string' && /event/i.test(v));
  }
  if (typeof t === 'string') return /event/i.test(t);
  return false;
}

function walkNodes(node: any, acc: any[] = []): any[] {
  if (!node) return acc;
  if (typeof node !== 'object') return acc;
  if (hasEventType(node)) acc.push(node);
  for (const key of Object.keys(node)) {
    const v = (node as any)[key];
    if (v && typeof v === 'object') {
      walkNodes(v, acc);
    }
  }
  return acc;
}

function toDateOccurrence(dateStr: string): { date: string; time?: string } | null {
  if (!dateStr) return null;
  // ISO or RFC
  let d: Date | null = null;
  try {
    d = parseISO(dateStr);
    if (!isValid(d)) d = null;
  } catch {
    d = null;
  }
  // Common non-ISO fallbacks
  if (!d) {
    const fmts = [
      'MMMM d, yyyy h:mm a',
      'MMMM d, yyyy',
      'MMM d, yyyy h:mm a',
      'MMM d, yyyy',
      'M/d/yyyy h:mm a',
      'M/d/yyyy',
      'M/d/yy',
      'yyyy-MM-dd',
    ];
    for (const f of fmts) {
      try {
        const parsed = parse(dateStr, f, new Date());
        if (isValid(parsed)) {
          d = parsed;
          break;
        }
      } catch {
        // ignore
      }
    }
  }
  if (!d || !isValid(d)) return null;

  const date = format(d, 'yyyy-MM-dd');
  const timePart = /T|\d{1,2}:\d{2}/.test(dateStr) ? format(d, 'HH:mm') : undefined;
  if (timePart === '00:00') return { date };
  return { date, time: timePart };
}

function collectStartDates(node: any): string[] {
  const dates: string[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (n.startDate && typeof n.startDate === 'string') dates.push(n.startDate);
    if (Array.isArray(n.subEvent)) {
      n.subEvent.forEach(visit);
    }
    if (Array.isArray(n.eventSchedule)) {
      n.eventSchedule.forEach(visit);
    } else if (n.eventSchedule && typeof n.eventSchedule === 'object') {
      visit(n.eventSchedule);
    }
    if (Array.isArray(n.event)) {
      n.event.forEach(visit);
    } else if (n.event && typeof n.event === 'object') {
      visit(n.event);
    }
    for (const k of Object.keys(n)) {
      const v = (n as any)[k];
      if (v && typeof v === 'object') visit(v);
    }
  };
  visit(node);
  return dates;
}

function pickTitle($: CheerioAPI): string | undefined {
  const og = $('meta[property="og:title"]').attr('content');
  if (og) return og.trim();
  const tw = $('meta[name="twitter:title"]').attr('content');
  if (tw) return tw.trim();
  const h1 = $('h1').first().text();
  if (h1) return h1.trim();
  const title = $('title').first().text();
  if (title) return title.trim();
  return undefined;
}

function pickDescription($: CheerioAPI): string | undefined {
  const og = $('meta[property="og:description"]').attr('content');
  if (og) return og.trim();
  const md = $('meta[name="description"]').attr('content');
  if (md) return md.trim();
  // Try the first paragraph if nothing else
  const p = $('main p, article p, .content p, p').first().text();
  if (p) return p.trim();
  return undefined;
}

async function matchVenueName(candidate: string | undefined | null): Promise<string | null> {
  if (!candidate) return null;
  const normalizedCandidate = normalize(candidate);
  try {
    const venues = await getAllVenues();
    for (const v of venues) {
      const n = normalize(v.name);
      if (!n) continue;
      if (n === normalizedCandidate) {
        // Return the exact case-sensitive name as stored in Firestore
        return v.name;
      }
    }
    // No exact match found
    return null;
  } catch {
    return null;
  }
}

export async function extractEventFromUrl(url: string): Promise<ScrapeEventDetailsOutput | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OurStageScraper/1.0; +https://ourstage.live)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cache: 'no-cache',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (${res.status})`);
  }
  const html = await res.text();
  const $ = load(html);

  // 1) Try JSON-LD first
  const jsonLd = collectJsonLdObjects($);
  const eventNodes = jsonLd.flatMap((n) => walkNodes(n, []));

  const today = startOfToday();
  const occurrences: { date: string; time?: string }[] = [];
  let title: string | undefined;
  let description: string | undefined;
  let venueCandidate: string | undefined;

  if (eventNodes.length > 0) {
    // Pick the node with the most upcoming startDates
    let bestNode: any | null = null;
    let bestCount = -1;
    for (const node of eventNodes) {
      const startDates = collectStartDates(node)
        .map(toDateOccurrence)
        .filter((o): o is { date: string; time?: string } => !!o)
        .filter((o) => {
          // Only future dates
          try {
            const d = parseISO(o.date);
            return d >= today;
          } catch {
            return false;
          }
        });
      if (startDates.length > bestCount) {
        bestNode = node;
        bestCount = startDates.length;
      }
    }

    if (bestNode) {
      const startDates = collectStartDates(bestNode)
        .map(toDateOccurrence)
        .filter((o): o is { date: string; time?: string } => !!o)
        .filter((o) => {
          try {
            const d = parseISO(o.date);
            return d >= today;
          } catch {
            return false;
          }
        });

      // Deduplicate by date+time
      const keySet = new Set<string>();
      for (const o of startDates) {
        const key = `${o.date}|${o.time ?? ''}`;
        if (!keySet.has(key)) {
          keySet.add(key);
          occurrences.push(o);
        }
      }

      title = bestNode.name || bestNode.headline || pickTitle($);
      description = bestNode.description || pickDescription($);

      const loc = bestNode.location;
      if (loc) {
        if (typeof loc === 'string') venueCandidate = loc;
        else if (Array.isArray(loc)) {
          const first = loc.find((l) => l && (l.name || l['@type']));
          venueCandidate = first?.name || undefined;
        } else if (typeof loc === 'object') {
          venueCandidate = loc.name || loc.venue || undefined;
        }
      }
    }
  }

  // 2) Fallbacks if JSON-LD was empty or partial
  if (!title) title = pickTitle($);
  if (!description) description = pickDescription($);

  if (!venueCandidate) {
    const siteName = $('meta[property="og:site_name"]').attr('content');
    if (siteName) venueCandidate = siteName;
    // Also try to find common venue label elements
    const venueText = $('[itemprop="location"], .venue, .event-venue, .location, .event-location').first().text();
    if (venueText && !venueCandidate) venueCandidate = venueText;
  }

  const matchedVenue = await matchVenueName(venueCandidate);

  // 3) If still no occurrences, try minimal regex-based date extraction
  if (occurrences.length === 0) {
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    // ISO dates like 2025-06-14
    const isoMatches: string[] = [];
    for (const m of bodyText.matchAll(/(\d{4}-\d{2}-\d{2})/g)) {
      isoMatches.push((m as RegExpMatchArray)[1]);
    }

    // Month Day, Year e.g., June 5, 2025 or Jun 5, 2025
    const monthNames = '(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';
    const longDateRe = new RegExp(`${monthNames}\\s+\\d{1,2},?\\s+\\d{4}`, 'gi');
    const longMatches: string[] = [];
    for (const m of bodyText.matchAll(longDateRe)) {
      longMatches.push((m as RegExpMatchArray)[0]);
    }

    const rawDates = [...isoMatches, ...longMatches];
    const uniq = new Set<string>();
    for (const rd of rawDates) {
      const occ = toDateOccurrence(rd);
      if (!occ) continue;
      // Only future
      try {
        const d = parseISO(occ.date);
        if (d < today) continue;
      } catch {
        continue;
      }
      const key = `${occ.date}|${occ.time ?? ''}`;
      if (!uniq.has(key)) {
        uniq.add(key);
        occurrences.push(occ);
      }
    }
  }

  if (!title && !description && occurrences.length === 0 && !matchedVenue) {
    // Nothing useful extracted
    return null;
  }

  const result: ScrapeEventDetailsOutput = {
    title: title || undefined,
    occurrences: occurrences.length ? occurrences : undefined,
    venue: matchedVenue ?? null,
    description: description || undefined,
    // tags left undefined; could derive from page keywords in future
  };

  return result;
}
