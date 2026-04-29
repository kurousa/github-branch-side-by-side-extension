// サイドパネルの動作を設定（拡張機能アイコンクリックで開く）
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// タブの更新を監視し、GitHubのblobページでのみサイドパネルを有効化する
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  
  // GitHubのドメインかつファイル閲覧画面(blob)の場合のみ有効化
  if (url.origin === 'https://github.com' && url.pathname.includes('/blob/')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true
    });
  } else {
    // それ以外のページではサイドパネルを無効化
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});
