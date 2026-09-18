/**
 * Soli Medical MICU (ICU-Sync)
 * Dynamic Sections & Bedside Cards Firestore Service
 * 
 * Manages modular bedside cards and flowsheet sections directly from Cloud Firestore.
 * Supports create, update, disable, delete, and reorder.
 * Preserves historical medical records by using `active: false` when disabled.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Unsubscribe 
} from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { DynamicSection, DynamicBedsideCard } from '../types/schema.ts';

const SECTIONS_COLLECTION = 'sections';
const CARDS_COLLECTION = 'cards';

export const DEFAULT_DYNAMIC_SECTIONS: DynamicSection[] = [
  {
    id: 'sec_hemodynamics',
    key: 'hemodynamics',
    titleEn: 'Hemodynamics & Vitals',
    titleAr: 'الديناميكا الدموية والعلامات الحيوية',
    descriptionEn: 'Arterial line, MAP, SpO2, heart rate, and central venous pressures.',
    descriptionAr: 'الضغط الشرياني الوسطي، الأكسجين، النبض، والضغط الوريدي المركزي.',
    active: true,
    displayOrder: 1,
    icon: 'Activity',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'sec_respiratory',
    key: 'respiratory',
    titleEn: 'Mechanical Ventilation & Gas Exchange',
    titleAr: 'التنفس الصناعي وتبادل الغازات',
    descriptionEn: 'Invasive mechanical ventilator modes, PEEP, FiO2, P/F ratio, and ABG integration.',
    descriptionAr: 'أنماط التنفس الاصطناعي، ضغط نهاية الزفير، نسبة الأكسجين، ونسبة PaO2/FiO2.',
    active: true,
    displayOrder: 2,
    icon: 'Wind',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'sec_infusions',
    key: 'infusions',
    titleEn: 'Vasoactive & Sedation Infusions',
    titleAr: 'المضخات الوريدية والمهدئات',
    descriptionEn: 'Dual-nurse verification for vasopressors, inotropes, insulin, and sedation.',
    descriptionAr: 'التحقق الثنائي لمقبضات الأوعية، الأنسولين، والمهدئات الوريدية.',
    active: true,
    displayOrder: 3,
    icon: 'Droplet',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'sec_fluid_balance',
    key: 'fluid_balance',
    titleEn: 'Fluid Balance & Renal Output',
    titleAr: 'ميزان السوائل والوظائف الكلوية',
    descriptionEn: '24-hour strict cumulative fluid balance tracking and hourly urine output.',
    descriptionAr: 'متابعة ميزان السوائل التراكمي الدقيق ومعدل إدرار البول بالساعة.',
    active: true,
    displayOrder: 4,
    icon: 'Scale',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'sec_labs',
    key: 'labs',
    titleEn: 'Critical Stat Labs & Diagnostics',
    titleAr: 'التحاليل الفورية والفحوصات الحرجة',
    descriptionEn: 'Arterial blood gases, CBC, troponin, coagulation, and biochemistry panels.',
    descriptionAr: 'غازات الدم الشرياني، صورة الدم، وظائف الكبد والكلى، وعوامل التجلط.',
    active: true,
    displayOrder: 5,
    icon: 'FlaskConical',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
];

export const DEFAULT_DYNAMIC_CARDS: DynamicBedsideCard[] = [
  {
    id: 'card_vitals',
    key: 'showVitalsCard',
    titleEn: 'Bedside Telemetry Monitor',
    titleAr: 'شاشة المراقبة الحيوية السريرية',
    active: true,
    displayOrder: 1,
    sectionKey: 'hemodynamics',
    icon: 'Activity',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'card_ventilator',
    key: 'showVentilatorCard',
    titleEn: 'Mechanical Ventilator Matrix',
    titleAr: 'لوحة جهاز التنفس الاصطناعي',
    active: true,
    displayOrder: 2,
    sectionKey: 'respiratory',
    icon: 'Wind',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'card_infusions',
    key: 'showInfusionPumpsCard',
    titleEn: 'Infusion Pump Lines',
    titleAr: 'خطوط مضخات التسريب الوريدي',
    active: true,
    displayOrder: 3,
    sectionKey: 'infusions',
    icon: 'Droplet',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'card_fluids',
    key: 'showFluidBalanceCard',
    titleEn: '24-Hour Fluid Balance',
    titleAr: 'ميزان السوائل 24 ساعة',
    active: true,
    displayOrder: 4,
    sectionKey: 'fluid_balance',
    icon: 'Scale',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'card_labs',
    key: 'showLabsCard',
    titleEn: 'Stat Labs & Gas Analysis',
    titleAr: 'التحاليل الفورية وغازات الدم',
    active: true,
    displayOrder: 5,
    sectionKey: 'labs',
    icon: 'FlaskConical',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'card_sbar',
    key: 'showSbarCard',
    titleEn: 'SBAR Shift Handover',
    titleAr: 'تسليم المناوبة السريرية SBAR',
    active: true,
    displayOrder: 6,
    icon: 'FileText',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
  {
    id: 'card_investigations',
    key: 'showInvestigationsCard',
    titleEn: 'Imaging & Diagnostic Studies',
    titleAr: 'الأشعة والفحوصات التصويرية',
    active: true,
    displayOrder: 7,
    icon: 'Microscope',
    createdAt: new Date().toISOString(),
    createdByUid: 'system',
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
  },
];

/**
 * Initializes default sections and cards in Firestore if empty
 */
export async function seedDefaultSectionsAndCards(): Promise<void> {
  try {
    const sectionsCol = collection(firestore, SECTIONS_COLLECTION);
    const secSnap = await getDocs(sectionsCol);
    if (secSnap.empty) {
      for (const sec of DEFAULT_DYNAMIC_SECTIONS) {
        await setDoc(doc(firestore, SECTIONS_COLLECTION, sec.id), sec);
      }
    }

    const cardsCol = collection(firestore, CARDS_COLLECTION);
    const cardSnap = await getDocs(cardsCol);
    if (cardSnap.empty) {
      for (const card of DEFAULT_DYNAMIC_CARDS) {
        await setDoc(doc(firestore, CARDS_COLLECTION, card.id), card);
      }
    }
  } catch (err) {
    console.warn('Notice seeding default sections & cards to Firestore:', err);
  }
}

/**
 * Subscribe to sections from Firestore
 */
export function subscribeToSections(callback: (sections: DynamicSection[]) => void): Unsubscribe {
  const colRef = collection(firestore, SECTIONS_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: DynamicSection[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as DynamicSection);
    });
    list.sort((a, b) => a.displayOrder - b.displayOrder);
    callback(list.length > 0 ? list : DEFAULT_DYNAMIC_SECTIONS);
  }, (err) => {
    console.warn('Sections snapshot notice:', err);
    callback(DEFAULT_DYNAMIC_SECTIONS);
  });
}

/**
 * Subscribe to bedside cards from Firestore
 */
export function subscribeToBedsideCards(callback: (cards: DynamicBedsideCard[]) => void): Unsubscribe {
  const colRef = collection(firestore, CARDS_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: DynamicBedsideCard[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as DynamicBedsideCard);
    });
    list.sort((a, b) => a.displayOrder - b.displayOrder);
    callback(list.length > 0 ? list : DEFAULT_DYNAMIC_CARDS);
  }, (err) => {
    console.warn('Bedside cards snapshot notice:', err);
    callback(DEFAULT_DYNAMIC_CARDS);
  });
}

/**
 * Save or update a dynamic section in Firestore
 */
export async function saveDynamicSection(section: DynamicSection, userUid: string): Promise<void> {
  const secRef = doc(firestore, SECTIONS_COLLECTION, section.id);
  const data: DynamicSection = {
    ...section,
    updatedAt: new Date().toISOString(),
    updatedByUid: userUid,
  };
  await setDoc(secRef, data, { merge: true });
}

/**
 * Toggle active status of a section (preserves data bindings by using active: false)
 */
export async function toggleSectionActive(sectionId: string, currentActive: boolean, userUid: string): Promise<void> {
  const secRef = doc(firestore, SECTIONS_COLLECTION, sectionId);
  await updateDoc(secRef, {
    active: !currentActive,
    updatedAt: new Date().toISOString(),
    updatedByUid: userUid,
  });
}

/**
 * Save or update a dynamic card in Firestore
 */
export async function saveDynamicCard(card: DynamicBedsideCard, userUid: string): Promise<void> {
  const cardRef = doc(firestore, CARDS_COLLECTION, card.id);
  const data: DynamicBedsideCard = {
    ...card,
    updatedAt: new Date().toISOString(),
    updatedByUid: userUid,
  };
  await setDoc(cardRef, data, { merge: true });
}

/**
 * Toggle active status of a card (preserves historic data by marking active: false)
 */
export async function toggleCardActive(cardId: string, currentActive: boolean, userUid: string): Promise<void> {
  const cardRef = doc(firestore, CARDS_COLLECTION, cardId);
  await updateDoc(cardRef, {
    active: !currentActive,
    updatedAt: new Date().toISOString(),
    updatedByUid: userUid,
  });
}
