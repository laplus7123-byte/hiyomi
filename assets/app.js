(function () {
  'use strict';

  var TITLE = 'HIYOMI｜四柱推命で読む、性格と人との関わり方';
  /* スプレッドシート記録用の Apps Script ウェブアプリのURL（空なら記録しない。手順は gas/README.md） */
  var RECORD_URL = 'https://script.google.com/macros/s/AKfycbxCNLXBqUGHgAUWMBcZ51L3HZmaPvAGFfSreds3zpFCpXK6Zu86Tp02obop_wV8pqTNsw/exec';

  var T = window.TEXTS;
  var M = window.Meishiki;
  /* 色は五行で決める。値は style.css の .el-* の --c と同じ */
  var STEM_EL = { '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth',
    '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water' };
  var EL_COLOR = { wood: '#4f6f3a', fire: '#9a4636', earth: '#7a6420', metal: '#5f4f8a', water: '#3f5f86' };
  var BASE_COLOR = '#76684d';
  var GOD_IMG = { '甲': 'tree', '乙': 'flower', '丙': 'sun', '丁': 'flame', '戊': 'mountain',
    '己': 'field', '庚': 'sword', '辛': 'jewel', '壬': 'sea', '癸': 'rain' };
  /* 名乗りは「太陽の賢者」の形。神の名前は出さない */
  var STEM_NAME = { '甲': '大樹', '乙': '草花', '丙': '太陽', '丁': '灯火', '戊': '山',
    '己': '田畑', '庚': '剣', '辛': '宝石', '壬': '大海', '癸': '雨' };
  var KANGO_OF = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
  var ELEMENTS = [['甲', '乙'], ['丙', '丁'], ['戊', '己'], ['庚', '辛'], ['壬', '癸']];
  function typeName(ty) { return STEM_NAME[ty.dg] + 'の' + ty.role; }
  function birthOf(ty) { return STEM_NAME[ty.dg] + 'の生まれ'; }
  function godImg(dg, cls) {
    return '<img class="' + cls + '" src="assets/img/kami_' + GOD_IMG[dg] + '.webp" alt="" width="480" height="640">';
  }
  /* 案内人「ひよみ」のふきだし。text は固定の文言だけを渡す（HTMLのまま入れる） */
  function guide(text, cls) {
    return '<div class="guide' + (cls ? ' ' + cls : '') + '"><span class="guide-face"><img src="assets/img/guide-face.webp" alt="" width="160" height="160"></span>' +
      '<div class="guide-say"><p class="guide-name">案内人 ひよみ</p><p class="guide-text">' + text + '</p></div></div>';
  }
  /* 読み方の出典は常時表示。共通の説明はレポート末尾にまとめる。 */
  var POS_FUDA = { '年干': 'year', '年支': 'year', '月干': 'month', '月支': 'month', '日支': 'day' };
  function fuda(kind) {
    var f = T.fuda[kind];
    return '<p class="fuda reading-source"><span>読み解きに使った情報</span><a href="#sec-reading" data-jump="reading">' + esc(f.label.replace(/から$/, '')) + '</a></p>';
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function wb(s) { return esc(s).replace(/\|/g, '<wbr>'); }
  function plain(s) { return String(s).replace(/\|/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- 入口 ---------- */
  var today = new Date();
  var thisYear = today.getFullYear();
  /* 1582年より前はユリウス暦との切り替えで日付がずれるので使わない（ryuha-rules.md） */
  var MIN_YEAR = 1700;
  var KYUREKI_UNTIL = 1872;

  function fillYmd(box) {
    var sy = box.children[0], sm = box.children[1], sd = box.children[2];
    var opts = '<option value="">年</option>';
    for (var y = thisYear; y >= MIN_YEAR; y--) opts += '<option value="' + y + '">' + y + '年</option>';
    sy.innerHTML = opts;
    opts = '<option value="">月</option>';
    for (var m = 1; m <= 12; m++) opts += '<option value="' + m + '">' + m + '月</option>';
    sm.innerHTML = opts;
    function days() {
      var keep = sd.value;
      var last = new Date(Number(sy.value) || 2000, Number(sm.value) || 1, 0).getDate();
      var o = '<option value="">日</option>';
      for (var d = 1; d <= last; d++) o += '<option value="' + d + '">' + d + '日</option>';
      sd.innerHTML = o;
      if (keep && Number(keep) <= last) sd.value = keep;
    }
    var note = document.createElement('small');
    note.textContent = '明治5年（1872年）以前の生まれは、旧暦の日付を新暦に直して入れてください。';
    note.hidden = true;
    box.parentNode.appendChild(note);
    sy.addEventListener('change', function () { note.hidden = !(Number(sy.value) && Number(sy.value) <= KYUREKI_UNTIL); });
    sy.addEventListener('change', days);
    sm.addEventListener('change', days);
    days();
  }

  function ymdOf(f, y, m, d) {
    var Y = f[y].value, Mo = f[m].value, D = f[d].value;
    if (!Y && !Mo && !D) return '';
    if (!Y || !Mo || !D) return null;
    return Y + '-' + pad(Number(Mo)) + '-' + pad(Number(D));
  }

  function radio(f, name) {
    var el = f.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var f = ev.target, err = $('#err');
    if (!f.n.value.trim()) return fail('お名前を入れてください。');
    var me = ymdOf(f, 'y', 'm', 'd');
    if (!me) return fail('あなたの生年月日を、年・月・日まで選んでください。');
    var s = radio(f, 's');
    if (!s) return fail('あなたの性別を選んでください。');
    if (me > todayStr()) return fail('生年月日が今日より後になっています。');
    var q = new URLSearchParams();
    q.set('n', f.n.value.trim());
    q.set('d', me);
    q.set('s', s);
    if (f.t.value) { q.set('t', f.t.value); if (f.p.value) q.set('p', f.p.value); }
    var pair = f.dataset.mode === 'pair';
    var pd = pair ? ymdOf(f, 'py', 'pm', 'pd') : '';
    if (pair && !pd) return fail('お相手の生年月日を、年・月・日まで選んでください。');
    if (pd) {
      var ps = radio(f, 'ps'), r = radio(f, 'r');
      if (pd > todayStr()) return fail('お相手の生年月日が今日より後になっています。');
      q.set('pd', pd);
      if (ps) q.set('ps', ps);
      q.set('r', r || 'love');
      if (f.pn.value.trim()) q.set('pn', f.pn.value.trim());
    }
    err.textContent = '';
    record(q);
    showLoading(q, function () { location.hash = 'kantei?' + q.toString(); });
    function fail(msg) { err.textContent = msg; }
  }

  /* 鑑定書を出す前に、計算の途中経過を少しずつ見せる。タイプ名は鑑定書で初めて出す */
  function showLoading(q, done) {
    var cs = chartsOf(q), me = cs.me, b = me.birth;
    var steps = [
      ['生年月日を、暦に直しています', b.y + '年' + b.m + '月' + b.d + '日　→　' + pillarLine(me)],
      ['あなたのタイプを読みとっています', '生まれた日の字は「' + me.type.dg + '」。' + birthOf(me.type) + 'です。'],
      ['振り返りの手がかりになる年を調べています', me.nenpyo.past.length ? '15歳からの年表で、' + me.nenpyo.past.length + 'つの年が見つかりました。' : '15歳からの年表を確かめました。']
    ];
    if (cs.pt) steps.push(['二人の相性を見ています', cs.pname + 'は、' + birthOf(cs.pt.type) + 'です。']);
    var el = $('#loading');
    el.innerHTML = '<div class="loading-inner"><p class="loading-brand">HIYOMI</p>' +
      guide('生まれた日の暦を、読みはじめます。', 'guide-loading') +
      '<p class="loading-title">' + esc(me.name ? me.name + 'さんの' : '') + '鑑定レポートを作成しています</p>' +
      '<div class="loading-bar"><i></i></div><ol class="loading-steps">' + steps.map(function (s) {
        return '<li hidden><p class="ls-label">' + esc(s[0]) + '</p><p class="ls-value">' + esc(s[1]) + '</p></li>';
      }).join('') + '</ol><button type="button" class="loading-skip">すぐに見る</button></div>';
    el.hidden = false;
    document.body.classList.add('is-loading');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var gap = reduce ? 350 : 850;
    var items = $$('.loading-steps li', el), bar = $('.loading-bar i', el), say = $('.guide-text', el), timers = [], ended = false;
    items.forEach(function (li, i) {
      timers.push(setTimeout(function () {
        if (i) items[i - 1].classList.add('done');
        li.hidden = false;
        say.textContent = steps[i][0] + '…';
        say.classList.remove('guide-pop'); void say.offsetWidth; say.classList.add('guide-pop');
        bar.style.width = Math.round((i + 1) / (items.length + 1) * 100) + '%';
      }, 200 + i * gap));
    });
    timers.push(setTimeout(function () {
      items[items.length - 1].classList.add('done'); bar.style.width = '100%';
      say.textContent = 'レポートができました。どうぞ。';
    }, 200 + items.length * gap));
    timers.push(setTimeout(finish, 200 + items.length * gap + (reduce ? 200 : 500)));
    $('.loading-skip', el).addEventListener('click', finish);
    function finish() {
      if (ended) return;
      ended = true;
      timers.forEach(clearTimeout);
      done();
      requestAnimationFrame(function () { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('is-loading'); });
    }
  }

  /* 入口で「個人」か「相性」を選ぶと、入力欄を1名分か2名分にする */
  function setMode(mode, scroll) {
    var f = $('#form');
    f.dataset.mode = mode;
    f.hidden = false;
    $$('button[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'); });
    $('#err').textContent = '';
    if (scroll) f.scrollIntoView({ behavior: 'smooth' });
  }

  /* 入力内容をスプレッドシートに1行追記する（受け口は gas/記録.gs）。気になる人の名前は送らない */
  function record(q) {
    if (!RECORD_URL || window.self !== window.top) return;
    var c = M.chart({ name: q.get('n') || '', date: q.get('d'), sex: q.get('s'), time: q.get('t') || null, place: q.get('p') || '' });
    var data = {
      name: q.get('n') || '', date: q.get('d'), sex: q.get('s'), time: q.get('t') || '', pref: q.get('p') || '',
      partnerDate: q.get('pd') || '', partnerSex: q.get('ps') || '', relation: q.get('r') || '',
      type: c.type.title, src: store('session', KEY_SRC) || '',
      device: matchMedia('(max-width: 719px)').matches ? 'sp' : 'pc'
    };
    try {
      fetch(RECORD_URL, { method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
    } catch (e) { /* 記録に失敗しても鑑定は止めない */ }
  }
  function todayStr() { return thisYear + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate()); }

  /* ---------- 名前の画数（熊崎式。計算は ekigaku-kantei の seimei() と同じ） ---------- */
  var GOOD_NUM = [1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 29, 31, 32, 33, 35, 37, 38, 39, 41, 45, 47, 48,
    52, 57, 58, 61, 63, 65, 67, 68, 81];
  /* 姓と名はスペースで分ける。2文字の名前だけは1字ずつに分ける */
  function splitName(n) {
    var s = String(n || '').trim().replace(/\u3000/g, ' ');
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 2) return [Array.from(parts[0]), Array.from(parts[1])];
    var cs = Array.from(s);
    if (parts.length === 1 && cs.length === 2) return [[cs[0]], [cs[1]]];
    return null;
  }
  function strokesOf(chars) {
    var K = window.KAKUSU || {}, out = [];
    for (var i = 0; i < chars.length; i++) {
      var n = chars[i] === '々' && i ? out[i - 1] : K[chars[i]];
      if (!n) return null;
      out.push(n);
    }
    return out;
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function seimei(sei, mei) {
    var gai = (sei.length > 1 ? sei[0] : 1) + (mei.length > 1 ? mei[mei.length - 1] : 1);
    if (sei.length === 1 && mei.length === 1) gai = 2;
    return {
      ten: sum(sei) + (sei.length === 1 ? 1 : 0), jin: sei[sei.length - 1] + mei[0],
      chi: sum(mei) + (mei.length === 1 ? 1 : 0), gai: gai, sou: sum(sei) + sum(mei)
    };
  }
  function renderKakusu(name) {
    var sp = splitName(name);
    if (!sp) return '<p class="kakusu-note">姓と名の間にスペースを入れて鑑定すると、名前の画数（5つの格）も出ます。</p>';
    var a = strokesOf(sp[0]), b = strokesOf(sp[1]);
    if (!a || !b) return '<p class="kakusu-note">名前の画数は、漢字のお名前のときに出しています。</p>';
    var s = seimei(a, b);
    /* 天格は判断に使わない（ryuha-rules.md） */
    var kaku = [['天格', '家の格', s.ten, false], ['人格', 'その人の芯', s.jin, true], ['地格', '若い頃の土台', s.chi, true],
      ['外格', '人との縁', s.gai, true], ['総格', '人生全体', s.sou, true]];
    var good = kaku.filter(function (k) { return k[3] && GOOD_NUM.indexOf(k[2]) >= 0; }).length;
    var chars = sp[0].map(function (c, i) { return esc(c) + '<small>' + a[i] + '</small>'; }).join('') + '<span class="kakusu-gap"></span>' +
      sp[1].map(function (c, i) { return esc(c) + '<small>' + b[i] + '</small>'; }).join('');
    return '<div class="kakusu"><p class="sheet-label">名前の画数<small>熊崎式（旧字体）で数えています</small></p>' +
      '<p class="kakusu-lead">' + (good ? '4つの格のうち、' + good + 'つが吉数です。' : '名前の画数を、5つの格に分けて数えました。') + '</p>' +
      '<p class="kakusu-chars" aria-label="1字ずつの画数">' + chars + '</p>' +
      '<dl class="kakusu-grid">' + kaku.map(function (k) {
        var isGood = k[3] && GOOD_NUM.indexOf(k[2]) >= 0;
        return '<div' + (isGood ? ' class="is-good"' : '') + '><dt>' + k[0] + '<small>' + k[1] + '</small></dt><dd><b>' + k[2] + '</b>' +
          (isGood ? '<span>吉数</span>' : (k[3] ? '' : '<span class="muted">判断に使わない</span>')) + '</dd></div>';
      }).join('') + '</dl></div>';
  }

  /* ---------- 鑑定書 ---------- */
  function bandOf(dayun, year) {
    for (var i = dayun.length - 1; i >= 0; i--) {
      if (year >= dayun[i].start) return i;
    }
    return -1;
  }

  function mainKind(kinds) {
    for (var i = 0; i < T.eventOrder.length; i++) if (kinds.indexOf(T.eventOrder[i]) >= 0) return T.eventOrder[i];
    return null;
  }

  function renderNenpyo(c) {
    var n = c.nenpyo;
    var nodes = n.past.slice().sort(function (a, b) { return a.year - b.year; })
      .map(function (r) { return { type: 'past', row: r }; });
    nodes.push({ type: 'now', row: n.now });
    var html = '<ol class="tl">';
    nodes.forEach(function (nd, i) {
      var bi = bandOf(c.dayun, nd.row.year);
      var color = bi >= 0 ? EL_COLOR[STEM_EL[c.dayun[bi].gz.charAt(0)]] : BASE_COLOR;
      var periodContext;
      if (bi >= 0) {
        var d = c.dayun[bi];
        var isNow = nd.type === 'now' || (thisYear >= d.start && thisYear < d.start + 10);
        periodContext = '<div class="year-decade"><p class="year-detail-label">この10年の流れ</p><p class="pill">' + d.start + '〜' + (d.start + 9) + '年' +
          '</p><p class="band-title">' + wb(T.dayun[d.star][isNow ? 'now' : 'past']) + '</p></div>';
      } else {
        periodContext = '<div class="year-decade"><p class="pill">生まれてから最初の10年</p></div>';
      }
      html += yearNode(nd, color, periodContext, i === 0);
    });
    html += '<li class="tl-year tl-next" style="--c:' + BASE_COLOR + '"><div class="year-heading">' +
      '<div class="year-date"><span class="year-future">これから</span></div><div class="year-content">' +
      '<h3>次の節目</h3><p class="tl-text year-lead">今後の節目や流れを読める月額プランを準備しています。</p>' +
      '<a class="mini-line" data-jump="korekara" href="#sec-korekara">月額プランの提供予定を見る</a></div></div></li>';
    html += '</ol>';
    if (n.past.length) {
      html += '<p class="tally" id="tally" hidden>' + n.past.length + '年のうち、<b id="hits">0</b>つ当たった</p>';
    } else {
      html += '<p class="tally">15歳からの年表は、これから刻まれていきます。</p>';
    }
    return html;
  }

  function yearNode(nd, color, periodContext, first) {
    var r = nd.row, past = nd.type === 'past';
    var k = mainKind(r.kinds);
    var ev = k ? T.events[k] : null;
    var title = { kirikae: '環境や関心の切り替わり', chu: '暮らしや人間関係の変化', go: '人とのつながり', fukugin: '大切にしたいことの再確認' }[k] || '今の生活を整える';
    var more = r.kinds.filter(function (x) { return x !== k; }).map(function (x) {
      return T.events[x][past ? 'pastText' : 'nowText'];
    });
    var text = ev ? ev[past ? 'pastText' : 'nowText'] : T.quietYear;
    /* 1文目は専門的な根拠なので札に回し、2文目から見せる */
    var firstStop = text.indexOf('。');
    var hasMoreSentences = firstStop >= 0 && text.slice(firstStop + 1).trim().length > 0;
    var lead = hasMoreSentences ? text.slice(firstStop + 1).trim() : text;
    var h = '<li class="tl-year ' + (past ? 'tl-past' : 'tl-now') + '" style="--c:' + color + '">' +
      '<div class="year-heading"><div class="year-date"><div class="node">' + r.year + '<small>年</small></div>' +
      '<p class="year-age">' + esc(r.age) + '</p>' + (past ? '' : '<span class="year-current">今年のテーマ</span>') + '</div>' +
      '<div class="year-content"><h3>' + esc(title) + '</h3>' +
      '<p class="tl-text year-lead">' + esc(lead) + '</p>' +
      '<div class="year-detail">' +
      '<div class="year-notes"><div class="year-notes-copy"><p class="year-detail-label">対象の期間</p>' +
      '<p class="tl-period">' + esc(r.period) + '</p>';
    more.forEach(function (t) { h += '<p class="tl-more">' + esc(t) + '</p>'; });
    h += periodContext + '</div>';
    if (ev) h += '<div class="photo-wrap"><img class="photo" src="assets/img/ev_' + k + '.webp" alt="' + esc(ev.photo) + 'の絵" width="900" height="675" loading="lazy"></div>';
    h += '</div></div>';
    if (past) {
      h += '<div class="year-feedback"><span class="feedback-label">この年に、心当たりは？</span>' +
        '<div class="hit" data-year="' + r.year + '"><button type="button" data-v="1" aria-pressed="false">当たってる</button>' +
        '<button type="button" data-v="0" aria-pressed="false">違う</button></div></div>';
    }
    return h + '</div></div></li>';
  }

  function currentDayun(c) {
    var i = bandOf(c.dayun, thisYear);
    return i >= 0 ? c.dayun[i] : null;
  }

  /* 結果の一番上に置く、言い切りの1〜2行 */
  function conclusionOf(c, cur) {
    var years = c.nenpyo.past.map(function (r) { return r.year; }).sort(function (a, b) { return a - b; });
    var line = T.roleLine[c.type.role];
    var s = line + '。';
    if (years.length) s += '振り返りの手がかりになる年は、' + years.join('年・') + '年です。';
    if (cur) s += 'いまは「' + plain(T.dayun[cur.star].now) + '」の途中です。';
    return s;
  }

  /* 星の意味の短い言い方（用語の説明の2文目） */
  function starMeaning(star) {
    var t = (T.terms[star] || '').split('。');
    return t[1] || star;
  }
  function starsOf(c) {
    return Object.keys(c.ganStar).map(function (k) { return c.ganStar[k]; })
      .concat(Object.keys(c.zhiStar).map(function (k) { return c.zhiStar[k]; }));
  }
  function moneyOf(c) {
    var s = starsOf(c), flow = s.indexOf('偏財') >= 0, keep = s.indexOf('正財') >= 0;
    return flow && keep ? 'both' : flow ? 'flow' : keep ? 'keep' : 'none';
  }
  function wordsOf(c) {
    var s = starsOf(c);
    return s.indexOf('傷官') >= 0 ? 'sharp' : s.indexOf('食神') >= 0 ? 'soft' : 'hold';
  }
  function groupOf(key) { return T.groups.filter(function (g) { return g.key === key; })[0]; }

  /* つまずきやすい場面（自分）：身近な人の位置 → ない星 → 見られ方と本音 → 強みの裏返し の順に3つ */
  function selfZure(me) {
    var list = [];
    var top = groupOf(me.type.group), topN = me.count[top.key] || 0;
    var close = me.zhiStar['日支'], cz = T.closeZure[close];
    if (cz) list.push({ title: cz.title, appear: cz.appear, advice: cz.advice,
      basis: '生まれ日の、身近な人を表すところに「' + starMeaning(close) + '」の星がある' });
    var zero = ['食傷', '官', '財', '印', '比劫'].filter(function (k) { return !me.count[k]; })[0];
    if (zero) {
      var zz = T.zeroZure[zero];
      list.push({ title: zz.title, appear: zz.appear, advice: zz.advice,
        basis: (topN >= 2 ? '「' + top.power + '」の星が' + topN + 'つある一方、' : '') + '「' + groupOf(zero).power + '」の星が、生まれの5か所にひとつもない' });
    }
    if (me.kyusei.hon !== me.kyusei.getsu) {
      var kh = T.kyusei[me.kyusei.hon], kg = T.kyusei[me.kyusei.getsu];
      list.push({ title: T.faceZure.title, advice: T.faceZure.advice,
        basis: '生まれ年から見ると「' + kh.out + '」。生まれ月から見ると、本音は「' + kg.inner + '」',
        appear: '周りからは' + kh.out + 'と見られやすい一方、心の中では' + kg.inner + 'と思っています。' + T.faceZure.appear });
    }
    list.push({ title: '強みの裏返し', advice: T.roleAdvice[me.type.role],
      basis: '生まれの5か所でいちばん多いのが「' + top.power + '」の星',
      appear: '強みの裏返しで、' + T.roles[me.type.role].back + 'ところがあります。' });
    return list.slice(0, 3);
  }

  var POS_NAME = { '年支': '生まれ年', '月支': '生まれ月', '日支': '生まれ日', '時支': '生まれた時刻' };
  /* すれ違いやすい場面：大事にしたいもの・ぶつかる組み合わせ・同じところで意地・言葉・お金。最大4つ */
  function pairZure(me, pt, rel, pname, c) {
    var Z = T.pairZure, list = [];
    function add(z, basis) { list.push({ title: z.title, appear: z.appear, advice: z.advice, basis: basis }); }
    var key = rel === 'love' ? '日支' : '月支';
    var va = T.values[rel][me.zhiStar[key]], vb = T.values[rel][pt.zhiStar[key]];
    if (va !== vb) add(Z.values, 'あなたは「' + va + '」、' + pname + 'は「' + vb + '」を大事にする（' + POS_NAME[key] + 'から）');
    var chu = c.rel.filter(function (r) { return r.tag === '冲'; });
    chu.sort(function (p, q) { return (q.a === key && q.b === key) - (p.a === key && p.b === key); });
    if (chu.length) add(Z.chu, 'あなたの' + POS_NAME[chu[0].a] + 'と、' + pname + 'の' + POS_NAME[chu[0].b] + 'が、正面からぶつかる組み合わせ');
    if (me._raw.dz === pt._raw.dz && '辰午酉亥'.indexOf(me._raw.dz) >= 0) add(Z.self, '二人とも生まれ日の下の字が同じで、似た者同士がぶつかりやすい字');
    var wa = wordsOf(me), wp = wordsOf(pt);
    if ((wa === 'sharp' && wp === 'hold') || (wa === 'hold' && wp === 'sharp')) {
      var sharp = wa === 'sharp' ? 'あなた' : pname, hold = wa === 'sharp' ? pname : 'あなた';
      add(Z.words, sharp + 'は言葉が鋭く出る星を持ち、' + hold + 'は表現の星を持たない');
    }
    var ma = moneyOf(me), mp = moneyOf(pt);
    if ((ma === 'flow' && mp === 'keep') || (ma === 'keep' && mp === 'flow')) {
      add(Z.money, (ma === 'flow' ? 'あなた' : pname) + 'はお金を回す星、' + (ma === 'flow' ? pname : 'あなた') + 'は守る星を持つ');
    }
    if (!list.length) add(Z.calm, '二人の生まれに、正面からぶつかる組み合わせが見当たらない');
    return list.slice(0, 4);
  }

  function zureTable(list) {
    return '<div class="zure-wrap"><ol class="zure-list">' + list.map(function (z, i) {
      return '<li><div class="zure-heading"><span class="zure-no">' + pad(i + 1) + '</span><h3>' + esc(z.title) + '</h3></div>' +
        '<div class="zure-reading"><p class="zure-scene" data-label="実際にどう出やすいか">' + esc(z.appear) + '</p>' +
        '<p class="zure-basis" data-label="生まれの根拠"><span>この項目の読み方</span>' + esc(z.basis) + '。</p></div></li>';
    }).join('') + '</ol></div>';
  }
  function adviceList(list) {
    return '<ol class="advice-list">' + list.map(function (z, i) {
      return '<li><span class="advice-no" aria-hidden="true">' + pad(i + 1) + '</span><div class="advice-copy">' +
        '<p class="advice-context">場面 ' + pad(i + 1) + '：' + esc(z.title) + '</p>' +
        '<h3>' + esc(z.advice[0]) + '</h3><p>' + esc(z.advice[1]) + '</p></div></li>';
    }).join('') + '</ol>';
  }

  function compatTail(me, pt, rel) {
    var c = M.compat(me, pt);
    var key = rel === 'love' ? '日支' : '月支';
    var pos = T.position[key].replace('の位置', '');
    var keyRel = c.rel.filter(function (r) { return r.a === key && r.b === key; })[0];
    if (c.tenchi) return '親しみを感じやすく、関係が深まりやすい組み合わせです。';
    if (c.kango) return rel === 'love' ? '互いに惹かれ、距離が縮まりやすい組み合わせです。'
      : '互いの力を借りて、一緒に進めやすい組み合わせです。';
    if (keyRel && keyRel.tag === '支合') return '意見を合わせやすく、息の合う組み合わせです。';
    if (keyRel && keyRel.tag === '半会') return '大事にする方向が近く、目標を共有しやすい組み合わせです。';
    if (keyRel && keyRel.tag === '同じ支') return '大切にすることが似ていて、共感しやすい組み合わせです。';
    if (keyRel && keyRel.tag === '冲') return '大切にすることの違いから、互いに学べる組み合わせです。';
    return 'ほどよい距離感で、長く付き合える組み合わせです。';
  }

  /* 相性は鑑定書と同じ順に、1画面に1つの話：結論 → 二人の価値観を比べる → いいこと → ズレ → 向き合い方。二人のこれからの5年だけ有料 */
  function compatPages(me, pt, rel, pname, num) {
    var c = M.compat(me, pt);
    var as = T.partnerAs[rel];
    var ab = as[c.aToBGroup], ba = as[c.bToAGroup];
    if (rel === 'love' && me.sex === 'M' && c.aToBGroup === '財') ab = 'パートナーとして惹かれる相手';
    if (rel === 'love' && me.sex === 'F' && c.aToBGroup === '官') ab = 'パートナーとして意識する相手';
    var key = rel === 'love' ? '日支' : '月支';
    var zl = pairZure(me, pt, rel, pname, c);
    var calm = zl.length === 1 && zl[0].title === T.pairZure.calm.title;
    var concl = compatTail(me, pt, rel) + (calm ? '大きなぶつかりは少なく、穏やかに続きやすい二人です。'
      : '日常ですれ違いやすい' + zl.length + 'つの場面と、関係を育てる工夫を紹介します。');

    var goods = ['あなたから見ると' + pname + 'は「' + ab + '」、' + pname + 'から見るとあなたは「' + ba + '」です。'];
    var positives = c.rel.filter(function (r) { return r.tag !== '冲'; });
    positives.sort(function (p, q) { return (q.a === key && q.b === key) - (p.a === key && p.b === key); });
    positives.forEach(function (r) {
      var head = 'あなたの' + POS_NAME[r.a] + 'と、' + pname + 'の' + POS_NAME[r.b];
      if (r.tag === '支合') goods.push(head + 'が結びついています。一緒にいると、自然と話がまとまりやすい関係です。');
      if (r.tag === '半会') goods.push(head + 'が同じ方向を向いています。二人がそろうと、同じ目標に向かいやすい関係です。');
      if (r.tag === '同じ支') goods.push(head + 'が同じ字です。価値観の根っこが似ていて、説明しなくても通じやすい関係です。');
    });
    c.sango.forEach(function () {
      goods.push('二人がそろうと、生まれの字が1つの流れとして完成します。一人ではできないことが回り出す組み合わせです。');
    });
    if (c.kango && !c.tenchi) goods.push('生まれ日の上の字どうしが、結びつこうとする関係です。離れても、また引き合いやすい縁です。');
    goods = goods.slice(0, 5);

    var kicker = '第' + Number(num) + '章　' + esc(pname) + 'との相性';
    function sub(id, title, body) {
      return '<section class="sec profile-chapter ch-relations profile-subpage" id="sec-relations-' + id + '">' +
        '<header class="profile-subpage-heading"><p class="chapter-kicker">' + kicker + '</p><h2>' + title + '</h2></header>' + body + '</section>';
    }
    var rows = [
      ['タイプ', typeName(me.type), typeName(pt.type)],
      ['周りから見える姿', T.kyusei[me.kyusei.hon].out, T.kyusei[pt.kyusei.hon].out],
      [(rel === 'love' ? '恋愛' : '仕事') + 'で大事にしたいもの', T.values[rel][me.zhiStar[key]], T.values[rel][pt.zhiStar[key]]],
      ['お金の使い方', T.money[moneyOf(me)], T.money[moneyOf(pt)]],
      ['気持ちの伝え方', T.words[wordsOf(me)], T.words[wordsOf(pt)]]
    ];

    return '<section class="sec profile-chapter ch-relations" id="sec-relations">' + chapterHeading(num, esc(pname) + 'との相性', concl, '二人の関係の特徴') +
      '<p class="sec-lead">' + (rel === 'love' ? '恋愛' : '仕事') + 'の関係として見ています。</p>' +
      '<div class="pair"><figure class="el-' + STEM_EL[me.type.dg] + '">' + godImg(me.type.dg, '') + '<figcaption>あなた<b>' + esc(typeName(me.type)) + '</b></figcaption></figure>' +
      '<figure class="el-' + STEM_EL[pt.type.dg] + '">' + godImg(pt.type.dg, '') + '<figcaption>' + esc(pname) + '<b>' + esc(typeName(pt.type)) + '</b></figcaption></figure></div>' +
      '<div class="pair-viewpoints"><div class="viewpoint"><p class="viewpoint-label">あなたから見た' + esc(pname) + '</p>' +
      '<p class="viewpoint-value">「' + esc(ab) + '」</p></div>' +
      '<div class="viewpoint"><p class="viewpoint-label">' + esc(pname) + 'から見たあなた</p>' +
      '<p class="viewpoint-value">「' + esc(ba) + '」</p></div></div>' + fuda('day') +
      (rel === 'work' ? '<p class="caution">採用や評価の判断には使わないでください。</p>' : '') + '</section>' +

      sub('katachi', '二人の価値観を比べる',
        '<p class="sec-lead">同じ項目で見比べると、大切にすることの共通点と違いが分かります。</p>' +
        '<div class="katachi-wrap"><table class="katachi-table"><thead><tr><th scope="col"><span class="sr-only">項目</span></th><th scope="col">あなた</th><th scope="col">' + esc(pname) + '</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td data-label="あなた">' + esc(r[1]) + '</td><td data-label="' + esc(pname) + '">' + esc(r[2]) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + fuda(rel === 'love' ? 'day' : 'month')) +

      sub('ii', '二人が協力しやすいところ', '<p class="sec-lead">互いの違いを活かせる点や、一緒に取り組みやすいことを見ていきます。</p><ul class="goods goods-pair">' + goods.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' + fuda('day')) +

      sub('zure', 'すれ違いやすい場面', '<p class="sec-lead">日々のやり取りで、すれ違いが出やすい場面です。次の「すれ違いを減らす工夫」と、同じ番号で対応しています。</p>' + zureTable(zl)) +

      sub('mukiai', 'すれ違いを減らす工夫', '<p class="sec-lead">二人で試せる、' + zl.length + 'つのこと。</p>' + adviceList(zl) +
        '<div class="locked locked-pair"><h3>二人のこれからの5年</h3><p class="tl-text">二人の関係を考える手がかりとして、これからの流れを年ごとにお届けする予定です。</p>' +
        '<p class="note">月額500円のプランで提供予定です。現在は準備中です。</p><a class="mini-line" data-jump="korekara" href="#sec-korekara">月額プランの提供予定を見る</a></div>' +
        '<p class="third-person">3人目からの相性も、月額プランで提供予定です。</p>');
  }

  /* 人との関わり方：相手の生まれ日（10の生まれ）ごとの早見表 */
  function renderKakawari(me, hasPartner) {
    var dg = me.type.dg;
    var rows = ELEMENTS.map(function (stems) {
      var g = M.GROUP_OF_STAR[M.star(dg, stems[0])];
      var notes = [];
      if ((me.sex === 'M' && g === '財') || (me.sex === 'F' && g === '官')) notes.push('恋愛では、パートナーを表す相手');
      stems.forEach(function (s) { if (KANGO_OF[dg] === s) notes.push(STEM_NAME[s] + 'の生まれとは、とくに強く引き合います'); });
      return '<tr' + (stems.indexOf(dg) >= 0 ? ' class="is-self"' : '') + '><th scope="row">' +
        stems.map(function (s) { return STEM_NAME[s]; }).join('・') + 'の生まれ' + (stems.indexOf(dg) >= 0 ? '<small>あなたと同じ仲間</small>' : '') + '</th>' +
        '<td><b>' + esc(T.kakawari[g]) + '</b>' + notes.map(function (n) { return '<small>' + esc(n) + '</small>'; }).join('') + '</td></tr>';
    }).join('');
    return '<p class="sec-lead">家族・友人・職場の人との関わり方を、生まれの組み合わせから読んだ早見表です。相手のタイプにある自然物の名前で探せます。</p>' +
      '<div class="kakawari-wrap"><table class="kakawari-table"><thead><tr><th scope="col">相手の生まれ</th><th scope="col">あなたとの関わり</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      fuda('day') +
      (hasPartner
        ? '<p class="third-person">相手の生まれは、その人の生年月日を入れると分かります。3人目からの相性は、月額プランで提供予定です。</p>'
        : '<div class="insight-block profile-partner-prompt"><h3>気になる人との相性を、無料で</h3>' +
          guide('気になる人の生年月日を1人分入れると、二人の価値観や、協力しやすいところ、すれ違いを減らす工夫を無料で確認できます。') +
          '<a class="reading-link" href="#aisho">相手を追加して鑑定する</a></div>');
  }

  function chartsOf(q) {
    var me = M.chart({ name: q.get('n') || '', date: q.get('d'), sex: q.get('s'), time: q.get('t') || null, place: q.get('p') || '' });
    var pt = q.get('pd') ? M.chart({ name: q.get('pn') || '', date: q.get('pd'), sex: q.get('ps') }) : null;
    return { me: me, pt: pt, pname: q.get('pn') ? q.get('pn') + 'さん' : 'お相手' };
  }
  function firstSentence(s) {
    var i = String(s).indexOf('。');
    return i >= 0 ? s.slice(0, i + 1) : s;
  }
  function pillarLine(c) {
    return ['年柱', '月柱', '日柱', '時柱'].filter(function (k) { return c.pillars[k]; })
      .map(function (k) { return c.pillars[k] + k.charAt(0); }).join('　');
  }

  function chapterHeading(number, title, point, keyLabel) {
    return '<header class="profile-chapter-heading"><p class="chapter-kicker">第' + Number(number) + '章</p>' +
      '<span class="chapter-number">' + number + '</span><h2>' + title + '</h2></header>' +
      (point ? '<div class="chapter-key"><p class="chapter-key-label">' + (keyLabel || 'ここで分かること') + '</p><p class="chapter-key-text">' + esc(point) + '</p></div>' : '');
  }

  /* タイプの説明、振り返る年、現在のテーマを分けて示す。 */
  function renderSheet(me, who, cur, order, CH, extra) {
    var ty = me.type, b = me.birth;
    var roleArt = { '賢者': 'scholar', '開拓者': 'pioneer', '表現者': 'creator', '統率者': 'leader', '独立者': 'independent' }[ty.role];
    var years = me.nenpyo.past.map(function (r) { return r.year; }).sort(function (a, b) { return a - b; });
    var info = [['生年月日', b.y + '年' + b.m + '月' + b.d + '日・' + (me.sex === 'M' ? '男性' : '女性') + (me.time ? '・' + me.time + '生まれ' : '')],
      ['鑑定日', thisYear + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日']];
    if (extra.pt) info.push(['相性のお相手', extra.pname + '・' + typeName(extra.pt.type)]);
    var points = order.filter(function (k) { return CH[k].point; }).map(function (k, i) {
      return '<li class="pt-' + k + '"><a href="#sec-' + k + '" data-jump="' + k + '">' +
        '<span class="pt-label"><span class="pt-no">' + pad(i + 1) + '</span>' + CH[k].tag + '</span>' +
        '<b>' + esc(CH[k].point) + '</b><span class="pt-more" aria-hidden="true">読む →</span></a></li>';
    }).join('');
    return '<section class="report-sheet" id="sec-overview">' +
      '<header class="sheet-head"><p class="report-eyebrow">四柱推命の鑑定レポート</p><h1 class="sheet-title">' + esc(who) + 'の鑑定結果</h1>' +
      '<p class="sheet-desc">性格、大切にすること、人との関わり方を読み解きます。</p></header>' +
      '<div class="sheet-type"><div class="sheet-identity"><p class="sheet-label">あなたのタイプ</p>' +
      '<p class="sheet-type-name">' + esc(typeName(ty)) + '</p><p class="type-definition">' + esc(T.roleLine[ty.role]) + '。</p>' +
      '<p class="type-caption">「' + esc(STEM_NAME[ty.dg]) + '」は生まれ日の性質、「' + esc(ty.role) + '」は持ち味を表しています。</p></div>' +
      '<img class="sheet-art" src="assets/img/modern-' + roleArt + '.webp" alt="" width="960" height="720" decoding="async"></div>' +
      '<div class="report-highlights"><div><h2>振り返りの手がかりになる年</h2><p class="highlight-years">' +
      (years.length ? years.join('・') + '<span>年</span>' : 'これまでと今年を振り返る') + '</p>' +
      '<p>暮らしや人間関係に、変化はありましたか。</p><a href="#sec-nenpyo" data-jump="nenpyo">年齢・出来事のテーマを見る <span aria-hidden="true">→</span></a></div>' +
      (cur ? '<div><h2>今の10年間のテーマ</h2><p class="highlight-theme">' + esc(plain(T.dayun[cur.star].now)) + '</p><p>' + cur.start + '〜' + (cur.start + 9) + '年</p></div>' : '') + '</div>' +
      '<p class="report-context">四柱推命による見立てです。ご自身の経験と照らし合わせてお読みください。</p>' +
      '<div class="sheet-side"><h2 class="sheet-label">項目別に結果を読む</h2><ol class="sheet-points">' + points + '</ol></div>' +
      '<div class="sheet-supplements"><h2 class="supplement-heading">鑑定に使った情報</h2><dl class="sheet-info">' +
      info.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (me.name ? renderKakusu(me.name) : '') + '</div></section>';
  }

  function render(q) {
    var cs = chartsOf(q), me = cs.me, pt = cs.pt, pname = cs.pname;
    var who = me.name ? me.name + 'さん' : 'あなた';
    var ty = me.type;
    var hasPartner = !!pt;
    var rel = q.get('r') === 'work' ? 'work' : 'love';
    var cur = currentDayun(me);
    var role = T.roles[ty.role];
    var zl = selfZure(me);

    function valueBlock(label, text, kind, extra) {
      var head = firstSentence(text), rest = text.slice(head.length).trim();
      return '<section class="value-block"><p class="value-label">' + label + '</p><h3>' + esc(head) + '</h3>' +
        (rest ? '<p>' + esc(rest) + '</p>' : '') + (extra || '') + fuda(kind) + '</section>';
    }

    var CH = {
      relations: { label: '相性', tag: '相性', point: hasPartner ? compatTail(me, pt, rel) : '' },
      seikaku: { label: '性格', tag: '性格', title: 'あなたの性格', point: firstSentence(T.face[ty.dg]),
        body: '<div class="faces"><div class="face face-front"><p class="face-sub">周囲からの印象</p><h3>周りから見えるあなた</h3>' +
          '<p class="face-text">' + esc(T.face[ty.dg]) + '</p>' + fuda('day') + '</div>' +
          '<div class="face face-back"><p class="face-sub">あなた自身の価値観</p><h3>内側で大切にすること</h3>' +
          '<p class="face-text">' + esc(T.hidden[ty.tenStar]) + '</p>' + fuda(POS_FUDA[ty.deciding]) + '</div></div>' },
      kachikan: { label: '仕事・恋愛・人生の価値観', tag: '価値観', title: '仕事・恋愛・人生で大切にすること', point: 'あなたの強みは、' + role.strength + '。',
        body: '<div class="values">' +
          valueBlock('仕事観', T.work[me.zhiStar['月支']], 'month', '<p class="value-extra"><b>力が出る役回り</b>' + esc(role.place) + '</p>') +
          valueBlock('恋愛観', T.love[me.zhiStar['日支']], 'day') +
          valueBlock('人生観', T.life[me.ganStar['月干']], 'month') + '</div>' },
      nenpyo: { label: '人生の節目', tag: '節目', title: 'これまでの節目と、今のテーマ',
        point: me.nenpyo.past.length ? '15歳以降の' + me.nenpyo.past.length + 'つの年を、振り返りの手がかりとして取り上げています。' : '',
        body: guide('四柱推命で節目と読む年を、年齢と一緒に並べています。実際の経験を思い出しながら、心当たりがあるかを選んでください。') + renderNenpyo(me) +
          (cur ? '<div class="insight-block current-flow"><p class="profile-kicker">今の10年間のテーマ</p><h3>' + wb(T.dayun[cur.star].now) + '</h3>' +
          '<p class="flow-period">' + cur.start + '〜' + (cur.start + 9) + '年</p>' + fuda('dayun') + '</div>' : '') },
      kakawari: { label: '人との関わり方', tag: '人間関係', title: '人との関わり方',
        point: STEM_NAME[KANGO_OF[ty.dg]] + 'の生まれの人とは、とくに強く引き合います。', body: renderKakawari(me, hasPartner) },
      zure: { label: 'つまずきやすい場面', tag: 'つまずきやすい場面', title: 'つまずきやすい場面', point: 'まず振り返りたい場面：' + zl[0].title,
        body: '<p class="sec-lead">持ち味が、うまく伝わらないこともあります。ふだんの場面を振り返り、次の章で試せる工夫を見つけてください。</p>' + zureTable(zl) },
      jogen: { label: '日常で試せる工夫', tag: '日常で試せる工夫', title: '日常で試せる工夫', point: zl[0].advice[0] + '。',
        body: '<p class="sec-lead">前の章の場面に対応する、' + zl.length + 'つの工夫。気になるものを1つ、試してみてください。</p>' + adviceList(zl) }
    };
    var order = (hasPartner ? ['relations'] : []).concat(['seikaku', 'kachikan', 'nenpyo', 'kakawari', 'zure', 'jogen']);

    var toc = [['overview', 'レポートの要点']].concat(order.reduce(function (links, k) {
      links.push([k, CH[k].label]);
      if (k === 'relations') links = links.concat([['relations-katachi', '二人の価値観を比べる'], ['relations-ii', '協力しやすいところ'],
        ['relations-zure', 'すれ違いやすい場面'], ['relations-mukiai', 'すれ違いを減らす工夫']]);
      return links;
    }, []))
      .concat([['matome', '振り返りと次の一歩'], ['korekara', 'サービスの提供予定'], ['reading', 'この鑑定の読み方']]);
    $('#toc').innerHTML = '<div class="profile-nav-person">' + godImg(ty.dg, '') + '<div><span>' + esc(who) + '</span><b>' + esc(typeName(ty)) + '</b></div></div>' +
      '<p class="profile-nav-title">このレポートの内容</p><div class="profile-nav-links">' + toc.map(function (t) {
        return '<a href="#sec-' + t[0] + '" data-sec="' + t[0] + '"' + (t[0].indexOf('relations-') === 0 ? ' class="toc-subpage"' : '') + '>' + t[1] + '</a>';
      }).join('') + '</div>' +
      '<a class="profile-nav-cta" data-join href="#join">保存・会員機能について<small>現在、準備中です</small></a>';

    var h = renderSheet(me, who, cur, order, CH, { pt: pt, pname: pname });
    order.forEach(function (k, i) {
      if (k === 'relations') { h += compatPages(me, pt, rel, pname, pad(i + 1)); return; }
      h += '<section class="sec profile-chapter" id="sec-' + k + '">' + chapterHeading(pad(i + 1), CH[k].title, CH[k].point) + CH[k].body + '</section>';
    });

    var years = me.nenpyo.past.map(function (r) { return r.year; }).sort(function (a, b) { return a - b; });
    h += '<section class="summary profile-summary" id="sec-matome"><h2>振り返りと、次の一歩</h2>' +
      '<p class="big">' + esc(who) + 'は、<wbr>' + esc(typeName(ty)) + '。</p><ul class="matome-list">' +
      '<li>' + esc(firstSentence(T.face[ty.dg])) + '</li>' +
      '<li>仕事では、' + esc(role.strength) + 'が武器になります。</li>' +
      (years.length ? '<li>' + years.join('年・') + '年を、振り返りの手がかりにしています。</li>' : '') +
      (cur ? '<li>いまは「' + esc(plain(T.dayun[cur.star].now)) + '」の途中です。</li>' : '') + '</ul>' +
      '<p class="matome-end">心当たりのある場面と、試してみたい工夫を1つずつ。日々の選び方を考えるときに、このレポートを読み返してみてください。</p></section>';

    h += '<section class="sec profile-chapter profile-future" id="sec-korekara">' + chapterHeading(pad(order.length + 1), 'これからのサービスについて') +
      '<p class="sec-lead">現在、鑑定レポートは登録なしで無料で読めます。保存機能と月額プランは準備中です。</p>' +
      '<div class="service-options"><div class="service-free"><p class="service-status">現在ご利用いただけます</p><h3>無料の鑑定レポート</h3>' +
      '<ul><li>あなたの性格・価値観・これまでの節目</li><li>相手1人との相性・関わり方の工夫</li></ul><p>会員登録せずに、そのままお読みいただけます。</p></div>' +
      '<div class="locked"><p class="service-status">準備中</p><h3>これからの流れを読む月額プラン</h3><p class="price">月額 <b>500円</b>（提供予定）</p><ul>' +
      T.future.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      '<p class="note">申込受付はまだ始まっていません。無料の会員登録・結果の保存も準備中です。</p>' +
      '<a class="mini-line" data-join href="#join">保存・会員機能について</a></div></div></section>';

    h += '<footer class="foot report-method" id="sec-reading"><h2>この鑑定の読み方</h2>' +
      '<p>生年月日をもとに四柱推命で読み解いた、自己理解のためのレポートです。実際の出来事や相手の気持ちを確認した結果ではありません。</p>' +
      '<dl class="method-list">' + ['year', 'month', 'day', 'dayun'].map(function (k) {
        return '<div><dt>' + esc(T.fuda[k].label.replace(/から$/, '')) + '</dt><dd>' + esc(T.fuda[k].text) + '</dd></div>';
      }).join('') + '</dl><p>名前の画数は熊崎式の旧字体で数えています。天格は判断に使っていません。</p>' +
      (me.note.length ? '<p>' + esc(me.note.join('、')) + '</p>' : '') +
      '<p class="method-operator">運営：株式会社La plus</p><p><a href="#">入力し直す</a>　<a href="privacy.html">個人情報の取り扱い</a></p></footer>';

    $('#report').className = 'el-' + STEM_EL[ty.dg] + ' profile-document';
    $('#report').innerHTML = h;
    paginate(who);
    $('#entry').hidden = true;
    SCREENS.forEach(function (id) { $('#' + id).hidden = true; });
    $('#result').hidden = false;
    $('#lineBar').hidden = false;
    document.title = typeName(ty) + '｜' + who + 'の鑑定結果';
    window.scrollTo(0, 0);
    bindReport();
    reveal($('#report'), '.report-page, .guide, .chapter-key, .sheet-type, .kakusu, .sheet-info, .sheet-points li, .face, .value-block, .insight-block, .tl, .tl-year, .zure-wrap, .advice-list li, .kakawari-wrap, .katachi-wrap, .locked, .summary .big');
  }

  /* 各ページの上に柱（書類名・お名前・日付）、下にページ番号をつける */
  function paginate(who) {
    var pages = $$('#report > section');
    var date = thisYear + '.' + pad(today.getMonth() + 1) + '.' + pad(today.getDate());
    pages.forEach(function (s, i) {
      s.classList.add('report-page');
      s.insertAdjacentHTML('afterbegin', '<div class="page-run" aria-hidden="true"><span>HIYOMI 鑑定レポート</span><span>' + esc(who) + '　' + date + '</span></div>');
      s.insertAdjacentHTML('beforeend', '<p class="page-no" aria-hidden="true">' + (i + 1) + ' / ' + pages.length + '</p>');
      var a = $('#toc a[data-sec="' + s.id.replace('sec-', '') + '"]');
      if (a) a.insertAdjacentHTML('beforeend', '<span class="toc-page">' + (i + 1) + '</span>');
    });
  }

  /* 画面に入ったときに表示する。動きを減らす設定の人には最初から全部見せる */
  var revealIO = null;
  function reveal(root, sel) {
    if (!root || !document.documentElement.classList.contains('anim')) return;
    var els = $$(sel, root);
    if (!('IntersectionObserver' in window)) return;
    if (!revealIO) revealIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        revealIO.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) {
      var i = Array.prototype.indexOf.call(e.parentNode.children, e);
      e.style.setProperty('--d', Math.min(i, 6) * 70 + 'ms');
      e.classList.add('rv');
      revealIO.observe(e);
    });
  }

  var io = null;
  function bindReport() {
    var links = $$('#toc a');
    var secs = links.map(function (a) { return document.getElementById('sec-' + a.dataset.sec); });
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          var on = 'sec-' + a.dataset.sec === en.target.id;
          a.classList.toggle('on', on);
          if (on) {
            // 目次の中だけをスクロールし、読んでいる本文の位置を動かさない。
            var nav = $('#toc'), nr = nav.getBoundingClientRect(), ar = a.getBoundingClientRect();
            if (nav.scrollWidth > nav.clientWidth) {
              if (ar.left < nr.left || ar.right > nr.right) nav.scrollLeft += ar.left - nr.left - (nav.clientWidth - ar.width) / 2;
            } else if (ar.top < nr.top || ar.bottom > nr.bottom) {
              nav.scrollTop += ar.top < nr.top ? ar.top - nr.top : ar.bottom - nr.bottom;
            }
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { if (s) io.observe(s); });
  }

  function bindReportClicks() {
    $('#report').addEventListener('click', function (e) {
      var g = e.target.closest('.guide-mini');
      if (g) {
        var d = g.parentNode.querySelector('.year-detail');
        if (d) d.open = !d.open;
        return;
      }
      var jump = e.target.closest('[data-jump]');
      if (jump) {
        e.preventDefault();
        var target = document.getElementById('sec-' + jump.dataset.jump);
        if (target) target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        return;
      }
      var hb = e.target.closest('.hit button');
      if (hb) {
        $$('button', hb.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', x === hb && x.getAttribute('aria-pressed') !== 'true' ? 'true' : 'false'); });
        var hits = $$('.hit button[data-v="1"][aria-pressed="true"]').length;
        if ($('#hits')) $('#hits').textContent = hits;
        /* 1つ押されるまでは「〇年のうち0つ当たった」を出さない */
        if ($('#tally')) $('#tally').hidden = !$$('.hit button[aria-pressed="true"]').length;
      }
    });
  }

  /* 入口の見本：実際の計算（1992-04-18・女性）からタイプと結論を出す */
  function fillSample() {
    var el = $('.report-sample');
    if (!el) return;
    var c = M.chart({ name: '山田花子', date: '1992-04-18', sex: 'F' });
    $('.sample-type', el).textContent = typeName(c.type);
    $('.sample-lead', el).textContent = conclusionOf(c, currentDayun(c));
  }

  /* ---------- 共通 ---------- */
  var PROVIDER = { line: 'LINE', google: 'Google', apple: 'Apple', email: 'メールアドレス' };
  var AUTH_ERROR = {
    link: 'リンクの期限が切れたか、使用済みです。もう一度お送りください',
    exists: 'このメールアドレスは、別の方法で登録済みです。前回と同じ方法でログインしてください',
    login: 'ログインできませんでした。もう一度お試しください'
  };
  var SCREENS = ['entry', 'join', 'found', 'recover', 'mypage'];
  /* member.js（Firebase）がログイン状態を知らせてくる。設定が空なら null のまま */
  var authUser = null;
  var KEY_PENDING = 'hiyomi:pending';
  var KEY_LAST = 'hiyomi:lastProvider';
  /* Threads の投稿ごとの印（?p=投稿ID）。会員登録のときにサーバーへ渡す */
  var KEY_SRC = 'hiyomi:src';

  function store(kind, key, val) {
    try {
      var s = kind === 'local' ? localStorage : sessionStorage;
      if (val === undefined) return s.getItem(key);
      s.setItem(key, val);
    } catch (err) { return null; }
  }

  function startLogin(p) {
    store('local', KEY_LAST, p);
    markLastProvider();
    var A = window.HiyomiAuth;
    if (!A) { toast('ログインは準備中です'); return; }
    if (!A.can(p)) { toast(PROVIDER[p] + 'は準備中です。ほかの方法でどうぞ'); return; }
    A.signIn(p, store('session', KEY_PENDING) || '').catch(function (e) {
      var code = (e && e.code) || '';
      if (/popup-closed|cancelled-popup/.test(code)) return;
      toast(code === 'auth/account-exists-with-different-credential' ? AUTH_ERROR.exists : AUTH_ERROR.login);
    });
  }

  function sendMailLink(input, note, sentText) {
    var A = window.HiyomiAuth;
    if (!A) { toast('メールの送信は準備中です'); return; }
    var mail = input.value.trim();
    note.textContent = '送っています…';
    note.hidden = false;
    A.sendLink(mail, store('session', KEY_PENDING) || '').then(function () {
      note.textContent = mail + ' に' + sentText;
    }, function () {
      note.hidden = true;
      toast('送れませんでした。アドレスを確かめて、もう一度お試しください');
    });
  }

  function readingHash(r) {
    var q = new URLSearchParams();
    [['n', r.name], ['d', r.date], ['s', r.sex], ['t', r.time], ['p', r.pref],
      ['pd', r.partnerDate], ['ps', r.partnerSex], ['r', r.relation]].forEach(function (kv) { if (kv[1]) q.set(kv[0], kv[1]); });
    return '#kantei?' + q.toString();
  }

  function renderMypage() {
    var A = window.HiyomiAuth;
    if (!A) { location.hash = '#join'; return; }
    if (!A.isReady()) return;
    if (!authUser) { location.hash = '#join'; return; }
    $('#mpWho').textContent = (authUser.email || authUser.name || '会員') + '（' + PROVIDER[authUser.provider] + 'でログイン中）';
    $('#mpList').innerHTML = '<p class="mp-empty">読み込んでいます…</p>';
    A.readings().then(function (rs) {
      if (!rs.length) {
        $('#mpList').innerHTML = '<p class="mp-empty">まだ保存したレポートはありません。結果画面の下のボタンから保存できます。</p>';
        return;
      }
      $('#mpList').innerHTML = '<ul class="mp-list">' + rs.map(function (r) {
        var c = M.chart({ name: r.name, date: r.date, sex: r.sex, time: r.time || null, place: r.pref || '' });
        return '<li class="el-' + STEM_EL[c.type.dg] + '"><a href="' + esc(readingHash(r)) + '">' +
          '<b>' + esc(r.name ? r.name + 'さん' : 'あなた') + '・' + esc(typeName(c.type)) + '</b>' +
          '<span>' + r.date.replace(/-/g, '/') + '生まれ' + (r.partnerDate ? '・相性つき' : '') + '</span></a></li>';
      }).join('') + '</ul>';
    }, function () {
      $('#mpList').innerHTML = '<p class="mp-empty">読み込めませんでした。時間をおいて開き直してください。</p>';
    });
  }

  document.addEventListener('hiyomi:auth', function (e) {
    authUser = e.detail;
    $('.line-btn').textContent = authUser ? '会員ページに保存する' : '保存・会員機能について';
    if (!$('#mypage').hidden) renderMypage();
  });
  document.addEventListener('hiyomi:authError', function (e) {
    toast(AUTH_ERROR[e.detail] || AUTH_ERROR.login);
  });

  function markLastProvider() {
    var last = store('local', KEY_LAST);
    $$('[data-pv]').forEach(function (b) {
      var on = b.dataset.pv === last;
      var badge = $('.pv-last', b);
      if (on && !badge) b.insertAdjacentHTML('beforeend', '<span class="pv-last">前回</span>');
      if (!on && badge) badge.remove();
    });
  }

  function showSaveNote() {
    var el = $('#saveNote');
    var h = store('session', KEY_PENDING) || '';
    var q = new URLSearchParams(h.replace(/^#kantei\?/, ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.get('d') || '') || !/^[MF]$/.test(q.get('s') || '')) { el.hidden = true; return; }
    var c = M.chart({ name: q.get('n') || '', date: q.get('d'), sex: q.get('s') });
    el.innerHTML = '表示中のレポート：' + esc(c.name ? c.name + 'さん' : 'あなた') + '・' + esc(typeName(c.type)) + '。保存機能は現在準備中です。';
    el.hidden = false;
  }

  function showFound(q) {
    var oldP = PROVIDER[q.get('old')] ? q.get('old') : 'google';
    var newP = PROVIDER[q.get('new')] ? q.get('new') : 'line';
    $('#foundMail').textContent = q.get('mail') || 'h****@gmail.com';
    $('#foundOld').textContent = PROVIDER[oldP];
    $('#foundOld2').textContent = PROVIDER[oldP];
    $('#foundNew').textContent = PROVIDER[newP];
    $('#foundLogin').textContent = PROVIDER[oldP] + 'でログインしてまとめる';
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-join]')) {
      var here = location.hash.indexOf('#kantei?') === 0 ? location.hash : '';
      store('session', KEY_PENDING, here);
      if (authUser && window.HiyomiAuth) {
        e.preventDefault();
        window.HiyomiAuth.save(here).then(function () { location.hash = '#mypage'; },
          function () { toast('保存できませんでした。もう一度お試しください'); });
      }
      return;
    }
    if (e.target.closest('#logout')) {
      if (window.HiyomiAuth) window.HiyomiAuth.signOut();
      return;
    }
    if (e.target.closest('[data-back]')) {
      e.preventDefault();
      location.hash = store('session', KEY_PENDING) || '';
      return;
    }
    var pv = e.target.closest('[data-provider]');
    if (pv) {
      var p = pv.dataset.provider;
      if (PROVIDER[p]) { startLogin(p); return; }
      toast({ 'link-old': '前の方法でのログインは準備中です', 'link-code': '確認コードの送信は準備中です', separate: '別の会員としての登録は準備中です' }[p]);
      return;
    }
    var toc = e.target.closest('#toc a[data-sec]');
    if (toc) {
      e.preventDefault();
      var s = document.getElementById('sec-' + toc.dataset.sec);
      if (s) s.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  });

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function route() {
    var hash = location.hash.replace(/^#/, '');
    if (hash.indexOf('kantei?') === 0) {
      var q = new URLSearchParams(hash.slice(7));
      if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('d') || '') && /^[MF]$/.test(q.get('s') || '')) {
        render(q);
        return;
      }
    }
    if (hash.indexOf('sec-') === 0) return;
    var name = hash.split('?')[0];
    var screen = SCREENS.indexOf(name) > 0 ? name : 'entry';
    $('#result').hidden = true;
    $('#lineBar').hidden = true;
    SCREENS.forEach(function (id) { $('#' + id).hidden = id !== screen; });
    if (screen === 'join') { showSaveNote(); markLastProvider(); }
    if (screen === 'found') showFound(new URLSearchParams(hash.split('?')[1] || ''));
    if (screen === 'mypage') renderMypage();
    var t = { join: 'レポートの保存・ログイン', found: '登録済みアカウントの確認', recover: 'ログイン方法を確認する', mypage: 'マイページ' }[screen];
    document.title = t ? t + '｜HIYOMI' : TITLE;
    window.scrollTo(0, 0);
    if (screen === 'entry' && (name === 'aisho' || name === 'kojin')) setMode(name === 'aisho' ? 'pair' : 'solo', true);
  }

  var MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  $('#mailForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#mailErr');
    if (!MAIL_RE.test($('#mail').value.trim())) { err.textContent = 'メールアドレスの形を確かめてください。'; return; }
    err.textContent = '';
    store('local', KEY_LAST, 'email');
    markLastProvider();
    sendMailLink($('#mail'), $('#mailSent'), 'ログイン用のリンクを送りました。メールを開いて、リンクを押すと登録が終わります。');
  });
  $('#recoverForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#recoverErr');
    if (!MAIL_RE.test($('#recoverMail').value.trim())) { err.textContent = 'メールアドレスの形を確かめてください。'; return; }
    err.textContent = '';
    sendMailLink($('#recoverMail'), $('#recoverSent'), 'ログイン用のリンクを送りました。前に登録したアドレスなら、リンクから保存したレポートが見られます。');
  });

  var src = new URLSearchParams(location.search).get('p');
  if (src && /^[\w-]{1,40}$/.test(src)) store('session', KEY_SRC, src);

  $$('.ymd').forEach(fillYmd);
  var pref = $('select[name=p]');
  pref.innerHTML += M.PREFS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  $('#form').addEventListener('submit', onSubmit);
  $$('button[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode, !b.closest('#form')); });
  });
  bindReportClicks();
  fillSample();
  reveal($('#entry'), '.form-people, .about-report h2, .about-report dl > div, .entry-foot');
  window.addEventListener('hashchange', route);
  route();
})();
