import express from 'express';
import pool from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = express.Router();

// Get all active daycares (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id, name, address, city, province, postal_code,
        phone, email, capacity, current_enrollment,
        age_range_min, age_range_max, languages,
        has_subsidy_program, description
       FROM daycares
       WHERE is_active = true
       ORDER BY name`
    );

    res.json({ daycares: result.rows });
  } catch (error) {
    console.error('Get daycares error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daycares for the current admin (daycare admins only)
router.get('/my-daycares',
  authenticateToken,
  authorizeRoles('daycare_admin', 'system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const isSystemAdmin = req.user?.role === 'system_admin';

      const result = await pool.query(
        isSystemAdmin
          ? `SELECT
              id, name, address, city, province, postal_code,
              phone, email, capacity, current_enrollment,
              age_range_min, age_range_max, languages,
              has_subsidy_program, description, is_active
             FROM daycares
             ORDER BY name`
          : `SELECT
              d.id, d.name, d.address, d.city, d.province, d.postal_code,
              d.phone, d.email, d.capacity, d.current_enrollment,
              d.age_range_min, d.age_range_max, d.languages,
              d.has_subsidy_program, d.description, d.is_active
             FROM daycares d
             JOIN daycare_administrators da ON d.id = da.daycare_id
             WHERE da.user_id = $1
             ORDER BY d.name`,
        isSystemAdmin ? [] : [userId]
      );

      res.json({ daycares: result.rows });
    } catch (error) {
      console.error('Get admin daycares error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get daycare waitlist (daycare admins only)
router.get('/:id/waitlist',
  authenticateToken,
  authorizeRoles('daycare_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify user is admin of this daycare
      const adminCheck = await pool.query(
        'SELECT id FROM daycare_administrators WHERE user_id = $1 AND daycare_id = $2',
        [userId, id]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get waitlist with placement status
      const result = await pool.query(
        `SELECT
          ac.id as choice_id,
          ac.preference_rank,
          ac.status,
          a.id as application_id,
          a.application_date,
          a.desired_start_date,
          c.id as child_id,
          c.first_name,
          c.last_name,
          c.date_of_birth,
          c.has_special_needs,
          c.languages_spoken_at_home,
          c.siblings_in_care,
          u.email as parent_email,
          u.phone as parent_phone,
          u.first_name as parent_first_name,
          u.last_name as parent_last_name,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM placements p
              WHERE p.child_id = c.id
              AND (p.end_date IS NULL OR p.end_date > CURRENT_DATE)
            ) THEN true
            ELSE false
          END as has_current_placement,
          (
            SELECT json_build_object('name', d.name, 'id', d.id)
            FROM placements p
            JOIN daycares d ON p.daycare_id = d.id
            WHERE p.child_id = c.id
            AND (p.end_date IS NULL OR p.end_date > CURRENT_DATE)
            LIMIT 1
          ) as current_placement
         FROM application_choices ac
         JOIN applications a ON ac.application_id = a.id
         JOIN children c ON a.child_id = c.id
         JOIN users u ON a.parent_id = u.id
         WHERE ac.daycare_id = $1
         AND ac.status IN ('pending', 'waitlisted')
         ORDER BY
           CASE WHEN ac.status = 'pending' THEN 0 ELSE 1 END,
           a.application_date ASC`,
        [id]
      );

      res.json({ waitlist: result.rows });
    } catch (error) {
      console.error('Get waitlist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update application status (daycare admins only)
router.patch('/applications/:choiceId/status',
  authenticateToken,
  authorizeRoles('daycare_admin'),
  auditLog('update_status', 'application_choice'),
  async (req: AuthRequest, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { choiceId } = req.params;
      const { status, statusNotes } = req.body;
      const userId = req.user!.id;

      // Validate status
      const validStatuses = ['pending', 'accepted', 'rejected', 'waitlisted'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Get application choice and verify admin access
      const choiceResult = await client.query(
        `SELECT ac.*, da.user_id as admin_user_id
         FROM application_choices ac
         JOIN daycare_administrators da ON ac.daycare_id = da.daycare_id
         WHERE ac.id = $1 AND da.user_id = $2`,
        [choiceId, userId]
      );

      if (choiceResult.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const choice = choiceResult.rows[0];

      // Update status
      await client.query(
        `UPDATE application_choices
         SET status = $1, status_notes = $2, status_updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, statusNotes, choiceId]
      );

      // If accepted, create placement
      if (status === 'accepted') {
        const appResult = await client.query(
          'SELECT desired_start_date, child_id FROM applications WHERE id = $1',
          [choice.application_id]
        );

        const app = appResult.rows[0];

        await client.query(
          `INSERT INTO placements (child_id, daycare_id, application_choice_id, start_date)
           VALUES ($1, $2, $3, $4)`,
          [app.child_id, choice.daycare_id, choiceId, app.desired_start_date]
        );

        // Update daycare enrollment
        await client.query(
          `UPDATE daycares
           SET current_enrollment = current_enrollment + 1
           WHERE id = $1`,
          [choice.daycare_id]
        );
      }

      await client.query('COMMIT');

      res.json({ message: 'Application status updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// Register new daycare (system admin only - in production this would be a separate process)
router.post('/',
  authenticateToken,
  authorizeRoles('daycare_admin', 'system_admin'),
  auditLog('create', 'daycare'),
  async (req: AuthRequest, res) => {
    try {
      const {
        name, address, city, province, postalCode, phone, email,
        capacity, ageRangeMin, ageRangeMax, languages,
        hasSubsidyProgram, description, admissionRules
      } = req.body;

      if (!name || !address || !city || !province || !capacity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await pool.query(
        `INSERT INTO daycares
         (name, address, city, province, postal_code, phone, email,
          capacity, age_range_min, age_range_max, languages,
          has_subsidy_program, description, admission_rules)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, name, created_at`,
        [name, address, city, province, postalCode, phone, email,
         capacity, ageRangeMin, ageRangeMax, languages,
         hasSubsidyProgram, description, JSON.stringify(admissionRules)]
      );

      const daycare = result.rows[0];

      if (req.user?.role === 'daycare_admin') {
        await pool.query(
          'INSERT INTO daycare_administrators (user_id, daycare_id) VALUES ($1, $2)',
          [req.user!.id, daycare.id]
        );
      }

      res.status(201).json({
        message: 'Daycare registered successfully',
        daycare
      });
    } catch (error) {
      console.error('Create daycare error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update daycare (daycare admins can update their own, system admins can update any)
router.patch('/:id',
  authenticateToken,
  authorizeRoles('daycare_admin', 'system_admin'),
  auditLog('update', 'daycare'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const {
        name, address, city, province, postalCode, phone, email,
        capacity, ageRangeMin, ageRangeMax, languages,
        hasSubsidyProgram, description, admissionRules, isActive
      } = req.body;

      const daycareResult = await pool.query(
        'SELECT * FROM daycares WHERE id = $1',
        [id]
      );

      if (daycareResult.rows.length === 0) {
        return res.status(404).json({ error: 'Daycare not found' });
      }

      const daycare = daycareResult.rows[0];
      const isSystemAdmin = req.user?.role === 'system_admin';

      if (!isSystemAdmin) {
        const adminCheck = await pool.query(
          'SELECT id FROM daycare_administrators WHERE user_id = $1 AND daycare_id = $2',
          [req.user!.id, id]
        );

        if (adminCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const updated = {
        name: name ?? daycare.name,
        address: address ?? daycare.address,
        city: city ?? daycare.city,
        province: province ?? daycare.province,
        postal_code: postalCode ?? daycare.postal_code,
        phone: phone ?? daycare.phone,
        email: email ?? daycare.email,
        capacity: capacity ?? daycare.capacity,
        age_range_min: ageRangeMin ?? daycare.age_range_min,
        age_range_max: ageRangeMax ?? daycare.age_range_max,
        languages: languages ?? daycare.languages,
        has_subsidy_program: hasSubsidyProgram ?? daycare.has_subsidy_program,
        description: description ?? daycare.description,
        admission_rules: admissionRules ?? daycare.admission_rules,
        is_active: isActive ?? daycare.is_active
      };

      if (updated.capacity !== null && updated.capacity !== undefined && updated.capacity <= 0) {
        return res.status(400).json({ error: 'Capacity must be greater than 0' });
      }

      if (
        updated.age_range_min !== null &&
        updated.age_range_max !== null &&
        updated.age_range_min !== undefined &&
        updated.age_range_max !== undefined &&
        updated.age_range_max <= updated.age_range_min
      ) {
        return res.status(400).json({ error: 'Age range max must be greater than min' });
      }

      const admissionRulesPayload = updated.admission_rules === null
        ? null
        : JSON.stringify(updated.admission_rules);

      const result = await pool.query(
        `UPDATE daycares
         SET name = $1,
             address = $2,
             city = $3,
             province = $4,
             postal_code = $5,
             phone = $6,
             email = $7,
             capacity = $8,
             age_range_min = $9,
             age_range_max = $10,
             languages = $11,
             has_subsidy_program = $12,
             description = $13,
             admission_rules = $14,
             is_active = $15,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $16
         RETURNING id, name, updated_at`,
        [
          updated.name,
          updated.address,
          updated.city,
          updated.province,
          updated.postal_code,
          updated.phone,
          updated.email,
          updated.capacity,
          updated.age_range_min,
          updated.age_range_max,
          updated.languages,
          updated.has_subsidy_program,
          updated.description,
          admissionRulesPayload,
          updated.is_active,
          id
        ]
      );

      res.json({ message: 'Daycare updated successfully', daycare: result.rows[0] });
    } catch (error) {
      console.error('Update daycare error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
