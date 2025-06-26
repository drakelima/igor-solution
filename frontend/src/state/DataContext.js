// frontend/src/state/DataContext.js

import React, { createContext, useCallback, useContext, useState } from 'react';

// Ajuste aqui se seu backend estiver em outro host/porta
const API_BASE = 'http://localhost:3001';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);

  const fetchItems = useCallback(
    async ({ page = 1, pageSize = 20, q = '' } = {}, signal) => {
      // Monta os parâmetros
      const params = new URLSearchParams();
      params.set('limit', pageSize);
      params.set('offset', (page - 1) * pageSize);
      if (q) params.set('q', q);

      const url = `${API_BASE}/api/items?${params.toString()}`;
      console.log('[DataContext] fetching full URL:', url);

      const res = await fetch(url, { signal });
      if (!res.ok) {
        console.error('[DataContext] erro', res.status);
        throw new Error(`Erro ao buscar items: ${res.status}`);
      }
      const data = await res.json();
      setItems(data);
    },
    []
  );

  return (
    <DataContext.Provider value={{ items, fetchItems }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
