-- SmartTeaAI — Auth schema
-- Run this against the `smartteaai` database before starting the backend.
-- Uses synchronize:false so these tables are never auto-modified by TypeORM.
--
-- Safe to re-run during development — drops and recreates both tables.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `role_requests`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `users` (
  `id`            INT           NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100)  NOT NULL,
  `email`         VARCHAR(150)  NOT NULL,
  `password_hash` VARCHAR(255)  NOT NULL,
  `role`          ENUM('farmer','broker','exporter','buyer','analyst','admin')
                                NOT NULL DEFAULT 'farmer',
  `is_active`     TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_requests` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `user_id`        INT NOT NULL,
  `requested_role` ENUM('farmer','broker','exporter','buyer','analyst','admin') NOT NULL,
  `status`         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at`     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_role_requests_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
