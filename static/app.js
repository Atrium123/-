(() => {
  'use strict';

  const STORAGE_KEYS = {
    favorites: 'hk_flights_favorites',
    history: 'hk_flights_history',
    locale: 'hk_flights_locale',
  };

  const PAGE_DATA = window.__HK_FLIGHTS_PAGE__ || {};
  const pageName = document.body.dataset.page || '';

  const STATUS_LABELS = {
    zh: {
      on_time: '准点',
      delayed: '延误',
      boarding: '登机中',
      landed: '已到达',
      departed: '已起飞',
      cancelled: '已取消',
    },
    en: {
      on_time: 'On Time',
      delayed: 'Delayed',
      boarding: 'Boarding',
      landed: 'Landed',
      departed: 'Departed',
      cancelled: 'Cancelled',
    },
  };

  const TYPE_LABELS = {
    zh: {
      arrival: '到港',
      departure: '离港',
    },
    en: {
      arrival: 'Arrival',
      departure: 'Departure',
    },
  };

  const STRINGS = {
    zh: {
      resultsSummary: '共 {count} 个航班，当前第 {page}/{totalPages} 页',
      filtersNone: '当前未设置筛选条件',
      noFlights: '没有匹配的航班，请调整筛选条件。',
      detail: '详情',
      addFavorite: '收藏',
      removeFavorite: '取消收藏',
      toPrefix: '前往',
      fromPrefix: '来自',
      scheduleTime: '计划',
      estimateTime: '预估',
      terminal: '航站楼',
      gate: '登机口',
      belt: '行李转盘',
      unknown: '待定',
      emptyFavorites: '还没有收藏航班。可在结果页点星标添加。',
      emptyHistory: '还没有查询记录。先去结果页执行一次筛选。',
      historyAt: '查询时间',
      viewResult: '查看结果',
      delete: '删除',
      modalError: '无法读取该航班详情。',
      loading: '加载中...',
      filterKeyword: '关键词',
      filterType: '类型',
      filterDate: '日期',
      filterStatus: '状态',
      filterTerminal: '航站楼',
      filterSort: '排序',
      sortTimeAsc: '时间升序',
      sortTimeDesc: '时间降序',
      sortStatus: '状态优先级',
      historyDefault: '默认查询',
    },
    en: {
      resultsSummary: '{count} flights found. Page {page}/{totalPages}.',
      filtersNone: 'No filters applied',
      noFlights: 'No flights match the current filters.',
      detail: 'Details',
      addFavorite: 'Favorite',
      removeFavorite: 'Unfavorite',
      toPrefix: 'To',
      fromPrefix: 'From',
      scheduleTime: 'Scheduled',
      estimateTime: 'Estimated',
      terminal: 'Terminal',
      gate: 'Gate',
      belt: 'Belt',
      unknown: 'TBD',
      emptyFavorites: 'No favorite flights yet. Use the star button on the results page.',
      emptyHistory: 'No recent searches yet. Run filters from the results page first.',
      historyAt: 'Searched at',
      viewResult: 'Open',
      delete: 'Delete',
      modalError: 'Unable to load this flight detail.',
      loading: 'Loading...',
      filterKeyword: 'Keyword',
      filterType: 'Type',
      filterDate: 'Date',
      filterStatus: 'Status',
      filterTerminal: 'Terminal',
      filterSort: 'Sort',
      sortTimeAsc: 'Time Asc',
      sortTimeDesc: 'Time Desc',
      sortStatus: 'Status Priority',
      historyDefault: 'Default Search',
    },
  };

  const state = {
    locale: getSavedLocale(),
    favorites: loadArray(STORAGE_KEYS.favorites),
    resultItems: [],
    resultMeta: null,
    currentQuery: null,
    modalReady: false,
  };

  const modalRefs = {
    root: null,
    title: null,
    subtitle: null,
    status: null,
    terminal: null,
    gate: null,
    belt: null,
    aircraft: null,
    updated: null,
    timeline: null,
  };

  document.addEventListener('DOMContentLoaded', () => {
    initLocale();
    initModal();

    if (pageName === 'results') {
      initResultsPage();
    }

    if (pageName === 'saved') {
      initSavedPage();
    }

    applyLocale(state.locale);
  });

  function initLocale() {
    const buttons = document.querySelectorAll('.locale-btn');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextLocale = button.dataset.localeTarget;
        if (!nextLocale || nextLocale === state.locale) {
          return;
        }

        state.locale = nextLocale;
        localStorage.setItem(STORAGE_KEYS.locale, nextLocale);
        applyLocale(nextLocale);
        document.dispatchEvent(new CustomEvent('localechange', { detail: { locale: nextLocale } }));
      });
    });
  }

  function applyLocale(locale) {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en';

    document.querySelectorAll('.i18n-text').forEach((node) => {
      const value = node.dataset[locale];
      if (typeof value === 'string') {
        node.textContent = value;
      }
    });

    document.querySelectorAll('[data-zh-placeholder]').forEach((node) => {
      node.placeholder = locale === 'zh' ? node.dataset.zhPlaceholder : node.dataset.enPlaceholder;
    });

    document.querySelectorAll('option[data-zh]').forEach((node) => {
      node.textContent = locale === 'zh' ? node.dataset.zh : node.dataset.en;
    });

    document.querySelectorAll('.locale-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.localeTarget === locale);
    });
  }

  function initResultsPage() {
    const form = document.getElementById('filterForm');
    const cards = document.getElementById('resultsCards');
    const tableBody = document.getElementById('resultsTableBody');
    const summary = document.getElementById('resultSummary');
    const pagination = document.getElementById('pagination');
    const activeFilters = document.getElementById('activeFilters');
    const pageInput = form.querySelector('input[name="page"]');

    const panel = document.getElementById('filterPanel');
    const backdrop = document.getElementById('filterBackdrop');
    const openPanelBtn = document.getElementById('openFilterPanel');
    const closePanelBtn = document.getElementById('closeFilterPanel');
    const resetBtn = document.getElementById('resetFilters');

    const closePanel = () => {
      if (!panel || !backdrop) {
        return;
      }
      panel.classList.remove('open');
      backdrop.classList.remove('show');
      backdrop.hidden = true;
    };

    const openPanel = () => {
      if (!panel || !backdrop) {
        return;
      }
      panel.classList.add('open');
      backdrop.hidden = false;
      backdrop.classList.add('show');
    };

    if (openPanelBtn) {
      openPanelBtn.addEventListener('click', openPanel);
    }
    if (closePanelBtn) {
      closePanelBtn.addEventListener('click', closePanel);
    }
    if (backdrop) {
      backdrop.addEventListener('click', closePanel);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      pageInput.value = '1';
      fetchAndRenderResults({
        form,
        cards,
        tableBody,
        summary,
        pagination,
        activeFilters,
        pageInput,
        writeHistory: true,
      });
      closePanel();
    });

    resetBtn.addEventListener('click', () => {
      form.reset();
      const dateInput = form.querySelector('input[name="date"]');
      if (dateInput && PAGE_DATA.defaultDate) {
        dateInput.value = PAGE_DATA.defaultDate;
      }
      const sortInput = form.querySelector('select[name="sort"]');
      if (sortInput) {
        sortInput.value = 'time_asc';
      }
      pageInput.value = '1';

      fetchAndRenderResults({
        form,
        cards,
        tableBody,
        summary,
        pagination,
        activeFilters,
        pageInput,
        writeHistory: false,
      });
    });

    pagination.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-page]');
      if (!button) {
        return;
      }

      const targetPage = Number.parseInt(button.dataset.page, 10);
      if (!Number.isFinite(targetPage) || targetPage <= 0) {
        return;
      }

      pageInput.value = String(targetPage);
      fetchAndRenderResults({
        form,
        cards,
        tableBody,
        summary,
        pagination,
        activeFilters,
        pageInput,
        writeHistory: false,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    cards.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const flightId = button.dataset.id;
      if (!flightId) {
        return;
      }

      if (action === 'favorite') {
        toggleFavorite(flightId);
        renderResults(cards, tableBody, summary, pagination, activeFilters);
      }
      if (action === 'detail') {
        openFlightModal(flightId);
      }
    });

    tableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const flightId = button.dataset.id;
      if (!flightId) {
        return;
      }

      if (action === 'favorite') {
        toggleFavorite(flightId);
        renderResults(cards, tableBody, summary, pagination, activeFilters);
      }
      if (action === 'detail') {
        openFlightModal(flightId);
      }
    });

    document.addEventListener('localechange', () => {
      renderResults(cards, tableBody, summary, pagination, activeFilters);
    });

    syncFormValues(form, PAGE_DATA.initialQuery || {});

    fetchAndRenderResults({
      form,
      cards,
      tableBody,
      summary,
      pagination,
      activeFilters,
      pageInput,
      writeHistory: hasMeaningfulHistory(readQuery(form)),
    });
  }

  async function fetchAndRenderResults(config) {
    const { form, cards, tableBody, summary, pagination, activeFilters, pageInput, writeHistory } = config;
    const query = readQuery(form);
    const searchParams = buildSearchParams(query);

    cards.innerHTML = `<div class="empty-state">${escapeHTML(t('loading'))}</div>`;
    tableBody.innerHTML = '';

    try {
      const response = await fetch(`/api/flights?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const payload = await response.json();
      state.resultItems = Array.isArray(payload.items) ? payload.items : [];
      state.resultMeta = payload;
      state.currentQuery = payload.query || query;
      state.favorites = loadArray(STORAGE_KEYS.favorites);

      pageInput.value = String(payload.page || 1);
      renderResults(cards, tableBody, summary, pagination, activeFilters);
      syncResultsURL(state.currentQuery);

      if (writeHistory) {
        appendSearchHistory(state.currentQuery);
      }
    } catch (_error) {
      state.resultItems = [];
      state.resultMeta = { total: 0, page: 1, totalPages: 1 };
      state.currentQuery = query;
      renderResults(cards, tableBody, summary, pagination, activeFilters);
    }
  }

  function renderResults(cards, tableBody, summary, pagination, activeFilters) {
    const items = state.resultItems;
    const meta = state.resultMeta || { total: 0, page: 1, totalPages: 1 };
    const locale = state.locale;

    summary.textContent = t('resultsSummary', {
      count: meta.total || 0,
      page: meta.page || 1,
      totalPages: meta.totalPages || 1,
    });

    activeFilters.innerHTML = renderActiveFilterHTML(state.currentQuery || {});

    if (items.length === 0) {
      cards.innerHTML = `<div class="empty-state">${escapeHTML(t('noFlights'))}</div>`;
      tableBody.innerHTML = '';
      pagination.innerHTML = '';
      return;
    }

    cards.innerHTML = items
      .map((item, index) => {
        const cityName = localeText(item.city);
        const airlineName = localeText(item.airline);
        const typeName = getTypeLabel(item.type);
        const statusName = getStatusLabel(item.status);
        const routePrefix = item.type === 'arrival' ? t('fromPrefix') : t('toPrefix');
        const favoriteActive = state.favorites.includes(item.id);

        return `
          <article class="flight-card" style="animation-delay:${index * 55}ms">
            <div class="flight-top">
              <div>
                <div class="flight-no">${escapeHTML(item.flightNo)}</div>
                <div class="flight-route">${escapeHTML(airlineName)}</div>
              </div>
              <button class="favorite-btn ${favoriteActive ? 'active' : ''}" type="button" data-action="favorite" data-id="${escapeHTML(item.id)}" aria-label="favorite">${favoriteActive ? '★' : '☆'}</button>
            </div>
            <p class="flight-route">${escapeHTML(routePrefix)} ${escapeHTML(cityName)} (${escapeHTML(item.cityCode)})</p>
            <p class="flight-times"><span>${escapeHTML(t('scheduleTime'))}</span> ${escapeHTML(item.scheduledTime)} · <span>${escapeHTML(t('estimateTime'))}</span> ${escapeHTML(item.estimatedTime)}</p>
            <p class="flight-meta"><span>${escapeHTML(t('terminal'))}</span> ${escapeHTML(item.terminal || t('unknown'))} · <span>${escapeHTML(t('gate'))}</span> ${escapeHTML(item.gate || t('unknown'))} · <span>${escapeHTML(t('belt'))}</span> ${escapeHTML(item.belt || t('unknown'))}</p>
            <div class="badge-row">
              <span class="badge badge-type">${escapeHTML(typeName)}</span>
              <span class="badge badge-status--${escapeHTML(item.status)}">${escapeHTML(statusName)}</span>
            </div>
            <div class="flight-actions">
              <button class="button button-secondary" type="button" data-action="detail" data-id="${escapeHTML(item.id)}">${escapeHTML(t('detail'))}</button>
              <button class="button button-primary" type="button" data-action="favorite" data-id="${escapeHTML(item.id)}">${escapeHTML(favoriteActive ? t('removeFavorite') : t('addFavorite'))}</button>
            </div>
          </article>
        `;
      })
      .join('');

    tableBody.innerHTML = items
      .map((item) => {
        const favoriteActive = state.favorites.includes(item.id);

        return `
          <tr>
            <td>${escapeHTML(item.flightNo)}</td>
            <td>${escapeHTML(localeText(item.airline))}</td>
            <td>${escapeHTML(getTypeLabel(item.type))}</td>
            <td>${escapeHTML(localeText(item.city))} (${escapeHTML(item.cityCode)})</td>
            <td>${escapeHTML(item.scheduledTime)}</td>
            <td>${escapeHTML(item.estimatedTime)}</td>
            <td><span class="badge badge-status--${escapeHTML(item.status)}">${escapeHTML(getStatusLabel(item.status))}</span></td>
            <td>
              <button class="table-action" type="button" data-action="detail" data-id="${escapeHTML(item.id)}">${escapeHTML(t('detail'))}</button>
              <button class="table-action" type="button" data-action="favorite" data-id="${escapeHTML(item.id)}">${favoriteActive ? '★' : '☆'}</button>
            </td>
          </tr>
        `;
      })
      .join('');

    pagination.innerHTML = buildPaginationHTML(meta.page, meta.totalPages);
  }

  function renderActiveFilterHTML(query) {
    const chips = [];

    if (query.keyword) {
      chips.push(`${t('filterKeyword')}: ${query.keyword}`);
    }
    if (query.type) {
      chips.push(`${t('filterType')}: ${getTypeLabel(query.type)}`);
    }
    if (query.date) {
      chips.push(`${t('filterDate')}: ${query.date}`);
    }
    if (query.status) {
      chips.push(`${t('filterStatus')}: ${getStatusLabel(query.status)}`);
    }
    if (query.terminal) {
      chips.push(`${t('filterTerminal')}: ${query.terminal}`);
    }
    if (query.sort) {
      chips.push(`${t('filterSort')}: ${getSortLabel(query.sort)}`);
    }

    if (chips.length === 0) {
      return `<span class="filter-chip">${escapeHTML(t('filtersNone'))}</span>`;
    }

    return chips.map((chip) => `<span class="filter-chip">${escapeHTML(chip)}</span>`).join('');
  }

  function buildPaginationHTML(currentPage, totalPages) {
    if (!totalPages || totalPages <= 1) {
      return '';
    }

    const buttons = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (currentPage > 1) {
      buttons.push(`<button class="page-btn" type="button" data-page="${currentPage - 1}">‹</button>`);
    }

    for (let page = start; page <= end; page += 1) {
      buttons.push(`<button class="page-btn ${page === currentPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>`);
    }

    if (currentPage < totalPages) {
      buttons.push(`<button class="page-btn" type="button" data-page="${currentPage + 1}">›</button>`);
    }

    return buttons.join('');
  }

  function initSavedPage() {
    const favoritesList = document.getElementById('favoritesList');
    const historyList = document.getElementById('historyList');
    const clearFavoritesBtn = document.getElementById('clearFavoritesBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    clearFavoritesBtn.addEventListener('click', () => {
      state.favorites = [];
      saveArray(STORAGE_KEYS.favorites, []);
      renderSavedFavorites(favoritesList);
    });

    clearHistoryBtn.addEventListener('click', () => {
      saveArray(STORAGE_KEYS.history, []);
      renderSearchHistory(historyList);
    });

    favoritesList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const flightId = button.dataset.id;

      if (action === 'favorite' && flightId) {
        toggleFavorite(flightId);
        renderSavedFavorites(favoritesList);
      }

      if (action === 'detail' && flightId) {
        openFlightModal(flightId);
      }
    });

    historyList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action="history-delete"]');
      if (!button) {
        return;
      }

      const index = Number.parseInt(button.dataset.index, 10);
      if (!Number.isFinite(index)) {
        return;
      }

      const list = loadArray(STORAGE_KEYS.history);
      if (index < 0 || index >= list.length) {
        return;
      }

      list.splice(index, 1);
      saveArray(STORAGE_KEYS.history, list);
      renderSearchHistory(historyList);
    });

    document.addEventListener('localechange', () => {
      renderSavedFavorites(favoritesList);
      renderSearchHistory(historyList);
    });

    renderSavedFavorites(favoritesList);
    renderSearchHistory(historyList);
  }

  async function renderSavedFavorites(container) {
    state.favorites = loadArray(STORAGE_KEYS.favorites);

    if (state.favorites.length === 0) {
      container.innerHTML = `<div class="empty-state">${escapeHTML(t('emptyFavorites'))}</div>`;
      return;
    }

    container.innerHTML = `<div class="empty-state">${escapeHTML(t('loading'))}</div>`;

    try {
      const ids = state.favorites.join(',');
      const response = await fetch(`/api/flights?ids=${encodeURIComponent(ids)}`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];

      if (items.length === 0) {
        container.innerHTML = `<div class="empty-state">${escapeHTML(t('emptyFavorites'))}</div>`;
        return;
      }

      container.innerHTML = items
        .map((item, index) => {
          const routePrefix = item.type === 'arrival' ? t('fromPrefix') : t('toPrefix');

          return `
            <article class="flight-card" style="animation-delay:${index * 45}ms">
              <div class="flight-top">
                <div>
                  <div class="flight-no">${escapeHTML(item.flightNo)}</div>
                  <div class="flight-route">${escapeHTML(localeText(item.airline))}</div>
                </div>
                <button class="favorite-btn active" type="button" data-action="favorite" data-id="${escapeHTML(item.id)}" aria-label="favorite">★</button>
              </div>
              <p class="flight-route">${escapeHTML(routePrefix)} ${escapeHTML(localeText(item.city))} (${escapeHTML(item.cityCode)})</p>
              <p class="flight-times"><span>${escapeHTML(t('scheduleTime'))}</span> ${escapeHTML(item.scheduledTime)} · <span>${escapeHTML(t('estimateTime'))}</span> ${escapeHTML(item.estimatedTime)}</p>
              <p class="flight-meta"><span>${escapeHTML(t('terminal'))}</span> ${escapeHTML(item.terminal || t('unknown'))} · <span>${escapeHTML(t('gate'))}</span> ${escapeHTML(item.gate || t('unknown'))} · <span>${escapeHTML(t('belt'))}</span> ${escapeHTML(item.belt || t('unknown'))}</p>
              <div class="badge-row">
                <span class="badge badge-type">${escapeHTML(getTypeLabel(item.type))}</span>
                <span class="badge badge-status--${escapeHTML(item.status)}">${escapeHTML(getStatusLabel(item.status))}</span>
              </div>
              <div class="flight-actions">
                <button class="button button-secondary" type="button" data-action="detail" data-id="${escapeHTML(item.id)}">${escapeHTML(t('detail'))}</button>
                <button class="button button-primary" type="button" data-action="favorite" data-id="${escapeHTML(item.id)}">${escapeHTML(t('removeFavorite'))}</button>
              </div>
            </article>
          `;
        })
        .join('');
    } catch (_error) {
      container.innerHTML = `<div class="empty-state">${escapeHTML(t('emptyFavorites'))}</div>`;
    }
  }

  function renderSearchHistory(container) {
    const list = loadArray(STORAGE_KEYS.history);

    if (list.length === 0) {
      container.innerHTML = `<div class="empty-state">${escapeHTML(t('emptyHistory'))}</div>`;
      return;
    }

    container.innerHTML = list
      .map((item, index) => {
        const query = item.query || {};
        const queryLabel = buildHistoryLabel(query);
        const queryString = buildSearchParams({ ...query, page: 1 }).toString();
        const dateLabel = item.createdAt ? formatDateTime(item.createdAt) : '-';

        return `
          <div class="history-item">
            <a class="history-link" href="/flights/results?${queryString}">
              ${escapeHTML(queryLabel)}<br>
              <small>${escapeHTML(t('historyAt'))}: ${escapeHTML(dateLabel)}</small>
            </a>
            <div class="history-tools">
              <a class="history-btn" href="/flights/results?${queryString}">${escapeHTML(t('viewResult'))}</a>
              <button class="history-btn" type="button" data-action="history-delete" data-index="${index}">${escapeHTML(t('delete'))}</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function buildHistoryLabel(query) {
    const parts = [];
    if (query.keyword) {
      parts.push(`${t('filterKeyword')}: ${query.keyword}`);
    }
    if (query.type) {
      parts.push(`${t('filterType')}: ${getTypeLabel(query.type)}`);
    }
    if (query.status) {
      parts.push(`${t('filterStatus')}: ${getStatusLabel(query.status)}`);
    }
    if (query.terminal) {
      parts.push(`${t('filterTerminal')}: ${query.terminal}`);
    }
    if (query.date) {
      parts.push(`${t('filterDate')}: ${query.date}`);
    }
    return parts.length === 0 ? t('historyDefault') : parts.join(' · ');
  }

  function appendSearchHistory(query) {
    const nextEntry = {
      query: {
        keyword: query.keyword || '',
        type: query.type || '',
        date: query.date || '',
        status: query.status || '',
        terminal: query.terminal || '',
        sort: query.sort || 'time_asc',
      },
      createdAt: new Date().toISOString(),
    };

    if (!hasMeaningfulHistory(nextEntry.query)) {
      return;
    }

    const entries = loadArray(STORAGE_KEYS.history);
    const signature = JSON.stringify(nextEntry.query);
    const deduped = entries.filter((item) => JSON.stringify(item.query || {}) !== signature);
    deduped.unshift(nextEntry);
    saveArray(STORAGE_KEYS.history, deduped.slice(0, 10));
  }

  function hasMeaningfulHistory(query) {
    const hasCoreFilter = Boolean(query.keyword || query.type || query.status || query.terminal);
    const hasCustomDate = Boolean(query.date && query.date !== (PAGE_DATA.defaultDate || ''));
    return hasCoreFilter || hasCustomDate;
  }

  function syncResultsURL(query) {
    if (pageName !== 'results') {
      return;
    }
    const url = new URL(window.location.href);
    url.search = buildSearchParams(query).toString();
    window.history.replaceState({}, '', url);
  }

  function readQuery(form) {
    const data = new FormData(form);
    return {
      keyword: cleanString(data.get('keyword')),
      type: cleanString(data.get('type')),
      date: cleanString(data.get('date')),
      status: cleanString(data.get('status')),
      terminal: cleanString(data.get('terminal')),
      sort: cleanString(data.get('sort')) || 'time_asc',
      page: Number.parseInt(cleanString(data.get('page')) || '1', 10) || 1,
    };
  }

  function syncFormValues(form, query) {
    setField(form, 'keyword', query.keyword || '');
    setField(form, 'type', query.type || '');
    setField(form, 'date', query.date || PAGE_DATA.defaultDate || '');
    setField(form, 'status', query.status || '');
    setField(form, 'terminal', query.terminal || '');
    setField(form, 'sort', query.sort || 'time_asc');
    setField(form, 'page', String(query.page || 1));
  }

  function setField(form, name, value) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) {
      input.value = value;
    }
  }

  function buildSearchParams(query) {
    const params = new URLSearchParams();
    if (query.keyword) {
      params.set('keyword', query.keyword);
    }
    if (query.type) {
      params.set('type', query.type);
    }
    if (query.date) {
      params.set('date', query.date);
    }
    if (query.status) {
      params.set('status', query.status);
    }
    if (query.terminal) {
      params.set('terminal', query.terminal);
    }
    if (query.sort) {
      params.set('sort', query.sort);
    }
    params.set('page', String(query.page || 1));
    if (query.ids) {
      params.set('ids', query.ids);
    }
    return params;
  }

  function initModal() {
    modalRefs.root = document.getElementById('flightModal');
    modalRefs.title = document.getElementById('modalTitle');
    modalRefs.subtitle = document.getElementById('modalSubtitle');
    modalRefs.status = document.getElementById('modalStatusValue');
    modalRefs.terminal = document.getElementById('modalTerminalValue');
    modalRefs.gate = document.getElementById('modalGateValue');
    modalRefs.belt = document.getElementById('modalBeltValue');
    modalRefs.aircraft = document.getElementById('modalAircraftValue');
    modalRefs.updated = document.getElementById('modalUpdatedValue');
    modalRefs.timeline = document.getElementById('modalTimeline');

    if (!modalRefs.root) {
      return;
    }

    modalRefs.root.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.modalClose === 'true') {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modalRefs.root.hidden) {
        closeModal();
      }
    });

    state.modalReady = true;
  }

  async function openFlightModal(flightId) {
    if (!state.modalReady || !modalRefs.root) {
      return;
    }

    modalRefs.root.hidden = false;
    document.body.style.overflow = 'hidden';

    modalRefs.title.textContent = t('loading');
    modalRefs.subtitle.textContent = '-';
    modalRefs.timeline.innerHTML = '';

    try {
      const response = await fetch(`/api/flights/${encodeURIComponent(flightId)}`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const payload = await response.json();
      const flight = payload.item;
      if (!flight) {
        throw new Error('Missing flight detail');
      }

      modalRefs.title.textContent = `${flight.flightNo} · ${localeText(flight.airline)}`;
      modalRefs.subtitle.textContent = `${getTypeLabel(flight.type)} · ${localeText(flight.city)} (${flight.cityCode})`;
      modalRefs.status.textContent = getStatusLabel(flight.status);
      modalRefs.terminal.textContent = flight.terminal || t('unknown');
      modalRefs.gate.textContent = flight.gate || t('unknown');
      modalRefs.belt.textContent = flight.belt || t('unknown');
      modalRefs.aircraft.textContent = flight.aircraft || t('unknown');
      modalRefs.updated.textContent = flight.statusUpdatedAt || t('unknown');

      const timeline = Array.isArray(flight.timeline) ? flight.timeline : [];
      modalRefs.timeline.innerHTML = timeline
        .map((node) => {
          const label = localeText(node.label || {});
          return `
            <li class="timeline-item">
              <span class="timeline-time">${escapeHTML(node.time || '--:--')}</span>
              <span class="timeline-text">${escapeHTML(label || t('unknown'))}</span>
            </li>
          `;
        })
        .join('');

      if (timeline.length === 0) {
        modalRefs.timeline.innerHTML = `<li class="timeline-item"><span class="timeline-time">--:--</span><span class="timeline-text">${escapeHTML(t('unknown'))}</span></li>`;
      }
    } catch (_error) {
      modalRefs.title.textContent = t('modalError');
      modalRefs.subtitle.textContent = '-';
      modalRefs.status.textContent = '-';
      modalRefs.terminal.textContent = '-';
      modalRefs.gate.textContent = '-';
      modalRefs.belt.textContent = '-';
      modalRefs.aircraft.textContent = '-';
      modalRefs.updated.textContent = '-';
      modalRefs.timeline.innerHTML = '';
    }
  }

  function closeModal() {
    if (!modalRefs.root) {
      return;
    }
    modalRefs.root.hidden = true;
    document.body.style.overflow = '';
  }

  function getSavedLocale() {
    const raw = localStorage.getItem(STORAGE_KEYS.locale);
    return raw === 'en' ? 'en' : 'zh';
  }

  function loadArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function saveArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function toggleFavorite(id) {
    state.favorites = loadArray(STORAGE_KEYS.favorites);
    const set = new Set(state.favorites);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    state.favorites = Array.from(set);
    saveArray(STORAGE_KEYS.favorites, state.favorites);
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[state.locale][status] || status || t('unknown');
  }

  function getTypeLabel(type) {
    return TYPE_LABELS[state.locale][type] || type || t('unknown');
  }

  function getSortLabel(sortKey) {
    if (sortKey === 'time_desc') {
      return t('sortTimeDesc');
    }
    if (sortKey === 'status') {
      return t('sortStatus');
    }
    return t('sortTimeAsc');
  }

  function localeText(value) {
    if (!value || typeof value !== 'object') {
      return '';
    }
    const primary = state.locale === 'en' ? value.en : value.zh;
    const fallback = state.locale === 'en' ? value.zh : value.en;

    if (isCorruptedText(primary)) {
      return fallback || '';
    }

    return primary || fallback || '';
  }

  function isCorruptedText(text) {
    return typeof text === 'string' && text.includes('�');
  }

  function t(key, replacements = {}) {
    const source = STRINGS[state.locale][key] || key;
    return Object.keys(replacements).reduce((result, token) => {
      return result.replaceAll(`{${token}}`, String(replacements[token]));
    }, source);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const locale = state.locale === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#39;');
  }
})();
