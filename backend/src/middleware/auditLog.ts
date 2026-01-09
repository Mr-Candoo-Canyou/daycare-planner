import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import pool from '../config/database';

export const auditLog = (action: string, resourceType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || null;
      const resourceId = req.params.id || null;
      const ipAddress = req.ip;

      await pool.query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, action, resourceType, resourceId, JSON.stringify(req.body), ipAddress]
      );

      next();
    } catch (error) {
      console.error('Audit log error:', error);
      next(); // Don't block request if audit fails
    }
  };
};
