import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Voucher, OperatorID, View } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import Scanner from './components/Scanner.tsx';
import { CameraIcon, ListIcon, PrintIcon, SuccessIcon, ErrorIcon, BanIcon, InfoIcon } from './components/icons.tsx';
import { supabase } from './supabaseClient.ts';

const TOTAL_VOUCHERS = 250;
const VOUCHER_TABLE = 'vouchers';

// Helper function to format voucher IDs
const formatVoucherId = (num: number): string => `BON${String(num).padStart(4, '0')}`;

const App: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [view, setView] = useState<View>('SELECT_OPERATOR');
  const [previousView, setPreviousView] = useState<View>('SELECT_OPERATOR');
  const [activeOperator, setActiveOperator] = useState<OperatorID | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInitializingDb, setIsInitializingDb] = useState(false);
  const [isResettingScans, setIsResettingScans] = useState(false);
  
  // State for Admin Code Modal
  const [isCodePromptVisible, setIsCodePromptVisible] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeInputValue, setCodeInputValue] = useState('');
  const [codeError, setCodeError] = useState('');

  // State for the new scan result page
  const [scanResult, setScanResult] = useState<{ message: string; voucherId?: string } | null>(null);

  const fetchInitialData = useCallback(async () => {
      setIsLoading(true);
      const { data, error } = await supabase
          .from(VOUCHER_TABLE)
          .select('*')
          .order('id', { ascending: true });

      if (error) {
          console.error("Supabase connection error details:", error);
          setConnectionError(`EROARE: Nu s-a putut conecta la baza de date. Verificați configurația Supabase și permisiunile tabelului. (${error.message})`);
          setIsLoading(false);
      } else {
          setVouchers(data as Voucher[]);
          setConnectionError(null);
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    // Check for saved operator on initial load
    const savedOperator = localStorage.getItem('activeOperator') as OperatorID;
    if (savedOperator) {
      setActiveOperator(savedOperator);
      setView('OPERATOR_HUB');
    }

    fetchInitialData();

    const channel = supabase.channel('public:vouchers')
      .on('postgres_changes', { event: '*', schema: 'public', table: VOUCHER_TABLE }, (payload) => {
        console.log('Change received!', payload);
        fetchInitialData(); // Refetch on any change
      })
      .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error("Eroare la conectarea pe canalul real-time (Aplicația va funcționa fără actualizări live): ", err);
          } else if (status === 'SUBSCRIBED') {
              console.log('Conectat la actualizări în timp real.');
          }
      });

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  // Effect to handle the scan result page timer
  useEffect(() => {
    if (view === 'SCAN_RESULT') {
      const timer = setTimeout(() => {
        setView('OPERATOR_HUB');
        setScanResult(null); // Clear the result
      }, 3000); // 3-second delay

      return () => clearTimeout(timer); // Cleanup timer on unmount or view change
    }
  }, [view]);
  
  const handleSelectOperator = (operator: OperatorID) => {
    localStorage.setItem('activeOperator', operator);
    setActiveOperator(operator);
    setView('OPERATOR_HUB');
  };

  const handleScan = useCallback(async (decodedText: string) => {
    if (!activeOperator) {
      setScanResult({ message: "EROARE: Niciun operator activ selectat." });
      setView('SCAN_RESULT');
      return;
    }
  
    let voucherId: string | null = null;
    let resultMessage = '';
  
    try {
      const data = JSON.parse(decodedText);
      if (data.type === "TARG_TOAMNA_2025" && data.id) {
        voucherId = data.id;
        const { data: rpcData, error } = await supabase.rpc('scan_voucher', {
          voucher_id: voucherId,
          operator_id: activeOperator
        });

        if (error) {
          console.error('RPC error:', error);
          resultMessage = `EROARE: ${error.message}`;
        } else {
          resultMessage = rpcData;
        }
      } else {
        resultMessage = 'EROARE: Cod QR invalid sau neasignat!';
      }
    } catch (e) {
      resultMessage = 'EROARE: Format cod QR invalid!';
    }
  
    setScanResult({ message: resultMessage, voucherId: voucherId ?? undefined });
    setView('SCAN_RESULT');
  }, [activeOperator]);
  
  const handleInitializeDb = async () => {
    setIsInitializingDb(true);
    try {
        // These objects MUST have snake_case keys to match the database columns for insertion.
        const newVouchers: any[] = [];
        for (let i = 1; i <= TOTAL_VOUCHERS; i++) {
            const voucherId = formatVoucherId(i);
            const voucherDataJson = JSON.stringify({
                type: "TARG_TOAMNA_2025",
                id: voucherId
            });
            newVouchers.push({
                id: voucherId,
                qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(voucherDataJson)}`,
                scans_op1: 0,
                scans_op2: 0,
                status: 'Nefolosit',
            });
        }
        
        const { error } = await supabase.from(VOUCHER_TABLE).insert(newVouchers);

        if (error) {
            throw error;
        }
        
        // Force refetch after successful insertion to guarantee UI update
        await fetchInitialData();

    } catch (error: any) {
        console.error("Error initializing database: ", error);
        alert(`A apărut o eroare la inițializare: ${error.message}`);
    } finally {
        setIsInitializingDb(false);
    }
  };
  
  const handleResetScans = async () => {
    setIsResettingScans(true);
    try {
      const { error } = await supabase
        .from(VOUCHER_TABLE)
        .update({
          scans_op1: 0,
          scans_op2: 0,
          status: 'Nefolosit',
          last_scan: null,
        })
        .not('id', 'is', null); // Condition to update all rows reliably

      if (error) {
        throw error;
      }
      await fetchInitialData(); // Refetch to update the UI
      alert("Resetarea a fost efectuată cu succes! Toate voucherele sunt din nou 'Nefolosite'.");
    } catch (error: any) {
      console.error("Error resetting scans: ", error);
      alert(`A apărut o eroare la resetarea scanărilor: ${error.message}`);
    } finally {
      setIsResettingScans(false);
    }
  };

  const handleGeneratePrintPage = () => {
    setView('PRINT_PREVIEW');
  };

  const openCodePrompt = () => {
    setCodeInputValue('');
    setCodeError('');
    setIsCodePromptVisible(true);
  };

  const closeCodePrompt = () => {
    setIsCodePromptVisible(false);
  };

  const handleCodeVerification = async () => {
    setIsVerifyingCode(true);
    setCodeError('');
    try {
        const { data, error } = await supabase.rpc('verify_admin_code', {
            user_code: codeInputValue
        });

        if (error) {
            console.error('Admin verification error:', error);
            setCodeError('Eroare la server. Încercați din nou.');
            return;
        }

        if (data === true) {
            localStorage.removeItem('activeOperator');
            setActiveOperator(null);
            setView('SELECT_OPERATOR');
            closeCodePrompt();
        } else {
            setCodeError('Cod incorect!');
            setCodeInputValue('');
        }
    } catch (err) {
        console.error('Admin verification failed:', err);
        setCodeError('A apărut o eroare neașteptată.');
    } finally {
        setIsVerifyingCode(false);
    }
  };
  
  const navigateToVoucherList = () => {
    setPreviousView(view);
    setView('VOUCHER_LIST');
  };

  const operatorScanCounts = useMemo(() => {
    return vouchers.reduce((acc, voucher) => {
        acc['Zâne Bune'] += voucher.scans_op1;
        acc['The Sailor'] += voucher.scans_op2;
        return acc;
    }, { 'Zâne Bune': 0, 'The Sailor': 0 });
  }, [vouchers]);

  const renderScanResultPage = () => {
    if (!scanResult) return null;

    const message = scanResult.message.toLowerCase();
    let Icon = InfoIcon;
    let bgColor = 'bg-gray-800';
    let textColor = 'text-white';
    let mainText = scanResult.message;
    let subText = scanResult.voucherId ? `ID: ${scanResult.voucherId}` : '';

    if (message.includes('folosit')) {
      Icon = BanIcon;
      bgColor = 'bg-red-600';
      mainText = 'VOUCHER EPUIZAT';
    } else if (message.startsWith('eroare')) {
      Icon = ErrorIcon;
      bgColor = 'bg-red-600';
      mainText = 'EROARE';
      subText = scanResult.message;
    } else if (message.includes('succes')) {
      Icon = SuccessIcon;
      bgColor = 'bg-green-600';
      mainText = 'VOUCHER VALIDAT';
    } else if (message.includes('finalizat')) {
      Icon = SuccessIcon;
      bgColor = 'bg-yellow-500';
      textColor = 'text-black'; // Better contrast for yellow
      mainText = 'VOUCHER FINALIZAT';
    }

    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center text-center p-4 ${bgColor} ${textColor} transition-colors duration-300`}>
        <div className="transform scale-150 mb-8">
            <Icon />
        </div>
        <h1 className="text-6xl font-bold tracking-wider">{mainText}</h1>
        {subText && <p className="text-2xl mt-4 opacity-80">{subText}</p>}
      </div>
    );
  };


  const renderView = () => {
    if (connectionError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-red-50">
                <h1 className="text-3xl font-bold text-red-700 mb-4">Probleme de Conexiune</h1>
                <p className="text-lg text-gray-800 max-w-2xl">{connectionError}</p>
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen text-xl">Se încarcă datele...</div>;
    }

    switch(view) {
      case 'SELECT_OPERATOR':
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-800 text-white p-4">
            <h1 className="text-4xl font-bold mb-8 text-center">Târgul Toamnei Vârvoru de Jos</h1>
            <h2 className="text-2xl mb-12">Selectați rolul</h2>
            <div className="flex flex-col gap-6 w-full max-w-md">
              <button onClick={() => handleSelectOperator('Zâne Bune')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 px-8 rounded-lg text-2xl transition-transform transform hover:scale-105">
                Zâne Bune
              </button>
              <button onClick={() => handleSelectOperator('The Sailor')} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-6 px-8 rounded-lg text-2xl transition-transform transform hover:scale-105">
                The Sailor
              </button>
              <button onClick={() => setView('QR_GENERATOR')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-6 px-8 rounded-lg text-2xl transition-transform transform hover:scale-105">
                Administrator
              </button>
            </div>
          </div>
        );

      case 'OPERATOR_HUB':
        return (
          <div className="flex flex-col min-h-screen bg-gray-100 p-4">
             <div className="flex-grow flex flex-col items-center justify-center">
                <h1 className="text-3xl font-bold mb-4 text-gray-800">Operator: {activeOperator}</h1>
                <p className="text-gray-600 mb-10">Alegeți o acțiune</p>
                <div className="flex flex-col space-y-6 w-full max-w-sm">
                    <button onClick={() => setView('SCANNER')} className="flex items-center justify-center space-x-3 p-6 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105 duration-300">
                        <CameraIcon />
                        <span className="text-2xl font-semibold">Scanează</span>
                    </button>
                    <button onClick={navigateToVoucherList} className="flex items-center justify-center space-x-3 p-6 bg-gray-700 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-transform transform hover:scale-105 duration-300">
                        <ListIcon />
                        <span className="text-2xl font-semibold">Vouchere</span>
                    </button>
                </div>
                <div className="mt-8 w-full max-w-sm text-center bg-white p-4 rounded-lg shadow-md">
                    <p className="text-gray-600 text-lg">Scanări Valide Înregistrate:</p>
                    <p className="text-6xl font-bold text-gray-800 mt-2">
                        {activeOperator ? operatorScanCounts[activeOperator] : 0}
                    </p>
                </div>
             </div>
             <div className="text-center py-4">
                <button onClick={openCodePrompt} className="text-gray-500 hover:text-gray-700">Schimbă Operator</button>
             </div>
          </div>
        );

      case 'SCANNER':
        return <Scanner onScan={handleScan} onManualBack={() => setView('OPERATOR_HUB')} />;
      
      case 'SCAN_RESULT':
        return renderScanResultPage();

      case 'VOUCHER_LIST':
        return (
          <div className="p-4">
            <button onClick={() => setView(previousView)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 mb-4">
                Înapoi
            </button>
            <Dashboard vouchers={vouchers} />
          </div>
        );
      
      case 'QR_GENERATOR':
        return (
          <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Panou Administrator</h1>
                        <p className="text-gray-500">Administrați baza de date și voucherele.</p>
                    </div>
                    <button onClick={() => setView('SELECT_OPERATOR')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
                        Înapoi
                    </button>
                </div>

                {vouchers.length === 0 ? (
                    <div className="bg-white p-6 rounded-xl shadow-md text-center">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Baza de Date este goală</h2>
                        <p className="text-gray-600 mb-4">Apăsați butonul de mai jos pentru a genera și salva cele {TOTAL_VOUCHERS} vouchere.</p>
                        <button onClick={handleInitializeDb} disabled={isInitializingDb} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400">
                            {isInitializingDb ? 'Se inițializează...' : 'Initializează Baza de Date'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 bg-white p-6 rounded-xl shadow-md">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Monitorizare Scanări în Timp Real</h2>
                            <div className="flex justify-around items-center text-center">
                                <div>
                                    <p className="text-xl font-bold text-indigo-600">Zâne Bune</p>
                                    <p className="text-5xl font-bold text-gray-800 mt-1">{operatorScanCounts['Zâne Bune']}</p>
                                </div>
                                <div className="text-4xl font-light text-gray-400">/</div>
                                <div>
                                    <p className="text-xl font-bold text-teal-600">The Sailor</p>
                                    <p className="text-5xl font-bold text-gray-800 mt-1">{operatorScanCounts['The Sailor']}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Acțiuni Vouchere</h2>
                            <p className="text-gray-600 mb-4">Vizualizează statusul curent al tuturor voucherelor sau generează o pagină pentru imprimare.</p>
                            <div className="flex flex-wrap items-center gap-4">
                                 <button onClick={navigateToVoucherList} className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                                     <ListIcon />
                                     <span>Vezi Status Vouchere</span>
                                 </button>
                                 <button onClick={handleGeneratePrintPage} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                                     <PrintIcon />
                                     <span>Generează Pagina de Imprimare</span>
                                 </button>
                            </div>
                        </div>

                        <div className="mt-8 p-6 rounded-xl shadow-md bg-orange-50 border border-orange-200">
                            <h3 className="text-lg font-semibold text-orange-800">Zonă de Resetare</h3>
                            <p className="text-orange-700 mt-2 mb-4">
                                Folosiți această opțiune pentru a reseta toate scanările la zero, aducând statusul fiecărui voucher la 'Nefolosit'. Voucherele NU vor fi șterse și pot fi reutilizate.
                            </p>
                            <button 
                                onClick={handleResetScans} 
                                disabled={isResettingScans} 
                                className="bg-orange-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-orange-400 disabled:cursor-not-allowed"
                            >
                                {isResettingScans ? 'Se resetează...' : 'Resetează Toate Scanările'}
                            </button>
                        </div>
                    </>
                )}
            </div>
          </div>
        );

    case 'PRINT_PREVIEW':
        return (
          <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <style>{`
              @media print {
                .non-printable {
                  display: none !important;
                }
                .voucher-card {
                    page-break-inside: avoid;
                    border: 1px dashed #9ca3af;
                }
                .print-grid {
                    grid-template-columns: repeat(4, 1fr) !important;
                    gap: 1rem;
                }
              }
            `}</style>
            <div className="max-w-7xl mx-auto">
              <div className="non-printable mb-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-lg">
                <h2 className="font-bold text-lg">Pregătit pentru imprimare</h2>
                <p>Folosiți funcția de imprimare a browser-ului pentru a tipări. Apăsați <strong>Ctrl+P</strong> (sau <strong>Cmd+P</strong> pe Mac).</p>
                <button onClick={() => setView('QR_GENERATOR')} className="mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
                    Înapoi la Panou
                </button>
              </div>

              <div>
                 <h2 className="text-xl font-bold text-center mb-4">Vouchere Târgul Toamnei ({vouchers.length})</h2>
                 <div className="print-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                     {vouchers
                        .filter(voucher => voucher.qr_code_url)
                        .map(voucher => (
                         <div key={voucher.id} className="voucher-card flex flex-col items-center p-2 border border-dashed border-gray-400 rounded-lg bg-white">
                             <img src={voucher.qr_code_url} alt={`QR Code for ${voucher.id}`} className="w-32 h-32" />
                             <p className="mt-2 font-bold text-sm tracking-wider">{voucher.id}</p>
                         </div>
                     ))}
                 </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
        {renderView()}

        {isCodePromptVisible && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-sm">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Schimbare Operator</h3>
              <p className="text-gray-600 mb-4">Introduceți codul de administrator pentru a continua.</p>
              <input
                type="password"
                value={codeInputValue}
                onChange={(e) => setCodeInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCodeVerification();
                  if (e.key === 'Escape') closeCodePrompt();
                }}
                className={`w-full px-3 py-2 bg-white border ${codeError ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                autoFocus
              />
              {codeError && <p className="text-red-600 text-sm mt-2">{codeError}</p>}
              <div className="flex justify-end space-x-4 mt-6">
                <button onClick={closeCodePrompt} disabled={isVerifyingCode} className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold transition-colors disabled:opacity-50">
                  Anulează
                </button>
                <button onClick={handleCodeVerification} disabled={isVerifyingCode} className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 font-semibold transition-colors disabled:bg-indigo-400 w-28 text-center">
                  {isVerifyingCode ? 'Se verifică...' : 'Confirmă'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;
