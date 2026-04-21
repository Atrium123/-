const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const PAGE_SIZE = 8;
const HK_TIMEZONE = 'Asia/Hong_Kong';

const ALLOWED_TYPES = new Set(['arrival', 'departure']);
const ALLOWED_STATUSES = new Set(['on_time', 'delayed', 'boarding', 'landed', 'departed', 'cancelled']);
const ALLOWED_TERMINALS = new Set(['T1', 'T2']);
const ALLOWED_SORT = new Set(['time_asc', 'time_desc', 'status']);
const STATUS_PRIORITY = {
  boarding: 1,
  on_time: 2,
  delayed: 3,
  landed: 4,
  departed: 5,
  cancelled: 6,
};

const flights = loadFlights();

app.use(express.static(path.join(__dirname, 'static')));
app.use(express.json());

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (_req, res) => {
  res.redirect('/flights/search');
});

app.get('/flights/search', (req, res) => {
  const requestedDate = isISODate(req.query.date) ? req.query.date : getTodayInTimezone();
  const stats = buildDailyStats(requestedDate);

  res.render('search', {
    title: '香港航班查询系统',
    pageName: 'search',
    pageData: {
      todayDate: requestedDate,
      stats,
    },
  });
});

app.get('/flights/results', (req, res) => {
  const query = normalizeQuery(req.query);
  const defaultDate = query.date || getTodayInTimezone();

  res.render('results', {
    title: '航班查询结果',
    pageName: 'results',
    pageData: {
      initialQuery: {
        ...query,
        date: defaultDate,
      },
      defaultDate,
    },
  });
});

app.get('/flights/saved', (_req, res) => {
  res.render('saved', {
    title: '收藏与历史',
    pageName: 'saved',
    pageData: {},
  });
});

app.get('/api/flights', (req, res) => {
  const query = normalizeQuery(req.query);
  const filtered = filterFlights(flights, query);

  if (query.ids.length > 0) {
    res.json({
      items: filtered.map(toFlightSummary),
      total: filtered.length,
      page: 1,
      pageSize: filtered.length,
      totalPages: 1,
      query,
    });
    return;
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  res.json({
    items: filtered.slice(start, end).map(toFlightSummary),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    query: {
      ...query,
      page,
    },
  });
});

app.get('/api/flights/:id', (req, res) => {
  const flight = flights.find((item) => item.id === req.params.id);

  if (!flight) {
    res.status(404).json({ message: 'Flight not found.' });
    return;
  }

  res.json({ item: toFlightDetail(flight) });
});

app.use((_req, res) => {
  res.status(404).render('notfound', {
    title: '页面不存在',
    pageName: 'notfound',
    pageData: {},
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;

function loadFlights() {
  const sourcePath = path.join(__dirname, 'data', 'flights.json');

  try {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(sanitizeFlightData) : [];
  } catch (error) {
    console.error('Failed to load flight data:', error);
    return [];
  }
}

function sanitizeFlightData(flight) {
  const timeline = Array.isArray(flight.timeline)
    ? flight.timeline.map((item) => ({
      ...item,
      label: sanitizeLocalizedText(item.label),
    }))
    : [];

  return {
    ...flight,
    airline: sanitizeLocalizedText(flight.airline),
    city: sanitizeLocalizedText(flight.city),
    timeline,
  };
}

function sanitizeLocalizedText(value) {
  const zhValue = value && typeof value.zh === 'string' ? value.zh : '';
  const enValue = value && typeof value.en === 'string' ? value.en : '';

  const safeZh = isCorruptedText(zhValue) ? '' : zhValue;
  const safeEn = isCorruptedText(enValue) ? '' : enValue;

  return {
    zh: safeZh || safeEn,
    en: safeEn || safeZh,
  };
}

function isCorruptedText(text) {
  return typeof text === 'string' && text.includes('\uFFFD');
}

function normalizeQuery(input) {
  const keyword = typeof input.keyword === 'string' ? input.keyword.trim() : '';
  const type = ALLOWED_TYPES.has(input.type) ? input.type : '';
  const date = isISODate(input.date) ? input.date : '';
  const status = ALLOWED_STATUSES.has(input.status) ? input.status : '';
  const terminal = ALLOWED_TERMINALS.has(input.terminal) ? input.terminal : '';
  const sort = ALLOWED_SORT.has(input.sort) ? input.sort : 'time_asc';

  const pageValue = Number.parseInt(input.page, 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;

  const ids = typeof input.ids === 'string'
    ? input.ids.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    keyword,
    type,
    date,
    status,
    terminal,
    sort,
    page,
    ids,
  };
}

function filterFlights(allFlights, query) {
  const idsFilter = new Set(query.ids);
  let result = allFlights.filter((flight) => {
    if (idsFilter.size > 0 && !idsFilter.has(flight.id)) {
      return false;
    }

    if (query.type && flight.type !== query.type) {
      return false;
    }

    if (query.date && flight.date !== query.date) {
      return false;
    }

    if (query.status && flight.status !== query.status) {
      return false;
    }

    if (query.terminal && flight.terminal !== query.terminal) {
      return false;
    }

    if (query.keyword) {
      const haystack = [
        flight.flightNo,
        flight.airline.zh,
        flight.airline.en,
        flight.city.zh,
        flight.city.en,
        flight.cityCode,
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query.keyword.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  if (idsFilter.size > 0) {
    const originalOrder = new Map(query.ids.map((id, index) => [id, index]));
    result = result.sort((left, right) => {
      return (originalOrder.get(left.id) ?? 9999) - (originalOrder.get(right.id) ?? 9999);
    });
    return result;
  }

  return result.sort((left, right) => sortFlights(left, right, query.sort));
}

function sortFlights(left, right, mode) {
  if (mode === 'status') {
    const statusDelta = (STATUS_PRIORITY[left.status] ?? 99) - (STATUS_PRIORITY[right.status] ?? 99);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return toMinutes(left.scheduledTime) - toMinutes(right.scheduledTime);
  }

  if (mode === 'time_desc') {
    return toMinutes(right.scheduledTime) - toMinutes(left.scheduledTime);
  }

  return toMinutes(left.scheduledTime) - toMinutes(right.scheduledTime);
}

function toMinutes(timeText) {
  const [hour, minute] = String(timeText || '00:00').split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function buildDailyStats(dateText) {
  const items = flights.filter((flight) => flight.date === dateText);

  return {
    arrivals: items.filter((flight) => flight.type === 'arrival').length,
    departures: items.filter((flight) => flight.type === 'departure').length,
    delayed: items.filter((flight) => flight.status === 'delayed').length,
  };
}

function getTodayInTimezone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isISODate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toFlightSummary(flight) {
  return {
    id: flight.id,
    flightNo: flight.flightNo,
    airline: flight.airline,
    type: flight.type,
    city: flight.city,
    cityCode: flight.cityCode,
    date: flight.date,
    scheduledTime: flight.scheduledTime,
    estimatedTime: flight.estimatedTime,
    terminal: flight.terminal,
    gate: flight.gate,
    belt: flight.belt,
    status: flight.status,
    statusUpdatedAt: flight.statusUpdatedAt,
  };
}

function toFlightDetail(flight) {
  return {
    ...toFlightSummary(flight),
    aircraft: flight.aircraft,
    timeline: flight.timeline || [],
  };
}
