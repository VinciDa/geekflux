(function () {
  'use strict';

  var WRITE_KEY = '3e8b1c6a-9f24-4d71-b5a0-2c7e91d4f608';
  var ENDPOINT = 'https://quizbanao.com/api/v1/audit-events';
  var APP_NAME = 'geekflux_web';

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getOrCreateId(storage, key) {
    try {
      var id = storage.getItem(key);
      if (!id) {
        id = uuid();
        storage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return uuid();
    }
  }

  var sessionId = getOrCreateId(sessionStorage, 'gf_session_id');
  var deviceId = getOrCreateId(localStorage, 'gf_device_id');

  function currentPage() {
    var path = window.location.pathname || '/';
    if (path !== '/' && !path.endsWith('/')) {
      path += '/';
    }
    return path;
  }

  function sendEvent(event, properties) {
    var payload = {
      app_name: APP_NAME,
      event: event,
      session_id: sessionId,
      occurred_at: new Date().toISOString(),
      event_id: uuid(),
      device_id: deviceId,
      platform: 'web',
      locale: navigator.language || 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      properties: properties
    };

    // Auth requires X-Audit-Write-Key (query write_key returns 401).
    // sendBeacon cannot set custom headers, so use fetch + keepalive.
    fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Audit-Write-Key': WRITE_KEY
      },
      keepalive: true,
      mode: 'cors'
    }).catch(function () {});
  }

  function appFromHref(href) {
    if (href.indexOf('readfast') !== -1) return 'readfast';
    if (href.indexOf('revu') !== -1) return 'revu';
    return 'unknown';
  }

  function articleSlugFromHref(href) {
    try {
      var url = new URL(href, window.location.origin);
      var path = url.pathname || '/';
      if (path !== '/' && !path.endsWith('/')) {
        path += '/';
      }
      return path;
    } catch (e) {
      return href;
    }
  }

  function trackPageView() {
    sendEvent('page_view', {
      page: currentPage(),
      referrer: document.referrer || ''
    });
  }

  function trackStoreClick(link) {
    var aside = link.closest('.article-aside');
    var position = 1;
    if (aside) {
      var promos = aside.querySelectorAll('.app-promo');
      for (var i = 0; i < promos.length; i++) {
        if (promos[i] === link) {
          position = i + 1;
          break;
        }
      }
    }

    var app = appFromHref(link.href);
    sendEvent('store_click', {
      page: currentPage(),
      placement: 'sidebar_' + app,
      store: 'ios',
      app: app,
      position: position
    });
  }

  function trackArticleClick(link, placement) {
    var container = link.closest('.post-card') || link.closest('.trend-list');
    var position = 1;

    if (link.closest('.post-card')) {
      var cards = document.querySelectorAll('.post-card .card-link');
      for (var i = 0; i < cards.length; i++) {
        if (cards[i] === link) {
          position = i + 1;
          break;
        }
      }
    } else if (link.closest('.trend-item')) {
      var items = document.querySelectorAll('.trend-item');
      for (var j = 0; j < items.length; j++) {
        if (items[j] === link) {
          position = j + 1;
          break;
        }
      }
    }

    sendEvent('article_click', {
      page: currentPage(),
      placement: placement,
      article_slug: articleSlugFromHref(link.getAttribute('href') || link.href),
      position: position
    });
  }

  function bindListeners() {
    document.addEventListener('click', function (e) {
      var target = e.target.closest('a');
      if (!target) return;

      if (target.classList.contains('app-promo')) {
        trackStoreClick(target);
        return;
      }

      if (currentPage() !== '/') return;

      if (target.classList.contains('card-link') && target.closest('.post-card')) {
        trackArticleClick(target, 'latest_card');
        return;
      }

      if (target.classList.contains('trend-item')) {
        trackArticleClick(target, 'trending_item');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      trackPageView();
      bindListeners();
    });
  } else {
    trackPageView();
    bindListeners();
  }
})();
