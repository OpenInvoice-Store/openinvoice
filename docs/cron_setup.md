# Payment Reminders Cron Job Setup

This guide explains how to set up automated payment reminders using cron jobs. The system supports multiple cron service providers, but we recommend using **GitHub Actions** for free and reliable scheduling.

## Overview

The payment reminders system automatically sends reminder emails to customers for:
- **Upcoming invoices** (3 days before due date)
- **Due today** (on the due date)
- **Overdue invoices** (7 days, 14 days, and 30+ days after due date)

The cron endpoint is located at: `/api/cron/reminders`

## GitHub Actions (Recommended)

GitHub Actions is free for public repositories and provides 2,000 minutes/month for private repositories, which is more than enough for daily cron jobs.

### Setup Steps

1. **Create the workflow file** (already created at `.github/workflows/payment-reminders.yml`)

2. **Set up GitHub Secrets**:
   - Go to your GitHub repository
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret** and add:
     
     **`APP_URL`**
     - Value: Your production URL (e.g., `https://yourdomain.com`)
     - Example: `https://myinvoiceapp.vercel.app`
     
     **`CRON_SECRET`**
     - Value: A secure random string (generate with: `openssl rand -hex 32`)
     - This should match the `CRON_SECRET` in your app's environment variables
     - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

3. **Set CRON_SECRET in your app**:
   - Add to your `.env.local` (local) or environment variables (production):
     ```env
     CRON_SECRET=your-secret-key-here
     ```
   - **Important**: Use the same value in both GitHub Secrets and your app

4. **Customize the schedule** (optional):
   - Edit `.github/workflows/payment-reminders.yml`
   - Change the cron expression:
     ```yaml
     - cron: '0 9 * * *'  # Daily at 9:00 AM UTC
     ```
   
   Common schedules:
   - `'0 9 * * *'` - Daily at 9:00 AM UTC
   - `'0 9 * * 1-5'` - Weekdays only at 9:00 AM UTC
   - `'0 9,15 * * *'` - Twice daily at 9 AM and 3 PM UTC
   - `'0 */6 * * *'` - Every 6 hours
   - `'0 0 * * 0'` - Weekly on Sunday at midnight UTC

5. **Test the workflow**:
   - Go to **Actions** tab in GitHub
   - Select **Payment Reminders Cron**
   - Click **Run workflow** → **Run workflow** (manual trigger)
   - Check the logs to verify it's working

### Timezone Considerations

GitHub Actions uses UTC time. To adjust for your timezone:
- **EST (UTC-5)**: 9 AM EST = 2 PM UTC → Use `'0 14 * * *'`
- **PST (UTC-8)**: 9 AM PST = 5 PM UTC → Use `'0 17 * * *'`
- **CET (UTC+1)**: 9 AM CET = 8 AM UTC → Use `'0 8 * * *'`

## Alternative Cron Services

While we use GitHub Actions, you can use any cron service that can make HTTP requests.

### Option 1: EasyCron

1. Sign up at [EasyCron.com](https://www.easycron.com)
2. Create a new cron job:
   - **URL**: `https://yourdomain.com/api/cron/reminders`
   - **Method**: GET
   - **Headers**: 
     - `Authorization: Bearer YOUR_CRON_SECRET`
     - `Content-Type: application/json`
   - **Schedule**: Daily at your preferred time
3. Free tier: 1 cron job, runs every 5 minutes minimum

### Option 2: Cron-job.org

1. Sign up at [Cron-job.org](https://cron-job.org)
2. Create a new job:
   - **URL**: `https://yourdomain.com/api/cron/reminders`
   - **Schedule**: Daily
   - **HTTP Header**: 
     - Name: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET`
3. Free tier: 2 cron jobs, runs every 1 minute minimum

### Option 3: Vercel Cron (Paid Plans Only)

If you're on Vercel Pro or higher, you can use Vercel Cron:

1. Create `vercel.json` in your project root:
   ```json
   {
     "crons": [{
       "path": "/api/cron/reminders",
       "schedule": "0 9 * * *"
     }]
   }
   ```

2. Deploy to Vercel
3. Vercel will automatically set up the cron job

**Note**: Vercel Cron is only available on paid plans. Free tier users should use GitHub Actions.

### Option 4: GitHub Actions (Our Choice)

As documented above, this is what we use and recommend for free tier users.

## Security

The cron endpoint is protected by a secret token:

1. **Set `CRON_SECRET`** in your environment variables
2. **Include it in the Authorization header** when calling the endpoint:
   ```
   Authorization: Bearer YOUR_CRON_SECRET
   ```

If `CRON_SECRET` is not set, the endpoint will allow access (for development only). **Always set it in production.**

## Testing

### Manual Testing

You can test the cron endpoint manually:

```bash
curl -X GET "https://yourdomain.com/api/cron/reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "processed": 5,
  "sent": 5,
  "failed": 0,
  "results": [...]
}
```

### Testing with Query Parameters

The cron endpoint supports query parameters for flexible testing:

#### Test Invoices Due in X Days

Test reminders for invoices due in a specific number of days:

```bash
# Test invoices due in 2 days
curl -X GET "https://yourdomain.com/api/cron/reminders?testDays=2" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test invoices due in 5 days
curl -X GET "https://yourdomain.com/api/cron/reminders?testDays=5" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Test Overdue Invoices

Test reminders for invoices that are a specific number of days overdue:

```bash
# Test invoices 4 days overdue
curl -X GET "https://yourdomain.com/api/cron/reminders?testOverdue=4" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test invoices 10 days overdue
curl -X GET "https://yourdomain.com/api/cron/reminders?testOverdue=10" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Debug Mode

See detailed information about what invoices were found and why:

```bash
curl -X GET "https://yourdomain.com/api/cron/reminders?debug=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Debug response includes:
- Date ranges used for matching
- Number of invoices found in each category
- Detailed invoice information (IDs, due dates, reminder counts, etc.)

#### Send All Mode (Flexible Matching)

Send reminders to all matching invoices using flexible date ranges instead of exact matches. This is useful for testing or catching up on missed reminders:

```bash
# Send to all invoices that should receive reminders (flexible matching)
curl -X GET "https://yourdomain.com/api/cron/reminders?sendAll=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# With debug to see what was found
curl -X GET "https://yourdomain.com/api/cron/reminders?sendAll=true&debug=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**How `sendAll` works:**
- **Upcoming reminders**: Sends to invoices due in the next 7 days (instead of exactly 3 days)
- **Overdue reminders**: Uses range-based matching:
  - 1-7 days overdue: First reminder (if no reminder in last 3 days)
  - 8-14 days overdue: Second reminder (if no reminder in last 7 days)
  - 15-29 days overdue: Third reminder (if no reminder in last 7 days)
  - 30+ days overdue: Final notice (if no reminder in last 7 days)

This ensures all invoices that need reminders get them, even if they don't match exact dates.

#### Dry Run Mode

Test without actually sending emails or updating the database:

```bash
curl -X GET "https://yourdomain.com/api/cron/reminders?dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Combine Parameters

You can combine multiple parameters:

```bash
# Test 2 days + debug + dry run
curl -X GET "https://yourdomain.com/api/cron/reminders?testDays=2&debug=true&dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test overdue + debug
curl -X GET "https://yourdomain.com/api/cron/reminders?testOverdue=5&debug=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Send all matching invoices with debug (most flexible)
curl -X GET "https://yourdomain.com/api/cron/reminders?sendAll=true&debug=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Dry run + send all + debug (see what would be sent)
curl -X GET "https://yourdomain.com/api/cron/reminders?sendAll=true&debug=true&dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Testing Locally

For local testing, you can call the endpoint directly:

```bash
# Without secret (development)
curl http://localhost:3000/api/cron/reminders

# With secret (production-like)
curl http://localhost:3000/api/cron/reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test with parameters
curl "http://localhost:3000/api/cron/reminders?testDays=2&debug=true"
```

## Monitoring

### GitHub Actions

- Check the **Actions** tab in your GitHub repository
- View workflow runs and logs
- Set up notifications for failed runs

### Other Services

- Most cron services provide email notifications for failed jobs
- Check your service's dashboard regularly
- Monitor your application logs for errors

## Troubleshooting

### Reminders Not Sending

1. **Check cron job is running**:
   - Verify the cron service is executing the job
   - Check logs in GitHub Actions or your cron service

2. **Verify CRON_SECRET**:
   - Ensure the secret matches in both GitHub Secrets and your app
   - Check the Authorization header is correct

3. **Check application logs**:
   - Look for errors in your application logs
   - Verify the endpoint is accessible

4. **Verify email configuration**:
   - Ensure `RESEND_API_KEY` is set correctly
   - Check Resend dashboard for email delivery status

### Cron Job Failing

1. **Check URL is correct**:
   - Verify `APP_URL` in GitHub Secrets matches your production URL
   - Ensure the endpoint path is `/api/cron/reminders`

2. **Verify authentication**:
   - Check `CRON_SECRET` is set correctly
   - Ensure Authorization header format is: `Bearer YOUR_SECRET`

3. **Check application status**:
   - Verify your app is running and accessible
   - Check for any deployment issues

## Reminder Schedule

The system automatically sends reminders at these intervals:

- **3 days before due date**: Friendly reminder
- **On due date**: Payment due today reminder
- **7 days overdue**: First overdue reminder
- **14 days overdue**: Second overdue reminder
- **30+ days overdue**: Final notice

The cron job runs daily and checks all invoices to determine which reminders need to be sent. It prevents duplicate reminders by checking the last reminder sent date.

## Best Practices

1. **Run during business hours**: Set cron to run during your business hours (e.g., 9 AM)
2. **Monitor regularly**: Check cron job logs weekly
3. **Test after deployment**: Always test the cron job after deploying changes
4. **Keep secrets secure**: Never commit `CRON_SECRET` to your repository
5. **Use same secret everywhere**: Keep the secret consistent across all environments

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review application logs
3. Verify cron service is executing jobs
4. Test the endpoint manually

For more information, see the main [README](../README.md).

