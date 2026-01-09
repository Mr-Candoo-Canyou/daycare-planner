import express from 'express';
import pool from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = express.Router();

// Get all users (system admin only)
router.get('/users',
  authenticateToken,
  authorizeRoles('system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const result = await pool.query(
        `SELECT
          id, email, role, first_name, last_name,
          phone, created_at, last_login, is_active, email_verified
         FROM users
         ORDER BY created_at DESC`
      );

      res.json({ users: result.rows });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all daycares with details (system admin only)
router.get('/daycares',
  authenticateToken,
  authorizeRoles('system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const result = await pool.query(
        `SELECT
          d.*,
          COUNT(DISTINCT da.user_id) as admin_count,
          COUNT(DISTINCT p.id) as placement_count
         FROM daycares d
         LEFT JOIN daycare_administrators da ON d.id = da.daycare_id
         LEFT JOIN placements p ON d.id = p.daycare_id
           AND (p.end_date IS NULL OR p.end_date > CURRENT_DATE)
         GROUP BY d.id
         ORDER BY d.created_at DESC`
      );

      res.json({ daycares: result.rows });
    } catch (error) {
      console.error('Get all daycares error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all applications with full details
router.get('/applications',
  authenticateToken,
  authorizeRoles('system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const result = await pool.query(
        `SELECT
          a.id as application_id,
          a.application_date,
          a.desired_start_date,
          a.opt_in_parent_network,
          c.first_name as child_first_name,
          c.last_name as child_last_name,
          c.date_of_birth,
          u.email as parent_email,
          u.first_name as parent_first_name,
          u.last_name as parent_last_name,
          json_agg(
            json_build_object(
              'daycareId', ac.daycare_id,
              'daycareName', d.name,
              'preferenceRank', ac.preference_rank,
              'status', ac.status,
              'statusUpdatedAt', ac.status_updated_at
            ) ORDER BY ac.preference_rank
          ) as choices,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM placements p
              WHERE p.child_id = c.id
              AND (p.end_date IS NULL OR p.end_date > CURRENT_DATE)
            ) THEN true
            ELSE false
          END as has_placement
         FROM applications a
         JOIN children c ON a.child_id = c.id
         JOIN users u ON a.parent_id = u.id
         LEFT JOIN application_choices ac ON a.id = ac.application_id
         LEFT JOIN daycares d ON ac.daycare_id = d.id
         GROUP BY a.id, c.first_name, c.last_name, c.date_of_birth, c.id,
                  u.email, u.first_name, u.last_name
         ORDER BY a.application_date DESC
         LIMIT 100`
      );

      res.json({ applications: result.rows });
    } catch (error) {
      console.error('Get all applications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get system statistics
router.get('/statistics',
  authenticateToken,
  authorizeRoles('system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const [
        usersResult,
        daycaresResult,
        applicationsResult,
        placementsResult,
        auditResult
      ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
            COUNT(CASE WHEN role = 'daycare_admin' THEN 1 END) as daycare_admins,
            COUNT(CASE WHEN role = 'funder' THEN 1 END) as funders,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active
          FROM users
        `),
        pool.query(`
          SELECT
            COUNT(*) as total,
            SUM(capacity) as total_capacity,
            SUM(current_enrollment) as total_enrollment,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active
          FROM daycares
        `),
        pool.query(`
          SELECT
            COUNT(DISTINCT a.id) as total,
            COUNT(DISTINCT CASE WHEN ac.status = 'pending' THEN a.id END) as pending,
            COUNT(DISTINCT CASE WHEN ac.status = 'waitlisted' THEN a.id END) as waitlisted,
            COUNT(DISTINCT CASE WHEN ac.status = 'accepted' THEN a.id END) as accepted
          FROM applications a
          LEFT JOIN application_choices ac ON a.id = ac.application_id
        `),
        pool.query(`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN is_subsidized = true THEN 1 END) as subsidized,
            SUM(CASE WHEN is_subsidized = true THEN subsidy_amount ELSE 0 END) as subsidy_total
          FROM placements
          WHERE end_date IS NULL OR end_date > CURRENT_DATE
        `),
        pool.query(`
          SELECT COUNT(*) as total
          FROM audit_log
          WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
        `)
      ]);

      res.json({
        statistics: {
          users: usersResult.rows[0],
          daycares: daycaresResult.rows[0],
          applications: applicationsResult.rows[0],
          placements: placementsResult.rows[0],
          auditLogsLastWeek: parseInt(auditResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update user status (activate/deactivate)
router.patch('/users/:id/status',
  authenticateToken,
  authorizeRoles('system_admin'),
  auditLog('update_user_status', 'user'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Don't allow deactivating yourself
      if (id === req.user!.id && !isActive) {
        return res.status(400).json({ error: 'Cannot deactivate your own account' });
      }

      await pool.query(
        'UPDATE users SET is_active = $1 WHERE id = $2',
        [isActive, id]
      );

      res.json({ message: 'User status updated successfully' });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update user role
router.patch('/users/:id/role',
  authenticateToken,
  authorizeRoles('system_admin'),
  auditLog('update_user_role', 'user'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const validRoles = ['parent', 'daycare_admin', 'funder', 'system_admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Don't allow changing your own role
      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }

      await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2',
        [role, id]
      );

      res.json({ message: 'User role updated successfully' });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get recent audit logs
router.get('/audit-logs',
  authenticateToken,
  authorizeRoles('system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { limit = 100, offset = 0 } = req.query;

      const result = await pool.query(
        `SELECT
          al.*,
          u.email as user_email,
          u.first_name,
          u.last_name
         FROM audit_log al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({ logs: result.rows });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete user (soft delete - deactivate)
router.delete('/users/:id',
  authenticateToken,
  authorizeRoles('system_admin'),
  auditLog('delete_user', 'user'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await pool.query(
        'UPDATE users SET is_active = false WHERE id = $1',
        [id]
      );

      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get system health
router.get('/health',
  authenticateToken,
  authorizeRoles('system_admin'),
  async (req: AuthRequest, res) => {
    try {
      // Check database connection
      const dbResult = await pool.query('SELECT NOW()');

      // Get database size
      const sizeResult = await pool.query(
        `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
      );

      // Get connection count
      const connResult = await pool.query(
        `SELECT count(*) as connections FROM pg_stat_activity`
      );

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          size: sizeResult.rows[0].size,
          connections: parseInt(connResult.rows[0].connections),
          timestamp: dbResult.rows[0].now
        }
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Database connection failed'
      });
    }
  }
);

export default router;
