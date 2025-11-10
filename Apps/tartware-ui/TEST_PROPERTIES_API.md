# Testing Properties API Integration

## Setup

1. **Backend Running**: Core service on http://localhost:3000
2. **Frontend Running**: Angular dev server on http://localhost:4200

## Test User

**Username**: `michael.jenkins774`

### Login Response
```json
{
  "id": "019a44e8-2333-7001-8dcb-e1c645ee432d",
  "username": "michael.jenkins774",
  "email": "nuneztracey@example.org",
  "first_name": "Michael",
  "last_name": "Jenkins",
  "is_active": true,
  "memberships": [{
    "tenant_id": "019a44e8-232b-7001-8474-166c6699cd99",
    "role": "ADMIN",
    "is_active": true
  }]
}
```

## Testing Steps

1. **Open application**: http://localhost:4200
2. **Login**: Enter username `michael.jenkins774`
3. **Select tenant**: Click on tenant from the list
4. **Check browser console**: Open DevTools (F12) and look for:
   - ✅ `Loading properties for tenant: <tenant-id>`
   - ✅ `Properties loaded successfully: [...]`
   - ✅ Property dropdown should appear in top bar if properties exist

## API Endpoints

### Properties Endpoint
```bash
GET http://localhost:3000/v1/properties?tenant_id=019a44e8-232b-7001-8474-166c6699cd99&limit=10
Headers:
  x-user-id: 019a44e8-2333-7001-8dcb-e1c645ee432d
```

## What Was Fixed

1. **Property Dropdown Visibility**: Changed from checking `activeTenant()?.property_count` to `hasMultipleProperties()` computed signal
2. **API Integration**: PropertyService now uses `PropertyWithStats` from `@tartware/schemas`
3. **Error Logging**: Added detailed console logging for debugging API calls
4. **Auth Interceptor**: Automatically adds `x-user-id` header from localStorage
5. **Loading States**: Added loading signals for better UX

## Expected Behavior

- ✅ After login, properties load automatically via API
- ✅ Property dropdown only shows when multiple properties exist
- ✅ Console shows detailed logs of API calls
- ✅ Errors are logged with full details (status, url, message)
