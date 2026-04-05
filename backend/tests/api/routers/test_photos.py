from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from services.photos import ProcessedPhotoMedia


def _processed_fixture(thumb_url: str, full_url: str) -> ProcessedPhotoMedia:
    return ProcessedPhotoMedia(
        thumb_url=thumb_url,
        full_url=full_url,
        written_paths=(Path("/tmp/nonexistent-thumb"), Path("/tmp/nonexistent-full")),
    )


def test_upload_photo_requires_csrf(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200

    response = client.post(
        "/v1/photos",
        files={"file": ("upload.jpg", BytesIO(b"123"), "image/jpeg")},
        data={"caption": "No csrf"},
    )

    assert response.status_code == 403


def test_upload_photo_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = client.post(
        "/v1/photos",
        files={"file": ("upload.jpg", BytesIO(b"123"), "image/jpeg")},
        data={"caption": "No auth"},
    )

    assert response.status_code == 401


def test_upload_and_list_photos(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")
    monkeypatch.setattr(
        "services.photos._process_uploaded_image",
        lambda *, source_path, source_hash: _processed_fixture(
            thumb_url="/media/gallery/new-thumb.webp", full_url="/media/gallery/new-full.webp"
        ),
    )
    monkeypatch.setattr(
        "services.photos._extract_exif_captured_at",
        lambda source_path: datetime(2026, 4, 2, 13, 0, tzinfo=timezone.utc),
    )

    visible = client.post(
        "/v1/photos",
        headers=headers,
        files={"file": ("visible.jpg", BytesIO(b"123"), "image/jpeg")},
        data={"caption": "Visible caption", "alt_text": "Visible alt", "is_published": "true"},
    )
    assert visible.status_code == 200

    hidden = client.post(
        "/v1/photos",
        headers=headers,
        files={"file": ("hidden.jpg", BytesIO(b"456"), "image/jpeg")},
        data={"caption": "Hidden caption", "is_published": "false"},
    )
    assert hidden.status_code == 200

    listed = client.get("/v1/photos")
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    assert body["rows"][0]["caption"] == "Visible caption"

    client.cookies.clear()
    unauthorized_hidden = client.get("/v1/photos?include_unpublished=true")
    assert unauthorized_hidden.status_code == 401

    admin_auth_headers("secret")
    admin_listed = client.get("/v1/photos?include_unpublished=true")
    assert admin_listed.status_code == 200
    assert admin_listed.json()["total"] == 2


def test_upload_photo_rejects_files_over_size_limit(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    monkeypatch.setenv("PHOTOS_MAX_UPLOAD_BYTES", "4")
    headers = admin_auth_headers("secret")

    response = client.post(
        "/v1/photos",
        headers=headers,
        files={"file": ("upload.jpg", BytesIO(b"12345"), "image/jpeg")},
        data={"caption": "Too large"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Uploaded image exceeds configured max size (4 bytes)"


def test_upload_photo_uses_client_last_modified_when_exif_missing(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")
    monkeypatch.setattr(
        "services.photos._process_uploaded_image",
        lambda *, source_path, source_hash: _processed_fixture(
            thumb_url="/media/gallery/new-thumb.webp", full_url="/media/gallery/new-full.webp"
        ),
    )
    monkeypatch.setattr("services.photos._extract_exif_captured_at", lambda source_path: None)

    uploaded = client.post(
        "/v1/photos",
        headers=headers,
        files={"file": ("upload.jpg", BytesIO(b"123"), "image/jpeg")},
        data={
            "caption": "Misty ridge",
            "client_last_modified": "2026-03-20T02:16:45+00:00",
            "is_published": "true",
        },
    )

    assert uploaded.status_code == 200
    assert uploaded.json()["captured_at"] == "2026-03-20T02:16:45Z"


def test_upload_photo_rejects_malformed_datetime_fields(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")

    response = client.post(
        "/v1/photos",
        headers=headers,
        files={"file": ("upload.jpg", BytesIO(b"123"), "image/jpeg")},
        data={"caption": "Bad date", "captured_at": "not-a-date"},
    )

    assert response.status_code == 422
    assert "captured_at" in response.json()["detail"]


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
    auth_headers = admin_auth_headers("secret")
    monkeypatch.setattr(
        "services.photos._process_uploaded_image",
        lambda *, source_path, source_hash: _processed_fixture(
            thumb_url="/media/gallery/original-thumb.webp", full_url="/media/gallery/original-full.webp"
        ),
    )
    monkeypatch.setattr(
        "services.photos._extract_exif_captured_at",
        lambda source_path: datetime(2026, 3, 16, 8, 15, tzinfo=timezone.utc),
    )

    create_response = client.post(
        "/v1/photos",
        headers=auth_headers,
        files={"file": ("original.jpg", BytesIO(b"123"), "image/jpeg")},
        data={"caption": "Original caption", "alt_text": "Original alt", "is_published": "true"},
    )
    assert create_response.status_code == 200
    photo_id = create_response.json()["id"]

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
    auth_headers = admin_auth_headers("secret")
    monkeypatch.setattr(
        "services.photos._process_uploaded_image",
        lambda *, source_path, source_hash: _processed_fixture(
            thumb_url="/media/gallery/original-thumb.webp", full_url="/media/gallery/original-full.webp"
        ),
    )
    monkeypatch.setattr(
        "services.photos._extract_exif_captured_at",
        lambda source_path: datetime(2026, 3, 16, 8, 15, tzinfo=timezone.utc),
    )

    create_response = client.post(
        "/v1/photos",
        headers=auth_headers,
        files={"file": ("original.jpg", BytesIO(b"123"), "image/jpeg")},
        data={"caption": "Original caption", "alt_text": "Original alt", "is_published": "true"},
    )
    assert create_response.status_code == 200
    photo_id = create_response.json()["id"]

    update_response = client.post(
        f"/v1/photos/{photo_id}",
        headers=auth_headers,
        json={"caption": "Updated caption only", "is_published": False},
    )
    assert update_response.status_code == 200
    update_body = update_response.json()
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
