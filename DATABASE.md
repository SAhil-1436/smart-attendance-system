# Database Architecture & Schema Specification

This document details the relational data model, constraints, composite performance indexes, and cascade deletion policies implemented in the **Smart Attendance Management System**.

---

## 1. Database Configuration

- **Engine**: SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)
- **Concurrency**: WAL mode allows concurrent readers and writers without database locking bottlenecks.
- **Foreign Key Enforcement**: `PRAGMA foreign_keys = ON;` is executed on every database connection.
- **ORM / Driver**: SQLAlchemy 2.0 (Declarative Async) with `aiosqlite`.

---

## 2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ ATTENDANCE_SESSIONS : "conducts"
    USERS ||--o{ ATTENDANCE_RECORDS : "manually marks"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    
    DEPARTMENTS ||--o{ COURSES : "offers"
    DEPARTMENTS ||--o{ STUDENTS : "belongs to"
    
    COURSES ||--o{ SUBJECTS : "contains"
    COURSES ||--o{ STUDENTS : "enrolled in"
    COURSES ||--o{ ATTENDANCE_SESSIONS : "hosts"
    
    SUBJECTS ||--o{ ATTENDANCE_SESSIONS : "scheduled for"
    
    STUDENTS ||--o{ FACE_EMBEDDINGS : "has 3 samples"
    STUDENTS ||--o{ ATTENDANCE_RECORDS : "marked in"
    
    ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : "contains"

    USERS {
        int id PK
        string username UK
        string email UK
        string hashed_password
        string full_name
        string role "ADMIN | FACULTY"
        boolean is_active
        datetime created_at
    }

    STUDENTS {
        int id PK
        string student_id UK "Roll Number"
        string name
        string email UK
        string phone
        int department_id FK
        int course_id FK
        int semester
        string section
        boolean face_registered
        boolean is_active
        datetime created_at
    }

    FACE_EMBEDDINGS {
        int id PK
        int student_id FK
        text embedding_json "128-d Vector"
        float quality_score
        datetime captured_at
    }

    ATTENDANCE_SESSIONS {
        int id PK
        string session_code UK
        int subject_id FK
        int course_id FK
        int faculty_id FK
        int semester
        string section
        date session_date
        datetime start_time
        datetime end_time
        string status "ACTIVE | COMPLETED"
    }

    ATTENDANCE_RECORDS {
        int id PK
        int session_id FK
        int student_id FK
        datetime marked_at
        string status "PRESENT | LATE | ABSENT"
        string verification_method "FACE_RECOGNITION | MANUAL"
        float confidence_score
        string liveness_token
        int marked_by_user_id FK
    }

    AUDIT_LOGS {
        int id PK
        int user_id FK
        string action
        string entity_type
        string entity_id
        string ip_address
        text details_json
        datetime created_at
    }

    SYSTEM_SETTINGS {
        string key PK
        string value
        string description
        datetime updated_at
    }
```

---

## 3. Performance Indexes & Composite Constraints

To support real-time attendance lookups and millisecond reporting queries across thousands of records, explicit composite indexes are applied:

| Index Name | Target Table | Indexed Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `uq_session_student_attendance` | `attendance_records` | `(session_id, student_id)` | **Unique Constraint**: Prevents duplicate attendance marking at the database layer. |
| `ix_attendance_student_marked` | `attendance_records` | `(student_id, marked_at)` | Accelerates individual student attendance deficit queries. |
| `ix_attendance_status_marked` | `attendance_records` | `(status, marked_at)` | Accelerates dashboard 7-day trend calculations (`PRESENT` vs `LATE`). |
| `ix_session_status_date` | `attendance_sessions` | `(status, session_date)` | Accelerates queries filtering for live `ACTIVE` lecture sessions. |

---

## 4. Referential Integrity & Cascade Rules

1. **Student Deletion (`ON DELETE CASCADE`)**:
   - When a student is removed via `DELETE /api/v1/students/{id}`, all associated `face_embeddings` records are automatically purged by SQLite to prevent orphaned biometric data.
2. **Session Records**:
   - `attendance_records` maintain a foreign key reference to `attendance_sessions` (`ondelete="CASCADE"`).
3. **Audit Trail**:
   - `audit_logs.user_id` is set to `SET NULL` on user deletion to preserve forensic audit logs even if a user account is removed.

---

## 5. Seed Data Summary

The database automatically initializes the following seed records on initial boot (`app/core/init_db.py`):
- **Departments**: Computer Science & Engineering (`CSE`), Electronics & Communication (`ECE`).
- **Courses**: Bachelor of Technology (`BTECH_CSE`, `BTECH_ECE`).
- **Subjects**: Data Structures & Algorithms (`CS301`), Operating Systems (`CS302`), Computer Networks (`CS303`), Digital Signal Processing (`EC301`).
- **Administrative Users**:
  - `admin` / `Admin@123` (`ADMIN`)
  - `dr.sharma` / `Faculty@123` (`FACULTY`)
- **Initial Students**: 5 pre-seeded students across Semesters 4 and 6 with designated roll numbers.
