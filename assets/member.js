/* 会員ログイン（Firebase Authentication）と会員データ（Firestore）。
   app.js からは window.HiyomiAuth と、document の 'hiyomi:auth' イベントだけで使う。 */
const CFG = window.HIYOMI_FIREBASE;
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const KEY_MAIL = 'hiyomi:mailForLink';
const KEY_PENDING_LINK = 'hiyomi:pendingForLink';
const KEY_PENDING_REDIRECT = 'hiyomi:pendingForRedirect';

if (CFG) {
  const { initializeApp } = await import(SDK + 'firebase-app.js');
  const A = await import(SDK + 'firebase-auth.js');
  const F = await import(SDK + 'firebase-firestore.js');

  const app = initializeApp(CFG);
  const auth = A.getAuth(app);
  auth.languageCode = 'ja';
  const db = F.getFirestore(app);
  let ready = false;

  const providerOf = (user) => {
    const ids = user.providerData.map((p) => p.providerId);
    if (ids.includes('google.com')) return 'google';
    if (ids.includes('apple.com')) return 'apple';
    if (ids.some((i) => i.startsWith('oidc.line'))) return 'line';
    return 'email';
  };

  /* 鑑定書のURL（#kantei?...）から、保存する項目だけを取り出す。気になる人の名前は保存しない */
  const readingOf = (hash) => {
    const q = new URLSearchParams(String(hash || '').replace(/^#kantei\?/, ''));
    const d = q.get('d') || '', s = q.get('s') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^[MF]$/.test(s)) return null;
    const r = { name: q.get('n') || '', date: d, sex: s, time: q.get('t') || '', pref: q.get('p') || '',
      partnerDate: q.get('pd') || '', partnerSex: q.get('ps') || '', relation: q.get('r') || '' };
    const id = [r.date, r.sex, r.time, r.partnerDate, r.partnerSex, r.relation].join('_').replace(/[^\w-]/g, '');
    return { id, r };
  };

  async function saveMember(user, provider, pendingHash) {
    const ref = F.doc(db, 'members', user.uid);
    const snap = await F.getDoc(ref);
    const base = { email: user.email || '', displayName: user.displayName || '', lastProvider: provider,
      providers: F.arrayUnion(provider), lastLoginAt: F.serverTimestamp() };
    if (!snap.exists()) {
      let src = '';
      try { src = sessionStorage.getItem('hiyomi:src') || ''; } catch (e) { /* 読めなくても登録は続ける */ }
      Object.assign(base, { createdAt: F.serverTimestamp(), source: src });
    }
    await F.setDoc(ref, base, { merge: true });
    const rd = readingOf(pendingHash);
    if (rd) {
      await F.setDoc(F.doc(db, 'members', user.uid, 'readings', rd.id),
        Object.assign({}, rd.r, { savedAt: F.serverTimestamp() }), { merge: true });
    }
  }

  async function readings() {
    const u = auth.currentUser;
    if (!u) return [];
    const qs = await F.getDocs(F.query(F.collection(db, 'members', u.uid, 'readings'), F.orderBy('savedAt', 'desc')));
    return qs.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  function emit() {
    const u = auth.currentUser;
    document.dispatchEvent(new CustomEvent('hiyomi:auth', {
      detail: u ? { uid: u.uid, email: u.email || '', name: u.displayName || '', provider: providerOf(u) } : null
    }));
  }

  async function afterSignIn(user, provider, pendingHash) {
    await saveMember(user, provider, pendingHash);
    try { localStorage.setItem('hiyomi:lastProvider', provider); } catch (e) { /* 前回バッジが出ないだけ */ }
    emit();
    location.hash = '#mypage';
  }

  /* LINE は Identity Platform の OIDC プロバイダ（ID は firebase-config.js の lineProviderId、既定 oidc.line） */
  const LINE_ID = CFG.lineProviderId || 'oidc.line';
  const providerFor = (p) => {
    if (p === 'google') return new A.GoogleAuthProvider();
    const line = new A.OAuthProvider(LINE_ID);
    ['openid', 'profile', 'email'].forEach((s) => line.addScope(s));
    return line;
  };

  window.HiyomiAuth = {
    can: (p) => p === 'google' || p === 'email' || (p === 'line' && CFG.line !== false),
    isReady: () => ready,
    user: () => auth.currentUser,
    readings,
    async signIn(p, pendingHash) {
      if (p !== 'google' && p !== 'line') throw new Error('unsupported');
      try {
        const res = await A.signInWithPopup(auth, providerFor(p));
        await afterSignIn(res.user, p, pendingHash);
      } catch (e) {
        /* アプリ内ブラウザなど小窓が開けないときは、画面ごと移ってログインする */
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          try { localStorage.setItem(KEY_PENDING_REDIRECT, JSON.stringify({ p, hash: pendingHash || '' })); } catch (err) { /* 戻ってから保存できないだけ */ }
          await A.signInWithRedirect(auth, providerFor(p));
          return;
        }
        throw e;
      }
    },
    async sendLink(email, pendingHash) {
      await A.sendSignInLinkToEmail(auth, email, {
        url: location.origin + location.pathname + '?login=mail',
        handleCodeInApp: true
      });
      try {
        localStorage.setItem(KEY_MAIL, email);
        localStorage.setItem(KEY_PENDING_LINK, pendingHash || '');
      } catch (e) { /* 別の端末で開いたときと同じく、メールアドレスを聞き直す */ }
    },
    async save(hash) {
      const u = auth.currentUser;
      if (u) await saveMember(u, providerOf(u), hash);
    },
    async signOut() {
      await A.signOut(auth);
      location.hash = '';
    }
  };

  /* メールに届いたリンクから戻ってきたとき */
  if (A.isSignInWithEmailLink(auth, location.href)) {
    let email = '', pending = '';
    try { email = localStorage.getItem(KEY_MAIL) || ''; pending = localStorage.getItem(KEY_PENDING_LINK) || ''; } catch (e) { /* 下で聞き直す */ }
    if (!email) email = window.prompt('確認のため、ログインに使ったメールアドレスを入れてください。') || '';
    try {
      const res = await A.signInWithEmailLink(auth, email.trim(), location.href);
      try { localStorage.removeItem(KEY_MAIL); localStorage.removeItem(KEY_PENDING_LINK); } catch (e) { /* 消せなくても害はない */ }
      history.replaceState(null, '', location.pathname);
      await afterSignIn(res.user, 'email', pending);
    } catch (e) {
      history.replaceState(null, '', location.pathname + '#join');
      document.dispatchEvent(new CustomEvent('hiyomi:authError', { detail: 'link' }));
    }
  }

  /* 画面ごと移ってログインし、戻ってきたとき */
  let pendingRedirect = null;
  try { pendingRedirect = JSON.parse(localStorage.getItem(KEY_PENDING_REDIRECT) || 'null'); } catch (e) { /* 戻り先の鑑定書を保存しないだけ */ }
  if (pendingRedirect) {
    try { localStorage.removeItem(KEY_PENDING_REDIRECT); } catch (e) { /* 次回もう一度読むだけ */ }
    try {
      const res = await A.getRedirectResult(auth);
      if (res) await afterSignIn(res.user, pendingRedirect.p, pendingRedirect.hash);
    } catch (e) {
      document.dispatchEvent(new CustomEvent('hiyomi:authError', { detail: e && e.code === 'auth/account-exists-with-different-credential' ? 'exists' : 'login' }));
    }
  }

  A.onAuthStateChanged(auth, () => { ready = true; emit(); });
}
