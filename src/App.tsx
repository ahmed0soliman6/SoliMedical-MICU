import { useEffect, useState, useCallback } from 'react';
import { initializeDatabaseSeed, db } from './db/icuSyncDb.ts';
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
import { AdmissionModal } from './components/AdmissionModal.tsx';
import { AddAddendumModal } from './components/AddAddendumModal.tsx';
import { SbarSignModal } from './components/SbarSignModal.tsx';
import { ArchiveSearchModal } from './components/ArchiveSearchModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { SbarHandoverView } from './components/SbarHandoverView.tsx';
import { ClinicalNotesView } from './components/ClinicalNotesView.tsx';
import { checkAndExecuteMortalityAutoPurge } from './services/dataModel.ts';
import { 
  subscribeToRealtimeFirestore, 
  seedInitialDataToFirestore 
} from './services/firebase.ts';
import { useTranslation } from './services/i18n.ts';
import { useAuth } from './services/AuthContext.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';

export default function App() {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser, isAuthenticated, needsInitialAdminSetup, isLoading: isAuthLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'beds' | 'sbar' | 'notes'>('beds');
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
  const [isAdmissionOpen, setIsAdmissionOpen] = useState(false);

  const [admissionTargetBed, setAdmissionTargetBed] = useState<BedNumber | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickVitalsOpen, setIsQuickVitalsOpen] = useState(false);
  const [vitalsTarget, setVitalsTarget] = useState<{ bedNumber: BedNumber; patientId: string; patientName: string } | null>(null);
  const [isAddendumOpen, setIsAddendumOpen] = useState(false);
  const [addendumTarget, setAddendumTarget] = useState<{ noteId: string; patientId: string; author: string } | null>(null);
  const [isSbarModalOpen, setIsSbarModalOpen] = useState(false);
  const [sbarTarget, setSbarTarget] = useState<{ bedNumber: BedNumber; patientId: string; patientName: string; diagnosis: string; codeStatus: any } | null>(null);

  // Smart admission with automatic vacant bed detection
  const handleSmartAdmission = useCallback(() => {
    const vacantBed = beds.find(b => b.status === BedStatus.VACANT || !b.currentPatientId);
    if (vacantBed) {
      setAdmissionTargetBed(vacantBed.bedNumber as BedNumber);
      setIsAdmissionOpen(true);
    } else {
      setActiveAlertMessage(
        lang === 'ar' 
          ? '⚠️ تنبيه سريري: جميع أسِرّة العناية المركزة الستة (6/6) مشغولة حالياً بالكامل. يرجى تخريج مريض أو نقل حالة لإتاحة سرير شاغر.'
          : '⚠️ Clinical Alert: All 6 ICU beds are currently occupied. Please discharge or transfer a patient to make a bed available.'
      );
    }
  }, [beds, lang]);

  const reloadData = useCallback(async () => {
    try {
      const allBeds = await db.beds.toArray();
      setBeds(allBeds.sort((a, b) => a.bedNumber.localeCompare(b.bedNumber)));

      const allPatients = await db.patients.toArray();
      setPatients(allPatients);

      // Fetch latest vitals for all beds
      const vMap: Record<string, TelemetryVitals> = {};
      for (const b of allBeds) {
        const latest = await db.vitals
          .where('bedId')
          .equals(b.bedNumber)
          .reverse()
          .sortBy('timestamp');
        if (latest.length > 0) {
          vMap[b.bedNumber] = latest[0];
        }
      }
      setLatestVitalsMap(vMap);

      // Fetch active ventilators
      const vents = await db.ventilators.toArray();
      const ventMap: Record<string, VentilatorParameters> = {};
      vents.forEach(v => {
        ventMap[v.bedId] = v;
      });
      setVentilatorsMap(ventMap);

      // Fetch active pumps
      const pumps = await db.infusionPumps.toArray();
      const pMap: Record<string, InfusionPumpLine[]> = {};
      pumps.forEach(p => {
        if (!pMap[p.patientId]) pMap[p.patientId] = [];
        pMap[p.patientId].push(p);
      });
      setPumpsMap(pMap);
    } catch (err) {
      console.error('Error reloading ICU state:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await initializeDatabaseSeed();
      await checkAndExecuteMortalityAutoPurge();
      await reloadData();
      setIsReady(true);

      // Seed & sync with Firestore asynchronously in background (non-blocking)
      seedInitialDataToFirestore().catch(e => console.warn('Background Firestore sync:', e));
    }
    init();

    // Setup Firebase Real-Time Listener across all devices
    const unsubscribeFirestore = subscribeToRealtimeFirestore(
      () => {
        reloadData();
      },
      (alert) => {
        setActiveAlertMessage(lang === 'ar' ? `السرير ${alert.bedNumber}: ${alert.message}` : `Bed ${alert.bedNumber}: ${alert.message}`);
      }
    );

    // Setup periodic polling backup
    const interval = setInterval(() => {
      reloadData();
    }, 15000);

    return () => {
      unsubscribeFirestore();
      clearInterval(interval);
    };
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
  const selectedPatient = selectedBed?.currentPatientId 
    ? patients.find(p => p.id === selectedBed.currentPatientId) 
    : null;

  return (
    <div className="min-h-screen bg-[#070d18] text-[#dbe2fd] flex flex-col pb-6 selection:bg-teal-500 selection:text-teal-950 font-sans">
      {/* Universal Header with Firebase Cloud Status and Alarm Banner */}
      <Header
        beds={beds}
        patients={patients}
        onOpenAdmission={handleSmartAdmission}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onTriggerCloudSync={reloadData}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedBedNumber(null);
          setActiveTab(tab as any);
        }}
        activeAlertMessage={activeAlertMessage}
        onDismissAlert={() => setActiveAlertMessage(null)}
      />

      {/* Main Container: Persistent Sidebar on Desktop + Clinical Canvas */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row items-start">
        {/* Responsive Slide-out Sidebar Drawer */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setSelectedBedNumber(null);
            setActiveTab(tab as any);
          }}
          onOpenAdmission={handleSmartAdmission}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenUserManagement={() => setIsUserManagementOpen(true)}
          beds={beds}
          patients={patients}
        />

        {/* Main Clinical Canvas */}
        <main className="flex-1 min-w-0 w-full p-3 sm:p-6 space-y-5">
        {selectedBedNumber && selectedBed && selectedPatient ? (
          /* Bedside Deep Dive Flowsheet */
          <BedsideFlowsheet
            bed={selectedBed}
            patient={selectedPatient}
            onBack={() => setSelectedBedNumber(null)}
            onOpenAddVitals={() => {
              setVitalsTarget({
                bedNumber: selectedBed.bedNumber,
                patientId: selectedPatient.id,
                patientName: selectedPatient.fullNameAr,
              });
              setIsQuickVitalsOpen(true);
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
        ) : activeTab === 'beds' ? (
          /* 6-Bed Matrix Grid (Central Station Overview) */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a1224] p-3.5 sm:p-4 rounded-2xl border border-slate-800/80 shadow-md">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>
                    {lang === 'ar' ? 'لوحة المراقبة المركزية للأسِرّة الستة (6-Bed Central Console)' : 'Central Station 6-Bed Monitor Console'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'ar' 
                    ? 'مراقبة فورية ومزامنة سحابية لحظية عبر Firebase لجميع العلامات الحيوية، أجهزة التنفس ومضخات الحقن'
                    : 'Real-time telemetry, ventilator metrics, and infusion pump monitoring with Firebase Cloud Sync'}
                </p>
              </div>

              {/* Direct Admission Button with Automatic Vacant Bed Detection */}
              {beds.length > 0 && (
                <button
                  onClick={handleSmartAdmission}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-lg shadow-teal-500/20 active:scale-95 flex-shrink-0"
                  title={lang === 'ar' ? 'إدخال مريض جديد واختيار أول سرير شاغر تلقائياً' : 'Admit new ICU patient (Auto-detect vacant bed)'}
                >
                  <UserPlus className="w-4 h-4 text-slate-950" />
                  <span>{lang === 'ar' ? 'دخول جديد (اختيار السرير تلقائياً)' : 'New Admission (Auto-Detect Bed)'}</span>
                </button>
              )}
            </div>

            {/* Responsive Grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {beds.map((bed) => {
                const patient = bed.currentPatientId 
                  ? patients.find(p => p.id === bed.currentPatientId) 
                  : null;
                const vitals = latestVitalsMap[bed.bedNumber] || null;
                const vent = ventilatorsMap[bed.bedNumber] || null;
                const pList = patient ? pumpsMap[patient.id] || [] : [];

                return (
                  <BedMatrixCard
                    key={bed.bedNumber}
                    bed={bed}
                    patient={patient}
                    latestVitals={vitals}
                    ventilator={vent}
                    pumps={pList}
                    onSelectBed={(bNum) => setSelectedBedNumber(bNum)}
                    onOpenQuickVitals={(bNum, pId) => {
                      setVitalsTarget({
                        bedNumber: bNum,
                        patientId: pId,
                        patientName: patient?.fullNameAr || '',
                      });
                      setIsQuickVitalsOpen(true);
                    }}
                    onAdmitToBed={(bNum) => {
                      setAdmissionTargetBed(bNum);
                      setIsAdmissionOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : activeTab === 'sbar' ? (
          /* SBAR Master Handover Board */
          <SbarHandoverView
            beds={beds}
            patients={patients}
            onOpenSbarSignForBed={(bNum) => {
              const b = beds.find(x => x.bedNumber === bNum);
              const p = b?.currentPatientId ? patients.find(x => x.id === b.currentPatientId) : null;
              if (b && p) {
                setSbarTarget({
                  bedNumber: b.bedNumber,
                  patientId: p.id,
                  patientName: p.fullNameAr,
                  diagnosis: p.primaryDiagnosisAr || p.primaryDiagnosisEn,
                  codeStatus: p.codeStatus,
                });
                setIsSbarModalOpen(true);
              }
            }}
          />
        ) : (
          /* Clinical Notes & SHA-256 Addendums Board */
          <ClinicalNotesView
            beds={beds}
            patients={patients}
            onOpenAddAddendum={(noteId, author) => {
              setAddendumTarget({ noteId, patientId: '', author });
              setIsAddendumOpen(true);
            }}
          />
        )}
      </main>
    </div>

      {/* System Settings & Customization Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Direct Admission Modal */}
      {isAdmissionOpen && (
        <AdmissionModal
          isOpen={isAdmissionOpen}
          onClose={() => setIsAdmissionOpen(false)}
          beds={beds}
          targetBedNumber={admissionTargetBed}
          onAdmissionSuccess={reloadData}
        />
      )}

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

      {/* Archive & MRN Search Modal */}
      {isSearchOpen && (
        <ArchiveSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectPatientBed={(bNum) => {
            setSelectedBedNumber(bNum);
            setActiveTab('beds');
          }}
        />
      )}

      {/* User Management & Access Control Modal (RBAC) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
      />
    </div>
  );
}
