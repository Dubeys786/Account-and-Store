import React, { createContext, useContext, useState, useEffect } from 'react';
import { Store } from '../types';
import { useAuth } from './AuthContext';

interface StoreContextType {
  activeStore: Store | null;
  setActiveStore: (store: Store) => void;
  availableStores: Store[];
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { stores } = useAuth();
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);

  useEffect(() => {
    if (stores && stores.length > 0) {
      const savedStoreId = localStorage.getItem('prozen_active_store_id');
      const found = stores.find((s) => s.id === savedStoreId);
      const defaultStore = stores.find((s) => s.isDefault);

      if (found) {
        setActiveStoreState(found);
      } else if (defaultStore) {
        setActiveStoreState(defaultStore);
        localStorage.setItem('prozen_active_store_id', defaultStore.id);
      } else {
        setActiveStoreState(stores[0]);
        localStorage.setItem('prozen_active_store_id', stores[0].id);
      }
    } else {
      setActiveStoreState(null);
    }
  }, [stores]);

  const setActiveStore = (store: Store) => {
    setActiveStoreState(store);
    localStorage.setItem('prozen_active_store_id', store.id);
  };

  return (
    <StoreContext.Provider
      value={{
        activeStore,
        setActiveStore,
        availableStores: stores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
