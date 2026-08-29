export interface OperationalNotification {
  id: string;
  type: 'ALERT' | 'INFO' | 'WARNING' | 'SUCCESS';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionPayload?: {
    type: 'SPILL' | 'VESSEL' | 'REPORT';
    id: string;
  };
}

const STORAGE_KEY = 'marine_spill_notifications_v1';

const INITIAL_NOTIFICATIONS: OperationalNotification[] = [
  {
    id: 'notif-01',
    type: 'ALERT',
    title: 'CRITICAL KINEMATIC ANOMALY: MT Dawn Kanchipuram',
    message: 'Sudden deceleration of -11.2 kts detected at Ennore Fairway Buoy at 04:03 UTC. High collision probability with BW Maple.',
    timestamp: '2017-01-28T04:05:00Z',
    read: false,
    actionPayload: { type: 'VESSEL', id: '419053900' },
  },
  {
    id: 'notif-02',
    type: 'WARNING',
    title: 'SAR SLICK DETECTED: SP-2017-001',
    message: 'Sentinel-1A IW GRD pass confirmed 19.45 km² dark patch with -6.4 dB radar backscatter attenuation anomaly in Ennore port approaches.',
    timestamp: '2017-01-29T00:35:00Z',
    read: false,
    actionPayload: { type: 'SPILL', id: 'SP-2017-001' },
  },
  {
    id: 'notif-03',
    type: 'INFO',
    title: 'CMEMS HINDCAST DRIFT CONVERGENCE',
    message: 'Backward particle dispersion model completed with CMEMS 0.083° current vectors and ERA5 10m wind field. Origin node confirmed at 13.2415°N, 80.3412°E.',
    timestamp: '2017-01-29T01:10:00Z',
    read: true,
    actionPayload: { type: 'SPILL', id: 'SP-2017-001' },
  },
  {
    id: 'notif-04',
    type: 'SUCCESS',
    title: 'AIS CORRIDOR INGESTION COMPLETE',
    message: '7,252 AIS Class-A messages decoded across 50 vessels in Chennai/Ennore maritime traffic sector.',
    timestamp: '2017-01-29T01:30:00Z',
    read: true,
  },
];

export function getStoredNotifications(): OperationalNotification[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load notifications from localStorage', e);
  }
  return INITIAL_NOTIFICATIONS;
}

export function saveNotifications(notifs: OperationalNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  } catch (e) {
    console.error('Failed to save notifications to localStorage', e);
  }
}

export function markNotificationAsRead(id: string): OperationalNotification[] {
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
  return updated;
}

export function markAllNotificationsAsRead(): OperationalNotification[] {
  const current = getStoredNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);
  return updated;
}

export function addNotification(notif: Omit<OperationalNotification, 'id' | 'timestamp' | 'read'>): OperationalNotification[] {
  const current = getStoredNotifications();
  const newNotif: OperationalNotification = {
    ...notif,
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [newNotif, ...current];
  saveNotifications(updated);
  return updated;
}
