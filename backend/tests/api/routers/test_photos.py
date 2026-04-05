from datetime import datetime, timezone
from uuid import uuid4


def test_batch_upsert_requires_csrf(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200

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

    assert response.status_code == 403


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


def test_batch_upsert_and_list_photos(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    visible_id = uuid4()
    hidden_id = uuid4()
    auth_headers = admin_auth_headers("secret")

    response = client.post(
        "/v1/photos/batch-upsert",
        headers=auth_headers,
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

    client.cookies.clear()
    unauthorized_hidden = client.get("/v1/photos?include_unpublished=true")
    assert unauthorized_hidden.status_code == 401

    admin_auth_headers("secret")

    admin_listed = client.get(
        "/v1/photos?include_unpublished=true",
    )
    assert admin_listed.status_code == 200
    admin_body = admin_listed.json()
    assert admin_body["total"] == 2
    assert {row["id"] for row in admin_body["rows"]} == {str(visible_id), str(hidden_id)}


def test_batch_upsert_photos_validates_uuid(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    auth_headers = admin_auth_headers("secret")
    response = client.post(
        "/v1/photos/batch-upsert",
        headers=auth_headers,
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


def test_update_photo_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = client.post(
        f"/v1/photos/{uuid4()}",
        json={
            "alt_text": "Updated alt",
            "caption": "Updated caption",
            "thumb_url": "/media/gallery/updated-thumb.webp",
            "full_url": "/media/gallery/updated-full.webp",
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "is_published": True,
        },
    )

    assert response.status_code == 401


def test_delete_photo_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = client.delete(f"/v1/photos/{uuid4()}")
    assert response.status_code == 401


def test_update_and_delete_photo_by_id(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    photo_id = uuid4()
    auth_headers = admin_auth_headers("secret")

    create_response = client.post(
        "/v1/photos/batch-upsert",
        headers=auth_headers,
        json={
            "rows": [
                {
                    "id": str(photo_id),
                    "alt_text": "Original alt",
                    "caption": "Original caption",
                    "thumb_url": "/media/gallery/original-thumb.webp",
                    "full_url": "/media/gallery/original-full.webp",
                    "captured_at": "2026-03-16T08:15:00+00:00",
                    "is_published": True,
                }
            ]
        },
    )
    assert create_response.status_code == 200

    update_response = client.post(
        f"/v1/photos/{photo_id}",
        headers=auth_headers,
        json={
            "alt_text": "Updated alt",
            "caption": "Updated caption",
            "thumb_url": "/media/gallery/updated-thumb.webp",
            "full_url": "/media/gallery/updated-full.webp",
            "captured_at": "2026-03-17T08:15:00+00:00",
            "is_published": False,
        },
    )
    assert update_response.status_code == 200
    update_body = update_response.json()
    assert update_body["id"] == str(photo_id)
    assert update_body["caption"] == "Updated caption"
    assert update_body["is_published"] is False

    patch_response = client.patch(
        f"/v1/photos/{photo_id}",
        headers=auth_headers,
        json={"caption": "Patched caption"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["caption"] == "Patched caption"

    listed_after_update = client.get("/v1/photos")
    assert listed_after_update.status_code == 200
    assert listed_after_update.json()["total"] == 0

    delete_response = client.delete(
        f"/v1/photos/{photo_id}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204


def test_update_photo_supports_partial_updates(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    photo_id = uuid4()
    auth_headers = admin_auth_headers("secret")

    create_response = client.post(
        "/v1/photos/batch-upsert",
        headers=auth_headers,
        json={
            "rows": [
                {
                    "id": str(photo_id),
                    "alt_text": "Original alt",
                    "caption": "Original caption",
                    "thumb_url": "/media/gallery/original-thumb.webp",
                    "full_url": "/media/gallery/original-full.webp",
                    "captured_at": "2026-03-16T08:15:00+00:00",
                    "is_published": True,
                }
            ]
        },
    )
    assert create_response.status_code == 200

    update_response = client.post(
        f"/v1/photos/{photo_id}",
        headers=auth_headers,
        json={"caption": "Updated caption only", "is_published": False},
    )
    assert update_response.status_code == 200
    update_body = update_response.json()
    assert update_body["id"] == str(photo_id)
    assert update_body["alt_text"] == "Original alt"
    assert update_body["caption"] == "Updated caption only"
    assert update_body["thumb_url"] == "/media/gallery/original-thumb.webp"
    assert update_body["full_url"] == "/media/gallery/original-full.webp"
    assert update_body["is_published"] is False


def test_update_and_delete_photo_return_404_for_missing_id(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    missing_id = uuid4()
    auth_headers = admin_auth_headers("secret")

    update_response = client.post(
        f"/v1/photos/{missing_id}",
        headers=auth_headers,
        json={
            "alt_text": "No photo",
            "caption": "No photo",
            "thumb_url": "/media/gallery/no-thumb.webp",
            "full_url": "/media/gallery/no-full.webp",
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "is_published": True,
        },
    )
    assert update_response.status_code == 404

    delete_response = client.delete(
        f"/v1/photos/{missing_id}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 404
