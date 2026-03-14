import React, { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuditLog } from '../types';

const ACTION_OPTIONS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'plan.create', label: 'Creation de plan' },
  { value: 'plan.update', label: 'Modification de plan' },
  { value: 'plan.delete', label: 'Suppression de plan' },
  { value: 'delivery.confirm_reception', label: 'Confirmation reception' },
  { value: 'delivery.update_reception', label: 'Mise a jour reception' },
  { value: 'delivery.report_waste', label: 'Declaration dechets' },
  { value: 'delivery.update', label: 'Autre mise a jour livraison' },
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('fr-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatAction = (action: string) => {
  return ACTION_OPTIONS.find((option) => option.value === action)?.label || action;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }

    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  return "Erreur lors du chargement de l'audit";
};

const formatDetails = (log: AuditLog) => {
  const details = log.details || {};

  if (log.action === 'plan.create' || log.action === 'plan.update') {
    const previous = details.previous_plan_summary as Record<string, unknown> | null | undefined;
    const beforeReception = typeof previous?.delivery_confirmed_count === 'number'
      ? previous.delivery_confirmed_count
      : 0;
    const beforeWaste = typeof previous?.waste_reported_count === 'number'
      ? previous.waste_reported_count
      : 0;

    return [
      details.plan_date ? `Plan ${details.plan_date}` : null,
      typeof details.store_count === 'number' ? `${details.store_count} magasins` : null,
      log.action === 'plan.update' ? `Avant: ${beforeReception} receptions, ${beforeWaste} dechets` : null,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  if (log.action.startsWith('delivery.')) {
    return [
      details.store_name ? `Magasin ${details.store_name}` : null,
      typeof details.received_item_count === 'number' ? `Articles recus: ${details.received_item_count}` : null,
      typeof details.waste_item_count === 'number' ? `Articles dechets: ${details.waste_item_count}` : null,
      typeof details.received_box_count === 'number' ? `Boites recues: ${details.received_box_count}` : null,
      typeof details.waste_box_count === 'number' ? `Boites dechets: ${details.waste_box_count}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  if (log.action === 'plan.delete') {
    return [
      details.plan_date ? `Plan ${details.plan_date}` : null,
      details.status ? `Statut ${String(details.status)}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  return JSON.stringify(details);
};

const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actorEmail, setActorEmail] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await apiService.audit.getLogs({
        actorEmail: actorEmail.trim() || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 200,
      });

      if (apiError) {
        throw apiError;
      }

      setLogs(data || []);
    } catch (err) {
      setError(getErrorMessage(err)); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit</h1>
          <p className="mt-2 text-sm text-gray-600">
            Historique des modifications de plans et des validations de reception/dechets.
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="mt-4 inline-flex items-center rounded-md bg-krispy-green px-4 py-2 text-sm font-medium text-white hover:bg-krispy-green-dark disabled:opacity-50 sm:mt-0"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="text"
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="jeremie@krispykreme.ch"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-krispy-green focus:outline-none focus:ring-1 focus:ring-krispy-green"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-krispy-green focus:outline-none focus:ring-1 focus:ring-krispy-green"
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Debut</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-krispy-green focus:outline-none focus:ring-1 focus:ring-krispy-green"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-krispy-green focus:outline-none focus:ring-1 focus:ring-krispy-green"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {logs.length} entree{logs.length > 1 ? 's' : ''} chargee{logs.length > 1 ? 's' : ''}
          </p>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Search className="mr-2 h-4 w-4" />
            Filtrer
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Utilisateur</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cible</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucun evenement d'audit pour ces filtres.
                  </td>
                </tr>
              )}

              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="font-medium text-gray-900">{log.actor_email || 'Inconnu'}</div>
                    <div className="text-xs text-gray-500">{log.actor_user_id || ''}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {log.actor_role || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {formatAction(log.action)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div>{log.entity_type}</div>
                    <div className="text-xs text-gray-500">
                      {log.plan_id || log.store_production_id || log.entity_id || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="max-w-xl whitespace-normal break-words text-sm text-gray-600">
                      {formatDetails(log)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
