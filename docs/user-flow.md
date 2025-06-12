# User Flow Documentation
## Azee - Donut Shop Management System

### 1. Overview

This document outlines the complete user flows for the Azee donut shop management system, covering all user roles and their respective workflows.

**User Roles**:
- **Admin**: System administrators with full access
- **Production**: Production managers and staff
- **Store**: Individual store managers and staff

### 2. Authentication Flow

#### 2.1 Login Process
```
┌─────────────────┐
│  Landing/Root   │
│      Page       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐     ┌─────────────────┐
│  Check Session  │────▶│  Login Page     │
│  (AuthGuard)    │     │  /login         │
└─────────┬───────┘     └─────────┬───────┘
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  User Dashboard │     │  Authentication │
│  (Role-based)   │◀────│  Process        │
└─────────────────┘     └─────────────────┘
```

**Detailed Steps**:
1. User navigates to application
2. AuthGuard checks for valid session
3. If no session → Redirect to `/login`
4. User enters email/password
5. Supabase authentication validates credentials
6. On success → User role determined from JWT metadata
7. Redirect to appropriate dashboard based on role

#### 2.2 Role-Based Routing
```
Authentication Success
         │
    ┌────▼────┐
    │  Role   │
    │ Check   │
    └────┬────┘
         │
    ┌────▼────┬────────┬────────┐
    │  Admin  │ Prod.  │ Store  │
    │    │    │   │    │   │    │
    ▼    ▼    ▼   ▼    ▼   ▼    ▼
   All  User  Pro- Stats Store Store
  Pages Mgmt duction     Dash. Only
```

### 3. Admin User Flows

#### 3.1 Admin Dashboard Overview
```
┌─────────────────────────────────────────┐
│              Admin Dashboard             │
├─────────────┬───────────────────────────┤
│ Navigation  │                           │
│ - Users     │     Main Content Area     │
│ - Stores    │                           │
│ - Products  │   - System Overview       │
│ - Reports   │   - Quick Actions         │
│ - Settings  │   - Recent Activity       │
│             │                           │
└─────────────┴───────────────────────────┘
```

#### 3.2 User Management Flow
```
Admin Dashboard
       │
       ▼
┌─────────────────┐
│   Users Page    │
│    /users       │
└─────┬───────────┘
      │
   ┌──▼──┬────────┬─────────┐
   │View │ Create │  Edit   │
   │Users│  User  │  User   │
   └─────┴────┬───┴─────┬───┘
              │         │
              ▼         ▼
      ┌─────────────┐ ┌─────────────┐
      │Create User  │ │Edit User    │
      │   Modal     │ │   Modal     │
      └─────────────┘ └─────────────┘
```

**User Management Steps**:
1. Navigate to Users page (`/users`)
2. View list of all users with roles and status
3. **Create New User**:
   - Click "Add User" button
   - Fill form: Name, Email, Role, Store Assignment
   - Submit → API call to `create-user` function
   - Success → User added to list
4. **Edit User**:
   - Click edit icon on user row
   - Modify user details in modal
   - Submit → API call to `update-user` function
5. **Delete User**:
   - Click delete icon
   - Confirm deletion
   - API call to `delete-user` function

#### 3.3 Store Management Flow
```
Admin Dashboard
       │
       ▼
┌─────────────────┐
│   Admin Page    │
│    /admin       │
└─────┬───────────┘
      │
   ┌──▼──────────────────────────┐
   │   Store Management Tab      │
   └──┬──────────────────────────┘
      │
   ┌──▼──┬────────┬─────────┬──────────┐
   │View │ Create │  Edit   │ Configure│
   │Stores│ Store │  Store  │ Products │
   └─────┴────────┴─────────┴──────────┘
```

**Store Management Steps**:
1. Navigate to Admin page (`/admin`)
2. Select "Store Management" tab
3. **Create Store**:
   - Click "Add Store"
   - Enter: Name, Location, Status
   - Configure available varieties and box types
   - Submit → API call to store service
4. **Configure Store Products**:
   - Select store from list
   - Choose available donut varieties
   - Select box configurations
   - Save configuration

### 4. Production User Flows

#### 4.1 Production Dashboard
```
┌─────────────────────────────────────────┐
│           Production Dashboard           │
├─────────────┬───────────────────────────┤
│ Navigation  │                           │
│ - Dashboard │     Main Content Area     │
│ - Production│                           │
│ - Statistics│   - Today's Production    │
│             │   - Pending Plans         │
│             │   - Quick Stats           │
│             │                           │
└─────────────┴───────────────────────────┘
```

#### 4.2 Production Planning Flow
```
Production Dashboard
         │
         ▼
┌─────────────────┐
│ Production Page │
│  /production    │
└─────┬───────────┘
      │
   ┌──▼──┬──────────┬───────────┐
   │View │  Create  │   Edit    │
   │Plans│   Plan   │   Plan    │
   └─────┴────┬─────┴─────┬─────┘
              │           │
              ▼           ▼
    ┌─────────────┐ ┌─────────────┐
    │ Plan Form   │ │ Edit Plan   │
    │   Modal     │ │   Modal     │
    └─────────────┘ └─────────────┘
```

**Production Planning Steps**:
1. Navigate to Production page (`/production`)
2. View existing production plans by date
3. **Create New Plan**:
   - Click "New Production Plan"
   - Select date for production
   - For each store:
     - Select donut varieties needed
     - Specify quantities per variety
     - Choose box configurations if needed
   - Review total production summary
   - Save plan → API call to `save-production-plan`
4. **Modify Existing Plan**:
   - Click on existing plan
   - Adjust quantities or add/remove items
   - Update plan

#### 4.3 Product Management Flow
```
Admin Page
    │
    ▼
┌─────────────────┐
│Product Mgmt Tab │
└─────┬───────────┘
      │
   ┌──▼──┬────────┬─────────┐
   │Donut│ Donut  │   Box   │
   │Varieties│ Forms │ Configs │
   └─────┴────────┴─────────┘
```

**Product Management Steps**:
1. Navigate to Admin page (`/admin`)
2. Select "Product Management" tab
3. **Donut Varieties**:
   - Add new varieties with names, descriptions
   - Associate with donut forms
   - Set production costs
   - Enable/disable varieties
4. **Donut Forms**:
   - Create forms (ring, filled, twist, etc.)
   - Set descriptions and status
5. **Box Configurations**:
   - Define box sizes (6-pack, 12-pack, etc.)
   - Set availability per store

### 5. Store User Flows

#### 5.1 Store Dashboard
```
┌─────────────────────────────────────────┐
│             Store Dashboard              │
├─────────────┬───────────────────────────┤
│ Navigation  │                           │
│ - Dashboard │     Main Content Area     │
│ - Deliveries│                           │
│ - Statistics│   - Today's Deliveries    │
│             │   - Pending Confirmations │
│             │   - Store Performance     │
│             │                           │
└─────────────┴───────────────────────────┘
```

#### 5.2 Delivery Confirmation Flow
```
Store Dashboard
       │
       ▼
┌─────────────────┐
│ Deliveries Page │
│  /livraisons    │
└─────┬───────────┘
      │
   ┌──▼──┬────────────┬──────────┐
   │View │  Confirm   │  Report  │
   │Plans│ Delivery   │  Waste   │
   └─────┴────────────┴──────────┘
```

**Delivery Management Steps**:
1. Navigate to Deliveries page (`/livraisons`)
2. View production plans assigned to store
3. **Confirm Delivery**:
   - Select production plan/date
   - Review items delivered
   - For each item:
     - Confirm quantity received
     - Report any discrepancies
   - Submit confirmation
4. **Report Waste**:
   - Select confirmed delivery
   - For each item, report:
     - Damaged quantity
     - Unsold quantity
     - Reason for waste
   - Submit waste report

### 6. Cross-Role Flows

#### 6.1 Statistics and Reporting
```
Any User Role
      │
      ▼
┌─────────────────┐
│ Statistics Page │
│ /statistiques   │
└─────┬───────────┘
      │
   ┌──▼──┬──────────┬────────────┐
   │Prod.│ Waste    │   Cost     │
   │Stats│ Analysis │  Analysis  │
   └─────┴──────────┴────────────┘
```

**Statistics Viewing**:
1. Navigate to Statistics page (`/statistiques`)
2. **Role-based Data**:
   - **Admin**: System-wide statistics
   - **Production**: Production metrics and costs
   - **Store**: Store-specific performance
3. **Available Reports**:
   - Production volume by date/store/variety
   - Waste percentages and trends
   - Cost analysis and profitability
   - Performance comparisons
4. **Export Options**:
   - PDF reports
   - Data export for external analysis

#### 6.2 Navigation Flow
```
┌─────────────────────────────────────────┐
│              Main Navigation             │
├─────────┬─────────┬─────────┬───────────┤
│Dashboard│Production│Deliveries│Statistics │
└─────────┴─────────┴─────────┴───────────┘
     │         │         │         │
     ▼         ▼         ▼         ▼
   Home    Production Delivery   Stats
   Page      Plans   Tracking   Reports
```

### 7. Error Handling Flows

#### 7.1 Authentication Errors
```
Login Attempt
      │
   ┌──▼──┐
   │Auth │
   │Check│
   └──┬──┘
      │
   ┌──▼──┬─────────┐
   │Valid│ Invalid │
   └─────┴─────┬───┘
               │
               ▼
         ┌─────────────┐
         │ Error State │
         │ - Show msg  │
         │ - Clear form│
         │ - Retry opt │
         └─────────────┘
```

#### 7.2 API Error Handling
```
API Call
    │
    ▼
┌─────────┐    ┌─────────────┐
│Success  │    │   Error     │
│Response │    │  Response   │
└─────────┘    └──────┬──────┘
                      │
               ┌──────▼──────┐
               │Error Handler│
               │- Show toast │
               │- Log error  │
               │- Retry opt  │
               └─────────────┘
```

### 8. Data Flow Patterns

#### 8.1 Real-time Updates
```
Database Change
       │
       ▼
┌─────────────┐
│ Supabase    │
│ Real-time   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ React State │
│   Update    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   UI        │
│  Re-render  │
└─────────────┘
```

#### 8.2 Form Submission Pattern
```
Form Input
    │
    ▼
┌─────────────┐
│ Validation  │
│ (Client)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ API Call    │
│ (Service)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Server      │
│ Validation  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Database    │
│ Update      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Response    │
│ & UI Update │
└─────────────┘
```

### 9. Mobile Considerations

#### 9.1 Responsive Navigation
```
Desktop View               Mobile View
┌─────────────────┐       ┌─────────────┐
│     Navbar      │  -->  │ ☰  Brand   │
│ [Nav] [Nav] ... │       └─────────────┘
└─────────────────┘       ┌─────────────┐
                          │ Slide Menu  │
                          │ - Dashboard │
                          │ - Production│
                          │ - Deliveries│
                          │ - Statistics│
                          └─────────────┘
```

#### 9.2 Touch-Optimized Interactions
- Minimum 44px touch targets
- Swipe gestures for navigation
- Pull-to-refresh for data updates
- Optimized form inputs for mobile keyboards

### 10. Accessibility Considerations

#### 10.1 Keyboard Navigation
```
Tab Order Flow:
1. Main Navigation
2. Page Content (top to bottom)
3. Action Buttons
4. Footer Links

Keyboard Shortcuts:
- Tab: Next element
- Shift+Tab: Previous element
- Enter: Activate button/link
- Space: Checkbox/toggle
- Esc: Close modal/dropdown
```

#### 10.2 Screen Reader Support
- Semantic HTML structure
- ARIA labels for interactive elements
- Descriptive headings hierarchy
- Alternative text for visual elements
- Status announcements for dynamic updates

### 11. Performance Considerations

#### 11.1 Loading States
```
Page Load
    │
    ▼
┌─────────────┐
│ Loading     │
│ Skeleton    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Data Fetch  │
│ Complete    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Render      │
│ Content     │
└─────────────┘
```

#### 11.2 Optimization Strategies
- Lazy loading of non-critical components
- Debounced search inputs
- Pagination for large data sets
- Cached API responses
- Optimistic UI updates

### 12. Future Flow Enhancements

#### 12.1 Planned Features
- **Notifications**: Real-time alerts for production updates
- **Mobile App**: Native mobile application workflows
- **Automation**: Automated production planning based on historical data
- **Integration**: Third-party system integrations

#### 12.2 Advanced Workflows
- **Batch Operations**: Multi-store operations
- **Approval Workflows**: Multi-step approval processes
- **Audit Trails**: Complete action history tracking
- **Advanced Analytics**: Predictive analytics and reporting 