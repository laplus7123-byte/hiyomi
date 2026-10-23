/* HIYOMI プロジェクト管理：サイトの添削。サイトを同じオリジンの iframe で開き、クリックした要素に位置を結びつけて保存する */
(function () {
  'use strict';
  var K = window.Kanri, C = window.KANRI_CONFIG, $ = K.$, esc = K.esc;
  var LS = 'hiyomi-kanri:';
  var W = { sp: 390, pc: 1280 };
  var DEV_LABEL = { sp: 'スマホ', pc: 'PC' };
  var fr = $('#rvFrame'), stage = $('#rvStage'), device = $('#rvDevice'), layer = $('#rvLayer'),
    hover = $('#rvHover'), pop = $('#rvPop'), list = $('#rvList');
  var dev = localStorage.getItem(LS + 'dev') || (innerWidth < 720 ? 'sp' : 'pc');
  var scope = 'page', mode = false, active = '', draft = null, scale = 1;
  var started = false, afterLoad = null, cache = {}, pins = {}, listDirty = false;
  var TAP = matchMedia('(pointer: coarse)').matches ? 'タップ' : 'クリック';
  var siteDir = new URL('.', new URL(C.site, location.href)).href;
  var siteRel = C.site.replace(/[^/]*$/, '');

  /* ---------- ページの識別 ---------- */
  /* 鑑定結果は一人と相性（pd= あり）で画面が違うので別のページとして扱う */
  function keyOfHref(href) {
    var u = new URL(href, location.href);
    var route = u.hash.replace(/^#/, '').split('?')[0];
    if (route === 'kantei' && /[?&]pd=/.test(u.hash)) route += '-aisho';
    return (u.pathname.split('/').pop() || 'index.html') + (route ? '#' + route : '');
  }
  function labelOfKey(k) {
    var p = C.pages.find(function (p) { return keyOfHref(p.url) === k; });
    return p ? p.label.replace(/（見本）/, '') : k;
  }
  function frameInfo() {
    try {
      var w = fr.contentWindow, href = w.location.href;
      if (href === 'about:blank' || !w.document.body) return null;
      return { win: w, doc: w.document, key: keyOfHref(href), url: siteRel + href.replace(siteDir, '') };
    } catch (e) { return null; }
  }

  /* ---------- 表示幅とレイアウト ---------- */
  function layout() {
    var w = W[dev], avail = stage.clientWidth, h = stage.clientHeight;
    scale = Math.min(1, avail / w);
    device.style.width = w + 'px';
    device.style.height = (h / scale) + 'px';
    device.style.transform = 'scale(' + scale + ')';
    device.style.left = Math.max(0, (avail - w * scale) / 2) + 'px';
    K.$$('[data-dev]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.dev === dev)); });
  }
  function setDev(d) {
    if (d === dev) return;
    dev = d;
    localStorage.setItem(LS + 'dev', dev);
    closePop();
    layout();
  }
  K.$$('[data-dev]').forEach(function (b) { b.addEventListener('click', function () { setDev(b.dataset.dev); }); });
  window.addEventListener('resize', function () { if (started) layout(); });

  /* ---------- ページ移動 ---------- */
  function go(url, then) {
    var abs = new URL(url, location.href).href;
    afterLoad = then || null;
    var info = frameInfo();
    if (info && info.win.location.href.split('#')[0] === abs.split('#')[0]) {
      info.win.location.replace(abs);
      info.win.location.reload();
    } else {
      fr.src = abs;
    }
  }
  function fillPages() {
    var info = frameInfo(), cur = info ? info.key : '';
    var at = C.pages.findIndex(function (p) { return keyOfHref(p.url) === cur; });
    $('#rvPage').innerHTML = C.pages.map(function (p, i) {
      return '<option value="' + i + '"' + (i === at ? ' selected' : '') + '>' + esc(p.label) + '</option>';
    }).join('') + (at >= 0 || !cur ? '' : '<option value="" selected>' + esc(cur) + '</option>');
  }
  $('#rvPage').addEventListener('change', function (e) {
    if (e.target.value !== '') go(C.pages[Number(e.target.value)].url);
  });

  function onNav() {
    cache = {};
    closePop();
    var info = frameInfo();
    if (info) localStorage.setItem(LS + 'rvUrl', info.url);
    fillPages();
    renderList();
  }
  fr.addEventListener('load', function () {
    var info = frameInfo();
    if (!info) {
      $('#rvHint').textContent = 'このサイトは開けましたが、コメントは置けません（管理ツールとサイトが同じ場所に公開されている必要があります）。';
      return;
    }
    info.win.addEventListener('hashchange', onNav);
    onNav();
    if (afterLoad) { var fn = afterLoad; afterLoad = null; setTimeout(fn, 700); }
  });

  /* ---------- ピン ---------- */
  function pageComments(key) {
    return K.data.comments.filter(function (c) { return c.pageKey === key; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
  }
  function numberOf(c) { return pageComments(c.pageKey).indexOf(c) + 1; }
  function showDone() { return $('#rvShowDone').checked; }

  function locate(c, info) {
    var el = cache[c.id];
    if (!el || !el.isConnected) {
      try { el = c.selector ? info.doc.querySelector(c.selector) : null; } catch (e) { el = null; }
      cache[c.id] = el;
    }
    if (el) {
      var r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + c.rx * r.width, y: r.top + c.ry * r.height };
    }
    return { x: c.docX - info.win.scrollX, y: c.docY - info.win.scrollY };
  }

  function pinAt(pos) { return 'translate(' + pos.x + 'px,' + pos.y + 'px) scale(' + (1 / scale) + ') translate(-50%,-50%)'; }
  function draw() {
    var info = frameInfo();
    var shown = {};
    if (info) {
      pageComments(info.key).forEach(function (c, i) {
        if (c.device !== dev || (c.status === '対応済み' && !showDone() && c.id !== active)) return;
        var p = pins[c.id];
        if (!p) {
          p = pins[c.id] = document.createElement('button');
          p.type = 'button';
          p.className = 'pin';
          p.dataset.id = c.id;
          layer.appendChild(p);
        }
        p.textContent = i + 1;
        p.classList.toggle('is-done', c.status === '対応済み');
        p.classList.toggle('is-active', c.id === active);
        var pos = locate(c, info);
        p.style.transform = pinAt(pos);
        shown[c.id] = true;
      });
    }
    Object.keys(pins).forEach(function (id) {
      if (!shown[id]) { pins[id].remove(); delete pins[id]; }
    });
    if (draft && info) {
      var dp = pins._draft || (pins._draft = layer.appendChild(Object.assign(document.createElement('span'), { className: 'pin is-draft', textContent: '＋' })));
      var pos = locate(draft, info);
      dp.style.transform = pinAt(pos);
      shown._draft = true;
    }
  }
  (function loop() {
    if (started && document.body.dataset.tab === 'review') draw();
    requestAnimationFrame(loop);
  })();

  layer.addEventListener('click', function (e) {
    var pin = e.target.closest('.pin[data-id]');
    if (pin) { setActive(pin.dataset.id, false); return; }
    if (!mode) return;
    var info = frameInfo();
    if (!info) return;
    var pt = toFrame(e);
    var el = info.doc.elementFromPoint(pt.x, pt.y) || info.doc.body;
    var r = el.getBoundingClientRect();
    draft = {
      id: '_draft', selector: selectorOf(el),
      rx: r.width ? (pt.x - r.left) / r.width : 0, ry: r.height ? (pt.y - r.top) / r.height : 0,
      docX: pt.x + info.win.scrollX, docY: pt.y + info.win.scrollY,
      snippet: (el.innerText || el.alt || el.getAttribute('aria-label') || el.tagName.toLowerCase()).replace(/\s+/g, ' ').trim().slice(0, 60),
      pageKey: info.key, url: info.url
    };
    openPop(e);
  });
  layer.addEventListener('mousemove', function (e) {
    if (!mode) return;
    var info = frameInfo();
    if (!info) return;
    var pt = toFrame(e);
    var el = info.doc.elementFromPoint(pt.x, pt.y);
    if (!el) { hover.hidden = true; return; }
    var r = el.getBoundingClientRect();
    hover.hidden = false;
    hover.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-width:' + (2 / scale) + 'px';
  });
  layer.addEventListener('mouseleave', function () { hover.hidden = true; });
  layer.addEventListener('wheel', function (e) {
    var info = frameInfo();
    if (mode && info) info.win.scrollBy(e.deltaX, e.deltaY);
  }, { passive: true });
  var touchY = null;
  layer.addEventListener('touchstart', function (e) { touchY = e.touches[0].clientY; }, { passive: true });
  layer.addEventListener('touchmove', function (e) {
    var info = frameInfo();
    if (!mode || !info || touchY === null) return;
    var y = e.touches[0].clientY;
    info.win.scrollBy(0, (touchY - y) / scale);
    touchY = y;
    e.preventDefault();
  }, { passive: false });

  function toFrame(e) {
    var r = device.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }
  function selectorOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'HTML') {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) { parts.unshift('#' + el.id); break; }
      var tag = el.tagName.toLowerCase();
      if (tag === 'body') { parts.unshift('body'); break; }
      var i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  /* ---------- コメントを置く ---------- */
  function setMode(on) {
    mode = on;
    $('#rvMode').setAttribute('aria-pressed', String(on));
    $('#rvMode').textContent = on ? 'コメントをやめる' : 'コメントを置く';
    document.body.classList.toggle('rv-commenting', on);
    hover.hidden = true;
    $('#rvHint').textContent = on
      ? '直したい場所を' + TAP + 'してください（スクロールはそのままできます）'
      : 'サイトを普通に操作できます。直したい場所が出たら「コメントを置く」を押して、その場所を' + TAP + '。';
    if (!on) closePop();
  }
  $('#rvMode').addEventListener('click', function () { setMode(!mode); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.dataset.tab === 'review' && (mode || draft)) setMode(false);
  });

  function openPop(e) {
    var sr = stage.getBoundingClientRect();
    pop.hidden = false;
    var x = Math.min(Math.max(8, e.clientX - sr.left + 12), sr.width - pop.offsetWidth - 8);
    var y = Math.min(Math.max(8, e.clientY - sr.top + 12), sr.height - pop.offsetHeight - 8);
    pop.style.left = Math.max(8, x) + 'px';
    pop.style.top = Math.max(8, y) + 'px';
    $('#rvPopTarget').textContent = draft.snippet ? '対象: 「' + draft.snippet + '」' : '';
    pop.text.value = '';
    pop.text.focus();
  }
  function closePop() {
    pop.hidden = true;
    draft = null;
    if (pins._draft) { pins._draft.remove(); delete pins._draft; }
  }
  pop.addEventListener('click', function (e) { if (e.target.closest('[data-cancel]')) setMode(false); });
  pop.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = Object.assign({}, draft, {
      id: K.uid('c'), status: '未対応', text: pop.text.value.trim(), author: K.me, device: dev, replies: [], taskId: ''
    });
    K.save('comments', c);
    active = c.id;
    scope = 'page';
    setMode(false);
    renderScope();
    renderList();
    K.toast('コメントを置きました');
  });

  /* ---------- 一覧 ---------- */
  function fmt(iso) { return iso ? Number(iso.slice(5, 7)) + '/' + Number(iso.slice(8, 10)) + ' ' + iso.slice(11, 16) : ''; }
  function renderScope() {
    K.$$('[data-scope]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.scope === scope)); });
  }
  function renderList() {
    var ae = document.activeElement;
    if (ae && list.contains(ae) && ae.tagName === 'TEXTAREA' && ae.value) { listDirty = true; return; }
    listDirty = false;
    var info = frameInfo();
    var items = K.data.comments.filter(function (c) {
      if (c.status === '対応済み' && !showDone() && c.id !== active) return false;
      return scope === 'all' || (info && c.pageKey === info.key);
    }).sort(function (a, b) {
      if (scope === 'all' && a.pageKey !== b.pageKey) return a.pageKey < b.pageKey ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
    if (!items.length) {
      var open = K.data.comments.filter(function (c) { return c.status !== '対応済み'; }).length;
      list.innerHTML = '<li class="rv-empty">' + (scope === 'page' ? 'このページのコメントはまだありません。' + (open ? '<br>ほかのページに未対応が' + open + '件あります。' : '') : 'コメントはまだありません。') + '</li>';
      return;
    }
    var lastPage = '';
    list.innerHTML = items.map(function (c) {
      var head = scope === 'all' && c.pageKey !== lastPage ? '<li class="rv-page">' + esc(labelOfKey(c.pageKey)) + '</li>' : '';
      lastPage = c.pageKey;
      var on = c.id === active;
      var task = c.taskId && K.find('tasks', c.taskId);
      return head + '<li class="rv-item' + (on ? ' is-active' : '') + (c.status === '対応済み' ? ' is-done' : '') + '" data-id="' + esc(c.id) + '">' +
        '<button type="button" class="rv-head" data-focus><span class="num">' + numberOf(c) + '</span><span class="txt">' + esc(c.text) + '</span></button>' +
        '<p class="meta">' + esc(c.author) + '・' + fmt(c.createdAt) + '・' + DEV_LABEL[c.device] + (c.status === '対応済み' ? '・<b>対応済み</b>' : '') +
          (c.replies.length ? '・返信' + c.replies.length : '') + '</p>' +
        (on ? '<div class="rv-detail">' +
          (c.snippet ? '<p class="target">対象: 「' + esc(c.snippet) + '」</p>' : '') +
          (c.replies.length ? '<ul class="replies">' + c.replies.map(function (r) {
            return '<li><p>' + esc(r.text) + '</p><span>' + esc(r.author) + '・' + fmt(r.at) + '</span></li>';
          }).join('') + '</ul>' : '') +
          '<form class="reply" data-reply><textarea name="text" rows="2" maxlength="2000" placeholder="返信" required></textarea><button class="btn" type="submit">返信</button></form>' +
          '<div class="rv-act">' +
            '<button type="button" class="btn primary" data-status>' + (c.status === '対応済み' ? '未対応に戻す' : '対応済みにする') + '</button>' +
            (task ? '<a class="btn" href="#tasks">タスク #' + esc(task.no) + '（' + esc(task.status) + '）</a>' : '<button type="button" class="btn" data-task>タスクにする</button>') +
            '<button type="button" class="btn danger" data-del>削除</button>' +
          '</div></div>' : '') +
        '</li>';
    }).join('');
  }
  list.addEventListener('focusout', function () { setTimeout(function () { if (listDirty) renderList(); }, 0); });

  function setActive(id, navigate) {
    active = active === id && !navigate ? '' : id;
    renderList();
    var c = K.find('comments', id);
    if (!c || !active) return;
    var info = frameInfo();
    var reveal = function () {
      var inf = frameInfo();
      if (!inf) return;
      var pos = locate(c, inf);
      var vh = inf.win.innerHeight;
      if (pos.y < 40 || pos.y > vh - 40) inf.win.scrollBy({ top: pos.y - vh / 3, behavior: 'smooth' });
      var li = list.querySelector('.rv-item[data-id="' + c.id + '"]');
      if (li) li.scrollIntoView({ block: 'nearest' });
    };
    if (c.device !== dev) setDev(c.device);
    if (!info || info.key !== c.pageKey) go(c.url, reveal);
    else setTimeout(reveal, 50);
  }

  list.addEventListener('click', function (e) {
    var li = e.target.closest('.rv-item');
    if (!li) return;
    var c = K.find('comments', li.dataset.id);
    if (e.target.closest('[data-focus]')) { setActive(c.id, scope === 'all'); return; }
    if (e.target.closest('[data-status]')) {
      var done = c.status !== '対応済み';
      K.save('comments', Object.assign({}, c, { status: done ? '対応済み' : '未対応' }));
      var t = done && c.taskId && K.find('tasks', c.taskId);
      if (t && t.status !== '完了') K.save('tasks', Object.assign({}, t, { status: '完了' }));
    }
    if (e.target.closest('[data-task]')) {
      var t2 = K.addTask({
        title: '［添削］' + c.text.split('\n')[0].slice(0, 60),
        owners: [C.reviewOwner || K.me],
        note: c.text + '\n\nページ: ' + labelOfKey(c.pageKey) + '（' + DEV_LABEL[c.device] + '）\n書いた人: ' + c.author,
        link: 'review:' + c.id
      });
      K.save('comments', Object.assign({}, c, { taskId: t2.id }));
      K.toast('タスク #' + t2.no + ' にしました');
    }
    if (e.target.closest('[data-del]') && confirm('このコメントを削除しますか？')) {
      if (active === c.id) active = '';
      K.remove('comments', c.id);
    }
  });
  list.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = K.find('comments', e.target.closest('.rv-item').dataset.id);
    var text = e.target.text.value.trim();
    if (!text) return;
    e.target.text.value = '';
    K.save('comments', Object.assign({}, c, { replies: c.replies.concat([{ author: K.me, text: text, at: K.nowIso() }]) }));
  });
  $('#rvScope').addEventListener('click', function (e) {
    var b = e.target.closest('[data-scope]');
    if (!b) return;
    scope = b.dataset.scope;
    renderScope();
    renderList();
  });
  $('#rvShowDone').addEventListener('change', renderList);
  K.onChange(function () { if (started) renderList(); });

  /* ---------- 起動 ---------- */
  function start() {
    started = true;
    setMode(false);
    layout();
    fillPages();
    go(localStorage.getItem(LS + 'rvUrl') || C.pages[0].url);
  }
  K.onRoute = function (tab, arg) {
    if (tab !== 'review') { if (mode) setMode(false); return; }
    if (!started) start(); else layout();
    if (arg) {
      var c = K.find('comments', arg);
      if (c) { scope = 'all'; renderScope(); setActive(c.id, true); }
      else if (!K.data.comments.length) K.pull().then(function () { if (K.find('comments', arg)) K.onRoute(tab, arg); });
    }
  };
  if (document.body.dataset.tab === 'review') K.onRoute('review', location.hash.split('/')[1] || '');
})();
