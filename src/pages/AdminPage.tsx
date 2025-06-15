import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save, X, Coffee, ShoppingBag } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { Store, DonutVariety, DonutForm, BoxConfiguration } from '../types';

type AdminTab = 'stores' | 'varieties' | 'forms' | 'boxes';

interface FormValues {
  id: string;
  name: string;
  description?: string;
  location?: string;
  isActive: boolean;
  formId?: string;
  size?: number;
  productionCost?: number;
  varieties?: {
    varietyId: string;
    quantity: number;
  }[];
  availableVarieties?: string[];
  availableBoxes?: string[];
}

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('varieties');
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>({
    id: '',
    name: '',
    description: '',
    location: '',
    isActive: true,
    formId: '',
    size: 6,
    productionCost: 0,
    varieties: [],
    availableVarieties: [],
    availableBoxes: []
  });

  const {
    stores,
    varieties,
    forms,
    boxes,
    updateStore,
    updateVariety,
    updateForm,
    updateBox,
    deleteStore,
    deleteVariety,
    deleteForm,
    deleteBox,
    loading,
    error
  } = useAdmin();

  const getTabData = () => {
    switch (activeTab) {
      case 'stores':
        return stores;
      case 'varieties':
        return varieties;
      case 'forms':
        return forms;
      case 'boxes':
        return boxes;
      default:
        return [];
    }
  };

  const handleEdit = (item: any) => {
    setFormValues({
      ...item,
      varieties: item.varieties || [],
      size: item.size || 6,
      productionCost: item.productionCost || 0,
      availableVarieties: item.availableVarieties || [],
      availableBoxes: item.availableBoxes || []
    });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
      return;
    }

    switch (activeTab) {
      case 'varieties':
        deleteVariety(id);
        break;
      case 'forms':
        deleteForm(id);
        break;
      case 'stores':
        deleteStore(id);
        break;
      case 'boxes':
        deleteBox(id);
        break;
    }
  };

  const handleSave = () => {
    // Validate required fields based on the active tab
    if (activeTab === 'stores') {
      if (!formValues.name?.trim()) {
        alert('Le nom du magasin est requis');
        return;
      }
      if (!formValues.location?.trim()) {
        alert('L\'emplacement du magasin est requis');
        return;
      }
    } else if (activeTab === 'varieties') {
      if (!formValues.name?.trim()) {
        alert('Le nom de la variété est requis');
        return;
      }
      if (!formValues.formId?.trim()) {
        alert('La forme du doughnut est requise');
        return;
      }
    } else if (activeTab === 'forms') {
      if (!formValues.name?.trim()) {
        alert('Le nom de la forme est requis');
        return;
      }
    } else if (activeTab === 'boxes') {
      if (!formValues.name?.trim()) {
        alert('Le nom de la boîte est requis');
        return;
      }
      if (!formValues.size || formValues.size < 1) {
        alert('La taille de la boîte doit être supérieure à 0');
        return;
      }
    }

    // For new items, use empty string as ID, for existing items keep the original ID
    const updatedValues = { 
      ...formValues, 
      id: formValues.id || '' // Keep existing ID or use empty string for new items
    };

    switch (activeTab) {
      case 'varieties':
        updateVariety(updatedValues as DonutVariety);
        break;
      case 'forms':
        updateForm(updatedValues as DonutForm);
        break;
      case 'stores':
        updateStore(updatedValues as Store);
        break;
      case 'boxes':
        updateBox(updatedValues as BoxConfiguration);
        break;
    }

    setIsEditing(false);
    resetForm();
  };

  const resetForm = () => {
    setFormValues({
      id: '',
      name: '',
      description: '',
      location: '',
      isActive: true,
      formId: '',
      size: 6,
      productionCost: 0,
      varieties: [],
      availableVarieties: [],
      availableBoxes: []
    });
  };

  const calculateBoxCost = (boxVarieties: { varietyId: string; quantity: number }[] | undefined) => {
    if (!boxVarieties || !Array.isArray(boxVarieties)) {
      return 0;
    }
    
    return boxVarieties.reduce((total, item) => {
      const variety = varieties.find(v => v.id === item.varietyId);
      if (variety) {
        return total + (variety.productionCost * item.quantity);
      }
      return total;
    }, 0);
  };

  const handleVarietyToggle = (varietyId: string, checked: boolean) => {
    const currentVarieties = formValues.availableVarieties || [];
    const newVarieties = checked
      ? [...currentVarieties, varietyId]
      : currentVarieties.filter(id => id !== varietyId);
    
    setFormValues({ 
      ...formValues, 
      availableVarieties: newVarieties 
    });
  };

  const handleBoxToggle = (boxId: string, checked: boolean) => {
    const currentBoxes = formValues.availableBoxes || [];
    const newBoxes = checked
      ? [...currentBoxes, boxId]
      : currentBoxes.filter(id => id !== boxId);
    
    setFormValues({ 
      ...formValues, 
      availableBoxes: newBoxes 
    });
  };

  const renderFormFields = () => {
    const commonFields = (
      <>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nom
          </label>
          <input
            type="text"
            id="name"
            value={formValues.name}
            onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <input
            type="text"
            id="description"
            value={formValues.description || ''}
            onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
          />
        </div>
        
        <div className="flex items-center">
          <input
            id="isActive"
            type="checkbox"
            checked={formValues.isActive}
            onChange={(e) => setFormValues({ ...formValues, isActive: e.target.checked })}
            className="h-4 w-4 text-krispy-green focus:ring-krispy-green border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            Actif
          </label>
        </div>
      </>
    );
    
    switch (activeTab) {
      case 'stores':
        return (
          <div className="space-y-4">
            {commonFields}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Emplacement *
              </label>
              <input
                type="text"
                id="location"
                value={formValues.location || ''}
                onChange={(e) => setFormValues({ ...formValues, location: e.target.value })}
                placeholder="Entrez l'adresse du magasin (ex: Rue du Rhône 123, 1204 Genève)"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variétés Disponibles ({varieties?.length || 0} total, {varieties?.filter(v => v.isActive)?.length || 0} actives)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4 bg-gray-50">
                {varieties && varieties.length > 0 ? (
                  varieties.filter(v => v.isActive).map(variety => {
                    const isChecked = (formValues.availableVarieties || []).includes(variety.id);
                    return (
                  <div key={variety.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`variety-${variety.id}`}
                          checked={isChecked}
                          onChange={(e) => handleVarietyToggle(variety.id, e.target.checked)}
                          className="h-4 w-4 text-krispy-green focus:ring-krispy-green border-gray-300 rounded"
                    />
                        <label htmlFor={`variety-${variety.id}`} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                      {variety.name}
                          {variety.description && (
                            <span className="text-gray-500 ml-1">- {variety.description}</span>
                          )}
                    </label>
                  </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 italic">Chargement des variétés...</p>
                )}
                {varieties && varieties.filter(v => v.isActive).length === 0 && varieties.length > 0 && (
                  <p className="text-sm text-gray-500 italic">Aucune variété active disponible</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Boîtes Disponibles ({boxes?.length || 0} total, {boxes?.filter(b => b.isActive)?.length || 0} actives)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4 bg-gray-50">
                {boxes && boxes.length > 0 ? (
                  boxes.filter(b => b.isActive).map(box => {
                    const isChecked = (formValues.availableBoxes || []).includes(box.id);
                    return (
                  <div key={box.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`box-${box.id}`}
                          checked={isChecked}
                          onChange={(e) => handleBoxToggle(box.id, e.target.checked)}
                          className="h-4 w-4 text-krispy-green focus:ring-krispy-green border-gray-300 rounded"
                    />
                        <label htmlFor={`box-${box.id}`} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                      {box.name}
                          <span className="text-gray-500 ml-1">- {box.size} doughnuts</span>
                    </label>
                  </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 italic">Chargement des boîtes...</p>
                )}
                {boxes && boxes.filter(b => b.isActive).length === 0 && boxes.length > 0 && (
                  <p className="text-sm text-gray-500 italic">Aucune boîte active disponible</p>
                )}
              </div>
            </div>
          </div>
        );
        
      case 'varieties':
        return (
          <div className="space-y-4">
            {commonFields}
            <div>
              <label htmlFor="formId" className="block text-sm font-medium text-gray-700">
                Forme du Doughnut
              </label>
              <select
                id="formId"
                value={formValues.formId || ''}
                onChange={(e) => setFormValues({ ...formValues, formId: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
              >
                <option value="">Sélectionnez une forme</option>
                {forms.filter(form => form.isActive).map(form => (
                  <option key={form.id} value={form.id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="productionCost" className="block text-sm font-medium text-gray-700">
                Coût de Production (CHF)
              </label>
              <input
                type="number"
                id="productionCost"
                step="0.05"
                min="0"
                value={formValues.productionCost || 0}
                onChange={(e) => setFormValues({ ...formValues, productionCost: parseFloat(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
              />
            </div>
          </div>
        );
        
      case 'forms':
        return <div className="space-y-4">{commonFields}</div>;
        
      case 'boxes':
        const totalCost = calculateBoxCost(formValues.varieties || []);
        
        return (
          <div className="space-y-4">
            {commonFields}
            <div>
              <label htmlFor="size" className="block text-sm font-medium text-gray-700">
                Taille de la Boîte (nombre de doughnuts)
              </label>
              <input
                type="number"
                id="size"
                min="1"
                value={formValues.size || 6}
                onChange={(e) => setFormValues({ ...formValues, size: parseInt(e.target.value, 10) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variétés de Doughnuts dans la Boîte
              </label>
              <div className="space-y-2">
                {varieties.filter(v => v.isActive).map(variety => {
                  const varConfig = formValues.varieties?.find(v => v.varietyId === variety.id);
                  const quantity = varConfig?.quantity || 0;
                  
                  return (
                    <div key={variety.id} className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <span className="block w-1/3 text-sm text-gray-700">{variety.name}</span>
                        <span className="block w-1/3 text-sm text-gray-500">
                          CHF {variety.productionCost.toFixed(2)}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(e) => {
                            const newQuantity = parseInt(e.target.value, 10) || 0;
                            const newVarieties = [...(formValues.varieties || [])];
                            const index = newVarieties.findIndex(v => v.varietyId === variety.id);
                            
                            if (index >= 0) {
                              if (newQuantity === 0) {
                                newVarieties.splice(index, 1);
                              } else {
                                newVarieties[index].quantity = newQuantity;
                              }
                            } else if (newQuantity > 0) {
                              newVarieties.push({ varietyId: variety.id, quantity: newQuantity });
                            }
                            
                            setFormValues({ ...formValues, varieties: newVarieties });
                          }}
                          className="ml-2 w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                        />
                        <span className="ml-4 text-sm text-gray-500">
                          CHF {(variety.productionCost * quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Coût Total de la Boîte:</span>
                  <span className="text-lg font-bold text-gray-900">CHF {totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  const renderColumns = () => {
    switch (activeTab) {
      case 'stores':
        return (
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emplacement</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variétés</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîtes</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        );
        
      case 'varieties':
        return (
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forme</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coût de Production</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        );
        
      case 'forms':
        return (
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        );
        
      case 'boxes':
        return (
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taille</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variétés Configurées</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coût Total</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        );
        
      default:
        return null;
    }
  };
  
  const renderRows = () => {
    const data = getTabData();
    
    return data.map((item: any) => {
      let cols;
      
      switch (activeTab) {
        case 'stores':
          const varietiesCount = item.availableVarieties?.length || 0;
          const boxesCount = item.availableBoxes?.length || 0;
          cols = (
            <>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.location}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{varietiesCount} variétés</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{boxesCount} boîtes</td>
            </>
          );
          break;
          
        case 'varieties':
          const form = forms.find(f => f.id === item.formId);
          cols = (
            <>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.description}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{form?.name || 'Non assigné'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                CHF {item.productionCost?.toFixed(2) || '0.00'}
              </td>
            </>
          );
          break;
          
        case 'forms':
          cols = (
            <>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.description}</td>
            </>
          );
          break;
          
        case 'boxes':
          const boxCost = calculateBoxCost(item.varieties || []);
          const varietiesDisplay = (item.varieties || []).length > 0 
            ? (item.varieties || []).map((v: any) => {
                const variety = varieties.find(variety => variety.id === v.varietyId);
                return variety ? `${variety.name} (${v.quantity})` : `Variété inconnue (${v.quantity})`;
              }).join(', ')
            : 'Aucune variété configurée';
          
          cols = (
            <>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.size} doughnuts</td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                <div className="truncate" title={varietiesDisplay}>
                  {varietiesDisplay}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">CHF {boxCost.toFixed(2)}</td>
            </>
          );
          break;
          
        default:
          cols = null;
      }
      
      return (
        <tr key={item.id}>
          {cols}
          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {item.isActive ? 'Actif' : 'Inactif'}
            </span>
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
            <button
              onClick={() => handleEdit(item)}
              className="text-blue-600 hover:text-blue-900 mr-3"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              className="text-red-600 hover:text-red-900"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </td>
        </tr>
      );
    });
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Erreur: {error}
        </div>
      )}
      
      {loading && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          Chargement des données...
        </div>
      )}
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Administrateur</h1>
        <p className="text-gray-600 mt-1">Gérer les magasins, les variétés, les formes et les boîtes</p>
      </div>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('stores')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'stores'
                ? 'border-krispy-green text-krispy-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Magasins
          </button>
          <button
            onClick={() => setActiveTab('varieties')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'varieties'
                ? 'border-krispy-green text-krispy-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Coffee className="h-4 w-4 mr-2" />
            Variétés de Doughnuts
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'forms'
                ? 'border-krispy-green text-krispy-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Coffee className="h-4 w-4 mr-2" />
            Formes de Doughnuts
          </button>
          <button
            onClick={() => setActiveTab('boxes')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'boxes'
                ? 'border-krispy-green text-krispy-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Configurations des Boîtes
          </button>
        </nav>
      </div>
      
      <div className="mt-6">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 capitalize">
            {activeTab === 'varieties' ? 'Variétés de Doughnuts' : 
             activeTab === 'forms' ? 'Formes de Doughnuts' : 
             activeTab === 'boxes' ? 'Configurations des Boîtes' : 
             'Magasins'}
          </h2>
          
          {!isEditing && (
            <button
              onClick={() => {
                resetForm();
                setIsEditing(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </button>
          )}
        </div>
        
        {isEditing && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {formValues.id ? `Modifier ${formValues.name}` : `Ajouter un nouveau ${
                  activeTab === 'varieties' ? 'doughnut' : 
                  activeTab === 'forms' ? 'type de doughnut' : 
                  activeTab === 'boxes' ? 'type de boîte' : 
                  'magasin'
                }`}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 max-h-screen overflow-y-auto">
              {renderFormFields()}
              
              <div className="mt-6 flex justify-end space-x-3 sticky bottom-0 bg-white pt-4 border-t border-gray-200">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {renderColumns()}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {renderRows()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;