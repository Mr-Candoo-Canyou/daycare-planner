import express from 'express';
import pool from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = express.Router();

// Create new application (parents only)
router.post('/',
  authenticateToken,
  authorizeRoles('parent'),
  auditLog('create', 'application'),
  async (req: AuthRequest, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { childId, desiredStartDate, notes, optInParentNetwork, daycareChoices } = req.body;
      const parentId = req.user!.id;

      // Validate input
      if (!childId || !desiredStartDate || !daycareChoices || !Array.isArray(daycareChoices)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify child belongs to parent
      const childCheck = await client.query(
        'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
        [childId, parentId]
      );

      if (childCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Child not found or access denied' });
      }

      // Check if child already has an active application
      const existingApp = await client.query(
        `SELECT id FROM applications WHERE child_id = $1
         AND id IN (
           SELECT application_id FROM application_choices
           WHERE status IN ('pending', 'waitlisted')
         )`,
        [childId]
      );

      if (existingApp.rows.length > 0) {
        return res.status(409).json({ error: 'Child already has an active application' });
      }

      // Create application
      const appResult = await client.query(
        `INSERT INTO applications (child_id, parent_id, desired_start_date, notes, opt_in_parent_network)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, application_date`,
        [childId, parentId, desiredStartDate, notes, optInParentNetwork || false]
      );

      const application = appResult.rows[0];

      // Create application choices (ranked preferences)
      const choicePromises = daycareChoices.map((choice: any, index: number) => {
        return client.query(
          `INSERT INTO application_choices (application_id, daycare_id, preference_rank)
           VALUES ($1, $2, $3)
           RETURNING id, daycare_id, preference_rank`,
          [application.id, choice.daycareId, index + 1]
        );
      });

      const choices = await Promise.all(choicePromises);

      // If opted in, create parent network request
      if (optInParentNetwork) {
        await client.query(
          `INSERT INTO parent_network_requests (parent_id, application_id, desired_area)
           VALUES ($1, $2, $3)`,
          [parentId, application.id, req.body.desiredArea || null]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Application submitted successfully',
        application: {
          id: application.id,
          applicationDate: application.application_date,
          choices: choices.map(c => c.rows[0])
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Application creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// Get parent's applications
router.get('/my-applications',
  authenticateToken,
  authorizeRoles('parent'),
  async (req: AuthRequest, res) => {
    try {
      const parentId = req.user!.id;

      const result = await pool.query(
        `SELECT
          a.id,
          a.application_date,
          a.desired_start_date,
          a.notes,
          c.first_name,
          c.last_name,
          c.date_of_birth,
          json_agg(
            json_build_object(
              'daycareId', ac.daycare_id,
              'daycareName', d.name,
              'preferenceRank', ac.preference_rank,
              'status', ac.status,
              'statusUpdatedAt', ac.status_updated_at
            ) ORDER BY ac.preference_rank
          ) as choices
         FROM applications a
         JOIN children c ON a.child_id = c.id
         LEFT JOIN application_choices ac ON a.id = ac.application_id
         LEFT JOIN daycares d ON ac.daycare_id = d.id
         WHERE a.parent_id = $1
         GROUP BY a.id, c.first_name, c.last_name, c.date_of_birth
         ORDER BY a.application_date DESC`,
        [parentId]
      );

      res.json({ applications: result.rows });
    } catch (error) {
      console.error('Get applications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Withdraw application
router.patch('/:id/withdraw',
  authenticateToken,
  authorizeRoles('parent'),
  auditLog('withdraw', 'application'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const parentId = req.user!.id;

      // Verify ownership
      const appCheck = await pool.query(
        'SELECT id FROM applications WHERE id = $1 AND parent_id = $2',
        [id, parentId]
      );

      if (appCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Update all choices to withdrawn
      await pool.query(
        `UPDATE application_choices
         SET status = 'withdrawn', status_updated_at = CURRENT_TIMESTAMP
         WHERE application_id = $1`,
        [id]
      );

      res.json({ message: 'Application withdrawn successfully' });
    } catch (error) {
      console.error('Withdraw application error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
