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
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<Set<string>>(() => new Set());

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
        // 1. Try pulling fresh cloud data from Firestore first
        const hasCloudData = await pullCloudDataToLocalDb();
        if (!hasCloudData) {
          const bedCount = await db.beds.count();
          if (bedCount === 0) {
            console.log('Initializing 6 vacant beds...');
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
        }

        await reloadData();

        // Subscribe to real-time cloud changes from Firebase Firestore
        unsubscribeFirestore = subscribeToRealtimeFirestore(async () => {
          console.log('Firestore cloud delta received. Synchronizing local state...');
          await reloadData();
        });

        setIsReady(true);
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
  const handleDismissAlert = useCallback(() => {
    if (currentAlertKey) {
      setDismissedAlertKeys(prev => new Set([...prev, currentAlertKey]));
    }
    setActiveAlertMessage(null);
    setCurrentAlertKey(null);
  }, [currentAlertKey]);

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
        if (dismissedAlertKeys.has(alertKey)) continue;

        const sys = Number(v.systolicBloodPressureMmHg || (v as any).systolicBp || 120);
        const dia = Number(v.diastolicBloodPressureMmHg || (v as any).diastolicBp || 80);
        const map = Number(v.meanArterialPressureMmHg || Math.round((sys + 2 * dia) / 3));
        const spo2 = Number(v.spo2Percent || v.oxygenSaturationPercent || 98);
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
      <div className="min-h-screen bg-slate-100 text-teal-600 dark:bg-[#070d18] dark:text-teal-400 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center animate-spin">
          <span className="w-6 h-6 border-2 border-teal-500 dark:border-teal-400 border-t-transparent rounded-full"></span>
        </div>
        <div className="text-sm font-bold font-mono tracking-widest text-slate-600 dark:text-slate-300">
          INITIALIZING SOLI MEDICAL MICU (FIREBASE REAL-TIME CLOUD SYNC)...
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
    </div>
  );
}
