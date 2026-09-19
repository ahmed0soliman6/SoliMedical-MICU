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
import { getPatientForBed } from './services/dataModel.ts';
import { purgePhantomCriticalVitals } from './db/icuSyncDb.ts';
import { 
  subscribeToRealtimeFirestore, 
  seedInitialDataToFirestore,
  pullCloudDataToLocalDb
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
import { useAppNotifications } from './services/NotificationContext.tsx';
import { AppNotificationTarget } from './types/notification.ts';

export default function App() {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser, isAuthenticated, needsInitialAdminSetup, isLoading: isAuthLoading } = useAuth();
  const { settings } = useSystemSettings();
  const { setNavigationHandler, triggerNotification } = useAppNotifications();
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'beds' | 'sbar' | 'notes' | 'search' | 'users' | 'settings' | 'chat'>('beds');
  const [selectedBedNumber, setSelectedBedNumber] = useState<BedNumber | null>(null);
  const [activeAlertMessage, setActiveAlertMessage] = useState<string | null>(null);
  const [currentAlertKey, setCurrentAlertKey] = useState<string | null>(null);
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('soli_icu_dismissed_alerts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

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
      setActiveAlertMessage(
        lang === 'ar' 
          ? '⚠️ تنبيه سريري: جميع أسِرّة العناية المركزة الستة (6/6) مشغولة حالياً بالكامل. يرجى تخريج مريض أو نقل حالة لإتاحة سرير شاغر.'
          : '⚠️ Clinical Alert: All 6 ICU beds are currently occupied. Please discharge or transfer a patient to make a bed available.'
      );
    }
  }, [beds, lang]);

  // Load local Dexie data into state
  const reloadData = useCallback(async () => {
    try {
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

        // 3. Background Cloud Reconcile: pull fresh Firestore data asynchronously without freezing screen
        (async () => {
          try {
            await pullCloudDataToLocalDb();
            await reloadData();
          } catch (cloudErr) {
            console.warn('Background cloud sync notice:', cloudErr);
          }
        })();

        // 4. Subscribe to ongoing real-time cloud changes from Firebase Firestore
        unsubscribeFirestore = subscribeToRealtimeFirestore(async () => {
          console.log('Firestore cloud delta received. Synchronizing local state...');
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
  const handleDismissAlert = useCallback(async () => {
    let bedNumToPurge = '02';
    if (activeAlertMessage) {
      const match = activeAlertMessage.match(/(?:السرير|Bed)\s*(\d+)/i);
      if (match && match[1]) {
        bedNumToPurge = match[1];
      }
    }

    // 1. Purge corrupted vitals from IndexedDB and normalize bed reading
    await purgePhantomCriticalVitals(bedNumToPurge);
    await reloadData();

    // 2. Persist dismissed alert keys in state & localStorage
    setDismissedAlertKeys(prev => {
      const updated = new Set(prev);
      if (currentAlertKey) updated.add(currentAlertKey);
      const rawNum = bedNumToPurge;
      const paddedNum = rawNum.padStart(2, '0');
      const intNum = Number(rawNum);
      updated.add(`bed-${rawNum}`);
      updated.add(`bed-${paddedNum}`);
      updated.add(`bed-${intNum}`);
      updated.add(`bed-${paddedNum}-latest`);
      updated.add(`bed-${intNum}-latest`);
      updated.add(`bed-${paddedNum}-vit-bed-${paddedNum}`);
      updated.add(`bed-${intNum}-vit-bed-${paddedNum}`);
      try {
        localStorage.setItem('soli_icu_dismissed_alerts', JSON.stringify(Array.from(updated)));
      } catch (e) {
        console.warn('Unable to persist dismissed alerts:', e);
      }
      return updated;
    });

    // 3. Prune critical telemetry notification entries for this bed from storage
    try {
      const rawNotifs = localStorage.getItem('soli_icu_notifications_queue_v2');
      if (rawNotifs) {
        const notifs = JSON.parse(rawNotifs);
        if (Array.isArray(notifs)) {
          const filtered = notifs.filter((n: any) => {
            const isStat = n.type === 'CRITICAL_TELEMETRY';
            const matchesBed = n.target?.bedNumber === bedNumToPurge || n.target?.bedNumber === bedNumToPurge.padStart(2, '0');
            return !(isStat && matchesBed);
          });
          localStorage.setItem('soli_icu_notifications_queue_v2', JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.warn('Unable to prune notifications queue:', e);
    }

    setActiveAlertMessage(null);
    setCurrentAlertKey(null);
  }, [currentAlertKey, activeAlertMessage, reloadData]);

  // Periodic Telemetry MAP, BP & Desaturation Safety Monitor with Customizable Thresholds
  useEffect(() => {
    const thresholds = settings.notifications?.vitalThresholds || DEFAULT_VITAL_THRESHOLDS;
    if (!thresholds.enableTelemetryAlerts) {
      if (activeAlertMessage && activeAlertMessage.startsWith('🚨 STAT ALERT')) {
        setActiveAlertMessage(null);
        setCurrentAlertKey(null);
      }
      return;
    }

    const checkCriticalVitals = () => {
      // Only evaluate beds that are actively OCCUPIED with an admitted patient
      const occupiedBeds = (beds || []).filter(b => b.status === BedStatus.OCCUPIED && b.currentPatientId);
      if (occupiedBeds.length === 0) {
        if (activeAlertMessage && activeAlertMessage.startsWith('🚨 STAT ALERT')) {
          setActiveAlertMessage(null);
          setCurrentAlertKey(null);
        }
        return;
      }

      let foundAlert: { 
        key: string; 
        message: string; 
        bedNumber: BedNumber; 
        patientId?: string;
        issueAr: string; 
        issueEn: string 
      } | null = null;

      for (const bed of occupiedBeds) {
        const bedNum = bed.bedNumber;
        const v = latestVitalsMap[bedNum];
        if (!v) continue;

        const vitId = v.id || v.timestamp || 'latest';
        const alertKey = `bed-${bedNum}-${vitId}`;
        const isDismissed = 
          dismissedAlertKeys.has(alertKey) || 
          dismissedAlertKeys.has(`bed-${bedNum}`) || 
          dismissedAlertKeys.has(`bed-${Number(bedNum)}`) || 
          dismissedAlertKeys.has(`bed-${String(bedNum).padStart(2, '0')}`);
        if (isDismissed) continue;

        const sys = Number(v.systolicBpMmHg || (v as any).systolicBloodPressureMmHg || (v as any).systolicBp || 120);
        const dia = Number(v.diastolicBpMmHg || (v as any).diastolicBloodPressureMmHg || (v as any).diastolicBp || 80);
        const calculatedMap = Math.round((sys + 2 * dia) / 3);
        const rawMap = Number(v.meanArterialPressureMmHg || calculatedMap);
        // Ensure MAP is clinically consistent with Sys/Dia (fallback to calculated if inconsistent or corrupted)
        const map = (rawMap > 0 && Math.abs(rawMap - calculatedMap) <= 20) ? rawMap : calculatedMap;
        const spo2 = Number(v.spo2Percent || (v as any).oxygenSaturationPercent || 98);
        const hr = Number(v.heartRateBpm || (v as any).pulseBpm || 75);

        const isHypotensive = (sys < thresholds.minSystolicBp || dia < thresholds.minDiastolicBp || map < thresholds.minMap);
        const isHypoxic = spo2 < thresholds.minSpo2;
        const isBrady = hr < thresholds.minHeartRate;
        const isTachy = hr > thresholds.maxHeartRate;

        if (isHypotensive || isHypoxic || isBrady || isTachy) {
          const bedLabel = lang === 'ar' ? `السرير ${bedNum}` : `Bed ${bedNum}`;
          let issueAr = '';
          let issueEn = '';

          if (isHypotensive) {
            issueAr = `انخفاض حاد في ضغط الدم (${sys}/${dia} ملم زئبق، MAP ${map})`;
            issueEn = `Severe Hypotension (BP ${sys}/${dia}, MAP ${map} mmHg)`;
          } else if (isHypoxic) {
            issueAr = `هبوط حاد في تشبع الأكسجين SpO₂ (${spo2}%)`;
            issueEn = `Critical Hypoxemia SpO₂ (${spo2}%)`;
          } else if (isBrady) {
            issueAr = `تباطؤ نبض حاد (${hr} bpm)`;
            issueEn = `Severe Bradycardia (${hr} bpm)`;
          } else if (isTachy) {
            issueAr = `تسارع نبض حاد (${hr} bpm)`;
            issueEn = `Severe Tachycardia (${hr} bpm)`;
          }

          foundAlert = {
            key: alertKey,
            bedNumber: bedNum,
            patientId: bed.currentPatientId || undefined,
            issueAr,
            issueEn,
            message: `🚨 STAT ALERT [${bedLabel}]: ${lang === 'ar' ? issueAr : issueEn} — ${lang === 'ar' ? 'يتطلب تدخلاً سريرياً عاجلاً!' : 'Immediate intervention required!'}`
          };
          break;
        }
      }

      if (foundAlert) {
        if (currentAlertKey !== foundAlert.key) {
          setCurrentAlertKey(foundAlert.key);
          setActiveAlertMessage(foundAlert.message);

          // Trigger system-wide notification connected to NotificationSettingsCard
          triggerNotification({
            type: 'CRITICAL_TELEMETRY',
            titleAr: `تنبيه طارئ STAT [سرير ${foundAlert.bedNumber}]`,
            titleEn: `STAT ALERT [Bed ${foundAlert.bedNumber}]`,
            messageAr: foundAlert.issueAr,
            messageEn: foundAlert.issueEn,
            target: {
              action: 'OPEN_BED',
              bedNumber: foundAlert.bedNumber,
              patientId: foundAlert.patientId,
            },
          });
        }
      } else {
        if (activeAlertMessage && activeAlertMessage.startsWith('🚨 STAT ALERT')) {
          setActiveAlertMessage(null);
          setCurrentAlertKey(null);
        }
      }
    };

    checkCriticalVitals();
    const alertInterval = setInterval(checkCriticalVitals, 15000);
    return () => clearInterval(alertInterval);
  }, [beds, latestVitalsMap, lang, settings.notifications?.vitalThresholds, dismissedAlertKeys, activeAlertMessage]);

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
    const refreshTimer = setInterval(() => {
      reloadData();
    }, 30000);
    return () => clearInterval(refreshTimer);
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
          setActiveTab('search');
          setIsSidebarOpen(false);
        }}
        onOpenSettings={() => {
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
          activeAlertMessage={activeAlertMessage}
          onDismissAlert={handleDismissAlert}
        />

        {/* Main Canvas View - Renders Selected Full Page */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 space-y-5">
          {activeTab === 'search' ? (
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

      {/* Global Real-Time Floating Chat Widget */}
      <FloatingChatWidget onOpenFullChatPage={() => setActiveTab('chat')} />
    </div>
  );
}
