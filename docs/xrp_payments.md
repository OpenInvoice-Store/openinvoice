# XRP Payments - Complete Guide

## ✅ Implementation Complete

The XRP payment system is now ready for both **development** and **production** testing!

---

## 🎯 Three Testing Modes

### 1. **Test Mode** (Fastest - Development)
**Purpose**: Simulate transactions instantly without blockchain

**Setup**:
```env
CRYPTO_TEST_MODE=true
```

**How to Test**:
1. Enable in `.env.local`
2. Restart server
3. Enable crypto payments in settings
4. Add any test XRP addresses
5. Create payment → Wait 5 seconds → Transaction appears!
6. Confirmations increase automatically every 10 seconds

**Perfect for**: UI development, quick testing, demos

---

### 2. **Testnet Mode** (Realistic - Development)
**Purpose**: Test with real XRPL but no real money

**Setup**:
```env
CRYPTO_USE_TESTNET=true
# Or automatically enabled when NODE_ENV=development
```

**How to Test**:
1. Get XRP testnet addresses (XRPL Testnet/Devnet)
2. Get free testnet XRP from faucets
3. Add addresses to settings
4. Send testnet XRP → Real blockchain detection

**Perfect for**: Integration testing, XRPL API testing

---

### 3. **Production Mode** (Real - Production)
**Purpose**: Real payments with real XRP

**Setup**:
```env
CRYPTO_TEST_MODE=false
CRYPTO_USE_TESTNET=false
NODE_ENV=production
```

**How to Test**:
1. Add real XRP wallet addresses
2. Send small test amounts ($1-5)
3. Monitor payment status
4. Verify invoice updates

**Perfect for**: Final verification, production readiness

---

## 🚀 Quick Start Testing

### Step 1: Enable Test Mode
```bash
# Add to .env.local
echo "CRYPTO_TEST_MODE=true" >> .env.local
```

### Step 2: Configure Settings
1. Go to: `/dashboard/settings/payments`
2. Enable "Crypto Payments"
3. Add test XRP addresses (any format works in test mode)
4. Save

### Step 3: Test Payment
1. Create invoice
2. Click "Pay with Crypto"
3. Select XRP
4. **Wait 5 seconds** → Transaction appears!
5. Watch confirmations increase
6. Payment confirms automatically

---

## 📍 Where to Test

### Settings Page
**URL**: `/dashboard/settings/payments`

**What you can do**:
- Enable/disable crypto payments
- Add XRP wallet addresses
- Generate new XRP addresses (testnet/mainnet)
- Configure confirmations (XRP only needs 1 confirmation)
- Set address reuse settings

### Invoice Payment
**URL**: `/dashboard/invoices/[id]/payments` or invoice share link

**What you can do**:
- Create XRP payment
- View QR code
- Copy XRP address
- Monitor payment status
- See confirmations progress

---

## 🧪 Test Mode Features

When `CRYPTO_TEST_MODE=true`:

✅ **Automatic Transaction Simulation**
- Transaction appears after 5 seconds
- No real blockchain calls
- No real funds needed

✅ **Simulated Confirmations**
- Starts at 0 confirmations
- Increases by 1 every 10 seconds
- Maximum 6 confirmations (XRP only needs 1 in production)

✅ **Visual Indicators**
- Yellow "TEST MODE" alert banner
- "TEST" badge on payment amount
- Console logs for debugging

✅ **Test Transaction Hash**
- Format: `test_[timestamp]_[random]`
- Not a real blockchain transaction
- Explorer links show `#test-transaction-[hash]`

---

## 🌐 Testnet Features

When `CRYPTO_USE_TESTNET=true`:

✅ **XRPL Testnet/Devnet**
- Uses `wss://s.altnet.rippletest.net:51233` WebSocket
- Uses XRPL Testnet API
- Explorer: `https://testnet.xrpl.org/transactions/[hash]`
- Faucet available for free testnet XRP

✅ **Visual Indicators**
- Blue "TESTNET" badge
- Testnet explorer links

---

## 📊 Overview

The XRP payment system allows organizations to accept payments in XRP directly on invoices. It includes:

- **Exchange Rate Conversion**: Uses CoinGecko API to convert fiat amounts to XRP
- **Address Management**: Rotates through multiple XRP wallet addresses
- **Real-time Monitoring**: Uses WebSocket to monitor XRPL for incoming transactions
- **Payment Confirmation**: Tracks confirmations and updates invoice status automatically
- **Fast Confirmations**: XRP transactions finalize in 3-5 seconds (only 1 confirmation needed)

---

## 🗄️ Database Schema

### Models

1. **CryptoPayment**: Stores XRP payment details
   - Links to Payment model
   - Tracks cryptocurrency (XRP), amount, address, transaction hash
   - Monitors confirmations and status

2. **CryptoAddressUsage**: Tracks address usage for rotation
   - Prevents address reuse within cooldown period
   - Enables address rotation

### Organization Fields

- `cryptoPaymentsEnabled`: Enable/disable crypto payments
- `cryptoWallets`: JSON object storing XRP addresses
- `cryptoMinConfirmations`: Minimum confirmations required (default: 3, but XRP only needs 1)
- `stopReusingAddresses`: Don't reuse addresses (for privacy)
- `addressReuseCooldownHours`: Hours before reusing address (default: 24)

---

## 📁 Implementation Files

### Services

1. **`src/lib/crypto/coingecko.ts`**
   - CoinGecko API integration
   - Exchange rate conversion (fiat → XRP)

2. **`src/lib/crypto/address-management.ts`**
   - XRP address selection and rotation
   - Tracks address usage
   - Prevents reuse within cooldown period

3. **`src/lib/crypto/xrp-websocket.ts`**
   - Real-time XRPL WebSocket monitoring
   - Detects incoming XRP transactions instantly
   - Falls back to polling if WebSocket fails

4. **`src/lib/crypto/xrp-account-generator.ts`**
   - Generates new XRP addresses
   - Uses XRPL testnet faucet (testnet only)
   - Creates wallets for mainnet

### API Endpoints

1. **`src/app/api/payments/crypto/create/route.ts`**
   - Creates XRP payment request
   - Converts fiat to XRP amount
   - Generates/selects payment address
   - Returns QR code data and payment details

2. **`src/app/api/payments/crypto/check/route.ts`**
   - Checks payment status on XRPL
   - Updates confirmations
   - Confirms payment when threshold reached (1 confirmation for XRP)
   - Updates invoice status automatically

3. **`src/app/api/organizations/crypto/route.ts`**
   - Get/update crypto settings
   - Generate new XRP addresses
   - Add XRP addresses to organization

### Frontend Components

1. **`src/features/invoicing/components/crypto-payment-form.tsx`**
   - XRP payment form component
   - QR code display
   - Address display with copy button
   - Real-time confirmation status
   - WebSocket monitoring with polling fallback

---

## 🛠️ Setup Instructions

### 1. Database Migration

Run the Prisma migration to add the new tables:

```bash
npx prisma migrate dev --name add_crypto_payments
```

### 2. Environment Variables

Add to your `.env` file:

```env
# CoinGecko API (optional - free tier works without key)
COINGECKO_API_KEY=
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# Testing Configuration
CRYPTO_TEST_MODE=false          # Enable simulated transactions
CRYPTO_USE_TESTNET=false        # Use XRPL testnet/devnet
```

### 3. Install Dependencies

```bash
npm install xrpl qrcode @types/qrcode
```

### 4. Configure Organization Settings

Enable XRP payments for an organization:

1. Go to Organization Settings → Payment Processing
2. Enable "Crypto Payments"
3. Add XRP wallet addresses:
   ```json
   {
     "xrp": ["rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH", "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"]
   }
   ```
4. Or generate new addresses using the "Generate XRP Address" button
5. Set minimum confirmations (default: 3, but XRP only needs 1)
6. Configure address reuse settings

---

## 💡 Usage

### For Customers

1. View invoice
2. Click "Pay with Crypto"
3. Select XRP
4. Scan QR code or copy XRP address
5. Send XRP payment to displayed address
6. System automatically detects payment (via WebSocket)
7. Invoice updates when transaction is confirmed (3-5 seconds)

### For Organizations

1. Enable XRP payments in settings
2. Add XRP wallet addresses (or generate new ones)
3. Configure confirmation requirements (1 confirmation recommended for XRP)
4. Monitor payments in payment history
5. View transaction hashes and XRPL explorer links

---

## 🔄 Payment Flow

```
1. Customer clicks "Pay with Crypto"
   ↓
2. Select XRP
   ↓
3. System calculates XRP amount (CoinGecko)
   ↓
4. System selects/rotates XRP address
   ↓
5. Display QR code and XRP address
   ↓
6. Customer sends XRP
   ↓
7. System monitors XRPL via WebSocket (real-time)
   ↓
8. Transaction detected instantly
   ↓
9. Confirmations tracked (XRP only needs 1)
   ↓
10. Payment confirmed (when threshold reached)
   ↓
11. Invoice status updated
   ↓
12. Confirmation email sent
```

---

## 🔒 Security Considerations

1. **Address Expiration**: Addresses expire after 24 hours
2. **Amount Validation**: Verifies received amount matches expected
3. **Underpayment Handling**: Detects and flags underpayments
4. **Confirmation Requirements**: XRP only needs 1 confirmation (transactions finalize in 3-5 seconds)
5. **Private Keys**: If generating addresses, store seed securely

---

## 📋 Testing Checklist

### Payment Creation
- [ ] Can create XRP payment
- [ ] Exchange rate calculated correctly
- [ ] XRP address displayed
- [ ] QR code generated
- [ ] Test mode indicator shows (if enabled)
- [ ] Payment saved to database

### Payment Detection
- [ ] Transaction detected (test: 5s, real: via WebSocket)
- [ ] Confirmations tracked
- [ ] Status updates correctly
- [ ] Transaction hash stored

### Payment Confirmation
- [ ] Confirms at minimum confirmations (1 for XRP)
- [ ] Invoice status → "paid"
- [ ] Payment in history
- [ ] Email sent (if configured)

### Error Handling
- [ ] Expired payments handled
- [ ] Underpaid payments detected
- [ ] Invalid XRP addresses rejected
- [ ] Network errors handled gracefully
- [ ] WebSocket fallback to polling works

---

## 🔍 Debugging

### Check Test Mode Status
```bash
# In browser console
fetch('/api/payments/crypto/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceId: 'your-id',
    cryptocurrency: 'xrp',
    amount: 10
  })
}).then(r => r.json()).then(d => console.log('Test Mode:', d.testMode));
```

### Check Database
```sql
-- Latest XRP payment
SELECT * FROM crypto_payments ORDER BY "createdAt" DESC LIMIT 1;

-- Payment status
SELECT status, confirmations, "minConfirmations", "transactionHash" 
FROM crypto_payments 
WHERE id = 'your-payment-id';
```

### Check Logs
- Browser console: Client-side errors, WebSocket connection status
- Server logs: API errors, XRPL calls
- Network tab: API request/response

---

## 🎓 Example Test Scenarios

### Scenario 1: Instant Test (Test Mode)
```env
CRYPTO_TEST_MODE=true
```
1. Create payment
2. Wait 5 seconds
3. Transaction appears
4. Confirmations increase
5. Payment confirms

**Time**: ~1 minute total

---

### Scenario 2: Realistic Test (XRPL Testnet)
```env
CRYPTO_USE_TESTNET=true
CRYPTO_TEST_MODE=false
```
1. Generate XRP testnet address (via API or settings)
2. Get testnet XRP from faucet: https://xrpl.org/xrp-testnet-faucet.html
   - Or use the included `test-send-xrp.html` tool to generate sender account
3. Create payment in your invoice
4. Send testnet XRP using `test-send-xrp.html` tool or any XRPL wallet
5. Wait for detection (~3-5 seconds via WebSocket)
6. Confirmations tracked
7. Payment confirms

**Time**: ~5-10 minutes

**Tip**: Use `test-send-xrp.html` for easy testnet payment sending - see [Test XRP Payment Tool](#-test-xrp-payment-tool) section below.

---

### Scenario 3: Production Test
```env
CRYPTO_TEST_MODE=false
CRYPTO_USE_TESTNET=false
```
1. Add real XRP addresses
2. Create payment
3. Send small real amount ($1-5 worth of XRP)
4. Wait for detection (~3-5 seconds)
5. Monitor confirmations
6. Verify invoice updates

**Time**: ~5-10 minutes (XRP is fast!)

---

## 🌐 XRPL Testnet Setup

### Get Testnet XRP

1. **Generate Testnet Address**:
   - Use Settings → Payment Processing → "Generate XRP Address" (with faucet enabled)
   - Or use XRPL Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html

2. **Testnet Explorer**:
   - https://testnet.xrpl.org/

3. **Testnet WebSocket**:
   - `wss://s.altnet.rippletest.net:51233`

---

## 🧪 Test XRP Payment Tool

A convenient HTML testing tool is included to help you send test XRP payments during development.

### Location
**File**: `test-send-xrp.html` (in project root)

### How to Use

1. **Open the HTML file**:
   ```bash
   # Open in browser
   open test-send-xrp.html
   # Or navigate to: file:///path/to/openinvoice/test-send-xrp.html
   ```

2. **Step 1: Get Sender Account**:
   - Enter a seed (secret key) if you have one, or leave empty
   - Click "Get Account Info / Generate New"
   - If empty, it will generate a new testnet account from the faucet automatically
   - Copy the generated seed for future use

3. **Step 2: Send Payment**:
   - Go to your app: Settings → Payment Processing
   - Generate a testnet XRP address (or use an existing one)
   - Copy the generated address
   - Paste it in the "Destination Address" field in the HTML tool
   - Enter the amount to send (in XRP)
   - Click "Send XRP"

4. **Verify Payment**:
   - The transaction will be submitted to XRPL Testnet
   - Check your invoice payment form - the WebSocket should detect the transaction automatically!
   - Transaction details (hash, ledger index, balance changes) will be displayed

### Features

✅ **Automatic Account Generation**: Creates testnet accounts from faucet  
✅ **Real-time Connection Status**: Shows WebSocket connection to XRPL Testnet  
✅ **Transaction Details**: Displays full transaction information  
✅ **Balance Tracking**: Shows sender balance before and after transaction  
✅ **Error Handling**: Clear error messages if something goes wrong  

### Use Cases

- **Testing WebSocket Detection**: Verify that your payment monitoring detects transactions
- **Testing Payment Flow**: End-to-end testing of the payment process
- **Debugging**: Check transaction details and balance changes
- **Development**: Quick way to send test payments without using external tools

### Requirements

- Modern browser with JavaScript enabled
- Internet connection (connects to XRPL Testnet)
- XRPL.js library (loaded from CDN automatically)

### Example Workflow

```
1. Open test-send-xrp.html in browser
2. Generate sender account (or use existing seed)
3. In your app: Generate XRP address in settings
4. Copy generated address to HTML tool
5. Enter amount (e.g., 10 XRP)
6. Click "Send XRP"
7. Check invoice payment form - payment should appear automatically!
```

---

## 📝 API Reference

### Create XRP Payment

```typescript
POST /api/payments/crypto/create
{
  invoiceId: string;
  cryptocurrency: 'xrp';
  amount?: number; // Optional, defaults to remaining balance
}

Response:
{
  paymentId: string;
  cryptoPaymentId: string;
  cryptocurrency: 'xrp';
  cryptoAmount: string;
  address: string;
  qrCode: string;
  expiresAt: string;
  minConfirmations: number;
  exchangeRate: number;
  testMode: boolean;
}
```

### Check Payment Status

```typescript
POST /api/payments/crypto/check
{
  paymentId: string; // cryptoPaymentId
  actualCryptoAmount?: string; // Optional, from WebSocket
  transactionHash?: string; // Optional, from WebSocket
}

Response:
{
  status: 'pending' | 'confirmed' | 'underpaid' | 'expired';
  confirmed: boolean;
  confirmations: number;
  minConfirmations: number;
  transactionHash?: string;
}
```

### Generate XRP Address

```typescript
POST /api/organizations/crypto
{
  useFaucet?: boolean; // Use testnet faucet (testnet only)
}

Response:
{
  success: true;
  account: {
    address: string;
    seed: string; // Save securely!
    balance: string;
    funded: boolean;
  };
  warning: string;
}
```

---

## 🚨 Troubleshooting

### Payment Not Detected

1. Check XRP address is correct
2. Verify transaction on XRPL explorer: https://xrpl.org/explorer.html
3. Check if payment amount matches (within 1% tolerance)
4. Ensure payment was sent after payment creation
5. Check WebSocket connection status in browser console
6. Verify WebSocket fallback to polling is working

### Address Issues

1. Verify XRP addresses are valid (starts with `r`)
2. Check address format matches XRPL standard
3. Ensure addresses are added in organization settings
4. For testnet, verify addresses are testnet addresses

### Exchange Rate Issues

1. CoinGecko API may be rate-limited (free tier: 10-50 calls/min)
2. Consider adding API key for higher limits
3. Verify XRP is supported (coin ID: `ripple`)

### WebSocket Issues

1. Check browser console for WebSocket connection errors
2. System automatically falls back to polling if WebSocket fails
3. Verify XRPL testnet/mainnet endpoints are accessible
4. Check network connectivity

---

## ✅ Production Checklist

Before going to production:

- [ ] `CRYPTO_TEST_MODE=false`
- [ ] `CRYPTO_USE_TESTNET=false`
- [ ] Real XRP wallet addresses added
- [ ] Minimum confirmations set to 1 (XRP only needs 1)
- [ ] Address reuse settings configured
- [ ] Exchange rate API key added (if needed)
- [ ] Tested with small real amounts
- [ ] Monitoring set up
- [ ] Error alerts configured
- [ ] WebSocket monitoring verified
- [ ] Polling fallback tested

---

## 🎉 You're Ready!

The XRP payment system is production-ready with full testing support. Start with **Test Mode** for instant testing, then move to **XRPL Testnet** for realistic testing, and finally **Production** when ready!

**Key Advantages of XRP**:
- ⚡ Fast: Transactions finalize in 3-5 seconds
- 💰 Low fees: Minimal transaction costs
- ✅ Final: Only 1 confirmation needed
- 🔄 Real-time: WebSocket monitoring for instant detection

---

## 📚 Additional Resources

- XRPL Documentation: https://xrpl.org/
- XRPL Explorer: https://xrpl.org/explorer.html
- XRPL Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html
- CoinGecko API: https://www.coingecko.com/en/api

