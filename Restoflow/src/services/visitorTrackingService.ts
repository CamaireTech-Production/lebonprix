import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  onSnapshot,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

export type PageType = 'menu' | 'order' | 'daily-menu';

export interface VisitorStats {
  totalVisitors: number;
  menuVisits: number;
  orderVisits: number;
  dailyMenuVisits: number;
  visitsToday: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
  lastVisit: any;
}

export interface PageVisit {
  timestamp: any;
  pageType: PageType;
  sessionId: string;
}

export interface RestaurantVisitorData {
  restaurantId: string;
  isDemo: boolean;
  demoId?: string;
  pageVisits: {
    menu: PageVisit[];
    order: PageVisit[];
    'daily-menu': PageVisit[];
  };
  stats: VisitorStats;
  lastUpdated: any;
}

const getVisitorDataRef = (restaurantId: string, isDemo: boolean, demoId?: string) => {
  const collectionName = isDemo ? 'demoVisitorData' : 'restaurantVisitorData';
  const docId = isDemo ? (demoId || restaurantId) : restaurantId;
  return doc(db, collectionName, docId);
};

const ensureVisitorDoc = async (
  restaurantId: string,
  isDemo: boolean,
  demoId?: string
): Promise<void> => {
  const ref = getVisitorDataRef(restaurantId, isDemo, demoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const now = serverTimestamp();
    const base: any = {
      restaurantId,
      isDemo,
      pageVisits: { menu: [], order: [], 'daily-menu': [] },
      stats: {
        totalVisitors: 0,
        menuVisits: 0,
        orderVisits: 0,
        dailyMenuVisits: 0,
        visitsToday: 0,
        visitsThisWeek: 0,
        visitsThisMonth: 0,
        lastVisit: now,
      },
      lastUpdated: now,
    };
    if (isDemo) {
      base.demoId = demoId || restaurantId;
    }
    const initialData: RestaurantVisitorData = base as RestaurantVisitorData;
    await setDoc(ref, initialData);
  }
};

const hasVisitedInSession = (key: string): boolean => {
  try {
    return localStorage.getItem(`visited_${key}`) === 'true';
  } catch {
    return false;
  }
};

const markVisitedInSession = (key: string) => {
  try {
    localStorage.setItem(`visited_${key}`, 'true');
  } catch {
    // ignore
  }
};

const clearVisitedInSession = (key: string) => {
  try {
    localStorage.removeItem(`visited_${key}`);
  } catch {
    // ignore
  }
};

export const trackPageVisit = async (
  restaurantId: string,
  pageType: PageType,
  isDemo: boolean = false,
  demoId?: string
): Promise<void> => {
  if (!restaurantId) return;
  try {
    const pageKey = `${restaurantId}-${pageType}`;
    if (hasVisitedInSession(pageKey)) {
      console.log('[VisitorTracking] Skipping because already visited in session', { pageKey });
      return;
    }

    const ref = getVisitorDataRef(restaurantId, isDemo, demoId);
    const now = serverTimestamp();

    console.log('[VisitorTracking] Ensuring doc exists', { restaurantId, isDemo, demoId });
    await ensureVisitorDoc(restaurantId, isDemo, demoId);

    console.log('[VisitorTracking] Incrementing counters', { pageType });
    await updateDoc(ref, {
      [`stats.${pageType}Visits`]: increment(1),
      'stats.totalVisitors': increment(1),
      'stats.lastVisit': now,
      lastUpdated: now,
    });

    // append lightweight visit entry for period aggregation (cap at last 100)
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as RestaurantVisitorData;
      const visits = Array.isArray(data.pageVisits?.[pageType]) ? data.pageVisits[pageType] : [];
      const updated = [...visits, { timestamp: new Date().toISOString(), pageType, sessionId: `${Date.now()}` }];
      const trimmed = updated.slice(-100);
      console.log('[VisitorTracking] Writing pageVisits array', { length: trimmed.length });
      await updateDoc(ref, { [`pageVisits.${pageType}`]: trimmed });
      console.log('[VisitorTracking] Update complete');
    }
    // Only mark visited after a successful write
    markVisitedInSession(pageKey);
  } catch (e) {
    console.error('[VisitorTracking] trackPageVisit error', e);
    // allow retry if something failed
    try { clearVisitedInSession(`${restaurantId}-${pageType}`); } catch {}
  }
};

const calculatePeriodsFromVisits = (data: RestaurantVisitorData): Pick<VisitorStats, 'visitsToday' | 'visitsThisWeek' | 'visitsThisMonth'> => {
  const all = [
    ...(data.pageVisits?.menu || []),
    ...(data.pageVisits?.order || []),
    ...(data.pageVisits?.['daily-menu'] || []),
  ];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = new Date(todayStart);
  // Monday start
  const day = new Date(todayStart).getDay();
  weekStart.setDate(new Date(todayStart).getDate() - (day === 0 ? 6 : day - 1));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const toMs = (ts: any) => {
    if (!ts) return 0;
    if (typeof ts === 'string') return Date.parse(ts);
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    return new Date(ts).getTime();
  };

  const visitsToday = all.filter(v => toMs(v.timestamp) >= todayStart).length;
  const visitsThisWeek = all.filter(v => toMs(v.timestamp) >= weekStart.getTime()).length;
  const visitsThisMonth = all.filter(v => toMs(v.timestamp) >= monthStart).length;
  return { visitsToday, visitsThisWeek, visitsThisMonth };
};

export const getVisitorStats = async (
  restaurantId: string,
  isDemo: boolean = false,
  demoId?: string
): Promise<VisitorStats | null> => {
  try {
    const ref = getVisitorDataRef(restaurantId, isDemo, demoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as RestaurantVisitorData;
    const period = calculatePeriodsFromVisits(data);
    return {
      totalVisitors: data.stats?.totalVisitors || 0,
      menuVisits: data.stats?.menuVisits || (data.pageVisits?.menu?.length || 0),
      orderVisits: data.stats?.orderVisits || (data.pageVisits?.order?.length || 0),
      dailyMenuVisits: data.stats?.dailyMenuVisits || (data.pageVisits?.['daily-menu']?.length || 0),
      lastVisit: data.stats?.lastVisit || null,
      ...period,
    };
  } catch (e) {
    console.error('getVisitorStats error', e);
    return null;
  }
};

export const subscribeToVisitorStats = (
  restaurantId: string,
  isDemo: boolean = false,
  demoId: string | undefined = undefined,
  callback: (stats: VisitorStats | null) => void
) => {
  const ref = getVisitorDataRef(restaurantId, isDemo, demoId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data() as RestaurantVisitorData;
    const period = calculatePeriodsFromVisits(data);
    callback({
      totalVisitors: data.stats?.totalVisitors || 0,
      menuVisits: data.stats?.menuVisits || (data.pageVisits?.menu?.length || 0),
      orderVisits: data.stats?.orderVisits || (data.pageVisits?.order?.length || 0),
      dailyMenuVisits: data.stats?.dailyMenuVisits || (data.pageVisits?.['daily-menu']?.length || 0),
      lastVisit: data.stats?.lastVisit || null,
      ...period,
    });
  });
};

export const getAllRestaurantsVisitorStats = async (): Promise<Array<{
  restaurantId: string;
  restaurantName: string;
  isDemo: boolean;
  stats: VisitorStats;
}>> => {
  try {
    const [restaurantsSnap, demoSnap] = await Promise.all([
      getDocs(collection(db, 'restaurants')),
      getDocs(collection(db, 'demoAccounts')),
    ]);

    const regular = await Promise.all(
      restaurantsSnap.docs.map(async (d) => {
        const stats = (await getVisitorStats(d.id, false)) || {
          totalVisitors: 0,
          menuVisits: 0,
          orderVisits: 0,
          dailyMenuVisits: 0,
          visitsToday: 0,
          visitsThisWeek: 0,
          visitsThisMonth: 0,
          lastVisit: null,
        };
        return {
          restaurantId: d.id,
          restaurantName: (d.data() as any)?.name || 'Restaurant',
          isDemo: false,
          stats,
        };
      })
    );

    const demos = await Promise.all(
      demoSnap.docs.map(async (d) => {
        const stats = (await getVisitorStats(d.id, true, d.id)) || {
          totalVisitors: 0,
          menuVisits: 0,
          orderVisits: 0,
          dailyMenuVisits: 0,
          visitsToday: 0,
          visitsThisWeek: 0,
          visitsThisMonth: 0,
          lastVisit: null,
        };
        return {
          restaurantId: d.id,
          restaurantName: (d.data() as any)?.name || 'Demo Restaurant',
          isDemo: true,
          stats,
        };
      })
    );

    return [...regular, ...demos];
  } catch (e) {
    console.error('getAllRestaurantsVisitorStats error', e);
    return [];
  }
};
