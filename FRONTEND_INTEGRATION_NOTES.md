# Frontend Integration Notes
## React CRM Updates (Optional)

**Priority:** 🟡 Medium (Not blocking n8n workflows)
**Effort:** Low to Medium

---

## What Needs Updates?

### 1. **Lead Creation Form** (Optional but Recommended)

**Where:** Lead creation/registration forms
**Why:** Capture marketing attribution data

**Add Hidden Fields:**
```jsx
// src/components/LeadForm.jsx or similar

import { useEffect, useState } from 'react';

function LeadForm() {
  const [sourceData, setSourceData] = useState({
    ref_source: null,
    utm_campaign: null,
    utm_source: null,
    utm_medium: null,
    utm_content: null,
    utm_term: null,
    referrer_url: null,
    landing_page: null,
    device_type: null,
    browser: null
  });

  useEffect(() => {
    // Capture UTM parameters from URL
    const params = new URLSearchParams(window.location.search);

    // Detect device type
    const deviceType = /mobile/i.test(navigator.userAgent) ? 'mobile' :
                       /tablet/i.test(navigator.userAgent) ? 'tablet' : 'desktop';

    // Detect browser
    const browser = navigator.userAgent.match(/(firefox|msie|chrome|safari)/i)?.[0]?.toLowerCase() || 'unknown';

    setSourceData({
      ref_source: params.get('source') || localStorage.getItem('ref_source'),
      utm_campaign: params.get('utm_campaign'),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
      referrer_url: document.referrer || null,
      landing_page: window.location.pathname,
      device_type: deviceType,
      browser: browser
    });

    // Store in localStorage for future use
    if (params.get('source')) {
      localStorage.setItem('ref_source', params.get('source'));
    }
  }, []);

  const handleSubmit = async (leadData) => {
    // Combine lead data with source tracking
    const payload = {
      ...leadData,
      ...sourceData
    };

    // Send to Supabase
    const { data, error } = await supabase.rpc('get_or_create_lead_by_phone', {
      phone_input: payload.phone,
      org_id_input: payload.organization_id,
      ref_source_input: payload.ref_source,
      utm_campaign_input: payload.utm_campaign,
      utm_source_input: payload.utm_source,
      utm_medium_input: payload.utm_medium,
      source_metadata_input: {
        utm_content: payload.utm_content,
        utm_term: payload.utm_term,
        referrer_url: payload.referrer_url,
        landing_page: payload.landing_page,
        device_type: payload.device_type,
        browser: payload.browser
      }
    });

    if (error) console.error('Error creating lead:', error);
    return data;
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your existing form fields */}

      {/* Hidden fields for source tracking */}
      <input type="hidden" name="ref_source" value={sourceData.ref_source || ''} />
      <input type="hidden" name="utm_campaign" value={sourceData.utm_campaign || ''} />
      {/* ... other hidden fields ... */}
    </form>
  );
}
```

---

### 2. **Analytics Dashboard** (Optional)

**Where:** Dashboard or Analytics page
**Why:** Show marketing attribution insights

**Add Source Analytics Card:**
```jsx
// src/components/SourceAnalytics.jsx

import { useEffect, useState } from 'react';
import { Card } from './ui/card';

function SourceAnalytics() {
  const [analytics, setAnalytics] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const { data } = await supabase
      .from('lead_source_analytics')
      .select('*')
      .order('total_leads', { ascending: false })
      .limit(10);

    setAnalytics(data || []);
  };

  return (
    <Card>
      <h3>Lead Sources Performance</h3>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Campaign</th>
            <th>Total</th>
            <th>Converted</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {analytics.map((row) => (
            <tr key={`${row.ref_source}-${row.utm_campaign}`}>
              <td>{row.ref_source || 'Unknown'}</td>
              <td>{row.utm_campaign || 'N/A'}</td>
              <td>{row.total_leads}</td>
              <td>{row.converted_leads}</td>
              <td>{row.conversion_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

**Add to Dashboard:**
```jsx
// src/pages/Dashboard.tsx
import SourceAnalytics from '@/components/SourceAnalytics';

function Dashboard() {
  return (
    <div>
      {/* Existing dashboard content */}
      <SourceAnalytics />
    </div>
  );
}
```

---

### 3. **Push Notifications (PWA)** (Optional)

**Where:** Settings page or Navbar
**Why:** Enable push notifications for admins

#### Step 1: Create Service Worker

```javascript
// public/service-worker.js

self.addEventListener('push', (event) => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.action_url || '/',
      notification_id: data.notification_id
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
```

#### Step 2: Register Service Worker

```jsx
// src/utils/pushNotifications.ts

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('Service Worker registered');
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function subscribeToPushNotifications(adminId: string) {
  const registration = await registerServiceWorker();
  if (!registration) return false;

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return false;
  }

  // Get VAPID public key from environment
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  // Save subscription to Supabase
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({
      admin_id: adminId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
      },
      user_agent: navigator.userAgent,
      device_name: getDeviceName()
    });

  if (error) {
    console.error('Failed to save subscription:', error);
    return false;
  }

  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'Mobile';
  if (/tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
}
```

#### Step 3: Add Enable Button

```jsx
// src/components/NotificationSettings.tsx

import { useState } from 'react';
import { Button } from './ui/button';
import { subscribeToPushNotifications } from '@/utils/pushNotifications';

function NotificationSettings({ adminId }: { adminId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    const success = await subscribeToPushNotifications(adminId);
    setEnabled(success);
    setLoading(false);

    if (success) {
      alert('Push notifications enabled!');
    } else {
      alert('Failed to enable push notifications');
    }
  };

  return (
    <div>
      <h3>Push Notifications</h3>
      <p>Get real-time alerts for hot leads and important events</p>
      <Button onClick={handleEnable} disabled={loading || enabled}>
        {enabled ? '✅ Enabled' : 'Enable Push Notifications'}
      </Button>
    </div>
  );
}
```

---

### 4. **Organization Admin Panel** (Optional, Advanced)

**Where:** New admin page or settings section
**Why:** Manage organization settings, view usage, invite users

**Key Components:**

#### Organization Stats Card
```jsx
// src/components/OrganizationStats.tsx

import { useEffect, useState } from 'react';
import { Card } from './ui/card';

function OrganizationStats({ orgId }: { orgId: string }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [orgId]);

  const fetchStats = async () => {
    const { data } = await supabase.rpc('get_organization_stats', {
      p_organization_id: orgId
    });
    setStats(data);
  };

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <h4>Leads</h4>
        <p className="text-3xl">{stats.leads.total}</p>
        <p className="text-sm text-gray-500">
          {stats.leads.hot} hot, {stats.leads.this_month} this month
        </p>
      </Card>

      <Card>
        <h4>Revenue</h4>
        <p className="text-3xl">₹{stats.payments.total_amount.toLocaleString()}</p>
        <p className="text-sm text-gray-500">
          ₹{stats.payments.this_month.toLocaleString()} this month
        </p>
      </Card>

      <Card>
        <h4>Admins</h4>
        <p className="text-3xl">{stats.admins.active}/{stats.admins.total}</p>
        <p className="text-sm text-gray-500">Active users</p>
      </Card>

      <Card>
        <h4>Messages</h4>
        <p className="text-3xl">{stats.messages.total}</p>
        <p className="text-sm text-gray-500">
          {stats.messages.today} today
        </p>
      </Card>
    </div>
  );
}
```

#### Usage Limits Warning
```jsx
// src/components/UsageLimits.tsx

import { useEffect, useState } from 'react';
import { Alert } from './ui/alert';

function UsageLimits({ orgId }: { orgId: string }) {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [orgId]);

  const fetchAnalytics = async () => {
    const { data } = await supabase
      .from('organization_analytics')
      .select('*')
      .eq('organization_id', orgId)
      .single();
    setAnalytics(data);
  };

  if (!analytics) return null;

  const showLeadWarning = analytics.lead_usage_percent > 80;
  const showAdminWarning = analytics.admin_usage_percent > 80;

  return (
    <div className="space-y-2">
      {showLeadWarning && (
        <Alert variant="warning">
          ⚠️ You've used {analytics.lead_usage_percent}% of your lead limit.
          Consider upgrading your plan.
        </Alert>
      )}

      {showAdminWarning && (
        <Alert variant="warning">
          ⚠️ You've used {analytics.admin_usage_percent}% of your admin limit.
        </Alert>
      )}
    </div>
  );
}
```

---

## Environment Variables

Add to `.env`:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Push Notifications (Optional)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key

# OpenAI (for AI features, optional)
VITE_OPENAI_API_KEY=your-openai-key
```

---

## Testing Changes

### Test Lead Creation with Source
```javascript
// Test in browser console
const leadData = {
  phone: '+919999999999',
  parent_name: 'Test Parent',
  student_name: 'Test Student',
  ref_source: 'test_web',
  utm_campaign: 'frontend_test',
  utm_source: 'manual',
  utm_medium: 'web'
};

const { data, error } = await supabase.rpc('get_or_create_lead_by_phone', {
  phone_input: leadData.phone,
  ref_source_input: leadData.ref_source,
  utm_campaign_input: leadData.utm_campaign
});

console.log('Created lead:', data);
```

### Test Push Notifications
```javascript
// Test notification permission
const permission = await Notification.requestPermission();
console.log('Permission:', permission);

// Test browser notification
new Notification('Test', {
  body: 'This is a test notification',
  icon: '/favicon.ico'
});
```

---

## Priority Order

### Must-Have (Now)
1. ✅ Lead source tracking on lead creation
   - Simple hidden fields
   - Capture UTM parameters
   - ~30 minutes work

### Should-Have (This Week)
2. 📊 Analytics dashboard card
   - Show top sources
   - Conversion rates
   - ~2 hours work

### Nice-to-Have (This Month)
3. 🔔 Push notifications
   - Service worker setup
   - Enable toggle
   - ~4 hours work

4. 👥 Organization admin panel
   - Stats cards
   - Usage limits
   - ~1 day work

---

## Implementation Timeline

| Task | Priority | Effort | When |
|------|----------|--------|------|
| Lead source tracking | High | 30 min | Now |
| Analytics card | Medium | 2 hours | This week |
| Push notifications | Low | 4 hours | This month |
| Admin panel | Low | 1 day | Later |

---

## Notes

- **Most features work without frontend changes** (n8n handles them)
- **Frontend updates are optional enhancements**
- **Start with lead source tracking** (highest ROI, lowest effort)
- **PWA push can wait** (n8n email processor works fine meanwhile)

---

## Support

Need help? Check:
- React + Supabase docs: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- PWA push notifications: https://web.dev/push-notifications/
- Service workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---

**Start Small!**
Add source tracking first, then expand based on needs. 🚀
