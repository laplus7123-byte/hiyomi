/* HIYOMI プロジェクト管理：保存・タスク・経費。添削は review.js */
(function () {
  'use strict';
  var C = window.KANRI_CONFIG;
  var LS = 'hiyomi-kanri:';
  var K = window.Kanri = { data: { tasks: [], expenses: [], comments: [] }, remote: !!C.api };
  var key = localStorage.getItem(LS + 'key') || '';
  var pending = 0;
  var listeners = [];
  K.me = localStorage.getItem(LS + 'me') || '';

  /* ---------- 小物 ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowIso() { var d = new Date(); return today() + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function yen(n) { return Math.round(n).toLocaleString('ja-JP') + '円'; }
  function md(s) { return s ? Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10)) : ''; }
  function options(list, sel) {
    return list.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  K.$ = $; K.$$ = $$; K.esc = esc; K.uid = uid; K.toast = toast; K.today = today; K.nowIso = nowIso;

  /* ---------- 保存 ---------- */
  K.onChange = function (fn) { listeners.push(fn); };
  function emit() { listeners.forEach(function (fn) { fn(); }); }

  function normalize(type, o) {
    if (type === 'tasks') {
      o.owners = Array.isArray(o.owners) ? o.owners : String(o.owners || '').split('、').filter(Boolean);
      o.no = o.no === '' || o.no == null ? '' : Number(o.no);
    } else if (type === 'expenses') {
      o.amount = Number(o.amount) || 0;
    } else if (type === 'comments') {
      if (!Array.isArray(o.replies)) { try { o.replies = JSON.parse(o.replies || '[]'); } catch (e) { o.replies = []; } }
      ['rx', 'ry', 'docX', 'docY'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
    }
    return o;
  }
  function serialize(type, o) {
    var s = Object.assign({}, o);
    if (type === 'tasks') s.owners = (o.owners || []).join('、');
    if (type === 'comments') s.replies = JSON.stringify(o.replies || []);
    return s;
  }
  function saveLocal() { localStorage.setItem(LS + 'data', JSON.stringify(K.data)); }
  function setSync(text) { $('#sync').textContent = text; }

  function post(body) {
    body.key = key;
    return fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { if (d.error === 'key') showGate('合言葉が変わったようです。入れ直してください'); throw new Error(d.error); }
        return d;
      });
  }
  function send(body) {
    if (!K.remote) { saveLocal(); return Promise.resolve(); }
    pending++;
    setSync('保存中…');
    return post(body).then(function () {
      setSync('保存しました');
    }).catch(function () {
      toast('保存できませんでした。最新の内容を読み込み直します');
      setSync('保存に失敗');
    }).then(function () { pending--; if (!pending) pull(); });
  }

  K.pull = pull;
  function pull() {
    if (!K.remote) {
      try { var d = JSON.parse(localStorage.getItem(LS + 'data') || '{}'); } catch (e) { d = {}; }
      ['tasks', 'expenses', 'comments'].forEach(function (t) { K.data[t] = (d[t] || []).map(function (o) { return normalize(t, o); }); });
      emit();
      return Promise.resolve(true);
    }
    if (!key) { showGate(); return Promise.resolve(false); }
    return fetch(C.api + '?action=list&key=' + encodeURIComponent(key)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { showGate(d.error === 'key' ? '合言葉が違います' : '読み込めませんでした'); return false; }
      if (pending) return true;
      ['tasks', 'expenses', 'comments'].forEach(function (t) { K.data[t] = (d[t] || []).map(function (o) { return normalize(t, o); }); });
      var n = new Date();
      setSync(pad(n.getHours()) + ':' + pad(n.getMinutes()) + ' に同期');
      emit();
      return true;
    }).catch(function () { setSync('オフライン'); return false; });
  }

  function stamp(o) {
    o.updatedAt = nowIso();
    if (!o.createdAt) { o.createdAt = o.updatedAt; o.createdBy = o.createdBy || K.me; }
    return o;
  }
  K.save = function (type, item) { return K.saveMany(type, [item]); };
  K.saveMany = function (type, items) {
    items.forEach(function (it) {
      stamp(it);
      var list = K.data[type];
      var i = list.findIndex(function (o) { return o.id === it.id; });
      if (i >= 0) list[i] = it; else list.push(it);
    });
    emit();
    return send({ action: 'upsert', type: type, items: items.map(function (it) { return serialize(type, it); }) });
  };
  K.remove = function (type, id) {
    K.data[type] = K.data[type].filter(function (o) { return o.id !== id; });
    emit();
    return send({ action: 'delete', type: type, id: id });
  };
  K.find = function (type, id) { return K.data[type].find(function (o) { return o.id === id; }); };

  /* 領収書をドライブに送る。画像は長辺1600pxのJPEGに縮める */
  K.upload = function (file) {
    if (!K.remote) return Promise.reject(new Error('試用モードではファイルを送れません。URL欄を使ってください'));
    if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('ファイルが大きすぎます（20MBまで）'));
    var prep = /^image\/(jpeg|png|webp)$/.test(file.type) ? shrink(file) : readB64(file).then(function (b) { return { data: b, mime: file.type }; });
    return prep.then(function (p) {
      return post({ action: 'upload', name: today() + '_' + file.name, mime: p.mime, data: p.data });
    }).then(function (d) { return d.url; });
  };
  function readB64(blob) {
    return new Promise(function (ok, ng) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = ng;
      r.readAsDataURL(blob);
    });
  }
  function shrink(file) {
    return new Promise(function (ok, ng) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        ok({ data: cv.toDataURL('image/jpeg', 0.8).split(',')[1], mime: 'image/jpeg' });
      };
      img.onerror = ng;
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- 入口（合言葉と名前） ---------- */
  function whoRadios(box, name, sel) {
    box.innerHTML = C.members.map(function (m) {
      return '<label><input type="radio" name="' + name + '" value="' + esc(m) + '"' + (m === sel ? ' checked' : '') + ' required>' + esc(m) + '</label>';
    }).join('');
  }
  function showGate(msg) {
    var f = $('#gateForm');
    $('#gate').hidden = false;
    f.key.closest('label').hidden = !K.remote;
    f.key.required = K.remote;
    f.querySelector('h1').textContent = K.remote ? '合言葉を入れてください' : 'あなたはどなたですか';
    whoRadios($('#gateWho'), 'who', K.me);
    $('#gateErr').textContent = msg || '';
  }
  $('#gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    setMe(f.who.value);
    if (K.remote) { key = f.key.value.trim(); localStorage.setItem(LS + 'key', key); }
    pull().then(function (ok) { if (ok) $('#gate').hidden = true; });
  });
  $('#me').innerHTML = options(C.members, K.me);
  $('#me').addEventListener('change', function (e) { setMe(e.target.value); renderTasks(); });
  function setMe(name) {
    K.me = name;
    localStorage.setItem(LS + 'me', name);
    $('#me').value = name;
    $('#taskAdd').owner.value = name;
    $('#expAdd').payer.value = name;
  }

  /* ---------- 画面の切り替え ---------- */
  function route() {
    var tab = (location.hash.replace(/^#/, '').split('/')[0]) || 'tasks';
    if (!$('#view-' + tab)) tab = 'tasks';
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + tab; });
    $$('#tabs a').forEach(function (a) { a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'); });
    document.body.dataset.tab = tab;
    if (K.onRoute) K.onRoute(tab, location.hash.split('/')[1] || '');
  }
  window.addEventListener('hashchange', route);

  /* ---------- タスク ---------- */
  var ORDER = ['進行中', '確認待ち', '未着手', '保留', '完了'];
  var ownerFilter = localStorage.getItem(LS + 'owner') || 'all';

  function renderOwnerFilter() {
    $('#ownerFilter').innerHTML = ['all'].concat(C.members).map(function (m) {
      return '<button type="button" data-owner="' + esc(m) + '" aria-pressed="' + (m === ownerFilter) + '">' + (m === 'all' ? '全員' : esc(m)) + '</button>';
    }).join('');
  }
  function taskSort(a, b) {
    if ((a.due || '9') !== (b.due || '9')) return (a.due || '9') < (b.due || '9') ? -1 : 1;
    if (a.no !== b.no) return (a.no === '' ? 1e9 : a.no) - (b.no === '' ? 1e9 : b.no);
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  function renderTasks() {
    var all = K.data.tasks;
    var showDone = $('#showDone').checked;
    $('#taskEmpty').hidden = all.length > 0;
    var list = all.filter(function (t) { return ownerFilter === 'all' || t.owners.indexOf(ownerFilter) >= 0; });
    var td = today();
    $('#taskList').innerHTML = ORDER.map(function (st) {
      var rows = list.filter(function (t) { return (ORDER.indexOf(t.status) < 0 ? '未着手' : t.status) === st; }).sort(taskSort);
      if (!rows.length) return '';
      var head = '<h3>' + st + '<span class="count">' + rows.length + '件</span></h3>';
      if (st === '完了' && !showDone) return '<section class="tgroup done-closed">' + head + '</section>';
      return '<section class="tgroup" data-status="' + st + '">' + head + '<ul class="tlist">' + rows.map(function (t) {
        var late = t.due && t.due < td && st !== '完了';
        var note = (t.note || '').split('\n')[0];
        return '<li class="trow' + (st === '完了' ? ' is-done' : '') + (t.owners.indexOf(K.me) >= 0 ? ' is-mine' : '') + '" data-id="' + esc(t.id) + '">' +
          '<span class="tno">' + (t.no !== '' ? '#' + t.no : '') + '</span>' +
          '<button type="button" class="ttitle" data-open>' + esc(t.title) + (note ? '<small>' + esc(note) + '</small>' : '') + '</button>' +
          '<span class="tmeta"><span class="towners">' + t.owners.map(esc).join('・') + '</span>' +
          '<span class="tdue' + (late ? ' late' : '') + '">' + (t.due ? (late ? '期限切れ ' : '') + md(t.due) : '') + '</span></span>' +
          '<select class="tstatus" aria-label="状況">' + options(C.taskStatuses, t.status) + '</select></li>';
      }).join('') + '</ul></section>';
    }).join('');
  }
  K.renderTasks = renderTasks;

  $('#ownerFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-owner]');
    if (!b) return;
    ownerFilter = b.dataset.owner;
    localStorage.setItem(LS + 'owner', ownerFilter);
    renderOwnerFilter();
    renderTasks();
  });
  $('#showDone').addEventListener('change', renderTasks);
  $('#taskList').addEventListener('change', function (e) {
    if (!e.target.classList.contains('tstatus')) return;
    var t = K.find('tasks', e.target.closest('.trow').dataset.id);
    K.save('tasks', Object.assign({}, t, { status: e.target.value }));
  });
  $('#taskList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (b) openTask(b.closest('.trow').dataset.id);
  });

  function nextNo() {
    return K.data.tasks.reduce(function (m, t) { return t.no !== '' && t.no > m ? t.no : m; }, 0) + 1;
  }
  K.addTask = function (fields) {
    var t = Object.assign({ id: uid('t'), no: nextNo(), title: '', owners: [K.me], status: '未着手', due: '', note: '', link: '' }, fields);
    K.save('tasks', t);
    return t;
  };
  var addForm = $('#taskAdd');
  addForm.owner.innerHTML = options(C.members, K.me);
  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    K.addTask({ title: addForm.title.value.trim(), owners: [addForm.owner.value], due: addForm.due.value });
    addForm.title.value = '';
    addForm.due.value = '';
    addForm.title.focus();
  });
  $('#seedTasks').hidden = !(window.KANRI_SEED_TASKS || []).length;
  $('#seedTasks').addEventListener('click', function () {
    var base = Date.now().toString(36);
    K.saveMany('tasks', window.KANRI_SEED_TASKS.map(function (s, i) {
      return Object.assign({ id: 't-seed' + base + i, due: '', note: '', link: '' }, s, { owners: s.owners.slice() });
    }));
  });

  var taskDlg = $('#taskDlg'), taskForm = $('#taskForm'), editingTask = null;
  taskForm.status.innerHTML = options(C.taskStatuses);
  function openTask(id) {
    var t = K.find('tasks', id);
    if (!t) return;
    editingTask = t;
    taskForm.no.value = t.no;
    taskForm.status.value = t.status;
    taskForm.title.value = t.title;
    taskForm.due.value = t.due || '';
    taskForm.note.value = t.note || '';
    $('#taskOwners').innerHTML = C.members.map(function (m) {
      return '<label><input type="checkbox" name="owners" value="' + esc(m) + '"' + (t.owners.indexOf(m) >= 0 ? ' checked' : '') + '>' + esc(m) + '</label>';
    }).join('');
    var link = (t.link || '').indexOf('review:') === 0 ? t.link.slice(7) : '';
    $('#taskLink').innerHTML = link ? '<a href="#review/' + esc(link) + '" data-close>もとの添削コメントを開く</a>' : '';
    taskDlg.showModal();
  }
  taskForm.addEventListener('submit', function (e) {
    if (e.submitter && e.submitter.value !== 'save') return;
    K.save('tasks', Object.assign({}, editingTask, {
      no: taskForm.no.value === '' ? '' : Number(taskForm.no.value),
      status: taskForm.status.value,
      title: taskForm.title.value.trim(),
      due: taskForm.due.value,
      note: taskForm.note.value,
      owners: $$('input[name=owners]:checked', taskForm).map(function (i) { return i.value; })
    }));
  });
  taskForm.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) taskDlg.close();
    if (e.target.closest('[data-del]') && confirm('「' + editingTask.title + '」を削除しますか？')) {
      K.remove('tasks', editingTask.id);
      taskDlg.close();
    }
  });

  /* ---------- 経費 ---------- */
  var expMonth = 'all';
  var expAdd = $('#expAdd'), expDlg = $('#expDlg'), expForm = $('#expForm'), editingExp = null;
  [expAdd, expForm].forEach(function (f) {
    f.category.innerHTML = options(C.categories);
    f.payer.innerHTML = options(C.members, K.me);
  });
  expAdd.date.value = today();

  function monthOf(e) { return (e.date || '').slice(0, 7); }
  function monthLabel(m) { return m.slice(0, 4) + '年' + Number(m.slice(5)) + '月'; }
  function expSort(a, b) { return a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1); }
  function sum(list) { return list.reduce(function (s, e) { return s + e.amount; }, 0); }

  function renderExpenses() {
    var all = K.data.expenses.slice().sort(expSort);
    var months = all.map(monthOf).filter(function (m, i, a) { return m && a.indexOf(m) === i; });
    if (expMonth !== 'all' && months.indexOf(expMonth) < 0) expMonth = 'all';
    $('#expMonth').innerHTML = '<option value="all">すべての月</option>' + months.map(function (m) {
      return '<option value="' + m + '"' + (m === expMonth ? ' selected' : '') + '>' + monthLabel(m) + '</option>';
    }).join('');
    var list = expMonth === 'all' ? all : all.filter(function (e) { return monthOf(e) === expMonth; });
    var thisMonth = today().slice(0, 7);
    var unsettled = all.filter(function (e) { return !e.settled; });

    var cats = C.categories.map(function (c) {
      return { c: c, v: sum(list.filter(function (e) { return e.category === c; })) };
    }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    var max = cats.length ? cats[0].v : 1;
    $('#expSum').innerHTML =
      '<dl class="sum-nums">' +
        '<div><dt>' + (expMonth === 'all' ? 'これまでの合計' : monthLabel(expMonth) + 'の合計') + '</dt><dd class="big">' + yen(sum(list)) + '</dd></div>' +
        '<div><dt>今月（' + Number(thisMonth.slice(5)) + '月）</dt><dd>' + yen(sum(all.filter(function (e) { return monthOf(e) === thisMonth; }))) + '</dd></div>' +
        '<div><dt>まだ精算していない立て替え</dt><dd>' + yen(sum(unsettled)) + '</dd></div>' +
      '</dl>' +
      (cats.length ? '<ul class="cats">' + cats.map(function (x) {
        return '<li><span class="cat-name">' + esc(x.c) + '</span><span class="bar"><i style="width:' + (x.v / max * 100).toFixed(1) + '%"></i></span><span class="cat-v">' + yen(x.v) + '</span></li>';
      }).join('') + '</ul>' : '');

    var groups = [];
    list.forEach(function (e) {
      var m = monthOf(e);
      if (!groups.length || groups[groups.length - 1].m !== m) groups.push({ m: m, rows: [] });
      groups[groups.length - 1].rows.push(e);
    });
    $('#expList').innerHTML = list.length ? groups.map(function (g) {
      return '<table class="etable"><caption>' + (g.m ? monthLabel(g.m) : '日付なし') + '<span>' + yen(sum(g.rows)) + '</span></caption><tbody>' +
        g.rows.map(function (e) {
          return '<tr data-id="' + esc(e.id) + '"><td class="e-date">' + md(e.date) + '</td>' +
            '<td class="e-item"><button type="button" data-open>' + esc(e.item) + '</button>' +
            '<small>' + esc(e.category) + '・' + esc(e.payer) + 'が立て替え' + (e.settled ? '・精算済み' : '') + '</small></td>' +
            '<td class="e-rc">' + (e.receipt ? '<a href="' + esc(e.receipt) + '" target="_blank" rel="noopener">領収書</a>' : '') + '</td>' +
            '<td class="e-amt">' + yen(e.amount) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).join('') : '<p class="empty">まだ記録がありません。右の欄から追加できます。</p>';

    renderSettle(unsettled);
  }

  function renderSettle(unsettled) {
    var total = sum(unsettled);
    if (!total) { $('#settle').innerHTML = '<p class="muted">精算が必要な立て替えはありません。</p>'; return; }
    var rows = C.members.map(function (m) {
      var paid = sum(unsettled.filter(function (e) { return e.payer === m; }));
      var share = total * (C.shares[m] || 0);
      return { m: m, paid: paid, share: share, bal: paid - share };
    });
    var pay = rows.filter(function (r) { return r.bal < -0.5; }).map(function (r) { return { m: r.m, v: -r.bal }; });
    var get = rows.filter(function (r) { return r.bal > 0.5; }).map(function (r) { return { m: r.m, v: r.bal }; });
    var moves = [];
    pay.forEach(function (p) {
      get.forEach(function (g) {
        var v = Math.min(p.v, g.v);
        if (v < 0.5) return;
        moves.push(p.m + ' → ' + g.m + '　' + yen(v));
        p.v -= v; g.v -= v;
      });
    });
    $('#settle').innerHTML =
      '<table class="stable"><thead><tr><th></th><th>立て替え</th><th>負担分</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><th>' + esc(r.m) + '</th><td>' + yen(r.paid) + '</td><td>' + yen(r.share) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<p class="muted">負担は' + (Object.keys(C.shares).every(function (k) { return Math.abs(C.shares[k] - 1 / C.members.length) < 1e-6; }) ? '均等' : '設定した割合') + 'で計算しています。</p>' +
      (moves.length ? '<ul class="moves">' + moves.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      '<button type="button" class="btn" id="settleAll">送金が済んだら、ここまでを精算済みにする</button>';
  }

  $('#expMonth').addEventListener('change', function (e) { expMonth = e.target.value; renderExpenses(); });
  $('#settle').addEventListener('click', function (e) {
    if (e.target.id !== 'settleAll' || !confirm('いまの未精算分をすべて「精算済み」にします。よろしいですか？')) return;
    var d = today();
    K.saveMany('expenses', K.data.expenses.filter(function (x) { return !x.settled; }).map(function (x) { return Object.assign({}, x, { settled: d }); }));
  });
  $('#expList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (b) openExp(b.closest('tr').dataset.id);
  });

  function withReceipt(form, item) {
    var file = form.file.files[0];
    if (!file) return Promise.resolve(item);
    toast('領収書を送っています…');
    return K.upload(file).then(function (url) { item.receipt = url; return item; });
  }
  expAdd.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = expAdd.querySelector('[type=submit]');
    btn.disabled = true;
    withReceipt(expAdd, {
      id: uid('e'), date: expAdd.date.value, item: expAdd.item.value.trim(), amount: Number(expAdd.amount.value),
      category: expAdd.category.value, payer: expAdd.payer.value, receipt: expAdd.receipt.value.trim(), note: expAdd.note.value, settled: ''
    }).then(function (item) {
      K.save('expenses', item);
      var keepDate = expAdd.date.value, keepPayer = expAdd.payer.value;
      expAdd.reset();
      expAdd.date.value = keepDate;
      expAdd.payer.value = keepPayer;
      toast('記録しました');
    }).catch(function (err) { toast(err.message); }).then(function () { btn.disabled = false; });
  });

  function openExp(id) {
    var x = K.find('expenses', id);
    if (!x) return;
    editingExp = x;
    ['date', 'amount', 'item', 'category', 'payer', 'receipt', 'note'].forEach(function (k) { expForm[k].value = x[k] || ''; });
    expForm.file.value = '';
    expForm.settled.checked = !!x.settled;
    expDlg.showModal();
  }
  expForm.addEventListener('submit', function (e) {
    if (e.submitter && e.submitter.value !== 'save') return;
    var item = Object.assign({}, editingExp, {
      date: expForm.date.value, amount: Number(expForm.amount.value), item: expForm.item.value.trim(),
      category: expForm.category.value, payer: expForm.payer.value, receipt: expForm.receipt.value.trim(), note: expForm.note.value,
      settled: expForm.settled.checked ? (editingExp.settled || today()) : ''
    });
    withReceipt(expForm, item).then(function (it) { K.save('expenses', it); }).catch(function (err) { toast(err.message); });
  });
  expForm.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) expDlg.close();
    if (e.target.closest('[data-del]') && confirm('「' + editingExp.item + '」を削除しますか？')) {
      K.remove('expenses', editingExp.id);
      expDlg.close();
    }
  });

  $('#expCsv').addEventListener('click', function () {
    var list = K.data.expenses.slice().sort(expSort).reverse().filter(function (e) { return expMonth === 'all' || monthOf(e) === expMonth; });
    var cell = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['日付', '内容', '区分', '金額', '立て替えた人', '領収書', 'メモ', '精算日']].concat(list.map(function (e) {
      return [e.date, e.item, e.category, e.amount, e.payer, e.receipt, e.note, e.settled];
    })).map(function (r) { return r.map(cell).join(','); });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' }));
    a.download = 'HIYOMI_経費_' + (expMonth === 'all' ? '全期間' : expMonth) + '.csv';
    a.click();
  });

  /* ---------- 起動 ---------- */
  K.onChange(function () { renderTasks(); renderExpenses(); });
  renderOwnerFilter();
  $('#localNote').hidden = K.remote;
  route();
  if (!K.me || (K.remote && !key)) showGate();
  pull();
  setInterval(function () { if (K.remote && document.visibilityState === 'visible' && !pending && $('#gate').hidden) pull(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (K.remote && document.visibilityState === 'visible' && !pending) pull(); });
})();
