# Technical Architecture
## Azee - Donut Shop Management System

### 1. Architecture Overview

The Azee donut management system follows a modern, serverless architecture pattern with a React frontend and Supabase backend. The system is designed for scalability, maintainability, and real-time data synchronization.

#### 1.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  React App (Vite)                                          │
│  ├── React Router (Navigation)                             │
│  ├── Context API (State Management)                        │
│  ├── Tailwind CSS (Styling)                               │
│  └── TypeScript (Type Safety)                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS/WebSocket
┌─────────────────▼───────────────────────────────────────────┐
│                 SUPABASE LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  ├── Authentication Service (Auth)                         │
│  ├── PostgreSQL Database (Data)                           │
│  ├── Edge Functions (API)                                 │
│  ├── Real-time Engine (Live Updates)                      │
│  └── Storage (File Management)                            │
└─────────────────────────────────────────────────────────────┘
```

#### 1.2 Technology Stack
**Frontend**:
- React 18.2.0
- TypeScript 5.0.0
- Vite 5.0.0 (Build Tool)
- React Router DOM 6.20.0
- Tailwind CSS 3.3.5
- Lucide React (Icons)

**Backend**:
- Supabase (BaaS Platform)
- PostgreSQL (Database)
- Deno (Edge Functions Runtime)
- Supabase Auth (Authentication)

**Development Tools**:
- ESLint (Code Linting)
- PostCSS (CSS Processing)
- Autoprefixer (CSS Vendor Prefixes)

### 2. Frontend Architecture

#### 2.1 Application Structure
```
src/
├── components/           # Reusable UI components
│   ├── AuthGuard.tsx    # Route protection
│   └── Navbar.tsx       # Navigation component
├── context/             # React Context providers
│   ├── AuthContext.tsx  # Authentication state
│   └── AdminContext.tsx # Admin-specific state
├── pages/               # Route components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── ProductionPage.tsx
│   ├── DeliveryPage.tsx
│   ├── StatsPage.tsx
│   ├── AdminPage.tsx
│   ├── UsersPage.tsx
│   └── UserRoleManagementPage.tsx
├── services/            # API service layers
│   ├── authService.ts
│   ├── userService.ts
│   ├── storeManagementService.ts
│   └── productionService.ts
├── types/               # TypeScript definitions
│   └── index.ts
├── lib/                 # External library configurations
│   └── supabase.ts
├── data/                # Static data and constants
├── assets/              # Static assets
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

#### 2.2 State Management Architecture
```
┌─────────────────────────────────────────┐
│              Context Providers           │
├─────────────────────────────────────────┤
│  AuthProvider                           │
│  ├── User state                        │
│  ├── Authentication status             │
│  ├── Role-based permissions            │
│  └── Session management                │
├─────────────────────────────────────────┤
│  AdminProvider                          │
│  ├── Admin-specific data               │
│  ├── Store management state            │
│  └── User management state             │
└─────────────────────────────────────────┘
```

#### 2.3 Component Architecture
```
Component Hierarchy:

App
├── Router
│   ├── AuthProvider
│   │   ├── AdminProvider
│   │   │   ├── Routes
│   │   │   │   ├── AuthGuard
│   │   │   │   │   ├── Navbar
│   │   │   │   │   └── Page Components
│   │   │   │   └── LoginPage
```

**Component Design Patterns**:
- **Container/Presentational**: Separate data logic from UI
- **Custom Hooks**: Reusable stateful logic
- **Higher-Order Components**: Cross-cutting concerns
- **Render Props**: Flexible component composition

#### 2.4 Routing Architecture
```typescript
// Route Configuration
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<AuthGuard />}>
    <Route path="/" element={<><Navbar /><DashboardPage /></>} />
    <Route path="/production" element={<><Navbar /><ProductionPage /></>} />
    <Route path="/livraisons" element={<><Navbar /><DeliveryPage /></>} />
    <Route path="/statistiques" element={<><Navbar /><StatsPage /></>} />
    <Route path="/admin" element={<><Navbar /><AdminPage /></>} />
    <Route path="/users" element={<><Navbar /><UsersPage /></>} />
    <Route path="/user-roles" element={<><Navbar /><UserRoleManagementPage /></>} />
  </Route>
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

### 3. Backend Architecture

#### 3.1 Supabase Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                         │
├─────────────────────────────────────────────────────────────┤
│  Authentication Layer                                       │
│  ├── JWT Token Management                                  │
│  ├── User Registration/Login                               │
│  ├── Role-based Access Control                            │
│  └── Session Management                                    │
├─────────────────────────────────────────────────────────────┤
│  Database Layer (PostgreSQL)                               │
│  ├── Tables (stores, users, production_plans, etc.)       │
│  ├── Relationships & Constraints                          │
│  ├── Indexes for Performance                              │
│  └── Row Level Security (RLS) - Disabled                  │
├─────────────────────────────────────────────────────────────┤
│  Edge Functions (Deno Runtime)                             │
│  ├── CRUD Operations                                       │
│  ├── Business Logic                                        │
│  ├── Data Validation                                       │
│  └── Error Handling                                        │
├─────────────────────────────────────────────────────────────┤
│  Real-time Engine                                           │
│  ├── WebSocket Connections                                 │
│  ├── Live Data Synchronization                            │
│  └── Event Broadcasting                                    │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Database Schema
```sql
-- Core Tables
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     stores      │    │ donut_varieties │    │  donut_forms    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ name            │    │ name            │    │ name            │
│ location        │    │ description     │    │ description     │
│ is_active       │    │ form_id (FK)    │    │ is_active       │
│ available_varieties │ │ production_cost │    │ created_at      │
│ available_boxes │    │ is_active       │    │ updated_at      │
│ created_at      │    │ created_at      │    └─────────────────┘
│ updated_at      │    │ updated_at      │
└─────────────────┘    └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│box_configurations│   │production_plans │    │ store_productions│
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ name            │    │ date            │    │ plan_id (FK)    │
│ size            │    │ created_by      │    │ store_id (FK)   │
│ is_active       │    │ total_production│    │ confirmed       │
│ created_at      │    │ status          │    │ delivery_confirmed│
│ updated_at      │    │ created_at      │    │ created_at      │
└─────────────────┘    │ updated_at      │    │ updated_at      │
                       └─────────────────┘    │ updated_at      │
                                              └─────────────────┘

┌─────────────────┐    ┌─────────────────┐
│production_items │    │   user_roles    │
├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │
│ store_prod_id(FK)│   │ user_id (FK)    │
│ variety_id (FK) │    │ role            │
│ form_id (FK)    │    │ store_ids       │
│ quantity        │    │ updated_at      │
│ received        │    │ created_at      │
│ waste           │    └─────────────────┘
│ created_at      │
│ updated_at      │
└─────────────────┘
```

#### 3.3 Edge Functions Architecture
```
Edge Functions Structure:

supabase/functions/
├── get-admin-data/          # Fetch all admin data
├── get-production-plans/    # Fetch production plans
├── get-current-plan/        # Get current production plan
├── save-production-plan/    # Save/update production plan
├── validate-production-plan/# Validate plan data
├── update-delivery-status/  # Update delivery confirmations
├── create-store/           # Store CRUD operations
├── update-store/
├── delete-store/
├── create-user/            # User management
├── update-user/
├── delete-user/
├── update-user-stores/
├── update-user-password/
├── create-donut-variety/   # Product management
├── update-donut-variety/
├── delete-donut-variety/
├── create-donut-form/
├── update-donut-form/
├── delete-donut-form/
├── create-box-configuration/
├── update-box-configuration/
├── delete-box-configuration/
├── auth-role/              # Authentication
└── admin-users/            # Admin user operations
```

**Edge Function Pattern**:
```typescript
// Standard Edge Function Structure
import { createClient } from 'npm:@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    )

    if (userError || !user) {
      throw new Error('Invalid token')
    }

    // Business logic
    const result = await performBusinessLogic(supabase, req)

    // Return response
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    // Error handling
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### 4. Authentication Architecture

#### 4.1 Authentication Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Login    │───▶│  Supabase Auth  │───▶│   JWT Token     │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐             │
│ Client Storage  │◀───│  AuthContext    │◀────────────┘
│ (Session)       │    │  (React State)  │
└─────────────────┘    └─────────────────┘
```

#### 4.2 Role-Based Access Control (RBAC)
```typescript
// Role Hierarchy
enum UserRole {
  ADMIN = 'admin',       // Full system access
  PRODUCTION = 'production', // Production planning & management
  STORE = 'store'        // Store-specific operations
}

// Permission Matrix
const permissions = {
  admin: ['*'],  // All permissions
  production: [
    'read:stores',
    'read:products',
    'write:production_plans',
    'read:production_plans',
    'read:statistics'
  ],
  store: [
    'read:own_store',
    'write:delivery_confirmations',
    'write:waste_reports',
    'read:own_statistics'
  ]
}
```

#### 4.3 Session Management
```typescript
// Session Configuration
const supabaseConfig = {
  auth: {
    autoRefreshToken: true,      // Auto-refresh JWT tokens
    persistSession: true,        // Persist session in localStorage
    detectSessionInUrl: false    // Don't detect session from URL
  },
  global: {
    headers: {
      'x-retry-after': '1',
    },
  },
  httpOptions: {
    timeout: 30000,              // 30 seconds timeout
    retryAttempts: 3,            // Retry failed requests
    retryInterval: 1000,         // 1 second between retries
  }
}
```

### 5. Data Layer Architecture

#### 5.1 Service Layer Pattern
```typescript
// Service Layer Structure
export class StoreManagementService {
  private static instance: StoreManagementService;
  private supabase: SupabaseClient;

  // Singleton pattern for service instances
  public static getInstance(): StoreManagementService {
    if (!StoreManagementService.instance) {
      StoreManagementService.instance = new StoreManagementService();
    }
    return StoreManagementService.instance;
  }

  // CRUD operations with error handling
  async createStore(store: Store): Promise<Store> {
    try {
      const response = await this.callEdgeFunction('create-store', store);
      return this.transformStoreData(response);
    } catch (error) {
      this.handleError('createStore', error);
      throw error;
    }
  }

  // Private utility methods
  private async callEdgeFunction(functionName: string, data: any) {
    const session = await this.supabase.auth.getSession();
    // Implementation details...
  }
}
```

#### 5.2 Data Flow Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Component  │───▶│  Service Layer  │───▶│  Edge Function  │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
          ▲                       ▲                      │
          │                       │                      ▼
          │             ┌─────────────────┐    ┌─────────────────┐
          │             │   Error Handler │    │   PostgreSQL    │
          │             └─────────────────┘    │    Database     │
          │                                    └─────────┬───────┘
          │                                              │
          │              ┌─────────────────┐             │
          └──────────────│  State Update   │◀────────────┘
                         │ (Context/Hooks) │
                         └─────────────────┘
```

#### 5.3 Real-time Data Synchronization
```typescript
// Real-time subscription pattern
useEffect(() => {
  const subscription = supabase
    .channel('production_plans')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'production_plans'
    }, (payload) => {
      // Update local state
      updateProductionPlans(payload);
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### 6. Security Architecture

#### 6.1 Security Layers
```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│  1. Transport Security (HTTPS/WSS)                         │
├─────────────────────────────────────────────────────────────┤
│  2. Authentication (JWT Tokens)                            │
├─────────────────────────────────────────────────────────────┤
│  3. Authorization (Role-based Access Control)              │
├─────────────────────────────────────────────────────────────┤
│  4. Input Validation (Client & Server)                     │
├─────────────────────────────────────────────────────────────┤
│  5. Database Security (Service Role Isolation)             │
└─────────────────────────────────────────────────────────────┘
```

#### 6.2 API Security
```typescript
// API Security Pattern
async function secureEdgeFunction(req: Request) {
  // 1. CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. Authentication verification
  const token = extractBearerToken(req);
  const user = await verifyJWTToken(token);
  
  // 3. Authorization check
  if (!hasPermission(user.role, requiredPermission)) {
    throw new UnauthorizedError();
  }

  // 4. Input validation
  const validatedInput = validateInput(await req.json());

  // 5. Business logic execution
  return await executeBusinessLogic(validatedInput, user);
}
```

#### 6.3 Data Protection
- **Encryption in Transit**: All API calls use HTTPS/WSS
- **Encryption at Rest**: Database encryption provided by Supabase
- **Token Security**: JWT tokens with expiration and refresh
- **Input Sanitization**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries only

### 7. Performance Architecture

#### 7.1 Frontend Performance
```typescript
// Performance Optimization Strategies

// 1. Code Splitting
const LazyDashboard = lazy(() => import('./pages/DashboardPage'));
const LazyProduction = lazy(() => import('./pages/ProductionPage'));

// 2. Memoization
const MemoizedTable = memo(DataTable);
const optimizedFilter = useMemo(() => 
  data.filter(item => item.status === 'active'), [data]
);

// 3. Debounced API calls
const debouncedSearch = useCallback(
  debounce((searchTerm: string) => {
    performSearch(searchTerm);
  }, 300),
  []
);

// 4. Virtual scrolling for large lists
<VirtualizedList
  height={400}
  itemCount={items.length}
  itemSize={50}
  renderItem={({ index, style }) => (
    <div style={style}>{items[index]}</div>
  )}
/>
```

#### 7.2 Backend Performance
```sql
-- Database Optimization

-- 1. Indexes for common queries
CREATE INDEX idx_stores_active ON stores(is_active);
CREATE INDEX idx_production_plans_date ON production_plans(date);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- 2. Composite indexes for complex queries
CREATE INDEX idx_production_items_store_variety 
ON production_items(store_production_id, variety_id);

-- 3. Partial indexes for filtered queries
CREATE INDEX idx_active_varieties 
ON donut_varieties(name) WHERE is_active = true;
```

#### 7.3 Caching Strategy
```typescript
// Multi-level caching approach

// 1. Browser cache (Service Worker)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// 2. Memory cache (React Query/SWR)
const { data, error } = useSWR('/api/stores', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000
});

// 3. Edge caching (Supabase Edge Functions)
const cachedResult = await cache.get(cacheKey);
if (cachedResult) return cachedResult;

const result = await fetchFromDatabase();
await cache.set(cacheKey, result, { ttl: 300 });
```

### 8. Deployment Architecture

#### 8.1 Build and Deployment Pipeline
```yaml
# CI/CD Pipeline Structure
stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - npm install
    - npm run build
    - npm run type-check
  artifacts:
    paths:
      - dist/

test:
  stage: test
  script:
    - npm run test
    - npm run lint
    - npm run test:coverage

deploy:
  stage: deploy
  script:
    - supabase functions deploy
    - supabase db push
    - deploy-frontend-to-cdn
```

#### 8.2 Environment Configuration
```typescript
// Environment Management
export const config = {
  development: {
    supabaseUrl: process.env.VITE_SUPABASE_URL_DEV,
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY_DEV,
    logLevel: 'debug'
  },
  staging: {
    supabaseUrl: process.env.VITE_SUPABASE_URL_STAGING,
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY_STAGING,
    logLevel: 'info'
  },
  production: {
    supabaseUrl: process.env.VITE_SUPABASE_URL_PROD,
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY_PROD,
    logLevel: 'error'
  }
};
```

#### 8.3 Infrastructure Requirements
```
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────┤
│  Frontend Hosting                                           │
│  ├── CDN (Content Delivery Network)                        │
│  ├── Static File Hosting                                   │
│  └── SSL Certificate                                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase Platform                                          │
│  ├── PostgreSQL Database (Managed)                         │
│  ├── Edge Functions (Serverless)                           │
│  ├── Authentication Service                                │
│  ├── Real-time Engine                                       │
│  └── Storage Service                                        │
├─────────────────────────────────────────────────────────────┤
│  Monitoring & Logging                                       │
│  ├── Application Performance Monitoring                    │
│  ├── Error Tracking                                         │
│  ├── Database Monitoring                                    │
│  └── Uptime Monitoring                                      │
└─────────────────────────────────────────────────────────────┘
```

### 9. Monitoring and Observability

#### 9.1 Application Monitoring
```typescript
// Error Tracking and Monitoring
class ErrorTracker {
  static track(error: Error, context?: any) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error:', error, 'Context:', context);
    }

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      monitoringService.captureException(error, {
        tags: { component: context?.component },
        user: getCurrentUser(),
        extra: context
      });
    }
  }
}

// Performance monitoring
const performanceObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.entryType === 'navigation') {
      trackMetric('page_load_time', entry.duration);
    }
  });
});
performanceObserver.observe({ entryTypes: ['navigation'] });
```

#### 9.2 Database Monitoring
```sql
-- Performance monitoring queries
-- Long running queries
SELECT query, state, query_start, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '1 minute';

-- Database connections
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;

-- Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 10. Scalability Considerations

#### 10.1 Horizontal Scaling
- **Frontend**: CDN distribution and multiple edge locations
- **Backend**: Serverless Edge Functions auto-scale
- **Database**: Supabase handles database scaling automatically
- **Real-time**: WebSocket connections distributed across regions

#### 10.2 Vertical Scaling
- **Database**: Upgrade Supabase plan for more resources
- **Edge Functions**: Increase memory/CPU allocation
- **Storage**: Scale storage as needed

#### 10.3 Performance Bottlenecks
- **Database Queries**: Optimize with proper indexing
- **API Rate Limits**: Implement request batching
- **Real-time Connections**: Monitor connection counts
- **Large Data Sets**: Implement pagination and virtual scrolling

### 11. Backup and Disaster Recovery

#### 11.1 Backup Strategy
```typescript
// Automated backup configuration
const backupConfig = {
  database: {
    frequency: 'daily',
    retention: '30 days',
    pointInTimeRecovery: true
  },
  functions: {
    versionControl: 'git',
    automaticDeployment: true
  },
  configuration: {
    environmentVariables: 'secured',
    migrationHistory: 'tracked'
  }
}
```

#### 11.2 Disaster Recovery Plan
1. **Database Recovery**: Point-in-time recovery from Supabase backups
2. **Code Recovery**: Version control system (Git) repository
3. **Configuration Recovery**: Environment variables backup
4. **Monitoring**: Automated alerts for system failures
5. **RTO/RPO**: Recovery Time Objective < 4 hours, Recovery Point Objective < 1 hour

### 12. Future Architecture Considerations

#### 12.1 Microservices Migration
```
Current Monolithic Structure → Future Microservices

┌─────────────────────────────┐    ┌─────────────────┐
│    Supabase Edge Functions  │    │ User Service    │
│    (Single Runtime)         │ => │ Store Service   │
│                             │    │ Production Svc  │
│                             │    │ Analytics Svc   │
└─────────────────────────────┘    └─────────────────┘
```

#### 12.2 Advanced Features
- **Event Sourcing**: Track all system events for audit trails
- **CQRS**: Separate read/write models for better performance
- **Message Queues**: Asynchronous processing for heavy operations
- **API Gateway**: Centralized API management and routing
- **Service Mesh**: Inter-service communication management

#### 12.3 Technology Evolution
- **Next.js**: Potential migration for SSR capabilities
- **GraphQL**: Alternative to REST APIs for better data fetching
- **React Native**: Mobile application development
- **Kubernetes**: Container orchestration for complex deployments 