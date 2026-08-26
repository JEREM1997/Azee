import React from 'react';
import { AlertTriangle, ArrowRight, LucideIcon, RotateCcw } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, icon: Icon, actions, meta }: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  const context = /atelier|production/i.test(eyebrow)
    ? 'operations'
    : /logistique|livraison/i.test(eyebrow)
      ? 'logistics'
      : /commande/i.test(eyebrow)
        ? 'commerce'
        : /pilotage|traçabilité/i.test(eyebrow)
          ? 'reporting'
          : 'administration';

  return (
    <header className={`page-hero page-hero--${context}`}>
      <div className="page-hero__copy">
        <div className="page-hero__eyebrow">{Icon && <Icon aria-hidden="true" />}{eyebrow}</div>
        <h1 className="page-hero__title">{title}</h1>
        <p className="page-hero__description">{description}</p>
        {meta && <div className="page-hero__meta">{meta}</div>}
      </div>
      {actions && <div className="page-hero__actions">{actions}</div>}
    </header>
  );
}

export function MetricStrip({ items }: { items: Array<{ label: string; value: React.ReactNode; detail?: string; tone?: 'green' | 'red' | 'amber' | 'blue' | 'violet' }> }) {
  return <section className="metric-strip" aria-label="Résumé de la page">{items.map((item) => (
    <div className="metric-strip__item" key={item.label}>
      <span className={`metric-strip__marker metric-strip__marker--${item.tone || 'green'}`} />
      <div><p>{item.label}</p><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}</div>
    </div>
  ))}</section>;
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="page-alert page-alert--error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Impossible d’afficher les informations</strong><p>{message}</p></div>{onRetry && <button type="button" onClick={onRetry}><RotateCcw />Réessayer</button>}</div>;
}

export function EmptyState({ icon: Icon, title, description, action, onAction }: { icon: LucideIcon; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="purpose-empty"><span><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p>{action && onAction && <button type="button" className="btn-primary" onClick={onAction}>{action}<ArrowRight /></button>}</div>;
}
