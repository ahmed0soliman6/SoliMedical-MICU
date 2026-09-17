import React, { useState, useEffect } from 'react';
import { FileText, Lock } from 'lucide-react';
import { ClinicalNote, PatientDossier, BedRecord } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { useTranslation } from '../services/i18n.ts';

interface ClinicalNotesViewProps {
  beds: BedRecord[];
  patients: PatientDossier[];
  onOpenAddAddendum: (noteId: string, author: string) => void;
}

export const ClinicalNotesView: React.FC<ClinicalNotesViewProps> = ({
  patients,
  onOpenAddAddendum,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);

  useEffect(() => {
    loadAllNotes();
  }, []);

  const loadAllNotes = async () => {
    const list = await db.clinicalNotes.reverse().sortBy('timestamp');
    setNotes(list);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {lang === 'ar' ? 'الملاحظات الطبية وملحقاتها (Rule 2.6 Immutability)' : 'Central Immutable Clinical Notes & Ledger'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'سجل الملاحظات والقرارات الطبية المحمية بتشفير SHA-256 مع سلاسل الملحقات التراكمية'
                  : 'CBAHI & HIPAA cryptographic progress notes with SHA-256 hashed addendum chains'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 mt-4">
          {notes.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              {lang === 'ar' ? 'لا توجد ملاحظات طبية مسجلة حالياً.' : 'No clinical notes recorded currently.'}
            </div>
          ) : (
            notes.map((note) => {
              const matchedPatient = patients.find(p => p.id === note.patientId);

              return (
                <div 
                  key={note.id}
                  className="bg-[#070c18] border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{note.title}</span>
                      <span className="text-xs text-teal-400 font-mono font-semibold px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/60">
                        {matchedPatient?.fullNameAr || matchedPatient?.fullNameEn || (note.patientId ? (lang === 'ar' ? `مريض #${note.patientId.slice(0, 8)}` : `Patient #${note.patientId.slice(0, 8)}`) : (lang === 'ar' ? 'مريض غير محدد' : 'Unknown Patient'))}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {note.noteType} • {new Date(note.timestamp).toLocaleString('en-US')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-teal-400 px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/60">
                        SHA-256: {note.cryptographicHash ? note.cryptographicHash.slice(0, 12) : 'HASH'}...
                      </span>
                      <button
                        onClick={() => onOpenAddAddendum(note.id, note.authorName || 'Staff Doctor')}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all"
                      >
                        {lang === 'ar' ? '+ إلحاق ملحق (Addendum)' : '+ Append Addendum'}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {note.content}
                  </p>

                  <div className="text-[11px] text-slate-400">
                    {lang === 'ar' ? 'الكاتب: ' : 'Author: '}<strong className="text-slate-200">{note.authorName}</strong> ({note.authorRole})
                  </div>

                  {/* Chained Addendums */}
                  {note.addendums && note.addendums.length > 0 && (
                    <div className={`bg-[#0a101f] p-3 rounded-lg space-y-2 mt-2 ${isRTL ? 'border-r-2 border-purple-500' : 'border-l-2 border-purple-500'}`}>
                      <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'ar' 
                            ? `الملحقات المشفرة المربوطة بالسلسلة (${note.addendums.length}):` 
                            : `Chained Cryptographic Addendums (${note.addendums.length}):`}
                        </span>
                      </div>

                      {note.addendums.map((addendum) => (
                        <div key={addendum.id} className="text-xs space-y-1 bg-[#070c17] p-2.5 rounded-lg border border-purple-900/30">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>{new Date(addendum.timestamp).toLocaleString('en-US')}</span>
                            <span className="text-purple-400">
                              PrevHash: {addendum.previousHash ? addendum.previousHash.slice(0, 8) : 'ROOT'}...
                            </span>
                          </div>
                          <p className="text-slate-200">{addendum.content}</p>
                          <div className="text-[10px] text-purple-300">
                            {lang === 'ar' 
                              ? `السبب: ${addendum.reasonForAddendum} • الطبيب: ${addendum.authorName} (${addendum.authorRole})` 
                              : `Reason: ${addendum.reasonForAddendum} • Clinician: ${addendum.authorName} (${addendum.authorRole})`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
