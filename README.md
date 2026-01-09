# Daycare Planner

A privacy-focused web application that helps rationalize daycare waiting lists and supports parents without childcare to start their own organizations.

## Overview

This system connects three key stakeholders in the childcare ecosystem:

### For Parents
- Apply to multiple daycares through **one ranked-choice form**
- Track application status across all chosen daycares
- Opt-in to connect with other parents if no placement is available
- View which daycares have spots available

### For Daycare Administrators
- View complete waitlist with placement status indicators
- See which children already have care vs. those without
- Maintain full control over admissions based on organizational rules
- Update application statuses (pending, waitlisted, accepted, rejected)

### For Funders/Government Officials
- Access anonymized system-wide reporting
- Track subsidy program effectiveness
- View regional capacity and demand analytics
- Connect with parents interested in starting new organizations

## Key Features

- **Privacy-First Design**: Row-level security, data encryption, minimal data collection
- **Ranked-Choice Applications**: Parents can prioritize multiple daycares in one application
- **Placement Status Visibility**: Daycares see which children need care most urgently
- **Parent Networking**: Opt-in feature to connect parents for co-op creation
- **Anonymized Reporting**: Funders get insights without compromising privacy
- **Audit Logging**: Complete audit trail for compliance and accountability

## Technology Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL with Row-Level Security
- **Authentication**: JWT-based with role-based access control
- **State Management**: Zustand + React Query

## Project Structure

```
daycare-planner/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── middleware/     # Auth, audit logging
│   │   ├── routes/         # API endpoints
│   │   └── index.ts        # Main server file
│   ├── migrations/         # Database schema
│   └── package.json
├── frontend/               # React web application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── store/          # State management
│   │   ├── lib/            # API client
│   │   └── App.tsx         # Main app component
│   └── package.json
└── docker-compose.yml      # Development environment
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Quick Start with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd daycare-planner
```

2. Start all services:
```bash
docker-compose up
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 3001
- Frontend app on port 3000

3. Access the application at `http://localhost:3000`

### Manual Setup

#### Database Setup

1. Create PostgreSQL database:
```bash
createdb daycare_planner
```

2. Run migrations:
```bash
psql daycare_planner < backend/migrations/001_initial_schema.sql
```

#### Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your configuration

4. Start the server:
```bash
npm run dev
```

Backend will run on `http://localhost:3001`

#### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## Environment Variables

### Backend (.env)

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=daycare_planner
DB_USER=postgres
DB_PASSWORD=your_secure_password
JWT_SECRET=your_very_secure_jwt_secret
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:3000
```

## API Documentation

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Parent Endpoints

- `GET /api/children` - Get parent's children
- `POST /api/children` - Add new child
- `PATCH /api/children/:id` - Update child information
- `POST /api/applications` - Submit new application
- `GET /api/applications/my-applications` - Get parent's applications
- `PATCH /api/applications/:id/withdraw` - Withdraw application

### Daycare Admin Endpoints

- `GET /api/daycares` - List all daycares
- `POST /api/daycares` - Register new daycare
- `GET /api/daycares/:id/waitlist` - View daycare waitlist
- `PATCH /api/daycares/applications/:choiceId/status` - Update application status

### Funder Endpoints

- `GET /api/reports/statistics` - System-wide statistics
- `GET /api/reports/waitlist-analysis` - Regional waitlist analysis
- `GET /api/reports/parent-network-requests` - Parent networking requests

## Privacy & Security

### Privacy Features

- **Opt-in Data Sharing**: Parents control what information is shared
- **Data Minimization**: Only essential information is collected
- **Anonymized Reporting**: Funder reports contain no personal identifiers
- **Row-Level Security**: Database enforces access control at the data layer
- **Audit Logging**: All actions are logged for transparency

### Security Measures

- JWT-based authentication
- bcrypt password hashing (12 rounds)
- Rate limiting on API endpoints
- CORS protection
- Helmet.js security headers
- SQL injection prevention via parameterized queries
- Input validation and sanitization

## Database Schema

Key tables:
- `users` - User accounts with role-based access
- `children` - Child information (linked to parents)
- `daycares` - Daycare facilities and capacity
- `applications` - Parent applications for care
- `application_choices` - Ranked daycare preferences
- `placements` - Active childcare placements
- `parent_network_requests` - Opt-in parent networking
- `audit_log` - Complete audit trail

## User Roles

1. **Parent**: Apply for care, manage children, opt-in to networking
2. **Daycare Admin**: Manage waitlists, update application statuses
3. **Funder**: View reports, access parent networking requests
4. **System Admin**: Full system access (for deployment/maintenance)

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Building for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## Contributing

This is a privacy-focused public service project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
