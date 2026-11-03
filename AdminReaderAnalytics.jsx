import { useEffect, useMemo, useState } from 'react';
import { fetchCloudflareReaderAnalytics } from './engagement';
import './admin-reader-analytics.css';

const WINDOWS = [
  { value: 1, label: 'Last 24 hours' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const count = value => number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const percentage = value => number(value).toFixed(1) + '%';
const languageName = value => value === 'en' ? 'English' : value === 'hi' ? 'Hindi' : 'Unknown';
const chapterLabel = (stat, chapter) => {
  const n = chapter?.chapterNumber ?? stat.chapter_number;
  const title = chapter?.title ? ' · ' + chapter.title : '';
  return n == null || String(n).trim() === '' ? 'Special chapter' + title : 'Chapter ' + n + title;
};
const duration = value => {
  if (value == null || !Number.isFinite(Number(value))) return 'Not available';
  const seconds = Math.max(0, Math.round(Number(value)));
  if (seconds < 60) return seconds + ' sec';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes + ' min' + (remainder ? ' ' + remainder + ' sec' : '');
};

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Metric({ label, value, detail }) {
  return <article className="ar-reader-metric">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function Empty({ children }) {
  return <div className="ar-reader-empty">{children}</div>;
}

function Bar({ value, max, className = '' }) {
  const width = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return <div className="ar-reader-bar"><i className={className} style={{ width: width + '%' }}/></div>;
}

export default function AdminReaderAnalytics({ chapters = [], pageCounts = {} }) {
  const [days, setDays] = useState(30);
  const [language, setLanguage] = useState('all');
  const [selectedChapterId, setSelectedChapterId] = useState('all');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const hasPrevious = Boolean(payload);
    if (hasPrevious) setRefreshing(true);
    else setLoading(true);
    setError('');
    fetchCloudflareReaderAnalytics(days)
      .then(result => {
        if (!active) return;
        setPayload(result);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(loadError => {
        if (!active) return;
        setError(loadError?.message || 'Reader analytics could not be loaded.');
        setLoading(false);
        setRefreshing(false);
      });
    return () => { active = false; };
  }, [days, refreshVersion]);

  const chapterById = useMemo(() => new Map(chapters.map(chapter => [String(chapter.id), chapter])), [chapters]);
  const measuredRows = Array.isArray(payload?.chapters) ? payload.chapters : [];
  const allRows = useMemo(() => {
    const measuredById = new Map(measuredRows.map(row => [String(row.chapter_id), row]));
    return chapters.map(chapter => measuredById.get(String(chapter.id)) || {
      chapter_id: String(chapter.id),
      chapter_number: chapter.chapterNumber ?? null,
      language: chapter.language === 'en' ? 'en' : 'hi',
      sessions: 0,
      readers: 0,
      completed_sessions: 0,
      explicit_exits: 0,
      unconfirmed_exits: 0,
      next_chapter_clicks: 0,
      previous_chapter_clicks: 0,
      chapter_list_exits: 0,
      page_exit_events: 0,
      pages_read: 0,
      average_pages_read: 0,
      average_completion_percent: 0,
      average_reading_seconds: null,
      exit_reasons: {},
      page_stats: Array.from({ length: Math.max(0, Math.min(500, number(pageCounts[chapter.id]))) }, (_, index) => ({
        page_number: index + 1,
        sessions_reached: 0,
        readers_reached: 0,
        exits_after_page: 0,
        exit_readers: 0,
      })),
    });
  }, [measuredRows, chapters]);
  const rows = useMemo(() => allRows
    .filter(row => language === 'all' || row.language === language)
    .filter(row => selectedChapterId === 'all' || String(row.chapter_id) === selectedChapterId)
    .map(row => ({ ...row, chapter: chapterById.get(String(row.chapter_id)) }))
    .sort((a, b) => {
      const bySessions = number(b.sessions) - number(a.sessions);
      return bySessions || number(a.chapter_number ?? 9999) - number(b.chapter_number ?? 9999);
    }), [allRows, language, selectedChapterId, chapterById]);

  const selectedRow = rows.length === 1 && selectedChapterId !== 'all'
    ? rows[0]
    : rows.find(row => String(row.chapter_id) === selectedChapterId) || null;
  const summary = payload?.summary || {};
  const daily = Array.isArray(payload?.daily_trend) ? payload.daily_trend : [];
  const readerDepth = Array.isArray(payload?.reader_depth) ? payload.reader_depth : [];
  const maxDaily = Math.max(1, ...daily.map(row => number(row.sessions)));
  const maxDepth = Math.max(1, ...readerDepth.map(row => number(row.readers)));
  const hasData = Boolean(payload?.has_data);
  const exitReasons = [
    ['Opened another chapter', number(summary.next_chapter_clicks)],
    ['Returned to chapter list', number(summary.chapter_list_exits)],
    ['Opened previous chapter', number(summary.previous_chapter_clicks)],
    ['Left the page or closed the tab', number(summary.page_exit_events)],
    ['Other navigation away from the reader', number(summary.navigation_exits)],
  ];

  const exportCsv = () => {
    const exportRows = [
      ['Atma Rekha reader journey analytics'],
      ['Reporting window', days + ' days'],
      ['Language filter', language],
      ['Chapter filter', selectedChapterId === 'all' ? 'All chapters' : chapterLabel(rows.find(row => String(row.chapter_id) === selectedChapterId) || {}, chapterById.get(selectedChapterId))],
      ['Updated at', payload?.updated_at || ''],
      [],
      ['Chapter', 'Language', 'Unique browsers', 'Sessions', 'Completed sessions', 'Completion rate', 'Recorded exits', 'No end signal', 'Average pages read', 'Average completion', 'Average reading time seconds', 'Next chapter clicks', 'Chapter list exits', 'Page exit events'],
    ];
    for (const row of rows) {
      exportRows.push([
        chapterLabel(row, row.chapter),
        languageName(row.language),
        row.readers,
        row.sessions,
        row.completed_sessions,
        percentage(number(row.sessions) ? number(row.completed_sessions) / number(row.sessions) * 100 : 0),
        row.explicit_exits,
        row.unconfirmed_exits,
        number(row.average_pages_read).toFixed(2),
        percentage(row.average_completion_percent),
        row.average_reading_seconds == null ? '' : Math.round(row.average_reading_seconds),
        row.next_chapter_clicks,
        row.chapter_list_exits,
        row.page_exit_events,
      ]);
      exportRows.push(['Page breakdown for ' + chapterLabel(row, row.chapter)]);
      exportRows.push(['Page', 'Sessions reaching page', 'Unique browsers reaching page', 'Exits recorded at page']);
      for (const page of row.page_stats || []) {
        exportRows.push([page.page_number, page.sessions_reached, page.readers_reached, page.exits_after_page]);
      }
    }
    downloadCsv('atma-rekha-reader-analytics-' + days + 'd.csv', exportRows);
  };

  if (loading && !payload) return <section className="ar-reader-analytics"><Empty>Loading reader analytics…</Empty></section>;

  return <section className="ar-reader-analytics">
    <header className="ar-reader-header">
      <div>
        <span className="ar-reader-eyebrow">ATMA REKHA · AUDIENCE INSIGHTS</span>
        <h2>Reader analytics</h2>
        <p>Understand how readers move through chapters, which pages hold their attention, and where reading sessions end.</p>
        <div className="ar-reader-updated">
          <span className={error ? 'is-error' : 'is-live'}/>
          {error ? 'Refresh failed' : payload?.updated_at ? 'Updated ' + new Date(payload.updated_at).toLocaleString('en-IN') : 'Waiting for journey events'}
          {refreshing ? ' · Refreshing' : ''}
        </div>
      </div>
      <div className="ar-reader-actions">
        <label>Reporting window
          <select value={days} onChange={event => setDays(Number(event.target.value))}>
            {WINDOWS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setRefreshVersion(value => value + 1)} disabled={refreshing}>Refresh data</button>
        <button type="button" className="is-primary" onClick={exportCsv} disabled={!hasData}>Export CSV</button>
      </div>
    </header>

    {error && <div className="ar-reader-alert" role="alert">
      <strong>Reader analytics unavailable</strong>
      <span>{error}</span>
      <button type="button" onClick={() => setRefreshVersion(value => value + 1)}>Try again</button>
    </div>}

    <div className="ar-reader-filter-row">
      <label>Language
        <select value={language} onChange={event => { setLanguage(event.target.value); setSelectedChapterId('all'); }}>
          <option value="all">All languages</option>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>
      </label>
      <label>Chapter
        <select value={selectedChapterId} onChange={event => setSelectedChapterId(event.target.value)}>
          <option value="all">All chapters</option>
          {allRows.filter(row => language === 'all' || row.language === language)
            .sort((a, b) => number(a.chapter_number ?? 9999) - number(b.chapter_number ?? 9999))
            .map(row => <option key={row.chapter_id} value={String(row.chapter_id)}>
              {chapterLabel(row, chapterById.get(String(row.chapter_id))) + ' · ' + languageName(row.language)}
            </option>)}
        </select>
      </label>
      <span className="ar-reader-filter-note">{rows.length.toLocaleString('en-IN')} chapter{rows.length === 1 ? '' : 's'} in this view</span>
    </div>

    <p className="ar-reader-scope-note">Summary totals below cover the full selected reporting window across all chapters and languages. The filters apply to the chapter table and page detail.</p>

    <div className="ar-reader-metrics">
      <Metric label="Unique readers" value={count(summary.unique_readers)} detail="Anonymous browser identifiers, not verified people"/>
      <Metric label="Reading sessions" value={count(summary.sessions)} detail="A new session each time a chapter is opened"/>
      <Metric label="Completed chapters" value={count(summary.completed_sessions)} detail={percentage(summary.completion_rate) + ' of recorded sessions'}/>
      <Metric label="Recorded exits" value={count(summary.explicit_exits)} detail="Exit event received before completion"/>
      <Metric label="No end signal" value={count(summary.unconfirmed_exits)} detail="No completion or exit event was received"/>
      <Metric label="Next chapter clicks" value={count(summary.next_chapter_clicks)} detail="Reader used the next chapter control"/>
      <Metric label="Pages read" value={count(summary.pages_read)} detail="Page loaded and remained visible for at least 2 seconds"/>
      <Metric label="Average completion" value={percentage(summary.average_completion_percent)} detail={duration(summary.average_reading_seconds) + ' average ended-session duration'}/>
    </div>

    {!hasData && !error && <div className="ar-reader-empty-state">
      <strong>No reading journeys recorded in this period yet.</strong>
      <p>Journey tracking starts with this release. Existing chapter view totals are not converted into page-level reading history.</p>
    </div>}

    <div className="ar-reader-grid">
      <section className="ar-reader-card">
        <div className="ar-reader-card-heading"><div><span>SESSION ACTIVITY</span><h3>Reading sessions over time</h3></div><small>UTC dates</small></div>
        {daily.length ? <div className="ar-reader-trend" style={{ gridTemplateColumns: `repeat(${Math.max(1, daily.length)}, minmax(0, 1fr))` }}>
          {daily.map(row => <div className="ar-reader-trend-day" key={row.day} title={row.day + ': ' + count(row.sessions) + ' sessions, ' + count(row.completed) + ' completed, ' + count(row.exits) + ' exits'}>
            <div className="ar-reader-trend-bars">
              <i style={{ height: Math.max(row.sessions ? 3 : 0, number(row.sessions) / maxDaily * 100) + '%' }}/>
              <b style={{ height: Math.max(row.completed ? 3 : 0, number(row.completed) / maxDaily * 100) + '%' }}/>
            </div>
            <small>{daily.length <= 14 || row.day.endsWith('-01') || row.day === daily[daily.length - 1]?.day ? row.day.slice(8, 10) : ''}</small>
          </div>)}
        </div> : <Empty>No daily session data is available.</Empty>}
        <div className="ar-reader-legend"><span><i/>Sessions started</span><span><i className="is-completed"/>Completed</span></div>
      </section>

      <section className="ar-reader-card">
        <div className="ar-reader-card-heading"><div><span>READER DEPTH</span><h3>Chapters read per browser</h3></div></div>
        {readerDepth.length ? <div className="ar-reader-depth">
          {readerDepth.map(row => <div className="ar-reader-depth-row" key={row.chapters_read}>
            <span>{row.chapters_read} {row.chapters_read === '1' ? 'chapter' : 'chapters'}</span>
            <Bar value={number(row.readers)} max={maxDepth}/>
            <strong>{count(row.readers)}</strong>
          </div>)}
        </div> : <Empty>No reader depth data is available.</Empty>}
      </section>
    </div>

    <section className="ar-reader-card">
      <div className="ar-reader-card-heading">
        <div><span>CONTENT PERFORMANCE</span><h3>Chapter reading breakdown</h3><p>Compare starts, unique browsers, completion and where sessions end.</p></div>
        <small>{rows.length} chapters</small>
      </div>
      {rows.length ? <div className="ar-reader-table-wrap">
        <table className="ar-reader-table">
          <thead><tr>
            <th>Chapter</th><th>Language</th><th>Readers</th><th>Sessions</th><th>Completed</th><th>Completion</th><th>Exits</th><th>Avg. pages</th><th>Avg. read time</th>
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.chapter_id} className={selectedChapterId === String(row.chapter_id) ? 'is-selected' : ''}>
            <td><button type="button" className="ar-reader-link" onClick={() => setSelectedChapterId(String(row.chapter_id))}>{chapterLabel(row, row.chapter)}</button></td>
            <td>{languageName(row.language)}</td>
            <td>{count(row.readers)}</td>
            <td>{count(row.sessions)}</td>
            <td>{count(row.completed_sessions)}</td>
            <td><div className="ar-reader-rate"><Bar value={number(row.average_completion_percent)} max={100}/><strong>{percentage(row.average_completion_percent)}</strong></div></td>
            <td>{count(row.explicit_exits)}</td>
            <td>{number(row.average_pages_read).toFixed(1)}</td>
            <td>{duration(row.average_reading_seconds)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <Empty>No chapter journey records match these filters.</Empty>}
    </section>

    <section className="ar-reader-grid ar-reader-detail-grid">
      <section className="ar-reader-card">
        <div className="ar-reader-card-heading">
          <div><span>PAGE-LEVEL RETENTION</span><h3>{selectedRow ? chapterLabel(selectedRow, selectedRow.chapter) : 'Choose a chapter'}</h3><p>Readers who stayed on a loaded page for at least two seconds.</p></div>
        </div>
        {selectedRow ? <>
          <div className="ar-reader-page-summary">
            <span><small>Average pages read</small><strong>{number(selectedRow.average_pages_read).toFixed(1)}</strong></span>
            <span><small>Average completion</small><strong>{percentage(selectedRow.average_completion_percent)}</strong></span>
            <span><small>Unconfirmed ends</small><strong>{count(selectedRow.unconfirmed_exits)}</strong></span>
          </div>
          {(selectedRow.page_stats || []).length ? <div className="ar-reader-page-list">
            {selectedRow.page_stats.map(page => <div className="ar-reader-page-row" key={page.page_number}>
              <strong>Page {page.page_number}</strong>
              <div className="ar-reader-page-reach">
                <Bar value={number(page.readers_reached)} max={Math.max(1, number(selectedRow.readers))}/>
                <span>{count(page.readers_reached)} readers</span>
              </div>
              <small>{count(page.exits_after_page)} exit signals at this page</small>
            </div>)}
          </div> : <Empty>No page-level records for this chapter yet.</Empty>}
        </> : <Empty>Select a chapter in the filter or table to inspect its page-by-page retention.</Empty>}
      </section>

      <section className="ar-reader-card">
        <div className="ar-reader-card-heading"><div><span>EXIT ANALYSIS</span><h3>How reading sessions ended</h3><p>These are received exit signals, not inferred reader intent.</p></div></div>
        <div className="ar-reader-exit-list">
          {exitReasons.map(([label, value]) => <div className="ar-reader-exit-row" key={label}><span>{label}</span><strong>{count(value)}</strong></div>)}
        </div>
        <div className="ar-reader-note">
          <strong>About unconfirmed sessions</strong>
          <p>A session without a completion or exit signal may mean the tab was closed, the browser stopped the request, the connection dropped, or the reader is still reading. It is kept separate from confirmed exit events. A quick switch to another chapter or navigation action is shown as its own exit reason.</p>
        </div>
      </section>
    </section>

    <footer className="ar-reader-privacy-note">
      <strong>Measurement and privacy</strong>
      <p>Reader journeys use a random browser identifier that is hashed before storage. The journey records contain chapter, language, page progress and session events, not account names or raw IP addresses. A page is counted after it has loaded and remained visible for two seconds. Browser exit signals are best effort, so some exits may appear as sessions with no end signal.</p>
    </footer>
  </section>;
}
