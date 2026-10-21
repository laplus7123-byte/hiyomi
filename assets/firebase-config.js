/* Firebase のウェブアプリ設定（コンソールの「プロジェクトの設定 → マイアプリ」の firebaseConfig をそのまま貼る）。
   null のあいだはログインボタンが「準備中」のまま動く。手順は firebase/README.md
   LINE の OIDC プロバイダ ID を oidc.line 以外にしたときは lineProviderId を足す。LINE の設定が済むまでは line: false を足す */
window.HIYOMI_FIREBASE = null;
