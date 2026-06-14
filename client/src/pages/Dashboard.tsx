import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

// --- LUCIDE ICONS ---
import { Settings, Lock, X, ChevronDown, CheckCircle, Link as LinkIcon, Github, Code2, AlertTriangle, History, BookOpen, Copy, Download, FileCode, SearchCode, Play, Menu, Plus, ShieldCheck, Terminal, Scale, Sword, Server, Key, Eye, EyeOff } from 'lucide-react';

// --- BRANDING ASSETS ---
import LogoPro from '../assets/logo-pro.png';
import IconPro from '../assets/icon-pro.png';
import LegalFooter from '../components/LegalFooter';

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================
interface AuditResult {
  score: number;
  summary: string;
  invariants?: { id: string, description: string }[];
  critical: any[];
  high: any[];
  medium: any[];
  gas: any[];
}

interface HistoryItem {
  id: string;
  score: number;
  method: string;
  timestamp: any;
  title: string;
  resultUrl?: string;
  result?: AuditResult; 
}

// ============================================================================
// CONSTANTS
// ============================================================================
const DEMO_CONTRACT = `// --- SENTIAL DEMO: REENTRANCY EXPLOIT ---
pragma solidity ^0.8.0;

contract VulnerableVault {
    mapping(address => uint) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint bal = balances[msg.sender];
        require(bal > 0, "Insufficient balance");
        
        // VULNERABILITY: External call before state update
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Failed to send Ether");
        
        balances[msg.sender] = 0;
    }
}`;

export default function Dashboard() {
  const navigate = useNavigate();

  // --- CORE UI STATE ---
  const [step, setStep] = useState<'scanner' | 'analyzing' | 'results' | 'settings' | 'history' | 'docs'>('scanner');
  const [auditMethod, setAuditMethod] = useState<'code' | 'address' | 'github'>('code');
  const [isDeepScanEnabled, setIsDeepScanEnabled] = useState(false);
  
  // --- RESPONSIVE SIDEBAR STATE ---
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // --- INGESTION STATE ---
  const [contractCode, setContractCode] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  
  // --- LOCAL API KEY VAULT ---
  const [apiKeys, setApiKeys] = useState({
    gemini: localStorage.getItem('sential_key_gemini') || '',
    deepseek: localStorage.getItem('sential_key_deepseek') || '',
    minimax: localStorage.getItem('sential_key_minimax') || '',
    groq: localStorage.getItem('sential_key_groq') || '',
    anthropic: localStorage.getItem('sential_key_anthropic') || '',
    zhipu: localStorage.getItem('sential_key_zhipu') || '',
    etherscan: localStorage.getItem('sential_key_etherscan') || ''
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // --- SYSTEM STATE ---
  const [isExporting, setIsExporting] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [alertConfig, setAlertConfig] = useState<{show: boolean, message: string, action?: () => void, actionText?: string}>({show: false, message: ''});
  
  // --- LIVE TELEMETRY STATE ---
  const [terminalLogs, setTerminalLogs] = useState<{prefix: string, message: string}[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC ---
  const activeLogo = LogoPro;
  const activeIcon = IconPro;
  
  const showAlert = (message: string, action?: () => void, actionText?: string) => setAlertConfig({show: true, message, action, actionText});
  const hideAlert = () => setAlertConfig({show: false, message: ''});

  // --- EFFECTS ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    const handleAfterPrint = () => setIsExporting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (step === 'analyzing' && terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, step]);

  // Load History from Local Storage
  useEffect(() => {
    const savedHistory = localStorage.getItem('sential_history');
    if (savedHistory) {
      setHistoryItems(JSON.parse(savedHistory));
    }
  }, []);

  // --- HANDLERS ---
  const handleKeyChange = (provider: keyof typeof apiKeys, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    localStorage.setItem(`sential_key_${provider}`, value);
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const saveToHistory = (result: AuditResult, method: string, title: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      score: result.score,
      method: method,
      timestamp: { seconds: Math.floor(Date.now() / 1000) },
      title: title,
      result: result
    };
    const updatedHistory = [newItem, ...historyItems].slice(0, 50); // Keep last 50 scans locally
    setHistoryItems(updatedHistory);
    localStorage.setItem('sential_history', JSON.stringify(updatedHistory));
  };

  const loadPastAudit = async (historyItem: HistoryItem) => {
    if (historyItem.result) {
      setAuditResult(historyItem.result);
      setStep('results');
    } else {
      showAlert("Detailed report data not found for this older audit.");
    }
  };

  const handleRunAudit = async () => {
    if (step === 'analyzing') return;

    // Check if at least ONE LLM API key is provided
    const hasLlmKey = apiKeys.gemini || apiKeys.deepseek || apiKeys.minimax || apiKeys.groq || apiKeys.anthropic || apiKeys.zhipu;
    if (!hasLlmKey) {
        setStep('settings');
        return showAlert("Configuration Required: Please configure at least one API key in Settings before running a scan.");
    }

    let payload = { code: "", type: auditMethod, deepScan: isDeepScanEnabled }; 
    let auditTitle = "Unknown Target";
    
    if (auditMethod === 'code') {
      if (!contractCode.trim()) return showAlert("Please paste your Solidity code first.");
      payload.code = contractCode;
      auditTitle = "Raw Solidity Scan";
    } else if (auditMethod === 'address') {
      if (!contractAddress.trim()) return showAlert("Please enter a valid Ethereum Contract Address.");
      if (!apiKeys.etherscan) return showAlert("An Etherscan API Key is required to fetch contracts by address. Please add it in Settings.");
      payload.code = contractAddress;
      auditTitle = `Contract: ${contractAddress.slice(0,6)}...${contractAddress.slice(-4)}`;
    } else if (auditMethod === 'github') {
      if (!githubUrl.trim()) return showAlert("Please explicitly type the repository (e.g., blockvia/sential).");
      payload.code = githubUrl; 
      auditTitle = `Repo: ${githubUrl}`;
    }

    setTerminalLogs([]);
    setStep('analyzing');

    try {
      // Build Headers dynamically from Local Storage Keys
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKeys.gemini) headers['x-api-key-gemini'] = apiKeys.gemini;
      if (apiKeys.deepseek) headers['x-api-key-deepseek'] = apiKeys.deepseek;
      if (apiKeys.minimax) headers['x-api-key-minimax'] = apiKeys.minimax;
      if (apiKeys.groq) headers['x-api-key-groq'] = apiKeys.groq;
      if (apiKeys.anthropic) headers['x-api-key-anthropic'] = apiKeys.anthropic;
      if (apiKeys.zhipu) headers['x-api-key-zhipu'] = apiKeys.zhipu;
      if (apiKeys.etherscan) headers['x-api-key-etherscan'] = apiKeys.etherscan;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/audit/stream`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Server connection failed.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Stream initialization failed.");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n'); 

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              if (eventData.type === 'log') {
                setTerminalLogs(prev => [...prev, eventData.data]);
              } 
              else if (eventData.type === 'complete') {
                const finalData = eventData.data;
                setAuditResult(finalData);
                saveToHistory(finalData, auditMethod, auditTitle);
                setStep('results');
              } 
              else if (eventData.type === 'error') {
                // Break loading loop if fatal backend error
                if (eventData.data.fatal) {
                   setStep('scanner');
                   showAlert(eventData.data.message);
                   return;
                }
                throw new Error(eventData.data.message);
              }
            } catch (parseError: any) {
              // Ignore partial JSON parse errors in stream
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Audit Stream Failed:", error);
      showAlert(error.message || "Audit Failed. Please verify your API Keys and local server connection.");
      setStep('scanner');
    }
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setContractCode(event.target?.result as string);
      reader.readAsText(file);
    }
  };

  const resetApp = () => {
    setContractCode(''); setContractAddress(''); setGithubUrl(''); setAuditResult(null); setStep('scanner');
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
        const element = document.getElementById('audit-report-container');
        if (!element) {
            setIsExporting(false);
            return showAlert("Critical Error: Report container failed to mount.");
        }

        const opt = {
            margin:       [0.4, 0.4, 0.4, 0.4], 
            filename:     `Sential_Consensus_Report_${Date.now()}.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#0A0D14', windowWidth: 1024 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'], avoid: '.break-inside-avoid' } 
        };

        html2pdf().set(opt).from(element).save().then(() => {
            setIsExporting(false); 
        }).catch((err: any) => {
            console.error("PDF Engine Failure:", err);
            setIsExporting(false);
            showAlert("Failed to generate PDF. Please try again.");
        });
    }, 500); 
  };


  // ============================================================================
  // RENDER CONTENT
  // ============================================================================
  const renderMainContent = () => {
    
    // --- PART 1: THE SCANNER ---
    if (step === 'scanner') {
      return (
        <div className="flex-1 flex flex-col items-center justify-start p-4 pt-8 md:p-12 md:pt-16 animate-in fade-in duration-500 max-w-[1000px] mx-auto w-full min-w-0">
          
          <div className="w-full flex justify-end mb-4">
             <div className="px-4 py-1.5 rounded-full border border-[var(--accent)] text-[var(--accent)] bg-[rgba(0,194,255,0.1)] text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 shadow-lg">
               <ShieldCheck size={14}/> Sential Local Engine
             </div>
          </div>

          <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end mb-[32px] md:mb-[40px] border-b border-[var(--border-subtle)] pb-4 md:pb-6 gap-2 md:gap-0">
            <div>
              <h2 className="text-[24px] md:text-[32px] font-medium tracking-tight text-[var(--text-1)] mb-1 md:mb-2">New Consensus Scan</h2>
              <p className="text-[13px] md:text-[15px] text-[var(--text-2)] font-light">Select ingestion method to initialize semantic RAG parsing.</p>
            </div>
          </div>

          <div className="w-full bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] rounded-[16px] md:rounded-[24px] p-[20px] md:p-[32px] shadow-sm flex flex-col gap-[24px] md:gap-[32px] min-w-0">
            
            <div className="flex flex-col gap-3 w-full">
              <span className="text-[11px] md:text-[12px] font-bold tracking-[0.08em] text-[var(--text-3)] uppercase">1. Ingestion Method</span>
              <div className="grid grid-cols-2 md:flex md:flex-wrap gap-[6px] md:gap-[8px] bg-[var(--bg-surface-2)] p-1.5 rounded-[12px] border border-[var(--border-default)] w-full md:w-fit">
                {[
                  { id: 'code', label: 'Raw Solidity' },
                  { id: 'address', label: 'Etherscan URL' },
                  { id: 'github', label: 'Public Repo' }
                ].map((method) => (
                  <div 
                    key={method.id} 
                    onClick={() => setAuditMethod(method.id as any)}
                    className={`relative text-[12px] md:text-[14px] font-medium px-[12px] md:px-[20px] py-[10px] rounded-[8px] cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap
                      ${auditMethod === method.id ? 'bg-[var(--bg-surface-4)] text-[var(--text-1)] shadow-md' : 'text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--bg-surface-3)]'}
                    `}
                  >
                    {method.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full min-w-0">
              <span className="text-[11px] md:text-[12px] font-bold tracking-[0.08em] text-[var(--text-3)] uppercase">2. Target Configuration</span>
              
              <div className="w-full relative transition-all duration-500 min-w-0">
                {auditMethod === 'code' && (
                  <div className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[12px] md:rounded-[16px] overflow-hidden flex flex-col focus-within:border-[var(--border-strong)] transition-colors shadow-inner w-full min-w-0">
                    <div className="bg-[var(--bg-surface-3)] border-b border-[var(--border-subtle)] px-[16px] md:px-[20px] py-[12px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <span className="text-[11px] md:text-[12px] text-[var(--text-3)] font-mono flex items-center gap-2 shrink-0"><FileCode size={14}/> contract.sol</span>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 shrink-0 w-full sm:w-auto">
                        <button 
                          onClick={() => setContractCode(DEMO_CONTRACT)} 
                          className="text-[10px] md:text-[11px] font-bold tracking-widest uppercase text-[var(--accent)] hover:text-[var(--text-1)] transition-colors flex items-center gap-1.5 bg-[var(--accent-dim)] px-2 md:px-3 py-1.5 rounded-md flex-1 sm:flex-none justify-center"
                        >
                          <AlertTriangle size={12}/> Load Demo
                        </button>
                        <span className="text-[var(--border-strong)] hidden sm:block">|</span>
                        <button onClick={() => fileInputRef.current?.click()} className="text-[11px] md:text-[12px] font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors bg-[var(--bg-surface-4)] sm:bg-transparent px-3 py-1.5 rounded-md sm:px-0 sm:py-0 flex-1 sm:flex-none text-center border border-[var(--border-default)] sm:border-none">Upload File</button>
                        <input type="file" accept=".sol" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                      </div>
                    </div>
                    <textarea value={contractCode} onChange={(e) => setContractCode(e.target.value)} placeholder="// Paste your Solidity code here..." className="w-full h-[300px] md:h-[400px] bg-transparent text-[var(--text-1)] font-mono text-[13px] md:text-[14px] p-[16px] md:p-[24px] resize-none focus:outline-none leading-loose custom-scrollbar min-w-0" spellCheck={false}></textarea>
                  </div>
                )}

                {auditMethod === 'address' && (
                  <div className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[12px] md:rounded-[16px] p-[24px] md:p-[32px] flex flex-col items-center shadow-inner w-full min-h-[250px] justify-center">
                    <div className="w-[48px] h-[48px] md:w-[64px] md:h-[64px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full flex items-center justify-center mb-[20px] md:mb-[24px] shrink-0">
                      <SearchCode className="text-[var(--text-2)]" size={20} />
                    </div>
                    <p className="text-[var(--text-2)] mb-[20px] md:mb-[24px] text-center text-[13px] md:text-[15px] max-w-md w-full px-2">
                      Enter a verified Ethereum contract address to pull directly from the blockchain.
                    </p>
                    <input type="text" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} placeholder="0x..." className="w-full max-w-[500px] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[10px] md:rounded-[12px] px-[16px] md:px-[24px] py-[14px] md:py-[16px] text-[var(--text-1)] font-mono focus:border-[var(--accent)] focus:outline-none transition-colors text-[13px] md:text-[14px] shadow-inner" />
                  </div>
                )}

                {auditMethod === 'github' && (
                  <div className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[12px] md:rounded-[16px] p-[24px] md:p-[32px] flex flex-col items-center text-center shadow-inner w-full min-h-[250px] justify-center">
                    <div className="w-[48px] h-[48px] md:w-[64px] md:h-[64px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full flex items-center justify-center mb-[20px] md:mb-[24px] shrink-0">
                      <Github className="text-[var(--text-2)]" size={20} />
                    </div>
                    
                    <div className="w-full flex flex-col items-center">
                      <p className="text-[var(--text-2)] mb-[20px] md:mb-[24px] max-w-md text-[13px] md:text-[15px]">Enter the public GitHub repository you want to scan (e.g. <code>owner/repo</code>).</p>
                      
                      <input type="text" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="blockvia/sential" className="w-full max-w-[500px] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[10px] md:rounded-[12px] px-[16px] md:px-[24px] py-[14px] md:py-[16px] text-[var(--text-1)] font-mono focus:border-[var(--accent)] focus:outline-none transition-colors text-[13px] md:text-[14px] shadow-inner mb-4" />

                      <div className="w-full max-w-[500px] flex items-center justify-between mt-2 bg-[var(--bg-surface-1)] border border-[var(--border-default)] p-4 rounded-xl text-left">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-bold text-[var(--text-1)] flex items-center gap-2"><ShieldCheck size={16} className="text-[#B066FF]"/> Deep Supply Chain Scan</span>
                          <span className="text-[12px] text-[var(--text-3)] mt-1">Include node_modules & lib/ to detect malicious dependency injections.</span>
                        </div>
                        <div 
                          onClick={() => setIsDeepScanEnabled(!isDeepScanEnabled)}
                          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out shrink-0 ${isDeepScanEnabled ? 'bg-[#34C759]' : 'bg-[var(--bg-surface-3)] border border-[var(--border-strong)]'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDeepScanEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-[24px] border-t border-[var(--border-subtle)] w-full shrink-0 flex flex-col gap-4">
              <button 
                onClick={handleRunAudit} 
                disabled={step === 'analyzing'}
                className={`w-full h-[50px] md:h-[56px] rounded-[10px] md:rounded-[12px] font-semibold text-[15px] md:text-[16px] text-[var(--bg-base)] bg-[var(--accent)] transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group relative shrink-0 shadow-lg
                  ${(contractCode.length > 0 || contractAddress.length > 0 || githubUrl.length > 0) ? 'hover:scale-[1.01] active:scale-[0.98]' : 'bg-[var(--bg-surface-3)] text-[var(--text-3)] cursor-not-allowed border border-[var(--border-strong)] opacity-50'}
                `}
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.2)] to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                <span className="relative z-10 flex items-center gap-2"><Play size={16} fill="currentColor" /> Initialize Security Invariant Mapping</span>
              </button>
            </div>

          </div>
        </div>
      );
    }

    // --- PART 2: THE HACKER TERMINAL UI ---
    if (step === 'analyzing') {
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 w-full animate-in fade-in">
             <div className="w-full max-w-[1000px] bg-[#0A0D14] border border-[var(--border-strong)] rounded-2xl shadow-[0_0_50px_rgba(0,194,255,0.05)] overflow-hidden flex flex-col h-[65vh] min-h-[450px]">
                
                {/* Terminal Header */}
                <div className="bg-[#111622] border-b border-[var(--border-strong)] px-4 py-3 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FF3B30] border border-[rgba(255,59,48,0.5)]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#FFB800] border border-[rgba(255,184,0,0.5)]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#34C759] border border-[rgba(52,199,89,0.5)]"></div>
                   </div>
                   <div className="flex items-center gap-2 text-[var(--text-3)] font-mono text-[11px] md:text-[12px] uppercase tracking-widest">
                     <Terminal size={14} /> Sential_Local_Telemetry
                   </div>
                </div>

                {/* Terminal Body */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto font-mono text-[12px] md:text-[14px] leading-relaxed custom-scrollbar flex flex-col gap-3">
                   {terminalLogs.map((log, i) => {
                      let colorClass = 'text-gray-400';
                      if (log.prefix === 'SYS') colorClass = 'text-[#00C2FF]';
                      if (log.prefix === 'ROUTER') colorClass = 'text-[#B066FF]';
                      if (log.prefix === 'AGENT') colorClass = 'text-[#34C759]';
                      if (log.prefix === 'ERROR') colorClass = 'text-[#FF3B30]';

                      return (
                        <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <span className={`font-bold mr-3 ${colorClass}`}>[{log.prefix}]</span>
                           <span className="text-gray-300">{log.message}</span>
                        </div>
                      )
                   })}
                   
                   <div className="flex items-center gap-2 mt-2 text-[#34C759] opacity-80">
                      <span className="w-2.5 h-4 bg-[#34C759] animate-pulse"></span>
                   </div>
                   <div ref={terminalEndRef} />
                </div>
             </div>
          </div>
        );
    }

   // --- PART 3: THE REPORT / RESULTS ---
   if (step === 'results' && auditResult) {
        const scorePercentage = (auditResult.score / 10) * 100;
        return (
          <div id="audit-report-container" className={`flex-1 flex flex-col items-center justify-start w-full min-w-0 mx-auto animate-in slide-in-from-bottom-10 duration-700 bg-[var(--bg-base)] ${isExporting ? 'max-w-none p-6 md:p-12' : 'max-w-[1100px] p-4 pt-8 md:p-12'}`}>
            
            <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end mb-[32px] md:mb-[48px] border-b border-[var(--border-subtle)] pb-[24px] md:pb-[32px] gap-4 md:gap-0 shrink-0">
              <div>
                <div className="flex items-center gap-[10px] md:gap-[12px] mb-[8px] md:mb-[16px]">
                  <div className="w-2 h-2 rounded-full bg-[var(--low)] shadow-[0_0_8px_rgba(52,199,89,0.8)] animate-pulse shrink-0"></div>
                  <span className="text-[10px] md:text-[11px] font-bold tracking-[0.15em] text-[var(--text-3)] uppercase">Audit Complete</span>
                </div>
                <h2 className="font-display text-[32px] md:text-[48px] tracking-[-0.02em] text-[var(--text-1)] leading-none">Consensus Report.</h2>
              </div>
              
              {!isExporting && (
                <div className="flex items-center gap-[12px] md:gap-[20px] w-full md:w-auto shrink-0">
                  <button onClick={handleExportPDF} className="flex-1 md:flex-none text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.08em] text-[#D2AC47] hover:text-white transition-colors flex items-center justify-center gap-2 bg-[rgba(210,172,71,0.1)] border border-[rgba(210,172,71,0.3)] px-[16px] md:px-[20px] py-[10px] rounded-[8px] hover:bg-[#D2AC47] shadow-[0_0_15px_rgba(210,172,71,0.2)] whitespace-nowrap">
                    <Download size={14} className="md:w-4 md:h-4" /> Export
                  </button>
                  <button onClick={resetApp} className="flex-1 md:flex-none text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors bg-[var(--bg-surface-2)] border border-[var(--border-default)] px-[16px] md:px-[20px] py-[10px] rounded-[8px] whitespace-nowrap text-center">New Scan</button>
                </div>
              )}
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-3 gap-[32px] md:gap-[48px] w-full mb-[40px] md:mb-[64px] bg-[var(--bg-surface-1)] rounded-[20px] md:rounded-[24px] p-[24px] md:p-[40px] shrink-0 ${isExporting ? 'border-none' : 'border border-[var(--border-subtle)] shadow-sm'}`}>
               <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[var(--border-subtle)] pb-8 md:pb-0">
                  <div className="relative w-[140px] h-[140px] md:w-[180px] md:h-[180px] flex items-center justify-center shrink-0">
                     <svg className="absolute inset-0 w-full h-full transform rotate-[130deg]" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-surface-3)" strokeWidth="3" strokeDasharray="226 314" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke={auditResult.score < 5 ? "var(--critical)" : auditResult.score < 8 ? "var(--medium)" : "var(--low)"} strokeWidth="4" strokeDasharray={`${(scorePercentage / 100) * 226} 314`} strokeLinecap="round" className="animate-drawArc drop-shadow-[0_0_8px_currentColor]" />
                     </svg>
                     <div className="flex flex-col items-center mt-2 md:mt-3">
                        <span className="font-display text-[48px] md:text-[64px] leading-none text-[var(--text-1)] tracking-tight">{auditResult.score}</span>
                        <span className="text-[12px] md:text-[14px] text-[var(--text-3)] font-mono mt-1">/ 10</span>
                     </div>
                  </div>
                  <h3 className="text-[10px] md:text-[11px] font-bold text-[var(--text-3)] mt-[20px] md:mt-[24px] tracking-[0.15em] uppercase text-center">Security Score</h3>
               </div>
               
               <div className="md:col-span-2 flex flex-col justify-center min-w-0">
                 <span className="text-[10px] md:text-[11px] font-bold text-[var(--text-3)] mb-[12px] md:mb-[16px] tracking-[0.15em] uppercase text-center md:text-left">Executive Summary</span>
                 <div className="text-[var(--text-1)] font-normal leading-[1.6] md:leading-[1.8] text-[14px] md:text-[16px] text-center md:text-left break-words">
                   {auditResult.summary}
                 </div>
               </div>
            </div>

            {auditResult.invariants && auditResult.invariants.length > 0 && (
              <div className={`w-full flex flex-col gap-[16px] mb-[40px] md:mb-[64px] min-w-0 ${isExporting ? '' : ''}`}>
                 <h3 className="text-[14px] md:text-[16px] font-bold text-[var(--text-1)] uppercase tracking-[0.1em] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                    <Scale size={18} className="text-[#B066FF]" /> Core Invariant Laws
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] md:gap-[16px]">
                    {auditResult.invariants.map((inv: any, idx: number) => (
                       <div key={idx} className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] p-[16px] md:p-[20px] rounded-[12px] shadow-sm flex items-start gap-4">
                          <div className="bg-[#B066FF]/10 text-[#B066FF] text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest whitespace-nowrap border border-[#B066FF]/20 mt-0.5">
                             {inv.id || `LAW-${idx + 1}`}
                          </div>
                          <div className="text-[13px] md:text-[14px] text-[var(--text-2)] leading-relaxed font-mono">
                             {inv.description}
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            )}
            
            <div className={`w-full flex flex-col gap-[12px] md:gap-[16px] min-w-0 ${isExporting ? 'pb-8' : 'pb-[80px] md:pb-[120px]'}`}>
               <SeverityAccordion type="critical" label="Critical Vulnerabilities" items={auditResult.critical || []} forceOpen={isExporting} showAlert={showAlert} />
               <SeverityAccordion type="high" label="High Severity Issues" items={auditResult.high || []} forceOpen={isExporting} showAlert={showAlert} />
               <SeverityAccordion type="medium" label="Medium / Low Severity" items={auditResult.medium || []} forceOpen={isExporting} showAlert={showAlert} />
               <SeverityAccordion type="gas" label="Gas Optimizations" items={auditResult.gas || []} forceOpen={isExporting} showAlert={showAlert} />
            </div>
          </div>
        );
    }

    // --- PART 4: SETTINGS (API KEY VAULT) ---
    if (step === 'settings') {
      const renderKeyInput = (label: string, provider: keyof typeof apiKeys, placeholder: string) => (
        <div className="flex flex-col gap-2 w-full">
            <label className="text-[12px] font-bold text-[var(--text-3)] uppercase tracking-widest">{label}</label>
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key size={14} className="text-[var(--text-3)]" />
                </div>
                <input 
                    type={showKeys[provider] ? "text" : "password"}
                    value={apiKeys[provider]} 
                    onChange={(e) => handleKeyChange(provider, e.target.value)} 
                    placeholder={placeholder} 
                    className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[8px] pl-10 pr-10 py-2.5 text-[var(--text-1)] font-mono text-[13px] focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
                <button 
                  onClick={() => toggleKeyVisibility(provider)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
                >
                  {showKeys[provider] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </div>
      );

      return (
        <div className="flex-1 flex flex-col items-center justify-start p-6 pt-12 md:pt-24 max-w-[800px] mx-auto w-full animate-in fade-in">
           <div className="w-full mb-8 md:mb-12 border-b border-[var(--border-subtle)] pb-6 flex justify-between items-end">
              <h2 className="text-[28px] md:text-[32px] font-medium text-[var(--text-1)]">Configuration Vault</h2>
              <span className="text-[12px] font-mono text-[var(--text-3)]">LOCAL_MODE_ACTIVE</span>
           </div>

           <div className="w-full bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-8 mb-12">
              <div>
                 <h3 className="text-[18px] font-bold text-[var(--text-1)] mb-2 flex items-center gap-2"><Cpu className="text-[var(--accent)]"/> AI Providers</h3>
                 <p className="text-[13px] text-[var(--text-2)] mb-6">Keys are stored securely in your browser's local storage and are only transmitted directly to your local Docker container during a scan. At least one key is required.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderKeyInput("Groq API Key", "groq", "gsk_...")}
                    {renderKeyInput("DeepSeek API Key", "deepseek", "sk-...")}
                    {renderKeyInput("Gemini API Key", "gemini", "AIzaSy...")}
                    {renderKeyInput("Anthropic API Key", "anthropic", "sk-ant-...")}
                    {renderKeyInput("MiniMax API Key", "minimax", "ey...")}
                    {renderKeyInput("Zhipu API Key", "zhipu", "...")}
                 </div>
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-8">
                 <h3 className="text-[18px] font-bold text-[var(--text-1)] mb-2 flex items-center gap-2"><Database className="text-[var(--low)]"/> Blockchain Integration</h3>
                 <p className="text-[13px] text-[var(--text-2)] mb-6">Required if you intend to fetch smart contract source code directly via verified block explorer URLs.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderKeyInput("Etherscan API Key", "etherscan", "...")}
                 </div>
              </div>
           </div>
        </div>
      );
    }

    // --- PART 5: SCAN HISTORY (LOCAL) ---
    if (step === 'history') {
      return (
        <div className="flex-1 flex flex-col items-center justify-start p-4 pt-8 md:p-12 animate-in fade-in duration-500 w-full min-w-0 max-w-[1200px] mx-auto">
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-end mb-[24px] md:mb-[40px] border-b border-[var(--border-subtle)] pb-[20px] md:pb-[24px] gap-4 sm:gap-0 shrink-0">
            <div>
              <h2 className="text-[28px] md:text-[32px] font-medium tracking-tight text-[var(--text-1)] mb-2">Scan History</h2>
              <p className="text-[13px] md:text-[15px] text-[var(--text-2)] font-light">Recent audits are saved securely in your local browser cache.</p>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={() => { localStorage.removeItem('sential_history'); setHistoryItems([]); }} className="text-[11px] text-[var(--critical)] border border-[var(--critical)] hover:bg-[var(--critical)] hover:text-white px-3 py-1.5 rounded transition-colors">Clear History</button>
               <span className="text-[var(--text-3)] font-mono text-[12px] md:text-[14px] bg-[var(--bg-surface-1)] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] whitespace-nowrap shadow-sm shrink-0">{historyItems.length} Records</span>
            </div>
          </div>
          
          <div className="w-full bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] rounded-[16px] md:rounded-[20px] overflow-hidden shadow-sm shrink-0">
             <div className="overflow-x-auto custom-scrollbar w-full">
               <table className="w-full text-left border-collapse min-w-[600px]">
                 <thead>
                   <tr className="border-b border-[var(--border-strong)] bg-[var(--bg-surface-2)]">
                     <th className="py-[16px] px-[20px] md:px-[24px] font-bold text-[10px] md:text-[11px] tracking-[0.08em] uppercase text-[var(--text-3)] whitespace-nowrap">Date</th>
                     <th className="py-[16px] px-[20px] md:px-[24px] font-bold text-[10px] md:text-[11px] tracking-[0.08em] uppercase text-[var(--text-3)] whitespace-nowrap">Target</th>
                     <th className="py-[16px] px-[20px] md:px-[24px] font-bold text-[10px] md:text-[11px] tracking-[0.08em] uppercase text-[var(--text-3)] whitespace-nowrap">Method</th>
                     <th className="py-[16px] px-[20px] md:px-[24px] font-bold text-[10px] md:text-[11px] tracking-[0.08em] uppercase text-[var(--text-3)] whitespace-nowrap">Score</th>
                     <th className="py-[16px] px-[20px] md:px-[24px] font-bold text-[10px] md:text-[11px] tracking-[0.08em] uppercase text-[var(--text-3)] text-right whitespace-nowrap">Action</th>
                   </tr>
                 </thead>
                 <tbody className="text-[13px] md:text-[14px] text-[var(--text-2)]">
                   {historyItems.length === 0 ? (
                     <tr><td colSpan={5} className="py-[64px] text-center text-[var(--text-3)] font-mono text-[13px]">No audits performed in this session.</td></tr>
                   ) : (
                     historyItems.map((item) => (
                       <tr key={item.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-2)] transition-colors group cursor-pointer" onClick={() => loadPastAudit(item)}>
                         <td className="py-[16px] px-[20px] md:px-[24px] font-mono text-[12px] md:text-[13px] whitespace-nowrap">
                           {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                         </td>
                         <td className="py-[16px] px-[20px] md:px-[24px] text-[var(--text-1)] font-medium max-w-[150px] md:max-w-[200px] truncate">{item.title}</td>
                         <td className="py-[16px] px-[20px] md:px-[24px]">
                           <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-[var(--text-3)] bg-[var(--bg-base)] border border-[var(--border-default)] px-[8px] py-[4px] rounded-full whitespace-nowrap">
                             {item.method || 'code'}
                           </span>
                         </td>
                         <td className="py-[16px] px-[20px] md:px-[24px]">
                           <div className="flex items-center gap-2 shrink-0">
                             <div className={`w-2 h-2 rounded-full ${item.score < 5 ? 'bg-[var(--critical)]' : item.score < 8 ? 'bg-[var(--medium)]' : 'bg-[var(--low)]'}`}></div>
                             <span className="font-mono text-[12px] md:text-[13px]">{item.score}/10</span>
                           </div>
                         </td>
                         <td className="py-[16px] px-[20px] md:px-[24px] text-right whitespace-nowrap">
                           <span className="text-[12px] md:text-[13px] font-medium text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors">View Report →</span>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      );
    }

    // --- PART 6: DOCUMENTATION (NEW HUB) ---
    if (step === 'docs') {
      return (
        <div className="flex-1 flex flex-col items-center justify-start p-6 pt-24 max-w-[900px] mx-auto w-full animate-in fade-in">
           <div className="w-full mb-12 border-b border-[var(--border-subtle)] pb-6 flex justify-between items-end">
              <h2 className="text-[32px] font-medium text-[var(--text-1)]">Sential Documentation</h2>
              <span className="text-[12px] font-mono text-[var(--text-3)]">SYS_DOCS_v2.0_LOCAL</span>
           </div>
           <div className="w-full flex flex-col gap-8 pb-20">
              
              <div className="bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] p-8 rounded-[20px] shadow-sm">
                <h3 className="text-[18px] font-bold text-[var(--text-1)] mb-4 flex items-center gap-2"><Sword className="text-[#FF3B30]"/> The Adversarial Triad Engine</h3>
                <p className="text-[14px] text-[var(--text-2)] leading-relaxed mb-4">Sential AI does not rely on a single monolithic LLM. It utilizes a margin-protected waterfall architecture to detect vulnerabilities that standard linters miss:</p>
                <ul className="list-disc list-inside text-[14px] text-[var(--text-3)] space-y-2 ml-4 font-mono">
                  <li><strong className="text-[var(--text-2)] font-sans">Gatekeeper (Llama 3.3 8B):</strong> Isolates high-risk logic vectors and strips boilerplate to conserve token context.</li>
                  <li><strong className="text-[var(--text-2)] font-sans">Red Team (DeepSeek / MiniMax / Gemini):</strong> Aggressively synthesizes complex attack vectors and writes weaponized Foundry PoC code.</li>
                  <li><strong className="text-[var(--text-2)] font-sans">Judge (Claude 3 Opus / Zhipu GLM-5):</strong> Cryptographically verifies the logic and standardizes the severity of the output.</li>
                </ul>
              </div>

              <div className="bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] p-8 rounded-[20px] shadow-sm">
                <h3 className="text-[18px] font-bold text-[var(--text-1)] mb-4 flex items-center gap-2"><Terminal className="text-[#34C759]"/> The Guillotine Sandbox</h3>
                <p className="text-[14px] text-[var(--text-2)] leading-relaxed">AI hallucinations are the biggest bottleneck in automated auditing. Sential eliminates false positives by taking the Red Team's generated <code>.t.sol</code> file and injecting it into your local Foundry compiler. If the Foundry test reverts, Sential silently downgrades the alert. We prove the math, we don't just guess.</p>
              </div>

           </div>
        </div>
      );
    }
  };

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0 !important; size: A4 portrait; }
          html, body, #root { background-color: var(--bg-base) !important; color: var(--text-1) !important; margin: 0; padding: 0; }
          .custom-scrollbar::-webkit-scrollbar { display: none !important; }
        }
      `}</style>

      <div className={`flex w-full min-w-0 bg-[var(--bg-base)] font-ui relative selection:bg-[var(--accent-dim)] selection:text-[var(--text-1)] ${isExporting ? 'h-auto min-h-screen block' : 'h-screen overflow-hidden'}`}>
        
        {/* --- MOBILE HEADER BAR --- */}
        {!isExporting && (
          <div className="md:hidden shrink-0 fixed top-0 left-0 right-0 z-30 h-[60px] bg-[rgba(7,9,15,0.85)] backdrop-blur-xl border-b border-[var(--border-subtle)] flex items-center justify-between px-4 print:hidden w-full">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 text-[var(--text-1)] active:scale-95 transition-transform shrink-0">
               <Menu size={24} />
            </button>
            <div className="flex-1 flex justify-center min-w-0">
              <img src={activeLogo} alt="BlockVIA" className="h-[20px] w-auto object-contain drop-shadow-[0_0_10px_rgba(0,194,255,0.2)]" />
            </div>
            <button onClick={() => { resetApp(); window.scrollTo(0,0); }} className="p-2 -mr-2 text-[var(--text-1)] active:scale-95 transition-transform shrink-0">
               <Plus size={24} />
            </button>
          </div>
        )}

        {/* --- RATE LIMIT / SELF-HOSTING MODAL --- */}
        {showRateLimitModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 print:hidden w-full h-full">
             <div className="bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] rounded-[20px] md:rounded-[24px] p-8 md:p-12 max-w-md w-full relative shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col items-center text-center">
                <button onClick={() => setShowRateLimitModal(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors p-2 shrink-0"><X size={20} /></button>
                <div className="w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-full bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] flex items-center justify-center mb-[20px] md:mb-[24px] shrink-0"><Server size={24} className="text-[#FF3B30]" /></div>
                <h3 className="text-[20px] md:text-[24px] font-medium text-[var(--text-1)] mb-3 md:mb-4 tracking-tight w-full">API Rate Limit Exceeded</h3>
                <p className="text-[14px] md:text-[15px] text-[var(--text-2)] mb-[24px] md:mb-[32px] leading-relaxed w-full break-words">
                    The currently configured API key has hit its global rate limit. Please check your provider dashboard or configure a different LLM fallback key in Settings.
                </p>
                <button onClick={() => { setShowRateLimitModal(false); setStep('settings'); }} className="w-full bg-[var(--text-1)] text-[var(--bg-base)] font-bold py-[14px] md:py-[16px] rounded-[10px] md:rounded-[12px] transition-all hover:scale-[1.02] active:scale-[0.98] text-[14px] md:text-[15px] mb-[12px] md:mb-[16px] shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 shrink-0"><Settings size={18}/> Update API Keys</button>
             </div>
          </div>
        )}

        {/* --- ALERTS --- */}
        {alertConfig.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200 print:hidden w-full h-full">
             <div className="bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] rounded-[20px] md:rounded-[24px] p-8 md:p-10 max-w-sm w-full relative shadow-2xl text-center flex flex-col items-center">
                <AlertTriangle className="text-[var(--accent)] mb-4 md:mb-6 shrink-0" size={32} />
                <h3 className="text-[16px] md:text-[18px] font-medium text-[var(--text-1)] mb-2 w-full">Notice</h3>
                <p className="text-[13px] md:text-[14px] text-[var(--text-2)] mb-6 md:mb-8 leading-relaxed w-full break-words">{alertConfig.message}</p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full shrink-0">
                  <button onClick={hideAlert} className="flex-1 bg-[var(--bg-surface-2)] border border-[var(--border-default)] text-[var(--text-1)] py-2.5 md:py-3 rounded-[8px] md:rounded-[10px] transition-all font-semibold text-[13px] w-full">Dismiss</button>
                  {alertConfig.action && (
                    <button onClick={() => { alertConfig.action!(); hideAlert(); }} className="flex-1 bg-[var(--text-1)] text-[var(--bg-base)] py-2.5 md:py-3 rounded-[8px] md:rounded-[10px] transition-all font-semibold text-[13px] w-full">{alertConfig.actionText}</button>
                  )}
                </div>
             </div>
          </div>
        )}

        {/* --- MOBILE SIDEBAR BACKDROP --- */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[40] md:hidden transition-opacity animate-in fade-in" onClick={() => setIsMobileSidebarOpen(false)} />
        )}

        {/* --- RESPONSIVE SIDEBAR --- */}
        <div className={`fixed inset-y-0 left-0 z-[50] bg-[var(--bg-surface-1)] border-r border-[var(--border-subtle)] flex flex-col transition-all duration-300 ease-[var(--ease-spring)] print:hidden shrink-0
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} md:translate-x-0
          ${(isDesktopSidebarOpen || isMobile) ? 'md:w-[260px]' : 'md:w-[80px]'} w-[280px]
        `}>
          
          <div className="h-[60px] md:h-[72px] flex items-center justify-between px-4 md:px-5 border-b border-[var(--border-subtle)] shrink-0">
             <div className="flex items-center cursor-pointer group overflow-hidden w-full min-w-0" onClick={() => {resetApp(); if(isMobile) setIsMobileSidebarOpen(false);}}>
               {(!isDesktopSidebarOpen && !isMobile) ? (
                  <img src={activeIcon} alt="Sential AI" className="h-[28px] w-[28px] object-contain mx-auto group-hover:scale-110 transition-transform shrink-0" />
               ) : (
                  <img src={activeLogo} alt="Sential AI" className="h-[22px] md:h-[24px] w-auto object-contain group-hover:scale-105 transition-transform" />
               )}
             </div>
             
             {/* Desktop Collapse Toggle */}
             <button 
               onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
               className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors active:scale-95 shrink-0 ml-2"
             >
               <Menu size={20} />
             </button>
             
             {/* Mobile Close Toggle */}
             <button className="md:hidden p-2 -mr-2 text-[var(--text-3)] hover:text-[var(--text-1)] shrink-0" onClick={() => setIsMobileSidebarOpen(false)}>
               <X size={24} />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-[16px] md:py-[24px] flex flex-col gap-[4px] custom-scrollbar min-w-0">
             <SidebarItem icon={<Code2 size={18}/>} label="Scanner" active={step === 'scanner' || step === 'analyzing' || step === 'results'} onClick={() => { resetApp(); if(isMobile) setIsMobileSidebarOpen(false); }} isCollapsed={!isDesktopSidebarOpen && !isMobile} />
             <SidebarItem icon={<History size={18}/>} label="History" active={step === 'history'} onClick={() => { setStep('history'); if(isMobile) setIsMobileSidebarOpen(false); }} isCollapsed={!isDesktopSidebarOpen && !isMobile} />
             <SidebarItem icon={<Settings size={18}/>} label="Settings" active={step === 'settings'} onClick={() => { setStep('settings'); if(isMobile) setIsMobileSidebarOpen(false); }} isCollapsed={!isDesktopSidebarOpen && !isMobile} />
             
             <div className="mt-4 mb-2 border-t border-[var(--border-subtle)] mx-4 shrink-0"></div>
             
             <SidebarItem icon={<BookOpen size={18}/>} label="Documentation" active={step === 'docs'} onClick={() => { setStep('docs'); if(isMobile) setIsMobileSidebarOpen(false); }} isCollapsed={!isDesktopSidebarOpen && !isMobile} />
          </div>

          <div className="p-[16px] md:p-[20px] border-t border-[var(--border-subtle)] flex flex-col gap-3 shrink-0">
            {(isDesktopSidebarOpen || isMobile) && (
              <div className="flex items-center gap-[12px] mt-2 pt-3 px-2 w-full min-w-0 shrink-0">
                 <div className="w-[28px] h-[28px] rounded-full bg-[var(--bg-surface-3)] border border-[var(--border-default)] flex items-center justify-center text-[10px] font-medium text-[var(--text-1)] shrink-0">
                   L
                 </div>
                 <div className="flex flex-col overflow-hidden w-full min-w-0">
                   <span className="text-[12px] font-medium text-[var(--text-1)] truncate w-full">Local Session</span>
                   <span className="text-[10px] text-[var(--text-3)] font-mono truncate w-full">SENTIAL-CORE</span>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* --- MAIN CONTENT WRAPPER --- */}
        <div className={`flex-1 w-full min-w-0 relative flex flex-col z-10 transition-all duration-300 ease-[var(--ease-spring)]
          ${isExporting ? 'ml-0' : (isDesktopSidebarOpen ? 'ml-0 md:ml-[260px]' : 'ml-0 md:ml-[80px]')} 
          overflow-y-auto overflow-x-hidden custom-scrollbar h-full`}>
          
          <div className="flex-1 w-full min-w-0 md:mt-0 mt-[60px]">
            {renderMainContent()}
          </div>

          {!isExporting && <LegalFooter />}
        </div>
      </div>
    </>
  );
}

// --- SUB-COMPONENTS ---
function SidebarItem({ icon, label, active, onClick, isCollapsed }: any) {
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center cursor-pointer transition-all duration-200 h-[44px] rounded-[10px] mx-2 mb-1 w-auto min-w-0 shrink-0
        ${isCollapsed ? 'justify-center px-0' : 'px-[16px] gap-[12px]'}
        ${active ? 'bg-[var(--accent-dim)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-2)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-1)]'}
      `}
      title={isCollapsed ? label : undefined}
    >
      <div className={`shrink-0 ${active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>{icon}</div>
      {!isCollapsed && <span className="text-[14px] font-medium whitespace-nowrap truncate w-full">{label}</span>}
    </div>
  );
}

function SeverityAccordion({ type, label, items, forceOpen, showAlert }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const count = items ? items.length : 0;
  
  const styles: Record<string, { bar: string, dot: string }> = { 
    critical: { bar: 'border-l-[var(--critical)]', dot: 'bg-[var(--critical)]' }, 
    high: { bar: 'border-l-[var(--high)]', dot: 'bg-[var(--high)]' }, 
    medium: { bar: 'border-l-[var(--medium)]', dot: 'bg-[var(--medium)]' }, 
    gas: { bar: 'border-l-[var(--gas)]', dot: 'bg-[var(--gas)]' }
  };

  const bodyClass = forceOpen 
    ? "block opacity-100" 
    : `grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`;

  if (count === 0 && !forceOpen) return null;

  return (
    <div className={`w-full min-w-0 bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] rounded-[12px] md:rounded-[16px] overflow-hidden shrink-0 ${forceOpen ? 'break-inside-avoid shadow-none' : 'shadow-sm'}`}>
       
       <div onClick={() => count > 0 && setIsOpen(!isOpen)} className={`px-[16px] md:px-[24px] h-[56px] md:h-[64px] flex justify-between items-center transition-colors bg-[var(--bg-surface-2)] border-b border-transparent w-full min-w-0 shrink-0 ${isOpen ? 'border-[var(--border-subtle)]' : ''} ${count > 0 ? 'cursor-pointer hover:bg-[var(--bg-surface-3)]' : 'opacity-50 cursor-not-allowed'}`}>
         <div className="flex items-center gap-[12px] md:gap-[16px] min-w-0 shrink-0">
            <div className={`w-[8px] h-[8px] md:w-[10px] md:h-[10px] rounded-full shrink-0 ${styles[type].dot} ${isOpen ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`}></div>
            <span className="font-medium text-[14px] md:text-[15px] text-[var(--text-1)] truncate max-w-[200px] sm:max-w-none">{label}</span>
         </div>
         <div className="flex items-center gap-[12px] md:gap-[16px] shrink-0">
           <span className="font-mono bg-[var(--bg-base)] border border-[var(--border-default)] px-[10px] md:px-[12px] py-[2px] md:py-[4px] rounded-[6px] text-[11px] md:text-[12px] font-medium text-[var(--text-2)] whitespace-nowrap shrink-0">{count} Issues</span>
           {!forceOpen && count > 0 && <ChevronDown size={18} className={`text-[var(--text-3)] transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''} md:w-[18px] md:h-[18px] w-[16px] h-[16px]`} />}
         </div>
       </div>
       
       <div className={bodyClass}>
         <div className="overflow-hidden bg-[var(--bg-base)] w-full min-w-0">
            <div className="p-[16px] md:p-[24px] flex flex-col gap-[20px] md:gap-[24px] w-full min-w-0">
              {items && items.map((item: any, idx: number) => (
                <div key={idx} className={`bg-[var(--bg-surface-1)] rounded-[10px] md:rounded-[12px] p-[20px] md:p-[24px] border-l-[4px] border border-[var(--border-subtle)] ${styles[type].bar} shadow-sm w-full min-w-0 shrink-0 ${forceOpen ? 'break-inside-avoid' : ''}`}>
                  <div className="flex justify-between items-start mb-[12px] md:mb-[16px] w-full min-w-0">
                    <h4 className="text-[var(--text-1)] font-medium text-[15px] md:text-[16px] break-words w-full">{item.title}</h4>
                  </div>
                  <p className="text-[var(--text-2)] text-[13px] md:text-[14px] leading-[1.6] md:leading-[1.7] mb-[20px] md:mb-[24px] max-w-full break-words">{item.description}</p>
                  
                  <div className="flex flex-col gap-[20px] md:gap-[24px] w-full min-w-0">
                    {item.foundry_poc && (
                      <div className={`flex flex-col mb-[12px] w-full min-w-0 ${forceOpen ? 'break-inside-avoid' : ''}`}>
                        <div className="bg-[#0A0D14] border border-[#FF3B30]/30 rounded-[12px] overflow-hidden shadow-2xl relative">
                           <div className="bg-[#111622] border-b border-[#FF3B30]/20 px-[16px] py-[10px] flex items-center justify-between">
                              <span className="text-[10px] md:text-[11px] uppercase tracking-widest font-bold text-[#FF3B30] flex items-center gap-[8px]">
                                 <Sword size={14} /> Weaponized Proof of Concept (.t.sol)
                              </span>
                           </div>
                           <pre className="p-[16px] overflow-x-auto text-[12px] md:text-[13px] font-mono text-[#E0E0E0] custom-scrollbar whitespace-pre-wrap break-words w-full min-w-0">
                             {item.foundry_poc}
                           </pre>
                           {!forceOpen && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.foundry_poc); showAlert("Exploit copied to clipboard!"); }} 
                                className="absolute top-[48px] right-[16px] bg-[#111622] border border-[#FF3B30]/30 px-[12px] py-[6px] rounded-[6px] text-[10px] md:text-[11px] font-medium text-white hover:bg-[#FF3B30] transition-colors flex items-center gap-2 shadow-md active:scale-95"
                              >
                                <Copy size={12}/> Copy Exploit
                              </button>
                           )}
                        </div>
                      </div>
                    )}

                    {item.vulnerable_code && (
                      <div className={`flex flex-col w-full min-w-0 ${forceOpen ? 'break-inside-avoid' : ''}`}>
                        <span className="text-[10px] md:text-[11px] uppercase tracking-[0.08em] font-bold text-[var(--critical)] mb-[10px] md:mb-[12px] flex items-center gap-[8px] shrink-0"><X size={12} className="md:w-[14px] md:h-[14px]"/> Vulnerable Logic</span>
                        <pre className="bg-[var(--bg-surface-2)] p-[12px] md:p-[16px] rounded-[8px] overflow-x-auto text-[12px] md:text-[13px] font-mono text-[var(--text-2)] border border-[rgba(255,59,48,0.2)] custom-scrollbar whitespace-pre-wrap break-words shadow-inner w-full min-w-0">
                          {item.vulnerable_code}
                        </pre>
                      </div>
                    )}

                    {item.remediated_code && (
                      <div className={`flex flex-col relative group w-full min-w-0 ${forceOpen ? 'break-inside-avoid' : ''}`}>
                        <span className="text-[10px] md:text-[11px] uppercase tracking-[0.08em] font-bold text-[var(--low)] mb-[10px] md:mb-[12px] flex items-center gap-[8px] shrink-0"><CheckCircle size={12} className="md:w-[14px] md:h-[14px]"/> Remediated Code (Patch)</span>
                        <pre className="bg-[var(--bg-surface-2)] p-[12px] md:p-[16px] rounded-[8px] overflow-x-auto text-[12px] md:text-[13px] font-mono text-[var(--text-1)] border border-[rgba(52,199,89,0.3)] custom-scrollbar whitespace-pre-wrap break-words shadow-inner w-full min-w-0">
                          {item.remediated_code}
                        </pre>
                        
                        {!forceOpen && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.remediated_code); showAlert("Patch copied to clipboard!"); }} 
                            className="absolute top-[36px] md:top-[40px] right-[12px] md:right-[16px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] px-[10px] md:px-[12px] py-[4px] md:py-[6px] rounded-[6px] text-[10px] md:text-[11px] font-medium text-[var(--text-1)] md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-surface-4)] flex items-center gap-2 shadow-md active:scale-95 shrink-0 z-10"
                          >
                            <Copy size={12} className="w-[10px] h-[10px] md:w-[12px] md:h-[12px]"/> Copy
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
         </div>
       </div>
    </div>
  );
}