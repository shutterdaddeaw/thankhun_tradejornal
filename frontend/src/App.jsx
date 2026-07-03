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
  Edit
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
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
      const res = await fetch(`${API_BASE_URL}/v1/accounts/${selectedAccountId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          account_name: editAccountName,
          broker_name: editBrokerName,
          server_name: editServerName,
          leverage: parseInt(editLeverage),
          connection_type: editConnectionType,
          currency: editCurrency
        })
      });
      if (res.ok) {
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
          // Keep current selection or default to 'all' if there are portfolios
          const exists = data.find(a => a.id.toString() === selectedAccountId) || selectedAccountId === 'all';
          const targetId = exists ? selectedAccountId : 'all';
          setSelectedAccountId(targetId);
          if (targetId === 'all') {
            loadAllAccountsCombinedData(data);
          } else {
            loadAccountData(targetId);
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
      await loadAllAccountsCombinedData(accounts);
      return;
    }
    setIsSyncing(true);
    try {
      // 1. Stats
      const statsRes = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}/dashboard`, { headers: getHeaders() });
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

      // 2. Equity Curve
      const curveRes = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}/equity-curve`, { headers: getHeaders() });
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

      // 3. Calendar PNL
      const calRes = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}/calendar`, { headers: getHeaders() });
      if (calRes.ok) {
        let calData = await calRes.json();
        if (isCent) {
          calData = calData.map(day => ({
            ...day,
            profit: day.profit / 100
          }));
        }
        setCalendarPnl(calData);
      }

      // 4. Open Positions
      const posRes = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}/positions`, { headers: getHeaders() });
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

      // 5. Closed Trades
      const tradesRes = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}/trades`, { headers: getHeaders() });
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

      // 6. Set AI Summary Placeholder
      setAiSummary("### 🤖 บทวิเคราะห์พฤติกรรมการเทรดเชิงจิตวิทยา\n\nระบบดึงสถิติตามช่วงเวลาและ Magic Number เรียบร้อยแล้ว กดปุ่มด้านล่างเพื่อเริ่มเชื่อมต่อและส่งค่าไปให้ระบบ AI ตัวจริงวิเคราะห์ความเสี่ยงและจุดอ่อนของพอร์ตนี้");
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
      const res = await fetch(`${API_BASE_URL}/v1/accounts/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          account_number: newAccNumber,
          broker_name: newAccBroker,
          server_name: newAccServer,
          account_name: newAccName,
          currency: newAccCurrency,
          leverage: parseInt(newAccLeverage),
          connection_type: newAccConnType,
          investor_password: newAccPassword || null
        })
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
        
        // Show guide modal with token
        setActiveGuideToken(data.publisher_token);
        setShowGuideModal(true);
        
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

  // Dashboard & Public Share Views
  return (
    <div className="dashboard-layout">
      {/* Navigation */}
      <nav className="navbar">
        <a href="/" className="nav-brand">Thankhun<span> trade Jornal</span></a>
        
        {page !== 'public' ? (
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
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
            <Eye size={16} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--accent-secondary)' }} />
            Public View Portfolio
          </div>
        )}
      </nav>

      {/* Main Container */}
      <div className="dashboard-container">
        
        {/* Top Control Bar */}
        {page !== 'public' ? (
          <div className="account-selector-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <select 
                className="account-select" 
                value={selectedAccountId} 
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  loadAccountData(e.target.value);
                }}
              >
                {accounts.length > 0 && (
                  <option value="all">📊 สรุปรวมทุกพอร์ต (All Portfolios)</option>
                )}
                {accounts.map(acc => (
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
                  onClick={() => loadAccountData(selectedAccountId)} 
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
                <span className="btn-text">เพิ่มพอร์ต MT5</span>
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

        {dashboardStats ? (
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
                    {accounts.length} พอร์ตเทรดทั้งหมด
                  </span>
                </div>
                
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ชื่อพอร์ต (Account Name)</th>
                        <th>โบรกเกอร์ (Broker)</th>
                        <th>เลขบัญชี (Account No.)</th>
                        <th>ประเภทการเชื่อมต่อ</th>
                        <th>Balance</th>
                        <th>Equity</th>
                        <th>Floating PnL</th>
                        <th>สถานะ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map(acc => (
                        <tr key={acc.id}>
                          <td style={{ fontWeight: '600' }}>{acc.account_name}</td>
                          <td>{acc.broker_name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{acc.account_number}</td>
                          <td>
                            <span className="badge badge-success" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                              {acc.connection_type === 'publisher_ea' ? 'MT5 EA' : 'Broker Direct'}
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
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'auto' }}>
        &copy; 2026 THANKHUN Trade Jornal. Powered by FastAPI & React.
      </footer>

      {/* Modal 1: Add Account */}
      {showAddAccountModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>เพิ่มบัญชีเทรด MT5</h3>
            {errorMsg && (
              <div style={{ background: 'var(--error-glow)', color: 'var(--error)', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--error)' }}>
                {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleAddAccount}>
              <div className="form-group">
                <label className="form-label">ชื่อเรียกบัญชี (Account Friendly Name)</label>
                <input type="text" className="form-input" placeholder="เช่น Gold EA Scalper" required value={newAccName} onChange={(e) => setNewAccName(e.target.value)} />
              </div>

              <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">เลขบัญชี (MT5 Login ID)</label>
                  <input type="text" className="form-input" placeholder="เช่น 50821039" required value={newAccNumber} onChange={(e) => setNewAccNumber(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">สกุลเงินหลัก (Currency)</label>
                  <input type="text" className="form-input" placeholder="USD" required value={newAccCurrency} onChange={(e) => setNewAccCurrency(e.target.value)} />
                </div>
              </div>

              <div className="sections-grid" style={{ gap: '16px', marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">ชื่อโบรกเกอร์ (Broker Company)</label>
                  <input type="text" className="form-input" placeholder="เช่น Exness Technologies Ltd" required value={newAccBroker} onChange={(e) => setNewAccBroker(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">ชื่อเซิร์ฟเวอร์ (Server Name)</label>
                  <input type="text" className="form-input" placeholder="เช่น Exness-MT5-Real10" required value={newAccServer} onChange={(e) => setNewAccServer(e.target.value)} />
                </div>
              </div>

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

      {/* Modal 5: Edit Trading Account */}
      {showEditAccountModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit size={20} style={{ color: 'var(--accent-secondary)' }} />
              แก้ไขข้อมูลพอร์ตเทรด MT5
            </h3>
            
            <form onSubmit={handleEditAccount}>
              <div className="form-group">
                <label className="form-label">ชื่อเรียกบัญชี (Account Friendly Name)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={editAccountName} 
                  onChange={(e) => setEditAccountName(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">ชื่อโบรกเกอร์ (Broker Company)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={editBrokerName} 
                  onChange={(e) => setEditBrokerName(e.target.value)} 
                />
              </div>

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

              <div className="form-group">
                <label className="form-label">สกุลเงินหลัก (Currency)</label>
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  * หากเป็นพอร์ตประเภท Cent แต่โบรกเกอร์รายงานเป็น USD ให้เปลี่ยนเป็น **USC** ระบบจะแปลงกำไรและขนาดพอร์ตกลับเป็นดอลลาร์จริงให้เองเมื่อนำไปคำนวณรวมกัน
                </span>
              </div>

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
      )}
    </div>
  );
}

export default App;
