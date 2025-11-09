# Progressive Web App (PWA) Implementation

This application is a fully-featured Progressive Web App following industry best practices from [web.dev](https://web.dev/explore/progressive-web-apps) and [Angular PWA documentation](https://angular.dev/ecosystem/service-workers/getting-started).

## Features Implemented

### ✅ Core PWA Features

1. **Service Worker** - Offline caching and background sync
2. **Web App Manifest** - Installability and app-like experience
3. **Responsive Design** - Works on all devices
4. **HTTPS** - Secure communication (required for production)
5. **Fast Loading** - Optimized assets and lazy loading

### ✅ Advanced Features

1. **Update Notifications** - Automatic detection and user prompts
2. **Install Prompt** - Custom installation UI
3. **Offline Support** - Cache-first strategies for assets
4. **Background Sync** - Data synchronization when online
5. **Push Notifications** (Ready to implement)

## Files Created

### Configuration Files

- `ngsw-config.json` - Service worker configuration
- `src/manifest.webmanifest` - PWA manifest with app metadata
- `generate-pwa-icons.sh` - Icon generation script

### Services

- `src/app/core/services/pwa.service.ts` - Manages service worker updates
- `src/app/core/services/install-prompt.service.ts` - Handles installation prompts

### Updated Files

- `src/index.html` - Added PWA meta tags and manifest link
- `src/app/app.config.ts` - Added service worker provider
- `src/app/app.component.ts` - Initialize PWA service
- `angular.json` - Added service worker and manifest assets

## Service Worker Strategies

### Asset Caching (`assetGroups`)

1. **App Shell** (prefetch)
   - HTML, CSS, JS files
   - Installed immediately on first load

2. **Assets** (lazy)
   - Images, fonts, icons
   - Cached on first use

3. **Fonts** (external)
   - Google Fonts
   - Cached for offline use

### API Caching (`dataGroups`)

1. **Freshness Strategy** (Dashboard, Auth)
   - Always fetch fresh data first
   - Fall back to cache if offline
   - Max age: 1 minute
   - Timeout: 10 seconds

2. **Performance Strategy** (Tenants, Properties, Users)
   - Serve from cache first
   - Update cache in background
   - Max age: 5 minutes
   - Timeout: 5 seconds

## Installation & Testing

### Development

```bash
# Service workers are disabled in dev mode
npm start
```

### Production Build

```bash
# Build with service worker enabled
npm run build:prod

# Serve production build locally
npx http-server -p 8080 -c-1 dist/tartware-ui/browser
```

### Testing PWA Features

1. **Chrome DevTools**
   - Open DevTools → Application → Service Workers
   - Check registration and updates
   - Test offline mode (Network → Offline)

2. **Lighthouse**
   - Run PWA audit: DevTools → Lighthouse → PWA
   - Check all PWA criteria

3. **Install Test**
   - Visit app in Chrome/Edge
   - Look for install prompt in address bar
   - Test installed app behavior

## Generating Icons

### Prerequisites

```bash
# Install ImageMagick
sudo apt install imagemagick
```

### Generate Icons

```bash
# From a source logo (512x512 or larger recommended)
./generate-pwa-icons.sh path/to/logo.png
```

This creates all required icon sizes:
- 72x72, 96x96, 128x128, 144x144
- 152x152, 192x192, 384x384, 512x512

### Manual Icon Creation

Use online tools:
- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
- [Real Favicon Generator](https://realfavicongenerator.net/)

## Deployment Checklist

### Before Deploying

- [ ] Generate all PWA icons
- [ ] Update `manifest.webmanifest` with production URLs
- [ ] Test service worker in production mode
- [ ] Verify HTTPS is enabled
- [ ] Run Lighthouse PWA audit (score > 90)
- [ ] Test offline functionality
- [ ] Test install prompt on mobile
- [ ] Verify update notifications work

### Production Requirements

1. **HTTPS** - Required for service workers
2. **Valid Manifest** - All icon sizes present
3. **Fast Loading** - First Contentful Paint < 2s
4. **Responsive** - Works on all screen sizes
5. **Offline Ready** - Core features work offline

## Update Strategy

### Automatic Updates

The app checks for updates:
- On app startup (when stable)
- Every 6 hours while running
- Every 30 minutes in background

### Manual Updates

Users can check manually:
- Settings → Check for Updates
- Service worker detects new version
- Prompt user to reload

### Version Management

```typescript
// In any component
import { PwaService } from '@core/services/pwa.service';

constructor(private pwa: PwaService) {}

async checkUpdates() {
  const hasUpdate = await this.pwa.checkForUpdates();
  if (hasUpdate) {
    await this.pwa.activateUpdate();
  }
}
```

## Installation Prompt

### Detect Installation

```typescript
import { InstallPromptService } from '@core/services/install-prompt.service';

constructor(private installPrompt: InstallPromptService) {}

ngOnInit() {
  // Check if app is installed
  if (this.installPrompt.isInstalled()) {
    console.log('App is installed');
  }

  // Listen for install availability
  this.installPrompt.canInstall$.subscribe(canInstall => {
    if (canInstall) {
      // Show custom install button
    }
  });
}
```

### Show Install Prompt

```typescript
async install() {
  const result = await this.installPrompt.showInstallPrompt();

  if (result === 'accepted') {
    console.log('User installed the app');
  }
}
```

## Debugging

### Common Issues

1. **Service worker not registering**
   - Check HTTPS is enabled
   - Verify production build
   - Check browser console for errors

2. **Updates not working**
   - Clear service worker cache
   - Unregister old worker: DevTools → Application → Service Workers → Unregister
   - Hard reload (Ctrl+Shift+R)

3. **Icons not loading**
   - Verify icon files exist in `public/assets/icons/`
   - Check manifest.webmanifest paths
   - Rebuild app

### Clear Service Worker

```typescript
// In browser console
navigator.serviceWorker.getRegistrations()
  .then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
```

## Best Practices

### ✅ Do

- Test on real devices (mobile + desktop)
- Use HTTPS in production
- Cache critical assets
- Provide offline fallback
- Show update notifications
- Version your service worker
- Monitor update success/failure

### ❌ Don't

- Cache authentication tokens in service worker
- Cache large files unnecessarily
- Skip update notifications
- Ignore unrecoverable states
- Cache dynamic content indefinitely
- Use service workers in development

## Performance Optimization

### Cache Strategy Selection

| Content Type | Strategy | Max Age | Use Case |
|--------------|----------|---------|----------|
| Static assets | Prefetch | - | App shell |
| Images/Fonts | Lazy | - | On-demand |
| Dashboard API | Freshness | 1min | Real-time data |
| Config API | Performance | 5min | Stable data |

### Bundle Optimization

```bash
# Analyze bundle size
npm run analyze

# Check what's taking space
# Optimize large dependencies
# Lazy load routes
```

## Monitoring

### Track PWA Metrics

1. **Installation Rate** - How many users install
2. **Update Success** - Update completion rate
3. **Offline Usage** - Service worker hit rate
4. **Cache Performance** - Cache hit/miss ratio

### Analytics Integration

```typescript
// Track PWA installation
window.addEventListener('appinstalled', () => {
  // Send analytics event
  gtag('event', 'pwa_installed');
});
```

## Resources

### Documentation

- [Angular Service Workers](https://angular.dev/ecosystem/service-workers)
- [web.dev PWA Guide](https://web.dev/explore/progressive-web-apps)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### Tools

- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox](https://developers.google.com/web/tools/workbox)

### Testing

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Can I Use - Service Workers](https://caniuse.com/serviceworkers)

## License

Same as main project.
