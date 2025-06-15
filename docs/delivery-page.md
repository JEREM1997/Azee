# Delivery Page Documentation

## Overview
The Delivery Page (Gestion des Livraisons) is the final stage of the production-to-delivery workflow, providing comprehensive delivery management capabilities for tracking, confirming, and managing deliveries while reporting waste across all stores.

---

## Purpose
- **Track daily deliveries** to all stores in real-time
- **Confirm receipt** of production items with quantity verification
- **Report waste** and manage discrepancies
- **Generate professional delivery bulletins** (PDF reports)
- **Manage delivery status** across the entire store network
- **Provide role-based access** to delivery information

---

## User Roles & Permissions

### **Store Managers (Magasins)**
- **Access Scope**: View deliveries for their assigned stores only
- **Capabilities**:
  - Confirm receipt of their store's delivery
  - Update received quantities for their store
  - Report waste for their store after delivery confirmation
  - View delivery details and status
- **Restrictions**: Cannot access other stores' delivery data

### **Production Staff**
- **Access Scope**: View all store deliveries
- **Capabilities**:
  - Confirm deliveries for any store
  - Update received quantities for any store
  - Report waste for any store
  - Generate and download delivery bulletins (PDF)
  - Full delivery management access

### **Admins**
- **Access Scope**: Complete system access
- **Capabilities**: All production staff capabilities plus system administration

---

## Main Features

### 1. **Daily Delivery Dashboard**
- **Store Overview**: List of all stores with scheduled deliveries for the selected delivery date
- **Delivery Date Selector**: Choose specific delivery date to view scheduled deliveries
- **Status Indicators**:
  - ✅ **"Confirmé"** (green badge) - Delivery confirmed and received
  - 🚛 **"En attente"** (red badge) - Delivery pending confirmation
- **Quick Statistics**: Total doughnuts planned per store with delivery date display
- **Role-Based Filtering**: Automatic filtering based on user permissions
- **Real-Time Updates**: Status changes reflect immediately
- **Date-Based Filtering**: Shows only stores with deliveries scheduled for the selected date

### 2. **Delivery Details Management**
- **Comprehensive Item Tracking**:
  - Variety name and doughnut form
  - Planned quantity vs. actual received quantity
  - Waste reporting with quantity limits
  - Editable fields for authorized users
- **Box Productions Management**:
  - Box types with planned, received, and waste quantities
  - Editable received and waste fields for authorized users
  - Same functionality as individual doughnut items
  - Quantity validation and limits
- **Store Information**: Store name, total delivery summary, and scheduled delivery date
- **Delivery Date Display**: Shows the specific delivery date for each store

### 3. **Delivery Confirmation Workflow**
```
Step 1: Store receives delivery
Step 2: Authorized user reviews planned vs. received quantities
Step 3: User confirms delivery with actual received amounts
Step 4: System records delivery confirmation
Step 5: Later - Report any waste or spoilage (separate step)
Step 6: Complete delivery cycle
```

### 4. **Professional PDF Bulletin Generation**
- **Automated Report Creation**: Uses jsPDF library for professional documents
- **Comprehensive Content**:
  - Production date and store information
  - Detailed items table (variety, planned, received, waste)
  - Boxes table (if applicable)
  - Signature line for physical confirmation
- **Smart File Naming**: `bulletin-livraison-{store-name}-{date}.pdf`
- **Print-Ready Format**: Professional layout suitable for physical records

### 5. **Waste Management System**
- **Post-Delivery Reporting**: Waste can only be reported after delivery confirmation
- **Quantity Validation**: Waste cannot exceed received quantities
- **Separate Workflow**: Independent from delivery confirmation process
- **Complete Tracking**: Full audit trail of waste reporting

---

## Data Flow & Integration

### **Data Sources**
- **Production Plans**: Integrates with production plans filtered by delivery dates
- **Store Data**: Accesses store information and assignments
- **User Authentication**: Role-based access control
- **Delivery Status**: Real-time delivery confirmation data
- **Delivery Dates**: Filters production plans based on store-specific delivery dates

### **API Integration**
- `getCurrentDayPlan(deliveryDate)`: Loads production plans and filters by delivery date
- `updateDeliveryStatus()`: Updates delivery confirmation and waste reporting
- Real-time data synchronization with production planning system
- Delivery date-based filtering for accurate delivery scheduling

### **State Management**
```typescript
- currentPlan: DeliveryProductionPlan | null    // Production plan filtered by delivery date
- selectedStore: string | null                  // Currently selected store
- deliveryDate: string                          // Selected delivery date for filtering
- receivedQuantities: { [key: string]: number } // Actual received amounts
- wasteQuantities: { [key: string]: number }    // Reported waste amounts
- loading, error, saving states                 // UI state management
```

---

## User Interface Design

### **Layout Architecture**
- **Responsive Grid Layout**: 3-column design (1/3 store list + 2/3 details)
- **Mobile-First Design**: Adapts seamlessly to different screen sizes
- **Consistent Color Scheme**: Krispy-green for confirmed, red for pending
- **Intuitive Navigation**: Click-to-select store interface

### **Interactive Components**
- **Store Selection Panel**: 
  - Clickable store cards with status indicators
  - Hover effects and active state highlighting
  - Quick summary information display
- **Quantity Management**:
  - Number input fields for received quantities
  - Validation and limit enforcement
  - Real-time calculation updates
- **Action Buttons**:
  - Confirm delivery (primary action)
  - Report waste (secondary action)
  - Download bulletin (utility action)

### **Visual Feedback System**
- **Loading States**: Spinner animations during data operations
- **Error Handling**: Red alert banners with clear error messages
- **Success Confirmation**: Green success messages and status updates
- **Disabled States**: Visual indication when actions are unavailable

---

## Business Logic & Rules

### **Delivery Confirmation Rules**
1. **Access Control**: Users can only confirm deliveries for stores they have access to
2. **Default Values**: Received quantities default to planned quantities for convenience
3. **Edit Restrictions**: Cannot modify received quantities after delivery confirmation
4. **Validation**: All quantities must be non-negative numbers

### **Waste Reporting Rules**
1. **Prerequisite**: Can only report waste AFTER delivery is confirmed
2. **Quantity Limits**: Waste quantities cannot exceed received quantities
3. **Separate Process**: Waste reporting is independent from delivery confirmation
4. **Audit Trail**: All waste reports are tracked with timestamps

### **Access Control Logic**
```typescript
// Store filtering based on user role
const userStores = currentPlan?.store_productions?.filter(store => {
  if (isAdmin || isProduction) return true;
  return currentUser?.storeIds?.includes(store.store_id);
}) || [];
```

### **Status Management**
- **Pending**: Initial state when delivery is scheduled
- **Confirmed**: After delivery confirmation is completed
- **Waste Reported**: After waste quantities are submitted
- **Complete**: Full delivery cycle finished

---

## Technical Implementation

### **PDF Generation System**
- **Libraries**: Uses `jsPDF` and `jspdf-autotable` for professional document creation
- **Content Structure**:
  - Header with production date and store information
  - Detailed items table with planned/received/waste columns
  - Boxes section (when applicable)
  - Signature area for physical confirmation
- **Formatting**: Professional layout with proper spacing and typography
- **Localization**: French date formatting and terminology

### **Error Handling Strategy**
- **Comprehensive Coverage**: Try-catch blocks around all async operations
- **User-Friendly Messages**: Clear, actionable error messages in French
- **Graceful Degradation**: System continues to function with partial data
- **Retry Mechanisms**: Automatic retry for transient failures

### **Performance Optimization**
- **Efficient Data Loading**: Single API call to load all necessary data
- **Optimized Re-renders**: Proper state management to minimize unnecessary updates
- **Conditional Rendering**: Components only render when data is available
- **Lazy Loading**: PDF generation only occurs when requested

---

## Workflow Integration

### **Production-to-Delivery Pipeline**
1. **Production Planning** → Daily production plans created
2. **Production Execution** → Items produced according to plan
3. **Delivery Scheduling** → Delivery dates and routes planned
4. **Delivery Management** → **THIS PAGE** - Track and confirm deliveries
5. **Waste Reporting** → Report spoilage and discrepancies
6. **Analytics & Reporting** → Data feeds into business intelligence

### **Daily Operational Flow**
- **Morning (8:00-10:00)**: Production staff review pending deliveries for today and upcoming dates
- **Midday (10:00-16:00)**: Stores confirm receipt as deliveries arrive on their scheduled dates
- **Afternoon (16:00-18:00)**: Stores report any waste or spoilage for completed deliveries
- **Evening (18:00-20:00)**: Complete delivery cycle with final confirmations
- **Multi-Day Planning**: Users can view and manage deliveries for different dates using the date selector

---

## Example User Scenarios

### **Scenario 1: Store Manager Confirming Delivery**
1. Store manager logs into the system
2. Sees their store in the delivery list with "En attente" status
3. Clicks on their store to view delivery details
4. Reviews planned quantities vs. actual received quantities
5. Adjusts received quantities if there are discrepancies
6. Clicks "Confirmer la Réception" to confirm delivery
7. Status updates to "Confirmé" with green indicator

### **Scenario 2: Production Manager Generating Bulletin**
1. Production manager accesses the delivery page
2. Selects a store from the complete list
3. Reviews delivery details and confirmation status
4. Clicks "Télécharger le Bulletin" to generate PDF
5. PDF downloads with complete delivery information
6. Uses PDF for physical records and audit trail

### **Scenario 3: Store Manager Reporting Waste**
1. Store manager confirms delivery (as in Scenario 1)
2. Later discovers some items are damaged/spoiled
3. Returns to delivery page and selects their store
4. Enters waste quantities in the waste column
5. Clicks "Signaler les Déchets" to submit waste report
6. System records waste data for inventory tracking

---

## Data Validation & Security

### **Input Validation**
- **Quantity Limits**: All quantities must be non-negative
- **Waste Validation**: Waste cannot exceed received quantities
- **Required Fields**: Essential data must be provided before confirmation
- **Data Type Checking**: Ensures numeric inputs are valid numbers

### **Security Measures**
- **Role-Based Access**: Users only see data they're authorized to access
- **Store Filtering**: Automatic filtering based on user store assignments
- **Action Authorization**: Edit capabilities controlled by user permissions
- **Audit Logging**: All delivery confirmations and waste reports are logged

---

## Error Handling & Troubleshooting

### **Common Issues & Solutions**

#### **No Deliveries Showing**
- **Cause**: No production plan for today or user lacks store access
- **Solution**: Verify production plan exists and user has correct store assignments

#### **Cannot Confirm Delivery**
- **Cause**: User lacks permission or delivery already confirmed
- **Solution**: Check user role and delivery status

#### **PDF Generation Fails**
- **Cause**: Missing data or browser compatibility issues
- **Solution**: Ensure all delivery data is loaded and try different browser

#### **Waste Reporting Unavailable**
- **Cause**: Delivery not yet confirmed
- **Solution**: Confirm delivery first, then report waste

### **Debug Information**
- Console logs for API calls and data loading
- Error messages displayed in user interface
- Loading states to indicate system activity
- Validation feedback for user inputs

---

## Performance Considerations

### **Optimization Strategies**
- **Single Data Load**: All delivery data loaded in one API call
- **Efficient State Updates**: Minimal re-renders through proper state management
- **Conditional Rendering**: Components only render when necessary
- **Lazy PDF Generation**: PDFs created only when requested

### **Scalability Factors**
- **Store Count**: System handles multiple stores efficiently
- **Concurrent Users**: Multiple users can access simultaneously
- **Data Volume**: Optimized for daily delivery volumes
- **Real-Time Updates**: Efficient state synchronization

---

## Future Enhancement Opportunities

### **Potential Improvements**
1. **Real-Time Notifications**: Push notifications for delivery confirmations
2. **Delivery Time Tracking**: Record actual delivery timestamps
3. **Photo Documentation**: Upload photos for delivery verification
4. **Barcode Integration**: Scan items for automated confirmation
5. **Route Optimization**: Integration with delivery route planning
6. **Historical Analytics**: Trends and patterns in delivery performance
7. **Mobile App**: Dedicated mobile application for delivery drivers
8. **GPS Tracking**: Real-time location tracking for deliveries

### **Integration Possibilities**
- **Inventory Management**: Direct integration with stock systems
- **Customer Notifications**: Automated customer delivery updates
- **Financial Systems**: Integration with accounting and billing
- **Quality Control**: Link with quality assurance processes

---

## Best Practices

### **For Users**
- **Timely Confirmation**: Confirm deliveries promptly upon receipt
- **Accurate Quantities**: Verify received quantities carefully
- **Waste Reporting**: Report waste as soon as discovered
- **Documentation**: Download bulletins for record keeping

### **For Administrators**
- **User Training**: Ensure all users understand the delivery process
- **Regular Monitoring**: Check delivery confirmation rates
- **Data Backup**: Maintain backups of delivery records
- **System Updates**: Keep system updated with latest features

### **For Developers**
- **Error Handling**: Implement comprehensive error handling
- **User Feedback**: Provide clear feedback for all user actions
- **Performance**: Optimize for fast loading and responsive interface
- **Security**: Maintain strict access controls and data validation

---

## References
- [Production Page Documentation](./production-page.md)
- [User Flow Documentation](./user-flow.md)
- [Technical Architecture](./technical-architecture.md)
- [Design Guidelines](./design-guidelines.md)

---

*This documentation should be updated as new features are added or requirements change.* 