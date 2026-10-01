import { deleteClinicalNoteFromCloud } from '../services/firebase.ts';

interface ClinicalNotesViewProps {
  beds: BedRecord[];
  patients: PatientDossier[];
  onOpenAddAddendum: (noteId: string, author: string, defaultReason?: 'CLINICAL_UPDATE' | 'CORRECTION' | 'LAB_CORRELATION' | 'CONSULTANT_COUNTERSIGN' | 'HANDOVER_NOTE') => void;
}

export const ClinicalNotesView: React.FC<ClinicalNotesViewProps> = ({
  patients,
  onOpenAddAddendum,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  // Automatically collapsed by default
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAllNotes();
  }, []);

  const loadAllNotes = async () => {
    const list = await db.clinicalNotes.reverse().sortBy('timestamp');
    setNotes(list);
  };

  const toggleNote = (noteId: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  const allExpanded = notes.length > 0 && notes.every(n => expandedNotes[n.id]);

  const toggleAllNotes = () => {
    if (allExpanded) {
      setExpandedNotes({});
    } else {
      const nextState: Record<string, boolean> = {};
      notes.forEach(n => {
        nextState[n.id] = true;
      });
      setExpandedNotes(nextState);
    }
  };

  const canUserDeleteNote = (note: ClinicalNote): boolean => {
    return canDeleteClinicalNote(currentUser, note);
  };

  const handleDeleteNote = async (e: React.MouseEvent, note: ClinicalNote) => {
    e.stopPropagation();

    if (!canDeleteClinicalNote(currentUser, note)) {
      alert(
        lang === 'ar'
          ? 'عفواً، حذف الملاحظة متاح فقط للمدير، أو من لديه صلاحية الحذف من المدير، أو صاحب الملاحظة فقط.'
          : 'Unauthorized: Deleting this clinical note is restricted to Admins, staff granted delete permission, or the note author only.'
      );
      return;
    }

    const confirmed = window.confirm(
      lang === 'ar'
        ? `هل أنت متأكد من حذف الملاحظة السريرية "${note.title}"؟\nسيتم حذفها نهائياً من السجل والمزامنة السحابية.`
        : `Are you sure you want to delete clinical note "${note.title}"?`
    );

    if (!confirmed) return;

    try {
      // 1. Delete from Dexie local database
      await db.clinicalNotes.delete(note.id);
      await db.addendums.where('noteId').equals(note.id).delete().catch(() => {});

      // 2. Delete from Cloud Firestore
      await deleteClinicalNoteFromCloud(note.id);

      // 3. Update local state
      setNotes(prev => prev.filter(n => n.id !== note.id));
    } catch (err) {
      console.error('Error deleting clinical note:', err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء حذف الملاحظة.' : 'Error deleting clinical note.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl text-slate-900 dark:text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'الملاحظات الطبية وملحقاتها والعروضات الطبية' : 'Clinical Notes, Ledger & Referrals'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? 'سجل الملاحظات السريرية ونظام العروضات الطبية (Consultations) والرد عليها'
                  : 'Clinical progress notes, specialty consultation referrals & replies'}
              </p>
            </div>
          </div>

          {notes.length > 0 && (
            <button
              onClick={toggleAllNotes}
              className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700/60"
            >
              {allExpanded ? <ChevronUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> : <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
              <span>
                {allExpanded 
                  ? (lang === 'ar' ? 'طي جميع الملاحظات' : 'Collapse All') 
                  : (lang === 'ar' ? 'فتح جميع الملاحظات' : 'Expand All')}
              </span>
            </button>
          )}
        </div>

        <div className="space-y-3 mt-4">
          {notes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              {lang === 'ar' ? 'لا توجد ملاحظات طبية مسجلة حالياً.' : 'No clinical notes recorded currently.'}
            </div>
          ) : (
            notes.map((note) => {
              const matchedPatient = patients.find(p => p.id === note.patientId);
              const isExpanded = !!expandedNotes[note.id];
              
              // Determine if this is a consultation note and if it has a reply
              const isConsultation = note.noteType === 'CONSULTATION_NOTE' || note.noteType === NoteType.CONSULTATION_NOTE;
              const hasReply = note.consultationStatus === 'REPLIED' || (note.addendums && note.addendums.some(a => a.reasonForAddendum === 'CONSULTANT_COUNTERSIGN'));
              
              // Extract reply addendums for highlighted rendering
              const replyAddendums = note.addendums?.filter(a => a.reasonForAddendum === 'CONSULTANT_COUNTERSIGN') || [];
              const otherAddendums = note.addendums?.filter(a => a.reasonForAddendum !== 'CONSULTANT_COUNTERSIGN') || [];
              const totalAddendums = (note.addendums?.length || 0);

              const canDelete = canUserDeleteNote(note);

              return (
                <div 
                  key={note.id}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isConsultation
                      ? hasReply
                        ? 'border-emerald-300 bg-emerald-50/90 shadow-md dark:border-emerald-500/30 dark:bg-[#061514] dark:shadow-emerald-950/20'
                        : 'border-amber-300 bg-amber-50/90 shadow-md dark:border-amber-500/30 dark:bg-[#121111] dark:shadow-amber-950/20'
                      : 'bg-white border-slate-200 shadow-sm dark:bg-[#070c18] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Collapsible Header */}
                  <div 
                    onClick={() => toggleNote(note.id)}
                    className={`p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none transition-colors ${
                      isExpanded 
                        ? 'border-b border-slate-200 bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/40' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                      <button 
                        type="button" 
                        className="p-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-teal-600 dark:text-teal-400" /> : <ChevronDown className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                      </button>

                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate">{note.title}</span>
                      
                      <span className="text-xs text-teal-700 dark:text-teal-400 font-mono font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
                        {matchedPatient?.fullNameAr || matchedPatient?.fullNameEn || (note.patientId ? (lang === 'ar' ? `مريض #${note.patientId.slice(0, 8)}` : `Patient #${note.patientId.slice(0, 8)}`) : (lang === 'ar' ? 'مريض غير محدد' : 'Unknown Patient'))}
                      </span>
                      
                      {/* Note Classification Badge */}
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                        isConsultation
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}>
                        {isConsultation 
                          ? (lang === 'ar' ? '📋 طلب عرض / استشارة' : 'Referral Consultation') 
                          : note.noteType}
                      </span>

                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {new Date(note.timestamp).toLocaleString('en-US')}
                      </span>

                      {/* Author badge in header for collapsed quick view */}
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline-flex items-center gap-1">
                        <span className="text-slate-400 dark:text-slate-500">•</span>
                        <span>{note.authorName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">({note.authorRole})</span>
                      </span>

                      {/* Addendums counter badge */}
                      {totalAddendums > 0 && !isExpanded && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/40">
                          {totalAddendums} {lang === 'ar' ? 'ملحق' : 'addendum'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Consultation Status Badges */}
                      {isConsultation && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          hasReply
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                            : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                        }`}>
                          {hasReply ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{lang === 'ar' ? 'تم الرد' : 'Answered'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>{lang === 'ar' ? 'قيد الانتظار' : 'Pending'}</span>
                            </>
                          )}
                        </span>
                      )}

                      {/* Quick Consultation Reply Trigger */}
                      {isConsultation && !hasReply ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddAddendum(note.id, note.authorName || 'Staff Doctor', 'CONSULTANT_COUNTERSIGN');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer active:scale-95"
                          title={lang === 'ar' ? 'تسجيل الرد على العرض' : 'Write Consult Reply'}
                        >
                          <span>{lang === 'ar' ? '✍️ تسجيل الرد' : 'Reply'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddAddendum(note.id, note.authorName || 'Staff Doctor', 'CLINICAL_UPDATE');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-300 dark:border-purple-500/40 text-xs font-bold transition-all cursor-pointer"
                          title={lang === 'ar' ? 'إلحاق ملحق' : 'Append Addendum'}
                        >
                          {lang === 'ar' ? '+ ملحق' : '+ Addendum'}
                        </button>
                      )}

                      {/* Delete Button (Allowed for Admin, Authorized user, or Author) */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNote(e, note)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border ${
                          canDelete 
                            ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/25 dark:border-rose-500/30 dark:text-rose-400 dark:hover:text-rose-300' 
                            : 'bg-slate-100 hover:bg-rose-50 border-slate-300 text-slate-600 hover:text-rose-700 dark:bg-slate-800/80 dark:hover:bg-rose-950/40 dark:border-slate-700 dark:text-slate-400 dark:hover:text-rose-400'
                        }`}
                        title={lang === 'ar' ? 'حذف الملاحظة (المدير أو صاحب الصلاحية أو كاتب الملاحظة فقط)' : 'Delete Note (Admin, authorized user, or author only)'}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                        <span className="font-medium">{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Body Content */}
                  {isExpanded && (
                    <div className="p-4 space-y-3 animate-in fade-in duration-200">
                      {/* Consultation Specialty Banner */}
                      {isConsultation && note.consultationSpecialty && (
                        <div className="p-2.5 rounded-lg bg-teal-50/70 dark:bg-slate-900/60 border border-teal-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-teal-800 dark:text-teal-300">
                          <div className="flex items-center gap-1.5">
                            <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <span>{lang === 'ar' ? 'التخصص الطبي المطلوب مراجعته:' : 'Target Specialty Consulted:'}</span>
                            <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-300 font-bold">{note.consultationSpecialty}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {lang === 'ar' ? 'يرجى تسجيل الرد لحفظ الملف طبيًا وقانونيًا' : 'Official reply required for medical documentation'}
                          </span>
                        </div>
                      )}

                      {/* Main Note Content */}
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800/30">
                        {note.content}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80 mt-2 text-xs">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>{lang === 'ar' ? 'الكاتب: ' : 'Author: '}</span>
                          <strong className="text-slate-900 dark:text-slate-200">{note.authorName}</strong> 
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 text-[10px]">{note.authorRole}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNote(e, note)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/30 dark:text-rose-400 dark:hover:text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title={lang === 'ar' ? 'حذف الملاحظة السريرية' : 'Delete Clinical Note'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'حذف الملاحظة' : 'Delete Note'}</span>
                        </button>
                      </div>

                      {/* Highlighting Consultation Replies */}
                      {replyAddendums.length > 0 && (
                        <div className="space-y-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                          {replyAddendums.map((reply) => (
                            <div 
                              key={reply.id} 
                              className={`p-3 rounded-xl border bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/10 dark:border-emerald-500/30 space-y-2 ${
                                isRTL ? 'border-r-4 border-r-emerald-500' : 'border-l-4 border-l-emerald-500'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>{lang === 'ar' ? '🩺 الرد الطبي الرسمي المعتمد من الاستشاري:' : '🩺 Official Consultant Response:'}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                  {new Date(reply.timestamp).toLocaleString('en-US')}
                                </span>
                              </div>
                              <p className="text-slate-800 dark:text-slate-100 text-xs leading-relaxed whitespace-pre-line font-medium bg-white dark:bg-[#030a09] p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/20">
                                {reply.content}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                <div>
                                  {lang === 'ar' ? 'الطبيب المستشار: ' : 'Consultant: '}
                                  <strong className="text-emerald-700 dark:text-emerald-300">{reply.authorName}</strong> ({reply.authorRole})
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Standard Chained Addendums */}
                      {otherAddendums.length > 0 && (
                        <div className={`bg-purple-50/70 dark:bg-[#0a101f] border border-purple-200 dark:border-slate-800 p-3 rounded-lg space-y-2 mt-2 ${isRTL ? 'border-r-4 border-purple-500' : 'border-l-4 border-purple-500'}`}>
                          <div className="text-[11px] font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                              {lang === 'ar' 
                                ? `الملحقات التوضيحية والتعديلات (${otherAddendums.length}):` 
                                : `Addendums & Updates (${otherAddendums.length}):`}
                            </span>
                          </div>

                          {otherAddendums.map((addendum) => (
                            <div key={addendum.id} className="text-xs space-y-1 bg-white dark:bg-[#070c17] p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/20">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                <span>{new Date(addendum.timestamp).toLocaleString('en-US')}</span>
                              </div>
                              <p className="text-slate-800 dark:text-slate-200">{addendum.content}</p>
                              <div className="text-[10px] text-purple-800 dark:text-purple-300">
                                {lang === 'ar' 
                                  ? `السبب: ${addendum.reasonForAddendum} • الطبيب: ${addendum.authorName} (${addendum.authorRole})` 
                                  : `Reason: ${addendum.reasonForAddendum} • Clinician: ${addendum.authorName} (${addendum.authorRole})`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  ]
