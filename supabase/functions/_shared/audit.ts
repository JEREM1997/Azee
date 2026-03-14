export interface AuditActor {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  planId?: string | null;
  storeProductionId?: string | null;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(
  supabaseClient: any,
  actor: AuditActor,
  entry: AuditEntry
) {
  try {
    const { error } = await supabaseClient.from('audit_logs').insert({
      actor_user_id: actor.userId ?? null,
      actor_email: actor.email ?? null,
      actor_role: actor.role ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      plan_id: entry.planId ?? null,
      store_production_id: entry.storeProductionId ?? null,
      details: entry.details ?? {},
    });

    if (error) {
      console.error('[audit] failed to write log', {
        error,
        action: entry.action,
        entityType: entry.entityType,
      });
    }
  } catch (error) {
    console.error('[audit] unexpected write failure', error);
  }
}

export function summarizeMapQuantities(values: Record<string, unknown> | undefined) {
  if (!values) {
    return { count: 0, total: 0 };
  }

  return Object.values(values).reduce(
    (summary, value) => {
      const numericValue = Number(value);
      if (!Number.isNaN(numericValue)) {
        summary.count += 1;
        summary.total += numericValue;
      }
      return summary;
    },
    { count: 0, total: 0 }
  );
}

export function summarizePlanSnapshot(plan: any) {
  if (!plan) {
    return null;
  }

  const stores = Array.isArray(plan.stores) ? plan.stores : [];
  const summary = {
    date: plan.date ?? null,
    status: plan.status ?? null,
    store_count: stores.length,
    delivery_confirmed_count: 0,
    waste_reported_count: 0,
    production_item_count: 0,
    item_received_count: 0,
    item_waste_count: 0,
    box_count: 0,
    box_received_count: 0,
    box_waste_count: 0,
  };

  for (const store of stores) {
    if (store?.delivery_confirmed) {
      summary.delivery_confirmed_count += 1;
    }

    if (store?.waste_reported) {
      summary.waste_reported_count += 1;
    }

    for (const item of store?.production_items ?? []) {
      summary.production_item_count += 1;
      if (item?.received !== null && item?.received !== undefined) {
        summary.item_received_count += 1;
      }
      if (item?.waste !== null && item?.waste !== undefined) {
        summary.item_waste_count += 1;
      }
    }

    for (const box of store?.box_productions ?? []) {
      summary.box_count += 1;
      if (box?.received !== null && box?.received !== undefined) {
        summary.box_received_count += 1;
      }
      if (box?.waste !== null && box?.waste !== undefined) {
        summary.box_waste_count += 1;
      }
    }
  }

  return summary;
}
