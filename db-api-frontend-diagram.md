# Database, API, and Frontend Interaction Diagram

This diagram shows how the Angular frontend services call FastAPI routes, and how those routes interact with Postgres tables.

```mermaid
flowchart LR
    subgraph FE["Frontend Angular"]
        SVC1["SprintApiService"]
        SVC2["SprintComparisonService"]
        SVC3["PhotoApiService"]
    end

    subgraph API["Backend API FastAPI"]
        R1["GET /api/v1/sprints"]
        R2["GET /api/v1/sprints/best"]
        R3["GET /api/v1/sprints/comparison"]
        R4["GET /api/v1/people"]
        R5["GET /api/v1/locations"]
        R6["GET /api/v1/photos"]
    end

    subgraph DB["Postgres Tables"]
        T1[("people")]
        T2[("sprint_entries")]
        T3[("photos")]
    end

    SVC1 -->|list sprint rows| R1
    SVC1 -->|list best times| R2

    SVC2 -->|load runners| R4
    SVC2 -->|load locations| R5
    SVC2 -->|load comparison series| R3

    SVC3 -->|load gallery rows| R6

    R1 -->|JOIN people + sprint entries| T1
    R1 -->|JOIN people + sprint entries| T2

    R2 -->|window function + JOIN| T2
    R2 -->|window function + JOIN| T1

    R3 -->|validate runner ids| T1
    R3 -->|query progression/daily best| T2

    R4 -->|active people lookup| T1
    R5 -->|distinct locations| T2
    R6 -->|published photos| T3
```

```mermaid
erDiagram
    PEOPLE ||--o{ SPRINT_ENTRIES : "person_id -> people.id"

    PEOPLE {
      int id PK
      string name
      string normalized_name
      boolean is_active
      datetime created_at
    }

    SPRINT_ENTRIES {
      int id PK
      int person_id FK
      int sprint_time_ms
      date sprint_date
      string location
      datetime created_at
    }

    PHOTOS {
      uuid id PK
      string alt_text
      string caption
      string thumb_url
      string full_url
      datetime captured_at
      boolean is_published
      datetime created_at
      datetime updated_at
    }
```

## Notes

- `people` and `sprint_entries` form the sprint domain (one person has many sprint entries).
- `photos` is independent of sprint tables and powers the gallery endpoint.
- The frontend currently reads these resources through dedicated services and does not query the database directly.
