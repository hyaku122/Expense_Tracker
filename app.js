(function () {
  'use strict';

  var C = window.MLLCommon;
  if (!C) {
    return;
  }

  var UPDATE_CONFIRM_MESSAGE = 'キャッシュを削除して最新版を読み込みます。入力データは消えません。実行しますか？';
  var MIN_YEAR = 2026;
  var MAX_YEAR = 2035;
  var ASSET_VERSION = '20260310-2';

  var TABLE_COLUMNS = [
    { key: 'date', label: '日付' },
    { key: 'weekday', label: '曜' },
    { key: 'wakeTime', label: '起床' },
    { key: 'bedTime', label: '就寝' },
    { key: 'sleepDuration', label: '睡眠時間' },
    { key: 'morningMeditation', label: '朝瞑想' },
    { key: 'yoga', label: 'ヨガ' },
    { key: 'morningStairs', label: '朝階段' },
    { key: 'mercari', label: 'メルカリ' },
    { key: 'paleo', label: 'パレオ' },
    { key: 'walk', label: '散歩' },
    { key: 'nightStairs', label: '夜階段' },
    { key: 'reading', label: '読書' },
    { key: 'bathMeditation', label: '瞑想♨' },
    { key: 'weight', label: '体重' }
  ];
  var COLUMN_WIDTHS = {
    date: 57,
    weekday: 29,
    wakeTime: 64,
    bedTime: 64,
    sleepDuration: 73,
    morningMeditation: 62,
    yoga: 46,
    morningStairs: 59,
    mercari: 74,
    paleo: 57,
    walk: 46,
    nightStairs: 59,
    reading: 44,
    bathMeditation: 58,
    weight: 86
  };
  var AUTO_CLOSE_DEFAULT_FIELDS = {
    morningMeditation: true,
    mercari: true,
    walk: true,
    bathMeditation: true
  };

  var topHeader = document.getElementById('topHeader');
  var yearLabel = document.getElementById('yearLabel');
  var yearPrevButton = document.getElementById('yearPrevButton');
  var yearNextButton = document.getElementById('yearNextButton');
  var updateButton = document.getElementById('updateButton');
  var settingsButton = document.getElementById('settingsButton');
  var summaryButton = document.getElementById('summaryButton');
  var monthTabs = document.getElementById('monthTabs');
  var monthSections = document.getElementById('monthSections');

  var settingsModal = document.getElementById('settingsModal');
  var closeSettingsButton = document.getElementById('closeSettingsButton');
  var createBackupButton = document.getElementById('createBackupButton');
  var backupOutput = document.getElementById('backupOutput');
  var restoreInput = document.getElementById('restoreInput');
  var restoreButton = document.getElementById('restoreButton');

  var now = new Date();
  var urlYear = parseInt(new URLSearchParams(window.location.search).get('year'), 10);
  var initialState = C.loadState(now.getFullYear());

  var state = initialState;
  var selectedYear = sanitizeYear(Number.isFinite(urlYear) ? urlYear : initialState.selectedYear || now.getFullYear());
  var activeMonth = selectedYear === now.getFullYear() ? now.getMonth() + 1 : 1;
  var saveTimer = null;

  init();

  function init() {
    applyStickyColumnVars();
    bindGlobalEvents();
    bindSettingsEvents();
    registerServiceWorker();
    renderAll();

    window.addEventListener('resize', updateStickyOffsets);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        updateStickyOffsets();
      }
    });

    requestAnimationFrame(function () {
      updateStickyOffsets();
      scrollTabToMonth(activeMonth, false);
    });
  }

  function applyStickyColumnVars() {
    var dateWidth = COLUMN_WIDTHS.date || 74;
    var weekdayWidth = COLUMN_WIDTHS.weekday || 48;
    var root = document.documentElement;
    root.style.setProperty('--date-col-width', dateWidth + 'px');
    root.style.setProperty('--weekday-col-width', weekdayWidth + 'px');
    root.style.setProperty('--sticky-left-width', (dateWidth + weekdayWidth) + 'px');
  }

  function syncStickyOffsetsForSection(section) {
    if (!section) {
      return;
    }

    var dateWidth = COLUMN_WIDTHS.date || 57;
    var weekdayWidth = COLUMN_WIDTHS.weekday || 29;
    var tables = section.querySelectorAll('.month-table');
    tables.forEach(function (table) {
      if (!table) {
        return;
      }
      table.style.setProperty('--table-date-width', dateWidth + 'px');
      table.style.setProperty('--table-weekday-width', weekdayWidth + 'px');
      table.style.setProperty('--table-sticky-left-width', (dateWidth + weekdayWidth) + 'px');
    });

    var root = document.documentElement;
    root.style.setProperty('--date-col-width', dateWidth + 'px');
    root.style.setProperty('--weekday-col-width', weekdayWidth + 'px');
    root.style.setProperty('--sticky-left-width', (dateWidth + weekdayWidth) + 'px');
  }

  function sanitizeYear(year) {
    if (!Number.isFinite(year)) {
      return C.DEFAULT_YEAR;
    }
    return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
  }

  function bindGlobalEvents() {
    yearPrevButton.addEventListener('click', function () {
      changeYear(-1);
    });

    yearNextButton.addEventListener('click', function () {
      changeYear(1);
    });

    summaryButton.addEventListener('click', function () {
      window.location.href = 'summary.html?year=' + selectedYear;
    });

    updateButton.addEventListener('click', refreshToLatest);
    settingsButton.addEventListener('click', openSettings);
  }

  function bindSettingsEvents() {
    closeSettingsButton.addEventListener('click', closeSettings);

    settingsModal.addEventListener('click', function (event) {
      if (event.target === settingsModal) {
        closeSettings();
      }
    });

    createBackupButton.addEventListener('click', function () {
      backupOutput.value = C.createBackupString(state);
      backupOutput.focus();
      backupOutput.select();
    });

    restoreButton.addEventListener('click', function () {
      var text = restoreInput.value.trim();
      if (!text) {
        alert('復元する文字列を入力してください。');
        return;
      }

      if (!window.confirm('バックアップ文字列から復元します。現在のデータを上書きします。実行しますか？')) {
        return;
      }

      try {
        state = C.restoreStateFromBackupString(text);
        selectedYear = sanitizeYear(state.selectedYear || selectedYear);
        state.selectedYear = selectedYear;
        C.ensureYearState(state, selectedYear);
        C.saveState(state);
        activeMonth = 1;
        renderAll();
        closeSettings();
        alert('復元しました。');
      } catch (error) {
        alert(error.message || '復元に失敗しました。');
      }
    });
  }

  function openSettings() {
    settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    settingsModal.classList.add('hidden');
  }

  function changeYear(delta) {
    var nextYear = sanitizeYear(selectedYear + delta);
    if (nextYear === selectedYear) {
      return;
    }

    selectedYear = nextYear;
    state.selectedYear = selectedYear;
    C.ensureYearState(state, selectedYear);
    C.saveState(state);

    activeMonth = 1;

    renderAll();
    window.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(function () {
      scrollTabToMonth(activeMonth, false);
    });
  }

  function renderAll() {
    C.ensureYearState(state, selectedYear);
    state.selectedYear = selectedYear;
    C.saveState(state);

    yearLabel.textContent = selectedYear + '年';
    summaryButton.textContent = selectedYear + '年まとめ';

    yearPrevButton.disabled = selectedYear <= MIN_YEAR;
    yearNextButton.disabled = selectedYear >= MAX_YEAR;

    renderMonthTabs();
    renderAllMonthSections();

    updateStickyOffsets();
  }

  function renderMonthTabs() {
    monthTabs.innerHTML = '';

    for (var month = 1; month <= 12; month += 1) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'month-tab' + (month === activeMonth ? ' active' : '');
      button.textContent = month + '月';
      button.dataset.month = String(month);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', month === activeMonth ? 'true' : 'false');

      button.addEventListener('click', (function (monthValue) {
        return function () {
          activeMonth = monthValue;
          updateMonthTabState();
          renderAllMonthSections();
          scrollTabToMonth(monthValue, true);
        };
      })(month));

      monthTabs.appendChild(button);
    }
  }

  function updateMonthTabState() {
    var buttons = monthTabs.querySelectorAll('.month-tab');
    buttons.forEach(function (button) {
      var month = Number(button.dataset.month);
      var isActive = month === activeMonth;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function scrollTabToMonth(month, smooth) {
    var target = monthTabs.querySelector('.month-tab[data-month="' + month + '"]');
    if (!target) {
      return;
    }
    monthTabs.scrollTo({
      left: Math.max(0, target.offsetLeft - 2),
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  function renderAllMonthSections() {
    monthSections.innerHTML = '';
    var section = buildMonthSection(activeMonth);
    monthSections.appendChild(section);
    requestAnimationFrame(function () {
      syncStickyOffsetsForSection(section);
    });
  }

  function buildMonthSection(month) {
    var section = document.createElement('section');
    section.className = 'month-section';
    section.dataset.month = String(month);
    var stickyHead = document.createElement('div');
    stickyHead.className = 'month-sticky-head';
    var fixedHead = document.createElement('div');
    fixedHead.className = 'month-fixed-head';

    var headScroll = document.createElement('div');
    headScroll.className = 'table-scroll head-scroll';

    var bodyScroll = document.createElement('div');
    bodyScroll.className = 'table-scroll body-scroll';
    bodyScroll.dataset.month = String(month);

    var yearState = C.ensureYearState(state, selectedYear);
    var entries = yearState.entries;
    var stats = C.computeMonthStats(selectedYear, month, entries);
    var fixedHeadTable = buildMonthFixedHeadTable(stats);
    var headerTable = buildMonthHeaderTable(stats);
    var bodyTable = buildMonthBodyTable(month, entries, bodyScroll);

    fixedHead.appendChild(fixedHeadTable);
    headScroll.appendChild(headerTable);
    stickyHead.appendChild(fixedHead);
    stickyHead.appendChild(headScroll);
    bodyScroll.appendChild(bodyTable);

    section.appendChild(stickyHead);
    section.appendChild(bodyScroll);

    linkHorizontalScroll(headScroll, bodyScroll, month);

    var restoredScroll = Number(yearState.ui.monthScroll[String(month)] || 0);
    requestAnimationFrame(function () {
      bodyScroll.scrollLeft = restoredScroll;
      headScroll.scrollLeft = bodyScroll.scrollLeft;
    });

    return section;
  }

  function linkHorizontalScroll(headScroll, bodyScroll, month) {
    bodyScroll.addEventListener('scroll', function () {
      headScroll.scrollLeft = bodyScroll.scrollLeft;
      var ui = C.ensureYearState(state, selectedYear).ui;
      ui.monthScroll[String(month)] = Math.round(bodyScroll.scrollLeft);
      scheduleSave();
    }, { passive: true });
  }

  function createAggregateValues(stats) {
    return {
      date: '集計',
      weekday: '-',
      wakeTime: C.formatMinutesToClock(stats.wakeAvg),
      bedTime: C.formatMinutesToClock(stats.bedAvg),
      sleepDuration: C.formatDuration(stats.sleepAvg),
      morningMeditation: String(Math.round(stats.totals.morningMeditation)),
      yoga: C.formatPercent(stats.checkRates.yoga),
      morningStairs: C.formatPercent(stats.checkRates.morningStairs),
      mercari: String(Math.round(stats.totals.mercari)),
      paleo: String(Math.round(stats.totals.paleo)),
      walk: String(Math.round(stats.totals.walk)),
      nightStairs: C.formatPercent(stats.checkRates.nightStairs),
      reading: String(Math.round(stats.totals.reading)),
      bathMeditation: String(Math.round(stats.totals.bathMeditation)),
      weight: stats.monthEndWeight === null ? '-' : C.formatNumber(stats.monthEndWeight, 1)
    };
  }

  function appendHeaderRows(thead, aggregateValues, columns, useStickyColumns) {
    var targetColumns = columns || TABLE_COLUMNS;
    var stickyEnabled = Boolean(useStickyColumns);
    var aggregateRow = document.createElement('tr');
    aggregateRow.className = 'aggregate-row';

    targetColumns.forEach(function (column, columnIndex) {
      var th = document.createElement('th');
      th.dataset.column = column.key;
      th.textContent = aggregateValues[column.key] || '-';
      if (stickyEnabled && columnIndex === 0) {
        th.classList.add('sticky-col-1');
      }
      if (stickyEnabled && columnIndex === 1) {
        th.classList.add('sticky-col-2');
      }
      aggregateRow.appendChild(th);
    });

    var columnRow = document.createElement('tr');
    columnRow.className = 'column-row';
    targetColumns.forEach(function (column, columnIndex) {
      var th = document.createElement('th');
      th.dataset.column = column.key;
      th.textContent = column.label;
      if (stickyEnabled && columnIndex === 0) {
        th.classList.add('sticky-col-1');
      }
      if (stickyEnabled && columnIndex === 1) {
        th.classList.add('sticky-col-2');
      }
      columnRow.appendChild(th);
    });

    thead.appendChild(aggregateRow);
    thead.appendChild(columnRow);
  }

  function appendColgroup(table, columns) {
    var targetColumns = columns || TABLE_COLUMNS;
    var colgroup = document.createElement('colgroup');
    targetColumns.forEach(function (column) {
      var col = document.createElement('col');
      var width = COLUMN_WIDTHS[column.key] || 84;
      col.style.width = width + 'px';
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);
  }

  function buildMonthFixedHeadTable(stats) {
    var table = document.createElement('table');
    table.className = 'month-table month-fixed-head-table';

    var fixedColumns = TABLE_COLUMNS.slice(0, 2);
    appendColgroup(table, fixedColumns);

    var thead = document.createElement('thead');
    appendHeaderRows(thead, createAggregateValues(stats), fixedColumns, false);
    table.appendChild(thead);

    return table;
  }

  function buildMonthHeaderTable(stats) {
    var table = document.createElement('table');
    table.className = 'month-table month-head-table';

    var headerColumns = TABLE_COLUMNS.slice(2);
    appendColgroup(table, headerColumns);

    var thead = document.createElement('thead');
    appendHeaderRows(thead, createAggregateValues(stats), headerColumns, false);
    table.appendChild(thead);

    return table;
  }

  function buildMonthBodyTable(month, entries, wrapper) {
    var table = document.createElement('table');
    table.className = 'month-table month-body-table';

    appendColgroup(table);

    var tbody = document.createElement('tbody');
    var daysInMonth = C.getDaysInMonth(selectedYear, month);

    for (var day = 1; day <= daysInMonth; day += 1) {
      var dateKey = C.toDateKey(selectedYear, month, day);
      var row = document.createElement('tr');
      var entry = entries[dateKey] || {};
      var dateObj = new Date(selectedYear, month - 1, day);
      var dayType = C.getDayType(dateKey);

      TABLE_COLUMNS.forEach(function (column, columnIndex) {
        var cell = document.createElement('td');
        cell.dataset.column = column.key;

        if (columnIndex === 0) {
          cell.classList.add('sticky-col-1');
        }
        if (columnIndex === 1) {
          cell.classList.add('sticky-col-2');
        }

        if (column.key === 'date') {
          cell.textContent = month + '/' + day;
          applyDayStyle(cell, dayType, true);
        } else if (column.key === 'weekday') {
          cell.textContent = C.getWeekdayLabel(dateObj);
          applyDayStyle(cell, dayType, false);
        } else if (column.key === 'sleepDuration') {
          var duration = C.getSleepDurationMinutes(entries, dateKey);
          cell.classList.add('sleep-cell', 'value-cell');
          cell.textContent = C.formatDuration(duration);
          var sleepColor = C.getSleepColor(duration);
          if (sleepColor) {
            cell.style.background = sleepColor;
          }
        } else if (column.key === 'wakeTime' || column.key === 'bedTime') {
          var input = createTimeInput(column.key, entry[column.key] || '', dateKey, month, wrapper, cell);
          cell.appendChild(input);

          var minute = C.parseTimeToMinutes(entry[column.key] || '');
          var color = column.key === 'wakeTime' ? C.getWakeColor(minute) : C.getBedColor(minute);
          if (color) {
            cell.style.background = color;
          }
        } else if (isSelectField(column.key)) {
          var selectInput = createSelectInput(column.key, entry[column.key], dateKey, month, wrapper, cell);
          cell.appendChild(selectInput);
        } else if (isCheckField(column.key)) {
          var checkbox = createCheckInput(column.key, Boolean(entry[column.key]), dateKey, month, wrapper, cell);
          cell.appendChild(checkbox);
          applyCheckCellStyle(cell, column.key, Boolean(entry[column.key]));
        } else if (column.key === 'weight') {
          var weightInput = createWeightInput(entry.weight, dateKey, month, wrapper, cell);
          cell.appendChild(weightInput);
        }

        row.appendChild(cell);
      });

      tbody.appendChild(row);
    }

    table.appendChild(tbody);

    return table;
  }

  function applyDayStyle(cell, dayType, isDateColumn) {
    if (dayType === 'holiday') {
      cell.classList.add(isDateColumn ? 'date-holiday' : 'weekday-holiday');
      return;
    }
    if (dayType === 'saturday') {
      cell.classList.add(isDateColumn ? 'date-sat' : 'weekday-sat');
    }
  }

  function isSelectField(fieldKey) {
    var field = C.FIELDS[fieldKey];
    return field && field.kind === 'select';
  }

  function isCheckField(fieldKey) {
    var field = C.FIELDS[fieldKey];
    return field && field.kind === 'check';
  }

  function createTimeInput(fieldKey, value, dateKey, month, wrapper, cell) {
    var input = document.createElement('input');
    input.type = 'time';
    input.step = '60';
    input.className = 'time-input';
    input.value = value || '';

    input.addEventListener('focus', function () {
      rememberTouched(month, fieldKey, wrapper, cell);
    });

    input.addEventListener('change', function () {
      persistField(dateKey, month, fieldKey, input.value || null, true);
    });

    return input;
  }

  function createSelectInput(fieldKey, value, dateKey, month, wrapper, cell) {
    var field = C.FIELDS[fieldKey];
    var select = document.createElement('select');
    var seededDefaultPending = false;
    select.className = 'select-input';

    var emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '';
    select.appendChild(emptyOption);

    for (var i = field.min; i <= field.max; i += field.step) {
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      select.appendChild(option);
    }

    if (value !== undefined && value !== null && value !== '') {
      select.value = String(value);
    }

    function applyDefaultIfNeeded() {
      if (select.value !== '') {
        return false;
      }
      select.value = String(field.defaultValue);
      seededDefaultPending = persistField(dateKey, month, fieldKey, field.defaultValue, false);
      return true;
    }

    function handleFirstTap(event) {
      rememberTouched(month, fieldKey, wrapper, cell);
      var seeded = applyDefaultIfNeeded();
      if (seeded) {
        if (AUTO_CLOSE_DEFAULT_FIELDS[fieldKey]) {
          if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          requestAnimationFrame(function () {
            select.blur();
            if (seededDefaultPending) {
              seededDefaultPending = false;
              rerenderMonthSection(month);
            }
          });
        }
        return true;
      }
      return false;
    }

    select.addEventListener('pointerdown', function (event) {
      handleFirstTap(event);
    });

    select.addEventListener('focus', function (event) {
      var seeded = handleFirstTap(event);
      if (seeded) {
        return;
      }
    });

    select.addEventListener('change', function () {
      var parsed = Number(select.value);
      seededDefaultPending = false;
      persistField(dateKey, month, fieldKey, Number.isFinite(parsed) ? parsed : null, true);
    });

    select.addEventListener('blur', function () {
      if (!seededDefaultPending) {
        return;
      }
      seededDefaultPending = false;
      rerenderMonthSection(month);
    });

    return select;
  }

  function createCheckInput(fieldKey, checked, dateKey, month, wrapper, cell) {
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'check-input';
    input.checked = checked;

    input.addEventListener('focus', function () {
      rememberTouched(month, fieldKey, wrapper, cell);
    });

    input.addEventListener('pointerdown', function () {
      rememberTouched(month, fieldKey, wrapper, cell);
    });

    input.addEventListener('change', function () {
      persistField(dateKey, month, fieldKey, input.checked, true);
    });

    cell.classList.add('check-cell');

    return input;
  }

  function createWeightInput(value, dateKey, month, wrapper, cell) {
    var input = document.createElement('input');
    input.type = 'number';
    input.className = 'weight-input';
    input.step = '0.1';
    input.min = String(C.FIELDS.weight.min);
    input.max = String(C.FIELDS.weight.max);
    input.inputMode = 'decimal';
    input.value = value === undefined || value === null ? '' : String(value);

    input.addEventListener('focus', function () {
      rememberTouched(month, 'weight', wrapper, cell);
    });

    input.addEventListener('change', function () {
      if (!input.value) {
        persistField(dateKey, month, 'weight', null, true);
        return;
      }
      var parsed = Number(input.value);
      persistField(dateKey, month, 'weight', Number.isFinite(parsed) ? parsed : null, true);
    });

    return input;
  }

  function applyCheckCellStyle(cell, fieldKey, checked) {
    cell.classList.remove('yoga-on', 'morning-stairs-on', 'night-stairs-on');
    if (!checked) {
      return;
    }
    if (fieldKey === 'yoga') {
      cell.classList.add('yoga-on');
      return;
    }
    if (fieldKey === 'morningStairs') {
      cell.classList.add('morning-stairs-on');
      return;
    }
    if (fieldKey === 'nightStairs') {
      cell.classList.add('night-stairs-on');
    }
  }

  function rememberTouched(month, fieldKey, wrapper, cell) {
    var yearState = C.ensureYearState(state, selectedYear);
    yearState.ui.lastTouchedColumn[String(month)] = fieldKey;

    var table = cell.closest('.month-table');
    var tableStickyWidth = table ? parseInt(getComputedStyle(table).getPropertyValue('--table-sticky-left-width'), 10) : NaN;
    var stickyWidth = Number.isFinite(tableStickyWidth) && tableStickyWidth > 0
      ? tableStickyWidth
      : (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sticky-left-width'), 10) || 122);
    var target = Math.max(0, cell.offsetLeft - stickyWidth - 4);

    wrapper.scrollTo({ left: target, behavior: 'smooth' });

    yearState.ui.monthScroll[String(month)] = Math.round(target);
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(function () {
      C.saveState(state);
      saveTimer = null;
    }, 180);
  }

  function persistField(dateKey, month, fieldKey, value, rerender) {
    var yearState = C.ensureYearState(state, selectedYear);
    var entries = yearState.entries;
    var beforeSnapshot = entries[dateKey] ? JSON.stringify(entries[dateKey]) : '';
    var current = entries[dateKey] ? Object.assign({}, entries[dateKey]) : {};
    var field = C.FIELDS[fieldKey] || null;

    if (field && field.kind === 'check') {
      if (value) {
        current[fieldKey] = true;
      } else {
        delete current[fieldKey];
      }
    } else if (value === null || value === '' || typeof value === 'undefined') {
      delete current[fieldKey];
    } else if (field && field.kind === 'select') {
      current[fieldKey] = Number(value);
    } else if (fieldKey === 'weight') {
      current[fieldKey] = Number(value);
    } else {
      current[fieldKey] = value;
    }

    if (!Object.keys(current).length) {
      delete entries[dateKey];
    } else {
      entries[dateKey] = current;
    }

    var afterSnapshot = entries[dateKey] ? JSON.stringify(entries[dateKey]) : '';
    if (beforeSnapshot === afterSnapshot) {
      return false;
    }

    C.saveState(state);

    if (rerender !== false) {
      rerenderAffectedMonths(month, dateKey, fieldKey);
    }
    return true;
  }

  function rerenderAffectedMonths(month, dateKey, fieldKey) {
    var months = new Set([month]);

    if (fieldKey === 'bedTime') {
      var parsed = C.parseDateKey(dateKey);
      var daysInMonth = C.getDaysInMonth(selectedYear, month);
      if (parsed.day === daysInMonth && month < 12) {
        months.add(month + 1);
      }
    }

    months.forEach(function (monthValue) {
      rerenderMonthSection(monthValue);
    });
  }

  function rerenderMonthSection(month) {
    var currentSection = monthSections.querySelector('.month-section[data-month="' + month + '"]');
    if (!currentSection) {
      return;
    }

    var replacement = buildMonthSection(month);
    monthSections.replaceChild(replacement, currentSection);
    syncStickyOffsetsForSection(replacement);
    updateStickyOffsets();
  }

  function updateStickyOffsets() {
    if (!topHeader) {
      return;
    }
    var height = topHeader.offsetHeight;
    document.documentElement.style.setProperty('--header-height', height + 'px');
    document.documentElement.style.setProperty('--table-sticky-top', height + 'px');
    syncStickyOffsetsForSection(monthSections.querySelector('.month-section'));
  }

  async function refreshToLatest() {
    if (!window.confirm(UPDATE_CONFIRM_MESSAGE)) {
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        var registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(function (registration) {
          return registration.update();
        }));

        registrations.forEach(function (registration) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });

        await waitControllerChange();
      }

      if (window.caches) {
        var keys = await caches.keys();
        await Promise.all(keys.filter(function (key) {
          return key.indexOf(C.CACHE_PREFIX) === 0;
        }).map(function (key) {
          return caches.delete(key);
        }));
      }

      var refreshTargets = [
        './',
        './index.html',
        './summary.html',
        './styles.css?v=' + ASSET_VERSION,
        './common.js?v=' + ASSET_VERSION,
        './app.js?v=' + ASSET_VERSION,
        './summary.js?v=' + ASSET_VERSION,
        './manifest.webmanifest'
      ];

      await Promise.all(refreshTargets.map(function (url) {
        return fetch(url, { cache: 'reload' }).catch(function () {
          return null;
        });
      }));
    } catch (error) {
      console.warn('update flow failed', error);
    }

    var nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('updatedAt', Date.now().toString());
    window.location.replace(nextUrl.toString());
  }

  function waitControllerChange() {
    return new Promise(function (resolve) {
      if (!('serviceWorker' in navigator)) {
        resolve();
        return;
      }

      var done = false;
      var timeout = setTimeout(function () {
        if (done) {
          return;
        }
        done = true;
        resolve();
      }, 1200);

      function onControllerChange() {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        resolve();
      }

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (error) {
        console.warn('service worker registration failed', error);
      });
    });
  }
})();


