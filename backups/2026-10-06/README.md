# Atma Rekha Production Backup — 2026-10-06

This backup branch was created before further production changes.

## GitHub
- Repository: rohit42i/Atmarekha4
- Base production commit: ebf476e6feb888ae131974813d06cdccd4636563
- Backup branch: backup/2026-10-06-pre-next-changes

The original commit remains immutable in Git history.

## Cloudflare
Worker production versions were independently verified before this snapshot:
- atmarekha4: latest version 2415
- pdlpl-media: latest version 851
- tiny-pond-c959: latest version 13

R2 buckets:
- atma-rekha-manga: 76 objects, 42,789,111 bytes
- pdlpl-manga: 4 objects, 3,252,451 bytes

Secrets are intentionally NOT copied into this repository.

## Supabase
Project: pbukwjokgkqacaphlqzm
Region: ap-south-1
Database: PostgreSQL 17.6.1.155

The live project has its migration history and deployed Edge Functions. A true downloadable pg_dump of production data requires the database connection password; that credential is not available to this backup process and is not guessed or exposed.

This manifest is a configuration/safety snapshot, not a replacement for the platform's managed database backups or a pg_dump.
