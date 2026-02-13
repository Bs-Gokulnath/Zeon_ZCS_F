# Backend Migration Plan: Moving All Computations from Frontend to Backend

## Executive Summary

Currently, the dashboard performs all data processing in the frontend, causing significant performance issues with large datasets. This plan outlines moving 100% of computations to the backend, reducing frontend code by 76% and improving performance by 95%.

**Current State:**
- 1,700+ lines of computation-heavy React code
- 30+ data processing functions running client-side
- Initial load: 5-10 seconds with large datasets
- Filter changes: 2-4 seconds
- Memory usage: 300-500MB
- Bundle size: ~400KB

**Target State:**
- ~400 lines of pure UI/rendering code
- Zero computation in frontend
- Initial load: <500ms
- Filter changes: <100ms
- Memory usage: 50-80MB
- Bundle size: ~150KB

---

## Functions to Migrate to Backend

### 1. **Session Trend Processing** (`processSessionTrend`)
**Current Location:** DashboardView.jsx, lines ~400-450
**What it does:**
- Loops through all session rows in all files
- Aggregates power data by date (Peak kW, Avg kW)
- Formats data for line chart

**Backend Implementation:**
```javascript
// Pseudocode
SELECT 
  DATE(session_timestamp) as date,
  MAX(peak_power_kw) as peakPower,
  AVG(avg_power_kw) as avgPower
FROM sessions
WHERE connector_type = ? AND oem = ? AND station = ? AND cpid = ?
GROUP BY DATE(session_timestamp)
ORDER BY date ASC
```

---

### 2. **Negative Stops by OEM** (`processNetworkPerformance`)
**Current Location:** DashboardView.jsx, lines ~450-520
**What it does:**
- Groups sessions by OEM name
- Calculates negative stop percentage per OEM
- Breaks down into P (Precharging), C (Charging), N (None) categories
- Returns sorted array with counts and percentages

**Backend Implementation:**
```javascript
// Pseudocode
SELECT 
  oem_name,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN is_charging = 'N' THEN 1 END) as negative_stops,
  COUNT(CASE WHEN is_charging = 'P' AND is_charging = 'N' THEN 1 END) as p_count,
  COUNT(CASE WHEN is_charging = 'C' AND is_charging = 'N' THEN 1 END) as c_count,
  COUNT(CASE WHEN is_charging = 'N' AND is_charging NOT IN ('P','C') THEN 1 END) as n_count,
  (COUNT(CASE WHEN is_charging = 'N' THEN 1 END) * 100.0 / COUNT(*)) as negative_stop_percentage
FROM sessions
WHERE connector_type = ?
GROUP BY oem_name
ORDER BY negative_stop_percentage DESC
```

---

### 3. **Negative Stops by Station** (`processNetworkPerformanceByStation`)
**Current Location:** DashboardView.jsx, lines ~520-590
**What it does:**
- Same as above but grouped by station name
- Includes P/C/N breakdown per station

**Backend Implementation:** Similar to #2 but `GROUP BY station_alias_name`

---

### 4. **Precharging Failure by OEM** (`processPrechargingFailureByOEM`)
**Current Location:** DashboardView.jsx, lines ~590-650
**What it does:**
- Scans Connector1 and Connector2 arrays
- Counts sessions where `is_Charging = 'P'` and then 'N' (failure)
- Groups by OEM

**Backend Implementation:**
```javascript
// Pseudocode
SELECT 
  oem_name,
  COUNT(*) as precharging_failures
FROM sessions
WHERE 
  connector_type = ? AND
  (connector1_is_charging = 'P' OR connector2_is_charging = 'P') AND
  (connector1_is_charging = 'N' OR connector2_is_charging = 'N')
GROUP BY oem_name
ORDER BY precharging_failures DESC
```

---

### 5. **Precharging Failure by Station** (`processPrechargingFailureByStation`)
**Current Location:** DashboardView.jsx, lines ~650-710
**What it does:** Same as #4 but grouped by station

**Backend Implementation:** Similar to #4 but `GROUP BY station_alias_name`

---

### 6. **Error Breakdown** (`processErrorBreakdown`)
**Current Location:** DashboardView.jsx, lines ~710-780
**What it does:**
- Extracts all `vendorErrorCode` fields
- Groups and counts occurrences
- Returns top 5 errors with percentages

**Backend Implementation:**
```javascript
// Pseudocode
SELECT 
  vendor_error_code,
  COUNT(*) as count,
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sessions WHERE vendor_error_code IS NOT NULL)) as percentage
FROM sessions
WHERE 
  connector_type = ? AND
  vendor_error_code IS NOT NULL AND
  vendor_error_code != ''
GROUP BY vendor_error_code
ORDER BY count DESC
LIMIT 5
```

---

### 7. **CPID Rankings by Negative Stops** (`getTopCPIDsByNegativeStops`)
**Current Location:** DashboardView.jsx, lines ~780-850
**What it does:**
- Filters sessions by OEM
- Groups by CPID (Charge Point ID)
- Calculates negative stops per CPID
- Sorts by negative stop count
- Returns top entries with sessions/stops/percentage

**Backend Implementation:**
```javascript
// Pseudocode
SELECT 
  charge_point_id,
  COUNT(*) as charging_sessions,
  COUNT(CASE WHEN is_charging = 'N' THEN 1 END) as negative_stops,
  (COUNT(CASE WHEN is_charging = 'N' THEN 1 END) * 100.0 / COUNT(*)) as negative_stop_percentage
FROM sessions
WHERE oem_name = ? AND connector_type = ?
GROUP BY charge_point_id
HAVING negative_stops > 0
ORDER BY negative_stops DESC
```

---

### 8. **Data Aggregation** (`aggregateData`)
**Current Location:** DashboardView.jsx, lines ~850-920
**What it does:**
- Merges multiple result objects (when "All Files" selected)
- Sums numeric metrics (sessions, stops, errors)
- Merges Connector1/Connector2 arrays
- Combines info arrays

**Backend Implementation:**
- Move to backend: When multiple files requested, aggregate at database level
- Use `WHERE file_id IN (?)` clause with SUM aggregations
- Return single merged result object

---

### 9. **Helper Functions**

#### `getVal(obj, key, defaultVal)`
**Purpose:** Safe key extraction with default values
**Migration:** Move validation to backend schema, return clean data

#### `getChargePointID(data)`, `getStationName(data)`, `getOEMName(data)`
**Purpose:** Extract specific fields from info arrays
**Migration:** Backend should return normalized field names

#### `getConnectorType(data)`
**Purpose:** Extracts AC/DC from "Connector Standard(AC/DC)" field
**Migration:** Store as separate `connector_type` column, return directly

---

### 10. **Filter Options Processing**
**Current Location:** Multiple useMemo hooks extracting unique values
**What it does:**
- Scans all data to build unique OEM, Station, CPID lists
- Powers dropdown filters

**Backend Implementation:**
```javascript
GET /api/dashboard/filter-options?connectorType=DC

Response:
{
  oems: ["Exicom", "Delta", "Bharat DC"],
  stations: ["Station A", "Station B", "Station C"],
  cpids: ["CPID001", "CPID002", "CPID003"],
  files: [
    {id: "file1", name: "Report Jan 2025", date: "2025-01-15"},
    {id: "file2", name: "Report Feb 2025", date: "2025-02-05"}
  ]
}
```

---

### 11. **Charging Share by OEM**
**Current Location:** DashboardView.jsx, pie chart processing
**What it does:**
- Counts total sessions per OEM
- Calculates percentage share

**Backend Implementation:**
```javascript
SELECT 
  oem_name,
  COUNT(*) as value,
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sessions)) as percentage
FROM sessions
WHERE connector_type = ?
GROUP BY oem_name
```

---

### 12. **Auth Method Distribution**
**Current Location:** DashboardView.jsx, pie chart processing
**What it does:**
- Extracts auth method from info array
- Groups and counts

**Backend Implementation:**
```javascript
SELECT 
  auth_method,
  COUNT(*) as value
FROM sessions
WHERE connector_type = ?
GROUP BY auth_method
```

---

### 13. **Combined Metrics Calculation**
**Current Location:** activeResult useMemo
**What it does:**
- Calculates combined metrics across both connectors
- Sums: totalSessions, positiveStops, negativeStops, totalErrors
- Averages: networkPerformance, averageStartDelay, etc.

**Backend Implementation:**
- Return three metric objects: `combined`, `connector1`, `connector2`
- Perform aggregation in SQL with connector-specific WHERE clauses

---

## Unified API Architecture

### Single Endpoint Design
```
GET /api/dashboard
```

**Query Parameters:**
- `connectorType`: "DC" | "AC" | "Combined" (default: "DC")
- `oem`: string (optional, filter by specific OEM)
- `station`: string (optional, filter by station)
- `cpid`: string (optional, filter by charge point)
- `files`: string[] (optional, array of file IDs, default: all files)
- `startDate`: ISO date (optional)
- `endDate`: ISO date (optional)

**Response Structure:**
```json
{
  "filterOptions": {
    "oems": ["Exicom", "Delta", "Bharat DC"],
    "stations": ["Station A", "Station B"],
    "cpids": ["CPID001", "CPID002"],
    "files": [
      {"id": "file1", "name": "Report Jan 2025", "date": "2025-01-15"}
    ]
  },
  "metrics": {
    "combined": {
      "totalSessions": 1500,
      "positiveStops": 1200,
      "negativeStops": 300,
      "networkPerformance": 80.5,
      "totalErrors": 45,
      "averageStartDelay": 2.3
    },
    "connector1": { /* same structure */ },
    "connector2": { /* same structure */ }
  },
  "sessionTrend": [
    {"date": "2025-01-01", "peakPower": 50, "avgPower": 35},
    {"date": "2025-01-02", "peakPower": 55, "avgPower": 38}
  ],
  "networkPerformance": {
    "byOEM": [
      {
        "name": "Exicom",
        "percentage": 15.5,
        "totalSessions": 500,
        "negativeStops": 78,
        "pCount": 30,
        "cCount": 40,
        "nCount": 8
      }
    ],
    "byStation": [ /* same structure as byOEM */ ]
  },
  "prechargingFailures": {
    "byOEM": [
      {"name": "Exicom", "count": 25},
      {"name": "Delta", "count": 18}
    ],
    "byStation": [
      {"name": "Station A", "count": 15},
      {"name": "Station B", "count": 12}
    ]
  },
  "errorBreakdown": [
    {"errorCode": "ERR_001", "count": 150, "percentage": 33.3},
    {"errorCode": "ERR_002", "count": 120, "percentage": 26.7}
  ],
  "authMethods": [
    {"method": "RFID", "value": 800},
    {"method": "App", "value": 700}
  ],
  "chargingShare": [
    {"oem": "Exicom", "value": 500, "percentage": 33.3},
    {"oem": "Delta", "value": 450, "percentage": 30.0}
  ]
}
```

### Separate CPID Rankings Endpoint
```
GET /api/dashboard/cpid-rankings?oem=Exicom&connectorType=DC

Response:
[
  {
    "cpid": "CPID001",
    "chargingSessions": 250,
    "negativeStops": 45,
    "negativeStopPercentage": 18.0
  },
  {
    "cpid": "CPID002",
    "chargingSessions": 180,
    "negativeStops": 32,
    "negativeStopPercentage": 17.8
  }
]
```

---

## Performance Impact Analysis

### Code Reduction
**Before:**
- DashboardView.jsx: 1,700 lines
- Functions: 30+ data processing functions
- useMemo hooks: 8+ complex computations
- Helper functions: 10+ extraction/validation utilities

**After:**
- DashboardView.jsx: ~400 lines (76% reduction)
- API calls: 2 endpoints (dashboard, cpid-rankings)
- useMemo hooks: 0 for data processing (only UI state)
- Helper functions: Only UI-related (modal controls, formatters)

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Load | 5-10s | <500ms | 95% faster |
| Filter Change | 2-4s | <100ms | 98% faster |
| Memory Usage | 300-500MB | 50-80MB | 85% reduction |
| Bundle Size | 400KB | 150KB | 62% smaller |
| CPU Usage | High (100% during processing) | Low (5-10%) | 90-95% reduction |

### Scalability Impact
- **Current:** Performance degrades linearly with data size (1000 rows → 10s load time)
- **After:** Performance remains constant regardless of data size (cached results)
- **Database Indexing:** Enable sub-100ms queries even with millions of rows

---

## Implementation Plan

### Phase 1: Backend API Foundation (Week 1-2)
**Goal:** Create unified `/api/dashboard` endpoint with core functionality

**Tasks:**
1. ✅ Design API contract (request/response structure)
2. Create database schema:
   - `sessions` table with indexed columns: oem_name, station_alias_name, charge_point_id, connector_type, date, is_charging, vendor_error_code
   - `files` table for report metadata
3. Implement core aggregation queries:
   - Session trend (daily power aggregation)
   - Negative Stops by OEM (with P/C/N breakdown)
   - Negative Stops by station
4. Implement connector type filtering (`WHERE connector_type = ?`)
5. Setup Redis caching (15-30 min TTL)

**Success Criteria:**
- `/api/dashboard?connectorType=DC` returns complete response in <500ms
- Changing connectorType filter returns cached result in <100ms
- Session trend and Negative Stops charts render correctly

---

### Phase 2: Advanced Features (Week 3)
**Goal:** Add precharging failures, error breakdown, CPID rankings

**Tasks:**
1. Implement precharging failure detection:
   - Scan connector arrays for P→N transitions
   - Group by OEM and station
2. Implement error breakdown:
   - Extract top 5 vendor error codes
   - Calculate counts and percentages
3. Create `/api/dashboard/cpid-rankings` endpoint:
   - Filter by OEM and connector type
   - Rank by negative stops
   - Return sessions/stops/percentage
4. Implement auth methods and charging share aggregations
5. Add multi-file aggregation logic

**Success Criteria:**
- All 6 rows of charts display correct data
- CPID modal populates with accurate rankings
- "All Files" selection merges data correctly

---

### Phase 3: Frontend Refactoring (Week 4)
**Goal:** Remove all computation code, simplify to pure UI

**Frontend Changes:**
1. **Remove ALL processing functions:**
   - Delete processSessionTrend()
   - Delete processNetworkPerformance()
   - Delete processNetworkPerformanceByStation()
   - Delete processPrechargingFailureByOEM()
   - Delete processPrechargingFailureByStation()
   - Delete processErrorBreakdown()
   - Delete getTopCPIDsByNegativeStops()
   - Delete aggregateData()
   - Delete all helper functions (getVal, getChargePointID, etc.)

2. **Simplify state management:**
   ```jsx
   // Before: Complex useMemo with processing
   const sessionTrendData = useMemo(() => {
     return processSessionTrend(filteredAllResultsForCharts);
   }, [filteredAllResultsForCharts]);
   
   // After: Direct state from API
   const [dashboardData, setDashboardData] = useState(null);
   ```

3. **Replace useMemo hooks with API calls:**
   ```jsx
   useEffect(() => {
     const fetchDashboard = async () => {
       const response = await fetch(
         `/api/dashboard?connectorType=${connectorType}&oem=${selectedOEM}&station=${selectedStation}&cpid=${selectedCPID}&files=${selectedFiles.join(',')}`
       );
       const data = await response.json();
       setDashboardData(data);
     };
     fetchDashboard();
   }, [connectorType, selectedOEM, selectedStation, selectedCPID, selectedFiles]);
   ```

4. **Update chart components:**
   ```jsx
   // Before: Compute then render
   <LineChart data={processSessionTrend(data)}>
   
   // After: Direct render
   <LineChart data={dashboardData?.sessionTrend}>
   ```

5. **Update CPID modal:**
   ```jsx
   // Before: Process on click
   const handleOEMClick = (oem) => {
     const rankings = getTopCPIDsByNegativeStops(allResults, oem);
     setModalData(rankings);
   };
   
   // After: Fetch on click
   const handleOEMClick = async (oem) => {
     const response = await fetch(
       `/api/dashboard/cpid-rankings?oem=${oem}&connectorType=${connectorType}`
     );
     const rankings = await response.json();
     setModalData(rankings);
   };
   ```

**Success Criteria:**
- DashboardView.jsx reduced to ~400 lines
- Zero data processing functions remain
- All charts render correctly from API data
- Filter changes trigger API refetch, no client-side reprocessing

---

### Phase 4: Optimization & Testing (Week 5)
**Goal:** Ensure production-ready performance

**Tasks:**
1. **Database optimization:**
   - Add composite indexes: (connector_type, oem_name, date), (station_alias_name, is_charging)
   - Analyze query plans, optimize slow queries
   - Implement connection pooling

2. **Caching strategy:**
   - Redis cache for common filter combinations
   - Cache invalidation on new file uploads
   - Implement cache warming for popular queries

3. **Parallel processing:**
   - Process multiple files concurrently
   - Use Promise.all() for independent aggregations
   - Stream large result sets

4. **Load testing:**
   - Test with production data volumes (1M+ sessions)
   - Simulate concurrent users (50+ simultaneous requests)
   - Verify <500ms response times under load

5. **Error handling:**
   - Graceful degradation if cache fails
   - Fallback to database queries
   - Frontend loading states and error messages

**Success Criteria:**
- 95th percentile response time <500ms with 1M sessions
- Cache hit rate >80% for common filters
- Zero client-side out-of-memory errors
- Smooth experience with 50+ concurrent users

---

## Database Schema Design

```sql
CREATE TABLE sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  file_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  
  -- Identifiers
  charge_point_id VARCHAR(100),
  station_alias_name VARCHAR(200),
  oem_name VARCHAR(100),
  connector_type ENUM('AC', 'DC') NOT NULL,
  
  -- Session metrics
  is_charging ENUM('P', 'C', 'N'),
  peak_power_kw DECIMAL(10,2),
  avg_power_kw DECIMAL(10,2),
  vendor_error_code VARCHAR(50),
  auth_method VARCHAR(50),
  
  -- Connector details
  connector1_is_charging ENUM('P', 'C', 'N'),
  connector2_is_charging ENUM('P', 'C', 'N'),
  
  -- Indexes for fast filtering
  INDEX idx_connector_oem_date (connector_type, oem_name, date),
  INDEX idx_station_charging (station_alias_name, is_charging),
  INDEX idx_cpid (charge_point_id),
  INDEX idx_error_code (vendor_error_code),
  INDEX idx_file_date (file_id, date)
);

CREATE TABLE files (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  upload_date DATETIME NOT NULL,
  record_count INT NOT NULL
);
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current frontend code
- [ ] Document all existing chart calculations
- [ ] Create test dataset with known expected values
- [ ] Setup staging environment

### Backend Development
- [ ] Create database schema
- [ ] Implement session data import/ETL pipeline
- [ ] Build `/api/dashboard` endpoint
- [ ] Build `/api/dashboard/cpid-rankings` endpoint
- [ ] Implement Redis caching
- [ ] Add query parameter validation
- [ ] Write unit tests for aggregation logic
- [ ] Write integration tests for API endpoints

### Frontend Refactoring
- [ ] Remove processSessionTrend() and update SessionTrend chart
- [ ] Remove processNetworkPerformance() and update NetworkPerformance chart
- [ ] Remove processNetworkPerformanceByStation() and update corresponding chart
- [ ] Remove processPrechargingFailureByOEM() and processPrechargingFailureByStation()
- [ ] Remove processErrorBreakdown() and update ErrorBreakdown chart
- [ ] Remove getTopCPIDsByNegativeStops() and update CPID modal
- [ ] Remove aggregateData() and helper functions
- [ ] Replace all useMemo computations with API state
- [ ] Add loading states for all API calls
- [ ] Add error handling for API failures
- [ ] Update filter handlers to trigger API refetch

### Testing & Validation
- [ ] Verify all 6 rows of charts display correctly
- [ ] Test AC/DC/Combined filter switching
- [ ] Test OEM/Station/CPID filter combinations
- [ ] Test "All Files" vs single file selection
- [ ] Verify CPID modal shows correct rankings
- [ ] Load test with production data volume
- [ ] Performance test: initial load <500ms
- [ ] Performance test: filter change <100ms
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsive testing

### Deployment
- [ ] Deploy database with indexes
- [ ] Deploy backend API to staging
- [ ] Smoke test staging environment
- [ ] Deploy frontend to staging
- [ ] End-to-end testing on staging
- [ ] Performance benchmark on staging
- [ ] Deploy to production with monitoring
- [ ] Monitor error rates and response times
- [ ] Rollback plan ready if issues arise

---

## Risk Mitigation

### Risk 1: Data Consistency Issues
**Concern:** Backend aggregations don't match current frontend calculations
**Mitigation:**
- Create comparison tests: run both frontend and backend, verify results match
- Use same test dataset for validation
- Document any intentional changes in calculation logic

### Risk 2: Performance Degradation
**Concern:** Backend queries slower than expected
**Mitigation:**
- Implement caching from day 1
- Database indexing on all filter columns
- Query optimization with EXPLAIN plans
- Fallback to optimized queries if aggregations timeout

### Risk 3: Breaking Changes During Migration
**Concern:** Frontend breaks before backend is ready
**Mitigation:**
- Use feature flags to toggle between old and new logic
- Gradual rollout: migrate one chart at a time
- Keep old processing functions until migration complete
- A/B test with subset of users

### Risk 4: Cache Staleness
**Concern:** Users see outdated data
**Mitigation:**
- Short TTL (15-30 min) for cached results
- Implement cache invalidation on file upload
- Add "Refresh" button to force cache bypass
- Show last updated timestamp in UI

---

## Success Metrics

### Performance KPIs
- ✅ Initial dashboard load: <500ms (target: 95% reduction from 5-10s)
- ✅ Filter change response: <100ms (target: 98% reduction from 2-4s)
- ✅ Memory usage: <80MB (target: 85% reduction from 300-500MB)
- ✅ Bundle size: <150KB (target: 62% reduction from 400KB)

### Code Quality KPIs
- ✅ DashboardView.jsx: <500 lines (target: 76% reduction from 1,700 lines)
- ✅ Frontend complexity: Zero data processing functions
- ✅ Backend test coverage: >80% for aggregation logic
- ✅ API response time: 95th percentile <500ms

### User Experience KPIs
- ✅ Perceived loading time: Instant filter changes (<100ms)
- ✅ Error rate: <0.1% API failures
- ✅ Uptime: 99.9% availability
- ✅ User satisfaction: Dashboard feels "snappy" and responsive

---

## Next Steps

1. **Immediate Action (Next 1-2 days):**
   - Review and approve this migration plan
   - Setup staging environment with database
   - Create feature branch: `feature/backend-migration`

2. **Week 1-2: Backend Foundation**
   - Implement `/api/dashboard` endpoint
   - Move core computations (session trend, Negative Stops)
   - Setup Redis caching

3. **Week 3: Advanced Features**
   - Add precharging failures, error breakdown
   - Create CPID rankings endpoint
   - Multi-file aggregation

4. **Week 4: Frontend Refactoring**
   - Remove all processing functions
   - Replace with API calls
   - Update all charts and modals

5. **Week 5: Testing & Deployment**
   - Load testing with production data
   - Staging deployment and validation
   - Production deployment with monitoring

---

## Appendix: Code Examples

### Before: Frontend Processing (Heavy)
```jsx
// 50+ lines of complex processing
const processNetworkPerformance = (results) => {
  const oemData = new Map();
  
  results.forEach(result => {
    const oemName = getOEMName(result);
    const connectorType = getConnectorType(result);
    
    if (connectorType === activeConnectorType || activeConnectorType === 'Combined') {
      const connectors = [...(result.Connector1 || []), ...(result.Connector2 || [])];
      
      connectors.forEach(session => {
        if (!oemData.has(oemName)) {
          oemData.set(oemName, { total: 0, negative: 0, pCount: 0, cCount: 0, nCount: 0 });
        }
        
        const data = oemData.get(oemName);
        data.total++;
        
        if (session.is_Charging === 'N') {
          data.negative++;
          if (session.is_Charging_prev === 'P') data.pCount++;
          else if (session.is_Charging_prev === 'C') data.cCount++;
          else data.nCount++;
        }
      });
    }
  });
  
  return Array.from(oemData.entries())
    .map(([name, data]) => ({
      name,
      percentage: (data.negative / data.total * 100).toFixed(2),
      totalSessions: data.total,
      negativeStops: data.negative,
      pCount: data.pCount,
      cCount: data.cCount,
      nCount: data.nCount
    }))
    .sort((a, b) => b.percentage - a.percentage);
};
```

### After: API Call (Simple)
```jsx
// 3 lines - pure API consumption
const fetchDashboard = async () => {
  const response = await fetch(`/api/dashboard?connectorType=${connectorType}`);
  const data = await response.json();
  setDashboardData(data);
};

// Render directly from state
<BarChart data={dashboardData?.networkPerformance.byOEM}>
```

---

## Conclusion

This migration represents a fundamental architectural improvement that will:
- ✅ Reduce frontend complexity by 76%
- ✅ Improve performance by 95%
- ✅ Enable horizontal scalability
- ✅ Reduce memory usage by 85%
- ✅ Improve maintainability and testability

The 5-week implementation plan provides a clear path forward with minimal risk and maximum impact. By moving computations to the backend, we transform the dashboard from a processing-heavy SPA into a lightweight, responsive visualization layer that scales effortlessly with growing data volumes.
