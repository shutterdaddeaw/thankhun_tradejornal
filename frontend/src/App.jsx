import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Activity, 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  RefreshCw, 
  LogOut, 
  Plus, 
  Link as LinkIcon, 
  Cpu, 
  BookOpen, 
  Copy, 
  Check, 
  User, 
  Lock, 
  Mail,
  Sliders,
  Eye,
  EyeOff,
  Database,
  Download,
  Settings,
  ArrowUpRight,
  Wallet,
  Edit,
  Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line
} from 'recharts';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://127.0.0.1:8088' 
  : window.location.origin;

const isCentCurrency = (currency) => {
  if (!currency) return false;
  const cur = currency.toUpperCase();
  return ['USC', 'USDC', 'EURC', 'GBPC', 'USCENT', 'EURCENT', 'CENT'].includes(cur) || cur.endsWith('CENT');
};

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function App() {
  const [page, setPage] = useState('login'); // login, register, dashboard, public
  const [token, setToken] = useState(localStorage.getItem('access_token') || '');
  const [user, setUser] = useState(null);
  const [hideBalances, setHideBalances] = useState(localStorage.getItem('hide_balances') === 'true');

  const toggleHideBalances = () => {
    setHideBalances(prev => {
      const next = !prev;
      localStorage.setItem('hide_balances', next.toString());
      return next;
    });
  };
  
  // Dashboard states
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [equityCurve, setEquityCurve] = useState([]);
  const [calendarPnl, setCalendarPnl] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [openPositions, setOpenPositions] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [aiSummary, setAiSummary] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [magicFilter, setMagicFilter] = useState('all');
  const [sortField, setSortField] = useState('execution_time');
  const [sortDirection, setSortDirection] = useState('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  // Sidebar Navigation & Layout
  const [activeTab, setActiveTab] = useState('networth'); // networth, forex, stock, crypto
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [usdThbRate, setUsdThbRate] = useState(33.0); // real-time USD/THB rate
  
  // Stock Portfolio States
  const [stockHoldings, setStockHoldings] = useState([]);
  const [stockTrades, setStockTrades] = useState([]);
  const [stockCash, setStockCash] = useState(0);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockCandles, setStockCandles] = useState([]);
  
  // Crypto Portfolio States
  const [cryptoHoldings, setCryptoHoldings] = useState([]);
  
  // All-accounts combined States (for combined views)
  const [allStockHoldings, setAllStockHoldings] = useState([]);
  const [allStockCashTotal, setAllStockCashTotal] = useState(0);
  const [allCryptoHoldings, setAllCryptoHoldings] = useState([]);
  // Net Worth table sort state
  const [nwSortKey, setNwSortKey] = useState('account_name');
  const [nwSortDir, setNwSortDir] = useState('asc');
  // Net Worth chart state
  const [nwSnapshots, setNwSnapshots] = useState([]);
  const [nwChartYear, setNwChartYear] = useState(new Date().getFullYear());
  const [nwChartMonth, setNwChartMonth] = useState(new Date().getMonth() + 1);
  const [nwChartLoading, setNwChartLoading] = useState(false);

  // Form states for manual additions
  const [newAccType, setNewAccType] = useState('forex'); // forex, stock, crypto
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockAction, setStockAction] = useState('BUY');
  const [stockVolume, setStockVolume] = useState('');
  const [stockPrice, setStockPrice] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [editStockCashValue, setEditStockCashValue] = useState('');
  
  const [cryptoSymbol, setCryptoSymbol] = useState('');
  const [cryptoBalance, setCryptoBalance] = useState('');
  const [cryptoAvgPrice, setCryptoAvgPrice] = useState('');

  // Modals
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState(null);
  const [activeGuideToken, setActiveGuideToken] = useState('');
  const [activeShareSlug, setActiveShareSlug] = useState('');
  const [shareConfig, setShareConfig] = useState({ show_balance: true, show_magic: false, show_comment: false });
  const [copied, setCopied] = useState(false);

  // AI settings
  const [aiProvider, setAiProvider] = useState('mock');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');

  // Edit account fields
  const [editAccountName, setEditAccountName] = useState('');
  const [editBrokerName, setEditBrokerName] = useState('');
  const [editServerName, setEditServerName] = useState('');
  const [editLeverage, setEditLeverage] = useState('100');
  const [editConnectionType, setEditConnectionType] = useState('publisher_ea');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccBroker, setNewAccBroker] = useState('');
  const [newAccServer, setNewAccServer] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccCurrency, setNewAccCurrency] = useState('USD');
  const [newAccLeverage, setNewAccLeverage] = useState('100');
  const [newAccConnType, setNewAccConnType] = useState('publisher_ea');
  const [newAccPassword, setNewAccPassword] = useState('');
  const [newWebullAppKey, setNewWebullAppKey] = useState('');
  const [newWebullAppSecret, setNewWebullAppSecret] = useState('');
  const [editWebullAppKey, setEditWebullAppKey] = useState('');
  const [editWebullAppSecret, setEditWebullAppSecret] = useState('');
  const [isSyncingWebull, setIsSyncingWebull] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');

  // Fetch Google Client ID configuration from backend on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/v1/auth/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.google_client_id) {
            setGoogleClientId(data.google_client_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch auth config:', err);
      }
    };
    fetchConfig();
  }, []);

  const renderGoogleButton = useCallback(() => {
    const element = document.getElementById('google-login-button');
    if (element && window.google?.accounts.id) {
      window.google.accounts.id.renderButton(element, {
        theme: 'filled_blue',
        size: 'large',
        width: 320,
        text: 'signin_with',
        shape: 'rectangular',
      });
    }
  }, []);

  const handleGoogleCredentialResponse = useCallback(async (response) => {
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setToken(data.access_token);
        setPage('dashboard');
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'การล็อกอินด้วย Google ล้มเหลว');
      }
    } catch (err) {
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อล็อกอิน Google ได้');
    }
  }, []);

  // Dynamically load Google Identity Services Script when Client ID is available
  useEffect(() => {
    if (!googleClientId) return;

    // Check if script is already present
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.google?.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });
        renderGoogleButton();
      };
      document.head.appendChild(script);
    } else if (window.google?.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
      });
      renderGoogleButton();
    }

    return () => {
      // Keep script to avoid double loading issues, but cleanup rendering
    };
  }, [googleClientId, handleGoogleCredentialResponse, renderGoogleButton]);

  // Trigger button render whenever page changes between login and register
  useEffect(() => {
    if (googleClientId && window.google?.accounts.id) {
      // Delay slightly to allow DOM to render container element
      const timer = setTimeout(() => {
        renderGoogleButton();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [googleClientId, page, renderGoogleButton]);

  // Check if we are viewing a public link
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/p/')) {
      const slug = path.split('/p/')[1];
      if (slug) {
        setPage('public');
        setActiveShareSlug(slug);
        loadPublicData(slug);
      }
    } else if (token) {
      setPage('dashboard');
      loadUserData();
    }
  }, [token]);

  // Trigger today's snapshot once on dashboard load
  useEffect(() => {
    if (page === 'dashboard' && token) {
      triggerNwSnapshot(); // best-effort upsert today
    }
  }, [page, token]);

  // Load net worth snapshots for charts (available across Forex, Stock, Crypto, and Networth tabs)
  useEffect(() => {
    if (page === 'dashboard' && token) {
      loadNwSnapshots(nwChartYear, nwChartMonth);
    }
  }, [page, token, nwChartYear, nwChartMonth, activeTab]);

  // Copy helper
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // API wrappers
  // API wrappers
  const getHeaders = useCallback(() => {
    const currentToken = localStorage.getItem('access_token') || token;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    };
  }, [token]);

  const attemptTokenRefresh = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/refresh?refresh_token=${refreshToken}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setToken(data.access_token);
        return true;
      }
    } catch (err) {
      console.error('Failed to auto-refresh session token:', err);
    }
    return false;
  };

  const fetchBackupStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/backup/status`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setLastBackupTime(data.last_backup_at);
      }
    } catch (err) {
      console.error('Failed to fetch backup status:', err);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/backup`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        a.download = `thankhun_jornal_backup_${y}${m}${d}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        await fetchBackupStatus(); // Refresh timestamp
      } else {
        alert('ดาวน์โหลดไฟล์สำรองข้อมูลล้มเหลว');
      }
    } catch (err) {
      console.error('Failed to download backup:', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์สำรองข้อมูล');
    }
  };

  const loadUserData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/me`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setAiProvider(userData.ai_provider || 'mock');
        setAiApiKey(userData.ai_api_key || '');
        setAiModel(userData.ai_model || '');
        setAiBaseUrl(userData.ai_base_url || '');
        await loadAccounts();
        fetchExchangeRate();
      } else if (res.status === 401) {
        // Access token expired, attempt auto-refresh
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          await loadUserData(); // Retry with new token
        } else {
          handleLogout();
        }
      } else {
        setUser({ email: 'thankhun@trader.com', full_name: 'Thankhun Master' });
        await loadAccounts();
        fetchExchangeRate();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const saveAiSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/ai-settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          ai_provider: aiProvider,
          ai_api_key: aiApiKey || null,
          ai_model: aiModel || null,
          ai_base_url: aiBaseUrl || null
        })
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setShowSettingsModal(false);
        // Refresh AI summary for active account
        if (selectedAccountId && selectedAccountId !== 'all') {
          loadAccountData(selectedAccountId);
        } else if (selectedAccountId === 'all') {
          loadAllAccountsCombinedData(accounts);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditAccountModal = () => {
    const activeAcc = accounts.find(a => a.id.toString() === selectedAccountId);
    if (activeAcc) {
      setEditAccountName(activeAcc.account_name);
      setEditBrokerName(activeAcc.broker_name);
      setEditServerName(activeAcc.server_name);
      setEditLeverage(activeAcc.leverage.toString());
      setEditConnectionType(activeAcc.connection_type);
      setEditCurrency(activeAcc.currency || 'USD');
      setShowEditAccountModal(true);
    }
  };

  const handleEditAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        account_name: editAccountName,
        broker_name: editBrokerName,
        server_name: editServerName,
        leverage: parseInt(editLeverage) || 100,
        connection_type: editConnectionType,
        currency: editCurrency
      };

      const activeAcc = accounts.find(a => a.id.toString() === selectedAccountId);
      if (activeAcc && activeAcc.account_type === 'stock' && editConnectionType === 'webull_api') {
        if (editWebullAppKey) payload.webull_app_key = editWebullAppKey;
        if (editWebullAppSecret) payload.webull_app_secret = editWebullAppSecret;
      }

      const res = await fetch(`${API_BASE_URL}/v1/accounts/${selectedAccountId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditWebullAppKey('');
        setEditWebullAppSecret('');
        setShowEditAccountModal(false);
        await loadAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("คุณต้องการลบพอร์ตเทรดนี้พร้อมดีลประวัติทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้!")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/v1/accounts/${selectedAccountId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.status === 204 || res.ok) {
        setShowEditAccountModal(false);
        setSelectedAccountId('all');
        await loadAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAiAnalysis = async () => {
    if (!selectedAccountId) return;
    setIsAiLoading(true);
    setAiSummary("### 🤖 กำลังวิเคราะห์ผลด้วย AI ตัวจริง...\n\nกรุณารอสักครู่ (ประมาณ 3-5 วินาที) ระบบกำลังประมวลผลข้อมูลสถิติของพอร์ตและคู่เงินที่เทรดส่งไปหา AI เพื่อเขียนรายงานแบบละเอียด...");
    try {
      const endpoint = selectedAccountId === 'all' 
        ? `${API_BASE_URL}/v1/accounts/all/ai-summary`
        : `${API_BASE_URL}/v1/accounts/${selectedAccountId}/ai-summary`;
        
      const res = await fetch(endpoint, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
      } else {
        setAiSummary("### ❌ ไม่สามารถดึงบทวิเคราะห์จาก AI ได้\n\nกรุณาตรวจสอบการตั้งค่าคีย์และสิทธิ์การใช้งาน API ของคุณในหน้าตั้งค่า");
      }
    } catch (err) {
      console.error(err);
      setAiSummary("### ❌ ไม่สามารถดึงบทวิเคราะห์จาก AI ได้\n\nเกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายหลังบ้าน");
    } finally {
      setIsAiLoading(false);
    }
  };

  const loadStockData = async (accountId) => {
    setIsSyncing(true);
    try {
      // Fetch holdings, trades, cash in parallel for speed
      const [holdingsRes, tradesRes, cashRes] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/stock/accounts/${accountId}/holdings`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/v1/stock/accounts/${accountId}/trades`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/v1/stock/accounts/${accountId}/cash`, { headers: getHeaders() })
      ]);
      if (holdingsRes.ok) setStockHoldings(await holdingsRes.json());
      if (tradesRes.ok) setStockTrades(await tradesRes.json());
      if (cashRes.ok) {
        const cashData = await cashRes.json();
        setStockCash(cashData.cash_balance);
        setEditStockCashValue(cashData.cash_balance.toString());
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadCryptoData = async (accountId) => {
    setIsSyncing(true);
    try {
      const holdingsRes = await fetch(`${API_BASE_URL}/v1/crypto/accounts/${accountId}/holdings`, { headers: getHeaders() });
      if (holdingsRes.ok) setCryptoHoldings(await holdingsRes.json());
    } catch (err) {
      console.error('Failed to load crypto data:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadAllStockData = async () => {
    const stockAccs = accounts.filter(a => a.account_type === 'stock');
    if (stockAccs.length === 0) return;
    setIsSyncing(true);
    try {
      const results = await Promise.all(
        stockAccs.map(acc =>
          Promise.all([
            fetch(`${API_BASE_URL}/v1/stock/accounts/${acc.id}/holdings`, { headers: getHeaders() }).then(r => r.ok ? r.json() : []),
            fetch(`${API_BASE_URL}/v1/stock/accounts/${acc.id}/cash`, { headers: getHeaders() }).then(r => r.ok ? r.json() : { cash_balance: 0 })
          ]).then(([holdings, cash]) => ({ acc, holdings, cash: cash.cash_balance || 0 }))
        )
      );
      const merged = results.flatMap(({ acc, holdings }) =>
        holdings.map(h => ({ ...h, account_name: acc.account_name }))
      );
      const totalCash = results.reduce((s, { cash }) => s + cash, 0);
      setAllStockHoldings(merged);
      setAllStockCashTotal(totalCash);
      setStockTrades([]);
    } catch (err) {
      console.error('Failed to load all stock data:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadAllCryptoData = async () => {
    const cryptoAccs = accounts.filter(a => a.account_type === 'crypto');
    if (cryptoAccs.length === 0) return;
    setIsSyncing(true);
    try {
      const results = await Promise.all(
        cryptoAccs.map(acc =>
          fetch(`${API_BASE_URL}/v1/crypto/accounts/${acc.id}/holdings`, { headers: getHeaders() })
            .then(r => r.ok ? r.json() : [])
            .then(holdings => holdings.map(h => ({ ...h, account_name: acc.account_name, wallet_address: acc.account_number })))
        )
      );
      setAllCryptoHoldings(results.flat());
    } catch (err) {
      console.error('Failed to load all crypto data:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadStockCandles = async (symbol) => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/stock/candles/${symbol}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStockCandles(data);
        setSelectedStock(symbol);
      } else {
        alert("ไม่สามารถดึงข้อมูลกราฟเทคนิคสำหรับหุ้นตัวนี้ได้");
      }
    } catch (err) {
      console.error("Failed to load stock candles:", err);
    }
  };

  const handleAddStockTrade = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/v1/stock/accounts/${selectedAccountId}/trades`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          symbol: stockSymbol,
          action: stockAction,
          volume: parseInt(stockVolume),
          price: parseFloat(stockPrice),
          reason: stockReason
        })
      });
      if (res.ok) {
        setStockSymbol('');
        setStockVolume('');
        setStockPrice('');
        setStockReason('');
        await loadStockData(selectedAccountId);
        await loadAccounts();
        alert("บันทึกธุรกรรมซื้อขายหุ้นสำเร็จแล้ว");
      } else {
        const err = await res.json();
        alert(err.detail || "บันทึกออเดอร์ล้มเหลว");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStockCash = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/v1/stock/accounts/${selectedAccountId}/cash`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          cash_balance: parseFloat(editStockCashValue)
        })
      });
      if (res.ok) {
        await loadStockData(selectedAccountId);
        await loadAccounts();
        alert("อัปเดตยอดเงินสดสำเร็จแล้ว");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const syncWebullData = async (accountId) => {
    setIsSyncingWebull(true);
    try {
      const res = await fetch(`${API_BASE_URL}/v1/stock/accounts/${accountId}/sync-webull`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await loadStockData(accountId);
        await loadAccounts();
        alert("ดึงข้อมูลพอร์ตหุ้นจาก Webull API สำเร็จแล้ว!");
      } else {
        const err = await res.json();
        alert(`ไม่สามารถเชื่อมต่อ Webull API ได้: ${err.detail || 'โปรดตรวจสอบความถูกต้องของกุญแจ API'}`);
      }
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSyncingWebull(false);
    }
  };

  const handleAddCryptoHolding = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/v1/crypto/accounts/${selectedAccountId}/holdings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          symbol: cryptoSymbol,
          balance: parseFloat(cryptoBalance),
          avg_purchase_price: cryptoAvgPrice ? parseFloat(cryptoAvgPrice) : null
        })
      });
      if (res.ok) {
        setCryptoSymbol('');
        setCryptoBalance('');
        setCryptoAvgPrice('');
        await loadCryptoData(selectedAccountId);
        await loadAccounts();
        alert("เพิ่มเหรียญในพอร์ตสำเร็จแล้ว");
      } else {
        const err = await res.json();
        alert(err.detail || "การเพิ่มเหรียญล้มเหลว");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStockHolding = async (holdingId) => {
    if (!window.confirm("คุณแน่ใจว่าต้องการลบหุ้นตัวนี้ออกจากพอร์ต?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/v1/stock/accounts/${selectedAccountId}/holdings/${holdingId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        await loadStockData(selectedAccountId);
        await loadAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCryptoHolding = async (holdingId) => {
    if (!window.confirm("คุณแน่ใจว่าต้องการลบเหรียญนี้ออกจากพอร์ต?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/v1/crypto/accounts/${selectedAccountId}/holdings/${holdingId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        await loadCryptoData(selectedAccountId);
        await loadAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncCryptoPrices = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/v1/crypto/accounts/${selectedAccountId}/sync`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await loadCryptoData(selectedAccountId);
        await loadAccounts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAccountSelect = (accountId) => {
    setSelectedAccountId(accountId);
    if (accountId === 'all') {
      if (activeTab !== 'forex') {
        setActiveTab('networth');
      }
      loadAllAccountsCombinedData(accounts.filter(a => !a.account_type || a.account_type === 'forex'));
    } else {
      const activeAcc = accounts.find(a => a.id.toString() === accountId);
      if (activeAcc) {
        if (activeAcc.account_type === 'stock') {
          setActiveTab('stock');
          loadStockData(accountId);
        } else if (activeAcc.account_type === 'crypto') {
          setActiveTab('crypto');
          loadCryptoData(accountId);
        } else {
          setActiveTab('forex');
          loadAccountData(accountId);
        }
      }
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/utils/exchange-rate`);
      if (res.ok) {
        const data = await res.json();
        if (data.usd_thb) setUsdThbRate(data.usd_thb);
      }
    } catch (e) {
      console.warn('Could not fetch exchange rate, using default 33.0');
    }
  };

  const loadNwSnapshots = async (year = nwChartYear, month = nwChartMonth) => {
    setNwChartLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/v1/networth/snapshots?year=${year}&month=${month}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setNwSnapshots(data.days || []);
      }
    } catch (e) {
      console.warn('Could not load net worth snapshots');
    } finally {
      setNwChartLoading(false);
    }
  };

  const renderAssetDailyChart = (assetKey, assetLabel, color) => {
    const hasData = nwSnapshots.filter(d => d[assetKey] !== null).length > 0;
    
    return (
      <div className="section-box" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div className="section-title" style={{ margin: 0 }}>📅 มูลค่าสินทรัพย์รายวัน (Daily {assetLabel} — USD)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
              onClick={() => {
                const m = nwChartMonth === 1 ? 12 : nwChartMonth - 1;
                const y = nwChartMonth === 1 ? nwChartYear - 1 : nwChartYear;
                setNwChartMonth(m); setNwChartYear(y);
              }}
            >‹</button>
            <select
              className="account-select"
              style={{ padding: '4px 10px', fontSize: '0.85rem', minWidth: '110px' }}
              value={nwChartMonth}
              onChange={e => setNwChartMonth(Number(e.target.value))}
            >
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              className="account-select"
              style={{ padding: '4px 10px', fontSize: '0.85rem', minWidth: '80px' }}
              value={nwChartYear}
              onChange={e => setNwChartYear(Number(e.target.value))}
            >
              {[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              className="btn-secondary"
              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
              onClick={() => {
                const m = nwChartMonth === 12 ? 1 : nwChartMonth + 1;
                const y = nwChartMonth === 12 ? nwChartYear + 1 : nwChartYear;
                setNwChartMonth(m); setNwChartYear(y);
              }}
            >›</button>
          </div>
        </div>

        {nwChartLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ Loading chart...</div>
        ) : !hasData ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
            <div>ยังไม่มีข้อมูลมูลค่าสินทรัพย์สำหรับเดือนนี้</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>ระบบบันทึกภาพรวมเวลาเที่ยงคืน (Asia/Bangkok)</div>
          </div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nwSnapshots} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.83rem' }}
                  formatter={(value) => value != null ? [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, assetLabel] : ['-', assetLabel]}
                  labelFormatter={label => `Day ${label}`}
                />
                <Line type="monotone" dataKey={assetKey} name={assetLabel} stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const triggerNwSnapshot = async () => {
    try {
      await fetch(`${API_BASE_URL}/v1/networth/snapshot`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch (e) {
      // silent — snapshot is best-effort
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/accounts/`, {
        headers: getHeaders()
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        if (data.length > 0) {
          const exists = data.find(a => a.id.toString() === selectedAccountId) || selectedAccountId === 'all';
          const targetId = exists ? selectedAccountId : 'all';
          setSelectedAccountId(targetId);
          if (targetId === 'all') {
            if (activeTab !== 'forex') {
              setActiveTab('networth');
            }
            loadAllAccountsCombinedData(data.filter(a => !a.account_type || a.account_type === 'forex'));
          } else {
            const selectedAcc = data.find(a => a.id.toString() === targetId);
            if (selectedAcc) {
              if (selectedAcc.account_type === 'stock') {
                setActiveTab('stock');
                loadStockData(targetId);
              } else if (selectedAcc.account_type === 'crypto') {
                setActiveTab('crypto');
                loadCryptoData(targetId);
              } else {
                setActiveTab('forex');
                loadAccountData(targetId);
              }
            }
          }
        } else {
          setSelectedAccountId('');
          resetAccountData();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllAccountsCombinedData = async (accountsList) => {
    if (!accountsList || accountsList.length === 0) return;
    setIsSyncing(true);
    try {
      // 1. Fetch dashboard stats for all accounts
      const statsPromises = accountsList.map(acc => 
        fetch(`${API_BASE_URL}/v1/accounts/${acc.id}/dashboard`, { headers: getHeaders() })
          .then(res => res.ok ? res.json() : null)
      );
      // 2. Fetch closed trades for all accounts
      const tradesPromises = accountsList.map(acc =>
        fetch(`${API_BASE_URL}/v1/accounts/${acc.id}/trades`, { headers: getHeaders() })
          .then(res => res.ok ? res.json().then(data => ({ currency: acc.currency, trades: data })) : { currency: acc.currency, trades: [] })
      );
      // 3. Fetch open positions for all accounts
      const positionsPromises = accountsList.map(acc =>
        fetch(`${API_BASE_URL}/v1/accounts/${acc.id}/positions`, { headers: getHeaders() })
          .then(res => res.ok ? res.json().then(data => ({ currency: acc.currency, positions: data })) : { currency: acc.currency, positions: [] })
      );
      // 4. Fetch equity curve for all accounts
      const curvePromises = accountsList.map(acc =>
        fetch(`${API_BASE_URL}/v1/accounts/${acc.id}/equity-curve`, { headers: getHeaders() })
          .then(res => res.ok ? res.json().then(data => ({ currency: acc.currency, curve: data })) : { currency: acc.currency, curve: [] })
      );
      // 5. Fetch calendar PnL for all accounts
      const calendarPromises = accountsList.map(acc =>
        fetch(`${API_BASE_URL}/v1/accounts/${acc.id}/calendar`, { headers: getHeaders() })
          .then(res => res.ok ? res.json().then(data => ({ currency: acc.currency, calendar: data })) : { currency: acc.currency, calendar: [] })
      );

      const statsResults = await Promise.all(statsPromises);
      const tradesResults = await Promise.all(tradesPromises);
      const positionsResults = await Promise.all(positionsPromises);
      const curveResults = await Promise.all(curvePromises);
      const calendarResults = await Promise.all(calendarPromises);

      // Clean null stats
      const validStats = statsResults.filter(s => s !== null);

      if (validStats.length === 0) {
        resetAccountData();
        return;
      }

      // Combine stats (converting cent values to standard USD/EUR)
      const combinedStats = {
        account_name: 'ทุกพอร์ตรวมกัน',
        broker_name: 'Multi-Broker',
        connection_type: 'publisher_ea',
        currency: 'USD', // Combined stats represented in standard USD
        balance: validStats.reduce((sum, s) => {
          const isCent = isCentCurrency(s.currency);
          return sum + (isCent ? s.balance / 100 : s.balance);
        }, 0),
        equity: validStats.reduce((sum, s) => {
          const isCent = isCentCurrency(s.currency);
          return sum + (isCent ? s.equity / 100 : s.equity);
        }, 0),
        floating_profit: validStats.reduce((sum, s) => {
          const isCent = isCentCurrency(s.currency);
          return sum + (isCent ? s.floating_profit / 100 : s.floating_profit);
        }, 0),
        total_profit: validStats.reduce((sum, s) => {
          const isCent = isCentCurrency(s.currency);
          return sum + (isCent ? s.total_profit / 100 : s.total_profit);
        }, 0),
        total_trades: validStats.reduce((sum, s) => sum + s.total_trades, 0),
        // Weighted average win rate
        win_rate: validStats.reduce((sum, s) => sum + (s.win_rate * s.total_trades), 0) / (validStats.reduce((sum, s) => sum + s.total_trades, 0) || 1),
        drawdown_pct: validStats.reduce((max, s) => Math.max(max, s.drawdown_pct), 0) // Max drawdown across all ports
      };
      // Format win rate
      combinedStats.win_rate = Math.round(combinedStats.win_rate * 10) / 10;
      setDashboardStats(combinedStats);

      // Combine closed trades and sort by execution time desc
      const allTrades = tradesResults.flatMap(res => {
        const isCent = isCentCurrency(res.currency);
        return res.trades.map(t => ({
          ...t,
          profit: isCent ? t.profit / 100 : t.profit,
          swap: isCent ? t.swap / 100 : t.swap,
          commission: isCent ? t.commission / 100 : t.commission
        }));
      }).sort((a, b) => new Date(b.execution_time) - new Date(a.execution_time));
      setClosedTrades(allTrades);

      // Combine open positions and sort by opened time desc
      const allPositions = positionsResults.flatMap(res => {
        const isCent = isCentCurrency(res.currency);
        return res.positions.map(p => ({
          ...p,
          profit: isCent ? p.profit / 100 : p.profit,
          swap: isCent ? p.swap / 100 : p.swap,
          commission: isCent ? p.commission / 100 : p.commission
        }));
      }).sort((a, b) => new Date(b.opened_time) - new Date(a.opened_time));
      setOpenPositions(allPositions);

      // Combine equity curve (sum balance/equity on each date)
      const curveMap = {};
      curveResults.forEach(res => {
        const isCent = isCentCurrency(res.currency);
        res.curve.forEach(pt => {
          if (!curveMap[pt.date]) {
            curveMap[pt.date] = { date: pt.date, balance: 0, equity: 0, floating_profit: 0 };
          }
          curveMap[pt.date].balance += isCent ? pt.balance / 100 : pt.balance;
          curveMap[pt.date].equity += isCent ? pt.equity / 100 : pt.equity;
          curveMap[pt.date].floating_profit += isCent ? pt.floating_profit / 100 : pt.floating_profit;
        });
      });
      const combinedCurve = Object.values(curveMap).sort((a, b) => new Date(a.date) - new Date(b.date));
      setEquityCurve(combinedCurve);

      // Combine calendar PnL (sum profit and trades_count on each date)
      const calendarMap = {};
      calendarResults.forEach(res => {
        const isCent = isCentCurrency(res.currency);
        res.calendar.forEach(day => {
          if (!calendarMap[day.date]) {
            calendarMap[day.date] = { date: day.date, profit: 0, trades_count: 0 };
          }
          calendarMap[day.date].profit += isCent ? day.profit / 100 : day.profit;
          calendarMap[day.date].trades_count += day.trades_count;
        });
      });
      const combinedCalendar = Object.values(calendarMap).sort((a, b) => new Date(a.date) - new Date(b.date));
      setCalendarPnl(combinedCalendar);

      setAiSummary("### 📊 บทวิเคราะห์ภาพรวมพอร์ตรวมทุกบัญชี\n\nระบบตรวจพบสถิติดีลเทรดครบถ้วนเรียบร้อยแล้ว กดปุ่มด้านล่างเพื่อเริ่มวิเคราะห์ความเสี่ยงและพฤติกรรมการเทรดเฉลี่ยของทุกพอร์ตรวมกันด้วยระบบ AI");

    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadAccountData = async (accountId) => {
    if (!accountId) return;
    if (accountId === 'all') {
      await loadAllAccountsCombinedData(accounts.filter(a => !a.account_type || a.account_type === 'forex'));
      return;
    }
    setIsSyncing(true);
    try {
      // Fetch all data in parallel for speed (~4x faster than sequential)
      const [statsRes, curveRes, calRes, posRes, tradesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/accounts/${accountId}/dashboard`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/v1/accounts/${accountId}/equity-curve`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/v1/accounts/${accountId}/calendar`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/v1/accounts/${accountId}/positions`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/v1/accounts/${accountId}/trades`, { headers: getHeaders() })
      ]);

      // 1. Stats
      let statsData = statsRes.ok ? await statsRes.json() : null;
      if (!statsData) return;
      const isCent = isCentCurrency(statsData.currency);
      if (isCent) {
        statsData.balance = statsData.balance / 100;
        statsData.equity = statsData.equity / 100;
        statsData.floating_profit = statsData.floating_profit / 100;
        statsData.total_profit = statsData.total_profit / 100;
        statsData.currency = 'USD';
      }
      setDashboardStats(statsData);

      // 2. Equity Curve
      if (curveRes.ok) {
        let curveData = await curveRes.json();
        if (isCent) curveData = curveData.map(pt => ({ ...pt, balance: pt.balance/100, equity: pt.equity/100, floating_profit: pt.floating_profit/100 }));
        setEquityCurve(curveData);
      }

      // 3. Calendar PNL
      if (calRes.ok) {
        let calData = await calRes.json();
        if (isCent) calData = calData.map(day => ({ ...day, profit: day.profit/100 }));
        setCalendarPnl(calData);
      }

      // 4. Open Positions
      if (posRes.ok) {
        let posData = await posRes.json();
        if (isCent) posData = posData.map(p => ({ ...p, profit: p.profit/100, swap: p.swap/100, commission: p.commission/100 }));
        setOpenPositions(posData);
      } else {
        setOpenPositions([]);
      }

      // 5. Closed Trades
      if (tradesRes.ok) {
        let tradesData = await tradesRes.json();
        if (isCent) tradesData = tradesData.map(t => ({ ...t, profit: t.profit/100, swap: t.swap/100, commission: t.commission/100 }));
        setClosedTrades(tradesData);
      }

      setAiSummary('### 🤖 บทวิเคราะห์พฤติกรรมการเทรดเชิงจิตวิทยา\n\nระบบดึงสถิติตามช่วงเวลาและ Magic Number เรียบร้อยแล้ว กดปุ่มด้านล่างเพื่อเริ่มเชื่อมต่อและส่งค่าไปให้ระบบ AI ตัวจริงวิเคราะห์ความเสี่ยงและจุดอ่อนของพอร์ตนี้');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadPublicData = async (slug) => {
    try {
      const statsRes = await fetch(`${API_BASE_URL}/p/${slug}`);
      let statsData = null;
      if (statsRes.ok) statsData = await statsRes.json();
      if (!statsData) return;

      const isCent = isCentCurrency(statsData.currency);
      if (isCent) {
        statsData.balance = statsData.balance / 100;
        statsData.equity = statsData.equity / 100;
        statsData.floating_profit = statsData.floating_profit / 100;
        statsData.total_profit = statsData.total_profit / 100;
        statsData.currency = 'USD'; // Show in USD
      }
      setDashboardStats(statsData);

      const curveRes = await fetch(`${API_BASE_URL}/p/${slug}/equity-curve`);
      if (curveRes.ok) {
        let curveData = await curveRes.json();
        if (isCent) {
          curveData = curveData.map(pt => ({
            ...pt,
            balance: pt.balance / 100,
            equity: pt.equity / 100,
            floating_profit: pt.floating_profit / 100
          }));
        }
        setEquityCurve(curveData);
      }

      const tradesRes = await fetch(`${API_BASE_URL}/p/${slug}/trades`);
      if (tradesRes.ok) {
        let tradesData = await tradesRes.json();
        if (isCent) {
          tradesData = tradesData.map(t => ({
            ...t,
            profit: t.profit / 100,
            swap: t.swap / 100,
            commission: t.commission / 100
          }));
        }
        setClosedTrades(tradesData);
      }
      
      const posRes = await fetch(`${API_BASE_URL}/p/${slug}/positions`);
      if (posRes.ok) {
        let posData = await posRes.json();
        if (isCent) {
          posData = posData.map(p => ({
            ...p,
            profit: p.profit / 100,
            swap: p.swap / 100,
            commission: p.commission / 100
          }));
        }
        setOpenPositions(posData);
      } else {
        setOpenPositions([]);
      }
      
      setCalendarPnl([]);
      setAiSummary("### AI วิเคราะห์พอร์ตสาธารณะ\n\nพอร์ตนี้ได้รับการเปิดเผยประวัติการเทรดแบบจำกัดข้อมูลเชิงลึก ระบบจัดอันดับการเปิดปิดโพซิชันว่ามีความเสถียรและเน้นการบริหารจัดการความเสี่ยงที่ดี");
    } catch (err) {
      console.error(err);
    }
  };

  const resetAccountData = () => {
    setDashboardStats(null);
    setEquityCurve([]);
    setCalendarPnl([]);
    setOpenPositions([]);
    setClosedTrades([]);
    setAiSummary('');
  };

  // Actions
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('username', loginEmail);
      formData.append('password', loginPassword);

      const res = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setToken(data.access_token);
        setPage('dashboard');
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || 'Email หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          full_name: registerName
        })
      });

      if (res.ok) {
        // Automatically login
        setLoginEmail(registerEmail);
        setLoginPassword(registerPassword);
        setPage('login');
        setErrorMsg('สมัครสมาชิกสำเร็จแล้ว! กรุณาเข้าสู่ระบบด้วยบัญชีใหม่');
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || 'สมัครสมาชิกไม่สำเร็จ กรุณากรอกข้อมูลให้ถูกต้อง');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken('');
    setUser(null);
    setPage('login');
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const payload = {
        account_number: newAccNumber,
        broker_name: newAccBroker,
        server_name: newAccServer || "",
        account_name: newAccName,
        currency: newAccCurrency,
        account_type: newAccType,
        leverage: parseInt(newAccLeverage) || 100,
        connection_type: newAccConnType,
        investor_password: newAccPassword || null,
        webull_app_key: newAccType === 'stock' && newAccConnType === 'webull_api' ? newWebullAppKey : null,
        webull_app_secret: newAccType === 'stock' && newAccConnType === 'webull_api' ? newWebullAppSecret : null,
      };

      const res = await fetch(`${API_BASE_URL}/v1/accounts/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setShowAddAccountModal(false);
        // Reset form
        setNewAccNumber('');
        setNewAccBroker('');
        setNewAccServer('');
        setNewAccName('');
        setNewAccPassword('');
        setNewWebullAppKey('');
        setNewWebullAppSecret('');
        
        // Show guide modal only for Forex (MT5)
        if (newAccType === 'forex') {
          setActiveGuideToken(data.publisher_token);
          setShowGuideModal(true);
        } else {
          alert(`เพิ่มพอร์ต ${newAccType === 'stock' ? 'หุ้น' : 'คริปโต'} สำเร็จเรียบร้อยแล้ว`);
        }
        
        // Refresh
        await loadAccounts();
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || 'ไม่สามารถเพิ่มบัญชีได้ กรุณาตรวจสอบข้อมูล');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  const handleCreateShareLink = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/v1/accounts/${selectedAccountId}/share`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(shareConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShareSlug(data.slug);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeShareLink = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/accounts/${selectedAccountId}/share`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setActiveShareSlug('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrevMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Calendar Day Generator
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth(); // 0-indexed
    
    // First day of month
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Fill empty slots for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: '', profit: 0, count: 0, active: false });
    }
    
    // Fill current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // Match with calendarPnl data
      const matched = calendarPnl.find(item => item.date === dateStr);
      days.push({
        day: d,
        dateStr,
        profit: matched ? matched.profit : 0,
        count: matched ? matched.trades_count : 0,
        active: true
      });
    }
    
    return days;
  }, [calendarPnl, calendarDate]);

  const monthlyTotalPnl = useMemo(() => {
    return calendarDays.reduce((sum, day) => sum + (day.active ? day.profit : 0), 0);
  }, [calendarDays]);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    let start = '';
    let end = '';

    if (preset === 'today') {
      const todayStr = formatLocalDate(now);
      start = todayStr;
      end = todayStr;
    } else if (preset === 'last7') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      start = formatLocalDate(past);
      end = formatLocalDate(now);
    } else if (preset === 'last30') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      start = formatLocalDate(past);
      end = formatLocalDate(now);
    } else if (preset === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      start = formatLocalDate(startOfMonth);
      end = formatLocalDate(now);
    } else if (preset === 'lastMonth') {
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      start = formatLocalDate(firstOfLast);
      end = formatLocalDate(lastOfLast);
    }

    setStartDate(start);
    setEndDate(end);
  };

  // Filter closed trades by date
  const filteredClosedTradesByDate = useMemo(() => {
    return closedTrades.filter(trade => {
      if (!trade.execution_time) return true;
      const tradeDateStr = trade.execution_time.split('T')[0];
      if (startDate && tradeDateStr < startDate) return false;
      if (endDate && tradeDateStr > endDate) return false;
      return true;
    });
  }, [closedTrades, startDate, endDate]);

  // Get unique magic numbers from closed trades
  const uniqueMagicNumbers = useMemo(() => {
    const magics = new Set();
    closedTrades.forEach(trade => {
      if (trade.magic) {
        magics.add(trade.magic.toString());
      }
    });
    return Array.from(magics);
  }, [closedTrades]);

  // Filter closed trades by magic filter
  const filteredClosedTrades = useMemo(() => {
    return filteredClosedTradesByDate.filter(trade => {
      if (magicFilter === 'all') return true;
      if (magicFilter === 'manual') return !trade.magic;
      return trade.magic?.toString() === magicFilter;
    });
  }, [filteredClosedTradesByDate, magicFilter]);

  // Sort closed trades
  const sortedClosedTrades = useMemo(() => {
    const sorted = [...filteredClosedTrades];
    sorted.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (sortField === 'execution_time') {
        return sortDirection === 'asc' 
          ? new Date(valA) - new Date(valB)
          : new Date(valB) - new Date(valA);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      
      return sortDirection === 'asc'
        ? valA.toString().localeCompare(valB.toString())
        : valB.toString().localeCompare(valA.toString());
    });
    return sorted;
  }, [filteredClosedTrades, sortField, sortDirection]);

  // Calculate dynamic stats for the selected period
  const periodStats = useMemo(() => {
    if (!dashboardStats) return null;
    
    // Filter trades in range
    const inRangeTrades = closedTrades.filter(trade => {
      if (!trade.execution_time) return true;
      const tradeDateStr = trade.execution_time.split('T')[0];
      if (startDate && tradeDateStr < startDate) return false;
      if (endDate && tradeDateStr > endDate) return false;
      return true;
    });

    const totalTrades = inRangeTrades.filter(t => t.type === 'buy' || t.type === 'sell').length;
    const winTrades = inRangeTrades.filter(t => (t.type === 'buy' || t.type === 'sell') && (t.profit + t.swap + t.commission) >= 0).length;
    const winRate = totalTrades > 0 ? Math.round((winTrades / totalTrades) * 1000) / 10 : 0;
    
    const totalProfit = inRangeTrades.reduce((sum, t) => sum + (t.profit + t.swap + t.commission), 0);

    return {
      ...dashboardStats,
      total_profit: totalProfit,
      total_trades: totalTrades,
      win_rate: winRate
    };
  }, [dashboardStats, closedTrades, startDate, endDate]);

  // Filter equity curve by date
  const filteredEquityCurve = useMemo(() => {
    return equityCurve.filter(pt => {
      if (!pt.date) return true;
      if (startDate && pt.date < startDate) return false;
      if (endDate && pt.date > endDate) return false;
      return true;
    });
  }, [equityCurve, startDate, endDate]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const displayStats = periodStats || dashboardStats;

  const advancedStats = useMemo(() => {
    // 1. Filter trades that are actual entries/exits
    const trades = filteredClosedTrades.filter(t => t.type === 'buy' || t.type === 'sell');
    const totalTradesCount = trades.length;
    
    // 2. Win/loss trades
    const winTrades = trades.filter(t => (t.profit + t.swap + t.commission) >= 0);
    const lossTrades = trades.filter(t => (t.profit + t.swap + t.commission) < 0);
    const winTradesCount = winTrades.length;
    const lossTradesCount = lossTrades.length;
    
    const winRate = totalTradesCount > 0 ? (winTradesCount / totalTradesCount * 100) : 0;

    // 3. Buy/Sell specific stats
    const buyTrades = trades.filter(t => t.type === 'buy');
    const buyWins = buyTrades.filter(t => (t.profit + t.swap + t.commission) >= 0);
    const buyWinRate = buyTrades.length > 0 ? (buyWins.length / buyTrades.length * 100) : 0;

    const sellTrades = trades.filter(t => t.type === 'sell');
    const sellWins = sellTrades.filter(t => (t.profit + t.swap + t.commission) >= 0);
    const sellWinRate = sellTrades.length > 0 ? (sellWins.length / sellTrades.length * 100) : 0;

    // 4. Gross Profit / Loss
    let grossProfit = 0;
    let grossLoss = 0;
    let bestTrade = 0;
    let worstTrade = 0;

    trades.forEach(t => {
      const net = t.profit + t.swap + t.commission;
      if (net > 0) {
        grossProfit += net;
        if (net > bestTrade) bestTrade = net;
      } else {
        grossLoss += net;
        if (net < worstTrade) worstTrade = net;
      }
    });

    const netProfit = grossProfit + grossLoss;
    const profitFactor = Math.abs(grossLoss) > 0 ? (grossProfit / Math.abs(grossLoss)) : grossProfit;
    const expectancy = totalTradesCount > 0 ? (netProfit / totalTradesCount) : 0;
    
    const avgWin = winTradesCount > 0 ? (grossProfit / winTradesCount) : 0;
    const avgLoss = lossTradesCount > 0 ? (Math.abs(grossLoss) / lossTradesCount) : 0;
    const riskReward = avgLoss > 0 ? (avgWin / avgLoss) : 0;

    // 5. TP / SL hits & Manual closes
    let tpHits = 0;
    let slHits = 0;
    let manualCloses = 0;
    trades.forEach(t => {
      const net = t.profit + t.swap + t.commission;
      const commentLower = (t.comment || '').toLowerCase();
      
      if (net >= 0) {
        tpHits++;
      } else {
        if (commentLower.includes('sl') || commentLower.includes('[sl]')) {
          slHits++;
        } else {
          manualCloses++;
        }
      }
    });

    const tpPct = totalTradesCount > 0 ? (tpHits / totalTradesCount * 100) : 0;
    const slPct = totalTradesCount > 0 ? (slHits / totalTradesCount * 100) : 0;
    const manualPct = totalTradesCount > 0 ? (manualCloses / totalTradesCount * 100) : 0;

    // 6. Final / Starting Balance
    const finalBalance = displayStats?.balance || 0;
    const startingBalance = finalBalance - netProfit;
    const returnPct = startingBalance > 0 ? (netProfit / startingBalance * 100) : 0;

    // Calculate Max Drawdown percentage and amount dynamically from filteredEquityCurve (adjusting for deposits/withdrawals)
    let maxDrawdownPct = 0;
    let maxDrawdownAmt = 0;
    if (filteredEquityCurve && filteredEquityCurve.length > 0) {
      let peak = -1;
      let cumulativeAdjustment = 0;
      filteredEquityCurve.forEach(pt => {
        if (pt.transaction_type === "deposit" || pt.transactionType === "deposit") {
          cumulativeAdjustment += (pt.transaction_amount || pt.transactionAmount || 0);
        } else if (pt.transaction_type === "withdrawal" || pt.transactionType === "withdrawal") {
          cumulativeAdjustment -= (pt.transaction_amount || pt.transactionAmount || 0);
        }
        
        const eqAdjusted = pt.equity - cumulativeAdjustment;
        if (eqAdjusted > peak) {
          peak = eqAdjusted;
        }
        
        const actualPeakAtTime = peak + cumulativeAdjustment;
        if (actualPeakAtTime > 0) {
          const ddPct = ((peak - eqAdjusted) / actualPeakAtTime) * 100;
          const ddAmt = peak - eqAdjusted;
          if (ddPct > maxDrawdownPct) {
            maxDrawdownPct = ddPct;
          }
          if (ddAmt > maxDrawdownAmt) {
            maxDrawdownAmt = ddAmt;
          }
        }
      });
    } else {
      maxDrawdownPct = displayStats?.drawdown_pct || 0;
      maxDrawdownAmt = startingBalance * (maxDrawdownPct / 100);
    }

    const recoveryFactor = maxDrawdownAmt > 0 ? (netProfit / maxDrawdownAmt) : (Math.abs(worstTrade) > 0 ? (netProfit / Math.abs(worstTrade)) : 1.0);

    return {
      netProfit,
      returnPct,
      winRate,
      winTradesCount,
      lossTradesCount,
      totalTradesCount,
      buyTradesCount: buyTrades.length,
      buyWinsCount: buyWins.length,
      buyWinRate,
      sellTradesCount: sellTrades.length,
      sellWinsCount: sellWins.length,
      sellWinRate,
      grossProfit,
      grossLoss,
      profitFactor,
      maxDrawdownPct,
      maxDrawdownAmt,
      expectancy,
      avgWin,
      avgLoss,
      riskReward,
      startingBalance,
      finalBalance,
      tpHits,
      slHits,
      manualCloses,
      tpPct,
      slPct,
      manualPct,
      bestTrade,
      worstTrade,
      recoveryFactor,
      currency: displayStats?.currency || 'USD'
    };
  }, [filteredClosedTrades, displayStats, filteredEquityCurve]);

  const renderCustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;
    const txType = payload.transaction_type || payload.transactionType;
    if (!txType) return null;

    const color = txType === 'deposit' ? '#10b981' : '#ef4444';
    return (
      <g key={`dot-${payload.date}-${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r={6} fill={color} stroke="#111827" strokeWidth={1.5} />
        <text x={cx} y={cy - 10} fill={color} fontSize={11} fontWeight="bold" textAnchor="middle">
          {txType === 'deposit' ? '📥' : '📤'}
        </text>
      </g>
    );
  };

  // Auth pages view
  if (page === 'login' || page === 'register') {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-logo">Thankhun<span> trade Jornal</span></h1>
            <p className="auth-subtitle">
              {page === 'login' ? 'เข้าสู่ระบบเพื่อดูแดชบอร์ดพอร์ตการเทรด' : 'สมัครสมาชิกเพื่อเริ่มต้นใช้งานได้ฟรี'}
            </p>
          </div>

          {errorMsg && (
            <div style={{
              background: errorMsg.includes('สำเร็จ') ? 'var(--success-glow)' : 'var(--error-glow)',
              color: errorMsg.includes('สำเร็จ') ? 'var(--success)' : 'var(--error)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              marginBottom: '20px',
              border: `1px solid ${errorMsg.includes('สำเร็จ') ? 'var(--success)' : 'var(--error)'}`
            }}>
              {errorMsg}
            </div>
          )}

          {page === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="name@example.com" 
                    required 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••" 
                  required 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary">เข้าสู่ระบบ</button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">ชื่อผู้ใช้งาน</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="เช่น Thankhun Trader" 
                  required 
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@example.com" 
                  required 
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="ขั้นต่ำ 6 ตัวอักษร" 
                  required 
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary">สมัครสมาชิก</button>
            </form>
          )}

          {googleClientId && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>หรือ</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              </div>
              <div id="google-login-button" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
            </div>
          )}

          <div className="auth-footer">
            {page === 'login' ? (
              <>
                ยังไม่มีบัญชีใช้งาน? <span className="auth-link" onClick={() => { setPage('register'); setErrorMsg(''); }}>สมัครสมาชิกฟรี</span>
              </>
            ) : (
              <>
                มีบัญชีอยู่แล้ว? <span className="auth-link" onClick={() => { setPage('login'); setErrorMsg(''); }}>เข้าสู่ระบบ</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const renderNetWorthTab = () => {
    const forexAccs = accounts.filter(a => !a.account_type || a.account_type === 'forex');
    const stockAccs = accounts.filter(a => a.account_type === 'stock');
    const cryptoAccs = accounts.filter(a => a.account_type === 'crypto');

    const forexTotal = forexAccs.reduce((sum, a) => sum + (isCentCurrency(a.currency) ? a.equity / 100 : a.equity), 0);
    const stockTotal = stockAccs.reduce((sum, a) => sum + a.equity, 0);
    const cryptoTotal = cryptoAccs.reduce((sum, a) => sum + a.equity, 0);

    const rate = usdThbRate || 33.0;
    const forexUSD = forexTotal;
    const stockUSD = stockTotal / rate;
    const cryptoUSD = cryptoTotal;
    const totalNetWorthUSD = forexUSD + stockUSD + cryptoUSD;
    const totalNetWorthTHB = totalNetWorthUSD * rate;

    const donutData = [
      { name: 'Forex (USD)', value: forexUSD, color: '#818cf8' },
      { name: 'Stocks (THB→USD)', value: stockUSD, color: '#f59e0b' },
      { name: 'Crypto (USD)', value: cryptoUSD, color: '#10b981' }
    ].filter(d => d.value > 0);

    const handleNwSort = (key) => {
      if (nwSortKey === key) {
        setNwSortDir(d => d === 'asc' ? 'desc' : 'asc');
      } else {
        setNwSortKey(key);
        setNwSortDir('asc');
      }
    };

    const sortedAccounts = [...accounts].sort((a, b) => {
      let va, vb;
      if (nwSortKey === 'account_name') { va = a.account_name?.toLowerCase(); vb = b.account_name?.toLowerCase(); }
      else if (nwSortKey === 'account_type') { va = (a.account_type || 'forex'); vb = (b.account_type || 'forex'); }
      else if (nwSortKey === 'broker_name') { va = a.broker_name?.toLowerCase(); vb = b.broker_name?.toLowerCase(); }
      else if (nwSortKey === 'equity') {
        va = isCentCurrency(a.currency) ? a.equity / 100 : a.equity;
        vb = isCentCurrency(b.currency) ? b.equity / 100 : b.equity;
      }
      if (va < vb) return nwSortDir === 'asc' ? -1 : 1;
      if (va > vb) return nwSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const SortIcon = ({ col }) => {
      if (nwSortKey !== col) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
      return <span style={{ marginLeft: '4px', color: 'var(--accent-secondary)' }}>{nwSortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    const thStyle = (col) => ({
      cursor: 'pointer',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      transition: 'color 0.15s',
      color: nwSortKey === col ? 'var(--accent-secondary)' : undefined,
    });

    return (
      <div className="networth-dashboard">

        {/* ── แถวที่ 1: Hero Total Net Worth ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(129,140,248,0.15) 0%, rgba(16,185,129,0.10) 100%)',
          border: '1px solid rgba(129,140,248,0.3)',
          borderRadius: '16px',
          padding: '32px 36px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              💰 รวมสินทรัพย์สุทธิ (Total Net Worth)
            </div>
            <div style={{ fontSize: '3rem', fontWeight: '800', color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {hideBalances ? '••••••' : `$${totalNetWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '600', color: 'var(--accent-secondary)', marginTop: '8px' }}>
              {hideBalances ? '••••' : `≈ ฿${totalNetWorthTHB.toLocaleString(undefined, { maximumFractionDigits: 0 })} THB`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              🔄 1 USD = {rate.toFixed(2)} THB
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>real-time · Yahoo Finance</div>
          </div>
        </div>

        {/* ── แถวที่ 2: 3 Sub-Portfolio Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {/* Forex */}
          <div className="stat-card" style={{ borderTop: '3px solid #818cf8' }}>
            <div className="stat-title" style={{ color: '#818cf8' }}>📈 Forex Portfolio</div>
            <div className="stat-value">
              {hideBalances ? '••••' : `$${forexTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {hideBalances ? '••••' : `≈ ฿${(forexTotal * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB`}
            </div>
            <div className="stat-desc">{forexAccs.length} พอร์ตเทรด MT5</div>
          </div>

          {/* Thai Stocks */}
          <div className="stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
            <div className="stat-title" style={{ color: '#f59e0b' }}>🇹🇭 Thai Stocks Portfolio</div>
            <div className="stat-value">
              {hideBalances ? '••••' : `฿${stockTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {hideBalances ? '••••' : `≈ $${stockUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
            </div>
            <div className="stat-desc">{stockAccs.length} บัญชีหุ้นไทย</div>
          </div>

          {/* Crypto */}
          <div className="stat-card" style={{ borderTop: '3px solid #10b981' }}>
            <div className="stat-title" style={{ color: '#10b981' }}>🪙 Crypto Assets Portfolio</div>
            <div className="stat-value">
              {hideBalances ? '••••' : `$${cryptoTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {hideBalances ? '••••' : `≈ ฿${(cryptoTotal * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB`}
            </div>
            <div className="stat-desc">{cryptoAccs.length} ที่อยู่กระเป๋า / Exchange</div>
          </div>
        </div>

        {/* ── Daily Stacked Column Chart ── */}
        <div className="section-box" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div className="section-title" style={{ margin: 0 }}>📅 สินทรัพย์รายวัน (Daily Net Worth — USD)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Prev Month */}
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                onClick={() => {
                  const m = nwChartMonth === 1 ? 12 : nwChartMonth - 1;
                  const y = nwChartMonth === 1 ? nwChartYear - 1 : nwChartYear;
                  setNwChartMonth(m); setNwChartYear(y);
                }}
              >‹</button>
              {/* Month selector */}
              <select
                className="account-select"
                style={{ padding: '4px 10px', fontSize: '0.85rem', minWidth: '110px' }}
                value={nwChartMonth}
                onChange={e => setNwChartMonth(Number(e.target.value))}
              >
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              {/* Year selector */}
              <select
                className="account-select"
                style={{ padding: '4px 10px', fontSize: '0.85rem', minWidth: '80px' }}
                value={nwChartYear}
                onChange={e => setNwChartYear(Number(e.target.value))}
              >
                {[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {/* Next Month */}
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                onClick={() => {
                  const m = nwChartMonth === 12 ? 1 : nwChartMonth + 1;
                  const y = nwChartMonth === 12 ? nwChartYear + 1 : nwChartYear;
                  setNwChartMonth(m); setNwChartYear(y);
                }}
              >›</button>
            </div>
          </div>

          {nwChartLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ Loading chart...</div>
          ) : nwSnapshots.filter(d => d.total_usd !== null).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
              <div>ยังไม่มีข้อมูล snapshot สำหรับเดือนนี้</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>ระบบจะบันทึกข้อมูลทุกวันเวลาเที่ยงคืน (Asia/Bangkok)</div>
            </div>
          ) : (
            <>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nwSnapshots} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.83rem' }}
                      formatter={(value, name) => value != null ? [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, name] : ['-', name]}
                      labelFormatter={label => `Day ${label}`}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '0.82rem', paddingTop: '12px' }}
                      formatter={v => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>}
                    />
                    <Bar dataKey="forex_usd" name="Forex (USD)" stackId="a" fill="#818cf8" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="stock_usd" name="Stocks (USD)" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="crypto_usd" name="Crypto (USD)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* ── Donut Chart + Sortable Table ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          {/* Donut Chart */}
          <div className="section-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="section-title" style={{ width: '100%' }}>📊 สัดส่วนพอร์ตการลงทุน (Asset Allocation)</div>
            {donutData.length > 0 ? (
              <>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'USD']}
                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {donutData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: d.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      <span style={{ fontWeight: '700', color: d.color }}>{((d.value / (totalNetWorthUSD || 1)) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: '60px', color: 'var(--text-muted)' }}>ไม่มีข้อมูลแสดงสัดส่วน</div>
            )}
          </div>

          {/* Sortable All-Portfolios Table */}
          <div className="section-box">
            <div className="section-title">💼 พอร์ตการลงทุนทั้งหมด (All Portfolios)</div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={thStyle('account_name')} onClick={() => handleNwSort('account_name')}>
                      ชื่อพอร์ต (Friendly Name)<SortIcon col="account_name" />
                    </th>
                    <th style={thStyle('account_type')} onClick={() => handleNwSort('account_type')}>
                      ประเภทสินทรัพย์<SortIcon col="account_type" />
                    </th>
                    <th style={thStyle('broker_name')} onClick={() => handleNwSort('broker_name')}>
                      โบรกเกอร์ / แพลตฟอร์ม<SortIcon col="broker_name" />
                    </th>
                    <th style={{ ...thStyle('equity'), textAlign: 'right' }} onClick={() => handleNwSort('equity')}>
                      มูลค่าสุทธิ์ (Balance)<SortIcon col="equity" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map(acc => (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: '600' }}>{acc.account_name}</td>
                      <td>
                        <span
                          className={`badge ${acc.account_type === 'stock' ? 'badge-success' : acc.account_type === 'crypto' ? 'badge-secondary' : 'badge-info'}`}
                          style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}
                        >
                          {acc.account_type || 'FOREX'}
                        </span>
                      </td>
                      <td>{acc.broker_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: acc.account_type === 'stock' ? '#f59e0b' : acc.account_type === 'crypto' ? '#10b981' : '#818cf8' }}>
                        {hideBalances ? '••••' : `${(isCentCurrency(acc.currency) ? acc.equity / 100 : acc.equity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${acc.currency}`}
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>ไม่มีพอร์ตการลงทุนในระบบ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStockTab = () => {
    // Combined view for all stock portfolios
    if (selectedAccountId === 'all-stock') {
      const stockAccs = accounts.filter(a => a.account_type === 'stock');
      const allMarketValue = allStockHoldings.reduce((s, h) => s + (h.volume * h.current_price), 0);
      const allTotalValue = allMarketValue + allStockCashTotal;
      const allUnrealizedPnL = allStockHoldings.reduce((s, h) => s + h.pnl, 0);
      return (
        <div className="stock-dashboard">
          <div className="stats-grid">
            <div className="stat-card stat-card-featured">
              <div className="stat-title">💼 มูลค่าพอร์ตหุ้นรวมทั้งหมด</div>
              <div className="stat-value">{hideBalances ? '••••' : `${allTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB`}</div>
              <div className="stat-desc">{stockAccs.length} พอร์ตหุ้น · เงินสด + มูลค่าหุ้น</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">💵 เงินสดรวม</div>
              <div className="stat-value">{hideBalances ? '••••' : `${allStockCashTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB`}</div>
              <div className="stat-desc">Cash across all portfolios</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">📈 มูลค่าหุ้นรวม (Market Value)</div>
              <div className="stat-value">{hideBalances ? '••••' : `${allMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB`}</div>
              <div className="stat-desc">{allStockHoldings.length} รายการถือครอง</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">📊 กำไร/ขาดทุนสะสม (Unrealized)</div>
              <div className="stat-value" style={{ color: allUnrealizedPnL >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {hideBalances ? '••••' : `${allUnrealizedPnL >= 0 ? '+' : ''}${allUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB`}
              </div>
              <div className="stat-desc">Unrealized PnL รวม</div>
            </div>
          </div>
          <div className="section-box" style={{ marginTop: '24px' }}>
            <div className="section-title">
              <span>📋 หุ้นทั้งหมดในพอร์ต (All Holdings)</span>
              <span className="badge" style={{ background: 'rgba(0,255,209,0.1)', color: 'var(--accent-secondary)' }}>{allStockHoldings.length} รายการ</span>
            </div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead><tr>
                  <th>พอร์ต</th><th>หุ้น (Symbol)</th><th style={{ textAlign: 'right' }}>จำนวนหุ้น</th>
                  <th style={{ textAlign: 'right' }}>ราคาทุน</th><th style={{ textAlign: 'right' }}>ราคาล่าสุด</th>
                  <th style={{ textAlign: 'right' }}>มูลค่า (THB)</th><th style={{ textAlign: 'right' }}>กำไร/ขาดทุน</th>
                </tr></thead>
                <tbody>
                  {allStockHoldings.map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{h.account_name}</td>
                      <td style={{ fontWeight: '700', color: 'var(--accent-secondary)' }}>{h.symbol}</td>
                      <td style={{ textAlign: 'right' }}>{h.volume.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{h.avg_cost ? h.avg_cost.toFixed(2) : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{h.current_price ? h.current_price.toFixed(2) : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{hideBalances ? '••••' : (h.volume * h.current_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: h.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {hideBalances ? '••••' : `${h.pnl >= 0 ? '+' : ''}${h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  ))}
                  {allStockHoldings.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>ไม่มีหุ้นในพอร์ต</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="section-box" style={{ marginTop: '24px' }}>
            <div className="section-title">
              <span>📊 สรุปแต่ละพอร์ตหุ้น (Portfolio Breakdown)</span>
              <span className="badge" style={{ background: 'rgba(0,255,209,0.1)', color: 'var(--accent-secondary)' }}>{stockAccs.length} พอร์ต</span>
            </div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead><tr>
                  <th>ชื่อพอร์ต</th><th>โบรกเกอร์</th>
                  <th style={{ textAlign: 'right' }}>มูลค่าพอร์ต (Value)</th>
                </tr></thead>
                <tbody>
                  {stockAccs.map(acc => {
                    const isUSD = acc.currency === 'USD';
                    const rateVal = usdThbRate || 33.0;
                    return (
                      <tr key={acc.id}>
                        <td style={{ fontWeight: '600' }}>{acc.account_name}</td>
                        <td>{acc.broker_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
                          {hideBalances ? '••••' : (
                            isUSD ? (
                              `$${acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (~฿${(acc.equity * rateVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB)`
                            ) : (
                              `฿${acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Daily Stock Net Worth Line Chart */}
          {renderAssetDailyChart('stock_usd', 'Stocks', '#f59e0b')}
        </div>
      );
    }

    const activeAcc = accounts.find(a => a.id.toString() === selectedAccountId);
    if (!activeAcc || activeAcc.account_type !== 'stock') {
      return (
        <div className="section-box" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>กรุณาเลือกหรือเพิ่มพอร์ตหุ้นไทย</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 30px auto' }}>
            เลือกพอร์ตหุ้นไทยจากรายการด้านบน หรือกดปุ่ม "เพิ่มพอร์ตการลงทุน" เพื่อสร้างพอร์ตใหม่
          </p>
        </div>
      );
    }

    const rate = usdThbRate || 33.0;
    const isUSD = activeAcc.currency === 'USD';
    const isWebull = activeAcc.connection_type === 'webull_api';

    const formatCurrency = (val, forceTHB = false) => {
      if (isUSD && !forceTHB) {
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      }
      const thbVal = isUSD ? val * rate : val;
      return `฿${thbVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
    };

    const stockHoldingsValue = stockHoldings.reduce((sum, h) => sum + (h.volume * h.current_price), 0);
    const totalAccountValue = stockHoldingsValue + stockCash;
    const totalUnrealizedPnL = stockHoldings.reduce((sum, h) => sum + h.pnl, 0);

    return (
      <div className="stock-dashboard">
        <div className="stats-grid">
          <div className="stat-card stat-card-featured" style={{ position: 'relative' }}>
            {isWebull && (
              <span className="badge" style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                🔌 Webull API
              </span>
            )}
            <div className="stat-title">💼 มูลค่าพอร์ตหุ้นทั้งหมด (Total Value)</div>
            <div className="stat-value">
              {hideBalances ? '••••' : formatCurrency(totalAccountValue)}
            </div>
            <div className="stat-desc">
              {isUSD ? `≈ ${formatCurrency(totalAccountValue, true)}` : 'เงินสด + มูลค่าหุ้นที่ถือครอง'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">💵 เงินสดคงเหลือ (Cash Balance)</div>
            <div className="stat-value">
              {hideBalances ? '••••' : formatCurrency(stockCash)}
            </div>
            {isUSD && (
              <div className="stat-desc" style={{ marginBottom: isWebull ? '12px' : '4px' }}>
                {isUSD ? `≈ ${formatCurrency(stockCash, true)}` : ''}
              </div>
            )}
            {isWebull ? (
              <button 
                onClick={() => syncWebullData(activeAcc.id)} 
                disabled={isSyncingWebull} 
                className="btn-primary" 
                style={{ padding: '4px 10px', fontSize: '0.8rem', height: '28px', width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px' }}
              >
                {isSyncingWebull ? '⏳ ซิงค์ข้อมูล...' : '🔄 ซิงค์ Webull API'}
              </button>
            ) : (
              <form onSubmit={handleUpdateStockCash} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input" 
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '28px' }} 
                  value={editStockCashValue} 
                  onChange={(e) => setEditStockCashValue(e.target.value)} 
                />
                <button type="submit" className="btn-secondary" style={{ padding: '0 8px', height: '28px', fontSize: '0.8rem', width: 'auto' }}>อัปเดต</button>
              </form>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-title">📈 มูลค่าหุ้นถือครอง (Market Value)</div>
            <div className="stat-value">
              {hideBalances ? '••••' : formatCurrency(stockHoldingsValue)}
            </div>
            <div className="stat-desc">
              {isUSD ? `≈ ${formatCurrency(stockHoldingsValue, true)}` : 'ราคาล่าสุดอิงตลาดหลักทรัพย์ (SET)'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">🟢 กำไรที่ยังไม่เกิดขึ้น (Unrealized PnL)</div>
            <div className="stat-value" style={{ color: totalUnrealizedPnL >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {hideBalances ? '••••' : `${totalUnrealizedPnL >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedPnL)}`}
            </div>
            <div className="stat-desc">
              {isUSD ? `≈ ${formatCurrency(totalUnrealizedPnL, true)}` : 'กำไร/ขาดทุนทางบัญชีล่าสุด'}
            </div>
          </div>
        </div>


        {selectedStock && stockCandles.length > 0 && (
          <div className="candle-chart-container">
            <div className="chart-header">
              <div className="chart-title">
                <TrendingUp size={18} style={{ color: 'var(--accent-secondary)' }} />
                <span>กราฟราคา 6 เดือนย้อนหลัง: {selectedStock} (Yahoo Finance)</span>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', width: 'auto' }} onClick={() => setSelectedStock(null)}>ปิดกราฟ</button>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stockCandles}>
                  <defs>
                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: '600' }}
                  />
                  <Area type="monotone" dataKey="close" stroke="var(--accent-secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorStock)" name="Close Price" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="sections-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="section-box">
            <div className="section-title">📊 รายการหุ้นในพอร์ต (Holdings)</div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>หุ้น</th>
                    <th style={{ textAlign: 'right' }}>จำนวน</th>
                    <th style={{ textAlign: 'right' }}>ทุนเฉลี่ย</th>
                    <th style={{ textAlign: 'right' }}>ราคาตลาด</th>
                    <th style={{ textAlign: 'right' }}>PnL</th>
                    {!isWebull && <th>ลบ</th>}
                  </tr>
                </thead>
                <tbody>
                  {stockHoldings.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: '600', color: 'var(--accent-secondary)', cursor: 'pointer' }} onClick={() => loadStockCandles(h.symbol, activeAcc.currency)}>
                        🔍 {h.symbol}
                      </td>
                      <td style={{ textAlign: 'right' }}>{h.volume.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{h.avg_price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{h.current_price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: h.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {h.pnl >= 0 ? '+' : ''}{h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {!isWebull && (
                        <td>
                          <button className="btn-logout" onClick={() => handleDeleteStockHolding(h.id)} style={{ padding: '6px' }}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {stockHoldings.length === 0 && (
                    <tr>
                      <td colSpan={isWebull ? 5 : 6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>ไม่มีรายการหุ้นในพอร์ต</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section-box">
            {isWebull ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '260px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔌</div>
                <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '1.05rem' }}>บัญชีเชื่อมต่อ Webull API</h4>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.5', maxWidth: '320px', margin: '0 auto' }}>
                  ข้อมูลรายการซื้อขายและหุ้นที่ถือครองจะถูกดึงและอัปเดตแบบอัตโนมัติจากบัญชี Webull ของท่านโดยตรง ไม่จำเป็นต้องบันทึกรายการเทรดด้วยตนเอง
                </p>
              </div>
            ) : (
              <>
                <div className="section-title">✍️ บันทึกธุรกรรม (Log Trade)</div>
                <form onSubmit={handleAddStockTrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">ชื่อหุ้น (Symbol เช่น PTT)</label>
                    <input type="text" className="form-input" required value={stockSymbol} onChange={(e) => setStockSymbol(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ประเภท</label>
                    <select className="form-input" value={stockAction} onChange={(e) => setStockAction(e.target.value)}>
                      <option value="BUY">ซื้อ (BUY)</option>
                      <option value="SELL">ขาย (SELL)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">จำนวนหุ้น</label>
                    <input type="number" className="form-input" required value={stockVolume} onChange={(e) => setStockVolume(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ราคาต่อหุ้น</label>
                    <input type="number" step="0.01" className="form-input" required value={stockPrice} onChange={(e) => setStockPrice(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">หมายเหตุ</label>
                    <input type="text" className="form-input" value={stockReason} onChange={(e) => setStockReason(e.target.value)} />
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>บันทึกรายการ</button>
                </form>
              </>
            )}
          </div>
        </div>


        <div className="section-box" style={{ marginTop: '24px' }}>
          <div className="section-title">📜 ประวัติธุรกรรมการซื้อขายหุ้น (Stock Trade Logs)</div>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>หุ้น</th>
                  <th>ธุรกรรม</th>
                  <th style={{ textAlign: 'right' }}>จำนวน</th>
                  <th style={{ textAlign: 'right' }}>ราคาซื้อขาย</th>
                  <th style={{ textAlign: 'right' }}>มูลค่ารวม</th>
                  <th style={{ textAlign: 'right' }}>Realized PnL</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {stockTrades.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleString('th-TH')}</td>
                    <td style={{ fontWeight: '600' }}>{t.symbol}</td>
                    <td>
                      <span className={`badge ${t.action === 'BUY' ? 'badge-info' : 'badge-success'}`}>
                        {t.action === 'BUY' ? 'ซื้อ' : 'ขาย'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{t.volume.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{t.price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{(t.volume * t.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: t.realized_pnl > 0 ? 'var(--success)' : t.realized_pnl < 0 ? 'var(--error)' : 'inherit' }}>
                      {t.realized_pnl !== 0 ? `${t.realized_pnl > 0 ? '+' : ''}${t.realized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td>{t.reason || '-'}</td>
                  </tr>
                ))}
                {stockTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>ไม่มีประวัติการทำรายการ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCryptoTab = () => {
    // Combined view for all crypto wallets
    if (selectedAccountId === 'all-crypto') {
      const cryptoAccs = accounts.filter(a => a.account_type === 'crypto');
      const allCryptoTotal = allCryptoHoldings.reduce((s, h) => s + h.value_usd, 0);
      const rate = usdThbRate || 33.0;
      return (
        <div className="crypto-dashboard">
          <div className="stats-grid">
            <div className="stat-card stat-card-featured">
              <div className="stat-title">🪙 มูลค่าพอร์ตคริปโตรวมทั้งหมด</div>
              <div className="stat-value">{hideBalances ? '••••' : `$${allCryptoTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {hideBalances ? '••••' : `≈ ฿${(allCryptoTotal * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB`}
              </div>
              <div className="stat-desc">{cryptoAccs.length} กระเป๋า / Exchange</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">🔗 จำนวนกระเป๋า</div>
              <div className="stat-value">{cryptoAccs.length}</div>
              <div className="stat-desc">{allCryptoHoldings.length} รายการเหรียญทั้งหมด</div>
            </div>
          </div>
          <div className="section-box" style={{ marginTop: '24px' }}>
            <div className="section-title">
              <span>📋 เหรียญทั้งหมดในทุกกระเป๋า (All Holdings)</span>
              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{allCryptoHoldings.length} รายการ</span>
            </div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead><tr>
                  <th>กระเป๋า / Exchange</th>
                  <th>เหรียญ</th>
                  <th style={{ textAlign: 'right' }}>จำนวน</th>
                  <th style={{ textAlign: 'right' }}>ราคาล่าสุด</th>
                  <th style={{ textAlign: 'right' }}>มูลค่า (USD)</th>
                  <th style={{ textAlign: 'right' }}>มูลค่า (THB)</th>
                </tr></thead>
                <tbody>
                  {allCryptoHoldings.map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{h.account_name}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>{h.symbol}</td>
                      <td style={{ textAlign: 'right' }}>{h.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                      <td style={{ textAlign: 'right' }}>{h.current_price_usd > 0 ? `$${h.current_price_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
                        {hideBalances ? '••••' : `$${h.value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {hideBalances ? '••••' : `฿${(h.value_usd * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      </td>
                    </tr>
                  ))}
                  {allCryptoHoldings.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>ไม่มีเหรียญในพอร์ต</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="section-box" style={{ marginTop: '24px' }}>
            <div className="section-title">
              <span>📊 สรุปแต่ละกระเป๋า (Wallet Breakdown)</span>
              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{cryptoAccs.length} กระเป๋า</span>
            </div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead><tr>
                  <th>ชื่อกระเป๋า / Exchange</th>
                  <th>แพลตฟอร์ม</th>
                  <th style={{ textAlign: 'right' }}>มูลค่า (USD)</th>
                  <th style={{ textAlign: 'right' }}>มูลค่า (THB)</th>
                </tr></thead>
                <tbody>
                  {cryptoAccs.map(acc => (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: '600' }}>{acc.account_name}</td>
                      <td>{acc.broker_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
                        {hideBalances ? '••••' : `$${acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {hideBalances ? '••••' : `฿${(acc.equity * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Daily Crypto Net Worth Line Chart */}
          {renderAssetDailyChart('crypto_usd', 'Crypto', '#10b981')}
        </div>
      );
    }

    const activeAcc = accounts.find(a => a.id.toString() === selectedAccountId);
    if (!activeAcc || activeAcc.account_type !== 'crypto') {
      return (
        <div className="section-box" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Wallet size={48} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>กรุณาเลือกหรือเพิ่มพอร์ตคริปโต</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 30px auto' }}>
            เลือกพอร์ตคริปโตจากรายการด้านบน หรือกดปุ่ม "เพิ่มพอร์ตการลงทุน" เพื่อสร้างกระเป๋าใหม่
          </p>
        </div>
      );
    }

    const cryptoTotalValue = cryptoHoldings.reduce((sum, h) => sum + h.value_usd, 0);

    return (
      <div className="crypto-dashboard">
        <div className="stats-grid">
          <div className="stat-card stat-card-featured">
            <div className="stat-title">💰 มูลค่าพอร์ตเหรียญรวม (Total Value)</div>
            <div className="stat-value">
              {hideBalances ? '••••' : `$${cryptoTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </div>
            <div className="stat-desc">เงินลงทุนรวมดอลลาร์สหรัฐ (USD)</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">🔗 ที่อยู่กระเป๋า / Exchange</div>
            <div className="stat-value" style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>
              {activeAcc.account_number}
            </div>
            <div className="stat-desc">แพลตฟอร์มหลัก: {activeAcc.broker_name}</div>
          </div>
        </div>

        <div className="sections-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="section-box">
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📊 พอร์ตเหรียญดิจิทัล (Holdings)</span>
              <button className="btn-secondary" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', width: 'auto' }} onClick={handleSyncCryptoPrices} disabled={isSyncing}>
                <RefreshCw size={12} className={isSyncing ? 'spin-anim' : ''} />
                อัปเดตราคาตลาด
              </button>
            </div>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>เหรียญ (Asset)</th>
                    <th style={{ textAlign: 'right' }}>จำนวน</th>
                    <th style={{ textAlign: 'right' }}>ทุนซื้อเฉลี่ย</th>
                    <th style={{ textAlign: 'right' }}>ราคาล่าสุด</th>
                    <th style={{ textAlign: 'right' }}>มูลค่ารวม</th>
                    <th>ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {cryptoHoldings.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>{h.symbol}</td>
                      <td style={{ textAlign: 'right' }}>{h.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                      <td style={{ textAlign: 'right' }}>{h.avg_purchase_price ? `$${h.avg_purchase_price.toLocaleString()}` : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{h.current_price_usd > 0 ? `$${h.current_price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : 'กำลังคำนวณ'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
                        ${h.value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <button className="btn-logout" onClick={() => handleDeleteCryptoHolding(h.id)} style={{ padding: '6px' }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cryptoHoldings.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>ไม่มีเหรียญในพอร์ต</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section-box">
            <div className="section-title">➕ เพิ่มเหรียญ / ยอดคงเหลือ (Add Token)</div>
            <form onSubmit={handleAddCryptoHolding} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">ชื่อย่อเหรียญ (เช่น BTC, ETH, SOL, DOGE)</label>
                <input type="text" className="form-input" required placeholder="เช่น BTC" value={cryptoSymbol} onChange={(e) => setCryptoSymbol(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">จำนวนคงเหลือ (Balance Amount)</label>
                <input type="number" step="0.00000001" className="form-input" required placeholder="เช่น 0.0245" value={cryptoBalance} onChange={(e) => setCryptoBalance(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">ราคาทุนเฉลี่ย USD (ไม่บังคับกรอก)</label>
                <input type="number" step="0.01" className="form-input" placeholder="เช่น 64800" value={cryptoAvgPrice} onChange={(e) => setCryptoAvgPrice(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>บันทึกข้อมูล</button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkspaceContent = () => {
    return (
      <>
        
        {/* Top Control Bar */}
        {page !== 'public' ? (
          <div className="account-selector-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <select 
                className="account-select" 
                value={selectedAccountId} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedAccountId(val);
                  if (val === 'all') {
                    if (activeTab !== 'forex') setActiveTab('networth');
                    loadAllAccountsCombinedData(accounts.filter(a => !a.account_type || a.account_type === 'forex'));
                  } else if (val === 'all-stock') {
                    setSelectedAccountId('all-stock');
                    loadAllStockData();
                  } else if (val === 'all-crypto') {
                    setSelectedAccountId('all-crypto');
                    loadAllCryptoData();
                  } else {
                    const selectedAcc = accounts.find(a => a.id.toString() === val);
                    if (selectedAcc) {
                      if (selectedAcc.account_type === 'stock') {
                        loadStockData(val);
                      } else if (selectedAcc.account_type === 'crypto') {
                        loadCryptoData(val);
                      } else {
                        loadAccountData(val);
                      }
                    }
                  }
                }}
              >
                {accounts.length > 0 && activeTab === 'networth' && (
                  <option value="all">📊 สรุปรวมทุกพอร์ต (All Portfolios)</option>
                )}
                {accounts.length > 0 && activeTab === 'forex' && (
                  <option value="all">📊 สรุปรวมทุกพอร์ต Forex</option>
                )}
                {accounts.filter(a => a.account_type === 'stock').length > 1 && activeTab === 'stock' && (
                  <option value="all-stock">📊 สรุปรวมทุกพอร์ตหุ้น (All Stock Portfolios)</option>
                )}
                {accounts.filter(a => a.account_type === 'crypto').length > 1 && activeTab === 'crypto' && (
                  <option value="all-crypto">📊 สรุปรวมทุกกระเป๋าคริปโต (All Crypto Wallets)</option>
                )}
                {accounts
                  .filter(acc => {
                    if (activeTab === 'forex') return !acc.account_type || acc.account_type === 'forex';
                    if (activeTab === 'stock') return acc.account_type === 'stock';
                    if (activeTab === 'crypto') return acc.account_type === 'crypto';
                    return true;
                  })
                  .map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.broker_name})
                    </option>
                  ))}
                {accounts.length === 0 && <option value="">ไม่มีบัญชีเชื่อมต่อ</option>}
              </select>

              {/* Privacy Eye Toggle Button */}
              {selectedAccountId && (
                <button 
                  className={`btn-secondary ${hideBalances ? 'active' : ''}`}
                  onClick={toggleHideBalances}
                  title={hideBalances ? "แสดงตัวเลขยอดเงิน" : "ซ่อนตัวเลขยอดเงิน"}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', height: '38px', width: '38px', borderRadius: '8px' }}
                >
                  {hideBalances ? <EyeOff size={15} style={{ color: 'var(--accent-secondary)' }} /> : <Eye size={15} />}
                </button>
              )}
              
              {selectedAccountId && (
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    if (activeTab === 'crypto') {
                      handleSyncCryptoPrices();
                    } else if (activeTab === 'stock') {
                      loadStockData(selectedAccountId);
                    } else {
                      loadAccountData(selectedAccountId);
                    }
                  }} 
                  disabled={isSyncing}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                >
                  <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
                  <span className="btn-text">{isSyncing ? 'กำลังซิงค์...' : 'รีเฟรช'}</span>
                </button>
              )}

              {selectedAccountId && selectedAccountId !== 'all' && (
                <button 
                  className="btn-secondary" 
                  onClick={openEditAccountModal} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)', height: '38px' }}
                >
                  <Edit size={14} />
                  <span className="btn-text">แก้ไขพอร์ต</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {selectedAccountId && (
                <>
                  <button 
                    className="btn-secondary"
                    onClick={() => {
                      const activeAcc = accounts.find(a => a.id === parseInt(selectedAccountId));
                      if (activeAcc && activeAcc.publisher_token) {
                        setActiveGuideToken(activeAcc.publisher_token);
                        setShowGuideModal(true);
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                  >
                    <BookOpen size={14} />
                    <span className="btn-text">คู่มือติดตั้ง EA</span>
                  </button>
                  
                  <button 
                    className="btn-secondary"
                    onClick={() => {
                      setShowShareModal(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                  >
                    <LinkIcon size={14} />
                    <span className="btn-text">แชร์พอร์ต</span>
                  </button>
                </>
              )}
              
              <button 
                className="btn-primary" 
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', height: '38px' }}
                onClick={() => setShowAddAccountModal(true)}
              >
                <Plus size={16} />
                <span className="btn-text">เพิ่มพอร์ตการลงทุน</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="account-selector-bar">
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800' }}>
              ผลการเทรดของพอร์ต: <span style={{ color: 'var(--accent-secondary)' }}>{dashboardStats?.account_name}</span>
            </h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                {dashboardStats?.broker_name}
              </span>
              <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(0, 255, 209, 0.1)', color: 'var(--accent-secondary)' }}>
                {dashboardStats?.connection_type === 'publisher_ea' ? 'MT5 EA Connector' : 'Broker Direct Sync'}
              </span>
            </div>
          </div>
        )}
        {page !== 'public' && activeTab === 'networth' && renderNetWorthTab()}
        {page !== 'public' && activeTab === 'stock' && renderStockTab()}
        {page !== 'public' && activeTab === 'crypto' && renderCryptoTab()}

        {(activeTab === 'forex' || page === 'public') && (
          dashboardStats ? (
            <>
            {/* Date Range Filter Bar */}
            <div className="section-box" style={{ marginBottom: '24px', background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🗓️ กรองช่วงเวลา (Date Filter):</span>
                <select 
                  value={datePreset} 
                  onChange={(e) => applyDatePreset(e.target.value)}
                  className="account-select" 
                  style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                >
                  <option value="all">แสดงทั้งหมด (All Time)</option>
                  <option value="today">วันนี้ (Today)</option>
                  <option value="last7">7 วันล่าสุด (Last 7 Days)</option>
                  <option value="last30">30 วันล่าสุด (Last 30 Days)</option>
                  <option value="thisMonth">เดือนนี้ (This Month)</option>
                  <option value="lastMonth">เดือนที่แล้ว (Last Month)</option>
                  <option value="custom">เลือกช่วงเวลาเอง (Custom Range)</option>
                </select>

                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="form-input" 
                      style={{ padding: '6px 10px', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>ถึง</span>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="form-input" 
                      style={{ padding: '6px 10px', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px' }}
                    />
                  </div>
                )}
              </div>

              {(startDate || endDate) && (
                <button 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'rgba(255, 75, 75, 0.2)' }}
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('all');
                  }}
                >
                  ล้างตัวกรองวันที่
                </button>
              )}
            </div>

            {/* Portfolio Breakdown (Only in Combined view) */}
            {selectedAccountId === 'all' && (
              <div className="section-box" style={{ marginBottom: '32px' }}>
                <div className="section-title">
                  <span>ตารางสรุปสถานะแต่ละพอร์ต (Portfolio Breakdown)</span>
                  <span className="badge" style={{ background: 'rgba(0, 255, 209, 0.1)', color: 'var(--accent-secondary)' }}>
                    {accounts.filter(a => !a.account_type || a.account_type === 'forex').length} พอร์ต Forex
                  </span>
                </div>
                
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ชื่อพอร์ต (Account Name)</th>
                        <th>โบรกเกอร์ (Broker)</th>
                        <th>เลขบัญชี (Account No.)</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '140px' }}>ประเภทการเชื่อมต่อ</th>
                        <th>Balance</th>
                        <th>Equity</th>
                        <th>Floating PnL</th>
                        <th>สถานะ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts
                        .filter(a => !a.account_type || a.account_type === 'forex')
                        .map(acc => (
                        <tr key={acc.id}>
                          <td style={{ fontWeight: '600' }}>{acc.account_name}</td>
                          <td>{acc.broker_name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{acc.account_number}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge badge-success" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {acc.connection_type === 'publisher_ea' ? '🤖 MT5 EA' : '🔗 Broker Direct'}
                            </span>
                          </td>
                          <td>
                            {hideBalances ? '••••' : `${acc.balance.toLocaleString()} ${acc.currency}`}
                            {isCentCurrency(acc.currency) && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {hideBalances ? '($•••• USD)' : `(${(acc.balance / 100).toLocaleString()} USD)`}
                              </span>
                            )}
                          </td>
                          <td>
                            {hideBalances ? '••••' : `${acc.equity.toLocaleString()} ${acc.currency}`}
                            {isCentCurrency(acc.currency) && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {hideBalances ? '($•••• USD)' : `(${(acc.equity / 100).toLocaleString()} USD)`}
                              </span>
                            )}
                          </td>
                          <td className={acc.profit >= 0 ? 'up' : 'down'} style={{ fontWeight: '700' }}>
                            {acc.profit >= 0 ? '+' : ''}{acc.profit.toLocaleString()} {acc.currency}
                            {isCentCurrency(acc.currency) && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: acc.profit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                                ({acc.profit >= 0 ? '+' : ''}${(acc.profit / 100).toLocaleString()} USD)
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${acc.status === 'active_publisher_ea' ? 'badge-success' : 'badge-error'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                              {acc.status === 'active_publisher_ea' ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                              onClick={() => {
                                setSelectedAccountId(acc.id.toString());
                                loadAccountData(acc.id.toString());
                              }}
                            >
                              เจาะลึกพอร์ต
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Premium Stats Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              
              {/* Card 1: Net Profit */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: advancedStats.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}></div>
                <div className="stat-label">
                  <DollarSign size={14} style={{ color: advancedStats.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }} />
                  NET PROFIT
                </div>
                <div className={`stat-value ${advancedStats.netProfit >= 0 ? 'up' : 'down'}`}>
                  {advancedStats.netProfit >= 0 ? '+' : ''}
                  {advancedStats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                </div>
                <div className="stat-desc" style={{ color: advancedStats.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  +{advancedStats.returnPct.toFixed(2)}% return
                </div>
              </div>

              {/* Card 2: Win Rate */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: 'var(--accent-primary)' }}></div>
                <div className="stat-label">
                  <Percent size={14} style={{ color: 'var(--accent-primary)' }} />
                  WIN RATE
                </div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {advancedStats.winRate.toFixed(1)}%
                </div>
                <div className="stat-desc">
                  {advancedStats.winTradesCount}W / {advancedStats.lossTradesCount}L / {advancedStats.totalTradesCount} trades
                </div>
              </div>

              {/* Card 3: Profit Factor */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: 'var(--accent-secondary)' }}></div>
                <div className="stat-label">
                  <Activity size={14} style={{ color: 'var(--accent-secondary)' }} />
                  PROFIT FACTOR
                </div>
                <div className="stat-value" style={{ color: advancedStats.profitFactor >= 1.0 ? 'var(--success)' : 'var(--error)' }}>
                  {advancedStats.profitFactor.toFixed(2)}
                </div>
                <div className="stat-desc">
                  Gross W: {advancedStats.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} / L: {Math.abs(advancedStats.grossLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Card 4: Max Drawdown */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: 'var(--error)' }}></div>
                <div className="stat-label">
                  <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
                  MAX DRAWDOWN
                </div>
                <div className="stat-value down">
                  -{advancedStats.maxDrawdownPct.toFixed(2)}%
                </div>
                <div className="stat-desc">
                  -${advancedStats.maxDrawdownAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })} peak-to-trough
                </div>
              </div>

              {/* Card 5: Expectancy */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: 'var(--accent-primary)' }}></div>
                <div className="stat-label">
                  <TrendingUp size={14} style={{ color: 'var(--accent-primary)' }} />
                  EXPECTANCY
                </div>
                <div className={`stat-value ${advancedStats.expectancy >= 0 ? 'up' : 'down'}`} style={{ fontSize: '1.6rem' }}>
                  {advancedStats.expectancy >= 0 ? '+' : ''}
                  {advancedStats.expectancy.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                </div>
                <div className="stat-desc">per trade average</div>
              </div>

              {/* Card 6: Avg Win */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: 'var(--success)' }}></div>
                <div className="stat-label">
                  <ArrowUpRight size={14} style={{ color: 'var(--success)' }} />
                  AVG WIN
                </div>
                <div className="stat-value up" style={{ fontSize: '1.6rem' }}>
                  +{advancedStats.avgWin.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                </div>
                <div className="stat-desc">vs avg loss -{advancedStats.avgLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>

              {/* Card 7: Risk:Reward */}
              <div className="stat-card">
                <div className="stat-card-glow" style={{ background: 'var(--accent-secondary)' }}></div>
                <div className="stat-label">
                  <Sliders size={14} style={{ color: 'var(--accent-secondary)' }} />
                  RISK:REWARD
                </div>
                <div className="stat-value" style={{ fontSize: '1.6rem' }}>
                  {advancedStats.riskReward.toFixed(2)}x
                </div>
                <div className="stat-desc">avg win / avg loss</div>
              </div>

              {/* Card 8: Final Balance */}
              <div className="stat-card stat-card-featured">
                <div className="stat-card-glow" style={{ background: 'var(--accent-secondary)' }}></div>
                <div className="stat-label">
                  <Wallet size={14} style={{ color: 'var(--accent-secondary)' }} />
                  FINAL BALANCE
                </div>
                <div className="stat-value" style={{ fontSize: '1.6rem', color: '#fff' }}>
                  {hideBalances ? '••••' : `${advancedStats.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${advancedStats.currency}`}
                </div>
                <div className="stat-desc">
                  {hideBalances ? 'started at $••••' : `started at $${advancedStats.startingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </div>
              </div>

            </div>

            {/* Win Rate Progress Sub-row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div className="stat-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Win rate รวม</span>
                  <span style={{ fontWeight: '700', color: 'var(--success)' }}>{advancedStats.winRate.toFixed(1)}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ width: `${advancedStats.winRate}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {advancedStats.winTradesCount} wins / {advancedStats.totalTradesCount} trades
                </div>
              </div>

              <div className="stat-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Win rate BUY</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{advancedStats.buyWinRate.toFixed(1)}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ width: `${advancedStats.buyWinRate}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {advancedStats.buyWinsCount} wins / {advancedStats.buyTradesCount} trades
                </div>
              </div>

              <div className="stat-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Win rate SELL</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-secondary)' }}>{advancedStats.sellWinRate.toFixed(1)}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ width: `${advancedStats.sellWinRate}%`, height: '100%', background: 'var(--accent-secondary)', borderRadius: '3px' }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {advancedStats.sellWinsCount} wins / {advancedStats.sellTradesCount} trades
                </div>
              </div>
            </div>

            {/* Growth Curve Chart */}
            <div className="section-box" style={{ marginBottom: '32px' }}>
              <div className="section-title">
                <span>กราฟการเติบโตพอร์ตการเทรด (Growth & Equity Curve)</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  แสดงค่า Balance และ Equity ปิดดีลรายวัน
                </span>
              </div>
              
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <AreaChart data={filteredEquityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis hide={hideBalances} stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff', fontWeight: '600' }}
                      formatter={(value, name, props) => {
                        if (hideBalances) {
                          return ['••••', name];
                        }
                        const payload = props.payload;
                        const formattedVal = `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${advancedStats.currency}`;
                        if (name === "Balance" && payload) {
                          const txType = payload.transaction_type || payload.transactionType;
                          const txAmt = payload.transaction_amount || payload.transactionAmount;
                          if (txType) {
                            const prefix = txType === 'deposit' ? '📥 ฝากเงิน' : '📤 ถอนเงิน';
                            const sign = txType === 'deposit' ? '+' : '-';
                            return [
                              `${formattedVal} (${prefix}: ${sign}${Number(txAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${advancedStats.currency})`,
                              name
                            ];
                          }
                        }
                        return [formattedVal, name];
                      }}
                    />
                    <Area type="monotone" dataKey="balance" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" name="Balance" dot={renderCustomDot} activeDot={{ r: 8 }} />
                    <Area type="monotone" dataKey="equity" stroke="var(--accent-secondary)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEquity)" name="Equity" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Calendar & Details Grid */}
            <div className="sections-grid">
              
              {/* Daily Calendar (Left) */}
              {page !== 'public' && (
                <div className="section-box">
                  <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>ปฏิทินกำไรขาดทุนรายวัน (Daily P&L Calendar)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={handlePrevMonth} 
                        style={{ 
                          padding: '4px 10px', 
                          fontSize: '0.75rem', 
                          background: 'rgba(255,255,255,0.06)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '6px', 
                          color: 'var(--text-primary)', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s' 
                        }}
                        type="button"
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.12)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                      >
                        ◀
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', minWidth: '125px', textAlign: 'center' }}>
                        {calendarDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                      </span>
                      <button 
                        onClick={handleNextMonth} 
                        style={{ 
                          padding: '4px 10px', 
                          fontSize: '0.75rem', 
                          background: 'rgba(255,255,255,0.06)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '6px', 
                          color: 'var(--text-primary)', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s' 
                        }}
                        type="button"
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.12)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  <div className="calendar-grid">
                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                      <div key={d} className="calendar-header-day">{d}</div>
                    ))}
                    
                    {calendarDays.map((day, idx) => (
                      <div key={idx} className={`calendar-day-cell ${!day.active ? 'inactive' : ''}`}>
                        {day.day && (
                          <>
                            <div className="calendar-day-num">{day.day}</div>
                            {day.count > 0 ? (
                              <div className={`calendar-day-pnl ${day.profit >= 0 ? 'profit' : 'loss'}`}>
                                {day.profit >= 0 ? '+' : ''}{day.profit.toFixed(1)}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>-</div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ 
                    marginTop: '15px', 
                    paddingTop: '12px', 
                    borderTop: '1px solid rgba(255,255,255,0.08)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '0.85rem' 
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>สรุปกำไรรวมของเดือนนี้:</span>
                    <span style={{ 
                      fontWeight: '700', 
                      color: monthlyTotalPnl >= 0 ? '#2ecc71' : '#e74c3c',
                      background: monthlyTotalPnl >= 0 ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: monthlyTotalPnl >= 0 ? '1px solid rgba(46,204,113,0.2)' : '1px solid rgba(231,76,60,0.2)'
                    }}>
                      {monthlyTotalPnl >= 0 ? '🟢 กำไร ' : '🔴 ขาดทุน '} 
                      {monthlyTotalPnl >= 0 ? '+' : ''}{monthlyTotalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              )}

              {/* Right Column: Stacks AI Summary and Additional Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', gridColumn: page === 'public' ? 'span 2' : 'auto' }}>
                {/* AI Summary */}
                <div className="section-box">
                  <div className="section-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cpu size={18} style={{ color: 'var(--accent-secondary)' }} />
                      บทวิเคราะห์พฤติกรรม AI
                    </span>
                  </div>
                  
                  <div className="ai-summary-text" style={{ padding: '10px 0' }}>
                    {/* Basic parser for mock markdown header/list */}
                    {aiSummary.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) {
                        return <h4 key={i} style={{ color: '#fff', fontSize: '1.1rem', margin: '14px 0 8px 0' }}>{line.replace('### ', '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return <li key={i} style={{ marginLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>{line.replace('- ', '')}</li>;
                      }
                      if (line.startsWith('*')) {
                        return <p key={i} style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '16px' }}>{line.replace(/\*/g, '')}</p>;
                      }
                      return <p key={i} style={{ marginBottom: '10px' }}>{line}</p>;
                    })}
                  </div>

                  <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', justifyContent: 'center' }}>
                    <button 
                      className="btn-primary" 
                      onClick={triggerAiAnalysis} 
                      disabled={isAiLoading}
                      style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'linear-gradient(135deg, var(--accent-secondary) 0%, #12a67e 100%)' }}
                    >
                      <Cpu size={16} className={isAiLoading ? 'spin-anim' : ''} />
                      {isAiLoading ? 'กำลังส่งวิเคราะห์...' : 'วิเคราะห์พอร์ตด้วย AI'}
                    </button>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="section-box">
                  <div className="section-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
                      สถิติเพิ่มเติม (Additional Stats)
                    </span>
                  </div>
                  
                  <div className="additional-stats-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total trades</span>
                      <span style={{ fontWeight: '600', color: '#fff' }}>{advancedStats.totalTradesCount}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>TP hits</span>
                      <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                        {advancedStats.tpHits} ({advancedStats.tpPct.toFixed(0)}%)
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>SL hits</span>
                      <span style={{ fontWeight: '600', color: 'var(--error)' }}>
                        {advancedStats.slHits} ({advancedStats.slPct.toFixed(0)}%)
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manual close</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{advancedStats.manualCloses} ({advancedStats.manualPct.toFixed(0)}%)</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Best trade</span>
                      <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                        +{advancedStats.bestTrade.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Worst trade</span>
                      <span style={{ fontWeight: '600', color: 'var(--error)' }}>
                        {advancedStats.worstTrade >= 0 ? '+' : ''}{advancedStats.worstTrade.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gross profit</span>
                      <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                        +{advancedStats.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gross loss</span>
                      <span style={{ fontWeight: '600', color: 'var(--error)' }}>
                        {advancedStats.grossLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })} {advancedStats.currency}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Recovery factor</span>
                      <span style={{ fontWeight: '600', color: 'var(--accent-secondary)' }}>{advancedStats.recoveryFactor.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Open Positions Table */}
            {openPositions.length > 0 && (
              <div className="section-box" style={{ marginBottom: '32px' }}>
                <div className="section-title">
                  <span>สถานะออเดอร์ถือครอง (Open Positions)</span>
                  <span className="badge" style={{ background: 'rgba(0, 255, 209, 0.1)', color: 'var(--accent-secondary)' }}>
                    {openPositions.length} Positions Active
                  </span>
                </div>
                
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Size (Lots)</th>
                        <th>Open Price</th>
                        <th>Current Price</th>
                        <th>Floating Profit</th>
                        <th>Magic Number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openPositions.map(pos => (
                        <tr key={pos.ticket}>
                          <td style={{ fontFamily: 'monospace' }}>{pos.ticket}</td>
                          <td style={{ fontWeight: '600' }}>{pos.symbol}</td>
                          <td>
                            <span className={`badge ${pos.type === 'buy' ? 'badge-success' : 'badge-error'}`}>
                              {pos.type}
                            </span>
                          </td>
                          <td>{pos.volume}</td>
                          <td>{pos.price_open.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>{pos.price_current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className={pos.profit >= 0 ? 'up' : 'down'} style={{ fontWeight: '700' }}>
                            {pos.profit >= 0 ? '+' : ''}{pos.profit.toLocaleString()} {displayStats.currency}
                          </td>
                          <td>{pos.magic || 'Manual'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Closed Deals History */}
            <div className="section-box">
              <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span>ประวัติออเดอร์ปิดกำไร/ขาดทุนล่าสุด (Recent Closed Deals)</span>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>กรองตาม Magic Number:</span>
                  <select 
                    value={magicFilter} 
                    onChange={(e) => setMagicFilter(e.target.value)}
                    className="account-select" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="all">แสดงทั้งหมด (All)</option>
                    <option value="manual">Manual (เทรดมือ)</option>
                    {uniqueMagicNumbers.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('magic')}>
                        Magic Number {sortField === 'magic' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th>Ticket</th>
                      <th>Symbol</th>
                      <th>Type</th>
                      <th>Lots</th>
                      <th>Entry/Exit</th>
                      <th>Execution Price</th>
                      <th>Swap / Comm</th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('profit')}>
                        Net Profit {sortField === 'profit' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('execution_time')}>
                        Execution Time {sortField === 'execution_time' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      {page !== 'public' && <th>Comment</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClosedTrades.slice(0, 30).map(deal => {
                      const net = deal.profit + deal.swap + deal.commission;
                      return (
                        <tr key={deal.ticket}>
                          <td style={{ fontWeight: '600', color: deal.magic ? 'var(--accent-secondary)' : 'var(--text-muted)' }}>
                            {deal.magic || (page === 'public' ? '-' : 'Manual')}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{deal.ticket}</td>
                          <td style={{ fontWeight: '600' }}>{deal.symbol || 'Balance Op'}</td>
                          <td>
                            <span className={`badge ${deal.type === 'buy' ? 'badge-success' : (deal.type === 'sell' ? 'badge-error' : '')}`} style={{ background: deal.type === 'balance' ? 'rgba(255,255,255,0.06)' : undefined, color: deal.type === 'balance' ? 'var(--text-secondary)' : undefined }}>
                              {deal.type}
                            </span>
                          </td>
                          <td>{deal.volume > 0 ? deal.volume : '-'}</td>
                          <td style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{deal.entry_type || '-'}</td>
                          <td>{deal.price > 0 ? deal.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {deal.swap !== 0 ? `S:${deal.swap}` : ''} {deal.commission !== 0 ? `C:${deal.commission}` : ''} {deal.swap === 0 && deal.commission === 0 ? '0.00' : ''}
                          </td>
                          <td style={{ fontWeight: '700', color: net >= 0 ? 'var(--success)' : 'var(--error)' }}>
                            {net >= 0 ? '+' : ''}{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {displayStats.currency}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {new Date(deal.execution_time).toLocaleString('th-TH')}
                          </td>
                          {page !== 'public' && <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{deal.comment}</td>}
                        </tr>
                      );
                    })}
                    {sortedClosedTrades.length === 0 && (
                      <tr>
                        <td colSpan={page === 'public' ? 10 : 11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          {closedTrades.length === 0 
                            ? 'ไม่มีรายการประวัติการเทรดบันทึกไว้ในฐานข้อมูล' 
                            : 'ไม่มีรายการประวัติการเทรดที่ตรงกับเงื่อนไขการกรอง'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Daily Forex Net Worth Line Chart */}
            {selectedAccountId === 'all' && renderAssetDailyChart('forex_usd', 'Forex', '#818cf8')}
          </>
        ) : (
          <div className="section-box" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Activity size={48} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>ยินดีต้อนรับสู่ระบบ Thankhun trade Jornal</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 30px auto' }}>
              บัญชีพอร์ตโฟลิโอของคุณยังว่างเปล่า เริ่มต้นโดยการกดเพิ่มบัญชี MT5 ใหม่ จากนั้นดาวน์โหลด EA ติดตั้งเข้าในโปรแกรม MT5 เพื่อซิงค์ข้อมูลประวัติการเทรดแบบเรียลไทม์
            </p>
            <button className="btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => setShowAddAccountModal(true)}>
              <Plus size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              เพิ่มพอร์ตการเทรดตัวแรกของคุณ
            </button>
          </div>
            )
          )}
        </>
      );
    };

    const renderEditAccountModal = () => {
      if (!showEditAccountModal) return null;
      const activeAcc = accounts.find(a => a.id.toString() === selectedAccountId);
      if (!activeAcc) return null;
      const isStock = activeAcc.account_type === 'stock';
      const isCrypto = activeAcc.account_type === 'crypto';
      const isWebull = isStock && activeAcc.connection_type === 'webull_api';

      return (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit size={20} style={{ color: 'var(--accent-secondary)' }} />
              {isStock ? 'แก้ไขข้อมูลพอร์ตหุ้น' : isCrypto ? 'แก้ไขข้อมูลพอร์ตคริปโต' : 'แก้ไขข้อมูลพอร์ตเทรด MT5'}
            </h3>
            
            <form onSubmit={handleEditAccount}>
              <div className="form-group">
                <label className="form-label">ชื่อเรียกบัญชี (Friendly Name)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={editAccountName} 
                  onChange={(e) => setEditAccountName(e.target.value)} 
                />
              </div>

              {!isWebull && (
                <div className="form-group">
                  <label className="form-label">{isCrypto ? 'ชื่อโบรคเกอร์ / กระเป๋า' : 'ชื่อโบรกเกอร์ (Broker Company)'}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={editBrokerName} 
                    onChange={(e) => setEditBrokerName(e.target.value)} 
                  />
                </div>
              )}

              {/* Region selector for Webull */}
              {isWebull ? (
                <div className="form-group">
                  <label className="form-label">ภูมิภาคบัญชี Webull (Account Region)</label>
                  <select 
                    className="form-input" 
                    value={editServerName} 
                    onChange={(e) => setEditServerName(e.target.value)}
                  >
                    <option value="th">🇹🇭 Webull Thailand (แนะนำ)</option>
                    <option value="us">🇺🇸 Webull United States</option>
                    <option value="sg">🇸🇬 Webull Singapore</option>
                    <option value="hk">🇭🇰 Webull Hong Kong</option>
                    <option value="my">🇲🇾 Webull Malaysia</option>
                  </select>
                </div>
              ) : (
                !isCrypto && (
                  <div className="form-group">
                    <label className="form-label">ชื่อเซิร์ฟเวอร์ (Server Name)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={editServerName} 
                      onChange={(e) => setEditServerName(e.target.value)} 
                    />
                  </div>
                )
              )}

              {isWebull && (
                <>
                  <div className="form-group">
                    <label className="form-label">Webull App Key (ป้อนเพื่อแก้ไข)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="หากไม่ต้องการเปลี่ยน ให้ปล่อยว่างไว้"
                      value={editWebullAppKey} 
                      onChange={(e) => setEditWebullAppKey(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Webull App Secret (ป้อนเพื่อแก้ไข)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="หากไม่ต้องการเปลี่ยน ให้ปล่อยว่างไว้"
                      value={editWebullAppSecret} 
                      onChange={(e) => setEditWebullAppSecret(e.target.value)} 
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">สกุลเงินหลัก (Currency)</label>
                {isStock ? (
                  <select 
                    className="form-input" 
                    value={editCurrency} 
                    onChange={(e) => setEditCurrency(e.target.value)}
                  >
                    <option value="USD">USD (ดอลลาร์สหรัฐ)</option>
                    <option value="THB">THB (บาทไทย)</option>
                  </select>
                ) : (
                  <select 
                    className="form-input" 
                    value={editCurrency} 
                    onChange={(e) => setEditCurrency(e.target.value)}
                  >
                    <option value="USD">USD (ดอลลาร์สหรัฐ)</option>
                    <option value="USC">USC (ดอลลาร์เซ็นต์ - Cent)</option>
                    <option value="EUR">EUR (ยูโร)</option>
                    <option value="EURC">EURC (ยูโรเซ็นต์ - Cent)</option>
                    <option value="THB">THB (บาทไทย)</option>
                  </select>
                )}
                {!isStock && !isCrypto && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    * หากเป็นพอร์ตประเภท Cent แต่โบรกเกอร์รายงานเป็น USD ให้เปลี่ยนเป็น **USC** ระบบจะแปลงกำไรและขนาดพอร์ตกลับเป็นดอลลาร์จริงให้เองเมื่อนำไปคำนวณรวมกัน
                  </span>
                )}
              </div>

              {!isStock && !isCrypto && (
                <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                  <div className="form-group">
                    <label className="form-label">Leverage</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      required 
                      value={editLeverage} 
                      onChange={(e) => setEditLeverage(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">รูปแบบการเชื่อมโยง (Sync Method)</label>
                    <select 
                      className="form-input" 
                      value={editConnectionType} 
                      onChange={(e) => setEditConnectionType(e.target.value)}
                    >
                      <option value="publisher_ea">Publisher EA (น้ำหนักเบา - แนะนำ)</option>
                      <option value="account_sync">Account Sync (ใช้ Investor Password)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>บันทึกการแก้ไข</button>
                  <button type="button" className="btn-secondary" onClick={() => setShowEditAccountModal(false)}>ยกเลิก</button>
                </div>
                
                <button 
                  type="button" 
                  className="btn-logout" 
                  style={{ border: '1px solid var(--error)', background: 'rgba(255, 75, 75, 0.1)', color: 'var(--error)', width: 'auto', padding: '10px 20px' }}
                  onClick={handleDeleteAccount}
                >
                  ลบพอร์ตนี้ออกจากระบบ
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    return (
      <div className="dashboard-layout">
        {page === 'public' ? (
          <>
            <nav className="navbar">
              <a href="/" className="nav-brand">Thankhun<span> trade Jornal</span></a>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
                <Eye size={16} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--accent-secondary)' }} />
                Public View Portfolio
              </div>
            </nav>
            <div className="dashboard-container">
              {renderWorkspaceContent()}
            </div>
          </>
        ) : (
          <div className="app-container">
            {/* Left Sidebar */}
            <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
              <button className="sidebar-logo" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', width: '100%', padding: '0 8px' }}>
                <Database size={22} style={{ color: 'var(--accent-secondary)' }} />
                {!sidebarCollapsed && <span style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 800 }}>Thankhun <span style={{ color: 'var(--accent-secondary)' }}>Tracker</span></span>}
              </button>
              <div className="sidebar-menu">
                <button className={`sidebar-item ${activeTab === 'networth' ? 'active' : ''}`} onClick={() => { setActiveTab('networth'); setSelectedAccountId('all'); }}>
                  <Sliders size={18} />
                  <span className="sidebar-item-text">🏠 ภาพรวมสินทรัพย์</span>
                </button>
                <button className={`sidebar-item ${activeTab === 'forex' ? 'active' : ''}`} onClick={() => {
                  setActiveTab('forex');
                  setSelectedAccountId('all');
                  loadAllAccountsCombinedData(accounts.filter(a => !a.account_type || a.account_type === 'forex'));
                }}>
                  <Activity size={18} />
                  <span className="sidebar-item-text">📈 พอร์ต Forex (MT5)</span>
                </button>
                <button className={`sidebar-item ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => {
                  setActiveTab('stock');
                  const stockAccs = accounts.filter(a => a.account_type === 'stock');
                  if (stockAccs.length > 1) {
                    setSelectedAccountId('all-stock');
                    loadAllStockData();
                  } else if (stockAccs.length === 1) {
                    handleAccountSelect(stockAccs[0].id.toString());
                  } else {
                    setSelectedAccountId('');
                  }
                }}>
                  <BookOpen size={18} />
                  <span className="sidebar-item-text">🇹🇭 พอร์ตหุ้นไทย/ตปท. (Stock)</span>
                </button>
                <button className={`sidebar-item ${activeTab === 'crypto' ? 'active' : ''}`} onClick={() => {
                  setActiveTab('crypto');
                  const cryptoAccs = accounts.filter(a => a.account_type === 'crypto');
                  if (cryptoAccs.length > 1) {
                    setSelectedAccountId('all-crypto');
                    loadAllCryptoData();
                  } else if (cryptoAccs.length === 1) {
                    handleAccountSelect(cryptoAccs[0].id.toString());
                  } else {
                    setSelectedAccountId('');
                  }
                }}>
                  <Wallet size={18} />
                  <span className="sidebar-item-text">🪙 พอร์ตคริปโต (Crypto)</span>
                </button>
              </div>
            </div>

            {/* Main Content Pane */}
            <div className="main-content">
              <nav className="navbar" style={{ borderLeft: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}></div>
                <div className="nav-actions">
                  <div className="nav-user">
                    <User size={16} />
                    <span className="nav-user-text">{user?.full_name}</span>
                  </div>
                  <button className="btn-secondary" style={{ marginRight: '8px', padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', width: 'auto' }} onClick={() => { setShowSettingsModal(true); fetchBackupStatus(); }}>
                    <Cpu size={14} style={{ color: 'var(--accent-secondary)' }} />
                    <span className="nav-btn-text">ตั้งค่าระบบ AI</span>
                  </button>
                  <button className="btn-logout" onClick={handleLogout}>
                    <LogOut size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    <span className="nav-btn-text">ออกจากระบบ</span>
                  </button>
                </div>
              </nav>

              <div className="dashboard-container">
                {renderWorkspaceContent()}
              </div>

              <footer style={{ borderTop: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'auto' }}>
                &copy; 2026 THANKHUN Trade Journal. Powered by FastAPI & React.
              </footer>
            </div>
          </div>
        )}

      {/* Modal 1: Add Account */}
      {showAddAccountModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>เพิ่มพอร์ตการลงทุนใหม่</h3>
            {errorMsg && (
              <div style={{ background: 'var(--error-glow)', color: 'var(--error)', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--error)' }}>
                {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleAddAccount}>
              <div className="form-group">
                <label className="form-label">ประเภทพอร์ต (Asset Class)</label>
                <select className="form-input" value={newAccType} onChange={(e) => {
                  const val = e.target.value;
                  setNewAccType(val);
                  setNewAccCurrency(val === 'stock' ? 'THB' : 'USD');
                  setNewAccBroker(val === 'stock' ? 'SET' : val === 'crypto' ? 'Binance' : '');
                  setNewAccConnType(val === 'forex' ? 'publisher_ea' : 'manual');
                }}>
                  <option value="forex"> Forex (MT5 EA Connection)</option>
                  <option value="stock">🇹🇭 พอร์ตหุ้นไทย/ตปท. (Stock)</option>
                  <option value="crypto">🪙 คริปโตเคอเรนซี (Crypto Wallet / Exchange)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ชื่อเรียกพอร์ต (Friendly Name)</label>
                <input type="text" className="form-input" placeholder={newAccType === 'stock' ? "เช่น พอร์ตหุ้นหลักรับปันผล" : newAccType === 'crypto' ? "เช่น กระเป๋า MetaMask" : "เช่น Gold EA Scalper"} required value={newAccName} onChange={(e) => setNewAccName(e.target.value)} />
              </div>

              {newAccType === 'stock' && (
                <div className="form-group">
                  <label className="form-label">รูปแบบการเชื่อมโยง (Sync Method)</label>
                  <select className="form-input" value={newAccConnType} onChange={(e) => {
                    const connType = e.target.value;
                    setNewAccConnType(connType);
                    if (connType === 'webull_api') {
                      setNewAccCurrency('USD');
                      setNewAccBroker('Webull');
                      setNewAccServer('th');
                    } else {
                      setNewAccCurrency('THB');
                      setNewAccBroker('SET');
                      setNewAccServer('');
                    }
                  }}>
                    <option value="manual">Manual (กรอกข้อมูลเอง)</option>
                    <option value="webull_api">🔌 Webull API (เชื่อมโยงอัตโนมัติ)</option>
                  </select>
                </div>
              )}

              {/* Conditionally render inputs for Webull Stock Account */}
              {newAccType === 'stock' && newAccConnType === 'webull_api' ? (
                <>
                  <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                    <div className="form-group">
                      <label className="form-label">Webull App Key</label>
                      <input type="text" className="form-input" placeholder="ป้อน Webull App Key ที่ได้รับจากเว็บพอร์ทัล" required value={newWebullAppKey} onChange={(e) => setNewWebullAppKey(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Webull App Secret</label>
                      <input type="password" className="form-input" placeholder="ป้อน Webull App Secret" required value={newWebullAppSecret} onChange={(e) => setNewWebullAppSecret(e.target.value)} />
                    </div>
                  </div>

                  <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                    <div className="form-group">
                      <label className="form-label">เลขบัญชี Webull (Account ID / Number)</label>
                      <input type="text" className="form-input" placeholder="ป้อนเลขบัญชี หรือปล่อยว่างให้ระบบอิงบัญชีหลักอัตโนมัติ" value={newAccNumber} onChange={(e) => setNewAccNumber(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ภูมิภาคบัญชี Webull (Account Region)</label>
                      <select className="form-input" value={newAccServer} onChange={(e) => setNewAccServer(e.target.value)}>
                        <option value="th">🇹🇭 Webull Thailand (แนะนำ)</option>
                        <option value="us">🇺🇸 Webull United States</option>
                        <option value="sg">🇸🇬 Webull Singapore</option>
                        <option value="hk">🇭🇰 Webull Hong Kong</option>
                        <option value="my">🇲🇾 Webull Malaysia</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">สกุลเงินหลัก (Currency)</label>
                    <select className="form-input" value={newAccCurrency} onChange={(e) => setNewAccCurrency(e.target.value)}>
                      <option value="USD">USD (หุ้นต่างประเทศ)</option>
                      <option value="THB">THB (หุ้นไทย)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                    <div className="form-group">
                      <label className="form-label">{newAccType === 'crypto' ? 'ที่อยู่กระเป๋า (Wallet / Exchange Name)' : 'เลขบัญชี (Account Number / Login ID)'}</label>
                      <input type="text" className="form-input" placeholder={newAccType === 'crypto' ? "เช่น 0x71C... หรือ Binance" : "เช่น 50821039"} required value={newAccNumber} onChange={(e) => setNewAccNumber(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">สกุลเงินหลัก (Currency)</label>
                      <input type="text" className="form-input" placeholder="USD" required value={newAccCurrency} onChange={(e) => setNewAccCurrency(e.target.value)} />
                    </div>
                  </div>

                  <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                    <div className="form-group">
                      <label className="form-label">{newAccType === 'stock' ? 'ตลาดหลักทรัพย์ / โบรคเกอร์' : newAccType === 'crypto' ? 'โบรคเกอร์ / กระเป๋า' : 'โบรกเกอร์ (Broker Company)'}</label>
                      <input type="text" className="form-input" placeholder={newAccType === 'stock' ? "เช่น SET หรือ InnovestX" : newAccType === 'crypto' ? "เช่น Binance, Solana" : "เช่น Exness"} required value={newAccBroker} onChange={(e) => setNewAccBroker(e.target.value)} />
                    </div>
                    {newAccType === 'forex' && (
                      <div className="form-group">
                        <label className="form-label">ชื่อเซิร์ฟเวอร์ (Server Name)</label>
                        <input type="text" className="form-input" placeholder="เช่น Exness-MT5-Real10" required value={newAccServer} onChange={(e) => setNewAccServer(e.target.value)} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {newAccType === 'forex' && (
                <>
                  <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                    <div className="form-group">
                      <label className="form-label">Leverage</label>
                      <input type="number" className="form-input" placeholder="100" required value={newAccLeverage} onChange={(e) => setNewAccLeverage(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">รูปแบบการเชื่อมโยง (Sync Method)</label>
                      <select className="form-input" value={newAccConnType} onChange={(e) => setNewAccConnType(e.target.value)}>
                        <option value="publisher_ea">Publisher EA (น้ำหนักเบา - แนะนำสำหรับ Notebook)</option>
                        <option value="account_sync">Account Sync (ใช้ Investor Password - ออฟไลน์ซิงค์)</option>
                      </select>
                    </div>
                  </div>

                  {newAccConnType === 'account_sync' && (
                    <div className="form-group">
                      <label className="form-label">Investor Password (รหัสผ่านดูอย่างเดียว)</label>
                      <input type="password" className="form-input" placeholder="ป้อนรหัสผ่านเพื่อให้ระบบซิงค์โดยตรง" required value={newAccPassword} onChange={(e) => setNewAccPassword(e.target.value)} />
                    </div>
                  )}
                </>
              )}


              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-primary">บันทึกบัญชี</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddAccountModal(false)}>ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Connection Guide */}
      {showGuideModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={20} style={{ color: 'var(--accent-secondary)' }} />
              เปิดการซิงค์ข้อมูลด้วย Publisher EA
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              การตั้งค่าซิงค์ด้วย EA จะเป็นวิธีที่มีเสถียรภาพสูงสุดและปลอดภัยที่สุด โดยคุณสามารถดาวน์โหลดและติดตั้ง EA ขนาดเล็กนี้เข้าบนโปรแกรม MetaTrader 5 ของคุณ
            </p>

            <div className="form-group">
              <label className="form-label">รหัสผ่านสำหรับเชื่อมต่อ (Publisher Token)</label>
              <div className="code-snippet">
                {activeGuideToken}
                <button className="copy-btn" onClick={() => handleCopy(activeGuideToken)}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <h4 style={{ fontSize: '1rem', marginTop: '20px', marginBottom: '8px', color: '#fff' }}>ขั้นตอนย่อในการเริ่มรัน:</h4>
            <ol style={{ marginLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>เปิด MT5 แล้วไปที่ <strong>Tools</strong> &rarr; <strong>Options</strong> &rarr; <strong>Expert Advisors</strong> และกดติ๊กเปิด <strong>Allow WebRequest for listed URL:</strong> จากนั้นเพิ่ม <code>{API_BASE_URL}</code> ลงไป</li>
              <li>ดาวน์โหลดไฟล์สคริปต์ <a href={`${API_BASE_URL}/static/JornaltradePublisherEA.ex5`} style={{ color: 'var(--accent-secondary)' }} target="_blank" rel="noreferrer">JornaltradePublisherEA.ex5</a> ไปวางในโฟลเดอร์ <code>MQL5/Experts</code> ของตัว MT5</li>
              <li>เปิดกราฟว่างคู่ใดก็ได้ในโปรแกรม MT5 (เช่น EURUSD) ขึ้นมา 1 ตัว (แยกจากกราฟปกติที่ EA เทรดรันอยู่)</li>
              <li>ลาก EA ตัวนี้ลงกราฟ แล้วใส่ <strong>Publisher Token</strong> ที่ก๊อปปี้ไว้ลงในช่อง Inputs ของตัว EA</li>
              <li>ระบบจะทำการซิงค์ออเดอร์ในอดีตทั้งหมดของพอร์ตขึ้นมาโดยอัตโนมัติภายใน 1 นาที</li>
            </ol>

            <div style={{ marginTop: '28px', textAlign: 'right' }}>
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => setShowGuideModal(false)}>
                ฉันเข้าใจและเสร็จสิ้นขั้นตอนแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Share Link config */}
      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LinkIcon size={20} style={{ color: 'var(--accent-primary)' }} />
              แชร์พอร์ตการเทรดต่อสาธารณะ (Public Share Link)
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              คุณสามารถสร้างลิงก์เปิดเผยเพื่อให้คนอื่นสามารถเข้ามาดูรายงาน แดชบอร์ด และประวัติพอร์ตการเทรดนี้ได้ โดยกำหนดข้อจำกัดสิทธิ์ความลับได้ตามต้องการ
            </p>

            <form onSubmit={handleCreateShareLink}>
              <div className="form-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '2px' }}>แสดงยอดเงินคงเหลือ (Show Balance/Equity)</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>หากปิด ระบบจะแสดงสเกลอัตราเติบโตเป็น % แทนตัวเลขดอลลาร์</span>
                  </div>
                  <input type="checkbox" checked={shareConfig.show_balance} onChange={(e) => setShareConfig({ ...shareConfig, show_balance: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '2px' }}>แสดงเลข Magic Number</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>เผยแพร่รหัสตัวช่วยสำหรับอ้างอิง EA ที่ใช้เปิดออเดอร์</span>
                  </div>
                  <input type="checkbox" checked={shareConfig.show_magic} onChange={(e) => setShareConfig({ ...shareConfig, show_magic: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '2px' }}>แสดงบันทึกข้อความออเดอร์ (Comments)</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>แสดงความคิดเห็นที่ติดมากับออเดอร์ในการเข้าซื้อขาย</span>
                  </div>
                  <input type="checkbox" checked={shareConfig.show_comment} onChange={(e) => setShareConfig({ ...shareConfig, show_comment: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                </div>
              </div>

              {activeShareSlug && (
                <div className="form-group">
                  <label className="form-label">ลิงก์ผลลัพธ์สาธารณะของคุณ</label>
                  <div className="code-snippet" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                    {`${window.location.origin}/p/${activeShareSlug}`}
                    <button type="button" className="copy-btn" onClick={() => handleCopy(`${window.location.origin}/p/${activeShareSlug}`)}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  {activeShareSlug ? 'อัปเดตสิทธิ์การแสดงผล' : 'สร้างลิงก์เผยแพร่'}
                </button>
                {activeShareSlug && (
                  <button type="button" className="btn-logout" style={{ border: '1px solid var(--error)' }} onClick={handleRevokeShareLink}>
                    ยกเลิกการแชร์
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => { setShowShareModal(false); setActiveShareSlug(''); }}>ปิด</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: AI Provider Settings */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={20} style={{ color: 'var(--accent-secondary)' }} />
              ตั้งค่าสรุปข้อมูลและจิตวิทยาการเทรดด้วย AI ตัวจริง
            </h3>
            
            <form onSubmit={saveAiSettings}>
              <div className="form-group">
                <label className="form-label">ผู้ให้บริการ AI (AI Provider)</label>
                <select 
                  className="form-input" 
                  value={aiProvider} 
                  onChange={(e) => {
                    const prov = e.target.value;
                    setAiProvider(prov);
                    if (prov === 'gemini') setAiModel('gemini-2.5-flash');
                    else if (prov === 'openrouter') setAiModel('google/gemma-2-9b-it:free');
                    else if (prov === 'nvidia') setAiModel('nvidia/llama-3.1-nemotron-70b-instruct');
                    else if (prov === 'openai') setAiModel('gpt-4o-mini');
                    else setAiModel('');
                    
                    if (prov === 'openrouter') setAiBaseUrl('https://openrouter.ai/api/v1/chat/completions');
                    else if (prov === 'nvidia') setAiBaseUrl('https://integrate.api.nvidia.com/v1/chat/completions');
                    else if (prov === 'openai') setAiBaseUrl('https://api.openai.com/v1/chat/completions');
                    else setAiBaseUrl('');
                  }}
                >
                  <option value="mock">Virtual Mock (วิเคราะห์เสมือนจริงแบบจำลอง - ฟรี)</option>
                  <option value="gemini">Google Gemini API (แนะนำ - ฟรีโควตาเริ่มต้น)</option>
                  <option value="openrouter">OpenRouter AI API (มีโมเดลให้เลือกฟรีเยอะ)</option>
                  <option value="nvidia">Nvidia NIM API (โควตานักพัฒนาเล่นฟรี)</option>
                  <option value="openai">OpenAI ChatGPT API</option>
                  <option value="custom">ค่ายอื่นๆ / OpenAI Compatible Custom URL</option>
                </select>
              </div>

              {aiProvider !== 'mock' && (
                <>
                  <div className="form-group">
                    <label className="form-label">API Key (รหัสกุญแจเชื่อมต่อ)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="ป้อน API Key สำหรับยืนยันสิทธิ์เข้าใช้" 
                      required 
                      value={aiApiKey} 
                      onChange={(e) => setAiApiKey(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">ชื่อรุ่นโมเดล (Model Name)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="เช่น gemini-2.5-flash หรือ gpt-4o-mini" 
                      required 
                      value={aiModel} 
                      onChange={(e) => setAiModel(e.target.value)} 
                    />
                  </div>

                  {(aiProvider === 'custom' || aiProvider === 'openrouter' || aiProvider === 'nvidia' || aiProvider === 'openai') && (
                    <div className="form-group">
                      <label className="form-label">API Base URL (Custom Endpoint)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="ป้อน URL เซิร์ฟเวอร์ API เช่น https://api.openai.com/v1/chat/completions" 
                        required={aiProvider === 'custom'} 
                        value={aiBaseUrl} 
                        onChange={(e) => setAiBaseUrl(e.target.value)} 
                      />
                    </div>
                  )}
                </>
              )}

              <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />

              <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} style={{ color: 'var(--accent-secondary)' }} />
                ระบบสำรองข้อมูลพอร์ต (Database Backup)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                ดาวน์โหลดข้อมูลประวัติการเทรด พอร์ตและค่าคอนฟิกทั้งหมดของคุณลงเครื่องคอมพิวเตอร์เป็นไฟล์สำรองข้อมูล JSON เพื่อความปลอดภัย
              </p>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  📅 สำรองข้อมูลล่าสุด: <strong style={{ color: lastBackupTime ? 'var(--success)' : 'var(--text-muted)' }}>{lastBackupTime ? new Date(lastBackupTime).toLocaleString('th-TH') : 'ยังไม่มีประวัติการสำรอง'}</strong>
                </div>
                <button type="button" className="btn-secondary" onClick={handleDownloadBackup} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto', background: 'rgba(0, 255, 209, 0.1)', borderColor: 'rgba(0, 255, 209, 0.3)', color: 'var(--accent-secondary)', padding: '8px 14px', fontSize: '0.85rem' }}>
                  <Download size={14} />
                  ดาวน์โหลดไฟล์สำรอง (.json)
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>บันทึกตั้งค่า AI</button>
                <button type="button" className="btn-secondary" onClick={() => setShowSettingsModal(false)}>ปิด</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renderEditAccountModal()}

    </div>
  );
}

export default App;
