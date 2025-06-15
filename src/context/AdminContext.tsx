import React, { createContext, useContext, useState, useEffect } from 'react';
import { Store, DonutVariety, DonutForm, BoxConfiguration } from '../types';
import { getAllStoreData, createStore, updateStore, deleteStore, createDonutForm, updateDonutForm, deleteDonutForm, createDonutVariety, updateDonutVariety, deleteDonutVariety, createBoxConfiguration, updateBoxConfiguration, deleteBoxConfiguration } from '../services/storeManagementService';

interface AdminContextType {
  stores: Store[];
  varieties: DonutVariety[];
  forms: DonutForm[];
  boxes: BoxConfiguration[];
  updateStore: (store: Store) => Promise<void>;
  updateVariety: (variety: DonutVariety) => Promise<void>;
  updateForm: (form: DonutForm) => Promise<void>;
  updateBox: (box: BoxConfiguration) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  deleteVariety: (id: string) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;
  deleteBox: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [varieties, setVarieties] = useState<DonutVariety[]>([]);
  const [forms, setForms] = useState<DonutForm[]>([]);
  const [boxes, setBoxes] = useState<BoxConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getAllStoreData();
      
      setStores(data.stores || []);
      setVarieties(data.varieties || []);
      setForms(data.forms || []);
      setBoxes(data.boxes || []);
      
    } catch (err) {
      console.error('AdminContext: Error loading data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while loading data');
      // Initialize empty arrays to prevent undefined errors
      setStores([]);
      setVarieties([]);
      setForms([]);
      setBoxes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStore = async (store: Store) => {
    try {
      setError(null);
      if (store.id && store.id.trim() !== '') {
        await updateStore(store);
      } else {
        await createStore(store);
      }
      await loadData();
    } catch (err) {
      console.error('Error updating store:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating store');
      throw err;
    }
  };

  const handleUpdateVariety = async (variety: DonutVariety) => {
    try {
      setError(null);
      if (variety.id && variety.id.trim() !== '') {
        await updateDonutVariety(variety);
      } else {
        await createDonutVariety(variety);
      }
      await loadData();
    } catch (err) {
      console.error('Error updating variety:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating variety');
      throw err;
    }
  };

  const handleUpdateForm = async (form: DonutForm) => {
    try {
      setError(null);
      if (form.id && form.id.trim() !== '') {
        await updateDonutForm(form);
      } else {
        await createDonutForm(form);
      }
      await loadData();
    } catch (err) {
      console.error('Error updating form:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating form');
      throw err;
    }
  };

  const handleUpdateBox = async (box: BoxConfiguration) => {
    try {
      setError(null);
      
      if (box.id && box.id.trim() !== '') {
        await updateBoxConfiguration(box);
      } else {
        await createBoxConfiguration(box);
      }
      
      await loadData();
    } catch (err) {
      console.error('AdminContext: Error updating box:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating box');
      throw err;
    }
  };

  const handleDeleteStore = async (id: string) => {
    try {
      setError(null);
      await deleteStore(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting store:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting store');
      throw err;
    }
  };

  const handleDeleteVariety = async (id: string) => {
    try {
      setError(null);
      await deleteDonutVariety(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting variety:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting variety');
      throw err;
    }
  };

  const handleDeleteForm = async (id: string) => {
    try {
      setError(null);
      await deleteDonutForm(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting form:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting form');
      throw err;
    }
  };

  const handleDeleteBox = async (id: string) => {
    try {
      setError(null);
      await deleteBoxConfiguration(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting box:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting box');
      throw err;
    }
  };

  return (
    <AdminContext.Provider value={{
      stores,
      varieties,
      forms,
      boxes,
      updateStore: handleUpdateStore,
      updateVariety: handleUpdateVariety,
      updateForm: handleUpdateForm,
      updateBox: handleUpdateBox,
      deleteStore: handleDeleteStore,
      deleteVariety: handleDeleteVariety,
      deleteForm: handleDeleteForm,
      deleteBox: handleDeleteBox,
      loading,
      error,
      refresh: loadData
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};