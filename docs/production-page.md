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
       - **Includes both individual varieties and varieties from boxes**
       - Only shows varieties with planned production
       - Calculates: Individual quantities + (Box quantities × Variety quantity per box)
       - **Dual Display Format**:
         * Primary total in units (e.g., 150)
         * Secondary breakdown in dozens and units (e.g., "12 douzaines + 6 unités")
         * Automatic calculation: dozens = floor(total ÷ 12), units = total % 12
         * Proper French pluralization (douzaine/douzaines, unité/unités)
     * Store Summary:
       - Breakdown of total doughnuts by store
       - Only shows stores with planned production
     * Par Forme (avec 5% de réserve):
       - Production totals grouped by donut form/shape
       - **Includes both individual varieties and varieties from boxes**
       - Includes 5% reserve calculation for production planning
       - Shows base quantity and reserve amount separately
       - Helps production staff plan raw materials by form type
       - Calculates: Individual form quantities + (Box quantities × Variety quantity per box for each form)

2. **Daily Production Plan**
   - View planned production by store and variety.
   - Display donut form/shape for each variety in dedicated "Forme" column.
   - **Delivery Date Management**: Each store has a configurable delivery date
     * **Manual Input Required**: Users must manually set delivery dates for each store with production
     * **No Automatic Defaults**: System does not automatically calculate or set delivery dates
     * **Validation**: Save button is disabled until all stores with production have delivery dates set
     * **Visual Indicators**: Stores missing delivery dates are highlighted with red borders and validation messages
     * **Required Field**: Delivery date input shows red asterisk (*) for stores that need dates
     * **Read-only Display**: Read-only users see the manually set delivery date or "Non définie" if not set
     * **Data Persistence**: Only manually set delivery dates are saved with the production plan
     * **Plans Page Display**: Plans page shows manually set delivery dates or "Non définie" - no automatic calculations
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
   - **Variétés Configurées**: Shows the configured varieties for each box type
     * Displays variety name and quantity per box
     * Shows "Aucune variété configurée" if no varieties are configured
     * Helps production staff understand the composition of each box type
   - **Formes de Doughnuts**: Shows the different doughnut forms/shapes in each box
     * Displays unique doughnut forms from all varieties in the box
     * Shows "Aucune forme définie" if no forms are configured for the varieties
     * Helps production staff understand the shape diversity in each box type
     * Automatically derived from the forms associated with the configured varieties
     * **Logic**: For each variety in the box → find variety.formId → lookup form.name → display unique forms
     * Ensures consistency between Variétés Configurées and Formes de Doughnuts columns
   - Example: For a box of size 6
     * Box Count of 2 means 2 boxes
     * Total Quantity shows 12 doughnuts (6 × 2)
     * Variétés Configurées might show: "Glazed: 3, Chocolate: 2, Strawberry: 1"
     * Formes de Doughnuts might show: "Ring", "Filled", "Cake"
   - **Variétés Principales Display Example**:
     * Total of 150 Glazed donuts shows as:
       - Primary: "150" (total units)
       - Secondary: "12 douzaines + 6 unités" (breakdown)
     * Total of 24 Chocolate donuts shows as:
       - Primary: "24" (total units)  
       - Secondary: "2 douzaines" (exact dozens, no units)
     * Total of 8 Boston Cream donuts shows as:
       - Primary: "8" (total units)
       - Secondary: "8 unités" (less than a dozen)
   - Clear separation between box quantities and total doughnuts
   - Only authorized users can modify box quantities
   - Box quantities automatically contribute to store's total doughnut count

4. **Saved Plans Management**
   - All saved production plans are accessible via the Plans page (/plans)
   - Users can view historical plans and their details
   - Plans are displayed with status indicators (draft, validated, completed)
   - **Detailed view shows comprehensive breakdown**:
     * **Résumé de la Production**: Complete production summary with four summary cards
       - Total Doughnuts (individual + boxes breakdown)
       - Variétés Principales (with dozens/units display)
       - Par Magasin (store-by-store totals)
       - Par Forme avec 5% de réserve (form totals with reserves)
     * **Store-by-store breakdown** with complete production details:
       - **Store header** with delivery date and total quantity
         * **Delivery date display**: Always shows a delivery date for each store
         * Uses saved delivery date when available
         * Automatically calculates fallback (production date + 1 day) when no delivery date is saved
         * Indicates when delivery date is calculated automatically vs. explicitly set
         * Enhanced debug logging to troubleshoot delivery date issues
       - **Variétés section** in table format showing:
         * Variety name
         * Form/shape (matching ProductionPage format)
         * Quantity planned
       - **Boîtes Disponibles section** in table format showing:
         * Box name and size
         * Variétés Configurées (configured varieties with quantities)
         * Formes de Doughnuts (unique doughnut forms from varieties)
         * Quantity of boxes and total doughnuts
     * All calculations include both individual varieties and box varieties
     * **Complete parity with ProductionPage**: The Plans page modal shows exactly the same level of detail as the ProductionPage, ensuring users can review all aspects of their saved plans
   - **Edit Functionality**: Users with edit permissions (admin/production) can modify existing plans
     * "Modifier" button available on each plan in the Plans page
     * Clicking "Modifier" navigates back to Production page with the plan's date pre-loaded
     * Visual indicator shows when editing an existing plan vs. creating new
     * Save button changes to "Mettre à jour" when modifying existing plans
     * Success messages differentiate between creating new plans and updating existing ones

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
- **Box Configuration Display**:
  * Show configured varieties in a compact, readable format
  * Display doughnut forms as unique list derived from variety configurations
  * Use small text (text-xs) for variety and form details to save space
  * Display "Aucune variété configurée" and "Aucune forme définie" in italics for empty states
  * Ensure variety and form information doesn't interfere with quantity input controls
  * Maintain clear visual separation between different types of information (varieties vs forms)
- **Production Summary Integration**:
  * Ensure Variétés Principales includes both individual and box varieties
  * Ensure Par Forme calculations include both individual and box form totals
  * Display accurate totals that reflect all production sources
  * **Variety Display Format**: Show primary total with dozens/units breakdown
  * Use proper French grammar and pluralization for dozens and units
  * Maintain clear visual hierarchy between total and breakdown
- **Delivery Date Management**:
  * Display delivery date input prominently in each store header
  * Default delivery dates to day after production date for realistic logistics
  * Use responsive layout that works on mobile devices
  * Show formatted delivery dates for read-only users
  * Display delivery dates in Plans page for each store
  * Ensure delivery date changes are immediately reflected in the plan
  * Use consistent date formatting throughout the application
- Provide visual cues for status: confirmed/unconfirmed, delivered/undelivered, waste reported
- Allow easy navigation between days and historical data
- Use modals or confirmations for critical actions
- Ensure all actions are clearly labeled and require minimal clicks
- Display error and success messages for all user actions

---

## Example User Flow
1. **Initial Overview:** User reviews production summary dashboard
   - Checks total doughnut count
   - Reviews variety distribution (includes both individual and box varieties)
   - Examines store-by-store breakdown
   - Reviews form-based totals with reserves (includes both individual and box forms)

2. **Morning:** Production manager reviews and saves the daily plan
   - Sets individual doughnut quantities
   - **Plans delivery dates for each store**:
     * Reviews default delivery dates (set to day after production date)
     * Adjusts delivery dates based on store requirements and logistics
     * Considers store operating hours and delivery schedules
   - Plans box quantities:
     * Selects number of boxes needed
     * Reviews automatically calculated total doughnuts per box type
     * System shows both box count and total doughnuts
   - Reviews total doughnut count (individual + boxes)
   - **Verifies summary totals include both individual and box varieties**
   - Saves the production plan with delivery dates
   - Optionally navigates to Plans page to view all saved plans

3. **Plan Management:** Users can access and edit saved plans
   - Navigate to Plans page (/plans) to view all production plans
   - View detailed breakdown of any saved plan
   - **Edit existing plans**: Click "Modifier" to return to Production page
     * Production page loads with the selected date and existing plan data
     * Visual indicator shows "Plan existant en cours de modification"
     * Make changes to quantities, varieties, or boxes as needed
     * Save button shows "Mettre à jour" instead of "Enregistrer"
     * Updated plan maintains the same ID and updates existing data
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
- **Ensure summary calculations include both individual and box varieties/forms**
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

### Troubleshooting Formes de Doughnuts Display
If the Formes de Doughnuts column is not showing the expected forms:

1. **Check Console Logs**: Look for debug logs showing box varieties and forms
2. **Verify Box Configuration**: Ensure boxes have varieties configured in the admin panel
3. **Check Variety-Form Associations**: Verify that varieties have valid formId references
4. **Validate Form Data**: Ensure forms are properly loaded and active
5. **Data Flow Verification**: 
   - Box has varieties → Each variety has formId → Form exists in forms array
   - Check: `box.varieties` → `variety.formId` → `forms.find(f => f.id === formId)`

### Troubleshooting Delivery Date Display Issues
If delivery dates are not showing correctly in the Plans page "Voir détails" modal:

1. **Check Browser Console**: Look for debug logs when clicking "Voir détails":
   - `"Viewing plan with stores:"` - shows the complete plan data
   - `"Store [name]: Delivery date: [date or NOT SET]"` - shows delivery date status per store
   - `"No delivery date found for store [name], calculating fallback"` - indicates fallback calculation
   - `"Found saved delivery date for store [name]: [date]"` - confirms saved delivery date

2. **Verify Data Structure**: Ensure the plan data includes delivery dates:
   - Check that `store.deliveryDate` field exists in the database
   - Verify the field name is `deliveryDate` (camelCase) not `delivery_date` (snake_case)

3. **Fallback Behavior**: The system automatically shows delivery dates even when not explicitly saved:
   - **Saved delivery date**: Shows the exact date set during plan creation
   - **Calculated fallback**: Shows production date + 1 day with "(calculée automatiquement)" indicator
   - This ensures every store always has a visible delivery date

4. **Database Verification**: Check the production plan data in the database:
   - `production_plans` table should have the plan
   - `store_productions` table should have `deliveryDate` field populated
   - If missing, the plan was likely created before delivery date functionality was added

5. **Re-save Plans**: For older plans without delivery dates:
   - Use the "Modifier" button to edit the plan
   - The system will populate default delivery dates
   - Save the plan to update the database with delivery dates

### Troubleshooting: Delivery Date Not Updating in Plans Page

If you edit a delivery date in the ProductionPage but it doesn't show the updated date in the Plans page "Voir détails":

1. **Check Browser Console Logs**:
   - Open browser developer tools (F12)
   - Go to Console tab
   - Edit delivery date in ProductionPage and save
   - Look for logs: "Saving plan data:" and "Store delivery dates being saved:"
   - Navigate to Plans page and click "Voir détails"
   - Look for logs: "Fetched plans data:" and "Store [name]: deliveryDate = [date]"

2. **Verify Save Operation**:
   - Ensure you clicked "Enregistrer" or "Mettre à jour" after changing the delivery date
   - Check for success message: "Plan de production mis à jour avec succès!"
   - Verify the plan was actually saved (no error messages)

3. **Force Refresh Plans Page**:
   - Click the "Actualiser" button in the Plans page
   - Or refresh the browser page (F5)
   - Or close and reopen the Plans page

4. **Check Data Consistency**:
   - In console logs, verify the delivery date is being saved correctly
   - Compare the saved date with what's displayed in the modal
   - Look for any field name mismatches (deliveryDate vs delivery_date)

5. **Database Migration Required**:
   - **FIXED**: Added `deliveryDate` column to `store_productions` table
   - **FIXED**: Updated edge functions to save and retrieve delivery dates
   - **FIXED**: Updated TypeScript interfaces to include delivery date field
   - **DEPLOYMENT**: Ensure the updated edge functions are deployed to Supabase
   - **MIGRATION**: Run the database migration to add the `deliveryDate` column
   - If still having issues, ensure the database migration has been applied

6. **Clear Browser Cache**:
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   - Or clear browser cache completely
   - Or try in incognito/private browsing mode

### Delivery Date Smart Default Behavior
The delivery date system requires manual input for all stores with production:

1. **Manual Input Required**: Users must explicitly set delivery dates for each store that has production planned
2. **No Automatic Defaults**: The system does not calculate or set any default delivery dates
3. **Validation**: The save button is disabled until all stores with production have delivery dates set
4. **Visual Feedback**: 
   - Stores missing delivery dates show red borders and validation messages
   - Required field indicator (*) appears next to the delivery date label
   - Yellow warning banner lists stores that need delivery dates
5. **Data Integrity**: Only manually set delivery dates are saved to the database

**Validation Rules**:
- **Stores with production > 0**: Must have delivery date set
- **Stores with no production**: Delivery date not required
- **Save disabled**: Until all required delivery dates are set
- **Error messages**: Show which stores need delivery dates

**Example Scenarios**:
- **New Plan**: User must set delivery date for each store before saving
- **Editing Plan**: Existing delivery dates are preserved, new stores require manual input
- **No Production**: If store has no varieties or boxes planned, delivery date not required
- **Plans Page**: Shows manually set delivery dates or "Non définie" for missing dates

### Common Issues
- **"Aucune forme définie"**: Varieties in the box don't have formId or forms don't exist
- **Missing forms**: Forms might be inactive or not properly loaded
- **Inconsistent display**: Check that variety-form relationships are correctly configured

### Production Summary Calculation Issues
If the Production Summary doesn't show correct totals:

1. **Verify Box Varieties**: Check that boxes have varieties configured with quantities
2. **Check Calculation Logic**: Ensure `calculateSummary` includes both individual and box varieties
3. **Debug Totals**: Use console logs to verify variety and form totals include box contributions
4. **Formula Verification**: Individual + (Box quantity × Variety quantity per box) = Total variety

---

## References
- [production-user-guide.md](./production-user-guide.md)
- [technical-architecture.md](./technical-architecture.md)
- [user-flow.md](./user-flow.md)
- [design-guidelines.md](./design-guidelines.md)
- [PRD.md](./PRD.md)

---

*This documentation should be updated as new features are added or requirements change.*