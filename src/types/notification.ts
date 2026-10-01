export type NotificationType =
  | 'ADMISSION'
  | 'DISCHARGE'
  | 'SBAR_HANDOVER'
  | 'SBAR_SIGNED'
  | 'CRITICAL_ALERT'
  | 'CHAT_MESSAGE'
  | 'PATIENT_TRANSFER';

export type AppNotificationTarget = 'all' | 'doctors' | 'nurses' | string;

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  timestamp: string | any;
  readBy?: string[];
  targetRole?: AppNotificationTarget;
  patientId?: string;
  patientName?: string;
  bedNumber?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, any>;
}
