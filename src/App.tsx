import { useEffect, useState, useCallback, useRef } from 'react';
import { db, initializeDatabaseSeed } from './db/icuSyncDb.ts';
import { 
  BedRecord, 
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine,
  BedNumber,
  BedStatus 
} from './types/schema.ts';
import { UserPlus } from 'lucide-react';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { SoliLogo } from './components/SoliLogo.tsx';
import { BedMatrixCard } from './components/BedMatrixCard.tsx';
import { BedsideFlowsheet } from './components/BedsideFlowsheet.tsx';
import { AddVitalsModal } from './components/AddVitalsModal.tsx';
import { AddAddendumModal } from './components/AddAddendumModal.tsx';
import { AddClinicalNoteModal } from './components/AddClinicalNoteModal.tsx';
import { SbarSignModal } from './components/SbarSignModal.tsx';
import { ArchiveSearchModal } from './components/ArchiveSearchModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { SbarHandoverView } from './components/SbarHandoverView.tsx';
import { ClinicalNotesView } from './components/ClinicalNotesView.tsx';
import { getPatientForBed, toggleBedOperationalStatus } from './services/dataModel.ts';
import { purgePhantomCriticalVitals, ensureBedPatientSync } from './db/icuSyncDb.ts';
import { 
  subscribeToRealtimeFirestore, 
  seedInitialDataToFirestore
} from './services/firebase.ts';
import { useTranslation } from './services/i18n.ts';
import { useAuth } from './services/AuthContext.tsx';
import { useSystemSettings } from './services/SettingsContext.tsx';
import { DEFAULT_VITAL_THRESHOLDS } from './types/settings.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';
import { FullPageAdmission } from './components/FullPageAdmission.tsx';
import { HospitalChatView } from './components/HospitalChatView.tsx';
import { TopNotificationBanner } from './components/TopNotificationBanner.tsx';
import { FloatingChatWidget } from './components/FloatingChatWidget.tsx';
import { ExitConfirmationModal } from './components/ExitConfirmationModal.tsx';
import { useAppNotifications } from './services/NotificationContext.tsx';
import { AppNotificationTarget } from './types/notification.ts';

type NavigationTab = 'beds' | 'sbar' | 'notes' | 'search' | 'users' | 'settings' | 'chat';

const VALID_TABS: NavigationTab[] = ['beds', 'sbar', 'notes', 'search', 'users', 'settings', 'chat'];
const VALID_BEDS: BedNumber[] = [
  BedNumber.BED_01,
  BedNumber.BED_02,
  BedNumber.BED_03,
  BedNumber.BED_04,
  BedNumber.BED_05,
  BedNumber.BED_06
];

const getInitialNavigationState = (): { tab: NavigationTab; bed: BedNumber | null } => {
  try {
    if (typeof window !== 'undefined') {
      // 1. Check URL hash first (e.g., #tab=beds&bed=06 or #bed-06 or #settings)
      const hash = window.location.hash.replace(/^#/, '');
      if (hash) {
        const urlParams = new URLSearchParams(hash.includes('=') ? hash : `tab=${hash}`);
        const tabParam = urlParams.get('tab') as NavigationTab | null;
        const bedParam = urlParams.get('bed') as BedNumber | null;

        if (tabParam && VALID_TABS.includes(tabParam)) {
          return {
            tab: tabParam,
            bed: bedParam && VALID_BEDS.includes(bedParam) ? bedParam : null
          };
        }
        if (hash.startsWith('bed-')) {
          const bedNum = hash.replace('bed-', '') as BedNumber;
          if (VALID_BEDS.includes(bedNum)) {
            return { tab: 'beds', bed: bedNum };
          }
        }
      }

      // 2. Fall back to localStorage so user stays on current page on reload
      const savedTab = localStorage.getItem('soli_icu_active_tab') as NavigationTab | null;
      const savedBed = localStorage.getItem('soli_icu_selected_bed') as BedNumber | null;

      const tab = (savedTab && VALID_TABS.includes(savedTab)) ? savedTab : 'beds';
      const bed = (savedBed && VALID_BEDS.includes(savedBed)) ? savedBed : null;

      return { tab, bed };
    }
  } catch (err) {
    console.warn('Failed to read initial navigation state:', err);
  }
  return { tab: 'beds', bed: null };
};

export default function App() {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser, isAuthenticated, needsInitialAdminSetup, isLoading: isAuthLoading } = useAuth();
  const { settings } = useSystemSettings();
  const { setNavigationHandler } = useAppNotifications();
  const [isReady, setIsReady] = useState(false);

  // Robust persistent navigation state across reloads
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => getInitialNavigationState().tab);
  const [selectedBedNumber, setSelectedBedNumber] = useState<BedNumber | null>(() => getInitialNavigationState().bed);

  // Sync navigation state with localStorage and URL hash on changes
  useEffect(() => {
    try {
      localStorage.setItem('soli_icu_active_tab', activeTab);
      if (selectedBedNumber) {
        localStorage.setItem('soli_icu_selected_bed', selectedBedNumber);
      } else {
        localStorage.removeItem('soli_icu_selected_bed');
      }

      const hash = selectedBedNumber 
        ? `tab=${activeTab}&bed=${selectedBedNumber}` 
        : `tab=${activeTab}`;
      if (window.location.hash !== `#${hash}`) {
        window.history.replaceState(null, '', `#${hash}`);
      }
    } catch (err) {
      console.warn('Failed to persist navigation state:', err);
    }
  }, [activeTab, selectedBedNumber]);

  // Exit protection state & guard ref
  const [isExitConfirmationOpen, setIsExitConfirmationOpen] = useState(false);
  const isExitingRef = useRef(false);

  // Guard against accidental website exit when pressing Back at root screen
  useEffect(() => {
    if (!settings.features.enableExitProtection) return;

    // Push an initial root barrier state if not already present
    if (activeTab === 'beds' && selectedBedNumber === null) {
      if (!window.history.state || window.history.state.guard !== 'soli_icu_root') {
        window.history.pushState({ guard: 'soli_icu_root' }, '', window.location.href);
      }
    }

    const handlePopStateGuard = () => {
      if (isExitingRef.current) return;

      // If we are at the root level and user presses Back
      if (activeTab === 'beds' && selectedBedNumber === null) {
        // Push state back to prevent leaving
        window.history.pushState({ guard: 'soli_icu_root' }, '', window.location.href);
        // Show the exit confirmation modal
        setIsExitConfirmationOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopStateGuard);
    return () => {
      window.removeEventListener('popstate', handlePopStateGuard);
    };
  }, [activeTab, selectedBedNumber, settings.features.enableExitProtection]);

  const handleConfirmExit = useCallback(() => {
    isExitingRef.current = true;
    setIsExitConfirmationOpen(false);
    // Trigger navigation away
    window.history.go(-2);
  }, []);

  // Support browser back/forward buttons and hash navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const nav = getInitialNavigationState();
      setActiveTab(nav.tab);
      setSelectedBedNumber(nav.bed);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Back button calculation & action
  const canGoBack = selectedBedNumber !== null || activeTab !== 'beds';

  const handleGoBack = useCallback(() => {
    if (selectedBedNumber !== null) {
      setSelectedBedNumber(null);
    } else if (activeTab !== 'beds') {
      setActiveTab('beds');
    } else if (window.history.length > 1) {
      window.history.back();
    }
  }, [selectedBedNumber, activeTab]);

  // Archive Search filters when navigated from notification
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');
  const [archiveFilterType, setArchiveFilterType] = useState<'ALL' | 'ACTIVE_ICU' | 'DISCHARGED' | 'ARCHIVED' | 'DECEASED'>('ALL');

  // Unit State
  const [beds, setBeds] = useState<BedRecord[]>([]);
  const [patients, setPatients] = useState<PatientDossier[]>([]);
  const [latestVitalsMap, setLatestVitalsMap] = useState<Record<string, TelemetryVitals>>({});
  const [ventilatorsMap, setVentilatorsMap] = useState<Record<string, VentilatorParameters>>({});
  const [pumpsMap, setPumpsMap] = useState<Record<string, InfusionPumpLine[]>>({});

  // Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isQuickVitalsOpen, setIsQuickVitalsOpen] = useState(false);
  const [vitalsTarget, setVitalsTarget] = useState<{ bedNumber: BedNumber; patientId: string; patientName: string } | null>(null);
  const [isAddendumOpen, setIsAddendumOpen] = useState(false);
  const [addendumTarget, setAddendumTarget] = useState<{ noteId: string; patientId: string; author: string } | null>(null);
  const [isClinicalNoteOpen, setIsClinicalNoteOpen] = useState(false);
  const [clinicalNoteTarget, setClinicalNoteTarget] = useState<{ bedNumber?: BedNumber; patientId: string; patientName: string } | null>(null);
  const [isSbarModalOpen, setIsSbarModalOpen] = useState(false);
  const [sbarTarget, setSbarTarget] = useState<{ bedNumber: BedNumber; patientId: string; patientName: string; diagnosis: string; codeStatus: any } | null>(null);
  const [readOnlyPatient, setReadOnlyPatient] = useState<PatientDossier | null>(null);

  useEffect(() => {
    setNavigationHandler((target: AppNotificationTarget) => {
      if (!target) return;
      if (target.action === 'OPEN_ARCHIVE') {
        const searchTerm = target.patientMrn || target.patientNameAr || target.patientNameEn || target.patientName || target.patientId || '';
        setArchiveSearchTerm(searchTerm);
        setArchiveFilterType('ALL');
        setActiveTab('search');
      } else if (target.action === 'OPEN_BED' || target.action === 'OPEN_ISOLATION' || target.action === 'OPEN_SBAR') {
        let bedToSelect = target.bedNumber;
        if (!bedToSelect && target.patientId) {
          const matchedBed = (beds || []).find(b => b.currentPatientId === target.patientId);
          if (matchedBed) {
            bedToSelect = matchedBed.bedNumber;
          }
        }

        if (bedToSelect) {
          setSelectedBedNumber(bedToSelect);
          setActiveTab('beds');
          if (target.action === 'OPEN_SBAR') {
            setIsSbarModalOpen(true);
          }
        } else if (target.patientId || target.patientMrn || target.patientName) {
          const searchTerm = target.patientMrn || target.patientNameAr || target.patientNameEn || target.patientName || target.patientId || '';
          setArchiveSearchTerm(searchTerm);
          setArchiveFilterType('ALL');
          setActiveTab('search');
        }
      }
    });
  }, [setNavigationHandler, beds]);

  // Smart admission with automatic vacant bed detection
  const handleSmartAdmission = useCallback(() => {
    const vacantBed = beds.find(b => (b.status === BedStatus.VACANT || b.status === BedStatus.DECONTAMINATING) && !b.currentPatientId);
    if (vacantBed) {
      setSelectedBedNumber(vacantBed.bedNumber as BedNumber);
    } else {
      alert(
        lang === 'ar' 
          ? '⚠️ تنبيه سريري: جميع أسِرّة العناية المركزة الستة (6/6) مشغولة حالياً بالكامل. يرجى تخريج مريض أو نقل حالة لإتاحة سرير شاغر.'
          : '⚠️ Clinical Alert: All 6 ICU beds are currently occupied. Please discharge or transfer a patient to make a bed available.'
      );
    }
  }, [beds, lang]);

  // Load local Dexie data into state
  const reloadData = useCallback(async () => {
    try {
      await ensureBedPatientSync();
      const bList = await db.beds.orderBy('bedNumber').toArray();
      const pList = await db.patients.toArray();
      setBeds(bList);
      setPatients(pList);

      // Latest vitals per bed
      const vitalsList = await db.vitals.toArray();
      const vitMap: Record<string, TelemetryVitals> = {};
      for (const v of vitalsList) {
        const bKey = (v.bedNumber || v.bedId) as string;
        if (bKey && (!vitMap[bKey] || new Date(v.timestamp) > new Date(vitMap[bKey].timestamp))) {
          vitMap[bKey] = v;
        }
      }
      setLatestVitalsMap(vitMap);

      // Active ventilators
      const ventList = await db.ventilators.toArray();
      const vMap: Record<string, VentilatorParameters> = {};
      for (const v of ventList) {
        const bKey = (v.bedNumber || v.bedId) as string;
        if (bKey) {
          vMap[bKey] = v;
        }
      }
      setVentilatorsMap(vMap);

      // Active pumps grouped by patient
      const pumpList = await db.infusionPumps.filter(p => p.status === 'RUNNING' || p.status === 'STANDBY').toArray();
      const pMap: Record<string, InfusionPumpLine[]> = {};
      for (const p of pumpList) {
        if (!pMap[p.patientId]) {
          pMap[p.patientId] = [];
        }
        pMap[p.patientId].push(p);
      }
      setPumpsMap(pMap);
    } catch (err) {
      console.error('Error reloading local ICU database:', err);
    }
  }, []);

  // Quick toggle bed operational status (Vacant <-> Unavailable/Maintenance)
  const handleToggleBedStatus = async (bedNumber: BedNumber) => {
    try {
      const res = await toggleBedOperationalStatus(bedNumber);
      if (res.success) {
        await reloadData();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      console.error('Failed to toggle bed status:', err);
    }
  };

  // Initialize App, Local DB & Firebase Sync
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    async function initSystem() {
      if (!currentUser) {
        setIsReady(false);
        return;
      }
      try {
        // 1. Instant local IndexedDB load: verify beds and seed if brand new
        const bedCount = await db.beds.count();
        if (bedCount === 0) {
          console.log('Initializing 6 vacant beds in local DB...');
          const cleanBeds: BedRecord[] = ['01', '02', '03', '04', '05', '06'].map((num, idx) => ({
            id: num,
            unitId: 'MICU-MAIN',
            bedNumber: num as BedNumber,
            bayName: `Critical Care Bay ${num}`,
            isActive: true,
            displayOrder: idx,
            status: idx === 5 ? BedStatus.UNAVAILABLE : BedStatus.VACANT,
            currentPatientId: null,
            activePatientId: null,
            lastCleanedAt: new Date().toISOString()
          }));
          await db.beds.bulkPut(cleanBeds);
        }

        // Clean out any corrupted phantom telemetry artifacts (e.g. 60/40 BP) on startup
        await purgePhantomCriticalVitals();

        // 2. Instant First-Paint: render full clinical interface immediately
        await reloadData();
        setIsReady(true);

        // 3. Authoritative Real-Time Sync & Initial Snapshot from Firebase Firestore (Single Source of Truth)
        unsubscribeFirestore = subscribeToRealtimeFirestore(async () => {
          await reloadData();
        });
      } catch (e) {
        console.warn('System initialization warning (running in offline/local fallback):', e);
        setIsReady(true);
      }
    }

    initSystem();

    return () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [reloadData, currentUser?.uid]);

  // Dismiss active alert and prevent recurrence for this reading instance
  // Handle ESC key to exit Bedside Flowsheet back to Central 6-Bed Console
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedBedNumber !== null && !isQuickVitalsOpen && !isAddendumOpen && !isSbarModalOpen && !isSettingsOpen && !isUserManagementOpen && !isSearchOpen && !isSidebarOpen) {
        setSelectedBedNumber(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBedNumber, isQuickVitalsOpen, isAddendumOpen, isSbarModalOpen, isSettingsOpen, isUserManagementOpen, isSearchOpen, isSidebarOpen]);

  // Periodic Auto-Refresh for ICU Timelines & 24h Balances
  useEffect(() => {
    const handleIcuDataUpdated = () => {
      reloadData();
    };
    window.addEventListener('icu-data-updated', handleIcuDataUpdated);

    const refreshTimer = setInterval(() => {
      reloadData();
    }, 30000);
    return () => {
      window.removeEventListener('icu-data-updated', handleIcuDataUpdated);
      clearInterval(refreshTimer);
    };
  }, [reloadData, lang]);

  if (!isAuthenticated && !isAuthLoading) {
    return <LoginScreen />;
  }

  if (!isReady || isAuthLoading) {
    return (
      <div 
        className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Ambient background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center space-y-5">
          {/* Prominent Official Logo with Animated Ambient Pulse */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-teal-400/20 blur-xl animate-pulse" />
            <SoliLogo className="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-2xl relative z-10 animate-in zoom-in-90 duration-300" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>SOLI MEDICAL</span>
              <span className="px-2 py-0.5 rounded-md bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-mono font-bold">
                MICU
              </span>
            </h1>
            <p className="text-xs font-medium text-slate-400">
              {lang === 'ar' ? 'محطة العناية المركزة والمزامنة السريرية اللحظية' : 'Intensive Care Unit Clinical Telemetry Station'}
            </p>
          </div>

          {/* High-tech Glowing Progress Bar */}
          <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/60 p-0.5 shadow-inner">
            <div className="h-full bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-3/4 shadow-[0_0_12px_rgba(20,184,166,0.6)]" />
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-teal-400 font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block" />
            <span>
              {lang === 'ar' ? 'جاري تجهيز محطة العناية والمزامنة اللحظية...' : 'INITIALIZING BEDSIDE TELEMETRY SYNC...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Selected Bed Patient Dossier
  const selectedBed = beds.find(b => b.bedNumber === selectedBedNumber);
  const selectedPatient = getPatientForBed(selectedBed, patients);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a] dark:bg-[#070d18] dark:text-[#dbe2fd] flex flex-row font-sans selection:bg-teal-500 selection:text-teal-950 transition-colors duration-200 relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Floating Visual Notification Banner (Gentle 2.8s overlay) */}
      <TopNotificationBanner />

      {/* Sidebar: Full Height Sticky Column on Desktop + Mobile Slide Drawer */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setReadOnlyPatient(null);
          if (tab === 'beds') {
            setSelectedBedNumber(null);
            setActiveTab('beds');
          } else {
            setActiveTab(tab);
          }
          setIsSidebarOpen(false);
        }}
        onOpenAdmission={handleSmartAdmission}
        onOpenSearch={() => {
          setReadOnlyPatient(null);
          setActiveTab('search');
          setIsSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setReadOnlyPatient(null);
          setActiveTab('settings');
          setIsSidebarOpen(false);
        }}
        onOpenUserManagement={() => {
          setActiveTab('users');
          setIsSidebarOpen(false);
        }}
        beds={beds}
        patients={patients}
        selectedBedNumber={selectedBedNumber}
        onSelectBed={(bedNum) => {
          setSelectedBedNumber(bedNum);
          setActiveTab('beds');
          setIsSidebarOpen(false);
        }}
      />

      {/* Main Column: Header Beside Sidebar + Main Content View */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-6">
        {/* Top Header (Sits beside Sidebar on Desktop) */}
        <Header
          beds={beds}
          patients={patients}
          selectedBedNumber={selectedBedNumber}
          onSelectBed={(bedNum) => {
            setSelectedBedNumber(bedNum);
            setActiveTab('beds');
          }}
          onOpenAdmission={handleSmartAdmission}
          onOpenSearch={() => setActiveTab('search')}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onTriggerCloudSync={reloadData}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'beds') {
              setSelectedBedNumber(null);
              setActiveTab('beds');
            } else {
              setActiveTab(tab);
            }
          }}
          canGoBack={canGoBack}
          onGoBack={handleGoBack}
        />

        {/* Main Canvas View - Renders Selected Full Page */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 space-y-5">
          {readOnlyPatient ? (
            <BedsideFlowsheet
              key={`readonly-${readOnlyPatient.id}`}
              bed={{
                bedNumber: (readOnlyPatient.bedNumber || 'ARCHIVED') as any,
                status: 'OCCUPIED',
                occupiedPatientId: readOnlyPatient.id,
                isolation: { isIsolated: false }
              }}
              patient={readOnlyPatient}
              allBeds={[]}
              allPatients={[]}
              onBack={() => setReadOnlyPatient(null)}
              onOpenAddVitals={() => {}}
              onOpenAddClinicalNote={() => {}}
              onOpenAddAddendum={() => {}}
              onOpenSbarSign={() => {}}
              onDataUpdated={() => {}}
              readOnly={true}
            />
          ) : activeTab === 'search' ? (
            <ArchiveSearchModal
              isOpen={true}
              initialSearchTerm={archiveSearchTerm}
              initialFilterType={archiveFilterType}
              onClose={() => {
                setArchiveSearchTerm('');
                setActiveTab('beds');
              }}
              onSelectPatientBed={(bNum) => {
                setSelectedBedNumber(bNum);
                setActiveTab('beds');
              }}
              onViewReadOnlyPatient={(p) => {
                setReadOnlyPatient(p);
              }}
            />
          ) : activeTab === 'users' ? (
            <UserManagementModal
              isOpen={true}
              onClose={() => setActiveTab('beds')}
            />
          ) : activeTab === 'settings' ? (
            <SettingsModal
              isOpen={true}
              onClose={() => setActiveTab('beds')}
              onOpenUserManagement={() => setActiveTab('users')}
              onBedUpdated={reloadData}
            />
          ) : activeTab === 'chat' ? (
            <HospitalChatView />
          ) : (
            /* activeTab === 'beds' */
            selectedBedNumber && selectedBed ? (
              selectedPatient ? (
                /* Bedside Deep Dive Flowsheet */
                <BedsideFlowsheet
                  key={`bed-${selectedBed.bedNumber}-${selectedPatient.id}`}
                  bed={selectedBed}
                  patient={selectedPatient}
                  allBeds={beds}
                  allPatients={patients}
                  onSelectBed={(bedNum) => setSelectedBedNumber(bedNum)}
                  onBack={() => setSelectedBedNumber(null)}
                  onOpenAddVitals={() => {
                    setVitalsTarget({
                      bedNumber: selectedBed.bedNumber,
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.fullNameAr,
                    });
                    setIsQuickVitalsOpen(true);
                  }}
                  onOpenAddClinicalNote={() => {
                    setClinicalNoteTarget({
                      bedNumber: selectedBed.bedNumber,
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.fullNameAr,
                    });
                    setIsClinicalNoteOpen(true);
                  }}
                  onOpenAddAddendum={(noteId, author) => {
                    setAddendumTarget({ noteId, patientId: selectedPatient.id, author });
                    setIsAddendumOpen(true);
                  }}
                  onOpenSbarSign={() => {
                    setSbarTarget({
                      bedNumber: selectedBed.bedNumber,
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.fullNameAr,
                      diagnosis: selectedPatient.primaryDiagnosisAr || selectedPatient.primaryDiagnosisEn,
                      codeStatus: selectedPatient.codeStatus,
                    });
                    setIsSbarModalOpen(true);
                  }}
                  onDataUpdated={reloadData}
                />
              ) : (
                /* Full-Page Bed Vacant Direct Admission Screen */
                <FullPageAdmission
                  key={`vacant-${selectedBedNumber}`}
                  bedNumber={selectedBedNumber}
                  allBeds={beds}
                  allPatients={patients}
                  onCancel={() => setSelectedBedNumber(null)}
                  onAdmissionSuccess={() => {
                    reloadData();
                  }}
                />
              )
            ) : (
              /* 6-Bed Matrix Grid (Central Station Overview) */
              <div className="space-y-4">
                {/* Responsive Grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {beds.map((bed) => {
                    const patient = getPatientForBed(bed, patients);
                    const vitals = latestVitalsMap[bed.bedNumber] || null;
                    const vent = ventilatorsMap[bed.bedNumber] || null;
                    const pList = patient ? pumpsMap[patient.id] || [] : [];

                    return (
                      <BedMatrixCard
                        key={bed.bedNumber}
                        bed={bed}
                        patient={patient}
                        isSelected={selectedBedNumber === bed.bedNumber}
                        onSelectBed={(bNum) => {
                          setSelectedBedNumber(bNum);
                          setActiveTab('beds');
                        }}
                        onAdmitToBed={(bNum) => {
                          setSelectedBedNumber(bNum);
                          setActiveTab('beds');
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )
          )}
        </main>
      </div>

      {/* Quick Vitals Modal */}
      {isQuickVitalsOpen && vitalsTarget && (
        <AddVitalsModal
          isOpen={isQuickVitalsOpen}
          onClose={() => setIsQuickVitalsOpen(false)}
          bedNumber={vitalsTarget.bedNumber}
          patientId={vitalsTarget.patientId}
          patientName={vitalsTarget.patientName}
          onVitalsAdded={reloadData}
        />
      )}

      {/* Add Addendum Modal (Rule 2.6) */}
      {isAddendumOpen && addendumTarget && (
        <AddAddendumModal
          isOpen={isAddendumOpen}
          onClose={() => setIsAddendumOpen(false)}
          noteId={addendumTarget.noteId}
          patientId={addendumTarget.patientId}
          originalNoteAuthor={addendumTarget.author}
          patientName="المريض المحدد"
          onAddendumAppended={reloadData}
        />
      )}

      {/* Sign New Clinical Note Modal */}
      {isClinicalNoteOpen && clinicalNoteTarget && (
        <AddClinicalNoteModal
          isOpen={isClinicalNoteOpen}
          onClose={() => setIsClinicalNoteOpen(false)}
          bedNumber={clinicalNoteTarget.bedNumber}
          patientId={clinicalNoteTarget.patientId}
          patientName={clinicalNoteTarget.patientName}
          onNoteCreated={reloadData}
        />
      )}

      {/* SBAR Shift Handover Modal */}
      {isSbarModalOpen && sbarTarget && (
        <SbarSignModal
          isOpen={isSbarModalOpen}
          onClose={() => setIsSbarModalOpen(false)}
          bedNumber={sbarTarget.bedNumber}
          patientId={sbarTarget.patientId}
          patientName={sbarTarget.patientName}
          primaryDiagnosis={sbarTarget.diagnosis}
          codeStatus={sbarTarget.codeStatus}
          onHandoverSigned={reloadData}
        />
      )}

      {/* Global Real-Time Floating Chat Widget - conditionally hidden when activeTab is chat */}
      <FloatingChatWidget 
        activeTab={activeTab} 
        onOpenFullChatPage={() => setActiveTab('chat')} 
      />

      {/* Accidental Exit Guard Modal */}
      <ExitConfirmationModal
        isOpen={isExitConfirmationOpen}
        onStay={() => setIsExitConfirmationOpen(false)}
        onConfirmExit={handleConfirmExit}
      />
    </div>
  );
}
