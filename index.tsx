import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Search, 
  User, 
  CreditCard, 
  Calendar, 
  PhilippinePeso, 
  AlertCircle, 
  TrendingUp, 
  X,
  Database,
  FileText,
  Copy,
  Check,
  Clock,
  RefreshCw,
  Loader2,
  ArrowRight
} from 'lucide-react';

// --- Configuration ---
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1LeItO1yk-j5V5FoTvbFQtd8AKszYGZf4DfAROyeY7hl1jmxPieLYdjHxQMsz6oRx8ke-sDWh69xa/pub?output=csv';

// --- Types ---

interface Member {
  accountName: string;
  accountNumber: string;
  nextDueDate: string;
  nextDueAmount: string;
  bps: string;
  overdueAmount: string;
}

// --- Formatting Helpers ---

const formatPeso = (amount: string | number) => {
  if (amount === undefined || amount === null) return '₱0.00';
  
  const val = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) 
    : amount;
  
  if (isNaN(val)) return '₱0.00';
  
  return '₱' + new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === 'N/A' || dateStr.trim() === '') return 'N/A';
  const cleanStr = dateStr.replace(/[^0-9]/g, '');
  if (cleanStr.length === 8 && /^\d{8}$/.test(cleanStr)) {
    const y = cleanStr.substring(0, 4);
    const m = cleanStr.substring(4, 6);
    const d = cleanStr.substring(6, 8);
    return `${m}/${d}/${y}`;
  }
  return dateStr;
};

// --- Helper: Robust CSV Parser ---

const parseCSV = (text: string): { members: Member[], sheetUpdateDate: string } => {
  const cleanText = text.replace(/^\uFEFF/, '');
  const allLines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (allLines.length < 1) return { members: [], sheetUpdateDate: 'N/A' };

  const splitRow = (row: string) => {
    const result: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' && row[i+1] === '"' && inQuotes) {
        cell += '"';
        i++; 
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell.trim());
    return result;
  };

  // Extract A1 cell value as the Sheet Update Date
  const firstRow = splitRow(allLines[0]);
  const sheetUpdateDate = firstRow[0] || 'N/A';

  const keywords = {
    accountName: ['accountname', 'membername', 'customername', 'name', 'client', 'fullname', 'member', 'subscriber'],
    accountNumber: ['accountnumber', 'accountno', 'accnum', 'id', 'memberid', 'acc#', 'account#', 'member#', 'ref'],
    nextDueDate: ['nextduedate', 'duedate', 'nextdue', 'billingdate', 'expiry', 'due'],
    nextDueAmount: ['nextdueamount', 'dueamount', 'amountdue', 'balance', 'totaldue', 'payable'],
    bps: ['bps', 'brochuresales', 'sales', 'salesvolume', 'volume', 'commission'],
    overdueAmount: ['overdueamount', 'overdue', 'pastdue', 'arrears', 'delinquent', 'latefee']
  };

  let headerRowIndex = 0;
  let maxScore = -1;
  // Search through first 10 rows for headers, starting from index 0 or 1
  for (let i = 0; i < Math.min(allLines.length, 10); i++) {
    const row = splitRow(allLines[i]).map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
    let score = 0;
    Object.values(keywords).flat().forEach(k => {
      if (row.some(cell => cell.includes(k.replace(/[^a-z0-9]/g, '')))) score++;
    });
    if (score > maxScore) {
      maxScore = score;
      headerRowIndex = i;
    }
  }

  const rawHeaders = splitRow(allLines[headerRowIndex]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findIndex = (kList: string[]) => {
    const exact = headers.findIndex(h => kList.some(k => h === k.replace(/[^a-z0-9]/g, '')));
    if (exact !== -1) return exact;
    return headers.findIndex(h => kList.some(k => h.includes(k.replace(/[^a-z0-9]/g, ''))));
  };

  const indices = {
    accountName: findIndex(keywords.accountName) !== -1 ? findIndex(keywords.accountName) : 0,
    accountNumber: findIndex(keywords.accountNumber) !== -1 ? findIndex(keywords.accountNumber) : 1,
    nextDueDate: findIndex(keywords.nextDueDate),
    nextDueAmount: findIndex(keywords.nextDueAmount),
    bps: findIndex(keywords.bps),
    overdueAmount: findIndex(keywords.overdueAmount)
  };

  const members = allLines.slice(headerRowIndex + 1).map(line => {
    const values = splitRow(line);
    const getVal = (idx: number) => (idx >= 0 && values[idx] !== undefined) ? values[idx] : '';
    return {
      accountName: getVal(indices.accountName) || 'N/A',
      accountNumber: getVal(indices.accountNumber) || 'N/A',
      nextDueDate: getVal(indices.nextDueDate) || 'N/A',
      nextDueAmount: getVal(indices.nextDueAmount) || '0.00',
      bps: getVal(indices.bps) || '0.00',
      overdueAmount: getVal(indices.overdueAmount) || '0.00'
    };
  });

  return { members, sheetUpdateDate };
};

// --- Components ---

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const MemberCard = ({ member }: { member: Member }) => {
  const overdueVal = parseFloat(member.overdueAmount.replace(/[^0-9.-]+/g,""));
  const isOverdue = !isNaN(overdueVal) && overdueVal > 0;
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{member.accountName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acc No.</span>
              <span className="font-mono text-sm font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded flex items-center gap-2">
                {member.accountNumber}
                <CopyButton text={member.accountNumber} />
              </span>
            </div>
          </div>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 border ${isOverdue ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
          <div className={`h-2 w-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></div>
          {isOverdue ? 'OVERDUE' : 'CURRENT'}
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Due Date</div>
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <Calendar size={14} className="text-indigo-400" />
            {formatDate(member.nextDueDate)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Due Amount</div>
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <PhilippinePeso size={14} className="text-indigo-400" />
            {formatPeso(member.nextDueAmount)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Brochure Sales (BPS)</div>
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            {formatPeso(member.bps)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Overdue Amount</div>
          <div className={`font-black flex items-center gap-2 ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
            <AlertCircle size={14} className={isOverdue ? 'text-red-400' : 'text-slate-400'} />
            {formatPeso(member.overdueAmount)}
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [data, setData] = useState<Member[]>([]);
  const [lastSync, setLastSync] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL + '&cache_bust=' + Date.now());
      if (!response.ok) throw new Error('Failed to fetch Google Sheet data');
      const text = await response.text();
      const { members, sheetUpdateDate } = parseCSV(text);
      if (members.length > 0) {
        setData(members);
        setLastSync(sheetUpdateDate);
        localStorage.setItem('member_db_data_cloud', JSON.stringify({ members, lastSync: sheetUpdateDate }));
      }
    } catch (error) {
      console.error(error);
      const saved = localStorage.getItem('member_db_data_cloud');
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed.members);
        setLastSync(parsed.lastSync);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    
    const numericQuery = query.replace(/[^0-9]/g, '');
    
    return data.filter(m => {
      const name = m.accountName.toLowerCase();
      const num = m.accountNumber.toLowerCase();
      
      const matchesName = name.includes(query);
      const matchesNumRaw = num.includes(query);
      const matchesNumNumeric = numericQuery.length > 0 && num.replace(/[^0-9]/g, '').includes(numericQuery);
      
      return matchesName || matchesNumRaw || matchesNumNumeric;
    }).slice(0, 50);
  }, [data, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 min-h-screen flex flex-col">
      {/* Header Info Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Member Lookup</h1>
            <div className="flex items-center gap-3 mt-1 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              {lastSync ? (
                <>
                  <Clock size={12} className="text-indigo-500" />
                  Last Update: {lastSync}
                </>
              ) : loading ? (
                <>Syncing with Google Sheets...</>
              ) : (
                <>Database disconnected</>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            disabled={loading}
            onClick={fetchData}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            {loading ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      <main className="flex-grow space-y-12">
        {/* Search Section */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-3xl relative group">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className="text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={28} />
            </div>
            <input 
              ref={searchInputRef}
              type="text"
              autoComplete="off"
              spellCheck="false"
              placeholder="Search by name or account number..."
              className="block w-full pl-16 pr-[120px] py-6 bg-white border border-slate-200 rounded-[2rem] shadow-2xl focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all text-2xl font-medium text-slate-900 placeholder:text-slate-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              )}
              <button 
                onClick={() => searchInputRef.current?.focus()}
                className="bg-indigo-600 text-white p-3 rounded-full shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
          {data.length > 0 && (
            <div className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Searching {data.length.toLocaleString()} Active Member Records
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="space-y-6">
          {loading && data.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Initial database sync in progress...</p>
            </div>
          ) : searchQuery && filteredMembers.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 pb-20">
              <div className="flex justify-between items-center px-4">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Found {filteredMembers.length} Matching Records</h2>
              </div>
              {filteredMembers.map((member, i) => (
                <MemberCard key={`${member.accountNumber}-${i}`} member={member} />
              ))}
            </div>
          ) : searchQuery && data.length > 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="p-6 bg-slate-100 text-slate-300 rounded-full mb-6">
                <Search size={64} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">No matching members</h3>
              <p className="text-slate-500 max-w-xs">Double check the spelling or try searching by account number.</p>
            </div>
          ) : !searchQuery && data.length > 0 ? (
            <div className="py-20 flex flex-col items-center text-center opacity-50 select-none">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-indigo-500 blur-[80px] opacity-10 animate-pulse"></div>
                <div className="relative h-40 w-40 bg-white rounded-[3rem] shadow-2xl border border-slate-100 flex items-center justify-center">
                  <RefreshCw size={80} className="text-slate-100 animate-spin-slow" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Cloud Database Connected</h3>
              <p className="text-slate-500 max-w-sm text-lg leading-relaxed">Search member records sourced directly from your Google Sheet.</p>
            </div>
          ) : !loading && data.length === 0 && (
            <div className="py-20 flex flex-col items-center text-center">
               <div className="p-8 bg-red-50 text-red-200 rounded-[2.5rem] mb-8">
                <AlertCircle size={80} />
               </div>
               <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Connection Error</h3>
               <p className="text-slate-500 max-w-md text-lg mb-10">We couldn't reach the Google Sheet database. Please check the public visibility of your sheet.</p>
               <button onClick={fetchData} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100">Retry Connection</button>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-20 pt-10 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
          &copy; 2025 CLOUD SYNC ENGINE v3.2
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-[8px]">SOURCE: GOOGLE SHEETS</div>
        </div>
      </footer>
    </div>
  );
};

// --- Styles ---

const style = document.createElement('style');
style.textContent = `
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow {
    animation: spin-slow 12s linear infinite;
  }
`;
document.head.appendChild(style);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);