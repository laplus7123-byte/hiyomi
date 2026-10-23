/* HIYOMI プロジェクト管理ツールの設定。api が空のあいだは、この端末のブラウザだけに保存する（試用） */
window.KANRI_CONFIG = {
  api: '',
  members: ['宮野', '丸野', '葛西'],
  /* 経費の負担割合（立て替えの精算に使う）。合計が1になるように */
  shares: { '宮野': 1 / 3, '丸野': 1 / 3, '葛西': 1 / 3 },
  categories: ['サーバー・ドメイン', 'ツール・サブスク', '外注・素材', '広告・集客', '法務・手続き', '交通・会議', 'その他'],
  taskStatuses: ['未着手', '進行中', '確認待ち', '保留', '完了'],
  /* 添削コメントを「タスクにする」ときの担当 */
  reviewOwner: '葛西',
  site: '../index.html',
  pages: [
    { label: '入口', url: '../index.html' },
    { label: '一人の鑑定（見本）', url: '../index.html#kantei?n=山田花子&d=1992-04-18&s=F' },
    { label: '二人の相性（見本）', url: '../index.html#kantei?n=山田太郎&d=1986-08-12&s=M&pd=1990-03-21&ps=F&r=love&pn=佐藤花子' },
    { label: '会員登録', url: '../index.html#join' },
    { label: '前の登録を探す', url: '../index.html#recover' },
    { label: 'プライバシーポリシー', url: '../privacy.html' }
  ]
};
