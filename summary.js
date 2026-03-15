(function () {
  'use strict';

  var C = window.MLLCommon;
  if (!C) {
    return;
  }

  var UPDATE_CONFIRM_MESSAGE = 'キャッシュを削除して最新版を読み込みます。入力データは消えません。実行しますか？';
  var MIN_YEAR = 2026;
  var MAX_YEAR = 2035;
  var ASSET_VERSION = '20260315-1';

  var summaryHeader = document.getElementById('summaryHeader');
  var summaryTitle = document.getElementById('summaryTitle');
  var yearLabel = document.getElementById('yearLabel');
  var yearPrevButton = document.getElementById('yearPrevButton');
  var yearNextButton = document.getElementById('yearNextButton');
  var backToMainButton = document.getElementById('backToMainButton');
  var yearSummaryTable = document.getElementById('yearSummaryTable');

  var updateButton = document.getElementById('updateButton');
  var settingsButton = document.getElementById('settingsButton');

  var settingsModal = document.getElementById('settingsModal');
  var closeSettingsButton = document.getElementById('closeSettingsButton');
  var createBackupButton = document.getElementById('createBackupButton');
  var backupOutput = document.getElementById('backupOutput');
  var restoreInput = document.getElementById('restoreInput');
  var restoreButton = document.getElementById('restoreButton');

  var now = new Date();
  var urlYear = parseInt(new URLSearchParams(window.location.search).get('year'), 10);
  var state = C.loadState(now.getFullYear());
  var selectedYear = sanitizeYear(Number.isFinite(urlYear) ? urlYear : state.selectedYear || now.getFullYear());

  init();

  function init() {
    bindEvents();
    registerServiceWorker();
    render();

    window.addEventListener('resize', updateStickyOffset);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        updateStickyOffset();
      }
    });

    requestAnimationFrame(updateStickyOffset);
  }

  function sanitizeYear(year) {
    if (!Number.isFinite(year)) {
      return C.DEFAULT_YEAR;
    }
    return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
  }

  function bindEvents() {
    yearPrevButton.addEventListener('click', function () {
      changeYear(-1);
    });

    yearNextButton.addEventListener('click', function () {
      changeYear(1);
    });

    backToMainButton.addEventListener('click', function () {
      window.location.href = 'index.html?year=' + selectedYear;
    });

    updateButton.addEventListener('click', refreshToLatest);
    settingsButton.addEventListener('click', openSettings);

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
        render();
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
    render();
  }

  function render() {
    C.ensureYearState(state, selectedYear);
    state.selectedYear = selectedYear;
    C.saveState(state);

    summaryTitle.textContent = selectedYear + '年総決算';
    yearLabel.textContent = selectedYear + '年';
    yearPrevButton.disabled = selectedYear <= MIN_YEAR;
    yearNextButton.disabled = selectedYear >= MAX_YEAR;

    renderYearSummaryTable();
    updateStickyOffset();
  }

  function renderYearSummaryTable() {
    var yearEntries = C.getEntriesForYear(state, selectedYear);
    var statsRows = C.computeYearStats(selectedYear, yearEntries);

    yearSummaryTable.innerHTML = '';

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');

    [
      '月',
      '起床',
      '就寝',
      '睡眠時間',
      '朝瞑想',
      'ヨガ',
      '朝階段',
      'メルカリ',
      'パレオ',
      '散歩',
      '夜階段',
      '読書',
      '瞑想♨',
      '体重'
    ].forEach(function (label, index) {
      var th = document.createElement('th');
      th.textContent = label;
      if (index === 0) {
        th.classList.add('month-col');
      }
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);

    var tbody = document.createElement('tbody');

    statsRows.forEach(function (row) {
      var tr = document.createElement('tr');
      var stats = row.stats;

      var cells = [
        row.month + '月',
        C.formatMinutesToClock(stats.wakeAvg),
        C.formatMinutesToClock(stats.bedAvg),
        C.formatDuration(stats.sleepAvg),
        C.formatDurationHM(stats.totals.morningMeditation),
        C.formatPercent(stats.checkRates.yoga),
        C.formatPercent(stats.checkRates.morningStairs),
        String(Math.round(stats.totals.mercari)),
        String(Math.round(stats.totals.paleo)),
        C.formatDurationHM(stats.totals.walk),
        C.formatPercent(stats.checkRates.nightStairs),
        C.formatDurationHM(stats.totals.reading),
        C.formatDurationHM(stats.totals.bathMeditation),
        stats.monthEndWeight === null ? '-' : C.formatNumber(stats.monthEndWeight, 1)
      ];

      cells.forEach(function (value, index) {
        var td = document.createElement('td');
        td.textContent = value;
        if (index === 0) {
          td.classList.add('month-col');
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    yearSummaryTable.appendChild(thead);
    yearSummaryTable.appendChild(tbody);
  }

  function updateStickyOffset() {
    if (!summaryHeader) {
      return;
    }
    var headerHeight = summaryHeader.offsetHeight;
    document.documentElement.style.setProperty('--summary-sticky-top', headerHeight + 8 + 'px');
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


