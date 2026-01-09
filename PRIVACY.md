# Privacy Policy & Data Protection

The Daycare Planner application is designed with privacy as a foundational principle. This document explains our privacy-first approach and data protection measures.

## Core Privacy Principles

### 1. Data Minimization

We collect only the minimum data necessary to provide the service:

**Parent Data:**
- Name, email, phone (for account and communication)
- Child's name, date of birth (for placement matching)
- Optional: Special needs information, languages spoken
- Application preferences and notes

**What We DON'T Collect:**
- Social security numbers or government IDs
- Financial information (except subsidy amounts for enrolled children)
- Detailed health records
- Location tracking or device identifiers
- Third-party analytics or advertising pixels

### 2. Purpose Limitation

Data is used only for its intended purpose:
- Parent data: Application processing and waitlist management
- Daycare data: Waitlist administration and placement decisions
- System data: Anonymized reporting for funders

**We Never:**
- Sell or share data with third parties
- Use data for marketing purposes
- Share personal information across user roles without consent
- Retain data longer than necessary

### 3. Opt-In by Default

Sensitive data sharing requires explicit consent:

**Parent Networking Feature:**
- OFF by default
- Parents must actively opt-in during application
- Can be withdrawn at any time
- Only contact information shared with funders
- Other parents never see personal details without permission

### 4. Right to be Forgotten

Users can request complete data deletion:
- Account deletion removes all personal information
- Child records are anonymized (kept for statistical purposes only)
- Applications are marked as withdrawn
- Audit logs retain minimal identifiers for legal compliance

## Technical Privacy Measures

### Database Security

**Row-Level Security (RLS):**
```sql
-- Parents can only access their own data
CREATE POLICY parent_children_policy ON children
  FOR ALL TO authenticated_users
  USING (parent_id = current_user_id());

-- Daycare admins can only see their waitlist
CREATE POLICY daycare_waitlist_policy ON application_choices
  FOR SELECT TO daycare_admins
  USING (daycare_id IN (
    SELECT daycare_id FROM daycare_administrators
    WHERE user_id = current_user_id()
  ));
```

**Encryption:**
- Database encryption at rest (AES-256)
- TLS/SSL for all data in transit
- Password hashing with bcrypt (12 rounds)
- JWT tokens for stateless authentication

### Data Anonymization for Reports

Funder reports are automatically anonymized:

**Anonymization Techniques:**
1. **Aggregation**: Individual records combined into statistics
2. **Removal**: Personal identifiers stripped from reports
3. **K-Anonymity**: Minimum group sizes to prevent re-identification

**Example:**
```javascript
// Raw data (NOT exposed to funders)
{
  child: { name: "John Doe", dob: "2020-05-15" },
  parent: { email: "parent@example.com" }
}

// Anonymized report (exposed to funders)
{
  ageGroup: "2-3 years",
  region: "Downtown Toronto",
  hasPlacement: false,
  applicationCount: 1
}
```

### Access Controls

**Role-Based Access Control (RBAC):**

| Data Type | Parent | Daycare Admin | Funder |
|-----------|--------|---------------|--------|
| Own children | Full | No | No |
| Own applications | Full | No | No |
| Daycare waitlist | Limited | Full (own daycare) | No |
| Other parents | No | Contact only | Opt-in only |
| System reports | No | No | Anonymized |

### Audit Logging

All data access is logged for accountability:

```javascript
{
  userId: "uuid",
  action: "view_waitlist",
  resourceType: "application",
  resourceId: "uuid",
  ipAddress: "192.0.2.1",
  timestamp: "2024-01-09T12:34:56Z",
  details: { /* non-sensitive metadata */ }
}
```

**Audit logs are:**
- Immutable (append-only)
- Retained for 2 years
- Reviewed regularly for suspicious activity
- Available to users upon request (their own actions)

## Data Retention

### Active Data

Data is retained while accounts are active:
- User accounts: Until deletion requested
- Applications: Until withdrawn or placement ends
- Placements: Until child leaves care + 30 days

### Archived Data

After deletion, data is handled based on type:

| Data Type | Retention Period | Anonymization |
|-----------|-----------------|---------------|
| User accounts | 30 days | Full deletion after 30 days |
| Child records | 2 years | Name removed, DOB generalized |
| Applications | 2 years | Personal info removed |
| Placements | 7 years | Required for subsidy audits |
| Audit logs | 2 years | Minimal identifiers only |

### Legal Holds

Data subject to legal requirements:
- Subsidy records: 7 years (government requirement)
- Audit logs: 2 years (compliance requirement)
- Court orders: As legally required

## Privacy Rights

### User Rights (GDPR/PIPEDA Compliant)

**Right to Access:**
- View all personal data we store
- Request: Use in-app settings or email support
- Response time: Within 30 days

**Right to Rectification:**
- Correct inaccurate data
- Update profile information anytime

**Right to Erasure:**
- Request complete account deletion
- Data removed within 30 days
- Exceptions: Legal retention requirements

**Right to Data Portability:**
- Export all personal data in JSON format
- Request: Contact support
- Delivered within 30 days

**Right to Restrict Processing:**
- Pause application processing
- Withdraw from parent networking
- Deactivate account temporarily

**Right to Object:**
- Opt-out of parent networking
- Refuse specific data processing
- Close account at any time

### How to Exercise Rights

**In-App:**
- Account Settings → Privacy → [Action]

**Email:**
- privacy@daycare-planner.org
- Include: Name, email, specific request

**Response Time:**
- Acknowledgment: Within 48 hours
- Completion: Within 30 days
- Complex requests: Up to 90 days with notification

## Data Sharing

### Who We Share With

**Parents See:**
- Own children's information
- Own application status
- Daycare public information (name, location, capacity)

**Daycare Admins See:**
- Applicant names and contact info
- Child age and relevant details
- Current placement status (placed elsewhere or not)
- Application preferences (their daycare's rank)

**Funders See:**
- Aggregated statistics only
- No personal identifiers
- Parent network requests (opt-in only)
- Regional capacity analysis

### Who We DON'T Share With

- Other parents (except opt-in networking)
- Marketing companies
- Data brokers
- Social media platforms
- Third-party analytics services

### Third-Party Services

Minimal third-party services used:

| Service | Purpose | Data Shared | Privacy Policy |
|---------|---------|-------------|----------------|
| Hosting provider | Infrastructure | Technical logs only | [Link] |
| Email service | Transactional emails | Email, name only | [Link] |
| Database provider | Data storage | All (encrypted) | [Link] |

**We ensure all vendors:**
- Sign data processing agreements
- Meet security standards
- Don't use data for other purposes
- Delete data upon termination

## Breach Notification

### Our Commitment

In case of a data breach:
- **Detection**: Automated monitoring + security audits
- **Response**: Immediate containment and investigation
- **Notification**: Within 72 hours of discovery
- **Remediation**: Free credit monitoring if sensitive data exposed

### What We'll Tell You

- What data was affected
- When the breach occurred
- What we're doing about it
- Steps you should take
- How to contact us with questions

## Children's Privacy

### Special Protections

Children's data receives enhanced protection:
- Only parents can enter child information
- Limited to essential details only
- Not shared without parent consent
- Deleted upon parent request
- Never used for profiling

### COPPA Compliance

For US users:
- Parental consent required
- No direct marketing to children
- No collection beyond operational necessity
- Parents can review and delete child data

## Cookie Policy

**We use minimal cookies:**

| Cookie | Purpose | Duration | Required |
|--------|---------|----------|----------|
| auth_token | Authentication | 7 days | Yes |
| session_id | Session management | Session | Yes |
| preferences | User settings | 1 year | No |

**We DON'T use:**
- Advertising cookies
- Third-party tracking cookies
- Social media cookies
- Analytics cookies (without consent)

## Contact Us

### Privacy Inquiries

**Email:** privacy@daycare-planner.org

**Mail:**
Privacy Officer
Daycare Planner
[Address]

**Response Time:**
- General inquiries: 5 business days
- Data requests: 30 days
- Security concerns: 24 hours

### Data Protection Officer

For EU/UK users, contact our DPO:
- Email: dpo@daycare-planner.org
- Responsible for: GDPR compliance, breach response

### Supervisory Authority

Right to complain to your local data protection authority:
- Canada: Office of the Privacy Commissioner
- EU: Your country's data protection authority
- US: FTC or state attorney general

## Updates to This Policy

We may update this policy to reflect:
- Legal requirement changes
- New features or services
- Security improvements
- User feedback

**When we update:**
- Posted date will change
- Users notified of material changes
- 30 days notice before changes take effect
- Continued use implies acceptance

**Last Updated:** January 9, 2024
**Effective Date:** January 9, 2024

## Transparency Report

We publish annual transparency reports covering:
- Number of data requests received
- Government information requests
- Data breaches (if any)
- Privacy improvements made

View at: [transparency report link]

---

## Quick Privacy Tips

**For Parents:**
- Use strong, unique passwords
- Review privacy settings regularly
- Only opt-in to networking if comfortable
- Request data export annually to review

**For Daycare Admins:**
- Limit access to waitlist to necessary staff
- Don't share application details externally
- Report suspicious access attempts
- Train staff on privacy practices

**For Everyone:**
- Report security concerns immediately
- Don't share login credentials
- Log out on shared devices
- Keep contact information updated

---

**Questions about privacy?** Email privacy@daycare-planner.org
