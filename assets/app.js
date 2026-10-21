(function () {
  'use strict';

  var TITLE = 'HIYOMI｜生まれた日から、人生が動いた年を当てる';

  var T = window.TEXTS;
  var M = window.Meishiki;
  var PALETTE = ['#00514d', '#8a5a2b', '#3f5f86', '#9a4636', '#5f4f8a', '#4f6f3a', '#7a6420', '#2f6f7a'];
  var GOD_IMG = { '甲': 'tree', '乙': 'flower', '丙': 'sun', '丁': 'flame', '戊': 'mountain',
    '己': 'field', '庚': 'sword', '辛': 'jewel', '壬': 'sea', '癸': 'rain' };
  function godImg(dg, cls) {
    return '<img class="' + cls + '" src="assets/img/kami_' + GOD_IMG[dg] + '.webp" alt="" width="480" height="640">';
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
  function term(w) { return T.terms[w] ? '<button type="button" class="term" data-t="' + esc(w) + '">' + esc(w) + '</button>' : esc(w); }
  function gzLabel(gz) { return gz + '（' + M.yomi(gz) + '）'; }
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
    var me = ymdOf(f, 'y', 'm', 'd');
    if (!me) return fail('あなたの生年月日を、年・月・日まで選んでください。');
    var s = radio(f, 's');
    if (!s) return fail('あなたの性別を選んでください。');
    if (me > todayStr()) return fail('生年月日が今日より後になっています。');
    var q = new URLSearchParams();
    if (f.n.value.trim()) q.set('n', f.n.value.trim());
    q.set('d', me);
    q.set('s', s);
    if (f.t.value) { q.set('t', f.t.value); if (f.p.value) q.set('p', f.p.value); }
    var pd = ymdOf(f, 'py', 'pm', 'pd');
    if (pd === null) return fail('気になる人の生年月日を、年・月・日まで選んでください。');
    if (pd) {
      var ps = radio(f, 'ps'), r = radio(f, 'r');
      if (!ps) return fail('気になる人の性別を選んでください。');
      if (!r) return fail('見たい関係（恋愛／仕事）を選んでください。');
      if (pd > todayStr()) return fail('気になる人の生年月日が今日より後になっています。');
      q.set('pd', pd); q.set('ps', ps); q.set('r', r);
      if (f.pn.value.trim()) q.set('pn', f.pn.value.trim());
    }
    err.textContent = '';
    location.hash = 'kantei?' + q.toString();
    function fail(msg) { err.textContent = msg; }
  }
  function todayStr() { return thisYear + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate()); }

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
    var curBand = null;
    nodes.forEach(function (nd) {
      var bi = bandOf(c.dayun, nd.row.year);
      var color = PALETTE[(bi + PALETTE.length) % PALETTE.length];
      if (bi !== curBand) {
        curBand = bi;
        if (bi >= 0) {
          var d = c.dayun[bi];
          var isNow = nd.type === 'now' || (thisYear >= d.start && thisYear < d.start + 10);
          html += '<li class="tl-band" style="--c:' + color + '"><span class="pill">' + d.start + '〜' + (d.start + 9) +
            '　｜　' + esc(gzLabel(d.gz)) + '</span><p class="band-title">' +
            wb(T.dayun[d.star][isNow ? 'now' : 'past']) + '</p></li>';
        } else {
          html += '<li class="tl-band" style="--c:' + color + '"><span class="pill">生まれてから最初の10年</span></li>';
        }
      }
      html += yearNode(nd, color);
    });
    var nextColor = '#76684d';
    html += '<li class="tl-year tl-next" style="--c:' + nextColor + '"><div class="node">？</div>' +
      '<h3>次の節目</h3><p class="tl-text">次に大きく動きやすい年を1つ、無料の会員登録でお見せします。</p>' +
      '<a class="mini-line" data-join href="#join">無料で会員登録</a></li>';
    html += '</ol>';
    if (n.past.length) {
      html += '<p class="tally" id="tally">' + n.past.length + '年のうち、<b id="hits">0</b>つ当たった</p>';
    } else {
      html += '<p class="tally">15歳からの年表は、これから刻まれていきます。</p>';
    }
    return html;
  }

  function yearNode(nd, color) {
    var r = nd.row, past = nd.type === 'past';
    var k = mainKind(r.kinds);
    var ev = k ? T.events[k] : null;
    var title = past ? ev.past : (ev ? r.year + '年は、' + ev.now : r.year + '年は、落ち着いた年');
    var more = r.kinds.filter(function (x) { return x !== k; }).map(function (x) {
      return T.events[x][past ? 'pastText' : 'nowText'];
    });
    var h = '<li class="tl-year ' + (past ? 'tl-past' : 'tl-now') + '" style="--c:' + color + '">' +
      '<div class="node">' + (past ? r.year : '今年') + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p class="tl-period">' + esc(r.period) + '（' + esc(r.age) + '）</p>';
    if (ev) h += '<img class="photo" src="assets/img/ev_' + k + '.webp" alt="' + esc(ev.photo) + 'の絵" width="900" height="675" loading="lazy">';
    h += '<p class="tl-text">' + esc(ev ? ev[past ? 'pastText' : 'nowText'] : T.quietYear) + '</p>';
    more.forEach(function (t) { h += '<p class="tl-more">' + esc(t) + '</p>'; });
    if (past) {
      h += '<div class="hit" data-year="' + r.year + '"><button type="button" data-v="1" aria-pressed="false">当たってる</button>' +
        '<button type="button" data-v="0" aria-pressed="false">違う</button></div>';
    }
    return h + '</li>';
  }

  function renderMeishiki(c) {
    var order = ['年柱', '月柱', '日柱', '時柱'].filter(function (k) { return c.pillars[k]; });
    var gk = { '年柱': '年干', '月柱': '月干', '時柱': '時干' };
    var zk = { '年柱': '年支', '月柱': '月支', '日柱': '日支', '時柱': '時支' };
    var dk = { '年柱': '年', '月柱': '月', '日柱': '日', '時柱': '時' };
    var cards = order.map(function (k) {
      var gz = c.pillars[k], isDay = k === '日柱';
      var hide = c.hide[zk[k]] || [];
      return '<article class="pcard' + (isDay ? ' is-day' : '') + '">' +
        '<p class="pcard-pos">' + term(k) + (isDay ? '<span class="me">あなた自身</span>' : '') + '</p>' +
        '<p class="pcard-gz">' + esc(gz) + '</p><p class="pcard-yomi">' + esc(M.yomi(gz)) + '</p>' +
        '<dl>' +
        '<dt>上の字の星</dt><dd>' + (isDay ? term('日主') : term(c.ganStar[gk[k]])) + '</dd>' +
        '<dt>下の字の星</dt><dd>' + term(c.zhiStar[zk[k]]) + '</dd>' +
        '<dt>' + term('十二運') + '</dt><dd>' + term(c.dishi[dk[k]]) + '</dd>' +
        '<dt>' + term('蔵干') + '</dt><dd class="nw">' + esc(hide.join('\u2009')) + '</dd>' +
        '</dl></article>';
    }).join('');
    return '<div class="cards">' + cards + '</div>' +
      '<p class="swipe-hint">点線の下線がある言葉を押すと、意味が出ます。</p>' +
      '<p class="term-box" id="termBox"><b>日主</b>' + esc(T.terms['日主']) + '</p>' +
      '<p class="basis">命式の根拠：日主は' + c.type.dg + '（' + c.type.material + '）で、' + c.type.shin +
      'の生まれ。役割は、年と月の上の字と、年・月・日の下の字の星（5か所）で一番多いグループから決まります。</p>';
  }

  function renderStars(c) {
    var rows = T.groups.map(function (g) {
      var n = c.count[g.key] || 0, top = g.key === c.type.group;
      var dots = '';
      for (var i = 0; i < 5; i++) dots += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      return '<div class="star-row' + (top ? ' top' : '') + '"><span class="nm">' + g.role + '<small>' + g.power + '</small></span>' +
        '<span class="dots" aria-label="' + n + 'つ">' + dots + '</span></div>';
    }).join('');
    var zero = T.groups.filter(function (g) { return !c.count[g.key]; }).map(function (g) { return g.role; });
    return '<div class="stars">' + rows + '</div>' +
      (zero.length ? '<p class="basis">ゼロの星：' + zero.join('・') + '。' + T.zeroNote + '</p>' : '') +
      '<p class="basis">命式の根拠：5か所のうち「' + c.type.role + '」の星が一番多く（決め手は' + c.type.deciding + '）、' +
      'その中でも' + c.type.tenStar + 'なので「' + c.type.ten + '」です。</p>';
  }

  function currentDayun(c) {
    var i = bandOf(c.dayun, thisYear);
    return i >= 0 ? c.dayun[i] : null;
  }

  function renderCompat(me, pt, rel, pname) {
    var c = M.compat(me, pt);
    var as = T.partnerAs[rel];
    var ab = as[c.aToBGroup], ba = as[c.bToAGroup];
    if (rel === 'love' && me.sex === 'M' && c.aToBGroup === '財') ab = 'パートナーとして惹かれる相手';
    if (rel === 'love' && me.sex === 'F' && c.aToBGroup === '官') ab = 'パートナーとして意識する相手';
    var key = rel === 'love' ? '日支' : '月支';
    var pos = T.position[key].replace('の位置', '');
    var keyRel = c.rel.filter(function (r) { return r.a === key && r.b === key; })[0];
    var tail;
    if (c.tenchi) tail = '生まれ日の上の字も下の字も結びつく、とても縁の深い組み合わせです。';
    else if (c.kango) tail = rel === 'love' ? '生まれ日の上の字どうしが引き合う、自然と惹かれ合う組み合わせです。'
      : '生まれ日の上の字どうしが引き合う、自然と手を組みやすい組み合わせです。';
    else if (keyRel && keyRel.tag === '支合') tail = pos + 'どうしが結びつく、息の合う組み合わせです。';
    else if (keyRel && keyRel.tag === '半会') tail = pos + 'どうしが同じ方向を向く、目標を共有しやすい組み合わせです。';
    else if (keyRel && keyRel.tag === '同じ支') tail = pos + 'に同じ字を持つ、根っこの似た組み合わせです。';
    else if (keyRel && keyRel.tag === '冲') tail = pos + 'の違いがはっきりしているぶん、補い合える組み合わせです。';
    else tail = 'ほどよい距離感で、長く付き合える組み合わせです。';

    var goods = ['あなたから見ると' + pname + 'は「' + ab + '」、' + pname + 'から見るとあなたは「' + ba + '」です。'];
    var pos2 = function (p) { return T.position[p] || p; };
    var positives = c.rel.filter(function (r) { return r.tag !== '冲'; });
    positives.sort(function (p, q) { return (q.a === key && q.b === key) - (p.a === key && p.b === key); });
    positives.forEach(function (r) {
      var head = 'あなたの' + pos2(r.a) + 'と、' + pname + 'の' + pos2(r.b) + '（' + r.x + 'と' + r.y + '）';
      if (r.tag === '支合') goods.push(head + 'が結びついています。一緒にいると、自然と話がまとまりやすい関係です。');
      if (r.tag === '半会') goods.push(head + 'が同じ方向を向いています。二人がそろうと' + r.el + 'の流れが強まり、同じ目標に向かいやすい関係です。');
      if (r.tag === '同じ支') goods.push(head + 'が同じ字です。価値観の根っこが似ていて、説明しなくても通じやすい関係です。');
    });
    c.sango.forEach(function (s) {
      goods.push('二人がそろうと、' + s.el + 'の流れ（' + s.zhi + '）が完成します。一人ではできないことが回り出す組み合わせです。');
    });
    if (c.kango && !c.tenchi) goods.push('生まれ日の上の字どうしが「干合」の関係です。結びつこうとする力が働きます。');
    goods = goods.slice(0, 4);
    var zure = c.rel.filter(function (r) { return r.tag === '冲'; }).length;

    return '<section class="sec" id="sec-aisho"><h2>' + esc(pname) + 'との相性</h2>' +
      '<p class="sec-lead">' + (rel === 'love' ? '恋愛' : '仕事') + 'の関係として見ています。</p>' +
      '<div class="pair"><figure>' + godImg(me.type.dg, '') + '<figcaption>あなた<b>' + esc(me.type.title) + '</b></figcaption></figure>' +
      '<figure>' + godImg(pt.type.dg, '') + '<figcaption>' + esc(pname) + '<b>' + esc(pt.type.title) + '</b></figcaption></figure></div>' +
      '<p class="conclusion">' + esc(pname) + 'は、あなたにとって「' + esc(ab) + '」。' + esc(tail) + '</p>' +
      '<h3 style="margin-top:28px">いいこと</h3><ul class="goods">' +
      goods.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
      (rel === 'work' ? '<p class="caution">採用や評価の判断には使わないでください。</p>' : '') +
      '<div class="locked"><h3>二人のズレと、<wbr>向き合い方</h3>' +
      (zure ? '<p class="tl-period">命式の上のズレ：' + zure + 'つ</p>' : '') +
      '<p class="tl-text">どんな場面で行き違いやすいか、どうすれば小さくできるかを、無料の会員登録で見られます。</p>' +
      '<a class="mini-line" data-join href="#join">無料で会員登録</a></div>' +
      '</section>';
  }

  function render(q) {
    var me = M.chart({ name: q.get('n') || '', date: q.get('d'), sex: q.get('s'), time: q.get('t') || null, place: q.get('p') || '' });
    var who = me.name ? me.name + 'さん' : 'あなた';
    var ty = me.type;
    var hasPartner = !!q.get('pd');
    var cur = currentDayun(me);
    var role = T.roles[ty.role];
    var b = me.birth;

    var toc = [['nenpyo', '年表'], ['meishiki', '命式'], ['seikaku', '性格'], ['kachikan', '価値観'], ['hoshi', '星'],
      ['kyusei', '九星'], ['tsuyomi', '強み'], ['matome', 'まとめ']];
    if (hasPartner) toc.push(['aisho', '相性']);
    toc.push(['korekara', 'これから']);
    $('#toc').innerHTML = toc.map(function (t) { return '<a href="#sec-' + t[0] + '" data-sec="' + t[0] + '">' + t[1] + '</a>'; }).join('');

    var h = '';
    h += '<section class="cover">' + godImg(ty.dg, 'cover-art') +
      '<p class="cover-who">' + esc(who) + 'の生まれ</p>' +
      '<h1 class="cover-title">' + esc(ty.title) + '</h1>' +
      '<p class="cover-origin">日本神話では、<span class="nw">' + esc(ty.god) + '</span><wbr><span class="nw">（' + esc(ty.godYomi) + '）</span><wbr><span class="nw">にあたる生まれ</span></p>' +
      '<p class="cover-only">あなたと同じ命式を持つのは、同じ誕生日に生まれた人だけです。</p>' +
      '<p class="cover-meta">' + b.y + '年' + b.m + '月' + b.d + '日生まれ・' + (me.sex === 'M' ? '男性' : '女性') +
      (me.time ? '・' + esc(me.time) + '生まれ' : '') + '</p></section>';

    h += '<section class="sec" id="sec-nenpyo"><h2>あなたの年表</h2>' +
      '<p class="sec-lead">生まれた日の干支から、人生が動きやすかった年を出しました。当たっていたら押してください。</p>' +
      renderNenpyo(me) + '</section>';

    h += '<section class="sec" id="sec-meishiki"><h2>あなたの命式</h2>' +
      '<p class="sec-lead">生まれた年・月・日' + (me.pillars['時柱'] ? '・時刻' : '') + 'の干支です。</p>' +
      renderMeishiki(me) + '</section>';

    h += '<section class="sec" id="sec-seikaku"><h2>性格</h2><p class="sec-lead">押すと、裏の顔に入れ替わります。</p>' +
      '<button type="button" class="flip" aria-pressed="false">' +
      '<span class="front"><span class="flip-label">表の顔<small>押して裏返す</small></span>' +
      '<span class="flip-text">' + esc(T.face[ty.dg]) + '</span>' +
      '<span class="flip-basis">命式の根拠：日主が' + ty.dg + '（' + ty.material + '）</span></span>' +
      '<span class="back"><span class="flip-label">裏の顔<small>押して戻す</small></span>' +
      '<span class="flip-text">' + esc(T.hidden[ty.tenStar]) + '</span>' +
      '<span class="flip-basis">命式の根拠：役割を決めている' + ty.deciding + 'の星が' + ty.tenStar + '（' + ty.ten + '）</span></span>' +
      '</button></section>';

    h += '<section class="sec" id="sec-kachikan"><h2>仕事観・恋愛観・人生観</h2>' +
      '<div class="block"><h3>仕事観</h3><p>' + esc(T.work[me.zhiStar['月支']]) + '</p>' +
      '<p class="basis">命式の根拠：仕事の場を表す月の下の字（' + me.pillars['月柱'].charAt(1) + '）の星が' + me.zhiStar['月支'] + '</p></div>' +
      '<div class="block"><h3>恋愛観</h3><p>' + esc(T.love[me.zhiStar['日支']]) + '</p>' +
      '<p class="basis">命式の根拠：パートナーの位置を表す日の下の字（' + me.pillars['日柱'].charAt(1) + '）の星が' + me.zhiStar['日支'] + '</p></div>' +
      '<div class="block"><h3>人生観</h3><p>' + esc(T.life[me.ganStar['月干']]) +
      (cur ? 'いまは「' + esc(plain(T.dayun[cur.star].now)) + '」の中にいます。' : '') + '</p>' +
      '<p class="basis">命式の根拠：月の上の字（' + me.pillars['月柱'].charAt(0) + '）の星が' + me.ganStar['月干'] +
      (cur ? '。今の10年（' + cur.start + '〜' + (cur.start + 9) + '）は' + cur.gz + 'で、星は' + cur.star : '') + '</p></div>' +
      '</section>';

    h += '<section class="sec" id="sec-hoshi"><h2>持っている星</h2><p class="sec-lead">命式の5か所にある星を、5つの役割にまとめました。</p>' +
      renderStars(me) + '</section>';

    var kh = T.kyusei[me.kyusei.hon], kg = T.kyusei[me.kyusei.getsu];
    h += '<section class="sec" id="sec-kyusei"><h2>九星</h2><p class="sec-lead">外から見える姿と、内側の本音です。</p>' +
      '<div class="kyu"><div><p class="k-label">外から見える姿（本命星）</p><p class="k-name">' + me.kyusei.hon + '</p>' +
      '<p class="k-text">' + esc(kh.out) + 'に見られやすい生まれです。</p></div>' +
      '<div><p class="k-label">内側の本音（月命星）</p><p class="k-name">' + me.kyusei.getsu + '</p>' +
      '<p class="k-text">心の中では、' + esc(kg.inner) + 'と思っています。</p></div></div></section>';

    h += '<section class="sec" id="sec-tsuyomi"><h2>強みと裏面</h2>' +
      '<div class="block"><h3>強み</h3><p>' + esc(role.strength) + '。</p></div>' +
      '<div class="block"><h3>裏面</h3><p>強みの裏返しで、' + esc(role.back) + 'ところがあります。</p></div>' +
      '<div class="block"><h3>力が出る役回り</h3><p>' + esc(role.place) + '</p></div></section>';

    h += '<section class="summary" id="sec-matome"><h2>まとめ</h2>' +
      '<p class="big">' + esc(who) + 'は、<wbr>' + esc(ty.title) + '。</p>' +
      '<p>' + esc(T.face[ty.dg]) + '</p>' +
      '<p>仕事では、' + esc(role.strength) + 'が武器になります。' + esc(role.place) + '</p>' +
      (cur ? '<p>いまは「' + esc(plain(T.dayun[cur.star].now)) + '」の途中です。</p>' : '') +
      '</section>';

    if (hasPartner) {
      var pt = M.chart({ name: q.get('pn') || '', date: q.get('pd'), sex: q.get('ps') });
      h += renderCompat(me, pt, q.get('r') === 'work' ? 'work' : 'love', q.get('pn') ? q.get('pn') + 'さん' : 'お相手');
    }

    var fu = T.future[hasPartner ? 'pair' : 'solo'];
    h += '<section class="sec" id="sec-korekara"><h2>これから</h2>' +
      '<p class="sec-lead">ここまでが、これまでと今です。これからの流れは、会員の方にお届けしています。</p>' +
      '<div class="locked"><h3>' + esc(fu.lead) + '</h3><ul>' +
      fu.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      '<p class="price">月額 <b>500円</b>（初月も500円）</p>' +
      '<p class="note">会員ページから申し込めます。解約も会員ページのボタン一つでできます。鑑定書もAIへの相談も、このサイトの中で使えます。</p>' +
      '<a class="mini-line" data-join href="#join">会員登録して続きを見る</a></div></section>';

    h += '<footer class="foot"><p>この鑑定は、生年月日から四柱推命の計算で出した自己分析の材料です。' +
      (me.note.length ? '（' + esc(me.note.join('、')) + '）' : '') + '</p>' +
      '<p><a href="#">入力し直す</a></p></footer>';

    $('#report').innerHTML = h;
    $('#entry').hidden = true;
    SCREENS.forEach(function (id) { $('#' + id).hidden = true; });
    $('#result').hidden = false;
    $('#lineBar').hidden = false;
    document.title = ty.title + '｜' + who + 'の鑑定書';
    window.scrollTo(0, 0);
    bindReport();
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
          if (on) a.scrollIntoView({ block: 'nearest', inline: 'center' });
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { if (s) io.observe(s); });
  }

  function bindReportClicks() {
    $('#report').addEventListener('click', function (e) {
      var t = e.target.closest('.term');
      if (t) {
        var box = $('#termBox');
        if (box) box.innerHTML = '<b>' + esc(t.dataset.t) + '</b>' + esc(T.terms[t.dataset.t]);
        return;
      }
      var flip = e.target.closest('.flip');
      if (flip) { flip.setAttribute('aria-pressed', flip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
      var hb = e.target.closest('.hit button');
      if (hb) {
        $$('button', hb.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', x === hb && x.getAttribute('aria-pressed') !== 'true' ? 'true' : 'false'); });
        var hits = $$('.hit button[data-v="1"][aria-pressed="true"]').length;
        if ($('#hits')) $('#hits').textContent = hits;
      }
    });
  }

  /* ---------- 共通 ---------- */
  var PROVIDER = { line: 'LINE', google: 'Google', apple: 'Apple', email: 'メールアドレス' };
  var SCREENS = ['entry', 'join', 'found', 'recover'];
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

  function rememberProvider(p) {
    store('local', KEY_LAST, p);
    markLastProvider();
    toast(PROVIDER[p] + 'でのログインは準備中です');
  }

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
    el.innerHTML = '登録すると、いま見ていた鑑定書（' + esc(c.name ? c.name + 'さん' : 'あなた') + '・' + esc(c.type.title) + '）が会員ページに保存されます。';
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
      store('session', KEY_PENDING, location.hash.indexOf('#kantei?') === 0 ? location.hash : '');
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
      if (PROVIDER[p]) { rememberProvider(p); return; }
      toast({ 'link-old': '前の方法でのログインは準備中です', 'link-code': '確認コードの送信は準備中です', separate: '別の会員としての登録は準備中です' }[p]);
      return;
    }
    var toc = e.target.closest('#toc a');
    if (toc) {
      e.preventDefault();
      var s = document.getElementById('sec-' + toc.dataset.sec);
      if (s) s.scrollIntoView({ behavior: 'smooth' });
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
    var t = { join: '無料の会員登録', found: 'すでに会員登録があります', recover: '前の登録を探す' }[screen];
    document.title = t ? t + '｜HIYOMI' : TITLE;
    window.scrollTo(0, 0);
  }

  var MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  $('#mailForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#mailErr');
    if (!MAIL_RE.test($('#mail').value.trim())) { err.textContent = 'メールアドレスの形を確かめてください。'; return; }
    err.textContent = '';
    rememberProvider('email');
  });
  $('#recoverForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#recoverErr');
    if (!MAIL_RE.test($('#recoverMail').value.trim())) { err.textContent = 'メールアドレスの形を確かめてください。'; return; }
    err.textContent = '';
    toast('メールの送信は準備中です');
  });

  var src = new URLSearchParams(location.search).get('p');
  if (src && /^[\w-]{1,40}$/.test(src)) store('session', KEY_SRC, src);

  $$('.ymd').forEach(fillYmd);
  var pref = $('select[name=p]');
  pref.innerHTML += M.PREFS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  $('#form').addEventListener('submit', onSubmit);
  bindReportClicks();
  window.addEventListener('hashchange', route);
  route();
})();
