# Production Page Documentation

## Overview
The Production Page is the central hub for managing, planning, and tracking doughnut production across all stores. It is designed for production managers, store staff, and administrators to coordinate daily operations, confirm production, record deliveries and wastage, and analyze historical production data.

---

## Purpose
- **Plan and confirm daily doughnut production for each store.**
- **Track actual vs. planned production.**
- **Record deliveries and wastage.**
- **Provide analytics and historical data for continuous improvement.**
- **View consolidated production summary across all stores.**

---

## User Roles & Permissions
- **Production Staff:**
  - View, create, and edit daily production plans for their assigned store(s).
  - Save daily production plans.
  - Record actual production, deliveries, and wastage.
- **Store Managers (Magasins):**
  - Can only view the production plan for their assigned store(s).
  - Cannot create or edit production plans.
- **Admins:**
  - View and edit all production data for all stores.
  - Create and edit production plans for any store.
  - Access analytics and historical reports.
  - Override production plans as needed.

---

## Main Features
1. **Production Summary Dashboard**
   - Overview of total production across all stores
   - Four main summary cards:
     * Total Doughnuts:
       - Combined total of all doughnuts
       - Breakdown between individual and boxed doughnuts
     * Main Varieties:
       - List of active varieties with their total quantities
       - Only shows varieties with planned production
     * Store Summary:
       - Breakdown of total doughnuts by store
       - Only shows stores with planned production
     * Par Forme (avec 5% de réserve):
       - Production totals grouped by donut form/shape
       - Includes 5% reserve calculation for production planning
       - Shows base quantity and reserve amount separately
       - Helps production staff plan raw materials by form type

2. **Daily Production Plan**
   - View planned production by store and variety.
   - Display donut form/shape for each variety in dedicated "Forme" column.
   - Only Production Staff and Admins can create or edit plans.
   - Store Managers (Magasins) can only view the plan for their assigned store(s).
   - Save or adjust planned quantities (Production Staff/Admin only).
   - Total doughnut count includes both individual doughnuts and box quantities.
   - After saving, users can navigate to the Plans page to view all saved plans.

3. **Box Management**
   - Plan box quantities for each store.
   - Display both box count and total doughnuts per box type:
     * Box Count: Number of boxes ordered
     * Total Quantity: Box size × Box count (automatically calculated)
   - Example: For a box of size 6
     * Box Count of 2 means 2 boxes
     * Total Quantity shows 12 doughnuts (6 × 2)
   - Clear separation between box quantities and total doughnuts
   - Only authorized users can modify box quantities
   - Box quantities automatically contribute to store's total doughnut count

4. **Saved Plans Management**
   - All saved production plans are accessible via the Plans page (/plans)
   - Users can view historical plans and their details
   - Plans are displayed with status indicators (draft, validated, completed)
   - Detailed view shows breakdown by store, varieties, and boxes

5. **Delivery & Waste Tracking**
   - Record delivered quantities for each store.
   - Report and track wastage.
   - Confirm delivery and waste status.

6. **Historical Data & Analytics**
   - View past production plans and outcomes.
   - Analyze trends by store, variety, and time period.
   - Export or print reports as needed.

7. **Role-Based Access**
   - Only authorized users can view or edit production data.
   - Admins have full access; store/production roles are scoped to their stores.

---

## Data Flow & Services
- **Data Fetching:**
  - Uses `getCurrentDayPlan(date)` and `getProductionPlans(limit)` from `src/services/productionService.ts`.
  - Store, variety, and box data fetched via `getAllStoreData()`.
- **Data Saving:**
  - Save/update plans: `savePlan(planData)`
  - Update delivery/waste: `updateDeliveryStatus(storeProductionId, data)`
- **Types Used:**
  - `ProductionPlan`, `ProductionPlanData`, `StoreProductionPlan`, `ProductionItem` (see `src/types/index.ts`)
- **Edge Functions:**
  - `/functions/v1/get-current-plan`
  - `/functions/v1/get-production-plans`
  - `/functions/v1/save-production-plan`
  - `/functions/v1/update-delivery-status`

---

## UI/UX Guidelines
- Display production summary at the top of the page for quick overview
- Use clear, responsive tables for production data (by store, by variety, and by box)
- Implement scrollable areas for long lists in summary cards
- Use consistent color coding:
  * Primary totals in krispy-green
  * Secondary information in neutral grays
- Show zero-state handling (hide empty entries in summaries)
- Provide visual cues for status: confirmed/unconfirmed, delivered/undelivered, waste reported
- Allow easy navigation between days and historical data
- Use modals or confirmations for critical actions
- Ensure all actions are clearly labeled and require minimal clicks
- Display error and success messages for all user actions

---

## Example User Flow
1. **Initial Overview:** User reviews production summary dashboard
   - Checks total doughnut count
   - Reviews variety distribution
   - Examines store-by-store breakdown
   - Reviews form-based totals with reserves

2. **Morning:** Production manager reviews and saves the daily plan
   - Sets individual doughnut quantities
   - Plans box quantities:
     * Selects number of boxes needed
     * Reviews automatically calculated total doughnuts per box type
     * System shows both box count and total doughnuts
   - Reviews total doughnut count (individual + boxes)
   - Saves the production plan
   - Optionally navigates to Plans page to view all saved plans

3. **Plan Management:** Users can access saved plans
   - Navigate to Plans page (/plans) to view all production plans
   - View detailed breakdown of any saved plan
   - Monitor plan status and completion

4. **During the day:** Staff record actual production, deliveries, and wastage

5. **End of day:** Data is finalized, and statistics are updated for reporting

---

## Best Practices
- Always fetch the latest data from the backend (do not use mock data in production)
- Use the provided services for all data operations
- Handle loading, error, and empty states gracefully
- Follow modular design and error handling patterns from the rest of the project
- Ensure all user actions are logged and auditable
- Verify total doughnut counts include both individual and boxed quantities
- Keep summary views updated as changes are made to the production plan

## Troubleshooting

### Production Plan Not Appearing in Plans Page
If a production plan is saved but doesn't appear in the Plans page, check:

1. **Console Logs**: Check browser console for errors during save/fetch operations
2. **Data Structure**: Verify the saved data matches the expected database schema:
   - `production_plans` table with correct date and status
   - `store_productions` table with plan_id reference
   - `production_items` and `box_productions` with correct foreign keys
3. **Date Range**: Plans page shows last 30 days - ensure the plan date is within range
4. **User Permissions**: Verify user has correct role (admin/production) to view plans
5. **Database Constraints**: Check for any database constraint violations during save

### Data Consistency Issues
To ensure data consistency between save and display:

1. **Field Mapping**: Verify field names match between save and fetch operations:
   - Save: `items` array → Fetch: `production_items` array
   - Save: `boxes` array → Fetch: `box_productions` array
   - Save: `boxId` → Fetch: `box_id`
2. **Status Values**: Ensure status values are valid: 'draft', 'validated', 'completed'
3. **Foreign Key References**: Verify all IDs reference existing records

### Debug Steps
1. Open browser console and save a production plan
2. Check the "Saving plan data:" log to verify data structure
3. Navigate to Plans page and check "Fetched plans data:" log
4. Use the "Actualiser" button to manually refresh plans
5. Compare saved vs fetched data structures for discrepancies

---

## References
- [production-user-guide.md](./production-user-guide.md)
- [technical-architecture.md](./technical-architecture.md)
- [user-flow.md](./user-flow.md)
- [design-guidelines.md](./design-guidelines.md)
- [PRD.md](./PRD.md)

---

*This documentation should be updated as new features are added or requirements change.* 