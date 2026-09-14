# Soli Medical MICU (ICU-Sync) - Architectural & Behavioral Guidelines

## Core Principles & System Memory

1. **System Modularity & Dynamic Feature Control (القاعدة الدائمة لمرونة النظام)**:
   - All clinical modules, tabs, flowsheet sub-components, and alert systems MUST be completely modular.
   - Any feature, view, or component must be togglable (enabled/disabled/hidden) dynamically from the Settings configuration (`settingsService`).
   - Adding, removing, or hiding any feature should never break other modules or database schemas.
   - New clinical or telemetry features should always expose a feature flag in `SystemSettings` so the user/administrator can toggle them at any time.

2. **Clinical Standards & Compliance**:
   - Adhere strictly to CBAHI, JCI, and HIPAA standards.
   - Ensure SBAR handover structure and immutable SHA-256 clinical note addendums.
   - Preserve offline-first resilience (Dexie IndexedDB) with cloud synchronization (Firebase Firestore).

3. **User Experience & ICU Environment**:
   - Dark, eye-safe, high-contrast palette suitable for 24/7 ICU environments.
   - Immediate feedback for critical thresholds (MAP < 65, SpO2 < 88%).
   - Seamless responsive layout for desktop central station displays, wall monitors, bedside tablets, and mobile devices.

4. **Language & Bilingual Medical Display Protocol (بروتوكول اللغة وعرض المصطلحات السريرية)**:
   - **Primary Language**: English, with full support for Arabic.
   - **English Mode (`en`)**: Strictly English ONLY. All labels, views, descriptions, actions, and standard international medical acronyms (e.g., MAP, SpO2, HR, BP, GCS, RASS, SIMV, PEEP, FiO2, SBAR, DNR, CPR, MRN, ABG) must appear in pure English with LTR layout. No Arabic characters in English mode.
   - **Arabic Mode (`ar`)**: High-clarity clinical Arabic paired seamlessly with standard English medical abbreviations (e.g., "تسليم المناوبات SBAR", "الضغط الشرياني الوسطي MAP", "مقياس غلاسكو للوعي GCS", "ميزان السوائل 24 ساعة I/O Balance") with RTL layout.
