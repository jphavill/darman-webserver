from datetime import datetime, timezone
from uuid import uuid4


def test_batch_upsert_photos_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = client.post(
        "/v1/photos/batch-upsert",
        json={
            "rows": [
                {
                    "id": str(uuid4()),
                    "alt_text": "Bench",
                    "caption": "Evening light",
                    "thumb_url": "/media/gallery/bench-thumb.webp",
                    "full_url": "/media/gallery/bench-full.webp",
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "is_published": True,
                }
            ]
        },
    )

    assert response.status_code == 401


def test_batch_upsert_and_list_photos(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    visible_id = uuid4()
    hidden_id = uuid4()

    response = client.post(
        "/v1/photos/batch-upsert",
        headers={"Authorization": "Bearer secret"},
        json={
            "rows": [
                {
                    "id": str(visible_id),
                    "alt_text": "Fog over ridge",
                    "caption": "Morning fog",
                    "thumb_url": "/media/gallery/fog-thumb.webp",
                    "full_url": "/media/gallery/fog-full.webp",
                    "captured_at": "2026-03-16T08:15:00+00:00",
                    "is_published": True,
                },
                {
                    "id": str(hidden_id),
                    "alt_text": "Hidden frame",
                    "caption": "Draft photo",
                    "thumb_url": "/media/gallery/draft-thumb.webp",
                    "full_url": "/media/gallery/draft-full.webp",
                    "captured_at": "2026-03-17T08:15:00+00:00",
                    "is_published": False,
                },
            ]
        },
    )

    assert response.status_code == 200

    listed = client.get("/v1/photos")
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    assert body["rows"][0]["id"] == str(visible_id)
    assert body["rows"][0]["caption"] == "Morning fog"


def test_batch_upsert_photos_validates_uuid(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = client.post(
        "/v1/photos/batch-upsert",
        headers={"Authorization": "Bearer secret"},
        json={
            "rows": [
                {
                    "id": "not-a-uuid",
                    "alt_text": "Bench",
                    "caption": "Evening light",
                    "thumb_url": "/media/gallery/bench-thumb.webp",
                    "full_url": "/media/gallery/bench-full.webp",
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "is_published": True,
                }
            ]
        },
    )

    assert response.status_code == 422
