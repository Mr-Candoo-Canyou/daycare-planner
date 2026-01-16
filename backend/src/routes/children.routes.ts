import express from 'express';
import pool from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = express.Router();

// Get parent's children
router.get('/',
  authenticateToken,
  authorizeRoles('parent', 'system_admin'),
  async (req: AuthRequest, res) => {
    try {
      const parentId = req.user!.id;

      const result = await pool.query(
        `SELECT
          id, first_name, last_name, date_of_birth,
          has_special_needs, special_needs_description,
          languages_spoken_at_home, siblings_in_care, is_inuk, created_at
         FROM children
         WHERE parent_id = $1
         ORDER BY date_of_birth DESC`,
        [parentId]
      );

      res.json({ children: result.rows });
    } catch (error) {
      console.error('Get children error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Add new child
router.post('/',
  authenticateToken,
  authorizeRoles('parent', 'system_admin'),
  auditLog('create', 'child'),
  async (req: AuthRequest, res) => {
    try {
      const parentId = req.user!.id;
      const {
        firstName, lastName, dateOfBirth,
        hasSpecialNeeds, specialNeedsDescription,
        languagesSpokenAtHome, siblingsInCare, isInuk
      } = req.body;

      if (!firstName || !lastName || !dateOfBirth) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await pool.query(
        `INSERT INTO children
         (parent_id, first_name, last_name, date_of_birth,
          has_special_needs, special_needs_description,
          languages_spoken_at_home, siblings_in_care, is_inuk)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, first_name, last_name, date_of_birth, created_at`,
        [parentId, firstName, lastName, dateOfBirth,
         hasSpecialNeeds || false, specialNeedsDescription,
         languagesSpokenAtHome || [], siblingsInCare || [], isInuk || false]
      );

      res.status(201).json({
        message: 'Child added successfully',
        child: result.rows[0]
      });
    } catch (error) {
      console.error('Add child error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update child
router.patch('/:id',
  authenticateToken,
  authorizeRoles('parent', 'system_admin'),
  auditLog('update', 'child'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const parentId = req.user!.id;

      // Verify ownership
      const childCheck = await pool.query(
        'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
        [id, parentId]
      );

      if (childCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Child not found' });
      }

      const {
        firstName, lastName, hasSpecialNeeds,
        specialNeedsDescription, languagesSpokenAtHome, isInuk
      } = req.body;

      const result = await pool.query(
        `UPDATE children
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             has_special_needs = COALESCE($3, has_special_needs),
             special_needs_description = COALESCE($4, special_needs_description),
             languages_spoken_at_home = COALESCE($5, languages_spoken_at_home),
             is_inuk = COALESCE($6, is_inuk)
         WHERE id = $7
         RETURNING id, first_name, last_name, date_of_birth, updated_at`,
        [firstName, lastName, hasSpecialNeeds, specialNeedsDescription,
         languagesSpokenAtHome, isInuk, id]
      );

      res.json({
        message: 'Child updated successfully',
        child: result.rows[0]
      });
    } catch (error) {
      console.error('Update child error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
