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
import { checkAndExecuteMortalityAutoPurge, getPatientForBed } from './services/dataModel.ts';
import { 
  subscribeToRealtimeFirestore, 
  seedInitialDataToFirestore,
  ensureAuthenticated
} from './services/firebase.ts';
import { useTranslation } from './services/i18n.ts';
import { useAuth } from './services/AuthContext.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';
import { FullPageAdmission } from './components/FullPageAdmission.tsx';
import { HospitalChatView } from './components/HospitalChatView.tsx';

export default function App() {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser, isAuthenticated, needsInitialAdminSetup, isLoading: isAuthLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'beds' | 'sbar' | 'notes' | 'search' | 'users' | 'settings' | 'chat'>('beds');
  const [selectedBedNumber, setSelectedBedNumber] = useState<BedNumber | null>(null);
  const [activeAlertMessage, setActiveAlertMessage] = useState<string | null>(null);

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

      // Check auto-purge expired mortal records
      await checkAndExecuteMortalityAutoPurge();
    } catch (err) {
      console.error('Error reloading local ICU database:', err);
    }
  }, []);

  // Initialize App, Local DB & Firebase Sync
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    async function initSystem() {
      try {
        // Ensure anonymous/custom auth for Firebase security rules
        await ensureAuthenticated();

        // Check if local DB is initialized
        const bedCount = await db.beds.count();
        if (bedCount === 0) {
          console.log('Initializing local Dexie indexed database seed...');
          await initializeDatabaseSeed();
          // Also seed initial data to Firestore cloud if empty
          await seedInitialDataToFirestore();
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
  }, [reloadData]);

  // Periodic Telemetry MAP & Desaturation Safety Monitor
  useEffect(() => {
    const alertInterval = setInterval(async () => {
      const activeVitals: TelemetryVitals[] = Object.values(latestVitalsMap);
      const criticalBed = activeVitals.find(v => v.meanArterialPressureMmHg < 65 || (v.spo2Percent || v.oxygenSaturationPercent || 100) < 88);
      if (criticalBed) {
        const bedNum = criticalBed.bedNumber || criticalBed.bedId;
        const bedLabel = lang === 'ar' ? `السرير ${bedNum}` : `Bed ${bedNum}`;
        const spo2 = criticalBed.spo2Percent || criticalBed.oxygenSaturationPercent || 0;
        const issue = criticalBed.meanArterialPressureMmHg < 65 
          ? (lang === 'ar' ? `انخفاض حاد في الضغط الشرياني الوسطي MAP (${criticalBed.meanArterialPressureMmHg} mmHg)` : `Critical MAP Drop (${criticalBed.meanArterialPressureMmHg} mmHg)`)
          : (lang === 'ar' ? `هبوط نسبة تشبع الأكسجين SpO₂ (${spo2}%)` : `Critical Desaturation SpO₂ (${spo2}%)`);
        setActiveAlertMessage(`🚨 STAT ALERT [${bedLabel}]: ${issue} — Immediate intervention required!`);
      }
    }, 15000);

    return () => clearInterval(alertInterval);
  }, [latestVitalsMap, lang]);

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
      <div className="min-h-screen bg-[#070d18] text-teal-400 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center animate-spin">
          <span className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full"></span>
        </div>
        <div className="text-sm font-bold font-mono tracking-widest text-slate-300">
          INITIALIZING SOLI MEDICAL MICU (FIREBASE REAL-TIME CLOUD SYNC)...
        </div>
      </div>
    );
  }

  // Selected Bed Patient Dossier
  const selectedBed = beds.find(b => b.bedNumber === selectedBedNumber);
  const selectedPatient = getPatientForBed(selectedBed, patients);

  return (
    <div className="min-h-screen bg-[#070d18] text-[#dbe2fd] flex flex-row font-sans selection:bg-teal-500 selection:text-teal-950" dir={isRTL ? 'rtl' : 'ltr'}>
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
          onDismissAlert={() => setActiveAlertMessage(null)}
        />

        {/* Main Canvas View - Renders Selected Full Page */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 space-y-5">
          {activeTab === 'search' ? (
            <ArchiveSearchModal
              isOpen={true}
              onClose={() => setActiveTab('beds')}
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
