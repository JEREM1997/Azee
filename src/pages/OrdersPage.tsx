import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  createOrder,
  deleteOrder,
  fetchOrders,
  updateOrderProduction,
} from '../services/ordersService';
import { DonutVariety, Order, OrderLineItem, OrderPaymentStatus, OrderType, Store } from '../types';

interface OrderFormState {
  customerName: string;
  customerPhone: string;
  companyName: string;
  deliveryAddress: string;
  billingAddress: string;
  deliveryDate: string;
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
  deja_paye: 'Déja payé',
  a_facturer: 'à facturer',
  a_la_livraison: 'A la livraison',
};

const orderTypeLabels: Record<OrderType, string> = {
  retail: 'Retail',
  b2b: 'B2B',
};

const conditioningOptions = ['Boite 6', 'Boite 12'];

const buildInitialForm = (storeId: string, catalogue: DonutVariety[]): OrderFormState => {
  const defaultDelivery = new Date();
  defaultDelivery.setDate(defaultDelivery.getDate() + 1);
  const deliveryDate = defaultDelivery.toISOString().split('T')[0];
  const firstVariety = catalogue[0];

  return {
    customerName: '',
    customerPhone: '',
    companyName: '',
    deliveryAddress: '',
    billingAddress: '',
    deliveryDate,
    storeId,
    orderType: 'retail',
    paymentStatus: 'à_facturer',
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
  const { user, isAdmin, isProduction } = useAuth();
  const { stores, varieties, loading: adminLoading, error: adminError, refresh } = useAdmin();
  const [form, setForm] = useState<OrderFormState | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  const isStoreUser = user?.role === 'store';
  const canManageOrders = isAdmin || isProduction;
  const catalogue = useMemo(
    () => varieties.filter(variety => variety.isActive && variety.isOrderable !== false),
    [varieties]
  );

  const storeOptions = useMemo<Store[]>(() => {
    const activeStores = stores.filter(store => store.isActive);
    if (isStoreUser) {
      if (!user?.storeIds?.length) return [];
      return activeStores.filter(store => user.storeIds?.includes(store.id));
    }
    return activeStores;
  }, [isStoreUser, stores, user?.storeIds]);

  const preferredStoreId = useMemo(() => {
    if (isStoreUser && user?.storeIds?.length) {
      const assignedStore = storeOptions.find(store => user.storeIds?.includes(store.id));
      if (assignedStore) return assignedStore.id;
    }
    return storeOptions[0]?.id || '';
  }, [isStoreUser, storeOptions, user?.storeIds]);

  useEffect(() => {
    if (adminLoading) return;
    if (!catalogue.length || !storeOptions.length) {
      setForm(null);
      return;
    }
    setForm(buildInitialForm(preferredStoreId, catalogue));
  }, [adminLoading, catalogue, preferredStoreId, storeOptions]);

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const data = await fetchOrders({ role: user?.role, storeIds: user?.storeIds });
      setOrders(data);
    } catch (error) {
      console.error('Error while loading orders:', error);
      setOrdersError(error instanceof Error ? error.message : 'Impossible de charger les commandes depuis Supabase.'); 
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.role, user?.storeIds]);

  useEffect(() => {
    if (!adminLoading) {
      loadOrders();
    }
  }, [adminLoading, loadOrders]);

  const handleFormChange = (field: keyof OrderFormState, value: string) => {
    if (!form) return;
    setForm(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleItemChange = (index: number, field: keyof OrderLineItem, value: string | number) => {
    if (!form) return;
    setForm(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value } as OrderLineItem;
      return { ...prev, items };
    });
  };

  const handleAddItem = () => {
    if (!form || !catalogue.length) return;
    setForm(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [
          ...prev.items,
          { varietyId: catalogue[0].id, quantity: 6, conditioning: prev.conditioning || conditioningOptions[0] },
        ],
      };
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!form) return;
    setForm(prev => (prev ? { ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) } : prev));
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!form) return ['Le formulaire ne peut pas etre chargé.'];
    if (!form.storeId) errors.push('Sélectionnez un magasin.');
    if (!form.customerName.trim()) errors.push('Le nom du client est requis.');
    if (!form.customerPhone.trim()) errors.push('Le numero de télephone est requis.');
    if (!form.deliveryDate) errors.push('La date de livraison est requise.');
    if (!form.items.length) errors.push('Ajoutez au moins une variété.');
    if (form.items.some(item => item.quantity <= 0)) errors.push('Chaque ligne doit avoir une quantité positive.');
    return errors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || submitting) return;

    const errors = validateForm();
    setFormErrors(errors);
    setSuccessMessage('');
    if (errors.length) return;

    const store = storeOptions.find(item => item.id === form.storeId);

    try {
      setSubmitting(true);
      const savedOrder = await createOrder({
        storeId: form.storeId,
        storeName: store?.name,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        companyName: form.companyName || undefined,
        deliveryAddress: form.deliveryAddress || undefined,
        billingAddress: form.billingAddress || undefined,
        deliveryDate: form.deliveryDate,
        productionApproved: false,
        orderType: form.orderType,
        paymentStatus: form.paymentStatus,
        handledBy: form.handledBy || user?.fullName || user?.email || '',
        deliveredBy: form.deliveredBy || undefined,
        conditioning: form.conditioning,
        comments: form.comments || undefined,
        items: form.items,
      });

      setOrders(prev => [savedOrder, ...prev]);
      setForm(buildInitialForm(form.storeId, catalogue));
      setFormErrors([]);
      setSuccessMessage('Commande enregistrée. Un admin doit encore fixer puis valider la date de production.');
    } catch (error) {
      console.error('Error while creating order:', error);
      setFormErrors(["Impossible d'enregistrer la commande dans Supabase."]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductionFieldChange = (orderId: string, value: string) => {
    setOrders(prev => prev.map(order => (order.id === orderId ? { ...order, productionDate: value } : order)));
  };

  const canDeleteOrder = (order: Order) => {
    if (canManageOrders) {
      return true;
    }

    if (!isStoreUser) {
      return false;
    }

    return !order.productionApproved && !!user?.storeIds?.includes(order.storeId);
  };

  const saveAdminDate = async (orderId: string) => {
    const order = orders.find(item => item.id === orderId);
    if (!order?.productionDate) {
      setOrdersError('La date de production admin est requise.');
      return;
    }

    try {
      setSavingOrderId(orderId);
      setOrdersError(null);
      const updated = await updateOrderProduction(orderId, order.productionDate, order.productionApproved);
      setOrders(prev => prev.map(item => (item.id === orderId ? updated : item)));
      setSuccessMessage('Date de production enregistrée.');
    } catch (error) {
      console.error('Error while saving order date:', error);
      setOrdersError(error instanceof Error ? error.message : "Impossible d'enregistrer la date de production."); 
    } finally {
      setSavingOrderId(null);
    }
  };

  const approveOrder = async (orderId: string) => {
    const order = orders.find(item => item.id === orderId);
    if (!order?.productionDate) {
      setOrdersError('La date de production admin est requise avant validation.');
      return;
    }

    try {
      setSavingOrderId(orderId);
      setOrdersError(null);
      const updated = await updateOrderProduction(orderId, order.productionDate, true);
      setOrders(prev => prev.map(item => (item.id === orderId ? updated : item)));
      setSuccessMessage('Commande validée. Elle doit maintenant apparaitre dans le plan du bon magasin.');
    } catch (error) {
      console.error('Error while approving order:', error);
      setOrdersError(error instanceof Error ? error.message : "Impossible de valider la commande.");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const order = orders.find(item => item.id === orderId);
    if (!order) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer la commande de ${order.customerName} pour ${order.storeName || order.storeId} ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingOrderId(orderId);
      setOrdersError(null);
      setSuccessMessage('');
      await deleteOrder(orderId);
      setOrders(prev => prev.filter(item => item.id !== orderId));
      setSuccessMessage('Commande supprimée.');
    } catch (error) {
      console.error('Error while deleting order:', error);
      setOrdersError(error instanceof Error ? error.message : "Impossible de supprimer la commande.");
    } finally {
      setSavingOrderId(null);
    }
  };

  const isFormReady = !!form && catalogue.length > 0 && storeOptions.length > 0;

  if (adminLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
        <LoadingSpinner message="Chargement du catalogue..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Commandes magasin</h1>
            <p className="text-gray-600">Le magasin saisit seulement la livraison. La production est fixée par un admin.</p>
          </div>
          <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-sm">
            Validation admin obligatoire avant apparition dans le plan
          </div>
        </div>

        {adminError && (
          <div className="rounded-md bg-red-50 p-4 mb-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Erreur :</span>
              <span>{adminError}</span>
              <button type="button" onClick={refresh} className="ml-auto text-xs underline">
                Réessayer
              </button>
            </div>
          </div>
        )}

        {!isFormReady ? (
          <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
            Catalogue ou magasins indisponibles pour ce compte.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Magasin demandeur</label>
                  <select
                    value={form.storeId}
                    onChange={event => handleFormChange('storeId', event.target.value)}
                    disabled={isStoreUser && storeOptions.length === 1}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green disabled:bg-gray-100"
                  >
                    {storeOptions.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name} - {store.location}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={event => handleFormChange('customerName', event.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Nom du client"
                  />
                  <input
                    type="tel"
                    value={form.customerPhone}
                    onChange={event => handleFormChange('customerPhone', event.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Télephone"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    value={form.orderType}
                    onChange={event => handleFormChange('orderType', event.target.value as OrderType)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  >
                    {Object.entries(orderTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={form.paymentStatus}
                    onChange={event => handleFormChange('paymentStatus', event.target.value as OrderPaymentStatus)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  >
                    {Object.entries(paymentStatusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                {form.orderType === 'b2b' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={event => handleFormChange('companyName', event.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      placeholder="Sociéte"
                    />
                    <input
                      type="text"
                      value={form.billingAddress}
                      onChange={event => handleFormChange('billingAddress', event.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      placeholder="Adresse de facturation"
                    />
                    <input
                      type="text"
                      value={form.deliveryAddress}
                      onChange={event => handleFormChange('deliveryAddress', event.target.value)}
                      className="sm:col-span-2 rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                      placeholder="Adresse de livraison"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={event => handleFormChange('deliveryDate', event.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                />
                <p className="text-xs text-gray-500">La date de production reste reservée à la validation admin.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    value={form.conditioning}
                    onChange={event => handleFormChange('conditioning', event.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                  >
                    {conditioningOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.comments}
                    onChange={event => handleFormChange('comments', event.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Commentaire"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={form.handledBy}
                    onChange={event => handleFormChange('handledBy', event.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Traitée par"
                  />
                  <input
                    type="text"
                    value={form.deliveredBy}
                    onChange={event => handleFormChange('deliveredBy', event.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    placeholder="Livrée par"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Variétés commandées</h2>
                  <p className="text-sm text-gray-600">Sélection depuis le catalogue actif.</p>
                </div>
                <button type="button" onClick={handleAddItem} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-krispy-green hover:bg-krispy-green-dark">
                  Ajouter une ligne
                </button>
              </div>

              {form.items.map((item, index) => (
                <div key={`${item.varietyId}-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <div className="md:col-span-5">
                    <select
                      value={item.varietyId}
                      onChange={event => handleItemChange(index, 'varietyId', event.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    >
                      {catalogue.map(variety => (
                        <option key={variety.id} value={variety.id}>{variety.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={event => handleItemChange(index, 'quantity', Number(event.target.value))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <select
                      value={item.conditioning}
                      onChange={event => handleItemChange(index, 'conditioning', event.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                    >
                      {conditioningOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-600 text-sm">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {formErrors.length > 0 && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {formErrors.map(error => <li key={error}>{error}</li>)}
                </ul>
              </div>
            )}

            {successMessage && <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">{successMessage}</div>}

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="px-6 py-3 text-sm font-semibold rounded-md text-white bg-krispy-green hover:bg-krispy-green-dark disabled:opacity-60">
                {submitting ? 'Enregistrement...' : 'Enregistrer la commande'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Commandes</h2>
          <p className="text-sm text-gray-600">Les magasins ne voient que leurs propres commandes.</p>
        </div>

        {ordersError && <div className="rounded-md bg-red-50 p-4 mb-4 text-sm text-red-700">{ordersError}</div>}

        {ordersLoading ? (
          <LoadingSpinner message="Chargement des commandes..." />
        ) : orders.length === 0 ? (
          <div className="text-sm text-gray-600">Aucune commande pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="overflow-hidden md:overflow-x-auto">
            <table className="responsive-table min-w-full divide-y divide-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commande</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Livraison</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Articles</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map(order => (
                  <tr key={order.id}>
                    <td data-label="Commande" className="px-4 py-4 text-sm text-gray-900">
                      <div className="font-semibold">{order.customerName}</div>
                      <div className="text-gray-600">{orderTypeLabels[order.orderType]}</div>
                    </td>
                    <td data-label="Magasin" className="px-4 py-4 text-sm text-gray-900">
                      <div className="font-semibold">{order.storeName || 'Magasin inconnu'}</div>
                      <div className="text-gray-600">{order.storeId}</div>
                    </td>
                    <td data-label="Livraison" className="px-4 py-4 text-sm text-gray-900">
                      <div>Livraison : {order.deliveryDate}</div>
                      {canManageOrders && (
                        <div className="mt-2 space-y-2">
                          <div className="text-xs text-gray-500">Date de production admin</div>
                          {order.productionApproved ? (
                            <div className="text-sm text-gray-700">{order.productionDate}</div>
                          ) : (
                            <>
                              <input
                                type="date"
                                value={order.productionDate}
                                onChange={event => handleProductionFieldChange(order.id, event.target.value)}
                                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                              />
                              <button
                                type="button"
                                onClick={() => saveAdminDate(order.id)}
                                disabled={savingOrderId === order.id}
                                className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              >
                                {savingOrderId === order.id ? 'Enregistrement...' : 'Enregistrer la date'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td data-label="Paiement" className="px-4 py-4 text-sm text-gray-900">
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {paymentStatusLabels[order.paymentStatus]}
                      </span>
                    </td>
                    <td data-label="Production" className="px-4 py-4 text-sm text-gray-900">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${order.productionApproved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {order.productionApproved ? 'Validée par admin' : 'En attente de validation'}
                      </span>
                    </td>
                    <td data-label="Articles" className="px-4 py-4 text-sm text-gray-900">
                      <ul className="space-y-1">
                        {order.items.map(item => {
                          const variety = catalogue.find(entry => entry.id === item.varietyId);
                          return (
                            <li key={`${order.id}-${item.varietyId}`} className="flex flex-col">
                              <span className="font-medium">{variety?.name || item.varietyId}</span>
                              <span className="text-gray-600 text-xs">{item.quantity} x {item.conditioning}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                     <td data-label="Actions" className="px-4 py-4 text-right text-sm">
                      <div className="flex flex-col gap-2 items-stretch md:items-end">
                        {canManageOrders ? (
                          order.productionApproved ? (
                           <span className="text-green-700 text-xs font-medium md:text-right">Validation terminée</span> 
                          ) : (
                            <button
                              type="button"
                              onClick={() => approveOrder(order.id)}
                              disabled={savingOrderId === order.id}
                              className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              {savingOrderId === order.id ? 'Validation...' : 'Valider et ajouter au plan'}
                            </button>
                          )
                        ) : (
                          <span className="text-gray-500 text-xs">Validation reservee a l'admin</span>
                        )}

                        {canDeleteOrder(order) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={savingOrderId === order.id}
                            className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                           {savingOrderId === order.id ? 'Suppression...' : 'Supprimer'} 
                          </button>
                         )}
                      </div>
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
