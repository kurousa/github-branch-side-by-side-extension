document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const branchInput = document.getElementById('branch-input');
  const datalist = document.getElementById('branch-list');
  const loadBtn = document.getElementById('load-btn');
  const githubFrame = document.getElementById('github-frame');
  const placeholder = document.getElementById('placeholder');
  const statusMessage = document.getElementById('status-message');
  
  // Settings UI
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const patInput = document.getElementById('pat-input');
  const savePatBtn = document.getElementById('save-pat-btn');
  const settingsStatus = document.getElementById('settings-status');

  let currentTabInfo = null;
  let githubPat = '';
  let isLoading = false;

  function updateLoadButtonState() {
    const hasInput = branchInput.value.trim().length > 0;
    loadBtn.disabled = isLoading || !hasInput;

    // 入力状態が変わった際に、既存のエラーメッセージが表示されていればクリアする
    if (statusMessage.classList.contains('error-message')) {
      clearError();
    }
  }

  // https://github.com/owner/repo/blob/branch/path/to/file
  const githubBlobRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;

  async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
  }

  // --- Settings & PAT Management ---
  async function loadSettings() {
    const data = await chrome.storage.local.get(['githubPat']);
    if (data.githubPat) {
      githubPat = data.githubPat;
      patInput.value = githubPat;
    }
  }

  savePatBtn.addEventListener('click', async () => {
    const token = patInput.value.trim();
    await chrome.storage.local.set({ githubPat: token });
    githubPat = token;
    settingsStatus.textContent = 'Token saved!';
    settingsStatus.classList.remove('error-message');
    setTimeout(() => { settingsStatus.textContent = ''; }, 2000);
    
    // Reload branches with new token
    if (currentTabInfo) {
      fetchBranches();
    }
  });

  settingsToggleBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // --- GitHub API Integration ---
  function getFetchOptions() {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (githubPat) {
      headers['Authorization'] = `token ${githubPat}`;
    }
    return { headers };
  }

  async function fetchBranches() {
    if (!currentTabInfo) return;
    isLoading = true;
    updateLoadButtonState();
    const prevText = loadBtn.textContent;
    loadBtn.textContent = 'Loading...';
    try {
      const url = `https://api.github.com/repos/${currentTabInfo.owner}/${currentTabInfo.repo}/branches?per_page=100`;
      const response = await fetch(url, getFetchOptions());
      
      if (!response.ok) {
        if (response.status === 403) {
          console.warn("Rate limit exceeded or unauthorized. Please set a PAT.");
        }
        return;
      }
      
      const branches = await response.json();
      
      // Populate datalist
      datalist.innerHTML = '';
      branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.name;
        datalist.appendChild(option);
      });
    } catch (e) {
      console.error("Error fetching branches:", e);
    } finally {
      isLoading = false;
      updateLoadButtonState();
      loadBtn.textContent = prevText;
    }
  }

  async function checkFileExists(branch) {
    const url = `https://api.github.com/repos/${currentTabInfo.owner}/${currentTabInfo.repo}/contents/${currentTabInfo.filePath}?ref=${branch}`;
    try {
      const response = await fetch(url, getFetchOptions());
      if (response.status === 404) {
        return false;
      }
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      return true;
    } catch (e) {
      console.error("Error checking file existence:", e);
      // If we can't verify (e.g. rate limited), return true to try loading the iframe anyway
      return true; 
    }
  }

  async function handleTabUpdate(tab, isInit = false) {
    if (!tab || !tab.url) {
      if (isInit) showError("Could not determine current tab URL.");
      return;
    }

    const match = tab.url.match(githubBlobRegex);
    if (!match) {
      if (isInit) showError("Not a valid GitHub file page (blob view).");
      return;
    }

    const newOwner = match[1];
    const newRepo = match[2];
    const newBranch = match[3];
    const newFilePath = match[4];

    if (currentTabInfo && currentTabInfo.originalUrl === tab.url) {
      return; // URL has not changed
    }

    const repoChanged = !currentTabInfo || currentTabInfo.owner !== newOwner || currentTabInfo.repo !== newRepo;
    const fileChanged = !currentTabInfo || currentTabInfo.filePath !== newFilePath;

    currentTabInfo = {
      owner: newOwner,
      repo: newRepo,
      currentBranch: newBranch,
      filePath: newFilePath,
      originalUrl: tab.url
    };

    // UIにリポジトリとファイルパスを表示
    const repoInfo = document.getElementById('repo-info');
    const repoNameDisplay = document.getElementById('repo-name-display');
    if (repoInfo && repoNameDisplay) {
      repoNameDisplay.innerHTML = `<span class="repo-name">${currentTabInfo.owner}/${currentTabInfo.repo}</span> / <span class="file-path">${currentTabInfo.filePath}</span>`;
      repoInfo.classList.remove('hidden');
    }

    statusMessage.textContent = `Current branch: ${currentTabInfo.currentBranch}`;
    statusMessage.classList.remove('error-message');
    
    if (repoChanged) {
      // リポジトリが変わった場合はブランチリストを再取得し、表示をリセット
      fetchBranches();
      if (!isInit) {
        branchInput.value = '';
        placeholder.style.display = 'flex';
        githubFrame.style.display = 'none';
        githubFrame.src = '';
      }
    } else if (fileChanged && !isInit) {
      // リポジトリが同じでファイルが変わった場合
      // すでにターゲットブランチを表示中なら新しいファイルでiframeをリロード
      if (branchInput.value.trim() && githubFrame.style.display === 'block') {
        loadTargetBranch();
      } else {
        placeholder.style.display = 'flex';
        githubFrame.style.display = 'none';
        githubFrame.src = '';
      }
    }
    
    updateLoadButtonState();
    if (isInit) branchInput.focus();
  }

  // --- Main Logic ---
  async function init() {
    await loadSettings();
    const tab = await getCurrentTab();
    await handleTabUpdate(tab, true);
  }

  // タブのURLが更新されたときにサイドパネルをリフレッシュ
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      const currentTab = await getCurrentTab();
      if (currentTab && currentTab.id === tabId) {
        handleTabUpdate(tab);
      }
    }
  });

  // アクティブなタブが切り替わったときにサイドパネルをリフレッシュ
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      const currentTab = await getCurrentTab();
      if (currentTab && currentTab.id === tab.id) {
        handleTabUpdate(tab);
      }
    }
  });

  function showError(msg) {
    statusMessage.textContent = msg;
    statusMessage.classList.add('error-message');
  }

  function clearError() {
    statusMessage.textContent = '';
    statusMessage.classList.remove('error-message');
  }

  async function loadTargetBranch() {
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

    statusMessage.textContent = `Checking file in ${targetBranch}...`;
    statusMessage.classList.remove('error-message');
    isLoading = true;
    updateLoadButtonState();

    const exists = await checkFileExists(targetBranch);
    
    isLoading = false;
    updateLoadButtonState();

    if (!exists) {
      showError(`Branch '${targetBranch}' or file not found.`);
      return;
    }

    // 新しいURLを生成
    const newUrl = `https://github.com/${currentTabInfo.owner}/${currentTabInfo.repo}/blob/${targetBranch}/${currentTabInfo.filePath}`;
    
    statusMessage.textContent = `Loading ${targetBranch}...`;
    
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
  branchInput.addEventListener('input', updateLoadButtonState);
  branchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !loadBtn.disabled) {
      loadTargetBranch();
    }
  });

  // 初期化
  init();
});
