import express from 'express';
import pool from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';

const router = express.Router();

// System-wide statistics (funders only)
router.get('/statistics',
  authenticateToken,
  authorizeRoles('funder', 'system_admin'),
  async (req: AuthRequest, res) => {
    try {
      // Total children in system
      const totalChildrenResult = await pool.query(
        'SELECT COUNT(*) as count FROM children'
      );

      // Children with placements
      const childrenWithPlacementsResult = await pool.query(
        `SELECT COUNT(DISTINCT child_id) as count
         FROM placements
         WHERE end_date IS NULL OR end_date > CURRENT_DATE`
      );

      // Children without placements (in need of care)
      const childrenWithoutCareResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM children c
         WHERE NOT EXISTS (
           SELECT 1 FROM placements p
           WHERE p.child_id = c.id
           AND (p.end_date IS NULL OR p.end_date > CURRENT_DATE)
         )`
      );

      // Active applications
      const activeApplicationsResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM application_choices
         WHERE status IN ('pending', 'waitlisted')`
      );

      // Total daycares
      const totalDaycaresResult = await pool.query(
        'SELECT COUNT(*) as count FROM daycares WHERE is_active = true'
      );

      // Total capacity vs enrollment
      const capacityResult = await pool.query(
        `SELECT
          SUM(capacity) as total_capacity,
          SUM(current_enrollment) as total_enrollment
         FROM daycares
         WHERE is_active = true`
      );

      // Subsidized placements
      const subsidizedResult = await pool.query(
        `SELECT
          COUNT(*) as count,
          SUM(subsidy_amount) as total_amount
         FROM placements
         WHERE is_subsidized = true
         AND (end_date IS NULL OR end_date > CURRENT_DATE)`
      );

      // Anonymized demographic data (age distribution)
      const ageDistributionResult = await pool.query(
        `SELECT
          CASE
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 2 THEN '0-2 years'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 2 AND 3 THEN '2-3 years'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 4 AND 5 THEN '4-5 years'
            ELSE '6+ years'
          END as age_group,
          COUNT(*) as count
         FROM children
         GROUP BY age_group
         ORDER BY age_group`
      );

      res.json({
        statistics: {
          totalChildren: parseInt(totalChildrenResult.rows[0].count),
          childrenWithPlacements: parseInt(childrenWithPlacementsResult.rows[0].count),
          childrenWithoutCare: parseInt(childrenWithoutCareResult.rows[0].count),
          activeApplications: parseInt(activeApplicationsResult.rows[0].count),
          totalDaycares: parseInt(totalDaycaresResult.rows[0].count),
          capacity: {
            total: parseInt(capacityResult.rows[0].total_capacity || 0),
            enrolled: parseInt(capacityResult.rows[0].total_enrollment || 0),
            available: parseInt(capacityResult.rows[0].total_capacity || 0) -
                      parseInt(capacityResult.rows[0].total_enrollment || 0)
          },
          subsidies: {
            count: parseInt(subsidizedResult.rows[0].count || 0),
            totalAmount: parseFloat(subsidizedResult.rows[0].total_amount || 0)
          },
          ageDistribution: ageDistributionResult.rows
        }
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Parent networking requests (funders only - anonymized contact info)
router.get('/parent-network-requests',
  authenticateToken,
  authorizeRoles('funder', 'system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const result = await pool.query(
        `SELECT
          pnr.id,
          pnr.desired_area,
          pnr.created_at,
          u.email as contact_email,
          u.first_name,
          u.last_name,
          COUNT(c.id) as number_of_children
         FROM parent_network_requests pnr
         JOIN users u ON pnr.parent_id = u.id
         JOIN children c ON c.parent_id = u.id
         WHERE pnr.is_active = true
         AND pnr.expires_at > CURRENT_TIMESTAMP
         GROUP BY pnr.id, pnr.desired_area, pnr.created_at,
                  u.email, u.first_name, u.last_name
         ORDER BY pnr.created_at DESC`
      );

      res.json({ requests: result.rows });
    } catch (error) {
      console.error('Get parent network requests error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Waitlist analysis by region (funders only)
router.get('/waitlist-analysis',
  authenticateToken,
  authorizeRoles('funder', 'system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const result = await pool.query(
        `SELECT
          d.city,
          d.province,
          COUNT(DISTINCT ac.id) as total_waitlisted,
          COUNT(DISTINCT CASE WHEN NOT EXISTS (
            SELECT 1 FROM placements p
            WHERE p.child_id = a.child_id
            AND (p.end_date IS NULL OR p.end_date > CURRENT_DATE)
          ) THEN ac.id END) as without_current_care,
          AVG(d.capacity) as avg_capacity,
          AVG(d.current_enrollment) as avg_enrollment
         FROM application_choices ac
         JOIN daycares d ON ac.daycare_id = d.id
         JOIN applications a ON ac.application_id = a.id
         WHERE ac.status IN ('pending', 'waitlisted')
         GROUP BY d.city, d.province
         ORDER BY total_waitlisted DESC`
      );

      res.json({ analysis: result.rows });
    } catch (error) {
      console.error('Get waitlist analysis error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
