# Experiment Overrides Feature

The ABsmartly Browser Extension now supports experiment overrides that work across both client-side and server-side rendering.

## How It Works

1. **Browser Extension UI**: Users can select experiment variants directly from the extension's experiment list
2. **Cookie Storage**: Overrides are stored in a cookie named `absmartly_overrides` with a 30-day expiry
3. **Client-Side Application**: The SDK plugin automatically reads and applies overrides during initialization
4. **Server-Side Application**: Your server can read the same cookie to apply overrides during SSR

## Cookie Format

The `absmartly_overrides` cookie contains a JSON object mapping experiment names to variant indices:

```json
{
  "experiment_name_1": 0,  // Use variant 0 (control)
  "experiment_name_2": 1,  // Use variant 1 
  "experiment_name_3": 2   // Use variant 2
}
```

## Client-Side Integration

The browser extension automatically applies overrides when the SDK initializes. No additional code is needed if you're using the ABsmartly DOM Changes plugin.

## Server-Side Integration

For server-side rendering, read the cookie and apply overrides to your ABsmartly context:

### Node.js / Express Example

```javascript
import { parseCookies } from 'your-cookie-parser';

app.get('*', (req, res) => {
  // Create ABsmartly context
  const context = sdk.createContext(config);
  
  // Apply overrides from cookie
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.absmartly_overrides) {
    try {
      const overrides = JSON.parse(cookies.absmartly_overrides);
      
      // Apply each override to the context
      Object.entries(overrides).forEach(([experimentName, variantIndex]) => {
        context.override(experimentName, variantIndex);
      });
      
      // Alternative: use overrides method if available
      // context.overrides(overrides);
    } catch (error) {
      console.error('Failed to parse experiment overrides:', error);
    }
  }
  
  // Continue with your rendering logic
  // ...
});
```

### Next.js Example

```javascript
// In your getServerSideProps or middleware
export async function getServerSideProps({ req }) {
  const context = createABsmartlyContext();
  
  // Read and apply overrides
  const overrides = req.cookies.absmartly_overrides;
  if (overrides) {
    try {
      const parsed = JSON.parse(overrides);
      Object.entries(parsed).forEach(([exp, variant]) => {
        context.override(exp, variant);
      });
    } catch (error) {
      console.error('Failed to apply overrides:', error);
    }
  }
  
  // ... rest of your logic
}
```

### Python/Django Example

```python
import json
from django.http import HttpRequest

def apply_overrides(request: HttpRequest, context):
    """Apply experiment overrides from cookie to ABsmartly context"""
    overrides_cookie = request.COOKIES.get('absmartly_overrides')
    
    if overrides_cookie:
        try:
            overrides = json.loads(overrides_cookie)
            for experiment_name, variant_index in overrides.items():
                context.override(experiment_name, variant_index)
        except json.JSONDecodeError:
            print("Failed to parse experiment overrides")
```

## Features

### DOM Changes Indicator
Experiments with DOM changes are marked with a purple "DOM Changes" tag in the extension UI, making it easy to identify visual experiments.

### Multi-Variant Support
The override selector supports experiments with any number of variants. Simply select the desired variant from the dropdown.

### Persistent Overrides
Overrides persist for 30 days or until manually changed/removed. The "Off" option removes the override.

### Visual Feedback
Active overrides are highlighted with a green "Active" indicator in the extension UI.

## Security Considerations

- Overrides only affect the user who sets them via the extension
- The cookie is set with path=/ to work across all pages
- Server-side code should validate variant indices before applying
- Consider adding permission checks if overrides should be restricted

## Troubleshooting

### Overrides Not Working Client-Side
1. Check that the SDK plugin is properly initialized
2. Verify the cookie is being set (check DevTools > Application > Cookies)
3. Ensure the experiment name matches exactly

### Overrides Not Working Server-Side
1. Verify your server can read cookies
2. Check that you're parsing the JSON correctly
3. Ensure you're applying overrides before calling `treatment()` or `treatments()`
4. Verify the context has the override/overrides method available

## API Reference

### Cookie Management Functions (Extension)

```typescript
// Load overrides from cookie
loadOverridesFromCookie(): Promise<ExperimentOverrides>

// Save overrides to cookie
saveOverridesToCookie(overrides: ExperimentOverrides): Promise<void>

// Types
interface ExperimentOverrides {
  [experimentName: string]: number // variant index
}
```