document.addEventListener('DOMContentLoaded', async () => {
  const branchInput = document.getElementById('branch-input');
  const loadBtn = document.getElementById('load-btn');
  const githubFrame = document.getElementById('github-frame');
  const placeholder = document.getElementById('placeholder');
  const statusMessage = document.getElementById('status-message');

  let currentTabInfo = null;

  // URLから owner, repo, branch, filepath を抽出する正規表現
  // https://github.com/owner/repo/blob/branch/path/to/file
  const githubBlobRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;

  async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
  }

  async function init() {
    const tab = await getCurrentTab();
    if (!tab || !tab.url) {
      showError("Could not determine current tab URL.");
      return;
    }

    const match = tab.url.match(githubBlobRegex);
    if (!match) {
      showError("Not a valid GitHub file page (blob view).");
      return;
    }

    currentTabInfo = {
      owner: match[1],
      repo: match[2],
      currentBranch: match[3],
      filePath: match[4],
      originalUrl: tab.url
    };

    statusMessage.textContent = `Current branch: ${currentTabInfo.currentBranch}`;
    branchInput.focus();
  }

  function showError(msg) {
    statusMessage.textContent = msg;
    statusMessage.classList.add('error-message');
  }

  function clearError() {
    statusMessage.textContent = '';
    statusMessage.classList.remove('error-message');
  }

  function loadTargetBranch() {
    clearError();
    const targetBranch = branchInput.value.trim();
    
    if (!targetBranch) {
      showError("Please enter a target branch or commit.");
      return;
    }

    if (!currentTabInfo) {
      showError("Initial tab info not found.");
      return;
    }

    // 新しいURLを生成
    const newUrl = `https://github.com/${currentTabInfo.owner}/${currentTabInfo.repo}/blob/${targetBranch}/${currentTabInfo.filePath}`;
    
    statusMessage.textContent = `Loading ${targetBranch}...`;
    statusMessage.classList.remove('error-message');
    
    placeholder.style.display = 'none';
    githubFrame.style.display = 'block';
    
    // iframeにURLをセット
    githubFrame.src = newUrl;

    // iframeのロード完了イベント
    githubFrame.onload = () => {
      statusMessage.textContent = `Viewing branch: ${targetBranch}`;
    };
  }

  loadBtn.addEventListener('click', loadTargetBranch);
  branchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadTargetBranch();
    }
  });

  // 初期化
  init();
});
