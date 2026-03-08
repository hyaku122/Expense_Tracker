(function () {
  'use strict';

  var APP_VERSION = '1.0.0';
  var STORAGE_KEY = 'mindful-life-log-state-v1';
  var BACKUP_PREFIX = 'MLL_BACKUP_V1:';
  var CACHE_PREFIX = 'mindful-life-log-cache';
  var DEFAULT_YEAR = 2026;

  var FIELDS = {
    wakeTime: { key: 'wakeTime', label: '起床', kind: 'time' },
    bedTime: { key: 'bedTime', label: '就寝', kind: 'time' },
    sleepDuration: { key: 'sleepDuration', label: '睡眠時間', kind: 'derived' },
    morningMeditation: {
      key: 'morningMeditation',
      label: '朝瞑想',
      kind: 'select',
      min: 0,
      max: 60,
      step: 1,
      defaultValue: 20
    },
    yoga: { key: 'yoga', label: 'ヨガ', kind: 'check' },
    morningStairs: { key: 'morningStairs', label: '朝階段', kind: 'check' },
    mercari: {
      key: 'mercari',
      label: 'メルカリ',
      kind: 'select',
      min: 0,
      max: 20,
      step: 1,
      defaultValue: 2
    },
    paleo: {
      key: 'paleo',
      label: 'パレオ',
      kind: 'select',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1
    },
    walk: {
      key: 'walk',
      label: '散歩',
      kind: 'select',
      min: 0,
      max: 180,
      step: 1,
      defaultValue: 40
    },
    nightStairs: { key: 'nightStairs', label: '夜階段', kind: 'check' },
    reading: {
      key: 'reading',
      label: '読書',
      kind: 'select',
      min: 1,
      max: 120,
      step: 1,
      defaultValue: 15
    },
    bathMeditation: {
      key: 'bathMeditation',
      label: '風呂瞑想',
      kind: 'select',
      min: 5,
      max: 10,
      step: 1,
      defaultValue: 10
    },
    weight: {
      key: 'weight',
      label: '体重',
      kind: 'number',
      min: 20,
      max: 200,
      step: 0.1
    }
  };

  var TOTAL_KEYS = ['morningMeditation', 'mercari', 'paleo', 'walk', 'reading', 'bathMeditation'];
  var CHECK_KEYS = ['yoga', 'morningStairs', 'nightStairs'];

  var WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
  var MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  function createDefaultState(nowYear) {
    return {
      schemaVersion: 1,
      appVersion: APP_VERSION,
      selectedYear: nowYear || DEFAULT_YEAR,
      years: {}
    };
  }

  function sanitizeState(raw, nowYear) {
    var fallback = createDefaultState(nowYear);
    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    var sanitized = {
      schemaVersion: 1,
      appVersion: APP_VERSION,
      selectedYear: typeof raw.selectedYear === 'number' ? raw.selectedYear : (nowYear || DEFAULT_YEAR),
      years: {}
    };

    var years = raw.years;
    if (!years || typeof years !== 'object') {
      return sanitized;
    }

    Object.keys(years).forEach(function (yearKey) {
      var srcYear = years[yearKey];
      if (!srcYear || typeof srcYear !== 'object') {
        return;
      }

      var entries = srcYear.entries;
      var ui = srcYear.ui;

      sanitized.years[yearKey] = {
        entries: entries && typeof entries === 'object' ? entries : {},
        ui: {
          monthScroll: ui && ui.monthScroll && typeof ui.monthScroll === 'object' ? ui.monthScroll : {},
          lastTouchedColumn: ui && ui.lastTouchedColumn && typeof ui.lastTouchedColumn === 'object' ? ui.lastTouchedColumn : {}
        }
      };
    });

    return sanitized;
  }

  function loadState(nowYear) {
    try {
      var text = localStorage.getItem(STORAGE_KEY);
      if (!text) {
        return createDefaultState(nowYear);
      }
      var parsed = JSON.parse(text);
      return sanitizeState(parsed, nowYear);
    } catch (error) {
      console.warn('state load failed', error);
      return createDefaultState(nowYear);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureYearState(state, year) {
    var yearKey = String(year);
    if (!state.years[yearKey]) {
      state.years[yearKey] = {
        entries: {},
        ui: {
          monthScroll: {},
          lastTouchedColumn: {}
        }
      };
    }
    return state.years[yearKey];
  }

  function getEntriesForYear(state, year) {
    return ensureYearState(state, year).entries;
  }

  function setSelectedYear(state, year) {
    state.selectedYear = year;
  }

  function pad2(number) {
    return String(number).padStart(2, '0');
  }

  function toDateKey(year, month, day) {
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  function parseDateKey(dateKey) {
    var parts = dateKey.split('-').map(function (part) {
      return parseInt(part, 10);
    });
    return {
      year: parts[0],
      month: parts[1],
      day: parts[2]
    };
  }

  function dateFromKey(dateKey) {
    var parsed = parseDateKey(dateKey);
    return new Date(parsed.year, parsed.month - 1, parsed.day);
  }

  function shiftDateKey(dateKey, offsetDays) {
    var date = dateFromKey(dateKey);
    date.setDate(date.getDate() + offsetDays);
    return toDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function parseTimeToMinutes(value) {
    if (typeof value !== 'string' || !value.includes(':')) {
      return null;
    }
    var parts = value.split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parseInt(parts[1], 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return null;
    }
    return hour * 60 + minute;
  }

  function formatMinutesToClock(totalMinutes) {
    if (typeof totalMinutes !== 'number' || Number.isNaN(totalMinutes)) {
      return '-';
    }
    var normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    var hour = Math.floor(normalized / 60);
    var minute = normalized % 60;
    return hour + ':' + pad2(minute);
  }

  function formatDuration(totalMinutes) {
    if (typeof totalMinutes !== 'number' || Number.isNaN(totalMinutes)) {
      return '-';
    }
    var rounded = Math.round(totalMinutes);
    var hour = Math.floor(rounded / 60);
    var minute = rounded % 60;
    return hour + ':' + pad2(minute);
  }

  function formatNumber(value, fractionDigits) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '-';
    }
    return value.toFixed(fractionDigits);
  }

  function formatPercent(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '-';
    }
    return value.toFixed(1) + '%';
  }

  function toNumberOrNull(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return null;
    }
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getWeekdayLabel(dateObj) {
    return WEEKDAY_LABELS[dateObj.getDay()];
  }

  function getNthWeekday(year, month, weekday, nth) {
    var date = new Date(year, month - 1, 1);
    var count = 0;
    while (date.getMonth() === month - 1) {
      if (date.getDay() === weekday) {
        count += 1;
        if (count === nth) {
          return date.getDate();
        }
      }
      date.setDate(date.getDate() + 1);
    }
    return null;
  }

  function calcVernalEquinoxDay(year) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  function calcAutumnEquinoxDay(year) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  function generateJapaneseHolidays(year) {
    var set = new Set();

    function add(month, day) {
      if (!day) {
        return;
      }
      set.add(toDateKey(year, month, day));
    }

    add(1, 1);
    add(1, getNthWeekday(year, 1, 1, 2));
    add(2, 11);
    add(2, 23);
    add(3, calcVernalEquinoxDay(year));
    add(4, 29);
    add(5, 3);
    add(5, 4);
    add(5, 5);
    add(7, getNthWeekday(year, 7, 1, 3));
    add(8, 11);
    add(9, getNthWeekday(year, 9, 1, 3));
    add(9, calcAutumnEquinoxDay(year));
    add(10, getNthWeekday(year, 10, 1, 2));
    add(11, 3);
    add(11, 23);

    applySubstituteHolidays(set, year);
    applyCitizensHoliday(set, year);
    applySubstituteHolidays(set, year);

    return set;
  }

  function applySubstituteHolidays(holidaySet, year) {
    var added = [];
    holidaySet.forEach(function (dateKey) {
      var date = dateFromKey(dateKey);
      if (date.getDay() !== 0) {
        return;
      }
      var substitute = new Date(date);
      substitute.setDate(substitute.getDate() + 1);
      while (substitute.getFullYear() === year) {
        var candidate = toDateKey(substitute.getFullYear(), substitute.getMonth() + 1, substitute.getDate());
        if (!holidaySet.has(candidate)) {
          added.push(candidate);
          break;
        }
        substitute.setDate(substitute.getDate() + 1);
      }
    });

    added.forEach(function (key) {
      holidaySet.add(key);
    });
  }

  function applyCitizensHoliday(holidaySet, year) {
    var date = new Date(year, 0, 2);
    while (date.getFullYear() === year && !(date.getMonth() === 11 && date.getDate() === 31)) {
      var current = toDateKey(year, date.getMonth() + 1, date.getDate());
      if (!holidaySet.has(current)) {
        var prevDate = new Date(date);
        prevDate.setDate(date.getDate() - 1);
        var nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        var prevKey = toDateKey(year, prevDate.getMonth() + 1, prevDate.getDate());
        var nextKey = toDateKey(year, nextDate.getMonth() + 1, nextDate.getDate());
        if (holidaySet.has(prevKey) && holidaySet.has(nextKey)) {
          holidaySet.add(current);
        }
      }
      date.setDate(date.getDate() + 1);
    }
  }

  var holidayCache = {};

  function getHolidaySet(year) {
    var key = String(year);
    if (!holidayCache[key]) {
      holidayCache[key] = generateJapaneseHolidays(year);
    }
    return holidayCache[key];
  }

  function isJapaneseHoliday(dateKey) {
    var parsed = parseDateKey(dateKey);
    return getHolidaySet(parsed.year).has(dateKey);
  }

  function getDayType(dateKey) {
    var date = dateFromKey(dateKey);
    if (isJapaneseHoliday(dateKey) || date.getDay() === 0) {
      return 'holiday';
    }
    if (date.getDay() === 6) {
      return 'saturday';
    }
    return 'weekday';
  }

  function getEntry(entries, dateKey) {
    return entries[dateKey] || null;
  }

  function getSleepDurationMinutes(entries, dateKey) {
    var prevDateKey = shiftDateKey(dateKey, -1);
    var prevEntry = entries[prevDateKey] || null;
    var currentEntry = entries[dateKey] || null;

    if (!prevEntry || !currentEntry) {
      return null;
    }

    var bedtime = parseTimeToMinutes(prevEntry.bedTime);
    var wake = parseTimeToMinutes(currentEntry.wakeTime);
    if (bedtime === null || wake === null) {
      return null;
    }

    var duration = wake - bedtime;
    if (duration <= 0) {
      duration += 1440;
    }
    return duration;
  }

  function parseAverageBedtime(entries, dateKeys) {
    var values = [];
    dateKeys.forEach(function (dateKey) {
      var entry = entries[dateKey];
      if (!entry || !entry.bedTime) {
        return;
      }
      var minute = parseTimeToMinutes(entry.bedTime);
      if (minute === null) {
        return;
      }
      if (minute < 720) {
        minute += 1440;
      }
      values.push(minute);
    });

    if (!values.length) {
      return null;
    }

    var sum = values.reduce(function (acc, item) {
      return acc + item;
    }, 0);
    var avg = sum / values.length;
    if (avg >= 1440) {
      avg -= 1440;
    }
    return avg;
  }

  function parseAverageWake(entries, dateKeys) {
    var values = [];
    dateKeys.forEach(function (dateKey) {
      var entry = entries[dateKey];
      if (!entry || !entry.wakeTime) {
        return;
      }
      var minute = parseTimeToMinutes(entry.wakeTime);
      if (minute === null) {
        return;
      }
      values.push(minute);
    });

    if (!values.length) {
      return null;
    }

    var sum = values.reduce(function (acc, item) {
      return acc + item;
    }, 0);

    return sum / values.length;
  }

  function parseAverageSleep(entries, dateKeys) {
    var values = [];
    dateKeys.forEach(function (dateKey) {
      var duration = getSleepDurationMinutes(entries, dateKey);
      if (duration === null) {
        return;
      }
      values.push(duration);
    });

    if (!values.length) {
      return null;
    }

    var sum = values.reduce(function (acc, item) {
      return acc + item;
    }, 0);

    return sum / values.length;
  }

  function computeMonthStats(year, month, entries) {
    var daysInMonth = getDaysInMonth(year, month);
    var dateKeys = [];
    var totals = {
      morningMeditation: 0,
      mercari: 0,
      paleo: 0,
      walk: 0,
      reading: 0,
      bathMeditation: 0
    };
    var checks = {
      yoga: 0,
      morningStairs: 0,
      nightStairs: 0
    };

    var monthEndWeight = null;

    for (var day = 1; day <= daysInMonth; day += 1) {
      var dateKey = toDateKey(year, month, day);
      dateKeys.push(dateKey);
      var entry = entries[dateKey] || null;

      if (entry) {
        TOTAL_KEYS.forEach(function (key) {
          var value = toNumberOrNull(entry[key]);
          if (value !== null) {
            totals[key] += value;
          }
        });

        CHECK_KEYS.forEach(function (key) {
          if (entry[key]) {
            checks[key] += 1;
          }
        });
      }
    }

    for (var reverseDay = daysInMonth; reverseDay >= 1; reverseDay -= 1) {
      var reverseKey = toDateKey(year, month, reverseDay);
      var reverseEntry = entries[reverseKey] || null;
      var weight = reverseEntry ? toNumberOrNull(reverseEntry.weight) : null;
      if (weight !== null) {
        monthEndWeight = weight;
        break;
      }
    }

    return {
      daysInMonth: daysInMonth,
      dateKeys: dateKeys,
      wakeAvg: parseAverageWake(entries, dateKeys),
      bedAvg: parseAverageBedtime(entries, dateKeys),
      sleepAvg: parseAverageSleep(entries, dateKeys),
      totals: totals,
      checkRates: {
        yoga: (checks.yoga / daysInMonth) * 100,
        morningStairs: (checks.morningStairs / daysInMonth) * 100,
        nightStairs: (checks.nightStairs / daysInMonth) * 100
      },
      checks: checks,
      monthEndWeight: monthEndWeight
    };
  }

  function computeYearStats(year, entries) {
    var rows = [];
    for (var month = 1; month <= 12; month += 1) {
      rows.push({
        month: month,
        stats: computeMonthStats(year, month, entries)
      });
    }
    return rows;
  }

  function createUtf8Base64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    bytes.forEach(function (byte) {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function parseUtf8Base64(base64Text) {
    var binary = atob(base64Text);
    var bytes = Uint8Array.from(binary, function (char) {
      return char.charCodeAt(0);
    });
    return new TextDecoder().decode(bytes);
  }

  function createBackupString(state) {
    var payload = {
      format: 'mindful-life-log',
      backupVersion: '1',
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      state: state
    };
    return BACKUP_PREFIX + createUtf8Base64(JSON.stringify(payload));
  }

  function restoreStateFromBackupString(backupText) {
    if (typeof backupText !== 'string' || !backupText.startsWith(BACKUP_PREFIX)) {
      throw new Error('バックアップ文字列の形式が不正です。');
    }

    var encoded = backupText.slice(BACKUP_PREFIX.length);
    var payloadText = parseUtf8Base64(encoded);
    var payload = JSON.parse(payloadText);

    if (!payload || payload.format !== 'mindful-life-log' || !payload.state) {
      throw new Error('バックアップデータを解釈できません。');
    }

    return sanitizeState(payload.state, DEFAULT_YEAR);
  }

  function getWakeColor(minutes) {
    if (minutes === null) {
      return '';
    }
    if (minutes <= 330) return '#8ec9ff';
    if (minutes <= 390) return '#9aeaf3';
    if (minutes <= 450) return '#bcf7ff';
    if (minutes <= 510) return '#f6d6e7';
    return '#f5b8b8';
  }

  function getBedColor(minutes) {
    if (minutes === null) {
      return '';
    }

    var normalized = minutes < 720 ? minutes + 1440 : minutes;

    if (normalized <= 1320) return '#cbe2ff';
    if (normalized <= 1380) return '#d8d0ff';
    if (normalized <= 1440) return '#e8d3ff';
    if (normalized <= 1500) return '#ffdcbc';
    return '#f7b7b7';
  }

  function getSleepColor(durationMinutes) {
    if (durationMinutes === null) {
      return '';
    }

    if (durationMinutes < 330) return '#f8b9b9';
    if (durationMinutes < 390) return '#ffdcae';
    if (durationMinutes < 450) return '#d7edb6';
    if (durationMinutes < 510) return '#99e7d1';
    if (durationMinutes < 570) return '#74dce0';
    return '#b6d7ff';
  }

  window.MLLCommon = {
    APP_VERSION: APP_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    BACKUP_PREFIX: BACKUP_PREFIX,
    CACHE_PREFIX: CACHE_PREFIX,
    DEFAULT_YEAR: DEFAULT_YEAR,
    FIELDS: FIELDS,
    TOTAL_KEYS: TOTAL_KEYS,
    CHECK_KEYS: CHECK_KEYS,
    WEEKDAY_LABELS: WEEKDAY_LABELS,
    MONTH_LABELS: MONTH_LABELS,
    loadState: loadState,
    saveState: saveState,
    ensureYearState: ensureYearState,
    getEntriesForYear: getEntriesForYear,
    setSelectedYear: setSelectedYear,
    toDateKey: toDateKey,
    parseDateKey: parseDateKey,
    dateFromKey: dateFromKey,
    shiftDateKey: shiftDateKey,
    getDaysInMonth: getDaysInMonth,
    parseTimeToMinutes: parseTimeToMinutes,
    formatMinutesToClock: formatMinutesToClock,
    formatDuration: formatDuration,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    toNumberOrNull: toNumberOrNull,
    getWeekdayLabel: getWeekdayLabel,
    isJapaneseHoliday: isJapaneseHoliday,
    getDayType: getDayType,
    getEntry: getEntry,
    getSleepDurationMinutes: getSleepDurationMinutes,
    computeMonthStats: computeMonthStats,
    computeYearStats: computeYearStats,
    createBackupString: createBackupString,
    restoreStateFromBackupString: restoreStateFromBackupString,
    getWakeColor: getWakeColor,
    getBedColor: getBedColor,
    getSleepColor: getSleepColor
  };
})();
