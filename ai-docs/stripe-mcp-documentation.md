---
url: https://docs.stripe.com/mcp
scraped_date: 2025-08-21
domain: docs.stripe.com
title: Stripe Model Context Protocol (MCP) Documentation
source: Official Stripe Documentation
---

# Stripe Model Context Protocol (MCP) Documentation

## Overview

The Stripe Model Context Protocol (MCP) is a server that enables AI agents to interact with the Stripe API and access Stripe's knowledge base. 

## Key Features

### Remote Server Setup

Stripe hosts an MCP server at `https://mcp.stripe.com` that supports multiple code editors and development environments:

- Supported Clients:
  - Cursor
  - VS Code
  - Claude Code
  - Windsurf
  - CLI

### Authentication Methods

1. OAuth Connections
   - Requires admin installation
   - Can manage OAuth connections in Dashboard settings

2. Bearer Token Authentication
   - Recommended to use "restricted API keys"
   - Example authentication:
     ```bash
     curl https://mcp.stripe.com/ \
       -H "Authorization: Bearer sk_test_[YOUR_KEY]"
     ```

## Available Tools

The MCP provides tools for various Stripe resources:

- Account Management
- Balance Retrieval
- Customer Operations
- Invoice Creation
- Payment Intents
- Subscription Management
- And more...

### Example Tools
- `create_customer`
- `list_invoices`
- `cancel_subscription`
- `search_stripe_resources`

## Local Server Option

Developers can also run a local Stripe MCP server using:
```bash
npx -y @stripe/mcp --tools=all
```

## Security Recommendations

- Use restricted API keys
- Enable human confirmation for tools
- Exercise caution with prompt injection attacks

## Getting Started

1. Choose your development environment
2. Configure MCP server connection
3. Set up API key authentication
4. Start interacting with Stripe resources

## Implementation for UnifiedMCP

### Stripe Integration Architecture

```typescript
// Stripe integration in Cloudflare Workers
import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DB: D1Database;
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});
```

### Subscription Management

```typescript
// Create customer and subscription
async function createSubscription(email: string, priceId: string) {
  const customer = await stripe.customers.create({
    email: email,
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
}
```

### Webhook Handling

```typescript
// Handle Stripe webhooks in Cloudflare Workers
async function handleWebhook(request: Request, env: Env) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object, env);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response('Success', { status: 200 });
}
```

### UnifiedMCP Pricing Tiers

```typescript
// Subscription pricing for UnifiedMCP
const PRICING_TIERS = {
  free: {
    priceId: null,
    monthlyApiCalls: 100,
    features: ['Basic MCP access', '1 OAuth connection']
  },
  pro: {
    priceId: 'price_pro_monthly',
    monthlyApiCalls: 10000,
    features: ['Full MCP access', 'Unlimited OAuth connections', 'Priority support']
  },
  enterprise: {
    priceId: 'price_enterprise_monthly',
    monthlyApiCalls: 100000,
    features: ['Enterprise MCP access', 'Custom integrations', 'Dedicated support']
  }
};
```

### Usage Tracking and Billing

```typescript
// Track API usage for billing
async function trackUsage(userId: string, toolName: string, env: Env) {
  // Log usage in D1
  await env.DB.prepare(
    "INSERT INTO usage_logs (user_id, tool_name, timestamp) VALUES (?, ?, ?)"
  ).bind(userId, toolName, new Date().toISOString()).run();

  // Check if user has exceeded limits
  const usage = await getCurrentMonthUsage(userId, env);
  const userTier = await getUserTier(userId, env);
  
  if (usage.apiCalls >= PRICING_TIERS[userTier].monthlyApiCalls) {
    throw new Error('API limit exceeded. Please upgrade your subscription.');
  }
}
```

### Customer Portal Integration

```typescript
// Create Stripe customer portal session
async function createPortalSession(customerId: string) {
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'https://your-unifiedmcp-domain.com/dashboard',
  });

  return portalSession.url;
}
```

## Security Best Practices

### API Key Management
- Use restricted API keys with minimal required permissions
- Store keys securely in Cloudflare Workers secrets
- Rotate keys regularly

### Webhook Security
- Verify webhook signatures
- Use HTTPS endpoints only
- Implement idempotency for webhook handlers

### Payment Security
- Never store payment method details
- Use Stripe's secure tokenization
- Implement proper error handling

## Testing Strategy

### Test Mode
- Use Stripe test keys during development
- Test webhook endpoints with Stripe CLI
- Validate subscription flows end-to-end

```bash
# Test webhook locally
stripe listen --forward-to localhost:8788/webhooks/stripe
```

## Production Considerations

### Monitoring
- Track payment success/failure rates
- Monitor subscription churn
- Alert on webhook failures

### Compliance
- PCI DSS compliance handled by Stripe
- GDPR compliance for customer data
- Data retention policies

## Additional Resources

- [Build with LLMs on Stripe](/building-with-llms)
- [Agentic Workflows](/agents)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)