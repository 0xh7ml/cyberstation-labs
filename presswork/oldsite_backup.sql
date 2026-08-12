-- MySQL dump 10.19  Distrib 10.3, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: legacy_intranet
-- ------------------------------------------------------
-- Server version	8.0.36-0ubuntu0.20.04.1
--
-- Leftover backup from the old company intranet, accidentally left behind
-- during the WordPress migration (e.g. dropped in an uploads/backup folder,
-- or reachable via a path-traversal/LFI in the box). Intended discovery path:
--   wp-content shell (upload/RCE) -> find world-readable backup -> crack ->
--   SSH as devops on the docker host / adjacent container.
--
-- Hashes are raw MD5 (hashcat -m 0), crackable with rockyou.txt.
--

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

--
-- Table structure for table `legacy_users`
--

DROP TABLE IF EXISTS `legacy_users`;
CREATE TABLE `legacy_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(64) NOT NULL,
  `email` varchar(128) DEFAULT NULL,
  `role` varchar(32) DEFAULT 'user',
  `last_login` datetime DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `legacy_users`
--

INSERT INTO `legacy_users` (`id`, `username`, `password_hash`, `email`, `role`, `last_login`, `notes`) VALUES
(1, 'admin',       '21232f297a57a5a743894a0e4a801fc3', 'admin@circuitcart.local',   'admin',    '2025-11-02 09:14:00', 'legacy portal admin, rotated after migration'),
(2, 'jdoe',        'e10adc3949ba59abbe56e057f20f883e', 'jdoe@circuitcart.local',    'staff',    '2025-10-28 17:02:00', NULL),
(3, 'devops',      'd5c0607301ad5d5c1528962a83992ac8', 'devops@circuitcart.local',  'devops',   '2025-12-01 03:47:00', 'reuses same pw on ssh + gitea, per onboarding doc'),
(4, 'svc-backup',  '5f4dcc3b5aa765d61d8327deb882cf99', 'backup-svc@circuitcart.local', 'service', '2025-09-14 04:00:00', 'cron service account, low priv'),
(5, 'mchen',       '25f9e794323b453885f5181f1b624d0b', 'mchen@circuitcart.local',   'staff',    '2025-08-30 11:22:00', NULL);

--
-- Table structure for table `legacy_sessions` (empty, kept for realism)
--

DROP TABLE IF EXISTS `legacy_sessions`;
CREATE TABLE `legacy_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(128) DEFAULT NULL,
  `expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;
-- Dump completed
