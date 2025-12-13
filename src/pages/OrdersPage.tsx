import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  DonutVariety,
  Order,
  OrderLineItem,
  OrderPaymentStatus,
  OrderType,
  Store,
} from '../types';

interface OrderFormState {
  customerName: string;
  customerPhone: string;
  companyName: string;
  deliveryAddress: string;
  billingAddress: string;
  deliveryDate: string;
  productionDate: string;
  storeId: string;
  orderType: OrderType;
  paymentStatus: OrderPaymentStatus;
  conditioning: string;
  handledBy: string;
  deliveredBy: string;
  comments: string;
  items: OrderLineItem[];
}

const paymentStatusLabels: Record<OrderPaymentStatus, string> = {
  deja_paye: 'Déjà payé',
  a_facturer: 'À facturer',
  a_la_livraison: 'À la livraison',
};

const orderTypeLabels: Record<OrderType, string> = {
  retail: 'Retail',
  b2b: 'B2B',
};

const conditioningOptions = ['Boîte 6', 'Boîte 12', 'Vrac'];

const buildInitialForm = (storeId: string, catalogue: DonutVariety[]): OrderFormState => {
  const firstVariety = catalogue[0];
  const defaultDate = new Date();
  const defaultDelivery = new Date(defaultDate);
  defaultDelivery.setDate(defaultDelivery.getDate() + 1);

  return {
    customerName: '',
    customerPhone: '',
    companyName: '',
    deliveryAddress: '',
    billingAddress: '',
    deliveryDate: defaultDelivery.toISOString().split('T')[0],
    productionDate: defaultDate.toISOString().split('T')[0],
    storeId,
    orderType: 'retail',
    paymentStatus: 'a_facturer',
    conditioning: conditioningOptions[1],
    handledBy: '',
    deliveredBy: '',
    comments: '',
    items: firstVariety
      ? [
          {
            varietyId: firstVariety.id,
            quantity: 12,
            conditioning: conditioningOptions[1],
          },
        ]
      : [],
  };
};

const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { stores, varieties, loading: adminLoading, error: adminError, refresh } = useAdmin();

  const catalogue = useMemo<DonutVariety[]>(
    () => varieties.filter(variety => variety.isActive),
    [varieties]
  );

  const storeOptions = useMemo<Store[]>(() => {
    const activeStores = stores.filter(store => store.isActive);
    if (user?.storeIds?.length) {
      const allowed = activeStores.filter(store => user.storeIds?.includes(store.id));
      if (allowed.length) return allowed;
    }
    return activeStores;
  }, [stores, user?.storeIds]);

  const catalogueForStore = useCallback(
    (storeId: string) => {
      const store = storeOptions.find(s => s.id === storeId);
      if (!store || !store.availableVarieties?.length) return catalogue;
      const availableIds = new Set(store.availableVarieties);
      const filtered = catalogue.filter(item => availableIds.has(item.id));
      return filtered.length ? filtered : catalogue;
    },
    [catalogue, storeOptions]
  );

  const preferredStoreId = useMemo(() => {
    if (user?.storeIds?.length) {
      const matchingStore = storeOptions.find(store => user.storeIds?.includes(store.id));
      if (matchingStore) return matchingStore.id;
    }
    return storeOptions[0]?.id || '';
  }, [storeOptions, user?.storeIds]);

  const [form, setForm] = useState<OrderFormState | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (adminLoading) return;
    if (!storeOptions.length || !catalogue.length) {
      setForm(null);
      return;
    }
    setForm(buildInitialForm(preferredStoreId, catalogueForStore(preferredStoreId)));
  }, [adminLoading, catalogueForStore, preferredStoreId, storeOptions]);

  const handleFormChange = (field: keyof OrderFormState, value: string) => {
    if (!form) return;
    setForm(prev => {
      if (!prev) return prev;
      if (field === 'storeId') {
        const allowedCatalogue = catalogueForStore(value);
        const fallbackVarietyId = allowedCatalogue[0]?.id;
        const sanitizedItems = prev.items.map(item => {
          const isAllowed = allowedCatalogue.some(variety => variety.id === item.varietyId);
          if (isAllowed || !fallbackVarietyId) return item;
          return { ...item, varietyId: fallbackVarietyId };
        });

        return { ...prev, storeId: value, items: sanitizedItems };
      }

      return { ...prev, [field]: value };
    });
  };

  const handleItemChange = (index: number, field: keyof OrderLineItem, value: string | number) => {
    if (!form) return;
    setForm(prev => {
      if (!prev) return prev;
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value } as OrderLineItem;
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddItem = () => {
    if (!form) return;
    const availableCatalogue = catalogueForStore(form.storeId);
    const fallbackVariety = availableCatalogue[0];
    if (!fallbackVariety) return;

    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          varietyId: fallbackVariety.id,
          quantity: 6,
          conditioning: prev.conditioning || conditioningOptions[0],
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (!form) return;
    setForm(prev => (prev ? { ...prev, items: prev.items.filter((_, idx) => idx !== index) } : prev));
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!form) {
      errors.push('Le formulaire ne peut pas être chargé : vérifiez les données catalogue et magasins.');
      return errors;
    }
    if (!form.customerName.trim()) errors.push('Le nom du client est requis.');
    if (!form.customerPhone.trim()) errors.push('Le numéro de téléphone est requis.');
    if (!form.deliveryDate) errors.push('La date de livraison est requise.');
    if (!form.productionDate) errors.push("La date de production doit être proposée à l'admin.");
    if (!form.storeId) errors.push('Sélectionnez un magasin demandeur.');
    if (!form.items.length) errors.push('Ajoutez au moins une variété du catalogue.');
    if (form.items.some(item => item.quantity <= 0)) {
      errors.push('Chaque ligne commande doit avoir une quantité positive.');
    }
    return errors;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const errors = validateForm();
    setFormErrors(errors);
    setSuccessMessage('');

    if (errors.length) return;

    const store = storeOptions.find(s => s.id === form.storeId);

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      storeId: form.storeId,
      storeName: store?.name,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      companyName: form.companyName || undefined,
      deliveryAddress: form.deliveryAddress || undefined,
      billingAddress: form.billingAddress || undefined,
      deliveryDate: form.deliveryDate,
      productionDate: form.productionDate,
      productionApproved: false,
      orderType: form.orderType,
      paymentStatus: form.paymentStatus,
      handledBy: form.handledBy || (user?.fullName ?? ''),
      deliveredBy: form.deliveredBy || undefined,
      conditioning: form.conditioning,
      comments: form.comments || undefined,
      items: form.items,
      createdAt: new Date().toISOString(),
    };

    setOrders(prev => [newOrder, ...prev]);
    setSuccessMessage('Commande ajoutée au plan de production (brouillon en attente de validation).');
    setForm(buildInitialForm(form.storeId, catalogueForStore(form.storeId)));
  };

  const toggleApproval = (orderId: string) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, productionApproved: !order.productionApproved } : order
      )
    );
  };

  if (adminLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
        <LoadingSpinner message="Chargement du catalogue Supabase..." />
      </div>
    );
  }

  const isFormReady = !!form && storeOptions.length > 0 && catalogue.length > 0;

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Commandes magasin</h1>
            <p className="text-gray-600">
              Saisie catalogue-only pour tous les magasins demandeurs avec intégration au plan de production.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 text-sm text-gray-600">
            <div className="px-3 py-2 bg-krispy-green-light text-krispy-green rounded-lg border border-krispy-green/30">
              Statut paiement indicatif : Déjà payé / À facturer / À la livraison
            </div>
            <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              Validation production par Admin avant injection dans les plans
            </div>
          </div>
        </div>

        {adminError && (
          <div className="rounded-md bg-red-50 p-4 mb-4 text-sm text-red-700 flex items-start gap-2">
            <span className="font-semibold">Erreur :</span>
            <span>{adminError}</span>
            <button
              type="button"
              onClick={refresh}
              className="ml-auto inline-flex items-center px-3 py-1 text-xs font-medium rounded-md border border-red-200 text-red-700 hover:bg-red-100"
            >
              Réessayer
            </button>
          </div>
        )}

        {!isFormReady ? (
          <div className="rounded-md bg-yellow-50 p-4 text-yellow-800 text-sm">
            <p className="font-semibold">Catalogue ou magasins indisponibles.</p>
            <p className="mt-1">Vérifiez les données Supabase dans l'Admin puis rechargez la page.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark"
              >
                Recharger les données
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Magasin demandeur</label>
                <select
                  value={form.storeId}
                  onChange={e => handleFormChange('storeId', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {storeOptions.map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name} — {store.location}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom du client</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={e => handleFormChange('customerName', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Client final"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                  <input
                    type="tel"
                    value={form.customerPhone}
                    onChange={e => handleFormChange('customerPhone', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="+41..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type de commande</label>
                  <select
                    value={form.orderType}
                    onChange={e => handleFormChange('orderType', e.target.value as OrderType)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  >
                    {Object.entries(orderTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Statut paiement</label>
                  <select
                    value={form.paymentStatus}
                    onChange={e => handleFormChange('paymentStatus', e.target.value as OrderPaymentStatus)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  >
                    {Object.entries(paymentStatusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.orderType === 'b2b' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Société / B2B</label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={e => handleFormChange('companyName', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Adresse de livraison</label>
                      <input
                        type="text"
                        value={form.deliveryAddress}
                        onChange={e => handleFormChange('deliveryAddress', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                        placeholder="Rue, ville"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Adresse de facturation</label>
                      <input
                        type="text"
                        value={form.billingAddress}
                        onChange={e => handleFormChange('billingAddress', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                        placeholder="Rue, ville"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date de livraison</label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={e => handleFormChange('deliveryDate', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date de production</label>
                  <input
                    type="date"
                    value={form.productionDate}
                    onChange={e => handleFormChange('productionDate', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cette date doit être validée par l'Admin avant injection dans le plan.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Conditionnement</label>
                  <select
                    value={form.conditioning}
                    onChange={e => handleFormChange('conditioning', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  >
                    {conditioningOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Commentaire</label>
                  <input
                    type="text"
                    value={form.comments}
                    onChange={e => handleFormChange('comments', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Infos livraison, allergènes..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Traitée par</label>
                  <input
                    type="text"
                    value={form.handledBy}
                    onChange={e => handleFormChange('handledBy', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Nom de l'opérateur"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Livrée par</label>
                  <input
                    type="text"
                    value={form.deliveredBy}
                    onChange={e => handleFormChange('deliveredBy', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Livreur (B2B)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Variétés du catalogue</h2>
                <p className="text-sm text-gray-600">
                  Seules les variétés autorisées pour le magasin sélectionné peuvent être ajoutées.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
              >
                Ajouter une ligne
              </button>
            </div>

            <div className="space-y-4">
              {form.items.map((item, index) => {
                const availableVarieties = catalogueForStore(form.storeId);
                return (
                  <div
                    key={`${item.varietyId}-${index}`}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 border border-gray-100 rounded-lg p-4"
                  >
                    <div className="md:col-span-5">
                      <label className="block text-sm font-medium text-gray-700">Variété</label>
                      <select
                        value={item.varietyId}
                        onChange={e => handleItemChange(index, 'varietyId', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      >
                        {availableVarieties.map(variety => (
                          <option key={variety.id} value={variety.id}>
                            {variety.name} {variety.orderOnly ? '(commande)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Quantité</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Conditionnement</label>
                      <select
                        value={item.conditioning}
                        onChange={e => handleItemChange(index, 'conditioning', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      >
                        {conditioningOptions.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {formErrors.length > 0 && (
            <div className="rounded-md bg-red-50 p-4">
              <h3 className="text-sm font-medium text-red-800">Veuillez corriger les champs suivants :</h3>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                {formErrors.map(error => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {successMessage && (
            <div className="rounded-md bg-green-50 p-4 text-green-700 text-sm flex items-start gap-2">
              <span className="font-semibold">Succès :</span>
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
            >
              Ajouter au plan
            </button>
          </div>
        </form>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Commandes planifiées</h2>
            <p className="text-sm text-gray-600">
              Brouillons en attente d'approbation Admin pour figurer dans les plans et la page Stats.
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-sm text-gray-600">Aucune commande saisie pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commande</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Articles</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map(order => (
                  <tr key={order.id}>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="font-semibold">{order.customerName}</div>
                      <div className="text-gray-600">{orderTypeLabels[order.orderType]}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="font-semibold">{order.storeName || 'Magasin inconnu'}</div>
                      <div className="text-gray-600">{order.storeId}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div>Livraison : {order.deliveryDate}</div>
                      <div>Production : {order.productionDate}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {paymentStatusLabels[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${
                          order.productionApproved
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {order.productionApproved ? 'Validée (Admin)' : 'À valider'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <ul className="space-y-1">
                        {order.items.map(item => {
                          const variety = catalogue.find(v => v.id === item.varietyId);
                          return (
                            <li key={`${order.id}-${item.varietyId}`} className="flex flex-col">
                              <span className="font-medium">{variety?.name || item.varietyId}</span>
                              <span className="text-gray-600 text-xs">
                                {item.quantity} × {item.conditioning}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <button
                        onClick={() => toggleApproval(order.id)}
                        className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        {order.productionApproved ? 'Marquer en attente' : 'Valider la production'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
