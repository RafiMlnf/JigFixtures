'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchInventoryItems, updateInventoryStock } from '@/lib/api/inventory';
import { fetchApprovals, submitDecision } from '@/lib/api/approval';
import Cookies from 'js-cookie';

export interface JigFixtureItem {
  id: string;
  no: number;
  lineProduct: string;
  process: string;
  type: 'JF' | 'EQ';
  noItemAssy: string;
  assyPartName: string;
  noReg: string;
  qty: string;
  designDateLast?: string;
  designDateNew?: string;
  revStatus: string; // '0' | '1' | '2' | 'N/A'
  minimumStock: number;
  actualStock: number;
  newVisualDesign?: string; // 3D model render image
  lifecycleStatus?: string;
}

export interface ApprovalItem {
  id: string;
  noReg: string;
  designId?: string;   // UUID of the design item
  itemName: string;
  date: string;
  author: string;
  authorAvatar: string;
  note: string;
  type: 'Design Rev' | 'Inventory Update';
  status: 'WAITING' | 'APPROVED' | 'REJECTED';
  color: string;
  has3DRender?: boolean;
  sectionStatus?: 'WAITING' | 'APPROVED' | 'REJECTED';
  deptStatus?: 'WAITING' | 'APPROVED' | 'REJECTED';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'PE_JIG_FIXTURE' | 'PE_SECTION_HEAD' | 'PE_DEPT_HEAD' | 'TAMU';
}

interface AppContextProps {
  items: JigFixtureItem[];
  approvals: ApprovalItem[];
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateItemStock: (id: string, minStock: number, actualStock: number, lifecycleStatus?: string) => Promise<void>;
  processApproval: (id: string, action: 'APPROVE' | 'REJECT', comment?: string) => Promise<void>;
  reloadData: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

const initialItems: JigFixtureItem[] = [];

const initialApprovals: ApprovalItem[] = [];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<JigFixtureItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    // 1. Authenticate user from Cookies/LocalStorage
    const savedToken = Cookies.get('auth_token');
    if (savedToken) {
      try {
        const res = await fetch('http://localhost:3002/api/users/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (res.ok) {
          const profile = await res.json();
          setUser(profile);
          setToken(savedToken);
          localStorage.setItem('auth_user', JSON.stringify(profile));
        } else {
          // Token expired
          logout();
        }
      } catch (e) {
        console.warn('Backend offline, using local storage cache for user authentication profile.');
        setToken(savedToken);
        const cached = localStorage.getItem('auth_user');
        if (cached) setUser(JSON.parse(cached));
      }
    } else {
      setUser(null);
      setToken(null);
    }

    // 2. Fetch inventory and approvals
    try {
      if (typeof window !== 'undefined') {
        if (!localStorage.getItem('jigfixture_items')) {
          localStorage.setItem('jigfixture_items', JSON.stringify(initialItems));
        }
        if (!localStorage.getItem('jigfixture_approvals')) {
          localStorage.setItem('jigfixture_approvals', JSON.stringify(initialApprovals));
        }
      }

      const fetchedItems = await fetchInventoryItems();
      const fetchedApprovals = await fetchApprovals();
      setItems(fetchedItems);
      setApprovals(fetchedApprovals);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync initial state on mount
  useEffect(() => {
    loadData();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3002/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Login failed');
      }

      const data = await res.json();
      const tokenVal = data.access_token;
      const userProfile = data.user;

      // Set cookie and local state
      Cookies.set('auth_token', tokenVal, { expires: 1 }); // expires in 1 day
      setUser(userProfile);
      setToken(tokenVal);
      localStorage.setItem('auth_user', JSON.stringify(userProfile));

      // Re-fetch items after login to ensure role-appropriate views
      const fetchedItems = await fetchInventoryItems();
      const fetchedApprovals = await fetchApprovals();
      setItems(fetchedItems);
      setApprovals(fetchedApprovals);
    } catch (e: any) {
      if (e.message && !e.message.includes('Failed to fetch')) {
        setIsLoading(false);
        throw e;
      }
      // Fallback/offline login for testing without backend
      console.warn('Backend login endpoint unavailable. Attempting offline fallback verification.');
      if (email === 'admin' && password === 'admin123') {
        const fallbackUser: AuthUser = { id: 'offline-admin', email: 'admin', name: 'PIC', role: 'PE_JIG_FIXTURE' };
        const mockToken = 'offline-jwt-token-for-admin';

        Cookies.set('auth_token', mockToken, { expires: 1 });
        setUser(fallbackUser);
        setToken(mockToken);
        localStorage.setItem('auth_user', JSON.stringify(fallbackUser));

        const fetchedItems = await fetchInventoryItems();
        const fetchedApprovals = await fetchApprovals();
        setItems(fetchedItems);
        setApprovals(fetchedApprovals);
      } else if (password === 'password') {
        let role: 'PE_JIG_FIXTURE' | 'PE_SECTION_HEAD' | 'PE_DEPT_HEAD' | 'TAMU' = 'TAMU';
        let name = 'Guest';
        if (email.includes('pic')) {
          role = 'PE_JIG_FIXTURE';
          name = 'PIC';
        } else if (email.includes('sec')) {
          role = 'PE_SECTION_HEAD';
          name = 'M. Fariedl (Section Head)';
        } else if (email.includes('dept')) {
          role = 'PE_DEPT_HEAD';
          name = 'Rahmat K. (Dept Head)';
        }

        const fallbackUser: AuthUser = { id: `offline-${role}`, email, name, role };
        const mockToken = `offline-jwt-token-for-${role}`;

        Cookies.set('auth_token', mockToken, { expires: 1 });
        setUser(fallbackUser);
        setToken(mockToken);
        localStorage.setItem('auth_user', JSON.stringify(fallbackUser));

        const fetchedItems = await fetchInventoryItems();
        const fetchedApprovals = await fetchApprovals();
        setItems(fetchedItems);
        setApprovals(fetchedApprovals);
      } else {
        throw new Error('Invalid email or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setToken(null);
    setApprovals([]);
  };

  const updateItemStock = async (id: string, minStock: number, actualStock: number, lifecycleStatus?: string) => {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, minimumStock: minStock, actualStock, lifecycleStatus: lifecycleStatus || item.lifecycleStatus }
          : item
      )
    );

    try {
      const updated = await updateInventoryStock(id, minStock, actualStock, lifecycleStatus);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    } catch (e) {
      console.error('[API Error] Failed to sync item stock update with server:', e);
    }
  };

  const processApproval = async (id: string, action: 'APPROVE' | 'REJECT', comment?: string) => {
    // Optimistic UI update
    setApprovals((prev) =>
      prev.map((approval) =>
        approval.id === id
          ? { ...approval, status: action === 'APPROVE' ? ('APPROVED' as const) : ('REJECTED' as const) }
          : approval
      )
    );

    try {
      const updated = await submitDecision(id, action, comment);
      setApprovals((prev) =>
        prev.map((approval) => (approval.id === id ? updated : approval))
      );
    } catch (e) {
      console.error('[API Error] Failed to sync approval decision with server:', e);
    }
  };

  return (
    <AppContext.Provider value={{ items, approvals, user, token, login, logout, updateItemStock, processApproval, reloadData: loadData, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
