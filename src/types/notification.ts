import { BedNumber } from './schema.ts';

export type NotificationType = 
  | 'ADMISSION' 
  | 'DISCHARGE' 
  | 'DEATH' 
  | 'TRANSFER' 
  | 'SBAR_HANDOVER' 
  | 'SBAR_RECEIVED' 
  | 'ISOLATION_CHANGE' 
  | 'CRITICAL_TELEMETRY';

export interface AppNotificationTarget {
  action: 'OPEN_ARCHIVE' | 'OPEN_SBAR' | 'OPEN_BED' | 'OPEN_ISOLATION';
  patientId?: string;
  patientMrn?: string;
  patientName?: string;
  patientNameAr?: string;
  patientNameEn?: string;
  bedNumber?: BedNumber | null;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  timestamp: string;
  read: boolean;
  target?: AppNotificationTarget;
}
